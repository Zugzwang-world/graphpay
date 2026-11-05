// A graph on Arkiv, defined by the developer: node and edge types, totals (running
// counters per node, epoch and window, moved by edge kinds), pair links (a running
// count and sum per from–to pair and kind) and stream checkpoints. Identity is a
// 32-byte node key plus an epoch, so a node that starts over (epoch + 1) starts from
// empty totals. The planner turns events into one atomic batch: the edge, absolute
// totals on both ends in the `all` window and the event's day window, the pair link
// and the checkpoint, so the checkpoint advances if and only if the rows exist.

import { defineEntity, checkDefinition } from './schema.mjs';
import { dayOf } from './values.mjs';

const TYPES = { node: 'node', edge: 'edge', totals: 'totals', link: 'link', checkpoint: 'checkpoint' };

function withIndex(specs, extra = []) {
  const want = new Set(extra);
  return specs.map((spec) => {
    const [head, flags = ''] = spec.split('/');
    const name = head.split(':')[0];
    if (!want.has(name) || flags.includes('i')) return spec;
    return `${head}/${flags}i`;
  });
}

// Increments for one event from a rules object { kind: { counter: 'count' | 'value' | n } }
// or a function (event) => { counter: n } | null.
function incrementsOf(rules, event, counters) {
  if (event.counted === false) return null;
  const raw = typeof rules === 'function' ? rules(event) : rules?.[event.kind];
  if (!raw) return null;
  const out = {};
  for (const [counter, how] of Object.entries(raw)) {
    if (!counters.includes(counter)) throw new Error(`arkiv-graph: rule for "${event.kind}" names unknown counter "${counter}"`);
    const n = how === 'count' ? 1n : how === 'value' ? BigInt(event.value ?? 0n) : BigInt(how);
    if (n < 0n) throw new Error(`arkiv-graph: rule for "${event.kind}" decrements "${counter}"`);
    out[counter] = n;
  }
  return out;
}

const big = (v) => BigInt(v ?? 0);
const posOf = (p) => (p ? [big(p.block), big(p.logIndex)] : null);
const before = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);

