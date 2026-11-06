// The owner's pause and resume of a buyer agent (WEBSITE_SPEC.md §3, §7): the owner
// wallet sets `graphpay.status` on the agent's ENS name on Ethereum Sepolia, through
// @graphpay/ens (M6). The agent is the one whose card was tapped, and only one of the
// story's buyer agents with a spending pass (pickAgent); with none named, the payer. The
// owner's key is read from the server's env only, by role name, and never leaves this
// module. The gate sees the change within its 20 s cache.
import { config, resolveRpc } from '@graphpay/config';
import { createOwnerActions, createTxRunner, ensChain, ownerRoleOf, type OwnerActions, type OwnerSender } from '@graphpay/ens';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { siteModel, type ModelAgent, type SiteModel } from './site.server.ts';
import { publicAccess } from './passcode.ts';

export const OWNER_WAITING_FOR = "the owner's key on this server (the Coordinator sets it in Vercel)";
export const EFFECTIVE_WITHIN_S = 20;

export interface OwnerChange {
  changed: boolean;
  sepoliaTx: string | null;
  note: string | null;
}

const KEY_SHAPE = /^0x[0-9a-fA-F]{64}$/;

// The env name of the owner's key for an agent: `<ROLE>_PRIVATE_KEY`, the role from the
// namespace plan (the owner of the agent), never typed here.
export function ownerKeyName(agentName: string): string {
  return `${ownerRoleOf(agentName)}_PRIVATE_KEY`;
}

export function ownerConfigured(env: Record<string, string | undefined> = process.env, agent: string = siteModel().payer.ens): boolean {
  return KEY_SHAPE.test(env[ownerKeyName(agent)] ?? '');
}

// The agents a visitor can pause: the buyer team's agents with a spending pass (the story's
// `pays` and `capMicro`). The others never pay, so there is nothing to pause.
export function pausableAgents(model: SiteModel = siteModel()): ModelAgent[] {
  return model.buyerAgents.filter((a) => a.pays && a.capMicro !== null);
}

export type AgentPick = { ok: true; agent: ModelAgent } | { ok: false; status: 400 | 409; error: string; reason: 'NOT_AN_AGENT' | 'NO_PASS' };

// The agent a pause or resume acts on: the tapped card's agent, by ENS name (or story key).
// None named is the payer, as before. A buyer agent without a pass is refused in words the
// phone can show as they are.
export function pickAgent(input: unknown, model: SiteModel = siteModel()): AgentPick {
  if (input === undefined || input === null || input === '') return { ok: true, agent: model.payer };
  if (typeof input !== 'string') return { ok: false, status: 400, error: 'agent must be an ENS name', reason: 'NOT_AN_AGENT' };
  const wanted = input.trim().toLowerCase();
  const agent = model.buyerAgents.find((a) => a.ens === wanted || a.key === wanted);
  if (!agent) return { ok: false, status: 400, error: 'not an agent of this story', reason: 'NOT_AN_AGENT' };
  const pausable = pausableAgents(model);
  if (!pausable.some((a) => a.ens === agent.ens)) {
    const names = pausable.map((a) => a.displayName).join(' and ');
    return { ok: false, status: 409, error: `${agent.displayName} has no spending pass, so there is nothing to pause or resume. Only ${names} can be paused.`, reason: 'NO_PASS' };
  }
  return { ok: true, agent };
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

async function actions(): Promise<OwnerActions> {
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

// Public access (ADR-0069): one change at most every CHANGE_COOLDOWN_MS on this instance, for
// any agent, so a visitor alternating pause and resume cannot drain the owner's Sepolia gas.
// The self-healing cron passes open: false: its resume never waits on, or starts, the gap.
export const CHANGE_COOLDOWN_MS = 20_000;
let lastChange = Number.NEGATIVE_INFINITY;

// onlyIf: a change decided earlier (the self-healing cron's) is checked again once its turn in
// the queue comes, and sends nothing when it is no longer due.
export const NO_LONGER_DUE = 'no longer due';
export function changeStatus(paused: boolean, { actionsFor = actions, agent = siteModel().payer.ens, open = publicAccess(), now = Date.now(), onlyIf }: { actionsFor?: () => Promise<OwnerActions>; agent?: string; open?: boolean; now?: number; onlyIf?: () => Promise<boolean> } = {}): Promise<OwnerChange> {
  if (pending >= MAX_PENDING) return Promise.reject(new Busy('busy'));
  if (open && now - lastChange < CHANGE_COOLDOWN_MS) return Promise.reject(new Busy('too soon'));
  if (open) lastChange = now;
  pending += 1;
  const task = async (): Promise<OwnerChange> => {
    if (onlyIf && !(await onlyIf())) return { changed: false, sepoliaTx: null, note: NO_LONGER_DUE };
    const owner = await actionsFor();
    const result = await (paused ? owner.pause(agent) : owner.resume(agent));
    return { changed: result.changed, sepoliaTx: result.hash ?? null, note: result.changed ? null : (result.reason ?? 'no change') };
  };
  const run = tail.then(task, task).finally(() => {
    pending -= 1;
  });
  tail = run.catch(() => undefined);
  return run;
}
