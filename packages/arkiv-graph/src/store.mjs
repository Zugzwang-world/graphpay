// A store: one graph, one connection, one writer. `load` adopts the rows Arkiv already holds
// (so a restart never double-counts); `write` plans events into one atomic batch per call
// and sends it through the safe writer, one at a time; `query` runs an owner-scoped read
// with a filter and returns the rows with an explain trace of every read it made.

import { ExpirationTime, str } from '@arkiv-network/sdk';
import { asc, desc, eq } from '@arkiv-network/sdk/query';
import { createEngine } from './engine.mjs';
import { compileFilter } from './filter.mjs';
import { findOne, readAll } from './read.mjs';

const strip = (row) => ({ key: row.$key, values: Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('$'))) });

// options: { graph, arkiv (from connect), stream?, days? (row lifetime, default 30), labels?, createNodes? }
export function createStore({ graph, arkiv, stream = null, days = 30, labels = {}, createNodes = true }) {
  if (!arkiv?.writer) throw new Error('arkiv-graph: a store needs a connection with a private key');
  const { owner, publicClient } = arkiv;
  const engine = createEngine({ publicClient, backend: arkiv.backend, stats: arkiv.stats });
  let state = null;
  let lock = Promise.resolve();
  const exclusive = (fn) => {
    const run = lock.catch(() => {}).then(fn);
    lock = run.catch(() => {});
    return run;
  };

  async function read() {
    const next = graph.newState();
    for (const row of await readAll(publicClient, graph.defs.totals, { owner })) next.totals.set(`${row.node}:${row.epoch}:${row.window}`, strip(row));
    for (const row of await readAll(publicClient, graph.defs.link, { owner })) next.links.set(`${row.from_node}:${row.from_epoch}:${row.to_node}:${row.to_epoch}:${row.kind}`, strip(row));
    for (const row of await readAll(publicClient, graph.defs.node, { owner })) next.nodes.set(`${row.node}:${row.epoch}`, strip(row));
    if (stream) {
      const cp = await findOne(publicClient, graph.defs.checkpoint, { owner, where: [eq('stream', str(stream))] });
      if (cp) next.checkpoints.set(stream, strip(cp));
    }
    state = next;
    return state;
  }
  // Public load goes through the same queue as write, so it never swaps in rows read before a batch landed.
  const load = () => exclusive(read);

  // events: see GraphEvent in the types. Returns { applied, skipped, txs }.
  function write(events, { split } = {}) {
    return exclusive(async () => {
      state ??= await read();
      const planned = graph.plan(events, state, { stream, createNodes, labels });
      if (planned.creates.length === 0 && planned.patches.length === 0) return { applied: [], skipped: planned.skipped, txs: [] };
      let result;
      try {
        result = await arkiv.writer.send({ creates: planned.creates.map((c) => ({ ...c, expiration: ExpirationTime.fromDays(days) })), patches: planned.patches }, { split });
      } catch (error) {
        state = null; // the next call re-reads Arkiv; nothing is planned from rows that may be stale
        throw error;
      }
      planned.commit(result.createdKeys);
      return { applied: planned.applied, skipped: planned.skipped, txs: result.txs };
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
