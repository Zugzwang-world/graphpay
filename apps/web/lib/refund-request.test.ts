import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { namehash } from 'viem';
import { recorderEdgeValues } from '@graphpay/money-graph';
import { siteModel } from './site.server.ts';
import { COOLDOWN_MS, MAX_WRITES_PER_MINUTE, RefundRefusal, cleanReason, forgetRefundRequests, requestRefund, type RefundDeps } from './refund-request.server.ts';

const ORDER = `0x${'ab'.repeat(32)}`;
const OTHER = `0x${'cd'.repeat(32)}`;

function deps(over: Partial<{ status: string; amount: bigint; refunded: bigint; shopNode: string; buyerNode: string; last: string | null; at: number }> = {}) {
  const written: Parameters<RefundDeps['record']>[0][] = [];
  const d: RefundDeps = {
    lastOrder: async () => ((over.last === undefined ? ORDER : over.last) ? { orderId: over.last ?? ORDER, epoch: 3 } : null),
    readOrder: async () => ({ status: over.status ?? 'PAID', amountMicro: over.amount ?? 4_800_000n, refundedMicro: over.refunded ?? 0n, merchant: `0x${'11'.repeat(20)}`, shopNode: over.shopNode ?? namehash(siteModel().merchant.ens), buyerNode: over.buyerNode ?? namehash(siteModel().persona.ens) }),
    record: async (edge) => {
      written.push(edge);
      return { entityKey: '0xkey', txHash: '0xtx' };
    },
    now: () => over.at ?? 1_800_000_000_000,
  };
  return { d, written };
}
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof RefundRefusal ? e.code : `error:${String(e)}`));

beforeEach(() => forgetRefundRequests());

test('a request for the payer agent\'s last order is written as a request edge, payer to shop', async () => {
  const { d, written } = deps();
  const out = await requestRefund({ orderId: ORDER, amountMicro: '800000', reason: 'two squashed' }, d);
  assert.equal(out.arkivTx, '0xtx');
  assert.equal(written.length, 1);
  const edge = written[0]!;
  assert.equal(edge.kind, 'request');
  assert.equal(edge.from.ens, siteModel().payer.ens);
  assert.equal(edge.to.ens, siteModel().merchant.ens);
  assert.equal(edge.amountMicro, 800_000n);
  assert.match(String(edge.ref), /^req:0x[0-9a-f]{64}:\d+$/);
  assert.ok(String(edge.ref).length <= 128);
  assert.equal(edge.from.epoch, 3);
  // The edge is one the recorder's writer accepts.
  assert.equal(recorderEdgeValues(edge).kind, 'request');
});

test('the page cannot name another order; no order at all is refused', async () => {
  assert.equal(await code(requestRefund({ orderId: OTHER, amountMicro: '1', reason: 'x' }, deps().d)), 'NOT_THIS_ORDER');
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ last: null }).d)), 'NO_ORDER');
});

test('an order bought by someone else is refused; the payer agent or its person may ask', async () => {
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ buyerNode: `0x${'00'.repeat(32)}` }).d)), 'NOT_OURS');
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ buyerNode: namehash(siteModel().payer.ens) }).d)), 'ok');
});

test('the same order in the same minute is one ref, so a retry after an uncertain write is one record', async () => {
  const a = deps({ at: 1_800_000_000_000 });
  await requestRefund({ amountMicro: '1', reason: 'x' }, a.d);
  forgetRefundRequests();
  const b = deps({ at: 1_800_000_000_000 + 20_000 });
  await requestRefund({ amountMicro: '1', reason: 'x' }, b.d);
  assert.equal(a.written[0]!.ref, b.written[0]!.ref);
});

test('writes across all orders are capped per minute', async () => {
  for (let i = 0; i < MAX_WRITES_PER_MINUTE; i++) {
    const id = `0x${(i + 1).toString(16).padStart(64, '0')}`;
    await requestRefund({ amountMicro: '1', reason: 'x' }, deps({ last: id }).d);
  }
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ last: OTHER }).d)), 'TOO_SOON');
});

test('another shop\'s order, an unpaid order and a refunded one are refused', async () => {
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ shopNode: `0x${'00'.repeat(32)}` }).d)), 'NOT_OURS');
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ status: 'CREATED' }).d)), 'NOT_REFUNDABLE');
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ refunded: 4_800_000n }).d)), 'NOT_REFUNDABLE');
});

test('the amount cannot exceed what is left, and must be a positive integer string', async () => {
  assert.equal(await code(requestRefund({ amountMicro: '4800001', reason: 'x' }, deps().d)), 'OVER_REFUNDABLE');
  assert.equal(await code(requestRefund({ amountMicro: '2000000', reason: 'x' }, deps({ refunded: 3_000_000n }).d)), 'OVER_REFUNDABLE');
  for (const bad of ['0', '-1', '1.5', 5, null, '']) assert.equal(await code(requestRefund({ amountMicro: bad, reason: 'x' }, deps().d)), 'BAD_AMOUNT');
});

test('a second request for the same order inside a minute is refused, and allowed after it', async () => {
  const first = deps({ at: 1_800_000_000_000 });
  await requestRefund({ amountMicro: '1', reason: 'x' }, first.d);
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps({ at: 1_800_000_000_000 + 1000 }).d)), 'TOO_SOON');
  const later = deps({ at: 1_800_000_000_000 + COOLDOWN_MS });
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, later.d)), 'ok');
});

test('a failed write leaves no cooldown behind', async () => {
  const { d } = deps();
  d.record = async () => {
    throw new Error('write failed');
  };
  assert.match(await code(requestRefund({ amountMicro: '1', reason: 'x' }, d)), /^error:/);
  assert.equal(await code(requestRefund({ amountMicro: '1', reason: 'x' }, deps().d)), 'ok');
});

test('the reason is short plain text', () => {
  assert.equal(cleanReason('  two   squashed  '), 'two squashed');
  assert.equal(cleanReason('दो कुचले'), 'दो कुचले');
  for (const bad of ['', '   ', 'a'.repeat(141), 'bell\u0007', 5, undefined]) assert.throws(() => cleanReason(bad), (e: unknown) => e instanceof RefundRefusal && e.code === 'BAD_REASON');
});
