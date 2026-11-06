// The live side of the owner's cap change (lib/owner-cap.server.ts holds the decisions): the owner's
// wallet signs the ENS write on Ethereum Sepolia through @graphpay/ens (createOwnerActions().setCap,
// read back before it answers); the policy is read from the checkout; the record is a W_SYNC
// `request` edge on Arkiv, owner to agent. Keys are read by role name, never leave this file and
// are never logged.
import { activeCast, config, resolveRpc } from '@graphpay/config';
import { checkoutAbi } from '@graphpay/contracts';
import { KEYS, createEnsGate, createOwnerActions, createTxRunner, ensChain, ensPublicClient, ownerRoleOf, type OwnerSender } from '@graphpay/ens';
import { recordEdge } from '@graphpay/money-graph';
import { createPublicClient, createWalletClient, http, namehash, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { syncConnection, whitechain } from './payments.server.ts';
import { recorderKeyConfigured } from './refund-request.server.ts';
import { checkoutAddress, siteModel } from './site.server.ts';
import type { OwnerCapDeps } from './owner-cap.server.ts';

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;

export function ownerCapKeysConfigured(env: Record<string, string | undefined> = process.env): boolean {
  try {
    return KEY_SHAPE.test(env[`${ownerRoleOf(siteModel().payer.ens)}_PRIVATE_KEY`] ?? '') && recorderKeyConfigured(env);
  } catch {
    return false;
  }
}

let gate: Promise<ReturnType<typeof createEnsGate>> | null = null;
const ensGate = () =>
  (gate ??= ensPublicClient()
    .then(({ client }) => createEnsGate({ client }))
    .catch((error: unknown) => {
      gate = null;
      throw error;
    }));

// The owner's actions on Sepolia, built for each change: the signer's nonce is read from the chain at
// the start of every change (a pause from another instance can never leave it stale).
async function ownerActions() {
  const rpc = await resolveRpc(config.ens.network);
  const chain = ensChain();
  const client = createPublicClient({ chain, transport: http(rpc.url, { retryCount: 2, timeout: 20_000 }) });
  const runner = createTxRunner({ client, chainId: config.networks.sepolia.chainId, log: () => undefined });
  const senderFor = (role: string): OwnerSender => {
    const key = process.env[`${role}_PRIVATE_KEY`] ?? '';
    if (!KEY_SHAPE.test(key)) throw new Error('the owner key is not set');
    const account = privateKeyToAccount(key as Hex);
    const wallet = createWalletClient({ account, chain, transport: http(rpc.url, { timeout: 60_000 }) });
    return { role, address: account.address, sendTransaction: (request) => wallet.sendTransaction(request as Parameters<typeof wallet.sendTransaction>[0]) };
  };
  return createOwnerActions({ client, runner, senderFor, log: () => undefined });
}

export function liveOwnerCapDeps(): OwnerCapDeps {
  const model = siteModel();
  const node = namehash(model.payer.ens);
  return {
    configuredMicro: () => {
      const payer = activeCast().buyerAgents.find((a) => a.key === 'payer');
      if (typeof payer?.capMicro !== 'number' || payer.capMicro <= 0) throw new Error('story config: the payer agent has no cap');
      return BigInt(payer.capMicro);
    },
    floorMicro: () => BigInt(model.order.budgetMicro),
    ensCap: async () => {
      // A fresh read: the gate's 20 s cache must not give an old value as "before".
      (await ensGate()).invalidate(model.payer.ens);
      const check = await (await ensGate()).ensCheck(model.payer.ens);
      const value = check.records[KEYS.capMicro] ?? '';
      if (check.status === 'UNKNOWN' || !/^\d{1,19}$/.test(value)) throw new Error('the ENS cap is unreadable');
      return BigInt(value);
    },
    setEnsCap: async (capMicro) => {
      const actions = await ownerActions();
      if (!actions.setCap) throw new Error('@graphpay/ens has no setCap');
      const result = await actions.setCap(model.payer.ens, capMicro);
      (await ensGate()).invalidate(model.payer.ens);
      return { changed: result.changed, sepoliaTx: result.hash ?? null };
    },
    policy: async () => {
      const w = await whitechain();
      const policy = (await w.publicClient.readContract({ address: checkoutAddress() as Hex, abi: checkoutAbi, functionName: 'policies', args: [node] })) as { dailyCapMicro: bigint; epoch: number | bigint };
      return { capMicro: BigInt(policy.dailyCapMicro), epoch: Number(policy.epoch) };
    },
    record: async ({ capMicro, ensBeforeMicro, ensChanged, policyMicro, applied, sepoliaTx, epoch, ts }) =>
      recordEdge(await syncConnection(), {
        // Unique per change (its second and its cap): two changes in one minute are two records.
        ref: `own:${node.slice(2, 18)}:${ts}:${capMicro}`,
        kind: 'request',
        from: { ens: model.persona.ens, epoch: 0 },
        to: { ens: model.payer.ens, epoch: epoch ?? 0 },
        // No money moves and nothing is asked of anyone: the figures are in the payload, never the amount.
        amountMicro: 0n,
        ts,
        payload: toHex(JSON.stringify({ action: 'set-cap', key: KEYS.capMicro, capMicro: String(capMicro), ensBeforeMicro: String(ensBeforeMicro), ensChanged, policyMicro: policyMicro === null ? null : String(policyMicro), applied, sepoliaTx })),
      }),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
