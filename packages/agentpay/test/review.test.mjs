// The reviewer's cases: a stalled payment is never paid twice; no URL reaches a model; the
// wire keeps the facilitator's key order; a model refunds only under a person's limit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { config, story } from '@graphpay/config';
import {
  buildRequirement,
  buyerTools,
  createBuyerAgent,
  createMerchant,
  createOrder,
  decodeHeader,
  HEADERS,
  merchantToolDefinitions,
  nodeOf,
  requirementSchema,
  whitechainNetwork,
} from '../index.mjs';
import { fakeChain, givePass } from './fakes.mjs';

const network = whitechainNetwork();
const shop = story.shops.find((s) => s.key === story.order.shop);
const product = shop.products[0];
const merchantName = `${shop.label}.${config.root.ens}`;
const agentName = `${story.workingAgents[0].label}.${story.persona.label}.${config.root.ens}`;
const pricer = () => ({ items: [{ sku: product.sku, name: product.name, quantity: 1, unitPriceMicro: product.priceMicro }], fulfilment: { type: 'delivery' } });
const URL_ = 'https://shop.test/order';

function rig({ settleAnswers, merchantOptions = {}, fetchWrap } = {}) {
  const chain = fakeChain();
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  const merchantAccount = privateKeyToAccount(generatePrivateKey());
  givePass(chain.state, { node: nodeOf(agentName), wallet: buyerAccount.address, dailyCapMicro: 6_000_000n });
  const calls = [];
  const answers = [...(settleAnswers ?? [{ success: true }])];
  const facilitator = {
    verify: async (p) => ({ isValid: true, payer: p.payload.payer }),
    settle: async (p, r) => {
      calls.push(p.payload.order.orderId);
      const a = answers.length > 1 ? answers.shift() : answers[0];
      return { transaction: `0x${'ab'.repeat(32)}`, network: r.network, ...a };
    },
  };
  const merchant = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator, publicClient: chain.publicClient, network, ...merchantOptions });
  const route = merchant.route(pricer, (_r, { order }) => ({ ok: true, orderId: order.orderId }));
  let quotes = 0;
  const base = async (url, init) => {
    if (!new Headers(init.headers).get(HEADERS.signature)) quotes++;
    return route(new Request(url, init));
  };
  const fetchImpl = fetchWrap ? fetchWrap(base) : base;
  const buyer = createBuyerAgent({ account: buyerAccount, publicClient: chain.publicClient, network, name: agentName, pass: { capMicro: 6_000_000n }, fetch: fetchImpl });
  return { chain, buyer, merchant, calls, quotes: () => quotes };
}

test('a stalled settlement stays pending and the retry re-sends the same signature', async () => {
  const r = rig({ settleAnswers: [{ success: false, errorReason: 'pending' }, { success: true }] });
  const first = await r.buyer.pay(URL_);
  assert.equal(first.status, 'unknown');
  assert.equal(first.httpStatus, 502);
  const status = await r.buyer.passStatus();
  assert.equal(status.pendingMicro, BigInt(product.priceMicro), 'still reserved');
  const second = await r.buyer.pay(URL_);
  assert.equal(second.status, 'paid');
  assert.equal(second.orderId, first.orderId);
  assert.deepEqual(r.calls, [first.orderId, first.orderId]);
  assert.equal(r.quotes(), 1, 'one quote, one order');
  assert.equal((await r.buyer.passStatus()).pendingMicro, 0n);
});

test('a pending order that the chain shows paid is reported paid without another send', async () => {
  const r = rig({ settleAnswers: [{ success: false, errorReason: 'in_flight' }] });
  const first = await r.buyer.pay(URL_);
  assert.equal(first.status, 'unknown');
  r.chain.state.orders.set(first.orderId, { status: 2 });
  const second = await r.buyer.pay(URL_);
  assert.equal(second.status, 'paid');
  assert.equal(r.calls.length, 1);
});

