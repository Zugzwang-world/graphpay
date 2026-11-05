// The shop API offline: story catalog, free quotes, the 402 step with exactly one `accepts`, the
// ENS payee check, quote writes, and the paid step through our real facilitator pipeline on a fake
// chain, signed by x402Client with spend controls. Expected values come from the story config.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, namehash, toHex } from 'viem';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { story } from '@graphpay/config';
import { graphPayOrderClient, termsHashOf } from '@graphpay/facilitator';
import { CHAIN_ID, CHECKOUT, MERCHANT, PERMIT2, T0, TOKEN, fakeChain, makeFacilitator, newAccount } from '../../facilitator/test/helpers.mjs';
import { PASSCODE_HEADER, ZERO32, ZERO_ADDRESS, catalogOf, priceOf, shopHandler, storyShops } from '../index.mjs';

const NETWORK = `eip155:${CHAIN_ID}`;
const PASSCODE = 'a-demo-passcode-that-is-long-enough';
const BASE = 'https://site.example/api/shop';
const SHOPS = storyShops();
const SHOP = SHOPS.find((s) => s.key === story.order.shop);
const BUYER = 'buyer.example.graphpay.eth';
const PAYER = 'agent.example.graphpay.eth';

// A shop wired to the real facilitator pipeline on a fake chain whose orders the test can read.
function world({ payee = async () => MERCHANT, createQuote, deliver, clock = () => T0, facilitator: override } = {}) {
  const payerAccount = newAccount();
  const chain = fakeChain(payerAccount);
  const orders = new Map();
  chain.state.bound = namehash(PAYER);
  const f = makeFacilitator({ chain, gate: async (name) => ({ ok: true, node: namehash(name), epoch: 0 }), clock });
  // Settling marks the order paid on the fake chain, as the contract would.
  chain.sendSettle = async (args) => {
    chain.sends += 1;
    orders.set(args[0].orderId, { status: 2, termsHash: termsHashOf(args[0]), buyerNode: args[0].buyerNode, shopNode: args[0].shopNode });
    return `0x${String(chain.sends).padStart(64, 'c')}`;
  };
  const lines = [];
  const handle = shopHandler({
    shops: SHOPS,
    merchants: { [SHOP.key]: MERCHANT },
    chainId: CHAIN_ID,
    token: TOKEN,
    checkout: CHECKOUT,
    baseUrl: BASE,
    passcode: PASSCODE,
    facilitator: override ?? f,
    orders: { readOrder: async (id) => orders.get(id) ?? { status: 0, termsHash: ZERO32, buyerNode: ZERO32, shopNode: ZERO32 } },
    resolvePayee: payee,
    createQuote,
    deliver,
    log: (l) => lines.push(l),
    clock,
  });
  return { handle, chain, orders, payerAccount, lines, f };
}

const get = (handle, path, params) => handle(new Request(`${BASE}${path}?${new URLSearchParams(params)}`));
const quoteParams = (over = {}) => ({ shop: SHOP.ensName, item: story.order.item, qty: String(story.order.quantity), buyer: BUYER, payer: PAYER, wallet: '', ...over });
const post = (handle, url, body, { passcode = PASSCODE, signature } = {}) =>
  handle(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(passcode ? { [PASSCODE_HEADER]: passcode } : {}), ...(signature ? signature : {}) },
      body: JSON.stringify(body),
    }),
  );

async function quoteFor(w, over) {
  const res = await get(w.handle, '/quote', quoteParams(over));
  assert.equal(res.status, 200);
  return res.json();
}

// The agent's side: x402Client with spend controls and our scheme.
function payerClient(account) {
  const scheme = graphPayOrderClient({
    account,
    publicClient: { getChainId: async () => CHAIN_ID, readContract: async () => 0n },
    chainId: CHAIN_ID,
    token: TOKEN,
    permit2: PERMIT2,
    checkout: CHECKOUT,
    payerName: PAYER,
    mandateHash: keccak256(toHex('mandate')),
    now: () => T0,
  });
  const client = new x402Client().register(NETWORK, scheme).setSpendControls({ allowedAssets: [{ network: NETWORK, asset: TOKEN.address, maxAmountPerPayment: String(story.order.budgetMicro) }] });
  return { client, http: new x402HTTPClient(client) };
}

