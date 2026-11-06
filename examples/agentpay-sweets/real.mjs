// One tiny real test payment on Whitechain Sepolia with the sweet-shop example, labelled as a
// test: the rehearsal agent pays the good shop the story's operational test amount (never a
// story price) through the reference relayer, run with the second relayer key (RENEWER).
// Dry run by default (read-only checks and a quote); --yes signs and sends. Keys are read
// in-process by the env loader and never printed. Never during the hosted demo.
//   node examples/agentpay-sweets/real.mjs [--yes [--again]]
// One payment per example: with a line already in the tx log, --yes refuses unless --again.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { erc20Abi, formatEther } from 'viem';
import { config, story } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createReferenceRelayer, formatUsdt, readSpendingPass, whitechainNetwork } from '@graphpay_ethglobal/agentpay';
import { context } from '../../scripts/whitechain/lib.mjs';
import { shopName, sweetShop, sweetsBuyer } from './index.mjs';

const TXLOG = new URL('../../docs/sessions/agentpay/txlog.jsonl', import.meta.url);
const network = whitechainNetwork();
const ctx = await context(process.argv.slice(2));
if (ctx.fork) throw new Error('this script is for the real chain; the fork runs in the test suite');
const rehearsal = story.workingAgents.find((a) => a.key === 'rehearsal');
const agentName = `${rehearsal.label}.${story.persona.label}.${config.root.ens}`;
const shop = story.shops.find((s) => s.key === story.order.shop);
const amount = BigInt(story.agentpayExamples.testAmountMicro);

const payer = ctx.account(rehearsal.walletRole);
const relayerAccount = ctx.account('RENEWER');
const merchantAddress = ctx.account(shop.walletRole).address;
const { publicClient } = ctx;
const nowSec = Math.floor(Date.now() / 1000);

const [usdtBal, wbt, isRelayer, pass] = await Promise.all([
  publicClient.readContract({ address: network.token.address, abi: erc20Abi, functionName: 'balanceOf', args: [payer.address] }),
  publicClient.getBalance({ address: relayerAccount.address }),
  publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'isRelayer', args: [relayerAccount.address] }),
  readSpendingPass({ publicClient, network, name: agentName, wallet: payer.address, nowSec }),
]);
console.log(`payer ${agentName} ${payer.address}: ${formatUsdt(usdtBal)} USDT; pass active ${pass.active}, cap ${formatUsdt(pass.dailyCapMicro)}, spent today ${formatUsdt(pass.spentTodayMicro)}`);
console.log(`relayer RENEWER ${relayerAccount.address}: ${formatEther(wbt)} WBT, relayer role ${isRelayer}`);
console.log(`merchant ${shopName} ${merchantAddress}; test amount ${formatUsdt(amount)} USDT`);
if (!isRelayer || !pass.active || usdtBal < amount) throw new Error('not ready: see the lines above');

const facilitator = createReferenceRelayer({
  walletClient: ctx.walletClient(relayerAccount),
  publicClient,
  network,
  allowedMerchants: [merchantAddress],
  limits: { maxOrderMicro: amount, maxSettlesPerHour: 1, maxMicroPerHour: amount, minRelayerBalanceWei: 50_000_000_000_000_000n },
});
const { merchant, handler } = sweetShop({ address: merchantAddress, facilitator, publicClient, priceMicro: amount });
merchant.on('paid', ({ order, explorer }) => console.log(`merchant event paid: ${order.orderId} ${explorer}`));
const buyer = sweetsBuyer({ account: payer, publicClient, name: agentName, fetch: (url, init) => handler(new Request(url, init)) });
const url = `${config.site.url}/agentpay-test/sweets`; // never fetched: the route runs in this process

const q = await buyer.quote(url);
await buyer.check(q.order);
console.log(`quote: order ${q.order.orderId}, ${formatUsdt(q.order.totalMicro)} USDT, guards pass`);
if (!ctx.send) {
  console.log('dry run: nothing signed or sent (add --yes)');
  process.exit(0);
}
const earlier = existsSync(TXLOG) ? readFileSync(TXLOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.example === 'agentpay-sweets') : [];
const last = earlier.at(-1);
if (last && last.status !== 'paid' && last.orderId) {
  const o = await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'orders', args: [last.orderId] });
  throw new Error(`the last run ended ${last.status}; order ${last.orderId} is status ${Number(o.status)} on-chain: settle that first, never pay again blindly`);
}
if (last && !process.argv.includes('--again')) throw new Error('a test payment is already logged; add --again for another one');
// Log the order before paying, so a crash still leaves a record of what may settle.
appendFileSync(TXLOG, `${JSON.stringify({ at: new Date().toISOString(), example: 'agentpay-sweets', status: 'signing', note: 'quoted order; the paid line follows' })}\n`);
const r = await buyer.pay(url);
const record = { at: new Date().toISOString(), example: 'agentpay-sweets', label: 'AgentPay SDK test payment (testnet, synthetic)', status: r.status, orderId: r.orderId, amountMicro: String(r.amountMicro), payer: agentName, merchant: shopName, transaction: r.transaction, explorer: r.transaction ? `${network.explorer}/tx/${r.transaction}` : undefined, reason: r.reason };
appendFileSync(TXLOG, `${JSON.stringify(record)}\n`);
console.log(JSON.stringify(record, null, 2));
