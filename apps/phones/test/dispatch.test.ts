import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dispatchBadge, dispatchedOf } from '../../web/lib/stage/dispatch.ts';

const ORDER = `0x${'ab'.repeat(32)}`;
const TX = `0x${'cd'.repeat(32)}`;
// The `dispatched` event the merchant phone relays from the route's answer, as it builds it.
const relayed = (answer: { transaction?: string | null; status?: string; alreadyDelivered?: boolean }, at = 1_000) => ({ key: 'dispatched', at, data: { orderId: ORDER, transaction: answer.transaction ?? null } });

test('an order the hosted shop already marked delivered shows Dispatched with its link, and the refund unlocks', () => {
  const dispatched = dispatchedOf([relayed({ transaction: TX, status: 'confirmed', alreadyDelivered: true })], ORDER.toUpperCase().replace('0X', '0x'));
  assert.deepEqual(dispatched, { tx: TX, at: 1_000 });
  assert.equal(dispatchBadge(dispatched, true), 'link');
  // The customer phone's rule on the stage: the refund unlocks once the order is dispatched.
  assert.equal(dispatched !== null, true);
});

test('already delivered with no transaction found still shows Dispatched, not Dispatching', () => {
  const dispatched = dispatchedOf([relayed({ transaction: null, status: 'confirmed', alreadyDelivered: true })], ORDER);
  assert.deepEqual(dispatched, { tx: null, at: 1_000 });
  assert.equal(dispatchBadge(dispatched, true), 'done');
});

test('no dispatch yet: Dispatching on the stage, nothing off it, and the refund stays locked', () => {
  assert.equal(dispatchedOf([{ key: 'refund', at: 1, data: { orderId: ORDER } }], ORDER), null);
  assert.equal(dispatchedOf([relayed({ transaction: TX })], `0x${'ef'.repeat(32)}`), null);
  assert.equal(dispatchBadge(null, true), 'pending');
  assert.equal(dispatchBadge(null, false), null);
});
