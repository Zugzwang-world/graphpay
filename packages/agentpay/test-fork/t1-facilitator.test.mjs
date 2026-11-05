// A4: the AgentPay merchant settling through GraphPay's own x402 facilitator (T1, M3 part A,
// `@graphpay/facilitator`) instead of the reference relayer, on an anvil fork of Whitechain
// Sepolia against the deployed GraphPayCheckout, the real test USDT and Permit2. Both adapters:
// inProcessFacilitator over an @x402/core x402Facilitator, and httpFacilitator over T1's
// Fetch-API handler on a loopback port. Only T1's public exports are used.
// T1's ENS gate is a stub here (the fork has no ENS): it answers the name's node and the
// pass's on-chain epoch, as T2's gate does for an active agent.
//   pnpm --filter @graphpay/agentpay test:fork

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { namehash } from 'viem';
import { x402Facilitator } from '@x402/core/facilitator';
import { config, disposableEntry, story } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createGraphPayFacilitator, facilitatorHandler, readiness, startupChecks, viemChain } from '@graphpay/facilitator';
import { FacilitatorUnavailable, createBuyerAgent, createMerchant, httpFacilitator, inProcessFacilitator, issueSpendingPass } from '../index.mjs';
import { toFetchRequest, sendFetchResponse } from '../src/merchant.mjs';
import { chainClock, listen, network, startFork } from './helpers.mjs';

const shop = story.shops.find((s) => s.key === story.order.shop);
const product = shop.products.find((p) => p.sku === story.order.sku);
const merchantName = `${shop.label}.${config.root.ens}`;
const agent = disposableEntry(9000 + Math.floor(Math.random() * 900));
// A test pass cap for three payments of the story's order item (the story budget fits one).
const dailyCap = BigInt(product.priceMicro) * 4n;
const authToken = randomBytes(24).toString('hex'); // this run only, never printed

let fork, clock, relayerAccount, buyerAccount, merchantAccount, scheme, facilitator, fServer, buyer;
const recorded = [];
const servers = [];

before(async () => {
  fork = await startFork();
  clock = chainClock();
  await clock.sync(fork);
  const writerAccount = fork.newAccount();
  [relayerAccount, buyerAccount, merchantAccount] = [fork.newAccount(), fork.newAccount(), fork.newAccount()];
  await fork.grantRoles({ relayer: relayerAccount.address, policyWriter: writerAccount.address });
  // T1 keeps a 0.3 WBT floor under the relayer's balance.
  await fork.setBalance(relayerAccount.address, 2);
  await fork.setBalance(writerAccount.address, 1);
  await fork.giveUsdt(buyerAccount.address, dailyCap);
  await issueSpendingPass({ walletClient: fork.wallet(writerAccount), publicClient: fork.publicClient, network, name: agent.ensName, wallet: buyerAccount.address, dailyCapMicro: dailyCap });

  const token = { address: network.token.address, eip712: network.token.eip712 };
  const node = namehash(agent.ensName);
  scheme = createGraphPayFacilitator({
    chainId: network.chainId,
    token,
    permit2: network.permit2,
    checkout: network.checkout,
    allowedMerchants: [merchantAccount.address],
    chain: viemChain({ publicClient: fork.publicClient, walletClient: fork.wallet(relayerAccount), account: relayerAccount, checkout: network.checkout, token, permit2: network.permit2, chain: fork.chain }),
    ensGate: async (name) => {
      const policy = await fork.publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'policies', args: [namehash(name)] });
      return { ok: name === agent.ensName, node: namehash(name), epoch: Number(policy.epoch) };
    },
    recorder: { refused: async (r) => recorded.push(r) },
    clock: clock.now,
  });
  assert.equal((await fork.publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'nodeOfWallet', args: [buyerAccount.address] })).toLowerCase(), node);
  facilitator = new x402Facilitator().register(network.caip2, scheme);
  const checks = readiness(() => startupChecks({ publicClient: fork.publicClient, chainId: network.chainId, checkout: network.checkout, token }));
  const handle = facilitatorHandler({
    facilitator,
    scheme,
    authToken,
    ready: checks,
    health: async () => ({ signer: relayerAccount.address }),
    log: () => {},
  });
  fServer = await listen(async (req, res) => sendFetchResponse(res, await handle(await toFetchRequest(req))));

  buyer = createBuyerAgent({ account: buyerAccount, publicClient: fork.publicClient, network, name: agent.ensName, pass: { capMicro: dailyCap, period: 'day', merchants: [merchantName] }, clock: clock.now });
});

