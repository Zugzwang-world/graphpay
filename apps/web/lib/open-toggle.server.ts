// The merchant's Open toggle (Friday item 9; ADR-0033, ADR-0035): "Open shop" lists the
// shop as open on Arkiv by writing its `shop_open` row as W_DIRECTORY, and the page
// renews it every 5 minutes while it is on. Turning it off writes open_until = now on
// every live row of the shop, so it drops out of "open now" at once and the rows lapse on
// their own within 15 minutes. W_DIRECTORY is the one writer; its key lives only in the
// server's env.
import { readAll, type EntityDef } from '@graphpay_ethglobal/arkiv-graph';
import { ENTITIES, closeShop, connectArkiv, identityKey, nodeOf, openShop, runGraphql, type ArkivConnection } from '@graphpay/money-graph';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';

export const OPEN_WAITING_FOR = 'the W_DIRECTORY key on this server (the Coordinator sets it in Vercel)';
export const RENEW_EVERY_S = 300;
const LISTING_S = 15 * 60;
// A renewal that finds the listing already this fresh writes nothing (a double tap, a
// retry); the page's own 5-minute renewal always finds 10 minutes left and writes.
const FRESH_S = 14 * 60;

export interface OpenState {
  open: boolean;
  // Unix seconds until which the shop is listed open, when it is.
  openUntil: number | null;
  entityKey: string | null;
}

export function directoryConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.W_DIRECTORY_PRIVATE_KEY);
}

// One W_DIRECTORY connection per server instance, so its writes queue in order. A
// recovery window shorter than the route's 60 s limit leaves room to answer.
let connection: Promise<ArkivConnection> | null = null;
export function directoryConnection(): Promise<ArkivConnection> {
  connection ??= connectArkiv({ backend: (process.env.ARKIV_BACKEND as 'sim' | 'local' | 'rabdi' | undefined) ?? 'rabdi', env: process.env, role: 'W_DIRECTORY', recoveryMs: 20_000 }).catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

// The shop's key in the directory: keccak256(abi.encode(node, uint32 epoch)) with the
// epoch Arkiv's graph holds for the name now.
export async function shopKeyOf(shopEns: string): Promise<`0x${string}`> {
  const answer = await runGraphql({ engine: await arkivEngine(), query: 'query($ens: String!) { node(ens: $ens) { epoch } }', variables: { ens: shopEns } });
  const epoch = (answer.data as { node: { epoch: number } | null } | undefined)?.node?.epoch;
  if (typeof epoch !== 'number') throw new Error('the shop has no node on Arkiv yet');
  return identityKey(nodeOf(shopEns), epoch);
}

// The shop's live rows (W_DIRECTORY's own, listed open now), newest listing first.
async function liveRows(arkiv: ArkivConnection, shopKey: string, nowS: number): Promise<{ key: `0x${string}`; openUntil: number }[]> {
  const rows = await readAll(arkiv.publicClient, (ENTITIES as unknown as Record<string, EntityDef>)['shop_open'] as EntityDef, { owner: arkiv.owner as string, cap: 500 });
  return rows
    .filter((r) => String(r.shop_key).toLowerCase() === shopKey.toLowerCase() && Number(r.open_until) > nowS)
    .map((r) => ({ key: r.$key, openUntil: Number(r.open_until) }))
    .sort((a, b) => b.openUntil - a.openUntil);
}

// Open and Close are decided from reads, so they run one at a time: a Close can never
// read "nothing is open" while an Open it overlaps is still being written.
let tail: Promise<unknown> = Promise.resolve();
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}

export function setShopOpen({ arkiv, shopKey, shopEns, on, nowS = Math.floor(Date.now() / 1000) }: { arkiv: ArkivConnection; shopKey: `0x${string}`; shopEns: string; on: boolean; nowS?: number }): Promise<OpenState> {
  return serially(async () => {
    const live = await liveRows(arkiv, shopKey, nowS);
    if (on) {
      const fresh = live[0];
      if (fresh && fresh.openUntil >= nowS + FRESH_S) return { open: true, openUntil: fresh.openUntil, entityKey: fresh.key };
      const { key } = await openShop(arkiv, { shopKey, shopEns, now: nowS });
      return { open: true, openUntil: nowS + LISTING_S, entityKey: key };
    }
    // Already closed or lapsed: nothing to write. Otherwise every live row is closed, so a
    // duplicate row (two instances opening at once) cannot keep the shop listed.
    for (const row of live) await closeShop(arkiv, { key: row.key, now: nowS });
    return { open: false, openUntil: null, entityKey: live[0]?.key ?? null };
  });
}
