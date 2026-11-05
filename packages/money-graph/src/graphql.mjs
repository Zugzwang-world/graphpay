// GraphQL over the money graph (planning/SPEC/ARKIV_GRAPH.md §5, M7 amendment §6): one
// document answers a money question with the fewest Arkiv reads; every answer carries
// extensions.arkiv, the explain trace of its reads. Queries only. A Node is a lazy
// reference: its key comes from the name with no lookup. Reputation reads the current
// epoch only; rates are 4-place strings rounded down. Synthetic data only on opt-in.

import DataLoader from 'dataloader';
import { u64, str, key } from '@arkiv-network/sdk';
import { and, between, desc, eq, gte, lte, or } from '@arkiv-network/sdk/query';
import { GraphQLScalarType, Kind, buildSchema, parse, validate, execute, specifiedRules } from 'graphql';
import { createEngine, createExplainStore, dayOf, fromJsonBytes } from '@graphpay/arkiv-graph';
import { normalizedName, nodeOf } from './identity.mjs';
import { ENTITIES, MONEY_KINDS, TALLY_COUNTERS, writerAddresses, seedOwner } from './model.mjs';
import { discoveryFilters } from './directory.mjs';
import { story } from '@graphpay/config';

export const SDL = /* GraphQL */ `
"""An unsigned 64-bit integer, as a decimal string."""
scalar U64

enum Window { TODAY D30 D90 ALL }
enum Source { TALLY RAW_VERIFIED MISMATCH TRUNCATED }

input Box { latMin: Int!, latMax: Int!, lngMin: Int!, lngMax: Int! }

type Query {
  node(ens: String!, epoch: Int): Node
  nodes(kind: String, category: String, city: String, ens: String, limit: Int = 50): [Node!]!
  top(kind: String!, by: String!, window: String = "all", limit: Int = 10): [Ranked!]!
  path(from: String!, to: String!, maxDepth: Int = 3, kinds: [String!]): Path!
  neighborhood(ens: String!, depth: Int = 2, kind: String = "pay", sinceDay: Int): Neighborhood!
  edges(kind: String!, sinceDay: Int, untilDay: Int, limit: Int = 50): [Edge!]!
  order(id: String!): [Edge!]!
  shops(category: String, box: Box!, synthetic: Boolean = false, limit: Int = 50): [Shop!]!
  today: Int!
}

type Node {
  ens: String!
  key: String!
  epoch: Int!
  kind: String
  verified: Boolean
  synthetic: Boolean
  dataset: String
  category: String
  city: String
  status: String
  capMicro: U64
  tally(window: String = "all"): Tally
  out(kind: String, kinds: [String!], sinceDay: Int, limit: Int = 50): [Edge!]!
  in(kind: String, kinds: [String!], sinceDay: Int, limit: Int = 50): [Edge!]!
  owner: Node
  agents: [Node!]!
  reputation(window: Window = D90, verify: Boolean = false): Reputation!
}

type Edge {
  kind: String!
  from: Node!
  to: Node!
  amountMicro: U64!
  day: Int!
  ts: U64!
  fromEpoch: Int!
  toEpoch: Int!
  ref: String!
  orderId: String
  synthetic: Boolean!
}

type Tally { orders: U64! paidMicro: U64! refunds: U64! refundedMicro: U64! fails: U64! delivered: U64! onTime: U64! cancels: U64! disputes: U64! lastTs: U64! }

type Reputation {
  orders: U64!
  refunds: U64!
  fails: U64!
  delivered: U64!
  onTime: U64!
  cancellations: U64!
  disputes: U64!
  refundRate: String!
  onTimeRate: String!
  paidUsdt: String!
  refundedUsdt: String!
  source: Source!
  synthetic: Boolean!
}

type Ranked { node: Node!, value: U64!, tally: Tally! }
type Path { found: Boolean!, hops: Int, nodes: [Node!]! }
type Neighborhood { nodes: [Node!]!, edges: [Edge!]! }

type Shop {
  ens: String!
  shopKey: String!
  category: String!
  area: String
  city: String
  lat: Int!
  lng: Int!
  synthetic: Boolean!
  dataset: String
  name: String
  hours: String
  node: Node!
}
`;

