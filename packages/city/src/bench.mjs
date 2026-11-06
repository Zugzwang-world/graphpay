// The benchmark's parameters and ground truth from the generated city (planning/SPEC/
// BENCHMARK.md §2): which actors and days the six questions name, and each answer by
// identity (node and epoch) and by name. They differ only for Q2, where the
// re-registered shop's two holders share a name.

import { dayOf } from '@graphpay_ethglobal/arkiv-graph';
import { rate } from '@graphpay/money-graph';

const DAY = 86_400;

// `today` is the engine's day (its D90 window ends today), so Q1's 90-day count is
// asked the same way on both sides.
export function benchParams(city, { today = dayOf(Date.now() / 1000), goodRole = 'good', trapRole = 'trap', payerKey = 'payer' } = {}) {
  const weekStartTs = city.endTs - 7 * DAY;
  return {
    good: city.byRole[goodRole],
    persona: city.persona,
    payer: city.personaAgents[payerKey],
    trap: city.byRole[trapRole],
    sinceDay: weekStartTs / DAY,
    weekStartTs,
    d90Day: today - 89,
  };
}

export function benchTruth(city, truth, params) {
  const current = new Map();
  for (const e of city.events) for (const end of [e.from, e.to]) current.set(end.ens, Math.max(current.get(end.ens) ?? 0, end.epoch));
  const goodEnd = (e) => [e.from, e.to].some((x) => x.ens === params.good && x.epoch === current.get(params.good));
  const orders90 = city.events.filter((e) => goodEnd(e) && (e.kind === 'order' || e.kind === 'subscribe') && Math.floor(e.ts / DAY) >= params.d90Day).length;
  const both = (v) => ({ identity: v, name: v });
  return {
    synthetic: true,
    dataset: city.dataset,
    payRows: truth.q2.payRows,
    Q1: both({ orders: truth.q1.orders, refunds: truth.q1.refunds, refundRate: rate(truth.q1.refunds, truth.q1.orders), orders90 }),
    Q2: { identity: truth.q2.identity.map(({ ens, paidMicro }) => ({ ens, paidMicro })), name: truth.q2.byName },
    Q3: both(Object.fromEntries(Object.entries(truth.q3.spendByShop).sort())),
    Q4: both(truth.q4.agents),
    Q5: both({ hops: truth.q5.hops }),
    Q6: both(truth.q6.nodes),
  };
}
