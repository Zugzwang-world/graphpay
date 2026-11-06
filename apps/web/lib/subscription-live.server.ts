// The live side of Subscribe and Cancel (lib/subscription.server.ts holds the decisions): the payer
// agent's wallet signs the plan's terms, a Permit2 allowance bounded to the plan's maxCharges and,
// when Permit2 is not approved enough yet, an EIP-2612 approval; RENEWER, the second relayer (E-1),
// simulates and sends. Every send waits for its receipt; nothing is retried blind. Keys are read from
// the env by role name, never leave this file and are never logged; errors are logged by name only.
import { activeCast, config } from '@graphpay/config';
import { SUB_STATUS, cancelTypes, checkoutAbi, checkoutDomain, eip2612Types, permit2Domain, permitHash, permitSingleTypes, renewalOrderId, subscribeTypes, tokenDomain } from '@graphpay/contracts';
import { createEnsReader, ensPublicClient } from '@graphpay/ens';
import { DEFAULT_APPROVAL_MICRO, StartupError } from '@graphpay/facilitator';
import { BaseError, ContractFunctionRevertedError, createWalletClient, encodeAbiParameters, erc20Abi, isAddressEqual, keccak256, parseAbi, parseEventLogs, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { SubscriptionSummary } from './contracts.ts';
import { whitechain, type Whitechain } from './payments.server.ts';
import { MIN_BALANCE_WEI as RENEWER_FLOOR_WEI } from './renew.server.ts';
import { payerKeyName } from './reorder-live.server.ts';
import { checkoutAddress } from './site.server.ts';
import { SubscriptionRefusal, ofPlan, planOf, summaryOf, type Cancelled, type Created, type Plan, type SubState, type SubscriptionDeps } from './subscription.server.ts';

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;
// createSubscription wraps Permit2 and the first charge in try/catch, so its estimate undershoots
// (482,697 gas measured at M1, scripts/whitechain/subscription.mjs): it gets a floor.
const CREATE_GAS_FLOOR = 700_000n;
const CANCEL_GAS_FLOOR = 120_000n;
// The newest subscriptions read per call (two multicalls, well inside a route's time).
export const SCAN = 25n;
const SIG_TTL_S = 600;
// The allowance outlives the plan's last charge by this much (the cron runs once a minute).
const EXPIRY_SLACK_S = 600;
const RECEIPT_MS = 45_000;
const LOG_CHUNK = 1_000n; // the public Ankr endpoint answers eth_getLogs over at most 1,000 blocks
const LOG_CHUNKS = 6;
const permit2Abi = parseAbi(['function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)']);
const noncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)']);

const RENEWER_KEY = 'RENEWER_PRIVATE_KEY';

export function subscriptionKeysConfigured(env: Record<string, string | undefined> = process.env): boolean {
  try {
    return KEY_SHAPE.test(env[payerKeyName()] ?? '') && KEY_SHAPE.test(env[RENEWER_KEY] ?? '');
  } catch {
    return false;
  }
}

function account(name: string) {
  const key = process.env[name] ?? '';
  if (!KEY_SHAPE.test(key)) throw new StartupError(`${name} is not set`);
  return privateKeyToAccount(key as Hex);
}

// Named so a log line (class names only, never a message) says what happened.
class ChainRefused extends Error {
  constructor() {
    super('the RPC reports another chain');
    this.name = 'ChainRefused';
  }
}

interface Ctx {
  w: Whitechain;
  checkout: `0x${string}`;
  token: { address: `0x${string}`; eip712: { name: string; version: string } };
  permit2: `0x${string}`;
}

// The chain these functions use: the hosted Whitechain client, or an anvil fork of it in a fork run
// (a script sets it; the routes never do, and the hosted client refuses a loopback RPC).
let chainFor: () => Promise<Whitechain> = () => whitechain();
export function useChainForForkRun(get: () => Promise<Whitechain>): void {
  chainFor = get;
}

async function ctx(): Promise<Ctx> {
  const checkout = checkoutAddress();
  if (!checkout) throw new StartupError('the checkout is not deployed');
  return { w: await chainFor(), checkout: checkout as `0x${string}`, token: config.whitechain.tokens.usdt, permit2: config.whitechain.system.permit2 };
}