test('the catalog is the story, labelled synthetic', async () => {
  const w = world();
  const res = await get(w.handle, '/catalog', { shop: SHOP.ensName });
  const body = await res.json();
  assert.equal(body.synthetic, true);
  assert.deepEqual(body, JSON.parse(JSON.stringify(catalogOf(SHOP))));
  const product = SHOP.products[0];
  assert.equal(body.items[0].priceMicro, product.priceMicro);
  assert.equal(body.items[0].etaMinutes, SHOP.scenario.etaMinutes);
  assert.equal((await get(w.handle, '/catalog', { shop: 'nope.graphpay.eth' })).status, 404);
});

test('a quote is free, priced from the catalog only, and its order id has the top bit clear', async () => {
  const w = world();
  const q = await quoteFor(w, { priceMicro: '1' }); // a price in the request is ignored
  assert.equal(q.priceMicro, String(story.order.priceMicro));
  assert.equal(q.synthetic, true);
  assert.equal(q.validUntil, T0 / 1000 + 600);
  assert.equal(BigInt(q.orderId) >> 255n, 0n);
  assert.equal(q.payUrl, `${BASE}/orders/${q.orderId}/pay`);
  assert.equal(q.order.amountMicro, String(story.order.priceMicro));
  assert.equal(q.order.payerNode, namehash(PAYER));
  assert.equal(q.order.kind, '0');
  assert.equal(q.asset, TOKEN.address);
  const reorder = await quoteFor(w, { qty: String(story.order.reorder.quantity) });
  assert.equal(reorder.priceMicro, String(story.order.reorder.priceMicro));
  assert.equal(String(priceOf(SHOP.products[0], 1)), String(Math.ceil(SHOP.products[0].priceMicro / SHOP.products[0].quantity)));
  assert.equal(w.chain.sends, 0);
});

test('a quote refuses bad names, a human without a wallet, unknown items and bad quantities', async () => {
  const w = world();
  for (const [over, status] of [
    [{ buyer: 'Buyer.example.graphpay.eth' }, 400],
    [{ payer: 'not normal..eth' }, 400],
    [{ payer: '', wallet: '' }, 400],
    [{ payer: '', wallet: ZERO_ADDRESS }, 400],
    [{ item: 'something else' }, 404],
    [{ qty: '0' }, 400],
    [{ qty: '1.5' }, 400],
    [{ qty: '100001' }, 400],
    [{ shop: 'other.graphpay.eth' }, 404],
    [{ wallet: '0x1234' }, 400],
  ]) {
    assert.equal((await get(w.handle, '/quote', quoteParams(over))).status, status, JSON.stringify(over));
  }
  const human = await quoteFor(w, { payer: '', wallet: newAccount().address });
  assert.equal(human.order.payerNode, ZERO32);
});

test('the pay step needs the passcode, and is off without one', async () => {
  const w = world();
  const q = await quoteFor(w);
  assert.equal((await post(w.handle, q.payUrl, q.terms, { passcode: null })).status, 401);
  assert.equal((await post(w.handle, q.payUrl, q.terms, { passcode: 'wrong-passcode-but-quite-long' })).status, 401);
  const off = shopHandler({ shops: SHOPS, merchants: {}, chainId: CHAIN_ID, token: TOKEN, checkout: CHECKOUT, baseUrl: BASE, passcode: 'short', facilitator: {}, orders: {}, resolvePayee: async () => MERCHANT });
  assert.equal((await post(off, q.payUrl, q.terms)).status, 503);
});

test('without a signature: 402 with exactly one accepts entry, the same in the header and the body', async () => {
  const w = world();
  const q = await quoteFor(w);
  const res = await post(w.handle, q.payUrl, q.terms);
  assert.equal(res.status, 402);
  const body = await res.json();
  const header = decodePaymentRequiredHeader(res.headers.get('payment-required'));
  assert.deepEqual(header, body);
  assert.equal(body.x402Version, 2);
  assert.equal(body.accepts.length, 1);
  assert.equal(body.resource.url, q.payUrl);
  const [req] = body.accepts;
  assert.equal(req.scheme, 'graphpay-order');
  assert.equal(req.network, NETWORK);
  assert.equal(req.amount, String(story.order.priceMicro));
  assert.equal(req.payTo.toLowerCase(), MERCHANT.toLowerCase());
  assert.deepEqual(req.extra.order, q.order);
  assert.equal(req.extra.shopName, SHOP.ensName);
  assert.equal(req.extra.mandateRequired, true);
  assert.equal(req.extra.quoteKey, undefined, 'no requestId, no quote write');
});

