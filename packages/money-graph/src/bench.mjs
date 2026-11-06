// The benchmark's six questions (planning/SPEC/BENCHMARK.md §2), asked two ways over
// the same seeded city: plain Arkiv code written by hand against the plain store (one
// record per event, one profile per actor, names inline, no tallies, no epochs), and
// Graph Arkiv, one GraphQL document each. Both read through one connection, so its
// metered transport counts every call and byte alike. The race (M15's race mode) asks
// one question one way, live and uncached, and reports each Arkiv call as it lands.
//
// `params` names the actors and days of the questions; it comes from the generated city
// (@graphpay/city benchParams), never from code: { good, persona, payer, trap,
// sinceDay, weekStartTs, d90Day }. Answers are plain JSON, the same shape both ways.

import { key, str, u64 } from '@arkiv-network/sdk';
import { asc, eq, gt, gte, or } from '@arkiv-network/sdk/query';
import { LIMITS, checkedOwner, plainRow, scope } from '@graphpay_ethglobal/arkiv-graph';
import { ENTITIES, seedOwner, writerAddresses } from './model.mjs';
import { createGraphEngine, rate, runGraphql } from './graphql.mjs';
import { story as storyConfig } from '@graphpay/config';

export const QUESTIONS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
export const RACE_QUESTIONS = ['Q1', 'Q2', 'Q5'];

const ORDER_KINDS = ['order', 'subscribe'];
const SALE_KINDS = ['pay', 'renew'];
const PAGE = LIMITS.pageSize;
// Names per OR batch: two leaves each (from or to), inside the 64-leaf budget with the
// scope, kind and day filters.
const NAMES_PER_BATCH = 28;

const anyOf = (name, values) => (values.length === 1 ? eq(name, str(values[0])) : or(...values.map((v) => eq(name, str(v)))));
const touching = (names) => or(...names.flatMap((n) => [eq('from_name', str(n)), eq('to_name', str(n))]));
const batches = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n));
const byValue = (a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : a[0] < b[0] ? -1 : 1);
const sum = (m, k, v) => m.set(k, (m.get(k) ?? 0n) + BigInt(v));

// ---- plain Arkiv -------------------------------------------------------------------

// Reads of the plain store under one owner, with projections. `rows` pages by $key one
// at a time, or (inFlight > 1 or 'all') takes one count() and then every page by offset
// with that many requests in flight: plain at its fastest.
function plainReader(publicClient, owner) {
  const o = checkedOwner(owner);
  const trusted = (entities) => entities.map(plainRow).filter((r) => r.$owner === o);
  const select = (def, fields, where) =>
    publicClient
      .select({ $key: true, $owner: true, ...Object.fromEntries(fields.map((f) => [f, true])) })
      .from(def.schema)
      .where(...scope(def), ...where)
      .ownedBy(o)
      .orderBy(asc('$key'))
      .limit(PAGE);
  const count = (def, where) => publicClient.count().from(def.schema).where(...scope(def), ...where).ownedBy(o).fetch();

  async function rows(def, fields, where, { inFlight = 1 } = {}) {
    if (inFlight === 1) {
      const out = [];
      let last = null;
      for (;;) {
        const res = await select(def, fields, last ? [...where, gt('$key', key(last))] : where).fetch();
        out.push(...trusted(res.entities));
        if (res.entities.length < PAGE) return out;
        last = res.entities.at(-1).$key;
      }
    }
    const pages = Math.ceil(Number(await count(def, where)) / PAGE);
    const width = inFlight === 'all' ? pages : Math.min(inFlight, pages);
    const out = new Array(pages);
    let next = 0;
    const worker = async () => {
      while (next < pages) {
        const i = next++;
        out[i] = trusted((await select(def, fields, where).offset(i * PAGE).fetch()).entities);
      }
    };
    await Promise.all(Array.from({ length: width }, worker));
    return out.flat();
  }

  return { count, rows };
}

// Undirected neighbours over pay records touching `names` (batched under the budget).
async function payNeighbours(r, names, where = []) {
  const out = new Map();
  for (const part of batches([...names], NAMES_PER_BATCH)) {
    for (const e of await r.rows(ENTITIES.record, ['from_name', 'to_name', 'ts'], [eq('kind', str('pay')), ...where, touching(part)])) {
      for (const [a, b] of [[e.from_name, e.to_name], [e.to_name, e.from_name]]) {
        if (!out.has(a)) out.set(a, new Set());
        out.get(a).add(b);
      }
    }
  }
  return out;
}

