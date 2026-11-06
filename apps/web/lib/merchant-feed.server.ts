// The merchant routes' reads: the shop's edges from the Arkiv engine, shared by every
// open stream on this server instance for a couple of seconds so ten phones cost one
// query, not ten.
import { runGraphql } from '@graphpay/money-graph';
import { arkivEngine } from '../app/api/graphql/arkiv.server.ts';
import { LIST_CAP, fetchShopEdgesFitting, type GraphqlRunner, type ShopEdges } from './merchant-feed.ts';

const run: GraphqlRunner = async (query, variables) => runGraphql({ engine: await arkivEngine(), query, variables, dataset: 'live', listCap: LIST_CAP });

const SHARE_MS = 2000;
let shared: { at: number; key: string; value: Promise<ShopEdges> } | null = null;

export function sharedShopEdges(shopEns: string, daysBack = 1): Promise<ShopEdges> {
  const key = `${shopEns}|${daysBack}`;
  const now = Date.now();
  if (shared && shared.key === key && now - shared.at < SHARE_MS) return shared.value;
  const value = fetchShopEdgesFitting(run, shopEns, { daysBack });
  shared = { at: now, key, value };
  value.catch(() => {
    if (shared?.value === value) shared = null;
  });
  return value;
}

export { run as runShopGraphql };