after(async () => {
  for (const s of servers) await s.close();
  await fServer?.close();
  fork?.stop();
});

// A merchant route selling the story's order item, settled through the given facilitator.
async function shopThrough(f) {
  const merchant = createMerchant({ name: merchantName, address: merchantAccount.address, facilitator: f, publicClient: fork.publicClient, network, clock: clock.now });
  const pricer = () => ({ items: [{ sku: product.sku, name: product.name, quantity: 1, unitPriceMicro: product.priceMicro }], fulfilment: { type: 'pickup' } });
  const s = await listen(merchant.node(pricer, (_req, { order }) => ({ ok: true, orderId: order.orderId })));
  servers.push(s);
  return s;
}

async function assertPaid(r, before) {
  assert.equal(r.status, 'paid', `not paid: ${r.reason}`);
  assert.match(r.transaction, /^0x[0-9a-f]{64}$/);
  const o = await fork.publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'orders', args: [r.orderId] });
  assert.equal(Number(o.status), 2); // PAID
  assert.equal((await fork.usdtBalance(merchantAccount.address)) - before, BigInt(product.priceMicro));
  assert.equal(await fork.publicClient.getBalance({ address: buyerAccount.address }), 0n);
  const receipt = await fork.publicClient.getTransactionReceipt({ hash: r.transaction });
  assert.equal(receipt.from.toLowerCase(), relayerAccount.address.toLowerCase(), 'T1 relayer sent it');
}

test('in process: a gasless buyer pays the SDK merchant through T1\'s pipeline', async () => {
  const s = await shopThrough(inProcessFacilitator(facilitator));
  const before = await fork.usdtBalance(merchantAccount.address);
  await assertPaid(await buyer.pay(`${s.url}/order`), before);
});

test('over HTTP: the same through T1\'s facilitator handler and httpFacilitator', async () => {
  const f = httpFacilitator({ url: `${fServer.url}/api/facilitator`, authToken });
  const supported = await f.supported();
  assert.ok(supported.kinds.some((k) => k.scheme === 'graphpay-order' && k.network === network.caip2));
  const s = await shopThrough(f);
  const before = await fork.usdtBalance(merchantAccount.address);
  await assertPaid(await buyer.pay(`${s.url}/order`), before);
  assert.equal(scheme.stats().queued, 0);
});

test('a wrong bearer token is refused by T1 and nothing is sent', async () => {
  const f = httpFacilitator({ url: `${fServer.url}/api/facilitator`, authToken: randomBytes(24).toString('hex') });
  await assert.rejects(f.verify({}, {}), FacilitatorUnavailable);
  const s = await shopThrough(f);
  const nonce = await fork.publicClient.getTransactionCount({ address: relayerAccount.address });
  const r = await buyer.pay(`${s.url}/order`).catch((e) => ({ status: 'error', reason: e.code ?? e.name }));
  // The merchant answers 502: its facilitator is unavailable, so the buyer is not charged.
  assert.notEqual(r.status, 'paid');
  assert.equal(r.response?.status, 502);
  assert.equal(await fork.publicClient.getTransactionCount({ address: relayerAccount.address }), nonce);
});

test('T1 refuses an agent its ENS gate refuses, fails closed before any send', async () => {
  const other = disposableEntry(9900 + Math.floor(Math.random() * 99));
  const account = fork.newAccount();
  await fork.giveUsdt(account.address, BigInt(product.priceMicro));
  const writer = fork.newAccount();
  await fork.grantRoles({ policyWriter: writer.address });
  await fork.setBalance(writer.address, 1);
  await issueSpendingPass({ walletClient: fork.wallet(writer), publicClient: fork.publicClient, network, name: other.ensName, wallet: account.address, dailyCapMicro: dailyCap });
  const stranger = createBuyerAgent({ account, publicClient: fork.publicClient, network, name: other.ensName, pass: { capMicro: dailyCap, period: 'day', merchants: [merchantName] }, clock: clock.now });
  const s = await shopThrough(inProcessFacilitator(facilitator));
  const nonce = await fork.publicClient.getTransactionCount({ address: relayerAccount.address });
  const r = await stranger.pay(`${s.url}/order`);
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'ENS_READ_FAILED');
  assert.equal(await fork.publicClient.getTransactionCount({ address: relayerAccount.address }), nonce);
});