const PLAIN = {
  // Three count() calls: orders, refunds, orders since the 90-day window's first day.
  async Q1(r, p) {
    const touchesGood = or(eq('from_name', str(p.good)), eq('to_name', str(p.good)));
    const orders = await r.count(ENTITIES.record, [anyOf('kind', ORDER_KINDS), touchesGood]);
    const refunds = await r.count(ENTITIES.record, [eq('kind', str('refund')), touchesGood]);
    const orders90 = await r.count(ENTITIES.record, [anyOf('kind', ORDER_KINDS), touchesGood, gte('day', u64(BigInt(p.d90Day)))]);
    return { orders: Number(orders), refunds: Number(refunds), refundRate: rate(refunds, orders), orders90: Number(orders90) };
  },

  // No SUM in Arkiv: read every payment and renewal row and add them up by name.
  async Q2(r, p, { inFlight = 1 } = {}) {
    const paid = new Map();
    for (const e of await r.rows(ENTITIES.record, ['to_name', 'amount_micro'], [anyOf('kind', SALE_KINDS)], { inFlight })) sum(paid, e.to_name, e.amount_micro);
    return [...paid].sort(byValue).slice(0, 10).map(([ens, v]) => ({ ens, paidMicro: String(v) }));
  },

  // The persona's agents from their profiles, then their payments this week.
  async Q3(r, p) {
    const agents = (await r.rows(ENTITIES.profile, ['name'], [eq('owner_name', str(p.persona)), eq('kind', str('agent'))])).map((a) => a.name);
    const spend = new Map();
    for (const part of batches(agents, 50)) {
      const where = [anyOf('kind', SALE_KINDS), gte('day', u64(BigInt(p.sinceDay))), anyOf('from_name', part)];
      for (const e of await r.rows(ENTITIES.record, ['to_name', 'amount_micro', 'ts'], where)) if (Number(e.ts) >= p.weekStartTs) sum(spend, e.to_name, e.amount_micro);
    }
    return Object.fromEntries([...spend].sort().map(([k, v]) => [k, String(v)]));
  },

  // This week's refunds, then this week's payments into the refunding shops.
  async Q4(r, p) {
    const week = [gte('day', u64(BigInt(p.sinceDay)))];
    const refunds = (await r.rows(ENTITIES.record, ['from_name', 'to_name', 'ts'], [eq('kind', str('refund')), ...week])).filter((e) => Number(e.ts) >= p.weekStartTs);
    const shops = [...new Set(refunds.map((e) => e.from_name))];
    const pays = [];
    for (const part of batches(shops, 50)) pays.push(...(await r.rows(ENTITIES.record, ['from_name', 'to_name', 'ts'], [eq('kind', str('pay')), ...week, anyOf('to_name', part)])));
    return agentsThatPaidARefunder(pays.filter((e) => Number(e.ts) >= p.weekStartTs), refunds, (e) => [e.from_name, e.to_name, Number(e.ts)]);
  },

  // A two-ended search over all-time payments, expanding the smaller side first.
  async Q5(r, p, { maxDepth = 3 } = {}) {
    if (p.payer === p.trap) return { hops: 0 };
    const sides = [
      { dist: new Map([[p.payer, 0]]), frontier: [p.payer] },
      { dist: new Map([[p.trap, 0]]), frontier: [p.trap] },
    ];
    let best = null;
    for (let depth = 0; depth < maxDepth && best === null; depth += 1) {
      const side = sides[0].frontier.length <= sides[1].frontier.length ? sides[0] : sides[1];
      if (side.frontier.length === 0) break;
      const level = side.dist.get(side.frontier[0]) + 1;
      const adj = await payNeighbours(r, side.frontier);
      const next = [];
      for (const n of side.frontier) for (const m of adj.get(n) ?? []) if (!side.dist.has(m)) { side.dist.set(m, level); next.push(m); }
      side.frontier = next;
      for (const [n, d] of sides[0].dist) if (sides[1].dist.has(n)) best = Math.min(best ?? Infinity, d + sides[1].dist.get(n));
    }
    return { hops: best !== null && best <= maxDepth ? best : null };
  },

  // The depth-2 neighbourhood over this week's payments: the shop's, then its neighbours'.
  async Q6(r, p) {
    const week = [gte('day', u64(BigInt(p.sinceDay)))];
    const seen = new Set([p.good]);
    let frontier = [p.good];
    for (let d = 0; d < 2 && frontier.length > 0; d += 1) {
      const adj = await payNeighbours(r, frontier, week);
      const next = [];
      for (const n of frontier) for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); next.push(m); }
      frontier = next;
    }
    return [...seen].sort();
  },
};

