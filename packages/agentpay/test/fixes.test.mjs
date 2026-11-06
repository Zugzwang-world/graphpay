// The 1.0.0 review's fixes that need no chain: a node:http merchant answers a request it cannot
// read instead of crashing, a payment that settled after an `unknown` answer leaves the buyer's
// pending ledger, and the relayer's limits refuse a name they do not define.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { config, story } from '@graphpay/config';
import { createBuyerAgent, createMandate, createMerchant, nodeOf, resolveLimits, whitechainNetwork } from '../index.mjs';
import { fakeChain, fakeFacilitator, givePass } from './fakes.mjs';

const network = whitechainNetwork();
const shop = story.shops.find((s) => s.key === story.order.shop);
const product = shop.products[0];
const merchantName = `${shop.label}.${config.root.ens}`;
const agentName = `${story.workingAgents[0].label}.${story.persona.label}.${config.root.ens}`;
const pricer = () => ({ items: [{ sku: product.sku, name: product.name, quantity: 1, unitPriceMicro: product.priceMicro }], fulfilment: { type: 'delivery' } });

// A Node response that records what the listener sent.
function fakeResponse() {
  const res = { statusCode: 0, headers: {}, body: null };
  res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
  res.end = (b) => (res.body = b ? Buffer.from(b).toString('utf8') : '');
  return res;
}

test('a node:http merchant answers 400 and 413 to requests it cannot read, and keeps running', async () => {
  const chain = fakeChain();
  const merchant = createMerchant({ name: merchantName, address: privateKeyToAccount(generatePrivateKey()).address, facilitator: fakeFacilitator(), publicClient: chain.publicClient, network });
  const listener = merchant.node(pricer, () => ({ ok: true }));
  const badHost = fakeResponse();
  await listener({ method: 'GET', url: '/order', headers: { host: 'not a host:99999' }, socket: {} }, badHost);
  assert.equal(badHost.statusCode, 400);
  const big = fakeResponse();
  const body = (async function* () {
    for (let i = 0; i < 3; i += 1) yield Buffer.alloc(30 * 1024);
  })();
  await listener(Object.assign(body, { method: 'POST', url: '/order', headers: { host: 'shop.test' }, socket: {} }), big);
  assert.equal(big.statusCode, 413);
  const fine = fakeResponse();
  await listener({ method: 'GET', url: '/order', headers: { host: 'shop.test' }, socket: {} }, fine);
  assert.equal(fine.statusCode, 402);
});

test('a payment that settled after an unknown answer leaves the pending ledger once its deadline passes', async () => {
  const chain = fakeChain();
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  const merchantAccount = privateKeyToAccount(generatePrivateKey());
  const price = BigInt(product.priceMicro);
  givePass(chain.state, { node: nodeOf(agentName), wallet: buyerAccount.address, dailyCapMicro: price * 2n + 1n });
  let now = 1_800_000_000_000;
  // The facilitator settles but the answer is lost: the buyer sees a 5xx and keeps the payment pending.
  const facilitator = fakeFacilitator();
  let lose = true;
  const merchant = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator, publicClient: chain.publicClient, network, clock: () => now });
  const route = merchant.route(pricer, (_r, { order }) => ({ ok: true, orderId: order.orderId }));
  const fetchImpl = async (url, init) => {
    const response = await route(new Request(url, init));
    return lose && init?.headers && new Headers(init.headers).has('payment-signature') ? new Response('lost', { status: 504 }) : response;
  };
  const buyer = createBuyerAgent({ account: buyerAccount, publicClient: chain.publicClient, network, name: agentName, pass: { capMicro: price * 10n, period: 'day' }, fetch: fetchImpl, clock: () => now });
  const first = await buyer.pay('https://shop.test/first');
  assert.equal(first.status, 'unknown');
  assert.equal((await buyer.passStatus()).pendingMicro, price);
  // The chain has it: paid, and counted in today's spend.
  chain.state.orders.set(first.orderId, { ...(await chain.publicClient.readContract({ functionName: 'orders', args: [first.orderId] })), status: 2, amountMicro: price });
  chain.state.spent.set(nodeOf(agentName), price);
  lose = false;
  now += 15 * 60_000; // past the first order's deadline
  const second = await buyer.pay('https://shop.test/second');
  assert.equal(second.status, 'paid', second.reason);
  assert.equal((await buyer.passStatus()).pendingMicro, 0n);
});

