import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adoptNeed, createRunLog, createRunState, displayUsdt, fromMicro, needFromRequest, parseMandate, teamCast, toMicro } from '../index.mjs';

const cast = teamCast();
const NOON_IST = Date.parse('2026-11-06T06:30:00.000Z');
const opts = { now: NOON_IST, timeZone: cast.city.timeZone, currency: cast.city.currency, buyer: cast.persona.ens };

test('money is a bigint of 6-decimal units, never a float', () => {
  assert.equal(toMicro('4.8'), 4_800_000n);
  assert.equal(toMicro('4.80'), 4_800_000n);
  assert.equal(toMicro('0.000001'), 1n);
  assert.equal(fromMicro(4_800_000n), '4.800000');
  assert.equal(displayUsdt(4_800_000n), '4.80');
  assert.equal(displayUsdt(1_234_567n), '1.234567');
  for (const bad of ['4.1234567', '-1', '1e3', '4,80', ' 4.80', '', '0x10']) assert.throws(() => toMicro(bad), bad);
});

test("the limits come from the human's words: the story request gives budget 6.000000 and 20:00 IST today", () => {
  const parsed = parseMandate(cast.order.request, opts);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.mandate.budgetUsdt, fromMicro(BigInt(cast.order.budgetMicro)));
  assert.equal(parsed.mandate.deadlineIso, `2026-11-06T${cast.order.deadlineLocal}:00+05:30`);
  assert.match(parsed.mandate.hash, /^0x[0-9a-f]{64}$/);
});

test('no readable budget or deadline: fail closed, with the reason', () => {
  const cases = [
    ['Get me sweets by 8 pm.', 'MANDATE_NO_BUDGET'],
    ['Get me sweets under 6 USDT.', 'MANDATE_NO_DEADLINE'],
    ['Get me sweets under 6 USDT by 8.', 'MANDATE_NO_DEADLINE'],
    ['Get me sweets under 6 USDT or under 9 USDT by 8 pm.', 'MANDATE_AMBIGUOUS_BUDGET'],
    ['Get me sweets under 6 USDT by 8 pm or by 9 pm.', 'MANDATE_AMBIGUOUS_DEADLINE'],
    ['', 'MANDATE_UNREADABLE'],
  ];
  for (const [request, reason] of cases) assert.equal(parseMandate(request, opts).reason, reason, request);
});

test('a deadline that has passed today refuses instead of rolling to tomorrow', () => {
  const late = Date.parse('2026-11-06T18:29:30.000Z'); // 23:59:30 IST, after the story's 23:59 deadline
  assert.equal(parseMandate(cast.order.request, { ...opts, now: late }).reason, 'MANDATE_DEADLINE_PASSED');
});

test('the model cannot widen the limits: code keeps the budget, deadline, item and quantity from the request', () => {
  const { mandate } = parseMandate(cast.order.request, opts);
  const state = createRunState({ mandate, codeNeed: needFromRequest(cast.order.request, mandate, cast), requestId: '0x01' });
  const log = createRunLog();
  const wide = { need: 'food', item: 'gold bars', quantity: 1000, budgetUsdt: '600', deadlineIso: '2027-01-01T00:00:00Z', city: 'Elsewhere' };
  const adopted = adoptNeed(state, wide, log, 'concierge');
  assert.equal(adopted.ok, true);
  assert.equal(adopted.need.budgetUsdt, mandate.budgetUsdt);
  assert.equal(adopted.need.deadlineIso, mandate.deadlineIso);
  assert.equal(adopted.need.item, cast.food.item);
  assert.equal(adopted.need.quantity, cast.food.quantity);
  assert.equal(adopted.need.city, cast.city.name);
  const g1 = log.events.find((e) => e.type === 'guard' && e.guard === 'G1');
  assert.match(g1.detail, /budget 600 → 6\.000000/);
  // Set once: a later proposal cannot change it either.
  adoptNeed(state, { ...wide, quantity: 2 }, log, 'concierge');
  assert.equal(state.need.quantity, cast.food.quantity);
});
