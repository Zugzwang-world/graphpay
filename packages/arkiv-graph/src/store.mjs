// A store: one graph, one connection, one writer. `load` adopts the rows Arkiv already holds
// (so a restart never double-counts); `write` plans events into one atomic batch per call
// and sends it through the safe writer, one at a time (in split mode, as several batches,
// each atomic with its own checkpoint); a row it patches is extended once half its lifetime
// has passed, so running totals do not expire while the graph is written; `query` runs an
// owner-scoped read with a filter and returns the rows with an explain trace of every read.

import { ExpirationTime, str } from '@arkiv-network/sdk';
import { asc, desc, eq } from '@arkiv-network/sdk/query';
import { createEngine, leaves } from './engine.mjs';
import { compileFilter } from './filter.mjs';
import { findOne, readAll, scope } from './read.mjs';
import { isRequestTooLarge } from './transport.mjs';
import { LIMITS } from './schema.mjs';
import { operationBytes, WriteNonceTakenError, WriteRevertedError, WriteUncertainError } from './writer.mjs';

const tooLargeUnsent = (error) =>
  !(error instanceof WriteUncertainError || error instanceof WriteRevertedError || error instanceof WriteNonceTakenError) &&
  (isRequestTooLarge(error) || /only split mode cuts a batch/.test(String(error?.message)));
const strip = (row) => ({ key: row.$key, values: Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('$'))) });
// The longest lifetime Arkiv allows is about 182.5 days.
export const MAX_DAYS = 182;
const TX_BYTES = 68;

