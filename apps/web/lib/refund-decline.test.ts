import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { namehash } from 'viem';
import { recorderEdgeValues } from '@graphpay/money-graph';
import { siteModel } from './site.server.ts';
import { DECLINE_COOLDOWN_MS, DeclineRefusal, MAX_DECLINES_PER_MINUTE, declineRefund, forgetDeclines, type DeclineDeps, type TrailEdge } from './refund-decline.server.ts';

const ORDER = `0x${'ab'.repeat(32)}`;
const T0 = 1_800_000_000_000;
const m = () => siteModel();
const request = (ts: number, amount = '800000'): TrailEdge => ({ kind: 'request', amountMicro: amount, ts: String(ts), ref: `req:${ORDER}:${Math.floor(ts / 60)}`, from: { ens: m().payer.ens }, to: { ens: m().merchant.ens } });

function deps(over: Partial<{ status: string; refunded: bigint; shopNode: string; buyerNode: string; trail: TrailEdge[]; at: number }> = {}) {
  const written: Parameters<DeclineDeps['record']>[0][] = [];
  const d: DeclineDeps = {
    readOrder: async () => ({ status: over.status ?? 'DELIVERED', amountMicro: 4_800_000n, refundedMicro: over.refunded ?? 0n, merchant: `0x${'11'.repeat(20)}`, shopNode: over.shopNode ?? namehash(m().merchant.ens), buyerNode: over.buyerNode ?? namehash(m().persona.ens) }),
    trail: async () => over.trail ?? [request(1_799_999_900)],
    payerEpoch: async () => 0,
    record: async (edge) => {
      written.push(edge);
      return { entityKey: '0xkey', txHash: '0xtx' };
    },
    now: () => over.at ?? T0,
  };
  return { d, written };
}
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof DeclineRefusal ? e.code : `error:${String(e)}`));

beforeEach(() => forgetDeclines());

test('a decline is a request edge from the shop to the payer agent, for the amount asked, answering that request', async () => {
  const { d, written } = deps();
  const out = await declineRefund({ orderId: ORDER, note: 'the photo shows a full cup' }, d);
  assert.deepEqual([out.decision, out.amountMicro, out.arkivTx, out.entityKey, out.requestRef], ['declined', '800000', '0xtx', '0xkey', request(1_799_999_900).ref]);
  const edge = written[0]!;
  assert.equal(edge.kind, 'request');
  assert.equal(edge.from.ens, m().merchant.ens);
  assert.equal(edge.to.ens, m().payer.ens);
  assert.equal(edge.amountMicro, 800_000n);
  assert.match(String(edge.ref), /^dec:0x[0-9a-f]{64}:\d+$/);
  assert.ok(String(edge.ref).length <= 128);
  const payload = JSON.parse(Buffer.from(String(edge.payload).slice(2), 'hex').toString('utf8'));
  assert.deepEqual(payload, { orderId: ORDER, decision: 'declined', amountMicro: '800000', requestRef: request(1_799_999_900).ref, note: 'the photo shows a full cup' });
  // The recorder's writer takes it (it writes `fail` and `request` only).
  assert.equal(recorderEdgeValues(edge).kind, 'request');
});

test('no request on the record, or one already answered by a decline or a refund, is never declined', async () => {
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps({ trail: [] }).d)), 'NO_REQUEST');
  const someoneElse = { ...request(1_799_999_900), from: { ens: 'someone.eth' } };
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps({ trail: [someoneElse] }).d)), 'NO_REQUEST');
  const decline = { ...request(1_799_999_950), ref: `dec:${ORDER}:1`, from: { ens: m().merchant.ens }, to: { ens: m().payer.ens } };
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps({ trail: [request(1_799_999_900), decline] }).d)), 'ALREADY_DECIDED');
  const refund = { ...request(1_799_999_950), kind: 'refund', ref: '1874:0xtx:1' };
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps({ trail: [request(1_799_999_900), refund] }).d)), 'ALREADY_DECIDED');
  // A new request after an earlier decline can be declined again.
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps({ trail: [request(1_799_999_800), decline, request(1_799_999_990)] }).d)), 'ok');
});

test('only this shop\'s orders of the story persona, still refundable, can be declined', async () => {
  for (const [over, want] of [
    [{ status: 'NONE' }, 'NO_SUCH_ORDER'],
    [{ shopNode: namehash('other.eth') }, 'NOT_OURS'],
    [{ buyerNode: namehash('someone.eth') }, 'NOT_THE_STORY_BUYER'],
    [{ status: 'REFUNDED' }, 'NOT_REFUNDABLE'],
    [{ refunded: 4_800_000n }, 'NOT_REFUNDABLE'],
  ] as const) {
    const { d, written } = deps(over);
    assert.equal(await code(declineRefund({ orderId: ORDER }, d)), want);
    assert.equal(written.length, 0);
  }
  assert.equal(await code(declineRefund({ orderId: 'nope' }, deps().d)), 'BAD_ORDER');
  assert.equal(await code(declineRefund({ orderId: ORDER, note: 'x'.repeat(141) }, deps().d)), 'BAD_NOTE');
});

test('one decline per order per minute, and a cap on all of them (the recorder\'s nonce is shared)', async () => {
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps().d)), 'ok');
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps({ at: T0 + 1000 }).d)), 'TOO_SOON');
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps({ at: T0 + DECLINE_COOLDOWN_MS }).d)), 'ok');
  forgetDeclines();
  for (let i = 0; i < MAX_DECLINES_PER_MINUTE; i += 1) {
    const id = `0x${i.toString(16).padStart(2, '0').repeat(32)}`;
    assert.equal(await code(declineRefund({ orderId: id }, deps({ trail: [{ ...request(1_799_999_900), ref: `req:${id}:1` }] }).d)), 'ok');
  }
  assert.equal(await code(declineRefund({ orderId: ORDER }, deps().d)), 'TOO_SOON');
});
