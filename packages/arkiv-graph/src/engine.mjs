// The read engine: every Arkiv call one request makes goes through a context that
// scopes it to trusted owners (one call per owner, merged and de-duplicated by $key,
// every row checked again), keeps OR lists inside the predicate budget (chunks sized from
// the budget, halved and retried on -32004), pages by 100 up to a row cap and marks the
// answer truncated when the cap bites, and records an explain trace of every read. The
// explain id is sha256(backend + sorted queries), 12 hex: the same work gives the same id.

import { createHash } from 'node:crypto';
import { and, or } from '@arkiv-network/sdk/query';
import { LIMITS } from './schema.mjs';
import { checkedOwner, coveredBy, scope, trustedRows } from './read.mjs';

export const leaves = (e) => (e.kind === 'and' || e.kind === 'or' ? e.expressions.reduce((n, x) => n + leaves(x), 0) : 1);

function codeOf(error) {
  for (let e = error, d = 0; e && d < 10; e = e.cause, d += 1) if (typeof e.code === 'number') return e.code;
  return undefined;
}

export function createExplainStore(max = 200) {
  const traces = new Map();
  return {
    put(trace) {
      traces.set(trace.explainId, trace);
      while (traces.size > max) traces.delete(traces.keys().next().value);
    },
    get: (id) => traces.get(id) ?? null,
    size: () => traces.size,
  };
}

export function explainIdOf(backend, queries) {
  return createHash('sha256').update(`${backend}\n${[...queries].sort().join('\n')}`).digest('hex').slice(0, 12);
}

