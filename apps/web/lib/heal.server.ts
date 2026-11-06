// The self-healing cron's reads and actions; lib/heal.ts decides. Vercel calls
// /api/cron/heal every minute (apps/web/vercel.json):
// - a pausable agent (owner-actions.pausableAgents) paused for RESUME_AFTER_S is resumed by
//   its owner, through the same queue as the phones' Resume but without the visitors' 20 s gap;
// - the merchant's listing is renewed before it lapses, and reopened REOPEN_AFTER_S after it
//   was closed, as W_DIRECTORY (open-toggle).
// GET /api/state/heal shows the same plans, read-only. A failure is reported as its kind,
// never its message (a chain error's message can carry an RPC URL).
import { readAll, type EntityDef } from '@graphpay_ethglobal/arkiv-graph';
import { ensPublicClient, KEYS, locate, readText, retryingReads } from '@graphpay/ens';
import { ENTITIES } from '@graphpay/money-graph';
import { decodeFunctionResult, encodeFunctionData, parseAbiItem, toHex, type PublicClient } from 'viem';
import { namehash, packetToBytes } from 'viem/ens';
import { RESUME_AFTER_S, planAgent, planShop, type AgentPlan, type ShopPlan, type StatusChange } from './heal.ts';
import { directoryConfigured, directoryConnection, setShopOpen, shopKeyOf } from './open-toggle.server.ts';
import { NO_LONGER_DUE, changeStatus, failureKind, ownerConfigured, pausableAgents } from './owner-actions.server.ts';
import { siteModel } from './site.server.ts';

// The resolver's text-record event, as in @graphpay/ens's generated ABI (heal.test.ts checks
// that they match). keyHash is the indexed key, so one record's changes are one topic filter.
export const TEXT_UPDATED = parseAbiItem('event TextUpdated(uint256 indexed recordId, string indexed keyHash, string key, string value)');
// The agent's own resolver read at a past block. The ENSv2 resolver answers a text record only
// through ENSIP-10 resolve(name, text(node, key)), as the ENS provisioner reads it (readOwn).
const TEXT = parseAbiItem('function text(bytes32 node, string key) view returns (string)');
const RESOLVE = parseAbiItem('function resolve(bytes name, bytes data) view returns (bytes)');
// About three hours of Sepolia blocks (12 s each): a pause older than that resumes at once.
export const LOOKBACK_BLOCKS = 900n;
// RESUME_AFTER_S in Sepolia blocks: with no change in the window, the record must already have
// read paused this far back (every full node still holds that state).
export const RECENT_BLOCKS = BigInt(Math.ceil(RESUME_AFTER_S / 12));
const CACHE_MS = 10 * 60_000;

export interface HealSources {
  // The status record; when it reads paused, its newest change and, with none in the window,
  // whether it read paused RECENT_BLOCKS ago.
  agentStatus(ens: string): Promise<{ status: string; last: StatusChange | null; pausedEarlier?: boolean | null }>;
  // The open_until of each of the shop's listing rows still on Arkiv (W_DIRECTORY's own).
  listings(shopEns: string): Promise<number[]>;
}

// stillDue: the decision taken again from fresh reads once the write's turn comes (a visitor's
// change on another server may have landed in between).
export interface HealActions {
  resume(ens: string, stillDue: () => Promise<boolean>): Promise<{ changed: boolean; sepoliaTx: string | null; note?: string | null }>;
  openShop(shopEns: string, stillDue: () => Promise<boolean>): Promise<{ openUntil: number | null; skipped?: boolean }>;
}

export interface AgentHealth extends AgentPlan {
  ens: string;
  done: 'resumed' | 'no change' | 'no longer due' | null;
  sepoliaTx: string | null;
  failed: string | null;
}

export interface ShopHealth extends ShopPlan {
  ens: string;
  done: 'renewed' | 'reopened' | 'no longer due' | null;
  failed: string | null;
}

export interface HealReport {
  agents: AgentHealth[];
  shop: ShopHealth | null;
}

