// node scripts/whitechain/subscription.mjs demo|create|renew|cancel [--sub <subId>] [--fork <anvil url>] [--yes]
// The renewal demo (planning/PROMPTS/03-facilitator-shop.md part B, step 2): the story's renewal
// plan (price, shop, the 120 s demo period) as a subscription of the rehearsal agent (E-15: never
// the stage payer), created and renewed by RENEWER (the second relayer, E-1) and cancelled with the
// subscriber's own signature. The subscriber signs three things and pays no gas: a Permit2
// PermitSingle for a bounded allowance, the Subscribe terms (bound to that permit), and, while
// Permit2 is not approved yet, an EIP-2612 approval.
//   create: the first charge runs in the same transaction; renew: once the period is due;
//   cancel: the subscriber's Cancel signature, sent by RENEWER; demo: all three in order.
// Dry run by default (prints the terms); --yes sends.

import { encodeAbiParameters, erc20Abi, formatUnits, keccak256, namehash, parseAbi } from 'viem';
import { castEntries, config, story } from '../../packages/config/index.mjs';
import { cancelTypes, checkoutAbi, checkoutDomain, eip2612Types, permit2Domain, permitHash, permitSingleTypes, renewalOrderId, subscribeTypes, SUB_STATUS, tokenDomain } from '../../packages/contracts/index.mjs';
import { configuredCheckout, context, option, permit2, sendTx, usdt } from './lib.mjs';

// createSubscription runs a try/catch around Permit2 and the first charge: estimateGas undershoots
// (482,697 gas of execution measured at M1), so it gets a floor.
const CREATE_GAS_FLOOR = 700_000n;
const RENEW_GAS_FLOOR = 300_000n;
const ALLOWANCE_CYCLES = 3n; // the first charge, one renewal, one spare
const APPROVAL_FLOOR_MICRO = 50_000_000n; // the same bounded approval the payer's client signs
const SIG_TTL_SECONDS = 600;
const permit2Abi = parseAbi(['function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)']);
const noncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)']);

const argv = process.argv.slice(2);
const mode = argv[0];
if (!['demo', 'create', 'renew', 'cancel'].includes(mode)) throw new Error('usage: subscription.mjs demo|create|renew|cancel [--sub <subId>] [--fork <url>] [--yes]');
const ctx = await context(argv);
const { publicClient, chain } = ctx;
const address = configuredCheckout()?.address;
if (!address) throw new Error('no whitechain.contracts.checkout in the config');
const checkout = { address, abi: checkoutAbi };
const read = (functionName, args = []) => publicClient.readContract({ ...checkout, functionName, args });
const token = usdt();
const fmt = (micro) => `${formatUnits(BigInt(micro), token.decimals)} ${token.symbol}`;

// The cast: the rehearsal agent subscribes at the renewal plan's shop.
const cast = castEntries();
const agent = cast.find((e) => e.kind === 'buyer-agent' && e.key === 'rehearsal');
const shopEntry = cast.find((e) => e.kind === 'shop' && e.key === story.renewal.shop);
if (!agent || !shopEntry) throw new Error('the story has no rehearsal agent or renewal shop');
const subscriber = ctx.account(agent.walletRole);
const merchant = ctx.account(shopEntry.walletRole).address;
const subscriberNode = namehash(agent.ensName);
const shopNode = namehash(shopEntry.ensName);
const amountMicro = BigInt(story.renewal.priceMicro);
const period = story.renewal.demoPeriod.seconds;

async function chainNow() {
  return Number((await publicClient.getBlock({ blockTag: 'latest' })).timestamp);
}

