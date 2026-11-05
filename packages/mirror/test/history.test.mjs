import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeCast, config } from '@graphpay/config';
import { HISTORY_BATCH, historyBatches, historyCounts, historyDecision, historyParams, historyStream, planHistory } from '../src/history.mjs';

const END_DAY = 20_400;
const cast = activeCast();

test('the 5% history has the scaled scenario counts exactly, and today is empty', () => {
  const params = historyParams({ scale: 0.05, endDay: END_DAY });
  const plan = planHistory(params);
  let expected = 0;
  for (const shop of cast.shops) {
    const counts = historyCounts(shop, 0.05);
    const shopEns = `${shop.label}.${config.root.ens}`;
    const mine = plan.events.filter((e) => e.fromEns === shopEns || e.toEns === shopEns);
    assert.equal(mine.filter((e) => e.kind === 'order').length, counts.orders, shop.key);
    assert.equal(mine.filter((e) => e.kind === 'pay').length, counts.orders);
    assert.equal(mine.filter((e) => e.kind === 'refund').length, counts.refunds);
    assert.equal(mine.filter((e) => e.kind === 'late').length, counts.late);
    assert.equal(mine.filter((e) => e.kind === 'deliver').length, counts.orders - counts.late);
    assert.equal(counts.orders, Math.round(shop.scenario.orders90d * 0.05));
    expected += counts.orders * 3 + counts.refunds;
  }
  assert.equal(plan.events.length, expected);
  // The pack's projection: about 1,256 events at 5% (25,116 at full scale).
  assert.ok(Math.abs(plan.events.length - 1256) <= 5, `${plan.events.length} events`);
  assert.ok(plan.events.every((e) => e.day < END_DAY && e.day >= END_DAY - 89), 'inside the D90 window, today empty');
  assert.ok(plan.events.every((e) => e.synthetic === true));
  assert.equal(new Set(plan.events.map((e) => e.ref)).size, plan.events.length);
  assert.ok(plan.events.every((e, i) => i === 0 || plan.events[i - 1].ts <= e.ts), 'time order');
  assert.ok(plan.buyers.every((b) => b.ens.endsWith(`.sim.${config.root.ens}`) && b.synthetic));
});

test('at full scale the history is the pack\'s 25,116 events', () => {
  const total = cast.shops.reduce((n, s) => {
    const c = historyCounts(s, 1);
    return n + c.orders * 3 + c.refunds;
  }, 0);
  assert.equal(total, 25_116);
});

test('the history is deterministic, batched by 25, and named after its parameters', () => {
  const params = historyParams({ scale: 0.05, endDay: END_DAY });
  const a = planHistory(params);
  const b = planHistory(params);
  assert.deepEqual(a.events, b.events);
  const batches = historyBatches(a.events);
  assert.ok(batches.every((x, i) => x.length === HISTORY_BATCH || i === batches.length - 1));
  assert.notEqual(historyStream(params), historyStream(historyParams({ scale: 0.1, endDay: END_DAY })));
});

test('a different history on Arkiv is refused; the same one resumes on a later day', () => {
  const paramsFor = (endDay) => historyParams({ scale: 0.05, endDay });
  const existing = { stream: historyStream(paramsFor(END_DAY)) };
  assert.deepEqual(historyDecision(existing, paramsFor), { action: 'resume', endDay: END_DAY });
  assert.equal(historyDecision({ stream: historyStream(historyParams({ scale: 1, endDay: END_DAY })) }, paramsFor).action, 'refuse');
  assert.equal(historyDecision(null, paramsFor).action, 'write');
});

test('the history writer resumes from its checkpoint after a transaction fails mid-batch', async () => {
  const { Actors } = await import('../src/actors.mjs');
  const { castActors } = await import('../src/actors.mjs');
  const { historyBuyers, writeHistory } = await import('../src/history.mjs');
  const { FakeLedger } = await import('./fakes.mjs');
  const plan = planHistory(historyParams({ scale: 0.05, endDay: END_DAY }));
  const actors = new Actors();
  for (const a of [...castActors(), ...historyBuyers()]) actors.register(a);
  const ledger = new FakeLedger();
  let sends = 0;
  const send = ledger.writeEdges.bind(ledger);
  ledger.writeEdges = async (edges, opts) => {
    sends += 1;
    if (sends === 3) {
      await send(edges.slice(0, 10), opts);
      throw Object.assign(new Error('HTTP 413'), { code: 'SEND_FAILED' });
    }
    return send(edges, opts);
  };
  await assert.rejects(writeHistory({ ledger, plan, actors }));
  await writeHistory({ ledger, plan, actors });
  assert.equal(ledger.edges.length, plan.events.length);
  assert.equal(new Set(ledger.edges.map((e) => e.ref)).size, plan.events.length, 'no event twice');
  assert.equal(ledger.checkpoints.get(plan.stream).block, plan.events.length - 1);
});