// The Sepolia client, re-resolved every 5 minutes (each candidate is probed for its chain id).
let ens: { at: number; value: Promise<PublicClient> } | null = null;
function ensClient(): Promise<PublicClient> {
  if (!ens || Date.now() - ens.at > 5 * 60_000) {
    const value = ensPublicClient().then(({ client }) => retryingReads(client, { tries: 3, delayMs: 1000 }));
    ens = { at: Date.now(), value };
    value.catch(() => {
      if (ens?.value === value) ens = null;
    });
  }
  return ens.value;
}

// A name's resolver and a shop's directory key change only on a new registration: cached.
const cache = new Map<string, { at: number; value: Promise<`0x${string}`> }>();
function cached(key: string, load: () => Promise<`0x${string}`>): Promise<`0x${string}`> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

async function lastStatusChange(client: PublicClient, resolver: `0x${string}`, head: bigint): Promise<StatusChange | null> {
  const logs = await client.getLogs({ address: resolver, event: TEXT_UPDATED, args: { keyHash: KEYS.status }, fromBlock: head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n, toBlock: head });
  const last = logs.at(-1);
  if (!last) return null;
  const block = await client.getBlock({ blockNumber: last.blockNumber });
  return { value: String(last.args.value ?? ''), at: Number(block.timestamp) };
}

// The status record as the agent's own resolver held it at a block.
export async function statusAt(client: Pick<PublicClient, 'readContract'>, name: string, resolver: `0x${string}`, blockNumber: bigint): Promise<string> {
  const data = encodeFunctionData({ abi: [TEXT], functionName: 'text', args: [namehash(name), KEYS.status] });
  const raw = await client.readContract({ address: resolver, abi: [RESOLVE], functionName: 'resolve', args: [toHex(packetToBytes(name)), data], blockNumber });
  return decodeFunctionResult({ abi: [TEXT], functionName: 'text', data: raw });
}

const shopKey = (shopEns: string) => cached(`shop ${shopEns}`, () => shopKeyOf(shopEns));

export const liveSources: HealSources = {
  agentStatus: async (name) => {
    const client = await ensClient();
    const status = await readText(client, name, KEYS.status);
    if (status !== 'paused') return { status, last: null };
    const resolver = await cached(`resolver ${name}`, async () => (await locate(client, name)).resolver);
    const head = await client.getBlockNumber({ cacheTime: 0 });
    const last = await lastStatusChange(client, resolver, head);
    if (last) return { status, last };
    // No change in the window: the record read RECENT_BLOCKS back tells an old pause from a new
    // one whose log this node has not served yet. A failed read is a failed run: nothing is sent.
    return { status, last: null, pausedEarlier: (await statusAt(client, name, resolver, head - RECENT_BLOCKS)) === 'paused' };
  },
  listings: async (shopEns) => {
    const arkiv = await directoryConnection();
    const key = (await shopKey(shopEns)).toLowerCase();
    const rows = await readAll(arkiv.publicClient, (ENTITIES as unknown as Record<string, EntityDef>)['shop_open'] as EntityDef, { owner: arkiv.owner as string, cap: 500 });
    return rows.filter((r) => String(r.shop_key).toLowerCase() === key).map((r) => Number(r.open_until));
  },
};