export function defineGraph({ project, schemaVersion = 1, types = {}, node = {}, edge = {}, totals = {}, link = {}, checkpoint = {}, entities = {} } = {}) {
  const names = { ...TYPES, ...types };
  const ctx = { project, schemaVersion };
  const valueColumn = edge.value ?? 'value';
  const sumColumn = link.sum ?? 'sum';
  const counters = [...(totals.counters ?? [])];
  const windows = totals.windows ?? ['all', 'day'];
  for (const c of counters) if (!/^[a-z][a-z0-9_]*$/.test(c)) throw new Error(`arkiv-graph: bad counter name "${c}"`);

  const defs = {
    node: defineEntity(names.node, { columns: withIndex(['node:key/i', 'epoch:u64', 'kind:str/i', ...(node.columns ?? [])], node.index), readonly: false }, ctx),
    edge: defineEntity(
      names.edge,
      {
        columns: withIndex(
          [
            'from_node:key/i',
            'to_node:key/i',
            'kind:str/i',
            `${valueColumn}:u64`,
            'day:u64/i',
            'ts:u64',
            'from_epoch:u64/i',
            'to_epoch:u64/i',
            'ref:str/i',
            ...(edge.columns ?? []),
          ],
          edge.index,
        ),
        readonly: edge.readonly ?? true,
      },
      ctx,
    ),
    totals: defineEntity(
      names.totals,
      {
        columns: withIndex(
          [
            'node:key/i',
            'epoch:u64/i',
            'kind:str/i',
            'window:str/i',
            'day:u64/i',
            ...counters.map((c) => `${c}:u64`),
            'seq:u64',
            'last_ts:u64',
            'last_event:str',
            ...(totals.columns ?? []),
          ],
          totals.index,
        ),
        readonly: false,
      },
      ctx,
    ),
    link: defineEntity(
      names.link,
      {
        columns: withIndex(
          [
            'from_node:key/i',
            'to_node:key/i',
            'kind:str/i',
            'from_epoch:u64',
            'to_epoch:u64',
            'count:u64',
            `${sumColumn}:u64`,
            'first_ts:u64',
            'last_ts:u64',
            'last_event:str',
            ...(link.columns ?? []),
          ],
          link.index,
        ),
        readonly: false,
      },
      ctx,
    ),
    checkpoint: defineEntity(
      names.checkpoint,
      { columns: ['stream:str/i', 'block:u64', 'log_index:u64', 'events:u64', 'updated_ts:u64', 'last_event:str', ...(checkpoint.columns ?? [])], readonly: false },
      ctx,
    ),
  };
  for (const [name, spec] of Object.entries(entities)) defs[name] = defineEntity(spec.type ?? name, spec, ctx);

  const problems = [];
  for (const [role, def] of Object.entries(defs)) problems.push(...checkDefinition(def, { noBytes: role === 'totals' || role === 'link' }));
  if (problems.length > 0) throw new Error(`arkiv-graph: bad graph definition: ${problems.join('; ')}`);

  const linkKinds = link.kinds ? new Set(link.kinds) : null;
  const rules = totals.rules ?? {};

  function newState() {
    return { totals: new Map(), links: new Map(), nodes: new Map(), checkpoints: new Map() };
  }

  const totalsId = (n, epoch, window) => `${String(n).toLowerCase()}:${big(epoch)}:${window}`;
  const linkId = (e) => `${String(e.from.node).toLowerCase()}:${big(e.from.epoch)}:${String(e.to.node).toLowerCase()}:${big(e.to.epoch)}:${e.kind}`;
  const nodeId = (end) => `${String(end.node).toLowerCase()}:${big(end.epoch)}`;

  function emptyTotals(end, window, day, labels) {
    const values = { node: end.node, epoch: big(end.epoch), kind: end.kind, window, day: big(day), seq: 0n, last_ts: 0n, last_event: '', ...labels };
    for (const c of counters) values[c] = 0n;
    return values;
  }

  // Plans one batch for a list of events. Returns the creates and patches (each row
  // once, with its final absolute values), the events skipped as already applied, and
  // commit(createdKeys), which records the new state once the receipt is in.
  function plan(events, state, { stream = null, createNodes = false, labels = {} } = {}) {
    const touched = new Map(); // id -> { group, existing, values }
    const edges = [];
    const nodes = [];
    const skipped = [];
    const applied = [];
    const cp = stream ? state.checkpoints.get(stream) : null;
    let cpValues = cp ? { ...cp.values } : null;

    function advance(event, pos) {
      if (!stream) return;
      cpValues ??= { stream, block: 0n, log_index: 0n, events: 0n, updated_ts: 0n, last_event: '' };
      if (pos) {
        cpValues.block = pos[0];
        cpValues.log_index = pos[1];
      }
      cpValues.events = big(cpValues.events) + 1n;
      cpValues.updated_ts = big(event.ts ?? 0);
      cpValues.last_event = event.ref;
    }

    const current = (group, id) => {
      if (touched.has(id)) return touched.get(id);
      const existing = state[group].get(id) ?? null;
      const entry = { group, id, existing, values: existing ? { ...existing.values } : null };
      touched.set(id, entry);
      return entry;
    };

    for (const event of events) {
      if (!event || typeof event.ref !== 'string' || event.ref === '') throw new Error('arkiv-graph: every event needs a ref');
      const pos = posOf(event.position);
      if (cpValues && (cpValues.last_event === event.ref || (pos && cpValues.events > 0n && before(pos, [big(cpValues.block), big(cpValues.log_index)])))) {
        skipped.push(event.ref);
        continue;
      }
      // A node update (standing changes such as a status): a patch of the node row plus
      // the checkpoint, no edge and no totals.
      if (event.nodeUpdate) {
        const id = nodeId(event.nodeUpdate);
        const entry = current('nodes', id);
        if (!entry.existing) throw new Error(`arkiv-graph: node ${id} is not known; create it before updating it`);
        Object.assign(entry.values, event.nodeUpdate.values);
        applied.push(event.ref);
        advance(event, pos);
        continue;
      }
      const day = event.day ?? dayOf(event.ts);
      const inc = incrementsOf(rules, event, counters);
      const ends = [event.from, event.to];
      const rowIds = [];
      if (inc) {
        for (const end of ends) {
          if (windows.includes('all')) rowIds.push([end, 'all', 0]);
          if (windows.includes('day')) rowIds.push([end, `day:${day}`, day]);
        }
      }
      // Row-level guard: a row whose last event is this one means the event already landed.
      if (rowIds.some(([end, w]) => current('totals', totalsId(end.node, end.epoch, w)).values?.last_event === event.ref)) {
        skipped.push(event.ref);
        continue;
      }
      const evLabels = { ...labels, ...(event.labels ?? {}) };
      const labelsFor = (def) => pick(def, evLabels);
      for (const [end, w, d] of rowIds) {
        const entry = current('totals', totalsId(end.node, end.epoch, w));
        entry.values ??= emptyTotals(end, w, d, labelsFor(defs.totals));
        for (const [c, n] of Object.entries(inc)) entry.values[c] = big(entry.values[c]) + n;
        entry.values.seq = big(entry.values.seq) + 1n;
        if (big(event.ts) > big(entry.values.last_ts)) entry.values.last_ts = big(event.ts);
        entry.values.last_event = event.ref;
      }
      if (inc && (!linkKinds || linkKinds.has(event.kind))) {
        const entry = current('links', linkId(event));
        entry.values ??= {
          from_node: event.from.node,
          to_node: event.to.node,
          kind: event.kind,
          from_epoch: big(event.from.epoch),
          to_epoch: big(event.to.epoch),
          count: 0n,
          [sumColumn]: 0n,
          first_ts: big(event.ts),
          last_ts: big(event.ts),
          last_event: '',
          ...labelsFor(defs.link),
        };
        entry.values.count = big(entry.values.count) + 1n;
        entry.values[sumColumn] = big(entry.values[sumColumn]) + big(event.value);
        if (big(event.ts) < big(entry.values.first_ts)) entry.values.first_ts = big(event.ts);
        if (big(event.ts) > big(entry.values.last_ts)) entry.values.last_ts = big(event.ts);
        entry.values.last_event = event.ref;
      }
      if (createNodes) {
        for (const end of ends) {
          const id = nodeId(end);
          if (state.nodes.has(id) || nodes.some((n) => n.id === id)) continue;
          nodes.push({ id, values: { ...labelsFor(defs.node), node: end.node, epoch: big(end.epoch), kind: end.kind, ...(end.columns ?? {}) } });
        }
      }
      // An edge another writer already created (existingEdge) is folded into the totals only.
      if (!event.existingEdge) edges.push({
        ref: event.ref,
        values: {
          ...labelsFor(defs.edge),
          from_node: event.from.node,
          to_node: event.to.node,
          kind: event.kind,
          [valueColumn]: big(event.value),
          day: big(day),
          ts: big(event.ts),
          from_epoch: big(event.from.epoch),
          to_epoch: big(event.to.epoch),
          ref: event.ref,
          ...(event.columns ?? {}),
        },
      });
      applied.push(event.ref);
      advance(event, pos);
    }

    const creates = [];
    const patches = [];
    const createdIds = [];
    for (const e of edges) {
      creates.push({ def: defs.edge, values: e.values });
      createdIds.push({ group: 'edges', id: e.ref });
    }
    for (const n of nodes) {
      creates.push({ def: defs.node, values: n.values });
      createdIds.push({ group: 'nodes', id: n.id, values: n.values });
    }
    for (const entry of touched.values()) {
      if (!entry.values) continue;
      const def = entry.group === 'totals' ? defs.totals : entry.group === 'links' ? defs.link : defs.node;
      if (entry.existing) {
        const diff = changed(entry.existing.values, entry.values);
        if (Object.keys(diff).length === 0) continue;
        if (!entry.existing.key) throw new Error(`arkiv-graph: ${entry.id} has no entity key; a created row needs its key before it is patched`);
        patches.push({ def, key: entry.existing.key, values: diff });
      } else {
        creates.push({ def, values: entry.values });
        createdIds.push({ group: entry.group, id: entry.id, values: entry.values });
      }
    }
    if (stream && applied.length > 0) {
      if (cp) {
        if (!cp.key) throw new Error(`arkiv-graph: checkpoint ${stream} has no entity key`);
        patches.push({ def: defs.checkpoint, key: cp.key, values: changed(cp.values, cpValues) });
      } else {
        creates.push({ def: defs.checkpoint, values: cpValues });
        createdIds.push({ group: 'checkpoints', id: stream, values: cpValues });
      }
    }

    function commit(createdKeys) {
      if (!Array.isArray(createdKeys) || createdKeys.length !== creates.length) {
        throw new Error(`arkiv-graph: ${creates.length} creates but ${createdKeys?.length ?? 0} keys; a created row without a key is an error`);
      }
      const edgeKeys = {};
      createdIds.forEach((c, i) => {
        const k = createdKeys[i];
        if (typeof k !== 'string' || !/^0x[0-9a-f]{64}$/i.test(k)) throw new Error(`arkiv-graph: no entity key for ${c.group} ${c.id}`);
        if (c.group === 'edges') edgeKeys[c.id] = k.toLowerCase();
        else state[c.group].set(c.id, { key: k.toLowerCase(), values: c.values });
      });
      for (const entry of touched.values()) {
        if (entry.existing && entry.values) state[entry.group].set(entry.id, { key: entry.existing.key, values: entry.values });
      }
      if (stream && cp && applied.length > 0) state.checkpoints.set(stream, { key: cp.key, values: cpValues });
      return edgeKeys;
    }

    return { creates, patches, skipped, applied, commit };
  }

  return Object.freeze({ project, schemaVersion: BigInt(schemaVersion), names, defs, counters, windows, valueColumn, sumColumn, newState, plan, incrementsOf: (e) => incrementsOf(rules, e, counters) });
}

// The entries of an object that are columns of an entity.
function pick(def, obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (Object.hasOwn(def.schema.columns, k)) out[k] = v;
  return out;
}

// Only the columns whose value changed (absolute values, so a patch is the new state).
function changed(before, after) {
  const out = {};
  for (const [k, v] of Object.entries(after)) {
    if (k === 'project' || k === 'type' || k === 'schema_v') continue;
    if (before?.[k] !== v) out[k] = v;
  }
  return out;
}