// eth_chainId before every signing step (CLAUDE.md): any other chain is refused.
async function chainOk(c: Ctx): Promise<void> {
  if ((await c.w.publicClient.getChainId()) !== c.w.chain.id) throw new ChainRefused();
}

const read = (c: Ctx, functionName: string, args: unknown[] = []) => c.w.publicClient.readContract({ address: c.checkout, abi: checkoutAbi, functionName, args } as never) as Promise<unknown>;

type RawSub = { subscriberNode: string; shopNode: string; payerNode: string; subscriber: string; merchant: string; amountMicro: bigint; period: number | bigint; nextChargeAt: bigint; cycle: number | bigint; retryAt: bigint; failures: number | bigint; status: number | bigint };

export async function latestSubscriptions(c?: Ctx): Promise<SubState[]> {
  const x = c ?? (await ctx());
  const count = BigInt((await read(x, 'subscriptionCount')) as bigint);
  if (count === 0n) return [];
  const indexes: bigint[] = [];
  for (let i = count; i > 0n && i > count - SCAN; i -= 1n) indexes.push(i - 1n);
  const multicallAddress = config.whitechain.system.multicall3 as `0x${string}`;
  const ids = (await x.w.publicClient.multicall({ multicallAddress, allowFailure: false, contracts: indexes.map((i) => ({ address: x.checkout, abi: checkoutAbi, functionName: 'subscriptionIdAt', args: [i] })) as never })) as Hex[];
  const subs = (await x.w.publicClient.multicall({ multicallAddress, allowFailure: false, contracts: ids.map((id) => ({ address: x.checkout, abi: checkoutAbi, functionName: 'subscription', args: [id] })) as never })) as RawSub[];
  return subs.map((s, i) => ({
    subId: ids[i]!.toLowerCase(),
    subscriberNode: s.subscriberNode.toLowerCase(),
    shopNode: s.shopNode.toLowerCase(),
    payerNode: s.payerNode.toLowerCase(),
    subscriber: s.subscriber,
    merchant: s.merchant,
    amountMicro: BigInt(s.amountMicro),
    period: Number(s.period),
    nextChargeAt: BigInt(s.nextChargeAt),
    cycle: Number(s.cycle),
    retryAt: BigInt(s.retryAt),
    failures: Number(s.failures),
    status: (SUB_STATUS[Number(s.status)] ?? 'NONE') as SubState['status'],
  }));
}

// The checkout's own refusal, from a simulation: its error name and, for BadInput, the field it names.
export function revertOf(error: unknown): string | null {
  if (!(error instanceof BaseError)) return null;
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
  const name = reverted?.data?.errorName;
  if (!name) return null;
  const arg = reverted.data?.args?.[0];
  const detail = typeof arg === 'string' && /^[a-z ]{1,40}$/.test(arg) ? `: ${arg}` : '';
  return `${name}${detail}`;
}

// The renewer must be a relayer, never the admin, and keep the cron's floor after this send.
async function renewerReady(c: Ctx, address: `0x${string}`, gas: bigint, keepFloor: boolean): Promise<void> {
  const [isRelayer, owner, balance, gasPrice] = await Promise.all([read(c, 'isRelayer', [address]) as Promise<boolean>, read(c, 'owner') as Promise<string>, c.w.publicClient.getBalance({ address }), c.w.publicClient.getGasPrice()]);
  if (!isRelayer) throw new StartupError('the renewer key is not a relayer on the checkout');
  if (isAddressEqual(owner as `0x${string}`, address)) throw new StartupError('the renewer key is the checkout admin');
  if (balance < (keepFloor ? RENEWER_FLOOR_WEI : 0n) + gas * gasPrice) throw new SubscriptionRefusal('RENEWER_LOW', 503);
}

