// The spending pass: what an agent may spend, enforced twice.
//
// On-chain, by GraphPayCheckout's AgentPolicy for the agent's node: the wallet it may pay
// from, a daily cap (UTC days), an expiry and a revocation switch. A dead process or a
// prompt-injected model cannot get past it, because the contract checks it at settlement.
//
// In code, by the buyer's guards before it signs: the same daily cap, a cap per week or
// month summed from the contract's own per-day spend record, a per-payment maximum and an
// optional merchant allowlist. The signature binds the merchant, so no relayer can redirect
// a payment the allowlist let through. An on-chain allowlist and periods other than a UTC
// day need a contract change: V2.

import { checkoutAbi } from '@graphpay/contracts';
import { AgentPayError, assertChain } from './network.mjs';
import { ZERO32, nodeOf } from './order.mjs';
import { MAX_U64 } from './money.mjs';

export const PERIOD_DAYS = Object.freeze({ day: 1, week: 7, month: 30 });
const DAY = 86_400n;

export function utcDay(nowSec) {
  return BigInt(nowSec) / DAY;
}

// The pass as the chain holds it, plus today's spend and what is left.
export async function readSpendingPass({ publicClient, network, name, node = nodeOf(name), wallet, nowSec }) {
  const [policy, spentToday, boundNode] = await Promise.all([
    publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'policies', args: [node] }),
    publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'spentToday', args: [node] }),
    wallet ? publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'nodeOfWallet', args: [wallet] }) : Promise.resolve(undefined),
  ]);
  const { epoch, wallet: passWallet, revoked, dailyCapMicro, expiry } = normalizePolicy(policy);
  const exists = passWallet !== `0x${'0'.repeat(40)}`;
  const expired = expiry !== 0n && BigInt(nowSec) >= expiry;
  const remaining = dailyCapMicro > spentToday ? dailyCapMicro - spentToday : 0n;
  return Object.freeze({
    node,
    exists,
    epoch,
    wallet: passWallet,
    revoked,
    dailyCapMicro,
    expiry,
    expired,
    unlimited: dailyCapMicro === MAX_U64,
    spentTodayMicro: spentToday,
    remainingTodayMicro: remaining,
    boundNode,
    active: exists && !revoked && !expired && dailyCapMicro > 0n,
  });
}

// viem returns a struct output either as an object or as a positional array.
function normalizePolicy(p) {
  if (Array.isArray(p)) return { epoch: Number(p[0]), wallet: p[1], revoked: p[2], dailyCapMicro: BigInt(p[3]), expiry: BigInt(p[4]) };
  return { epoch: Number(p.epoch), wallet: p.wallet, revoked: p.revoked, dailyCapMicro: BigInt(p.dailyCapMicro), expiry: BigInt(p.expiry) };
}

// Spend over the last `days` UTC days (today included) under the pass's epoch, from the
// contract's per-day record: one multicall, authoritative across every process.
export async function spentInPeriod({ publicClient, network, node, epoch, period, nowSec }) {
  const days = PERIOD_DAYS[period];
  if (!days) throw new AgentPayError('BAD_PERIOD', `period must be one of ${Object.keys(PERIOD_DAYS).join(', ')}`);
  if (node === ZERO32) return 0n;
  const today = utcDay(nowSec);
  const contracts = [];
  for (let i = 0n; i < BigInt(days); i++) {
    contracts.push({ address: network.checkout, abi: checkoutAbi, functionName: 'spentMicro', args: [node, epoch, today - i] });
  }
  if (days === 1) return BigInt(await publicClient.readContract(contracts[0]));
  const results = await publicClient.multicall({ contracts, allowFailure: false });
  return results.reduce((sum, v) => sum + BigInt(v), 0n);
}

// Issue or update a pass on-chain. Only the checkout's policy writer may (a separate key from
// the relayer and the admin, ADR-0021); never bind an owner's or a merchant's wallet.
export async function issueSpendingPass({ walletClient, publicClient, network, name, node = nodeOf(name), wallet, dailyCapMicro, expiry = 0n, epoch, revoked = false }) {
  if (node === ZERO32) throw new AgentPayError('NO_NODE', 'a spending pass belongs to a named agent');
  await assertChain(publicClient, network);
  const writer = walletClient.account.address;
  const allowed = await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'isPolicyWriter', args: [writer] });
  if (!allowed) throw new AgentPayError('NOT_POLICY_WRITER', 'this key may not write spending passes on the checkout');
  const current = normalizePolicy(await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'policies', args: [node] }));
  const nextEpoch = epoch ?? current.epoch;
  if (nextEpoch < current.epoch) throw new AgentPayError('EPOCH_BACKWARDS', 'a pass epoch never decreases');
  const cap = BigInt(dailyCapMicro);
  if (cap < 0n || cap > MAX_U64) throw new AgentPayError('BAD_CAP', 'the daily cap is out of range');
  const hash = await walletClient.writeContract({
    address: network.checkout,
    abi: checkoutAbi,
    functionName: 'setPolicy',
    args: [node, nextEpoch, wallet, revoked, cap, BigInt(expiry)],
    chain: walletClient.chain,
    account: walletClient.account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== 'success') throw new AgentPayError('PASS_NOT_WRITTEN', `setPolicy reverted (${hash})`);
  return { transaction: hash, node, epoch: nextEpoch, wallet, dailyCapMicro: cap, expiry: BigInt(expiry), revoked };
}

export async function revokeSpendingPass({ walletClient, publicClient, network, name, node = nodeOf(name) }) {
  const current = normalizePolicy(await publicClient.readContract({ address: network.checkout, abi: checkoutAbi, functionName: 'policies', args: [node] }));
  return issueSpendingPass({ walletClient, publicClient, network, node, wallet: current.wallet, dailyCapMicro: current.dailyCapMicro, expiry: current.expiry, epoch: current.epoch, revoked: true });
}