test('tampered terms are refused: id, price, a later exp, an expired quote, the wrong path', async () => {
  let clock = T0;
  const w = world({ clock: () => clock });
  const q = await quoteFor(w);
  const send = (terms, url = q.payUrl) => post(w.handle, url, terms);
  assert.equal((await send({ ...q.terms, quantity: q.terms.quantity + 1 })).status, 400);
  assert.equal((await send({ ...q.terms, priceMicro: '1' })).status, 409);
  assert.equal((await send({ ...q.terms, exp: q.terms.exp + 3600 })).status, 400, 'the clamp breaks the hash');
  assert.equal((await send({ ...q.terms, extra: true })).status, 400);
  assert.equal((await send(q.terms, `${BASE}/orders/${ZERO32.slice(0, -1)}1/pay`)).status, 400);
  assert.equal((await send(q.terms, `${BASE}/orders/${q.orderId}/reorder`)).status, 400);
  clock += 601_000;
  assert.equal((await send(q.terms)).status, 410);
});

test('the payee must be what ENS resolves for the shop: otherwise 503 and no 402', async () => {
  let calls = 0;
  let clock = T0;
  let answer = async () => MERCHANT;
  const w = world({ payee: (name) => (calls++, answer(name)), clock: () => clock });
  const q = await quoteFor(w);
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 402);
  answer = async () => newAccount().address;
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 402, 'cached for 20 s');
  assert.equal(calls, 1);
  clock += 20_000;
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 503);
  assert.match(w.lines.at(-1), /payee mismatch/);
  clock += 20_000;
  answer = async () => {
    throw new Error('ENS down');
  };
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 503);
  assert.match(w.lines.at(-1), /payee unresolved/);
  clock += 20_000;
  answer = async () => null;
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 503);
  // T2's reader shape (packages/ens createEnsReader).
  clock += 20_000;
  answer = async () => ({ ok: false, reason: 'PAYEE_UNRESOLVED', detail: 'no address record' });
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 503);
  clock += 20_000;
  answer = async () => ({ ok: true, payee: MERCHANT, name: SHOP.ensName });
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 402);
  // A failed read is not cached: the next request asks again at once.
  clock += 20_000;
  answer = async () => ({ ok: false, reason: 'PAYEE_UNRESOLVED', detail: 'ENS_READ_FAILED' });
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 503);
  answer = async () => MERCHANT;
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 402, 'no wait after a failed read');
});

test('with a requestId the 402 step writes the quote first and carries its key; a failed write is 503', async () => {
  const writes = [];
  const requestId = keccak256(toHex('errand 1'));
  const w = world({ createQuote: async (qt) => (writes.push(qt), { entityKey: keccak256(toHex('quote key')) }) });
  const q = await quoteFor(w);
  const res = await post(w.handle, q.payUrl, { ...q.terms, requestId });
  assert.equal(res.status, 402);
  const [req] = (await res.json()).accepts;
  assert.equal(req.extra.quoteKey, keccak256(toHex('quote key')));
  assert.deepEqual(writes, [{ requestId, shopName: SHOP.ensName, agentEns: PAYER, priceMicro: BigInt(story.order.priceMicro), validUntil: q.validUntil }]);

  // Quote writes are bounded per instance.
  const many = world({ createQuote: async () => ({ entityKey: keccak256(toHex('k')) }) });
  const mq = await quoteFor(many);
  const statuses = [];
  for (let i = 0; i < 31; i++) statuses.push((await post(many.handle, mq.payUrl, { ...mq.terms, requestId })).status);
  assert.deepEqual([statuses.at(0), statuses.at(-1)], [402, 429]);

  const failing = world({ createQuote: async () => { throw new Error('nonce clash'); } });
  const fq = await quoteFor(failing);
  assert.equal((await post(failing.handle, fq.payUrl, { ...fq.terms, requestId })).status, 503);
  // A human payer's errand has no quote entity.
  const human = await quoteFor(w, { payer: '', wallet: newAccount().address });
  await post(w.handle, human.payUrl, { ...human.terms, requestId });
  assert.equal(writes.length, 1);
});