// options: { graph, arkiv (from connect), stream?, days? (row lifetime, default 30), labels?, createNodes? }
export function createStore({ graph, arkiv, stream = null, days = 30, labels = {}, createNodes = true }) {
  if (!arkiv?.writer) throw new Error('arkiv-graph: a store needs a connection with a private key');
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0 || days > MAX_DAYS) throw new Error(`arkiv-graph: days is how long rows live, above 0 and at most ${MAX_DAYS} (Arkiv's limit)`);
  try {
    ExpirationTime.fromDays(days);
  } catch {
    throw new Error(`arkiv-graph: days is how long rows live, and ${days} is not a lifetime Arkiv can set`);
  }
  const { owner, publicClient } = arkiv;
  const engine = createEngine({ publicClient, backend: arkiv.backend, stats: arkiv.stats });
  const lifetimeBlocks = BigInt(Math.ceil((days * 86_400) / LIMITS.blockSeconds));
  // The block each known row expires at: read from Arkiv, or (for a row this store made or
  // extended) the head block before the send plus the lifetime, which it can only outlive.
  const expiries = new Map();
  const kept = (row) => {
    if (typeof row.$expiresAt === 'bigint') expiries.set(row.$key, row.$expiresAt);
    return strip(row);
  };
  let state = null;
  let lock = Promise.resolve();
  const exclusive = (fn) => {
    const run = lock.catch(() => {}).then(fn);
    lock = run.catch(() => {});
    return run;
  };

  async function read() {
    const next = graph.newState();
    expiries.clear();
    for (const row of await readAll(publicClient, graph.defs.totals, { owner })) next.totals.set(`${row.node}:${row.epoch}:${row.window}`, kept(row));
    for (const row of await readAll(publicClient, graph.defs.link, { owner })) next.links.set(`${row.from_node}:${row.from_epoch}:${row.to_node}:${row.to_epoch}:${row.kind}`, kept(row));
    for (const row of await readAll(publicClient, graph.defs.node, { owner })) next.nodes.set(`${row.node}:${row.epoch}`, kept(row));
    if (stream) {
      const cp = await findOne(publicClient, graph.defs.checkpoint, { owner, where: [eq('stream', str(stream))] });
      if (cp) next.checkpoints.set(stream, kept(cp));
    }
    state = next;
    return state;
  }
  // Public load goes through the same queue as write, so it never swaps in rows read before a batch landed.
  const load = () => exclusive(read);

  // The batch for a plan: the creates with their lifetime, the patches, and an extension of each
  // patched row that has less than half its lifetime left (an extension never moves an
  // expiry earlier: it is sent only when the new one is later).
  function batchOf(planned, head) {
    const due = head + lifetimeBlocks / 2n;
    const extend = planned.patches.filter((p) => (expiries.get(p.key) ?? due) < due);
    return {
      creates: planned.creates.map((c) => ({ ...c, expiration: ExpirationTime.fromDays(days) })),
      patches: planned.patches,
      extensions: extend.map((p) => ({ key: p.key, expiration: ExpirationTime.fromDays(days) })),
    };
  }
  const fits = (batch) => TX_BYTES + arkiv.writer.operations(batch).reduce((n, op) => n + operationBytes(op), 0) <= LIMITS.splitBytes;

  // events: see GraphEvent in the types. Returns { applied, skipped, txs }.
  // split: send as many transactions as the events need, each holding whole events with
  // their checkpoint, so a failure leaves Arkiv at the end of a batch, never in the middle.
  function write(events, { split } = {}) {
    return exclusive(async () => {
      state ??= await read();
      const out = { applied: [], skipped: [], txs: [] };
      const grouped = Boolean(split) && typeof arkiv.writer.operations === 'function';
      let rest = events;
      let take = rest.length;
      let head = null;
      do {
        take = Math.max(1, Math.min(take, rest.length));
        const planned = graph.plan(rest.slice(0, take), state, { stream, createNodes, labels });
        if (planned.creates.length > 0 || planned.patches.length > 0) {
          head ??= await publicClient.getBlockNumber();
          const batch = batchOf(planned, head);
          if (grouped && take > 1 && !fits(batch)) {
            take = Math.ceil(take / 2);
            continue;
          }
          let result;
          try {
            // One event too large for a transaction of its own still goes out in parts.
            result = await arkiv.writer.send(batch, { split: grouped ? take === 1 : split });
          } catch (error) {
            // A group the node or the writer found too large was refused before anything was sent
            // (an uncertain send is never this): send fewer events at a time.
            if (grouped && take > 1 && tooLargeUnsent(error)) {
              take = Math.ceil(take / 2);
              continue;
            }
            state = null; // the next call re-reads Arkiv; nothing is planned from rows that may be stale
            throw error;
          }
          planned.commit(result.createdKeys);
          for (const k of [...result.createdKeys, ...batch.extensions.map((x) => x.key)]) expiries.set(k, head + lifetimeBlocks);
          out.txs.push(...result.txs);
        }
        out.applied.push(...planned.applied);
        out.skipped.push(...planned.skipped);
        rest = rest.slice(take);
        take *= 2;
      } while (rest.length > 0);
      return out;
    });
  }

  // entity: 'node' | 'edge' | 'totals' | 'link' | 'checkpoint' (or a name from `entities`).
  // filter: { field: { eq, in, gt, gte, lt, lte, between: [lo, hi], startsWith }, AND, OR }.
  // orderBy: { field, direction: 'asc' | 'desc' (default 'desc') } on a u64 column (indexed or stored-only) or an i32 column.
  async function query(entity, { filter = {}, orderBy = null, limit = 100 } = {}) {
    const def = graph.defs[entity];
    if (!def) throw new Error(`arkiv-graph: unknown entity "${entity}"`);
    if (!Number.isInteger(limit) || limit < 1) throw new Error('arkiv-graph: limit must be a positive integer');
    const ctx = engine.context();
    const where = compileFilter(def, filter);
    const predicates = where === null ? 0 : scope(def).length + 1 + where.reduce((n, e) => n + leaves(e), 0);
    if (predicates > LIMITS.predicateLeaves) throw new Error(`arkiv-graph: the filter needs ${predicates} predicates with the scope and owner; Arkiv allows ${LIMITS.predicateLeaves} in one query (an \`in\` list takes one per value)`);
    let order = null;
    if (orderBy) {
      const col = def.schema.columns[orderBy.field];
      if (!col) throw new Error(`arkiv-graph: unknown field "${orderBy.field}"`);
      const direction = orderBy.direction ?? 'desc';
      if (direction !== 'asc' && direction !== 'desc') throw new Error(`arkiv-graph: orderBy.direction is "asc" or "desc", not "${direction}"`);
      order = (direction === 'asc' ? asc : desc)(orderBy.field, col.type);
    }
    const rows = where === null ? [] : await ctx.query(def, { where, owners: [owner], orderBy: order, want: limit });
    return { rows: rows.slice(0, limit), explain: ctx.explain(), truncated: ctx.truncated };
  }

  return { owner, graph, load, write, query, explainStore: engine.explainStore };
}