// Simulate, estimate, send and wait. A revert in simulation is the checkout's refusal and sends
// nothing; a receipt that does not come in time is 'pending', never a failure.
async function sendAsRenewer(c: Ctx, functionName: 'createSubscription' | 'cancelWithSig', args: readonly unknown[], floor: bigint): Promise<{ hash: Hex; receipt: Awaited<ReturnType<Whitechain['publicClient']['waitForTransactionReceipt']>> | null }> {
  const renewer = account(RENEWER_KEY);
  const call = { address: c.checkout, abi: checkoutAbi, functionName, args, account: renewer.address } as const;
  let estimate: bigint;
  try {
    await c.w.publicClient.simulateContract(call as never);
    estimate = await c.w.publicClient.estimateContractGas(call as never);
  } catch (error) {
    const revert = revertOf(error);
    if (revert) throw new SubscriptionRefusal('CHECKOUT_REFUSED', 409, { revert });
    throw error;
  }
  const gas = (estimate * 12n) / 10n > floor ? (estimate * 12n) / 10n : floor;
  await renewerReady(c, renewer.address, gas, functionName === 'createSubscription');
  await chainOk(c);
  const wallet = createWalletClient({ account: renewer, chain: c.w.chain, transport: c.w.transport });
  const hash = await wallet.writeContract({ address: c.checkout, abi: checkoutAbi, functionName, args, account: renewer, chain: c.w.chain, gas } as never);
  try {
    return { hash, receipt: await c.w.publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_MS }) };
  } catch {
    console.error(`subscription ${functionName} pending: ${hash}`);
    return { hash, receipt: null };
  }
}

const eventsOf = (c: Ctx, logs: { address: string }[]) => parseEventLogs({ abi: checkoutAbi, logs: logs.filter((l) => isAddressEqual(l.address as `0x${string}`, c.checkout)) as never }) as unknown as { eventName: string; args: Record<string, unknown> }[];