test('quote -> 402 -> sign -> 200 with PAYMENT-RESPONSE -> replay is alreadyPaid, nothing paid twice', async () => {
  const delivered = [];
  const w = world({ deliver: async (shopKey, orderId) => (delivered.push([shopKey, orderId]), 'delivered'), createQuote: async () => ({ entityKey: keccak256(toHex('k')) }) });
  const requestId = keccak256(toHex('errand 2'));
  const q = await quoteFor(w, { wallet: w.payerAccount.address });
  const r402 = await post(w.handle, q.payUrl, { ...q.terms, requestId });
  const paymentRequired = decodePaymentRequiredHeader(r402.headers.get('payment-required'));
  const { client, http } = payerClient(w.payerAccount);
  const payload = await client.createPaymentPayload(paymentRequired);
  const paid = await post(w.handle, q.payUrl, { ...q.terms, requestId }, { signature: http.encodePaymentSignatureHeader(payload) });
  assert.equal(paid.status, 200);
  const body = await paid.json();
  assert.equal(body.status, 'paid');
  assert.equal(body.orderId, q.orderId);
  assert.equal(body.delivery, 'delivered');
  const settlement = decodePaymentResponseHeader(paid.headers.get('payment-response'));
  assert.equal(settlement.success, true);
  assert.equal(settlement.transaction, body.transaction);
  assert.deepEqual(delivered, [[SHOP.key, q.orderId]]);
  assert.equal(w.chain.sends, 1);

  // The same signed payment again: the chain says paid, no money moves.
  const replay = await post(w.handle, q.payUrl, q.terms, { signature: http.encodePaymentSignatureHeader(payload) });
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { status: 'paid', alreadyPaid: true, orderId: q.orderId, chainStatus: 'PAID' });
  const again402 = await post(w.handle, q.payUrl, q.terms);
  assert.equal(again402.status, 200, 'a paid order offers no new 402');
  assert.equal(w.chain.sends, 1);
});

test('a quote for one wallet cannot be paid from another', async () => {
  const w = world();
  const q = await quoteFor(w, { wallet: newAccount().address });
  const r402 = await post(w.handle, q.payUrl, q.terms);
  const { client, http } = payerClient(w.payerAccount);
  const payload = await client.createPaymentPayload(decodePaymentRequiredHeader(r402.headers.get('payment-required')));
  const res = await post(w.handle, q.payUrl, q.terms, { signature: http.encodePaymentSignatureHeader(payload) });
  assert.equal(res.status, 400);
  assert.equal(w.chain.sends, 0);
});

test('a re-order follows a paid parent of the same buyer at the same shop', async () => {
  const w = world();
  const parent = await quoteFor(w);
  const rq = await quoteFor(w, { qty: String(story.order.reorder.quantity), parent: parent.orderId });
  assert.equal(rq.payUrl, `${BASE}/orders/${parent.orderId}/reorder`);
  assert.equal(rq.order.kind, '1');
  assert.equal(rq.order.parentOrderId, parent.orderId);
  assert.equal((await post(w.handle, rq.payUrl, rq.terms)).status, 409, 'the parent is not paid yet');
  w.orders.set(parent.orderId, { status: 2, termsHash: ZERO32, buyerNode: namehash('someone.else.graphpay.eth'), shopNode: namehash(SHOP.ensName) });
  assert.equal((await post(w.handle, rq.payUrl, rq.terms)).status, 409, 'another buyer');
  w.orders.set(parent.orderId, { status: 5, termsHash: ZERO32, buyerNode: namehash(BUYER), shopNode: namehash(SHOP.ensName) });
  const r = await post(w.handle, rq.payUrl, rq.terms);
  assert.equal(r.status, 402, 'a refunded parent may be re-ordered');
  const [req] = (await r.json()).accepts;
  assert.equal(req.amount, String(story.order.reorder.priceMicro));
  assert.equal((await post(w.handle, `${BASE}/orders/${rq.orderId}/pay`, rq.terms)).status, 400, 'a re-order is paid at its parent path');
});

test('cancelled orders and ids taken by other terms are 409', async () => {
  const w = world();
  const q = await quoteFor(w);
  w.orders.set(q.orderId, { status: 4, termsHash: ZERO32, buyerNode: ZERO32, shopNode: ZERO32 });
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 409);
  w.orders.set(q.orderId, { status: 1, termsHash: keccak256(toHex('other')), buyerNode: ZERO32, shopNode: ZERO32 });
  assert.equal((await post(w.handle, q.payUrl, q.terms)).status, 409);
});