test('retrying an unknown payment after its deadline returns the same paid order, and pays nothing twice', async () => {
  const chain = fakeChain();
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  const price = BigInt(product.priceMicro);
  givePass(chain.state, { node: nodeOf(agentName), wallet: buyerAccount.address, dailyCapMicro: price * 3n });
  let now = 1_800_000_000_000;
  const facilitator = fakeFacilitator();
  let lose = true;
  const merchant = createMerchant({ name: merchantName, address: privateKeyToAccount(generatePrivateKey()).address, facilitator, publicClient: chain.publicClient, network, clock: () => now });
  const route = merchant.route(pricer, (_r, { order }) => ({ ok: true, orderId: order.orderId }));
  const fetchImpl = async (url, init) => {
    const response = await route(new Request(url, init));
    return lose && init?.headers && new Headers(init.headers).has('payment-signature') ? new Response('lost', { status: 504 }) : response;
  };
  const buyer = createBuyerAgent({ account: buyerAccount, publicClient: chain.publicClient, network, name: agentName, pass: { capMicro: price * 10n, period: 'day' }, fetch: fetchImpl, clock: () => now });
  const first = await buyer.pay('https://shop.test/order');
  assert.equal(first.status, 'unknown');
  chain.state.orders.set(first.orderId, { ...(await chain.publicClient.readContract({ functionName: 'orders', args: [first.orderId] })), status: 2, amountMicro: price });
  chain.state.spent.set(nodeOf(agentName), price);
  lose = false;
  now += 15 * 60_000; // past the order's deadline, as the retry advice allows
  const again = await buyer.pay('https://shop.test/order');
  assert.equal(again.status, 'paid');
  assert.equal(again.orderId, first.orderId);
  assert.equal(facilitator.calls.filter((c) => c[0] === 'settle').length, 1);
  assert.equal((await buyer.passStatus()).pendingMicro, 0n);
});

test('two refunds at once cannot add up past the per-order refund limit', async () => {
  const chain = fakeChain();
  const merchantAccount = privateKeyToAccount(generatePrivateKey());
  const orderId = `0x${'12'.repeat(32)}`;
  const sent = [];
  const merchant = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: fakeFacilitator(), publicClient: { ...chain.publicClient, waitForTransactionReceipt: async () => ({ status: 'success', gasUsed: 1n }) }, network, maxRefundMicro: 1_000_000n,
    walletClient: {
      account: merchantAccount,
      getChainId: async () => network.chainId,
      // The refund lands at once: the order shows it before the next read.
      writeContract: async ({ functionName, args }) => {
        sent.push([functionName, args[1]]);
        const o = chain.state.orders.get(orderId);
        chain.state.orders.set(orderId, { ...o, refundedMicro: o.refundedMicro + args[1] });
        return `0x${'ef'.repeat(32)}`;
      },
    },
  });
  chain.state.orders.set(orderId, { termsHash: `0x${'00'.repeat(32)}`, buyerNode: `0x${'00'.repeat(32)}`, shopNode: nodeOf(merchantName), merchant: merchantAccount.address, amountMicro: 4_800_000n, kind: 0, status: 2, dispute: 0, disputeReason: 0, payer: merchantAccount.address, refundedMicro: 0n });
  const both = await Promise.allSettled([merchant.refund(orderId, 900_000n), merchant.refund(orderId, 900_000n)]);
  assert.deepEqual(both.map((x) => x.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(both.find((x) => x.status === 'rejected').reason.code, 'OVER_REFUND_MAX');
  assert.deepEqual(sent, [['refund', 900_000n]]);
});

