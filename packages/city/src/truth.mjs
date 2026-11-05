// Ground truth for the six benchmark questions (planning/SPEC/BENCHMARK.md §2), computed
// in memory from the generator's events. Identity truth counts (node, epoch); the plain
// store has no epochs, so its truth is by name.

const DAY = 86_400;
const big = (v) => BigInt(v ?? 0);

export function truthOf(city, { goodRole = 'good', trapRole = 'trap', payerKey = 'payer' } = {}) {
  const { events, endTs } = city;
  const weekStart = endTs - 7 * DAY;
  const d90 = endTs - 90 * DAY;
  const shopEnds = (e) => (e.to.kind === 'shop' ? e.to : e.from.kind === 'shop' ? e.from : null);
  const id = (end) => `${end.ens}#${end.epoch}`;

  // Current epoch of every actor: the highest seen.
  const current = new Map();
  for (const e of events) for (const end of [e.from, e.to]) current.set(end.ens, Math.max(current.get(end.ens) ?? 0, end.epoch));

  // Q2: top 10 shops by paid_micro (pay and renew edges into the shop).
  const paidById = new Map();
  const paidByName = new Map();
  for (const e of events) {
    if ((e.kind !== 'pay' && e.kind !== 'renew') || e.to.kind !== 'shop') continue;
    paidById.set(id(e.to), (paidById.get(id(e.to)) ?? 0n) + big(e.amountMicro));
    paidByName.set(e.to.ens, (paidByName.get(e.to.ens) ?? 0n) + big(e.amountMicro));
  }
  const rank = (m) => [...m.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : a[0] < b[0] ? -1 : 1)).slice(0, 10);
  const identityTop = rank(new Map([...paidById].filter(([k]) => {
    const [ens, epoch] = k.split('#');
    return Number(epoch) === current.get(ens);
  }))).map(([k, v]) => ({ ens: k.split('#')[0], epoch: Number(k.split('#')[1]), paidMicro: String(v) }));
  const nameTop = rank(paidByName).map(([ens, v]) => ({ ens, paidMicro: String(v) }));

  // Q1: the good shop's all-time counts (current epoch) and 90-day orders.
  const good = city.byRole[goodRole];
  const goodEnd = (e) => [e.from, e.to].find((x) => x.ens === good && x.epoch === current.get(good));
  let orders = 0;
  let refunds = 0;
  let orders90 = 0;
  for (const e of events) {
    if (!goodEnd(e)) continue;
    if (e.kind === 'order' || e.kind === 'subscribe') {
      orders += 1;
      if (e.ts >= d90) orders90 += 1;
    }
    if (e.kind === 'refund') refunds += 1;
  }

  // Q3: the persona's agents' spend by shop this week.
  const personaAgents = new Set(Object.values(city.personaAgents));
  const spend = {};
  for (const e of events) {
    if (e.ts < weekStart || !personaAgents.has(e.from.ens) || (e.kind !== 'pay' && e.kind !== 'renew')) continue;
    spend[e.to.ens] = String(big(spend[e.to.ens]) + big(e.amountMicro));
  }

  // Q4: agents that paid a shop this week that later refunded someone else.
  const week = events.filter((e) => e.ts >= weekStart);
  const q4 = new Set();
  for (const p of week.filter((e) => e.kind === 'pay')) {
    if (week.some((r) => r.kind === 'refund' && r.from.ens === p.to.ens && r.to.ens !== p.from.ens && r.ts > p.ts)) q4.add(p.from.ens);
  }

  // Q5 and Q6: undirected payment adjacency (current epochs).
  const adjacency = (list) => {
    const adj = new Map();
    for (const e of list) {
      if (e.kind !== 'pay') continue;
      for (const [a, b] of [[e.from.ens, e.to.ens], [e.to.ens, e.from.ens]]) {
        if (!adj.has(a)) adj.set(a, new Set());
        adj.get(a).add(b);
      }
    }
    return adj;
  };
  const bfs = (adj, start, depth) => {
    const seen = new Map([[start, 0]]);
    let frontier = [start];
    for (let d = 1; d <= depth; d += 1) {
      const next = [];
      for (const n of frontier) for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.set(m, d); next.push(m); }
      frontier = next;
    }
    return seen;
  };
  const payer = city.personaAgents[payerKey];
  const trap = city.byRole[trapRole];
  const all = bfs(adjacency(events), payer, 3);
  const q6 = bfs(adjacency(week), good, 2);

  return {
    synthetic: true,
    dataset: city.dataset,
    q1: { shop: good, orders, refunds, refundRate: orders ? Math.floor((refunds / orders) * 10_000) / 10_000 : 0, orders90 },
    q2: { identity: identityTop, byName: nameTop, payRows: events.filter((e) => e.kind === 'pay' || e.kind === 'renew').length },
    q3: { agents: [...personaAgents], spendByShop: spend },
    q4: { agents: [...q4].sort() },
    q5: { from: payer, to: trap, hops: all.has(trap) ? all.get(trap) : null },
    q6: { shop: good, nodes: [...q6.keys()].sort() },
  };
}