// options: { publicClient, backend, stats?, rowCap?, explainStore?, budget? }
export function createEngine({ publicClient, backend, stats = null, rowCap = 500, explainStore = createExplainStore(), budget = LIMITS.predicateLeaves }) {
  if (!publicClient) throw new Error('arkiv-graph: the engine needs a public client');

  // callBudget: the most Arkiv calls one request may make; past it, reads return nothing
  // and the answer is marked truncated (a nested document cannot drain the access key).
  function context({ rowCap: cap = rowCap, callBudget = 60 } = {}) {
    const calls = [];
    const warnings = [];
    const notes = [];
    let truncated = false;
    let blockNumber = null;
    let issued = 0;
    const started = Date.now();

    async function call(def, { where, owner, orderBy = null, limit, offset = 0, count = false }) {
      const o = checkedOwner(owner);
      // Counted when issued, not when answered: concurrent reads must not overshoot it.
      if (issued >= callBudget) {
        truncated = true;
        warnings.push(`stopped at the ${callBudget}-call budget of one request`);
        return count ? { rows: [], count: 0n } : { rows: [], raw: 0 };
      }
      issued += 1;
      const t0 = Date.now();
      const bytes0 = stats ? stats.requestBytes + stats.responseBytes : 0;
      const filters = [...scope(def), ...where];
      let text;
      try {
        if (count) {
          const builder = publicClient.count().from(def.schema).where(...filters).ownedBy(o);
          text = builder.toString();
          const n = await builder.fetch();
          calls.push({ entity: def.type, query: text, owner: o, limit: null, offset: 0, orderBy: null, rows: 0, count: String(n), ms: Date.now() - t0, bytes: stats ? stats.requestBytes + stats.responseBytes - bytes0 : null, entityKeys: [] });
          return { rows: [], count: n };
        }
        let builder = publicClient.select('*').from(def.schema).where(...filters).ownedBy(o).limit(limit).offset(offset);
        if (orderBy) builder = builder.orderBy(orderBy);
        text = builder.toString();
        const res = await builder.fetch();
        if (blockNumber === null || res.blockNumber > blockNumber) blockNumber = res.blockNumber;
        const rows = trustedRows(def, o, res.entities);
        if (rows.length !== res.entities.length) warnings.push(`${res.entities.length - rows.length} ${def.type} rows failed the owner or version check`);
        const covered = coveredBy(res);
        if (covered > res.entities.length) warnings.push(`${covered - res.entities.length} ${def.type} rows did not fit the schema and were left out`);
        calls.push({ entity: def.type, query: `${text} LIMIT ${limit} OFFSET ${offset}`, owner: o, limit, offset, orderBy: orderBy ? `${orderBy.name} ${orderBy.direction}` : null, rows: rows.length, ms: Date.now() - t0, bytes: stats ? stats.requestBytes + stats.responseBytes - bytes0 : null, entityKeys: rows.map((r) => r.$key) });
        // The offset counts the matches a page covered, rows left out for the schema included.
        return { rows, raw: covered };
      } catch (error) {
        calls.push({ entity: def.type, query: text ?? '(not built)', owner: o, limit, offset, ms: Date.now() - t0, rows: 0, error: error.shortMessage ?? error.message, code: codeOf(error) });
        throw error;
      }
    }

    // Rows matching `where`, from every owner, paged by 100 up to `want` rows (or the cap).
    async function query(def, { where = [], owners, orderBy = null, want = cap } = {}) {
      const limitTotal = Math.min(want, cap);
      const out = new Map();
      for (const owner of owners) {
        let offset = 0;
        for (;;) {
          const limit = Math.min(LIMITS.pageSize, limitTotal - offset);
          if (limit <= 0) break;
          const { rows, raw } = await call(def, { where, owner, orderBy, limit, offset });
          for (const r of rows) if (!out.has(r.$key)) out.set(r.$key, r);
          offset += raw;
          if (raw < limit) break;
          if (offset >= limitTotal) {
            if (want >= cap) {
              truncated = true;
              warnings.push(`${def.type}: stopped at the ${cap}-row cap`);
            }
            break;
          }
        }
      }
      return [...out.values()];
    }

    // An OR over `terms` (expressions) ANDed with `where`, split into chunks that fit the
    // predicate budget; a refused chunk is halved and retried (first page only). An empty
    // list sends nothing.
    async function queryAny(def, { where = [], terms, owners, orderBy = null, want = cap, maxTerms = Infinity } = {}) {
      if (!terms || terms.length === 0) return [];
      const fixed = scope(def).length + where.reduce((n, e) => n + leaves(e), 0) + 1; // + the owner filter
      const per = Math.max(1, Math.min(maxTerms, Math.floor((budget - fixed) / Math.max(1, leaves(terms[0])))));
      const out = new Map();
      const run = async (list) => {
        try {
          const rows = await query(def, { where: [...where, list.length === 1 ? list[0] : or(list)], owners, orderBy, want });
          for (const r of rows) if (!out.has(r.$key)) out.set(r.$key, r);
        } catch (error) {
          if (codeOf(error) === -32004 && list.length > 1) {
            notes.push(`predicate budget: halved a chunk of ${list.length}`);
            const half = Math.ceil(list.length / 2);
            await run(list.slice(0, half));
            await run(list.slice(half));
          } else throw error;
        }
      };
      for (let i = 0; i < terms.length; i += per) await run(terms.slice(i, i + per));
      return [...out.values()];
    }

    async function count(def, { where = [], owners }) {
      let total = 0n;
      for (const owner of owners) total += (await call(def, { where, owner, count: true })).count;
      return total;
    }

    function explain() {
      const queries = calls.map((c) => c.query);
      const trace = {
        explainId: explainIdOf(backend, queries),
        backend,
        calls: calls.length,
        queries,
        ms: Date.now() - started,
        bytes: calls.reduce((n, c) => n + (c.bytes ?? 0), 0),
        entityKeys: [...new Set(calls.flatMap((c) => c.entityKeys ?? []))],
        blockNumber: blockNumber === null ? null : String(blockNumber),
        warnings: [...new Set(warnings)],
        notes: [...new Set(notes)],
        truncated,
        reads: calls,
      };
      explainStore.put(trace);
      return trace;
    }

    return { query, queryAny, count, explain, note: (n) => notes.push(n), warn: (w) => warnings.push(w), markTruncated: () => (truncated = true), get truncated() { return truncated; }, calls };
  }

  return { context, explainStore, backend, and };
}