// Agents (payers) that paid a shop this week that later refunded someone else.
function agentsThatPaidARefunder(pays, refunds, parts) {
  const out = new Set();
  for (const p of pays) {
    const [payer, shop, ts] = parts(p);
    if (refunds.some((r) => { const [rShop, rTo, rTs] = parts(r); return rShop === shop && rTo !== payer && rTs > ts; })) out.add(payer);
  }
  return [...out].sort();
}

// ---- Graph Arkiv -------------------------------------------------------------------

const quote = (s) => JSON.stringify(s);

export function graphDocument(question, p) {
  switch (question) {
    case 'Q1':
      return `{ node(ens: ${quote(p.good)}) { all: reputation(window: ALL) { orders refunds refundRate } d90: reputation(window: D90) { orders } } }`;
    case 'Q2':
      return '{ top(kind: "shop", by: "paid_micro", limit: 10) { node { ens epoch } value } }';
    case 'Q3':
      return `{ node(ens: ${quote(p.persona)}) { agents { ens out(kinds: ["pay", "renew"], sinceDay: ${p.sinceDay}, limit: 100) { to { ens } amountMicro ts } } } }`;
    case 'Q4':
      return `{ edges(kind: "refund", sinceDay: ${p.sinceDay}, limit: 100) { from { ens in(kind: "pay", sinceDay: ${p.sinceDay}, limit: 100) { from { ens } ts } } to { ens } ts } }`;
    case 'Q5':
      return `{ path(from: ${quote(p.payer)}, to: ${quote(p.trap)}, maxDepth: 3, kinds: ["pay"]) { found hops } }`;
    case 'Q6':
      return `{ neighborhood(ens: ${quote(p.good)}, depth: 2, kind: "pay", sinceDay: ${p.sinceDay}) { nodes { ens } edges { from { ens } to { ens } ts } } }`;
    default:
      throw new Error(`money-graph: no benchmark question "${question}"`);
  }
}

// The GraphQL answer in the shared shape.
export function graphAnswer(question, data, p) {
  switch (question) {
    case 'Q1': {
      const n = data.node;
      return { orders: Number(n.all.orders), refunds: Number(n.all.refunds), refundRate: n.all.refundRate, orders90: Number(n.d90.orders) };
    }
    case 'Q2':
      return data.top.map((t) => ({ ens: t.node.ens, paidMicro: String(t.value) }));
    case 'Q3': {
      const spend = new Map();
      for (const a of data.node?.agents ?? []) for (const e of a.out) if (Number(e.ts) >= p.weekStartTs) sum(spend, e.to.ens, e.amountMicro);
      return Object.fromEntries([...spend].sort().map(([k, v]) => [k, String(v)]));
    }
    case 'Q4': {
      const refunds = data.edges.filter((e) => Number(e.ts) >= p.weekStartTs);
      const pays = refunds.flatMap((r) => r.from.in.map((x) => ({ payer: x.from.ens, shop: r.from.ens, ts: Number(x.ts) }))).filter((x) => x.ts >= p.weekStartTs);
      const unique = [...new Map(pays.map((x) => [`${x.payer}|${x.shop}|${x.ts}`, x])).values()];
      return agentsThatPaidARefunder(unique, refunds, (e) => ('payer' in e ? [e.payer, e.shop, e.ts] : [e.from.ens, e.to.ens, Number(e.ts)]));
    }
    case 'Q5':
      return { hops: data.path.found ? data.path.hops : null };
    case 'Q6': {
      // The nodes within two hops of the shop over this week's payments.
      const adj = new Map();
      for (const e of data.neighborhood.edges) {
        if (Number(e.ts) < p.weekStartTs) continue;
        for (const [a, b] of [[e.from.ens, e.to.ens], [e.to.ens, e.from.ens]]) {
          if (!adj.has(a)) adj.set(a, new Set());
          adj.get(a).add(b);
        }
      }
      const seen = new Set([p.good]);
      let frontier = [p.good];
      for (let d = 0; d < 2; d += 1) {
        const next = [];
        for (const n of frontier) for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); next.push(m); }
        frontier = next;
      }
      return [...seen].sort();
    }
    default:
      throw new Error(`money-graph: no benchmark question "${question}"`);
  }
}

// ---- asking, scoring, racing ---------------------------------------------------------