async function signedFor(w, q) {
  const r402 = await post(w.handle, q.payUrl, q.terms);
  const pr = decodePaymentRequiredHeader(r402.headers.get('payment-required'));
  const { client, http } = payerClient(w.payerAccount);
  return http.encodePaymentSignatureHeader(await client.createPaymentPayload(pr));
}

test('a facilitator outage is 502 (retry is safe); refusals and failures are 402 with PAYMENT-RESPONSE', async () => {
  const base = world();
  const q = await quoteFor(base);
  const signature = await signedFor(base, q);

  const down = world({ facilitator: { verify: async () => { throw new Error('fetch failed https://facilitator/KEY'); }, settle: async () => ({}) } });
  const r502 = await post(down.handle, q.payUrl, q.terms, { signature });
  assert.equal(r502.status, 502);
  assert.deepEqual(down.lines, ['shop: facilitator verify unavailable (Error)']);
  const settleDown = world({ facilitator: { verify: async () => ({ isValid: true }), settle: async () => { throw new TypeError('x'); } } });
  assert.equal((await post(settleDown.handle, q.payUrl, q.terms, { signature })).status, 502);

  const refused = world({ facilitator: { verify: async () => ({ isValid: false, invalidReason: 'CAP_EXCEEDED' }), settle: async () => assert.fail('no settle after a refusal') } });
  const r = await post(refused.handle, q.payUrl, q.terms, { signature });
  assert.equal(r.status, 402);
  const s = decodePaymentResponseHeader(r.headers.get('payment-response'));
  assert.deepEqual([s.success, s.errorReason, s.transaction], [false, 'CAP_EXCEEDED', '']);

  const tx = `0x${'d'.repeat(64)}`;
  const failed = world({ facilitator: { verify: async () => ({ isValid: true }), settle: async () => ({ success: false, errorReason: 'AGENT_REVOKED', transaction: tx, network: NETWORK }) } });
  const f = await post(failed.handle, q.payUrl, q.terms, { signature });
  assert.equal(f.status, 402);
  assert.equal((await f.json()).status, 'failed');
  assert.equal(decodePaymentResponseHeader(f.headers.get('payment-response')).transaction, tx);

  const slow = world({ facilitator: { verify: async () => ({ isValid: true }), settle: async () => ({ success: false, errorReason: 'receipt_timeout', transaction: tx, network: NETWORK }) } });
  const p = await post(slow.handle, q.payUrl, q.terms, { signature });
  assert.equal(p.status, 504, 'not a 4xx: the agent must treat it as unsettled');
  assert.equal((await p.json()).status, 'pending');
  const busy = world({ facilitator: { verify: async () => ({ isValid: true }), settle: async () => ({ success: false, errorReason: 'in_flight', transaction: '', network: NETWORK }) } });
  assert.equal((await post(busy.handle, q.payUrl, q.terms, { signature })).status, 503);

  assert.equal((await post(base.handle, q.payUrl, q.terms, { signature: { 'PAYMENT-SIGNATURE': '%%%' } })).status, 400);
});

test('delivery: not configured, or pending when markDelivered fails', async () => {
  for (const [deliver, want] of [
    [undefined, 'not_configured'],
    [async () => { throw new Error('nonce'); }, 'pending'],
    [async () => 'pending', 'pending'],
  ]) {
    const w = world({ deliver });
    const q = await quoteFor(w, { wallet: w.payerAccount.address });
    const signature = await signedFor(w, q);
    const res = await post(w.handle, q.payUrl, q.terms, { signature });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).delivery, want);
  }
});

test('unknown routes are 404 and errors are one redacted line', async () => {
  const w = world();
  assert.equal((await w.handle(new Request(`${BASE}/admin`))).status, 404);
  assert.equal((await w.handle(new Request(`${BASE}/orders/0x12/pay`, { method: 'POST' }))).status, 404);
  const broken = shopHandler({
    shops: SHOPS,
    merchants: { [SHOP.key]: MERCHANT },
    chainId: CHAIN_ID,
    token: TOKEN,
    checkout: CHECKOUT,
    baseUrl: BASE,
    passcode: PASSCODE,
    facilitator: {},
    orders: { readOrder: async () => { throw new Error('https://rpc.example/KEY'); } },
    resolvePayee: async () => MERCHANT,
    log: (l) => w.lines.push(l),
    clock: () => T0,
  });
  const q = await quoteFor(w);
  const res = await post(broken, q.payUrl, q.terms);
  assert.equal(res.status, 500);
  assert.equal(w.lines.at(-1), 'shop: Error');
});
