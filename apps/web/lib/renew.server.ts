// The renewal cron (planning/SPEC/ARCHITECTURE.md §3 row 5b, E-1): Vercel calls GET
// /api/cron/renew every minute with `Authorization: Bearer <CRON_SECRET>`; due subscriptions are
// renewed as RENEWER, the second relayer, so the cron never shares a nonce stream with the
// facilitator. `renew` is guarded on-chain (due, active, not retrying), so a clash between two
// instances costs at most a nonce, never a double charge. Two charges are not sent at all: one the
// subscriber's Permit2 allowance can no longer cover (a demo plan signs for its maxCharges only) or
// whose token approval of Permit2 is short for now (the payer's next x402 payment tops it up), and one
// for a story agent whose owner has paused it in ENS (a paused agent is stopped, renewals too).

import { createWalletClient, erc20Abi, namehash, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { castEntries, config } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { createEnsGate, ensPublicClient } from '@graphpay/ens';
import { StartupError } from '@graphpay/facilitator';
import { whitechain } from './payments.server.ts';

const ACTIVE = 1;
const SCAN = 25n; // the most recent subscriptions looked at per run (reads stay well inside 60 s)
const PER_RUN = 3; // renewals sent per run (the cron runs every minute)
const GAS_FLOOR = 300_000n; // renew's try/catch around the pull makes the estimate undershoot
export const MIN_BALANCE_WEI = 20_000_000_000_000_000n; // 0.02 WBT: below it the renewer stops sending
const TIME_BUDGET_MS = 25_000; // no new send after this, well inside maxDuration 60 s

const permit2Abi = parseAbi(['function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)']);

// Whether the subscriber's Permit2 allowance still covers one charge now (expired or spent: no).
export function allowanceCovers(allowance: { amount: bigint; expiration: number }, amountMicro: bigint, nowS: bigint): boolean {
  return allowance.amount >= amountMicro && BigInt(allowance.expiration) > nowS;
}

// The story's agents by node: their subscriptions renew only while their ENS status is active.
function storyAgents(): Map<string, string> {
  return new Map(castEntries().filter((e) => e.kind === 'buyer-agent').map((e) => [namehash(e.ensName).toLowerCase(), e.ensName]));
}

let gate: Promise<ReturnType<typeof createEnsGate>> | null = null;
const ensGate = () =>
  (gate ??= ensPublicClient()
    .then(({ client }) => createEnsGate({ client }))
    .catch((error: unknown) => {
      gate = null;
      throw error;
    }));

export interface RenewResult {
  checked: number;
  renewed: { subId: Hex; tx: Hex }[]; // sent; the receipt is not waited for (the next run sees the state)
  skipped: { subId: Hex; reason: string }[];
}

// `chain` is for a fork run only (the route passes nothing, and the hosted client refuses a loopback RPC).
export async function renewDue(env: Record<string, string | undefined> = process.env, chain?: Awaited<ReturnType<typeof whitechain>>): Promise<RenewResult> {
  const key = env.RENEWER_PRIVATE_KEY;
  if (!key) throw new StartupError('RENEWER_PRIVATE_KEY is not set');
  const renewer = privateKeyToAccount(key as Hex);
  const w = chain ?? (await whitechain(env));
  const checkout = config.whitechain.contracts.checkout.address as Hex;
  const c = { address: checkout, abi: checkoutAbi } as const;
  const read = (functionName: string, args: unknown[] = []) => w.publicClient.readContract({ ...c, functionName, args } as never) as Promise<unknown>;
  if (!(await read('isRelayer', [renewer.address]))) throw new StartupError('the renewer key is not a relayer on the checkout');
  if (String(await read('owner')).toLowerCase() === renewer.address.toLowerCase()) throw new StartupError('the renewer key is the checkout admin');
  if ((await w.publicClient.getBalance({ address: renewer.address })) < MIN_BALANCE_WEI) throw new StartupError('the renewer is below its 0.02 WBT floor');

  const count = BigInt((await read('subscriptionCount')) as bigint);
  const now = (await w.publicClient.getBlock()).timestamp;
  const started = Date.now();
  const result: RenewResult = { checked: 0, renewed: [], skipped: [] };
  const wallet = createWalletClient({ account: renewer, chain: w.chain, transport: w.transport });
  // The most recent SCAN subscriptions, read in parallel.
  const indexes: bigint[] = [];
  for (let i = count; i > 0n && i > count - SCAN; i -= 1n) indexes.push(i - 1n);
  const subs = await Promise.all(
    indexes.map(async (i) => {
      const subId = (await read('subscriptionIdAt', [i])) as Hex;
      return { subId, s: (await read('subscription', [subId])) as { status: number; nextChargeAt: bigint; retryAt: bigint; subscriber: Hex; payerNode: Hex; amountMicro: bigint } };
    }),
  );
  result.checked = subs.length;
  const agents = storyAgents();
  const token = config.whitechain.tokens.usdt.address as Hex;
  const permit2 = config.whitechain.system.permit2 as Hex;
  for (const { subId, s } of subs) {
    if (Number(s.status) !== ACTIVE || now < BigInt(s.nextChargeAt) || now < BigInt(s.retryAt)) continue;
    if (result.renewed.length >= PER_RUN || Date.now() - started > TIME_BUDGET_MS) {
      result.skipped.push({ subId, reason: 'next run' });
      continue;
    }
    try {
      const [[amount, expiration], approved] = await Promise.all([
        w.publicClient.readContract({ address: permit2, abi: permit2Abi, functionName: 'allowance', args: [s.subscriber, token, checkout] }),
        w.publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [s.subscriber, permit2] }),
      ]);
      if (!allowanceCovers({ amount: BigInt(amount), expiration: Number(expiration) }, BigInt(s.amountMicro), now)) {
        result.skipped.push({ subId, reason: 'allowance spent' });
        continue;
      }
      if (approved < BigInt(s.amountMicro)) {
        result.skipped.push({ subId, reason: 'approval short' });
        continue;
      }
      const agent = agents.get(s.payerNode.toLowerCase());
      if (agent && (await (await ensGate()).ensCheck(agent)).status !== 'ACTIVE') {
        result.skipped.push({ subId, reason: 'payer not active in ENS' });
        continue;
      }
    } catch {
      result.skipped.push({ subId, reason: 'checks unreadable' });
      continue;
    }
    try {
      // eth_chainId before every send (CLAUDE.md).
      if ((await w.publicClient.getChainId()) !== w.chain.id) throw new StartupError('the RPC is not on Whitechain');
      const estimate = await w.publicClient.estimateContractGas({ ...c, functionName: 'renew', args: [subId], account: renewer });
      const gas = (estimate * 12n) / 10n > GAS_FLOOR ? (estimate * 12n) / 10n : GAS_FLOOR;
      const tx = await wallet.writeContract({ ...c, functionName: 'renew', args: [subId], account: renewer, chain: w.chain, gas });
      result.renewed.push({ subId, tx });
    } catch (e) {
      // Renewed elsewhere, no longer due, or a nonce clash: the next run looks again.
      result.skipped.push({ subId, reason: e instanceof StartupError ? e.message : 'send failed' });
      if (e instanceof StartupError) break;
    }
  }
  return result;
}