// Asks one question one way. Returns { answer, calls, queries, bytes, ms }, plus
// explainId and blockNumber for Graph Arkiv. Calls and bytes are the connection's
// metered deltas, so both modes are counted by the same transport.
export async function ask(arkiv, { question, mode, params, size = 'S', inFlight = 1, engine = null, writers = writerAddresses(), story = storyConfig }) {
  if (!QUESTIONS.includes(question)) throw new Error(`money-graph: no benchmark question "${question}"`);
  const s = arkiv.stats;
  const calls0 = s.calls;
  const bytes0 = s.requestBytes + s.responseBytes;
  const t0 = Date.now();
  let answer;
  let extra = { queries: null };
  if (mode === 'plain') {
    const reader = plainReader(arkiv.publicClient, seedOwner(size, story, writers));
    answer = await PLAIN[question](reader, params, { inFlight });
    extra = { queries: s.calls - calls0 };
  } else if (mode === 'graph') {
    const res = await runGraphql({ engine: engine ?? createGraphEngine(arkiv), query: graphDocument(question, params), dataset: size, writers });
    if (res.errors?.length) throw new Error(`money-graph: ${question} GraphQL errors: ${res.errors.map((e) => e.message).join('; ')}`);
    const trace = res.extensions?.arkiv;
    if (trace?.truncated) throw new Error(`money-graph: ${question} was truncated: ${trace.warnings.join('; ')}`);
    answer = graphAnswer(question, res.data, params);
    extra = { queries: trace?.queries?.length ?? null, explainId: trace?.explainId ?? null, blockNumber: trace?.blockNumber ?? null };
  } else {
    throw new Error(`money-graph: mode is "plain" or "graph", not "${mode}"`);
  }
  return { answer, calls: s.calls - calls0, bytes: s.requestBytes + s.responseBytes - bytes0, ms: Date.now() - t0, ...extra };
}

// R of acceptance D6: the plain store's payment and renewal rows (one count() call).
export async function plainPayRows(arkiv, { size = 'S', writers = writerAddresses(), story = storyConfig } = {}) {
  return Number(await plainReader(arkiv.publicClient, seedOwner(size, story, writers)).count(ENTITIES.record, [anyOf('kind', SALE_KINDS)]));
}

// Scores an answer. Graph Arkiv is scored by identity (node and epoch), plain by name
// (it has no epochs); `matchesIdentityTruth` says whether a name answer is also right by
// identity (plain credits a re-registered shop's earlier holder to the new one).
// `truth` holds, per question, { identity, name } (they differ only for Q2).
export function score(question, mode, answer, truth) {
  const t = truth?.[question];
  if (!t) return { correct: null, truthBasis: null, matchesIdentityTruth: null };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const basis = mode === 'graph' ? 'identity' : 'name';
  return { correct: same(answer, t[basis]), truthBasis: basis, matchesIdentityTruth: same(answer, t.identity) };
}

// One Arkiv connection's calls as they land: pass `tap.log` as the connection's `log`
// (connectArkiv), then `tap.listen(arkiv.stats, onCall)` before a race. Each call gives
// onCall({ call, ms, bytes, status }); the URL never appears. A transport event (the
// fallback after a keyed endpoint's spent quota) is not a call: its bytes go to the call it
// belongs to, so the frames count what the answer counts.
export function callTap() {
  let stats = null;
  let listener = null;
  let n = 0;
  let last = 0;
  const total = () => stats.requestBytes + stats.responseBytes;
  return {
    log(e) {
      if (!listener || !e?.method || e.event) return;
      n += 1;
      const now = total();
      listener({ call: n, ms: e.ms, bytes: now - last, status: e.status });
      last = now;
    },
    listen(s, onCall) {
      stats = s;
      listener = onCall;
      n = 0;
      last = total();
    },
    stop() {
      listener = null;
    },
  };
}

// The race (M15, WEBSITE_SPEC §6 and §7): one question one way, live, uncached (a new
// engine each time). With a tap on the connection, every call is reported as it lands;
// the result is { answer, correct, truthBasis, matchesIdentityTruth, calls, bytes, ms }.
export async function raceQuestion(arkiv, { question = 'Q2', mode, inFlight = 1, params, truth = null, size = 'S', tap = null, onCall = () => {}, writers, story }) {
  if (!RACE_QUESTIONS.includes(question)) throw new Error(`money-graph: race mode asks ${RACE_QUESTIONS.join(', ')}`);
  tap?.listen(arkiv.stats, onCall);
  try {
    const r = await ask(arkiv, { question, mode, params, size, inFlight, writers, story });
    return { answer: r.answer, ...score(question, mode, r.answer, truth), calls: r.calls, bytes: r.bytes, ms: r.ms };
  } finally {
    tap?.stop();
  }
}
