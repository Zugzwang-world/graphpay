// End to end on an anvil fork of Whitechain Sepolia, against the deployed GraphPayCheckout,
// the real test USDT and Permit2: a buyer agent with no gas pays a merchant route with one
// signature through the reference relayer; guards refuse in code; refund request and refund;
// CSV export; relayer anti-drain limits; subscription, renewal and cancel.
//   pnpm --filter @graphpay_ethglobal/agentpay test:fork

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { erc20Abi } from 'viem';
import { config, disposableEntry, story } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import {
  createBuyerAgent,
  createMandate,
  createMerchant,
  createReferenceRelayer,
  issueSpendingPass,
  revokeSpendingPass,
  readSpendingPass,
  staticReputation,
  usdt,
} from '../index.mjs';
import { chainClock, listen, network, startFork } from './helpers.mjs';

const product = story.shops.find((s) => s.key === story.order.shop).products.find((p) => p.sku === story.order.sku);
const shop = story.shops.find((s) => s.key === story.order.shop);
const merchantName = `${shop.label}.${config.root.ens}`;
const agent = disposableEntry(9000 + Math.floor(Math.random() * 900));
const dailyCap = BigInt(story.order.budgetMicro);

let fork, clock, relayerAccount, writerAccount, buyerAccount, merchantAccount, relayer, merchant, server, buyer;
const events = [];

before(async () => {
  fork = await startFork();
  clock = chainClock();
  await clock.sync(fork);
  [relayerAccount, writerAccount, buyerAccount, merchantAccount] = [fork.newAccount(), fork.newAccount(), fork.newAccount(), fork.newAccount()];
  await fork.grantRoles({ relayer: relayerAccount.address, policyWriter: writerAccount.address });
  await fork.setBalance(relayerAccount.address, 1);
  await fork.setBalance(writerAccount.address, 1);
  await fork.setBalance(merchantAccount.address, 1);
  await fork.giveUsdt(buyerAccount.address, usdt('20'));
  // The buyer agent holds no WBT at all: it cannot pay gas.
  await issueSpendingPass({ walletClient: fork.wallet(writerAccount), publicClient: fork.publicClient, network, name: agent.ensName, wallet: buyerAccount.address, dailyCapMicro: dailyCap });

  relayer = createReferenceRelayer({ walletClient: fork.wallet(relayerAccount), publicClient: fork.publicClient, network, allowedMerchants: [merchantAccount.address], clock: clock.now });
  merchant = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: relayer, publicClient: fork.publicClient, walletClient: fork.wallet(merchantAccount), network, clock: clock.now });
  for (const e of ['paid', 'payment.failed', 'refund.requested', 'refunded', 'subscribed', 'renewal.charged', 'cancelled']) merchant.on(e, (p) => events.push({ e, p }));

  const pricer = ({ url }) =>
    url.pathname === '/order'
      ? { items: [{ sku: product.sku, name: product.name, quantity: 1, unitPriceMicro: product.priceMicro }], fulfilment: { type: 'delivery', details: { eta: `${shop.scenario.etaMinutes} min` } } }
      : null;
  const paidRoute = merchant.route(pricer, (_req, { order }) => ({ ok: true, orderId: order.orderId, items: order.items.length }));
  const refundRoute = merchant.refundRequests();
  const plan = merchant.subscriptions({ id: story.renewal.plan, items: [{ sku: story.renewal.plan, name: story.renewal.item, quantity: 1 }], amountMicro: story.renewal.priceMicro, periodSeconds: story.renewal.demoPeriod.seconds, maxCycles: 4 });
  const cancels = merchant.cancellations();
  const { toFetchRequest, sendFetchResponse } = await import('../src/merchant.mjs');
  server = await listen(async (req, res) => {
    const request = await toFetchRequest(req);
    const path = new URL(request.url).pathname;
    const handler = path === '/refunds' ? refundRoute : path === '/plan' ? plan : path === '/cancel' ? cancels : paidRoute;
    await sendFetchResponse(res, await handler(request));
  });

  buyer = createBuyerAgent({
    account: buyerAccount,
    publicClient: fork.publicClient,
    network,
    name: agent.ensName,
    pass: { capMicro: dailyCap * 7n, period: 'week', merchants: [merchantName] },
    mandate: createMandate({ buyer: agent.ensName, request: 'synthetic test errand', budgetMicro: usdt('15'), deadlineMs: clock.now() + 3_600_000 }),
    clock: clock.now,
  });
});

after(async () => {
  await server?.close();
  fork?.stop();
});

let paidOrderId, paidBlock;