const U64 = new GraphQLScalarType({
  name: 'U64',
  serialize: (v) => String(v),
  parseValue: (v) => BigInt(v),
  parseLiteral: (ast) => (ast.kind === Kind.STRING || ast.kind === Kind.INT ? BigInt(ast.value) : undefined),
});

const DAYS = { TODAY: 1, D30: 30, D90: 90 };
const big = (v) => BigInt(v ?? 0);

// 4-place decimal string, rounded down.
export function rate(n, d) {
  if (big(d) === 0n) return '0.0000';
  const x = (big(n) * 10_000n) / big(d);
  return `${x / 10_000n}.${String(x % 10_000n).padStart(4, '0')}`;
}

export function usdt(micro) {
  const m = big(micro);
  const frac = String(m % 1_000_000n).padStart(6, '0').replace(/0+$/, '');
  return `${m / 1_000_000n}${frac ? `.${frac}` : ''}`;
}

// Owners per entity type for a dataset: live data from the ledger (and the recorder for
// edges); a synthetic city from its seed wallet alone, read only when asked for.
export function ownersFor(dataset = 'live', writers = writerAddresses()) {
  if (dataset === 'live') return { node: [writers.W_LEDGER], tally: [writers.W_LEDGER], link: [writers.W_LEDGER], edge: [writers.W_LEDGER, writers.W_SYNC], shop: [writers.W_DIRECTORY] };
  const seed = seedOwner(dataset, story, writers);
  return { node: [seed], tally: [seed], link: [seed], edge: [seed], shop: [writers.W_DIRECTORY] };
}

function nodeRef(ens, epoch = null) {
  const name = normalizedName(ens);
  return { ens: name, key: nodeOf(name), pinnedEpoch: epoch };
}

function tallyOut(t) {
  const v = (k) => big(t?.[k]);
  return { orders: v('orders'), paidMicro: v('paid_micro'), refunds: v('refunds'), refundedMicro: v('refunded_micro'), fails: v('fails'), delivered: v('delivered'), onTime: v('on_time'), cancels: v('cancels'), disputes: v('disputes'), lastTs: v('last_ts') };
}

function edgeOut(r) {
  return {
    kind: r.kind,
    from: r.from_ens ? nodeRef(r.from_ens, Number(r.from_epoch)) : { ens: null, key: r.from_node, pinnedEpoch: Number(r.from_epoch) },
    to: r.to_ens ? nodeRef(r.to_ens, Number(r.to_epoch)) : { ens: null, key: r.to_node, pinnedEpoch: Number(r.to_epoch) },
    amountMicro: big(r.amount_micro),
    day: Number(r.day),
    ts: big(r.ts),
    fromEpoch: Number(r.from_epoch),
    toEpoch: Number(r.to_epoch),
    ref: r.ref,
    orderId: r.order_id ?? null,
    synthetic: Boolean(r.synthetic),
  };
}

// Edges from several writers are merged by ref (the earliest row wins; M7 amendment §2).
function byRef(rows) {
  const out = new Map();
  for (const r of rows) {
    const seen = out.get(r.ref);
    if (!seen || big(r.ts) < big(seen.ts)) out.set(r.ref, r);
  }
  return [...out.values()];
}