test('an unreachable merchant leaves the payment pending, not failed', async () => {
  let fail = true;
  const r = rig({ fetchWrap: (base) => async (url, init) => {
    if (new Headers(init.headers).get(HEADERS.signature) && fail) {
      fail = false;
      throw new TypeError('fetch failed');
    }
    return base(url, init);
  } });
  const first = await r.buyer.pay(URL_);
  assert.equal(first.status, 'unknown');
  const second = await r.buyer.pay(URL_);
  assert.equal(second.status, 'paid');
  assert.equal(second.orderId, first.orderId);
});

test('a definite refusal releases the reservation', async () => {
  const r = rig({ settleAnswers: [{ success: false, errorReason: 'SPEND_CAP' }] });
  const first = await r.buyer.pay(URL_);
  assert.equal(first.status, 'failed');
  assert.equal((await r.buyer.passStatus()).pendingMicro, 0n);
});

test('the authorize hook gates paid retries', async () => {
  const r = rig({ merchantOptions: { authorize: async (req) => req.headers.get('x-demo-passcode') === 'right' } });
  const res = await r.buyer.pay(URL_);
  assert.equal(res.status, 'failed');
  assert.equal(res.httpStatus, 401);
  assert.equal(r.calls.length, 0);
});

test('a deadline further out than the payment timeout is refused', async () => {
  // createMerchant refuses such a quote lifetime, so the far deadline comes from a merchant whose
  // clock runs a day ahead (as any server could): the buyer refuses it before signing.
  assert.throws(() => rig({ merchantOptions: { quoteTtlSeconds: 86_400 } }), /quoteTtlSeconds is 1 to 600/);
  const r = rig({ merchantOptions: { clock: () => Date.now() + 86_400_000 } });
  await assert.rejects(r.buyer.pay(URL_), (e) => e.code === 'DEADLINE_TOO_FAR');
});

test('no tool result carries a URL from an error', async () => {
  const chain = fakeChain();
  const boom = async () => {
    throw new Error('HTTP request failed. URL: https://rpc.example/secret-path-key');
  };
  const leaky = { ...chain.publicClient, getChainId: boom, readContract: boom, multicall: boom };
  const buyer = createBuyerAgent({ account: privateKeyToAccount(generatePrivateKey()), publicClient: leaky, network, name: agentName, pass: { capMicro: 1 }, fetch: async () => new Response('{}') });
  const out = await buyerTools(buyer).agentpay_pass_status.execute({}, {});
  assert.equal(out.ok, false);
  assert.doesNotMatch(JSON.stringify(out), /https?:|secret-path-key/);
});

test('the requirement keeps the scheme schema key order (the facilitator compares JSON)', () => {
  const o = createOrder({ merchant: { name: merchantName, address: `0x${'11'.repeat(20)}` }, items: [{ sku: product.sku, name: product.name, unitPriceMicro: product.priceMicro }], fulfilment: { type: 'pickup' }, deadline: 2_000_000_000 });
  const req = buildRequirement(o, network);
  assert.deepEqual(Object.keys(req), Object.keys(requirementSchema.shape));
  assert.deepEqual(Object.keys(req.extra), ['contract', 'order', 'shopName', 'mandateRequired']);
  assert.deepEqual(JSON.stringify(requirementSchema.parse(req)), JSON.stringify(req));
});

test('the refund tool needs a person-set refund limit', async () => {
  const r = rig();
  const refund = merchantToolDefinitions(r.merchant).find((d) => d.name === 'agentpay_refund');
  const out = await refund.run({ orderId: `0x${'00'.repeat(32)}`, amountUsdt: '1' });
  assert.equal(out.code, 'NO_REFUND_LIMIT');
});

test('a settled answer carries the PAYMENT-RESPONSE header', async () => {
  const r = rig();
  const res = await r.buyer.pay(URL_);
  assert.equal(decodeHeader(res.response.headers.get(HEADERS.response)).success, true);
});
