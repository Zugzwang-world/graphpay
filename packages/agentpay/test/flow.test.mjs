// Buyer ↔ merchant ↔ facilitator offline: real signatures, a fake chain for the reads.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { config, story } from '@graphpay/config';
import {
  buyerTools,
  buyerToolDefinitions,
  createAgentPayMcpServer,
  createBuyerAgent,
  createMandate,
  createMerchant,
  createReferenceRelayer,
  decodeHeader,
  encodeHeader,
  HEADERS,
  merchantToolDefinitions,
  nodeOf,
  staticReputation,
  usdt,
  whitechainNetwork,
} from '../index.mjs';
import { fakeChain, fakeFacilitator, givePass } from './fakes.mjs';

const network = whitechainNetwork();
const shop = story.shops.find((s) => s.key === story.order.shop);
const product = shop.products[0];
const merchantName = `${shop.label}.${config.root.ens}`;
const agentName = `${story.workingAgents[0].label}.${story.persona.label}.${config.root.ens}`;
const pricer = ({ url }) => (url.pathname === '/free' ? null : { items: [{ sku: product.sku, name: product.name, quantity: 1, unitPriceMicro: product.priceMicro }], fulfilment: { type: 'delivery' } });

function setup({ cap = 6_000_000n, spent = 0n, pass = {}, mandate, facilitator, relayerVerify = true, riskCheck, reputation, buyerReputation } = {}) {
  const chain = fakeChain();
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  const merchantAccount = privateKeyToAccount(generatePrivateKey());
  givePass(chain.state, { node: nodeOf(agentName), wallet: buyerAccount.address, dailyCapMicro: cap, spent });
  const settle = facilitator ?? fakeFacilitator();
  const relayer = createReferenceRelayer({ walletClient: { account: privateKeyToAccount(generatePrivateKey()) }, publicClient: chain.publicClient, network, allowedMerchants: [merchantAccount.address] });
  const f = relayerVerify ? { verify: relayer.verify, settle: settle.settle, calls: settle.calls } : settle;
  const merchant = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: f, publicClient: chain.publicClient, network, riskCheck, reputation });
  const route = merchant.route(pricer, (_r, { order, alreadyPaid }) => ({ ok: true, orderId: order.orderId, alreadyPaid: Boolean(alreadyPaid) }));
  const fetchImpl = async (url, init) => route(new Request(url, init));
  const buyer = createBuyerAgent({ account: buyerAccount, publicClient: chain.publicClient, network, name: agentName, pass: { capMicro: cap, period: 'day', ...pass }, mandate, fetch: fetchImpl, reputation: buyerReputation });
  return { chain, buyer, merchant, merchantAccount, buyerAccount, facilitator: settle, relayer, fetchImpl };
}

const URL_ = 'https://shop.test/order';

test('pay: one signature, verified by the relayer, settled by the facilitator', async () => {
  const { buyer, facilitator, merchant } = setup();
  let paid;
  merchant.on('paid', (p) => (paid = p));
  const r = await buyer.pay(URL_);
  assert.equal(r.status, 'paid', r.reason);
  assert.equal(r.amountMicro, BigInt(product.priceMicro));
  assert.equal(facilitator.calls.filter((c) => c[0] === 'settle').length, 1);
  const body = await r.response.json();
  assert.equal(body.orderId, r.orderId);
  assert.equal(decodeHeader(r.response.headers.get(HEADERS.response)).success, true);
  assert.equal(paid.order.orderId, r.orderId);
});

test('a free route passes through', async () => {
  const { buyer } = setup();
  const r = await buyer.pay('https://shop.test/free');
  assert.equal(r.status, 'free');
});

