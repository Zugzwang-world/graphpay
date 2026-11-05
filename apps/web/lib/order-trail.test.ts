import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORDER_QUERY, kindWord, netMicro, orderRequestUrl, trailOf, type TrailEdge } from './order-trail.ts';

const tx = `0x${'cd'.repeat(32)}`;
const edge = (kind: string, ts: number, amountMicro: string, ref = `x:${kind}`): TrailEdge => ({ kind, from: { ens: 'a.sim.example.eth' }, to: { ens: 'b.sim.example.eth' }, amountMicro, ts: String(ts), ref, synthetic: false });

test('the request is a GET with the order id in the variables, never in the query text', () => {
  const url = orderRequestUrl('0xabc');
  const params = new URL(url, 'https://example.test').searchParams;
  assert.equal(params.get('query'), ORDER_QUERY);
  assert.deepEqual(JSON.parse(params.get('variables') ?? ''), { id: '0xabc' });
  assert.ok(!ORDER_QUERY.includes('0xabc'));
});

test('the trail is oldest first, in the website words, with money only where money moved', () => {
  const steps = trailOf([edge('refund', 40, '800000'), edge('order', 10, '4800000'), edge('pay', 20, '4800000', `1874:${tx}:3`), edge('deliver', 30, '0')]);
  assert.deepEqual(steps.map((s) => s.word), ['Order created', 'Paid', 'Dispatched', 'Refunded']);
  assert.equal(steps[2]?.amountMicro, null);
  assert.equal(steps[1]?.settlementTx, tx);
  assert.equal(steps[0]?.settlementTx, null);
});

test('the net is what the shop kept: payments and renewals less refunds', () => {
  assert.equal(netMicro([edge('pay', 1, '4800000'), edge('refund', 2, '800000'), edge('deliver', 3, '0')]), 4_000_000n);
  assert.equal(netMicro([]), 0n);
});

test('an unknown edge kind is shown as itself, not hidden', () => {
  assert.equal(kindWord('dispute'), 'dispute');
});