export function createContext({ engine, dataset = 'live', listCap = 100, writers, callBudget = 60 } = {}) {
  const ctx = engine.context({ callBudget });
  const owners = ownersFor(dataset, writers);
  const cap = (n) => Math.max(1, Math.min(listCap, n ?? listCap));

  const nodeRows = new DataLoader(async (keys) => {
    const rows = await ctx.queryAny(ENTITIES.node, { terms: keys.map((k) => eq('node', key(k))), owners: owners.node });
    return keys.map((k) => rows.filter((r) => r.node === k));
  });
  const currentEpoch = async (ref) => {
    if (ref.pinnedEpoch !== null && ref.pinnedEpoch !== undefined) return ref.pinnedEpoch;
    const rows = await nodeRows.load(ref.key);
    return rows.reduce((m, r) => Math.max(m, Number(r.epoch)), 0);
  };
  const nodeRow = async (ref) => {
    const e = await currentEpoch(ref);
    return (await nodeRows.load(ref.key)).find((r) => Number(r.epoch) === e) ?? null;
  };

  // Tally rows: grouped by (epoch, window), one OR over the nodes per group.
  const tallies = new DataLoader(async (ids) => {
    const groups = new Map();
    for (const id of ids) {
      const [k, e, w] = id.split('|');
      const g = `${e}|${w}`;
      if (!groups.has(g)) groups.set(g, { e, w, keys: [] });
      groups.get(g).keys.push(k);
    }
    const found = new Map();
    for (const { e, w, keys } of groups.values()) {
      const rows = await ctx.queryAny(ENTITIES.tally, { where: [eq('epoch', u64(BigInt(e))), eq('window', str(w))], terms: keys.map((k) => eq('node', key(k))), owners: owners.tally });
      for (const r of rows) found.set(`${r.node}|${r.epoch}|${r.window}`, r);
    }
    return ids.map((id) => found.get(id) ?? null);
  });

  // Day tallies of a window: grouped by (epoch, range), chunked so a chunk's rows stay under the cap.
  const windows = new DataLoader(async (ids) => {
    const groups = new Map();
    for (const id of ids) {
      const [k, e, lo, hi] = id.split('|');
      const g = `${e}|${lo}|${hi}`;
      if (!groups.has(g)) groups.set(g, { e, lo, hi, keys: [] });
      groups.get(g).keys.push(k);
    }
    const found = new Map(ids.map((id) => [id, []]));
    for (const { e, lo, hi, keys } of groups.values()) {
      const days = Number(hi) - Number(lo) + 1;
      const rows = await ctx.queryAny(ENTITIES.tally, {
        where: [eq('epoch', u64(BigInt(e))), between('day', u64(BigInt(lo)), u64(BigInt(hi)))],
        terms: keys.map((k) => eq('node', key(k))),
        owners: owners.tally,
        maxTerms: Math.max(1, Math.floor(500 / days)),
      });
      for (const r of rows) if (r.window.startsWith('day:')) found.get(`${r.node}|${e}|${lo}|${hi}`)?.push(r);
    }
    return ids.map((id) => found.get(id));
  });

  const edgeMemo = new Map();
  function edgesOf(ref, dir, args) {
    const id = JSON.stringify([ref.key, ref.pinnedEpoch, dir, args.kind ?? null, args.kinds ?? null, args.sinceDay ?? null, args.limit ?? null]);
    if (!edgeMemo.has(id)) edgeMemo.set(id, edgesOfUncached(ref, dir, args));
    return edgeMemo.get(id);
  }

  async function edgesOfUncached(ref, dir, { kind, kinds, sinceDay, limit }) {
    const e = await currentEpoch(ref);
    const ks = kinds ?? (kind ? [kind] : null);
    const where = [eq(`${dir}_node`, key(ref.key)), eq(`${dir}_epoch`, u64(BigInt(e)))];
    if (ks && ks.length > 0) where.push(ks.length === 1 ? eq('kind', str(ks[0])) : or(ks.map((k) => eq('kind', str(k)))));
    if (sinceDay !== undefined && sinceDay !== null) where.push(gte('day', u64(BigInt(sinceDay))));
    return byRef(await ctx.query(ENTITIES.edge, { where, owners: owners.edge, want: cap(limit) })).map(edgeOut);
  }

  async function verifyCounts(ref, epoch, lo, hi) {
    const ends = or(and(eq('from_node', key(ref.key)), eq('from_epoch', u64(BigInt(epoch)))), and(eq('to_node', key(ref.key)), eq('to_epoch', u64(BigInt(epoch)))));
    const range = lo === null ? [] : [between('day', u64(BigInt(lo)), u64(BigInt(hi)))];
    const count = (kinds) => ctx.count(ENTITIES.edge, { where: [ends, kinds.length === 1 ? eq('kind', str(kinds[0])) : or(kinds.map((k) => eq('kind', str(k)))), ...range], owners: owners.edge });
    return { orders: await count(['order', 'subscribe']), refunds: await count(['refund']), fails: await count(['fail']) };
  }

  const resolvers = {
    Node: {
      ens: (n) => n.ens,
      key: (n) => n.key,
      epoch: (n) => currentEpoch(n),
      kind: async (n) => (await nodeRow(n))?.kind ?? null,
      verified: async (n) => (await nodeRow(n))?.verified ?? null,
      synthetic: async (n) => (await nodeRow(n))?.synthetic ?? null,
      dataset: async (n) => (await nodeRow(n))?.dataset ?? null,
      category: async (n) => (await nodeRow(n))?.category ?? null,
      city: async (n) => (await nodeRow(n))?.city ?? null,
      status: async (n) => (await nodeRow(n))?.status ?? null,
      capMicro: async (n) => (await nodeRow(n))?.cap_micro ?? null,
      tally: async (n, { window }) => {
        const t = await tallies.load(`${n.key}|${await currentEpoch(n)}|${window}`);
        return t ? tallyOut(t) : null;
      },
      out: (n, args) => edgesOf(n, 'from', args),
      in: (n, args) => edgesOf(n, 'to', args),
      owner: async (n) => {
        const row = await nodeRow(n);
        if (!row?.owner_node) return null;
        const rows = await nodeRows.load(row.owner_node);
        const ens = rows[0]?.ens;
        return ens ? nodeRef(ens) : { ens: null, key: row.owner_node, pinnedEpoch: null };
      },
      agents: async (n) => {
        const rows = await ctx.query(ENTITIES.node, { where: [eq('owner_node', key(n.key)), eq('kind', str('agent'))], owners: owners.node, want: 100 });
        return [...new Set(rows.map((r) => r.ens))].map((ens) => nodeRef(ens));
      },
      reputation: async (n, { window, verify }) => {
        const epoch = await currentEpoch(n);
        let t;
        let lo = null;
        let hi = null;
        if (window === 'ALL') {
          t = tallyOut(await tallies.load(`${n.key}|${epoch}|all`));
        } else {
          hi = dayOf(Date.now() / 1000);
          lo = hi - DAYS[window] + 1;
          const rows = await windows.load(`${n.key}|${epoch}|${lo}|${hi}`);
          t = tallyOut({});
          for (const r of rows) for (const [k, v] of Object.entries(tallyOut(r))) if (k !== 'lastTs') t[k] += v;
        }
        let source = 'TALLY';
        if (verify) {
          const c = await verifyCounts(n, epoch, lo, hi);
          source = c.orders === t.orders && c.refunds === t.refunds && c.fails === t.fails ? 'RAW_VERIFIED' : 'MISMATCH';
        }
        if (ctx.truncated) source = 'TRUNCATED';
        const row = await nodeRow(n);
        return {
          orders: t.orders,
          refunds: t.refunds,
          fails: t.fails,
          delivered: t.delivered,
          onTime: t.onTime,
          cancellations: t.cancels,
          disputes: t.disputes,
          refundRate: rate(t.refunds, t.orders),
          onTimeRate: rate(t.onTime, t.delivered),
          paidUsdt: usdt(t.paidMicro),
          refundedUsdt: usdt(t.refundedMicro),
          source,
          synthetic: Boolean(row?.synthetic ?? dataset !== 'live'),
        };
      },
    },
    Query: {
      today: () => dayOf(Date.now() / 1000),
      node: (_, { ens, epoch }) => nodeRef(ens, epoch ?? null),
      nodes: async (_, { kind, category, city, ens, limit }) => {
        const where = [];
        if (kind) where.push(eq('kind', str(kind)));
        if (category) where.push(eq('category', str(category)));
        if (city) where.push(eq('city', str(city)));
        if (ens) where.push(eq('ens', str(normalizedName(ens))));
        if (where.length === 0) throw new Error('nodes: give at least one of kind, category, city, ens');
        const rows = await ctx.query(ENTITIES.node, { where, owners: owners.node, want: cap(limit) });
        return [...new Map(rows.map((r) => [r.ens, r])).keys()].map((e) => nodeRef(e));
      },
      top: async (_, { kind, by, window, limit }) => {
        if (!TALLY_COUNTERS.includes(by)) throw new Error(`top: "by" is one of ${TALLY_COUNTERS.join(', ')}`);
        const n = cap(limit);
        const rows = await ctx.query(ENTITIES.tally, { where: [eq('kind', str(kind)), eq('window', str(window))], owners: owners.tally, orderBy: desc(by, 'u64'), want: Math.min(100, n * 2) });
        // One batched node lookup drops rows of superseded epochs.
        await Promise.all(rows.map((r) => nodeRows.load(r.node)));
        const live = [];
        for (const r of rows) {
          const nodes = await nodeRows.load(r.node);
          const current = nodes.reduce((m, x) => Math.max(m, Number(x.epoch)), 0);
          if (Number(r.epoch) === current) live.push({ r, ens: nodes.find((x) => Number(x.epoch) === current)?.ens ?? nodes[0]?.ens });
        }
        return live.slice(0, n).map(({ r, ens }) => ({ node: ens ? nodeRef(ens, Number(r.epoch)) : { ens: null, key: r.node, pinnedEpoch: Number(r.epoch) }, value: big(r[by]), tally: tallyOut(r) }));
      },
      edges: async (_, { kind, sinceDay, untilDay, limit }) => {
        const where = [eq('kind', str(kind))];
        if (sinceDay !== undefined && sinceDay !== null) where.push(gte('day', u64(BigInt(sinceDay))));
        if (untilDay !== undefined && untilDay !== null) where.push(lte('day', u64(BigInt(untilDay))));
        return byRef(await ctx.query(ENTITIES.edge, { where, owners: owners.edge, want: cap(limit) })).map(edgeOut);
      },
      order: async (_, { id }) => byRef(await ctx.query(ENTITIES.edge, { where: [eq('order_id', str(id))], owners: owners.edge, want: 100 })).map(edgeOut),
      shops: async (_, { category, box, synthetic, limit }) => {
        const rows = await ctx.query(ENTITIES.shop, { where: discoveryFilters({ category, box, synthetic }).slice(2), owners: owners.shop, want: cap(limit) });
        const seen = new Map();
        for (const r of rows) {
          if (r.status !== 'active' || r.lat < box.latMin || r.lat > box.latMax || r.lng < box.lngMin || r.lng > box.lngMax) continue;
          if (!synthetic && r.synthetic) continue;
          const p = fromJsonBytes(r.payload) ?? {};
          seen.set(r.shop_ens, { ens: r.shop_ens, shopKey: r.shop_key, category: r.category, area: r.area ?? null, city: r.city ?? null, lat: r.lat, lng: r.lng, synthetic: r.synthetic, dataset: r.dataset ?? null, name: p.name ?? null, hours: p.hours ?? null, node: nodeRef(r.shop_ens) });
        }
        return [...seen.values()];
      },
      path: async (_, { from, to, maxDepth, kinds }) => {
        const depth = Math.min(3, Math.max(1, maxDepth ?? 3));
        const ks = kinds && kinds.length > 0 ? kinds : ['pay'];
        for (const k of ks) if (!MONEY_KINDS.includes(k)) throw new Error(`path: links exist for ${MONEY_KINDS.join(', ')}`);
        const a = nodeRef(from);
        const b = nodeRef(to);
        if (a.key === b.key) return { found: true, hops: 0, nodes: [a] };
        // Two-ended search over pair links, expanding the smaller side.
        const names = new Map([[a.key, a.ens], [b.key, b.ens]]);
        const sides = [{ parent: new Map([[a.key, null]]), frontier: [a.key] }, { parent: new Map([[b.key, null]]), frontier: [b.key] }];
        for (let hop = 1; hop <= depth; hop += 1) {
          const s = sides[0].frontier.length <= sides[1].frontier.length ? 0 : 1;
          const side = sides[s];
          const other = sides[1 - s];
          const terms = side.frontier.flatMap((k) => [eq('from_node', key(k)), eq('to_node', key(k))]);
          const kindFilter = ks.length === 1 ? eq('kind', str(ks[0])) : or(ks.map((k) => eq('kind', str(k))));
          const rows = await ctx.queryAny(ENTITIES.link, { where: [kindFilter], terms, owners: owners.link });
          const next = [];
          for (const r of rows) {
            for (const [x, y, ens] of [[r.from_node, r.to_node, r.to_ens], [r.to_node, r.from_node, r.from_ens]]) {
              if (!side.parent.has(x) || side.parent.has(y)) continue;
              if (!side.frontier.includes(x)) continue;
              side.parent.set(y, x);
              if (ens) names.set(y, ens);
              next.push(y);
              if (other.parent.has(y)) {
                const chain = (p, k) => {
                  const out = [];
                  for (let c = k; c !== null; c = p.get(c)) out.push(c);
                  return out;
                };
                const left = chain(sides[0].parent, y).reverse();
                const right = chain(sides[1].parent, y).slice(1);
                const keys = [...left, ...right];
                return { found: true, hops: keys.length - 1, nodes: keys.map((k) => (names.get(k) ? nodeRef(names.get(k)) : { ens: null, key: k, pinnedEpoch: null })) };
              }
            }
          }
          if (next.length > 500) {
            ctx.warn('path: more than 500 nodes in one hop, cut');
            ctx.markTruncated();
          }
          side.frontier = next.slice(0, 500);
          if (side.frontier.length === 0) break;
        }
        return { found: false, hops: null, nodes: [] };
      },
      neighborhood: async (_, { ens, depth, kind, sinceDay }) => {
        const start = nodeRef(ens);
        const d = Math.min(3, Math.max(1, depth ?? 2));
        const names = new Map([[start.key, start.ens]]);
        const seen = new Set([start.key]);
        const edges = new Map();
        let frontier = [start.key];
        for (let hop = 1; hop <= d && frontier.length > 0; hop += 1) {
          const where = [eq('kind', str(kind))];
          if (sinceDay !== undefined && sinceDay !== null) where.push(gte('day', u64(BigInt(sinceDay))));
          const rows = await ctx.queryAny(ENTITIES.edge, { where, terms: frontier.flatMap((k) => [eq('from_node', key(k)), eq('to_node', key(k))]), owners: owners.edge });
          const next = [];
          for (const r of rows) {
            edges.set(r.$key, r);
            for (const [k, n] of [[r.from_node, r.from_ens], [r.to_node, r.to_ens]]) {
              if (n) names.set(k, n);
              if (!seen.has(k)) {
                seen.add(k);
                next.push(k);
              }
            }
          }
          if (next.length > 500) {
            ctx.warn('neighborhood: more than 500 nodes in one hop, cut');
            ctx.markTruncated();
          }
          frontier = next.slice(0, 500);
        }
        return { nodes: [...seen].map((k) => (names.get(k) ? nodeRef(names.get(k)) : { ens: null, key: k, pinnedEpoch: null })), edges: byRef([...edges.values()]).map(edgeOut) };
      },
    },
  };
  return { ctx, resolvers, owners, dataset };
}