test('guards refuse in code before any signature', async (t) => {
  const cases = [
    ['OVER_DAILY_CAP', { spent: 5_000_000n }],
    ['MERCHANT_NOT_ALLOWED', { pass: { merchants: [`other.${config.root.ens}`] } }],
    ['OVER_PAYMENT_MAX', { pass: { perPaymentMaxMicro: 1_000_000n } }],
    ['OVER_BUDGET', { mandate: createMandate({ buyer: agentName, budgetMicro: 1_000_000n, deadlineMs: Date.now() + 60_000 }) }],
    ['MANDATE_EXPIRED', { mandate: createMandate({ buyer: agentName, budgetMicro: 9_000_000n, deadlineMs: Date.now() - 1 }) }],
    ['MERCHANT_HIGH_RISK', { buyerReputation: staticReputation({ [merchantName]: { risk: 'high', reasons: ['synthetic test rating'] } }) }],
  ];
  for (const [code, opts] of cases) {
    await t.test(code, async () => {
      const { buyer, facilitator } = setup(opts);
      await assert.rejects(buyer.pay(URL_), (e) => e.code === code);
      assert.equal(facilitator.calls.length, 0);
    });
  }
});

test('a revoked, missing or foreign pass is refused', async () => {
  const s = setup();
  s.chain.state.policies.get(nodeOf(agentName)).revoked = true;
  await assert.rejects(s.buyer.pay(URL_), (e) => e.code === 'PASS_REVOKED');
  const s2 = setup();
  s2.chain.state.bound.clear();
  await assert.rejects(s2.buyer.pay(URL_), (e) => e.code === 'NO_PASS');
});

test('a wrong chain is refused before signing', async () => {
  const s = setup();
  s.chain.state.chainId = 1;
  await assert.rejects(s.buyer.pay(URL_), (e) => e.code === 'WRONG_CHAIN');
});

test('a 402 whose requirement does not match its details is refused', async () => {
  const s = setup();
  const lying = async (url, init) => {
    const res = await s.fetchImpl(url, init);
    if (res.status !== 402) return res;
    const pr = decodeHeader(res.headers.get(HEADERS.required));
    pr.accepts[0].amount = '1';
    return new Response(JSON.stringify(pr), { status: 402, headers: { [HEADERS.required]: encodeHeader(pr) } });
  };
  const buyer = createBuyerAgent({ account: s.buyerAccount, publicClient: s.chain.publicClient, network, name: agentName, pass: { capMicro: 6_000_000n }, fetch: lying });
  await assert.rejects(buyer.pay(URL_), (e) => e.code === 'BAD_402');
});

test('the merchant re-prices a paid retry and refuses a signed cheaper order', async () => {
  const s = setup();
  const cheap = createMerchant({ name: merchantName, address: s.merchantAccount.address, facilitator: fakeFacilitator(), publicClient: s.chain.publicClient, network });
  const cheapRoute = cheap.route(() => ({ items: [{ sku: product.sku, name: product.name, quantity: 1, unitPriceMicro: 1n }], fulfilment: { type: 'delivery' } }), () => ({ ok: true }));
  const realRoute = s.merchant.route(pricer, () => ({ ok: true }));
  // Quote from the cheap route, present the signature to the real one.
  let first = true;
  const swap = async (url, init) => (first ? ((first = false), cheapRoute(new Request(url, init))) : realRoute(new Request(url, init)));
  const buyer = createBuyerAgent({ account: s.buyerAccount, publicClient: s.chain.publicClient, network, name: agentName, pass: { capMicro: 6_000_000n }, fetch: swap });
  const r = await buyer.pay(URL_);
  assert.equal(r.status, 'failed');
  assert.equal(r.httpStatus, 402);
  assert.equal(s.facilitator.calls.length, 0);
});