async function create(plan: Plan): Promise<Created> {
  const c = await ctx();
  await chainOk(c);
  const payer = account(payerKeyName());
  const pc = c.w.publicClient;
  // The paying wallet is bound to the payer agent's node (the checkout refuses anything else).
  if (String(await read(c, 'nodeOfWallet', [payer.address])).toLowerCase() !== plan.payerNode) throw new SubscriptionRefusal('PAYER_NOT_BOUND');
  // The payee comes from ENS at signing time (ADR-0046); when this server holds the shop's key, they must agree.
  let payee: `0x${string}`;
  try {
    const r = await Promise.race([
      createEnsReader({ client: (await ensPublicClient({ env: process.env })).client }).resolvePayee(plan.shopEns),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ENS read timed out')), 12_000)),
    ]);
    if (!r.ok) throw new Error('unresolved');
    payee = r.payee as `0x${string}`;
  } catch {
    throw new SubscriptionRefusal('PAYEE_UNRESOLVED', 503);
  }
  const shop = activeCast().shops.find((s) => plan.shopEns.startsWith(`${s.label}.`));
  const shopKey = shop ? process.env[`${shop.walletRole}_PRIVATE_KEY`] : undefined;
  if (shopKey && KEY_SHAPE.test(shopKey) && !isAddressEqual(privateKeyToAccount(shopKey as Hex).address, payee)) throw new SubscriptionRefusal('PAYEE_MISMATCH');

  const block = await pc.getBlock();
  const now = Number(block.timestamp);
  const allowanceMicro = plan.priceMicro * BigInt(plan.maxCharges);
  const [[, , p2nonce], erc20Allowance, balance, policy, spent] = await Promise.all([
    pc.readContract({ address: c.permit2, abi: permit2Abi, functionName: 'allowance', args: [payer.address, c.token.address, c.checkout] }),
    pc.readContract({ address: c.token.address, abi: erc20Abi, functionName: 'allowance', args: [payer.address, c.permit2] }),
    pc.readContract({ address: c.token.address, abi: erc20Abi, functionName: 'balanceOf', args: [payer.address] }),
    read(c, 'policies', [plan.payerNode]) as Promise<{ revoked: boolean; dailyCapMicro: bigint; expiry: bigint }>,
    read(c, 'spentToday', [plan.payerNode]) as Promise<bigint>,
  ]);
  // The first charge runs in this transaction under the payer's pass: say so before anything is signed.
  if (policy.revoked || (policy.expiry !== 0n && BigInt(now) >= policy.expiry)) throw new SubscriptionRefusal('PAYER_NOT_ACTIVE');
  if (spent + plan.priceMicro > policy.dailyCapMicro) throw new SubscriptionRefusal('OVER_PASS');
  if (balance < plan.priceMicro) throw new SubscriptionRefusal('BALANCE_LOW');

  const firstChargeAt = BigInt(now);
  const subId = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }, { type: 'string' }, { type: 'uint64' }], [payer.address, plan.shopNode as Hex, plan.plan, firstChargeAt]));
  const ps = {
    details: { token: c.token.address, amount: allowanceMicro, expiration: now + plan.periodSeconds * (plan.maxCharges + 1) + EXPIRY_SLACK_S, nonce: Number(p2nonce) },
    spender: c.checkout,
    sigDeadline: BigInt(now + SIG_TTL_S),
  };
  const sub = { subId, subscriberNode: plan.subscriberNode as Hex, shopNode: plan.shopNode as Hex, payerNode: plan.payerNode as Hex, subscriber: payer.address, merchant: payee, amountMicro: plan.priceMicro, period: plan.periodSeconds, firstChargeAt };
  const chainId = c.w.chain.id;
  const permitSig = await payer.signTypedData({ domain: permit2Domain(chainId, c.permit2), types: permitSingleTypes, primaryType: 'PermitSingle', message: ps });
  const subSig = await payer.signTypedData({
    domain: checkoutDomain(chainId, c.checkout),
    types: subscribeTypes,
    primaryType: 'Subscribe',
    message: { subId, subscriberNode: sub.subscriberNode, shopNode: sub.shopNode, payerNode: sub.payerNode, merchant: payee, amountMicro: plan.priceMicro, period: plan.periodSeconds, firstChargeAt, permitHash: permitHash(ps) as Hex },
  });
  // Permit2 itself needs the token's approval for the charges. The payer's x402 payments draw on the same
  // approval and top it up to DEFAULT_APPROVAL_MICRO when short, so the subscription does the same: an
  // EIP-2612 approval is signed only when the approval is below that (or below the plan's whole allowance).
  let approvalPermit: Hex = '0x';
  const approvalTarget = allowanceMicro > DEFAULT_APPROVAL_MICRO ? allowanceMicro : DEFAULT_APPROVAL_MICRO;
  if (erc20Allowance < approvalTarget) {
    const value = approvalTarget;
    const deadline = BigInt(now + SIG_TTL_S);
    const nonce = await pc.readContract({ address: c.token.address, abi: noncesAbi, functionName: 'nonces', args: [payer.address] });
    const sig = await payer.signTypedData({ domain: tokenDomain(chainId, c.token), types: eip2612Types, primaryType: 'Permit', message: { owner: payer.address, spender: c.permit2, value, nonce, deadline } });
    approvalPermit = encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }], [value, deadline, sig]);
  }

  const { hash, receipt } = await sendAsRenewer(c, 'createSubscription', [sub, ps, permitSig, subSig, approvalPermit], CREATE_GAS_FLOOR);
  const base = { subId: subId.toLowerCase(), transaction: hash, firstChargeAt: now, allowanceMicro: String(allowanceMicro) };
  if (!receipt) return { ...base, status: 'pending', nextChargeAt: now + plan.periodSeconds, charged: null, firstOrderId: null, failReason: null };
  if (receipt.status !== 'success') throw new Error('createSubscription reverted');
  const events = eventsOf(c, receipt.logs);
  const renewed = events.find((e) => e.eventName === 'SubscriptionRenewed');
  const failed = events.find((e) => e.eventName === 'RenewalFailed');
  const after = (await read(c, 'subscription', [subId])) as RawSub;
  const next = BigInt(after.retryAt) > BigInt(after.nextChargeAt) ? BigInt(after.retryAt) : BigInt(after.nextChargeAt);
  return {
    ...base,
    status: 'confirmed',
    nextChargeAt: Number(next),
    charged: renewed ? true : failed ? false : null,
    firstOrderId: renewed ? renewalOrderId(subId, 1) : null,
    failReason: failed ? String(failed.args.reason) : null,
  };
}