// A subscription plan offered by a real merchant handler, a facilitator that answers as told, and
// a chain that also answers the Permit2 allowance and the subscription reads signing needs.
function subscriptionRig({ subscribeAnswer, mandate, maxCycles = 4, onchainSub = { status: 0, cycle: 0 } }) {
  const chain = fakeChain();
  const permit2 = network.permit2.toLowerCase();
  const publicClient = {
    ...chain.publicClient,
    readContract: async (c) => {
      if (c.functionName === 'allowance' && String(c.address).toLowerCase() === permit2) return [0n, 0, 0n];
      if (c.functionName === 'subscription') return onchainSub;
      return chain.publicClient.readContract(c);
    },
  };
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  givePass(chain.state, { node: nodeOf(agentName), wallet: buyerAccount.address, dailyCapMicro: 100_000_000n });
  const facilitator = { ...fakeFacilitator(), subscribe: async () => subscribeAnswer };
  const merchant = createMerchant({ name: merchantName, address: privateKeyToAccount(generatePrivateKey()).address, facilitator, publicClient, network });
  const plan = merchant.subscriptions({ id: 'weekly-box', amountMicro: 2_000_000n, periodSeconds: 7 * 86_400, maxCycles });
  const buyer = createBuyerAgent({ account: buyerAccount, publicClient, network, name: agentName, pass: { capMicro: 100_000_000n, period: 'month' }, mandate, fetch: (url, init) => plan(new Request(url, init)) });
  return { buyer };
}
const deadlineMs = () => Date.now() + 365 * 86_400_000;

test('a subscription charge whose outcome is unknown stays counted; a definite refusal releases it', async () => {
  const uncertain = subscriptionRig({ subscribeAnswer: { success: false, errorReason: 'pending' }, mandate: createMandate({ budgetMicro: 20_000_000n, deadlineMs: deadlineMs() }) });
  const r1 = await uncertain.buyer.subscribe({ url: 'https://shop.test/plan' });
  assert.equal(r1.httpStatus, 402);
  assert.equal((await uncertain.buyer.passStatus()).mandate.spentMicro, 2_000_000n);
  const refused = subscriptionRig({ subscribeAnswer: { success: false, errorReason: 'SPEND_CAP' }, mandate: createMandate({ budgetMicro: 20_000_000n, deadlineMs: deadlineMs() }) });
  const r2 = await refused.buyer.subscribe({ url: 'https://shop.test/plan' });
  assert.equal(r2.httpStatus, 402);
  assert.equal((await refused.buyer.passStatus()).mandate.spentMicro, 0n);
  const charged = subscriptionRig({ subscribeAnswer: { success: true, charged: true, transaction: `0x${'ab'.repeat(32)}` }, mandate: createMandate({ budgetMicro: 20_000_000n, deadlineMs: deadlineMs() }) });
  const r3 = await charged.buyer.subscribe({ url: 'https://shop.test/plan' });
  assert.equal(r3.httpStatus, 201);
  assert.equal((await charged.buyer.passStatus()).mandate.spentMicro, 2_000_000n);
});

test('under a mandate, every cycle the signature allows must fit its budget and its deadline', async () => {
  const tight = subscriptionRig({ subscribeAnswer: { success: true, charged: true }, mandate: createMandate({ budgetMicro: 7_000_000n, deadlineMs: deadlineMs() }) });
  await assert.rejects(tight.buyer.subscribe({ url: 'https://shop.test/plan' }), (e) => e.code === 'OVER_BUDGET');
  const soon = subscriptionRig({ subscribeAnswer: { success: true, charged: true }, mandate: createMandate({ budgetMicro: 20_000_000n, deadlineMs: Date.now() + 86_400_000 }) });
  await assert.rejects(soon.buyer.subscribe({ url: 'https://shop.test/plan' }), (e) => e.code === 'MANDATE_EXPIRED');
});

test('the relayer limits refuse a name they do not define, even one every object inherits', () => {
  for (const name of ['toString', 'constructor', '__proto__', 'maxOrdersPerYear']) assert.throws(() => resolveLimits({ [name]: 5 }), /unknown limit/, name);
});