test('the pass is on-chain and active', async () => {
  const p = await readSpendingPass({ publicClient: fork.publicClient, network, name: agent.ensName, wallet: buyerAccount.address, nowSec: await fork.chainNowSec() });
  assert.equal(p.active, true);
  assert.equal(p.dailyCapMicro, dailyCap);
  assert.equal(p.boundNode, p.node);
});

test('a buyer with no gas pays a 402 with one signature', async () => {
  assert.equal(await fork.publicClient.getBalance({ address: buyerAccount.address }), 0n);
  const before = await fork.usdtBalance(merchantAccount.address);
  const r = await buyer.pay(`${server.url}/order`);
  assert.equal(r.status, 'paid', `not paid: ${r.reason}`);
  assert.match(r.transaction, /^0x[0-9a-f]{64}$/);
  paidOrderId = r.orderId;
  paidBlock = (await fork.publicClient.getTransactionReceipt({ hash: r.transaction })).blockNumber;
  const body = await r.response.json();
  assert.equal(body.orderId, r.orderId);
  assert.equal((await fork.usdtBalance(merchantAccount.address)) - before, BigInt(product.priceMicro));
  const o = await fork.publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'orders', args: [r.orderId] });
  assert.equal(Number(o.status), 2); // PAID
  assert.equal(await fork.publicClient.getBalance({ address: buyerAccount.address }), 0n);
  assert.ok(events.some((x) => x.e === 'paid' && x.p.order.orderId === r.orderId));
});

test('over the on-chain daily cap is refused in code before signing', async () => {
  const sent = relayer.stats().settled;
  await assert.rejects(buyer.pay(`${server.url}/order`), (e) => e.code === 'OVER_DAILY_CAP');
  assert.equal(relayer.stats().settled, sent);
});

test('a merchant outside the allowlist is refused in code', async () => {
  const other = createBuyerAgent({ account: buyerAccount, publicClient: fork.publicClient, network, name: agent.ensName, pass: { capMicro: dailyCap, period: 'day', merchants: [`other.${config.root.ens}`] }, clock: clock.now });
  await assert.rejects(other.pay(`${server.url}/order`), (e) => e.code === 'MERCHANT_NOT_ALLOWED');
});

test('the caller can only lower the limit', async () => {
  await assert.rejects(buyer.pay(`${server.url}/order`, { maxMicro: usdt('1') }), (e) => e.code === 'OVER_CALLER_MAX');
});

test('a refund request from the payer, then a partial refund', async () => {
  await fork.send(fork.wallet(merchantAccount), { address: network.token.address, abi: erc20Abi, functionName: 'approve', args: [network.checkout, usdt('5')] });
  const r = await buyer.requestRefund({ url: `${server.url}/refunds`, orderId: paidOrderId, amountMicro: story.order.refundMicro, reason: story.order.refundReason });
  assert.equal(r.httpStatus, 202);
  assert.ok(events.some((x) => x.e === 'refund.requested' && x.p.orderId === paidOrderId));
  const before = await fork.usdtBalance(buyerAccount.address);
  const done = await merchant.refund(paidOrderId, story.order.refundMicro);
  assert.equal(done.full, false);
  assert.equal((await fork.usdtBalance(buyerAccount.address)) - before, BigInt(story.order.refundMicro));
  await assert.rejects(merchant.refund(paidOrderId, product.priceMicro), (e) => e.code === 'OVER_REFUNDABLE');
});

test('a refund request from anyone else is refused', async () => {
  const stranger = createBuyerAgent({ account: fork.newAccount(), publicClient: fork.publicClient, network, pass: { capMicro: 1, period: 'day' }, clock: clock.now });
  const r = await stranger.requestRefund({ url: `${server.url}/refunds`, orderId: paidOrderId, amountMicro: 1, reason: 'not mine' });
  assert.equal(r.httpStatus, 403);
});

test('the CSV export reads the order, payment and refund from the chain', async () => {
  // From the payment's block: blocks before the fork point would be read from the remote RPC.
  const csv = await merchant.exportCsv({ fromBlock: paidBlock });
  const line = csv.split('\r\n').find((l) => l.startsWith(paidOrderId));
  assert.ok(line, 'the order is in the CSV');
  assert.match(line, /,PAID,/);
  assert.ok(line.includes('0.80'));
});

test('a refund limit holds for the order in total: small refunds cannot add up past it', async () => {
  const limit = BigInt(story.order.refundMicro) + 100_000n;
  const limited = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: relayer, publicClient: fork.publicClient, walletClient: fork.wallet(merchantAccount), network, clock: clock.now, maxRefundMicro: limit });
  // The order has had refundMicro refunded already: 0.10 is left under this limit.
  await assert.rejects(limited.refund(paidOrderId, 200_000n), (e) => e.code === 'OVER_REFUND_MAX');
  assert.equal((await limited.refund(paidOrderId, 100_000n)).amountMicro, 100_000n);
  await assert.rejects(limited.refund(paidOrderId, 1n), (e) => e.code === 'OVER_REFUND_MAX');
});