async function cancel(sub: SubState): Promise<Cancelled> {
  const c = await ctx();
  await chainOk(c);
  const payer = account(payerKeyName());
  // Only the subscriber's own signature cancels; this server signs only for the payer agent's wallet.
  if (!isAddressEqual(sub.subscriber as `0x${string}`, payer.address)) throw new SubscriptionRefusal('NOT_THIS_SUBSCRIPTION');
  const deadline = (await c.w.publicClient.getBlock()).timestamp + BigInt(SIG_TTL_S);
  const sig = await payer.signTypedData({ domain: checkoutDomain(c.w.chain.id, c.checkout), types: cancelTypes, primaryType: 'Cancel', message: { subId: sub.subId as Hex, deadline } });
  const { hash, receipt } = await sendAsRenewer(c, 'cancelWithSig', [sub.subId, deadline, sig], CANCEL_GAS_FLOOR);
  if (!receipt) return { subId: sub.subId, transaction: hash, status: 'pending', effectiveAt: null };
  if (receipt.status !== 'success') throw new Error('cancelWithSig reverted');
  const cancelled = eventsOf(c, receipt.logs).find((e) => e.eventName === 'SubscriptionCancelled');
  return { subId: sub.subId, transaction: hash, status: 'confirmed', effectiveAt: cancelled ? Number(cancelled.args.effectiveAt) : null };
}

export function liveSubscriptionDeps(payerStatus: () => Promise<string>): SubscriptionDeps {
  return { payerStatus, latest: () => latestSubscriptions(), create, cancel, now: () => Date.now() };
}

// The charges of one subscription (SubscriptionRenewed), from about its first charge to now, in
// chunks the public endpoints answer; older than LOG_CHUNKS × LOG_CHUNK blocks are not read.
async function chargesOf(c: Ctx, sub: SubState, head: { number: bigint; timestamp: bigint }): Promise<{ at: number; transaction: string }[]> {
  if (sub.cycle === 0) return [];
  const startS = sub.nextChargeAt - BigInt(sub.cycle) * BigInt(sub.period);
  // About one block a second on Whitechain Sepolia; a minute's margin either side.
  let from = head.number - (head.timestamp > startS ? head.timestamp - startS : 0n) - 60n;
  const floor = head.number - LOG_CHUNK * BigInt(LOG_CHUNKS);
  if (from < floor) from = floor;
  const event = checkoutAbi.find((e) => e.type === 'event' && e.name === 'SubscriptionRenewed');
  const logs: { blockNumber: bigint | null; transactionHash: Hex | null }[] = [];
  for (let start = from; start <= head.number; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n < head.number ? start + LOG_CHUNK - 1n : head.number;
    logs.push(...((await c.w.publicClient.getLogs({ address: c.checkout, event: event as never, args: { subId: sub.subId as Hex } as never, fromBlock: start, toBlock: end })) as never[]));
  }
  const times = new Map<bigint, number>();
  await Promise.all([...new Set(logs.map((l) => l.blockNumber).filter((b): b is bigint => b !== null))].map(async (b) => times.set(b, Number((await c.w.publicClient.getBlock({ blockNumber: b })).timestamp))));
  return logs.filter((l) => l.transactionHash && l.blockNumber !== null).map((l) => ({ at: times.get(l.blockNumber!) ?? Number(head.timestamp), transaction: l.transactionHash! }));
}

async function readPayerSubscription(): Promise<SubscriptionSummary | null> {
  const c = await ctx();
  const plan = planOf();
  const sub = ofPlan(await latestSubscriptions(c), plan)[0];
  if (!sub) return null;
  const pc = c.w.publicClient;
  const [[amount, expiration], head] = await Promise.all([pc.readContract({ address: c.permit2, abi: permit2Abi, functionName: 'allowance', args: [sub.subscriber as `0x${string}`, c.token.address, c.checkout] }), pc.getBlock()]);
  const charges = await chargesOf(c, sub, head);
  return summaryOf(sub, plan, charges, { amount: BigInt(amount), expiration: Number(expiration) }, Number(head.timestamp));
}

// One read per 10 s per instance, however many phones poll.
let shared: { at: number; value: Promise<SubscriptionSummary | null> } | null = null;
export function payerSubscription(): Promise<SubscriptionSummary | null> {
  if (shared && Date.now() - shared.at < 10_000) return shared.value;
  const value = readPayerSubscription();
  shared = { at: Date.now(), value };
  value.catch(() => {
    if (shared?.value === value) shared = null;
  });
  return value;
}

// After a subscribe or a cancel on this instance, the next read is fresh.
export function forgetSubscriptionRead(): void {
  shared = null;
}