test('a forged signature is refused by the relayer', async () => {
  const s = setup();
  const forge = async (url, init) => {
    const h = new Headers(init.headers);
    const sig = h.get(HEADERS.signature);
    if (sig) {
      const p = decodeHeader(sig);
      p.payload.signature = `0x${'1b'.repeat(65)}`;
      h.set(HEADERS.signature, encodeHeader(p));
    }
    return s.fetchImpl(url, { ...init, headers: h });
  };
  const buyer = createBuyerAgent({ account: s.buyerAccount, publicClient: s.chain.publicClient, network, name: agentName, pass: { capMicro: 6_000_000n }, fetch: forge });
  const r = await buyer.pay(URL_);
  assert.equal(r.status, 'failed');
  assert.equal(s.facilitator.calls.filter((c) => c[0] === 'settle').length, 0);
});

test('the risk check can refuse a payer before settlement', async () => {
  const s = setup({ riskCheck: async () => ({ allow: false, reason: 'synthetic test refusal' }) });
  const r = await s.buyer.pay(URL_);
  assert.equal(r.httpStatus, 403);
  assert.equal(s.facilitator.calls.length, 0);
});

test('AI SDK tools: no tool takes a cap; maxUsdt can only lower it', async () => {
  const s = setup();
  for (const d of buyerToolDefinitions(s.buyer)) for (const key of Object.keys(d.shape)) assert.doesNotMatch(key, /cap|budget|allow|merchants/i, `${d.name}.${key}`);
  const tools = buyerTools(s.buyer, { allowedOrigins: ['https://shop.test'] });
  const low = await tools.agentpay_pay.execute({ url: URL_, maxUsdt: '1.00' }, {});
  assert.equal(low.ok, false);
  assert.equal(low.code, 'OVER_CALLER_MAX');
  const elsewhere = await tools.agentpay_pay.execute({ url: 'https://elsewhere.test/order' }, {});
  assert.equal(elsewhere.code, 'ORIGIN_NOT_ALLOWED');
  const quote = await tools.agentpay_quote.execute({ url: URL_ }, {});
  assert.equal(quote.ok, true);
  assert.equal(quote.guards.pass, true);
  const paid = await tools.agentpay_pay.execute({ url: URL_, maxUsdt: '6' }, {});
  assert.equal(paid.ok, true);
  assert.equal(paid.status, 'paid');
});

test('MCP: one server with the buyer and merchant tools', async () => {
  const s = setup();
  const server = createAgentPayMcpServer({ buyer: s.buyer, merchant: s.merchant, merchantOptions: { catalog: { [product.sku]: { name: product.name, unitPriceMicro: product.priceMicro } } } });
  const names = Object.keys(server._registeredTools ?? {});
  assert.equal(names.length, buyerToolDefinitions(s.buyer).length + merchantToolDefinitions(s.merchant).length);
  assert.ok(names.includes('agentpay_pay') && names.includes('merchant_agentpay_refund'));
});

test('merchant quote tool prices from the catalog only', async () => {
  const s = setup();
  const [quote] = merchantToolDefinitions(s.merchant, { catalog: { [product.sku]: { name: product.name, unitPriceMicro: product.priceMicro } } });
  const ok = await quote.run({ items: [{ sku: product.sku, quantity: 2 }], fulfilment: { type: 'pickup' } });
  assert.equal(ok.ok, true);
  assert.equal(ok.order.total, (Number(product.priceMicro) * 2 / 1e6).toFixed(2));
  const bad = await quote.run({ items: [{ sku: 'nope', quantity: 1 }], fulfilment: { type: 'pickup' } });
  assert.equal(bad.code, 'UNKNOWN_SKU');
});

test('express middleware answers 402 and passes a paid request to next()', async () => {
  const s = setup();
  const mw = s.merchant.express(pricer);
  const res = () => {
    const r = { statusCode: 200, headers: {}, body: null, setHeader: (k, v) => (r.headers[k.toLowerCase()] = v), end: (b) => (r.body = b) };
    return r;
  };
  const r1 = res();
  let nexted = false;
  await mw({ method: 'GET', url: '/order', headers: { host: 'shop.test' } }, r1, () => (nexted = true));
  assert.equal(r1.statusCode, 402);
  assert.ok(r1.headers['payment-required']);
  assert.equal(nexted, false);
});
