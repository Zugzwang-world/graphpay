// The renewal cron (planning/SPEC/ARCHITECTURE.md §3 row 5b, E-1): Vercel calls GET
// /api/cron/renew every minute with `Authorization: Bearer <CRON_SECRET>`; due subscriptions are
// renewed as RENEWER, the second relayer, so the cron never shares a nonce stream with the
// facilitator. `renew` is guarded on-chain (due, active, not retrying), so a clash between two
// instances costs at most a nonce, never a double charge.

import { createWalletClient, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { StartupError } from '@graphpay/facilitator';
import { whitechain } from './payments.server.ts';

const ACTIVE = 1;
const SCAN = 200n; // the most recent subscriptions looked at per run
const PER_RUN = 3; // renewals sent per run (the cron runs every minute)
const GAS_FLOOR = 300_000n; // renew's try/catch around the pull makes the estimate undershoot
const RECEIPT_MS = 30_000;

export interface RenewResult {
  checked: number;
  renewed: { subId: Hex; tx: Hex; status: string }[];
  skipped: { subId: Hex; reason: string }[];
}

export async function renewDue(env: Record<string, string | undefined> = process.env): Promise<RenewResult> {
  const key = env.RENEWER_PRIVATE_KEY;
  if (!key) throw new StartupError('RENEWER_PRIVATE_KEY is not set');
  const renewer = privateKeyToAccount(key as Hex);
  const w = await whitechain(env);
  const checkout = config.whitechain.contracts.checkout.address as Hex;
  const c = { address: checkout, abi: checkoutAbi } as const;
  const read = (functionName: string, args: unknown[] = []) => w.publicClient.readContract({ ...c, functionName, args } as never) as Promise<unknown>;
  if (!(await read('isRelayer', [renewer.address]))) throw new StartupError('the renewer key is not a relayer on the checkout');

  const count = BigInt((await read('subscriptionCount')) as bigint);
  const now = (await w.publicClient.getBlock()).timestamp;
  const result: RenewResult = { checked: 0, renewed: [], skipped: [] };
  const wallet = createWalletClient({ account: renewer, chain: w.chain, transport: w.transport });
  for (let i = count; i > 0n && i > count - SCAN && result.renewed.length < PER_RUN; i -= 1n) {
    const subId = (await read('subscriptionIdAt', [i - 1n])) as Hex;
    const s = (await read('subscription', [subId])) as { status: number; nextChargeAt: bigint; retryAt: bigint };
    result.checked += 1;
    if (Number(s.status) !== ACTIVE || now < BigInt(s.nextChargeAt) || now < BigInt(s.retryAt)) continue;
    // eth_chainId before every send (CLAUDE.md).
    if ((await w.publicClient.getChainId()) !== w.chain.id) throw new StartupError('the RPC is not on Whitechain');
    let gas: bigint;
    try {
      const estimate = await w.publicClient.estimateContractGas({ ...c, functionName: 'renew', args: [subId], account: renewer });
      gas = (estimate * 12n) / 10n > GAS_FLOOR ? (estimate * 12n) / 10n : GAS_FLOOR;
    } catch {
      result.skipped.push({ subId, reason: 'simulation failed' }); // renewed elsewhere, or no longer due
      continue;
    }
    const tx = await wallet.writeContract({ ...c, functionName: 'renew', args: [subId], account: renewer, chain: w.chain, gas });
    const receipt = await w.publicClient.waitForTransactionReceipt({ hash: tx, timeout: RECEIPT_MS }).catch(() => null);
    result.renewed.push({ subId, tx, status: receipt ? receipt.status : 'pending' });
  }
  return result;
}
