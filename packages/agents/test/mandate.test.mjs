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

test("the limits come from the human's words: the story request gives budget 6.000000 and one hour from the request", () => {
  const parsed = parseMandate(cast.order.request, opts);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.mandate.budgetUsdt, fromMicro(BigInt(cast.order.budgetMicro)));
  assert.equal(parsed.mandate.deadlineIso, '2026-11-06T13:00:00+05:30');
  assert.equal(parsed.mandate.deadlineMs, NOON_IST + 3_600_000);
  assert.match(parsed.mandate.hash, /^0x[0-9a-f]{64}$/);
});

test('a span counts from the request at any hour, across midnight, to the whole minute and never later', () => {
  const cases = [
    ['2026-11-06T18:20:42.500Z', '2026-11-07T00:50:00+05:30'], // 23:50:42 IST: the deadline is after midnight
    ['2026-11-06T21:30:00.000Z', '2026-11-07T04:00:00+05:30'], // 03:00 IST
    ['2026-11-06T18:29:59.999Z', '2026-11-07T00:59:00+05:30'], // 23:59:59 IST
  ];
  for (const [at, deadlineIso] of cases) {
    const parsed = parseMandate(cast.order.request, { ...opts, now: Date.parse(at) });
    assert.equal(parsed.ok, true, at);
    assert.equal(parsed.mandate.deadlineIso, deadlineIso, at);
    assert.equal(Date.parse(parsed.mandate.deadlineIso), parsed.mandate.deadlineMs, at);
    assert.ok(parsed.mandate.deadlineMs <= Date.parse(at) + 3_600_000 && parsed.mandate.deadlineMs > Date.parse(at) + 3_540_000, at);
  }
  const spans = [
    ['Get me sweets under 6 USDT within 45 minutes.', 45],
    ['Get me sweets under 6 USDT, delivered in 2 hours.', 120],
    ['Get me sweets under 6 USDT within half an hour.', 30],
    ['Get me sweets under 6 USDT in under 90 mins.', 90],
    ['Get me sweets under 6 USDT within 1.5 hrs.', 90],
    ['Get me sweets under 6 USDT within one hour, within 60 minutes.', 60],
  ];
  for (const [request, minutes] of spans) assert.equal(parseMandate(request, opts).mandate?.deadlineMs, NOON_IST + minutes * 60_000, request);
});

test('no readable budget or deadline: fail closed, with the reason', () => {
  const cases = [
    ['Get me sweets by 8 pm.', 'MANDATE_NO_BUDGET'],
    ['Get me sweets under 6 USDT.', 'MANDATE_NO_DEADLINE'],
    ['Get me sweets under 6 USDT by 8.', 'MANDATE_NO_DEADLINE'],
    ['Get me sweets under 6 USDT within 0 minutes.', 'MANDATE_NO_DEADLINE'],
    ['Get me sweets under 6 USDT within 25 hours.', 'MANDATE_NO_DEADLINE'],
    ['Get me sweets under 6 USDT within the hour.', 'MANDATE_NO_DEADLINE'],
    ['Get me sweets under 6 USDT or under 9 USDT by 8 pm.', 'MANDATE_AMBIGUOUS_BUDGET'],
    ['Get me sweets under 6 USDT by 8 pm or by 9 pm.', 'MANDATE_AMBIGUOUS_DEADLINE'],
    ['Get me sweets under 6 USDT by 8 pm, delivered within an hour.', 'MANDATE_AMBIGUOUS_DEADLINE'],
    ['Get me sweets under 6 USDT within an hour or within 2 hours.', 'MANDATE_AMBIGUOUS_DEADLINE'],
    ['', 'MANDATE_UNREADABLE'],
  ];
  for (const [request, reason] of cases) assert.equal(parseMandate(request, opts).reason, reason, request);
});

test('a clock deadline that has passed today refuses instead of rolling to tomorrow', () => {
  const late = Date.parse('2026-11-06T18:29:30.000Z'); // 23:59:30 IST, after an 11:59 pm deadline
  assert.equal(parseMandate('Get me sweets under 6 USDT by 11:59 pm.', { ...opts, now: late }).reason, 'MANDATE_DEADLINE_PASSED');
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