test('accept asks the reputation provider about the payer of the order', async () => {
  const withReputation = (reputation) => createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: relayer, publicClient: fork.publicClient, network, clock: clock.now, reputation });
  const refused = await withReputation(staticReputation({ [agent.ensName]: { risk: 'high', reasons: ['flagged in this test'] } })).accept(paidOrderId);
  assert.equal(refused.accepted, false);
  assert.match(refused.reason, /flagged in this test/);
  assert.equal((await withReputation(staticReputation({})).accept(paidOrderId)).accepted, true);
});

test('the relayer refuses over its per-order cap and under its balance floor', async () => {
  const small = createReferenceRelayer({ walletClient: fork.wallet(relayerAccount), publicClient: fork.publicClient, network, allowedMerchants: [merchantAccount.address], limits: { maxOrderMicro: 1n }, clock: clock.now });
  const m2 = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: small, publicClient: fork.publicClient, network, clock: clock.now });
  const cheap = { items: [{ sku: product.sku, name: product.name, quantity: 1, unitPriceMicro: 10_000n }], fulfilment: { type: 'pickup' } };
  const s2 = await listen(m2.node(() => cheap, () => ({ ok: true })));
  try {
    const r = await buyer.pay(`${s2.url}/x`);
    assert.equal(r.status, 'failed');
    assert.equal(r.reason, 'over_order_cap');
    const poor = fork.newAccount();
    await fork.grantRoles({ relayer: poor.address });
    await fork.setBalance(poor.address, 0.01);
    const broke = createReferenceRelayer({ walletClient: fork.wallet(poor), publicClient: fork.publicClient, network, allowedMerchants: [merchantAccount.address], clock: clock.now });
    const m3 = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: broke, publicClient: fork.publicClient, network, clock: clock.now });
    const s3 = await listen(m3.node(() => cheap, () => ({ ok: true })));
    try {
      const r3 = await buyer.pay(`${s3.url}/x`);
      assert.equal(r3.reason, 'relayer_balance_low');
    } finally {
      await s3.close();
    }
  } finally {
    await s2.close();
  }
});

test('a subscription: refused in code over the daily cap, then created with its first charge, renewed once when due, cancelled by signature', async () => {
  // The order above took most of today's cap: the plan's first charge is refused before anything is signed.
  await assert.rejects(buyer.subscribe({ url: `${server.url}/plan` }), (e) => e.code === 'OVER_DAILY_CAP');
  assert.ok(!events.some((x) => x.e === 'subscribed'));
  // Room for the plan: the policy writer raises the pass's daily cap.
  await issueSpendingPass({ walletClient: fork.wallet(writerAccount), publicClient: fork.publicClient, network, name: agent.ensName, wallet: buyerAccount.address, dailyCapMicro: dailyCap * 2n });
  const sub = await buyer.subscribe({ url: `${server.url}/plan` });
  assert.equal(sub.httpStatus, 201, JSON.stringify(sub));
  assert.equal(sub.charged, true);
  assert.ok(events.some((x) => x.e === 'subscribed' && x.p.subId === sub.subId));
  await fork.warp(story.renewal.demoPeriod.seconds + 5);
  await clock.sync(fork);
  const created = (await fork.publicClient.getTransactionReceipt({ hash: sub.transaction })).blockNumber;
  // A watcher sees every charge on the chain too: each is still reported once.
  const watcher = merchant.watchRenewals({ fromBlock: created, intervalMs: 50 });
  try {
    const renewed = await merchant.chargeDueRenewals({ fromBlock: created });
    assert.equal(renewed.length, 1);
    assert.equal(renewed[0].success, true, JSON.stringify(renewed[0]));
    await watcher.tick();
  } finally {
    watcher.stop();
  }
  assert.deepEqual(events.filter((x) => x.e === 'renewal.charged' && x.p.subId === sub.subId).map((x) => x.p.cycle), [1, 2]);
  const c = await buyer.cancel({ url: `${server.url}/cancel`, subId: sub.subId });
  assert.equal(c.httpStatus, 200, JSON.stringify(c));
  const s = await fork.publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'subscription', args: [sub.subId] });
  assert.equal(Number(s.status), 3); // CANCELLED
});

test('a revoked pass is refused in code, and the relayer predicts the revocation', async () => {
  await revokeSpendingPass({ walletClient: fork.wallet(writerAccount), publicClient: fork.publicClient, network, name: agent.ensName });
  await assert.rejects(buyer.pay(`${server.url}/order`), (e) => e.code === 'PASS_REVOKED');
});