// Attaches the resolvers of one request to a schema built once.
const schema = buildSchema(SDL);
schema.getType('U64').serialize = U64.serialize;
schema.getType('U64').parseValue = U64.parseValue;
schema.getType('U64').parseLiteral = U64.parseLiteral;

export const graphqlSchema = schema;

// Limits (§5): at most `maxFields` top-level fields (aliases included), depth at most
// `maxDepth` counting through fragments, no mutations, and query text at most `maxChars`.
export function checkLimits(document, { maxFields = 8, maxDepth = 8 } = {}) {
  const fragments = new Map(document.definitions.filter((d) => d.kind === Kind.FRAGMENT_DEFINITION).map((d) => [d.name.value, d]));
  const ops = document.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  if (ops.length !== 1) throw new Error('send exactly one operation');
  if (ops[0].operation !== 'query') throw new Error('only queries are allowed');
  // Each fragment's field count and depth are computed once, so a chain of fragments that
  // spread each other twice costs linear time, not exponential.
  const memo = new Map();
  const visiting = new Set();
  const measure = (set) => {
    let fields = 0;
    let depth = 0;
    for (const s of set?.selections ?? []) {
      if (s.kind === Kind.FIELD) {
        fields += 1;
        depth = Math.max(depth, s.selectionSet ? 1 + measure(s.selectionSet).depth : 1);
      } else if (s.kind === Kind.INLINE_FRAGMENT) {
        const m = measure(s.selectionSet);
        fields += m.fields;
        depth = Math.max(depth, m.depth);
      } else if (s.kind === Kind.FRAGMENT_SPREAD) {
        const name = s.name.value;
        if (visiting.has(name)) throw new Error('fragment cycle');
        if (!memo.has(name)) {
          const f = fragments.get(name);
          visiting.add(name);
          memo.set(name, f ? measure(f.selectionSet) : { fields: 0, depth: 0 });
          visiting.delete(name);
        }
        const m = memo.get(name);
        fields += m.fields;
        depth = Math.max(depth, m.depth);
      }
    }
    return { fields, depth };
  };
  const top = measure(ops[0].selectionSet);
  if (top.fields > maxFields) throw new Error(`at most ${maxFields} top-level fields`);
  if (top.depth > maxDepth) throw new Error(`at most depth ${maxDepth}`);
}

