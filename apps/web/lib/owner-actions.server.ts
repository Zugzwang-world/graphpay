// The owner's pause and resume of the payer agent (WEBSITE_SPEC.md §3, §7): the owner
// wallet sets `graphpay.status` on the agent's ENS name on Ethereum Sepolia, through
// @graphpay/ens (M6). The agent is always the story's payer agent, never a name from the
// request; the owner's key is read from the server's env only, by role name, and never
// leaves this module. The gate sees the change within its 20 s cache.
import { config, resolveRpc } from '@graphpay/config';
import { createOwnerActions, createTxRunner, ensChain, ownerRoleOf, type OwnerActions, type OwnerKill, type OwnerSender } from '@graphpay/ens';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { siteModel } from './site.server.ts';
import { publicAccess } from './passcode.ts';

export const OWNER_WAITING_FOR = "the owner's key on this server (the Coordinator sets it in Vercel)";
export const EFFECTIVE_WITHIN_S = 20;

export interface OwnerChange {
  changed: boolean;
  sepoliaTx: string | null;
  note: string | null;
}

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;

// The env name of the owner's key for the payer agent: `<ROLE>_PRIVATE_KEY`, the role from
// the namespace plan (the owner of the agent), never typed here.
export function ownerKeyName(agentName: string): string {
  return `${ownerRoleOf(agentName)}_PRIVATE_KEY`;
}

export function ownerConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return KEY_SHAPE.test(env[ownerKeyName(siteModel().payer.ens)] ?? '');
}

// The Sepolia endpoint is resolved once in a while (every candidate is probed for its chain
// id); the runner is built for each change. Its signer's nonce is read from the chain at
// the start of every change and counted only inside it, so a timed-out send, a second
// instance or a script using the owner's key can never leave a stale nonce behind.
let rpcCache: { at: number; value: Promise<Awaited<ReturnType<typeof resolveRpc>>> } | null = null;
function sepoliaRpc() {
  if (!rpcCache || Date.now() - rpcCache.at > 5 * 60_000) {
    const value = resolveRpc(config.ens.network);
    rpcCache = { at: Date.now(), value };
    value.catch(() => {
      if (rpcCache?.value === value) rpcCache = null;
    });
  }
  return rpcCache.value;
}

// The owner's actions over the live Sepolia endpoint, with the owner's key from this server's env
// (the kill of a disposable agent uses them too: lib/kill-disposable.server.ts).
export async function liveOwnerActions(): Promise<OwnerActions & OwnerKill> {
  const rpc = await sepoliaRpc();
  const chain = ensChain();
  const client = createPublicClient({ chain, transport: http(rpc.url, { retryCount: 2, timeout: 20_000 }) });
  const runner = createTxRunner({ client, chainId: config.networks.sepolia.chainId, log: () => undefined });
  const senderFor = (role: string): OwnerSender => {
    const key = process.env[`${role}_PRIVATE_KEY`] ?? '';
    if (!KEY_SHAPE.test(key)) throw new Error('the owner key is not set');
    const account = privateKeyToAccount(key as `0x${string}`);
    const wallet = createWalletClient({ account, chain, transport: http(rpc.url, { timeout: 60_000 }) });
    return { role, address: account.address, sendTransaction: (request) => wallet.sendTransaction(request as Parameters<typeof wallet.sendTransaction>[0]) };
  };
  return createOwnerActions({ client, runner, senderFor, log: () => undefined });
}

// A short stable reason for the server log: the kind of failure, never the message (a chain
// error's message can carry an RPC URL).
export function failureKind(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : '';
  if (/nonce|in flight|pending/i.test(text)) return 'nonce';
  if (/RPC reports chain|chain id/i.test(text)) return 'chain';
  if (/revert|EACUnauthorized/i.test(text)) return 'revert';
  if (/not visible|timeout|timed out|receipt/i.test(text)) return 'timeout';
  if (/not set/i.test(text)) return 'key';
  return 'error';
}

// Pause and resume run one at a time (the owner's nonce), at most MAX_PENDING waiting
// (a client alternating the two cannot stack requests that each hold a function), and a
// request for the state the name is already in sends nothing.
export const MAX_PENDING = 2;
let tail: Promise<unknown> = Promise.resolve();
let pending = 0;
export class Busy extends Error {}

// Public access (ADR-0069): one change at most every CHANGE_COOLDOWN_MS on this instance, so a
// visitor alternating pause and resume cannot drain the owner's Sepolia gas.
export const CHANGE_COOLDOWN_MS = 20_000;
let lastChange = Number.NEGATIVE_INFINITY;

export function changeStatus(paused: boolean, { actionsFor = liveOwnerActions, agent = siteModel().payer.ens, open = publicAccess(), now = Date.now() }: { actionsFor?: () => Promise<OwnerActions>; agent?: string; open?: boolean; now?: number } = {}): Promise<OwnerChange> {
  if (pending >= MAX_PENDING) return Promise.reject(new Busy('busy'));
  if (open && now - lastChange < CHANGE_COOLDOWN_MS) return Promise.reject(new Busy('too soon'));
  if (open) lastChange = now;
  pending += 1;
  const task = async (): Promise<OwnerChange> => {
    const owner = await actionsFor();
    const result = await (paused ? owner.pause(agent) : owner.resume(agent));
    return { changed: result.changed, sepoliaTx: result.hash ?? null, note: result.changed ? null : (result.reason ?? 'no change') };
  };
  return inOwnerQueue(task).finally(() => {
    pending -= 1;
  });
}

// Every transaction the owner's key signs on this instance (pause, resume, the kill of a disposable
// agent) runs in this one queue, in order, so two never race for the owner's nonce.
export function inOwnerQueue<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}