export const liveActions: HealActions = {
  // open: false: the cron's resume neither waits on nor starts the visitors' 20 s gap.
  resume: (agent, stillDue) => changeStatus(false, { agent, open: false, onlyIf: stillDue }),
  openShop: async (shopEns, stillDue) => {
    const state = await setShopOpen({ arkiv: await directoryConnection(), shopKey: await shopKey(shopEns), shopEns, on: true, onlyIf: stillDue });
    return { openUntil: state.openUntil, skipped: state.skipped === true };
  },
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

// The plans only: what the next run would do. A read that fails leaves its entry as a failure.
export async function inspect({ sources = liveSources, nowS = Math.floor(Date.now() / 1000), env = process.env }: { sources?: HealSources; nowS?: number; env?: Record<string, string | undefined> } = {}): Promise<HealReport> {
  const shopEns = siteModel().merchant.ens;
  const agents = await Promise.all(
    pausableAgents().map(async (a): Promise<AgentHealth> => {
      try {
        const { status, last, pausedEarlier = null } = await sources.agentStatus(a.ens);
        return { ens: a.ens, ...planAgent(status, last, nowS, pausedEarlier), done: null, sepoliaTx: null, failed: null };
      } catch (error) {
        return { ens: a.ens, status: 'unknown', pausedAt: null, resumesAt: null, action: 'none', done: null, sepoliaTx: null, failed: failureKind(error) };
      }
    }),
  );
  let shop: ShopHealth | null = null;
  if (directoryConfigured(env)) {
    try {
      shop = { ens: shopEns, ...planShop(await sources.listings(shopEns), nowS), done: null, failed: null };
    } catch (error) {
      shop = { ens: shopEns, open: false, openUntil: null, closedAt: null, reopensAt: null, action: 'none', done: null, failed: failureKind(error) };
    }
  }
  return { agents, shop };
}

// One run at a time on this instance; a run still going when the next minute's call lands
// makes that call return at once (the chain state, not this flag, decides what is due).
let running: Promise<HealReport> | null = null;

export function heal(options: { sources?: HealSources; actions?: HealActions; nowS?: number; clock?: () => number; env?: Record<string, string | undefined>; log?: (line: string) => void } = {}): Promise<HealReport> | null {
  if (running) return null;
  const { sources = liveSources, actions = liveActions, clock = nowSeconds, env = process.env, log = console.log } = options;
  const agentStillDue = (ens: string) => async () => {
    const { status, last, pausedEarlier = null } = await sources.agentStatus(ens);
    return planAgent(status, last, clock(), pausedEarlier).action === 'resume';
  };
  const shopStillDue = (ens: string, action: ShopPlan['action']) => async () => planShop(await sources.listings(ens), clock()).action === action;
  const run = (async (): Promise<HealReport> => {
    const report = await inspect(options);
    // A read that failed acts on nothing; it is said in the log so a stuck agent is never silent.
    for (const a of report.agents) if (a.failed) log(`heal: reading ${a.ens} failed: ${a.failed}`);
    if (report.shop?.failed) log(`heal: reading ${report.shop.ens}'s listing failed: ${report.shop.failed}`);
    await Promise.all([
      ...report.agents.map(async (a) => {
        if (a.action !== 'resume') return;
        if (!ownerConfigured(env, a.ens)) {
          a.failed = 'key';
          return;
        }
        try {
          const change = await actions.resume(a.ens, agentStillDue(a.ens));
          a.done = change.note === NO_LONGER_DUE ? 'no longer due' : change.changed ? 'resumed' : 'no change';
          a.sepoliaTx = change.sepoliaTx;
          log(`heal: ${a.ens} ${a.done}${a.pausedAt === null ? ' (paused before the lookback)' : ` (paused at ${a.pausedAt})`}${change.sepoliaTx ? `, tx ${change.sepoliaTx}` : ''}`);
        } catch (error) {
          a.failed = failureKind(error);
          log(`heal: resuming ${a.ens} failed: ${a.failed}`);
        }
      }),
      (async () => {
        const shop = report.shop;
        if (!shop || (shop.action !== 'renew' && shop.action !== 'reopen')) return;
        try {
          const opened = await actions.openShop(shop.ens, shopStillDue(shop.ens, shop.action));
          if (opened.skipped) {
            shop.done = 'no longer due';
            return;
          }
          shop.done = shop.action === 'renew' ? 'renewed' : 'reopened';
          log(shop.action === 'reopen' ? `heal: ${shop.ens} reopened${shop.closedAt === null ? ' (no listing left)' : ` (closed at ${shop.closedAt})`}` : `heal: ${shop.ens} listing renewed (it had until ${shop.openUntil})`);
          shop.open = true;
          shop.openUntil = opened.openUntil;
          shop.closedAt = null;
          shop.reopensAt = null;
        } catch (error) {
          shop.failed = failureKind(error);
          log(`heal: listing ${shop.ens} failed: ${shop.failed}`);
        }
      })(),
    ]);
    return report;
  })().finally(() => {
    running = null;
  });
  running = run;
  return run;
}

// The read-only view for GET /api/state/heal, cached briefly: visitors can call it at will.
const STATE_TTL_MS = 10_000;
let state: { at: number; value: Promise<HealReport> } | null = null;
export function healState(): Promise<HealReport> {
  if (!state || Date.now() - state.at > STATE_TTL_MS) {
    const value = inspect();
    state = { at: Date.now(), value };
    value.catch(() => {
      if (state?.value === value) state = null;
    });
  }
  return state.value;
}