// One GraphQL request against Arkiv: { data, errors?, extensions: { arkiv } }.
export async function runGraphql({ engine, query, variables = {}, dataset = 'live', limits = {}, listCap = 100, writers, callBudget = 60 } = {}) {
  if (typeof query !== 'string' || query.length === 0) return { errors: [{ message: 'no query' }] };
  if (query.length > (limits.maxChars ?? 20_000)) return { errors: [{ message: `the query is longer than ${limits.maxChars ?? 20_000} characters` }] };
  let document;
  try {
    document = parse(query);
    checkLimits(document, limits);
  } catch (error) {
    return { errors: [{ message: error.message }] };
  }
  const invalid = validate(schema, document, specifiedRules);
  if (invalid.length > 0) return { errors: invalid.map((e) => ({ message: e.message })) };
  const { ctx, resolvers } = createContext({ engine, dataset, listCap, writers, callBudget });
  const rootValue = Object.fromEntries(Object.entries(resolvers.Query).map(([k, fn]) => [k, (args) => fn(null, args)]));
  const fieldResolver = (source, args, _context, info) => {
    const parent = info.parentType.name;
    if (resolvers[parent] && Object.hasOwn(resolvers[parent], info.fieldName)) return resolvers[parent][info.fieldName](source, args);
    const v = source?.[info.fieldName];
    return typeof v === 'function' ? v(args) : v;
  };
  const result = await execute({ schema, document, rootValue, variableValues: variables, fieldResolver });
  const trace = ctx.explain();
  return {
    ...(result.data !== undefined ? { data: result.data } : {}),
    ...(result.errors ? { errors: result.errors.map((e) => ({ message: e.message, path: e.path })) } : {}),
    extensions: { arkiv: { explainId: trace.explainId, backend: trace.backend, calls: trace.calls, queries: trace.queries, ms: trace.ms, bytes: trace.bytes, entityKeys: trace.entityKeys, blockNumber: trace.blockNumber, warnings: trace.warnings, notes: trace.notes, truncated: trace.truncated } },
  };
}

export function createGraphEngine(arkiv, { rowCap = 500, explainStore = createExplainStore() } = {}) {
  return createEngine({ publicClient: arkiv.publicClient, backend: arkiv.backend, stats: arkiv.stats, rowCap, explainStore });
}