async function create() {
  if ((await read('nodeOfWallet', [subscriber.address])).toLowerCase() !== subscriberNode) {
    throw new Error(`${agent.ensName}'s wallet is not bound to its node on the checkout: run setup first`);
  }
  const now = await chainNow();
  const firstChargeAt = BigInt(now);
  const subId = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }, { type: 'string' }, { type: 'uint64' }], [subscriber.address, shopNode, story.renewal.plan, firstChargeAt]));
  const [, , p2nonce] = await publicClient.readContract({ address: permit2(), abi: permit2Abi, functionName: 'allowance', args: [subscriber.address, token.address, address] });
  const ps = {
    details: { token: token.address, amount: amountMicro * ALLOWANCE_CYCLES, expiration: now + 86_400, nonce: Number(p2nonce) },
    spender: address,
    sigDeadline: BigInt(now + SIG_TTL_SECONDS),
  };
  const sub = { subId, subscriberNode, shopNode, payerNode: subscriberNode, subscriber: subscriber.address, merchant, amountMicro, period, firstChargeAt };
  const permitSig = await subscriber.signTypedData({ domain: permit2Domain(chain.id, permit2()), types: permitSingleTypes, primaryType: 'PermitSingle', message: ps });
  const subSig = await subscriber.signTypedData({
    domain: checkoutDomain(chain.id, address),
    types: subscribeTypes,
    primaryType: 'Subscribe',
    message: { subId, subscriberNode, shopNode, payerNode: subscriberNode, merchant, amountMicro, period, firstChargeAt, permitHash: permitHash(ps) },
  });
  let approvalPermit = '0x';
  const allowance = await publicClient.readContract({ address: token.address, abi: erc20Abi, functionName: 'allowance', args: [subscriber.address, permit2()] });
  if (allowance < ps.details.amount) {
    const value = ps.details.amount > APPROVAL_FLOOR_MICRO ? ps.details.amount : APPROVAL_FLOOR_MICRO;
    const deadline = BigInt(now + SIG_TTL_SECONDS);
    const nonce = await publicClient.readContract({ address: token.address, abi: noncesAbi, functionName: 'nonces', args: [subscriber.address] });
    const sig = await subscriber.signTypedData({ domain: tokenDomain(chain.id, token), types: eip2612Types, primaryType: 'Permit', message: { owner: subscriber.address, spender: permit2(), value, nonce, deadline } });
    approvalPermit = encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], [value, deadline, sig]);
  }
  console.log(`create: ${agent.ensName} subscribes to ${story.renewal.plan} at ${shopEntry.ensName}: ${fmt(amountMicro)} every ${period} s; Permit2 allowance ${fmt(ps.details.amount)}; approval ${approvalPermit === '0x' ? 'not needed' : 'signed (gasless)'}`);
  console.log(`  subId ${subId}`);
  if (!ctx.send) return subId;
  const before = await publicClient.getBalance({ address: subscriber.address });
  await sendTx(ctx, { role: 'RENEWER', label: `createSubscription ${story.renewal.plan}`, gasFloor: CREATE_GAS_FLOOR, request: { ...checkout, functionName: 'createSubscription', args: [sub, ps, permitSig, subSig, approvalPermit] } });
  await show(subId);
  if ((await publicClient.getBalance({ address: subscriber.address })) !== before) throw new Error("the subscriber's WBT moved");
  return subId;
}

async function show(subId) {
  const s = await read('subscription', [subId]);
  const order = await read('orders', [renewalOrderId(subId, s.cycle)]);
  console.log(`  status ${SUB_STATUS[Number(s.status)]}, cycle ${s.cycle}, next charge at ${s.nextChargeAt}${s.cycle > 0 ? `, last renewal order ${Number(order.status) >= 2 ? 'paid' : 'not paid'}` : ''}`);
  return s;
}

async function renew(subId) {
  const s = await show(subId);
  if (SUB_STATUS[Number(s.status)] !== 'ACTIVE') throw new Error('the subscription is not active');
  const wait = Number(s.nextChargeAt) - (await chainNow());
  if (wait > 0) {
    if (ctx.fork) {
      await publicClient.request({ method: 'evm_increaseTime', params: [wait + 1] });
      await publicClient.request({ method: 'evm_mine', params: [] });
    } else {
      console.log(`  waiting ${wait + 2} s for the period`);
      await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
    }
  }
  console.log(`renew: ${fmt(s.amountMicro)} as RENEWER`);
  if (!ctx.send) return;
  await sendTx(ctx, { role: 'RENEWER', label: `renew ${story.renewal.plan} cycle ${s.cycle + 1}`, gasFloor: RENEW_GAS_FLOOR, request: { ...checkout, functionName: 'renew', args: [subId] } });
  const after = await show(subId);
  if (after.cycle !== s.cycle + 1) throw new Error('the renewal did not charge (RenewalFailed?)');
}

async function cancel(subId) {
  const deadline = BigInt((await chainNow()) + SIG_TTL_SECONDS);
  const sig = await subscriber.signTypedData({ domain: checkoutDomain(chain.id, address), types: cancelTypes, primaryType: 'Cancel', message: { subId, deadline } });
  console.log(`cancel: ${agent.ensName}'s Cancel signature, sent by RENEWER`);
  if (!ctx.send) return;
  await sendTx(ctx, { role: 'RENEWER', label: `cancelWithSig ${story.renewal.plan}`, request: { ...checkout, functionName: 'cancelWithSig', args: [subId, deadline, sig] } });
  const s = await show(subId);
  if (SUB_STATUS[Number(s.status)] !== 'CANCELLED') throw new Error('the subscription is not cancelled');
}

const subArg = option(argv, '--sub');
const needSub = () => {
  if (!/^0x[0-9a-fA-F]{64}$/.test(subArg ?? '')) throw new Error('--sub <subId> is required');
  return subArg;
};
if (mode === 'create') await create();
if (mode === 'renew') await renew(needSub());
if (mode === 'cancel') await cancel(needSub());
if (mode === 'demo') {
  const subId = await create();
  if (ctx.send) {
    await renew(subId);
    await cancel(subId);
  }
}
console.log(`network ${config.networks.whitechain.name}${ctx.fork ? ' (fork)' : ''}: done`);
