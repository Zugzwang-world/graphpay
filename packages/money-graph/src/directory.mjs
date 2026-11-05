// The shop directory (M7 amendment §3, §6): one mutable `shop` row per listed shop,
// written by W_DIRECTORY (cast and synthetic shops alike), 14 days. Discovery is one
// query on project, type, category, both i32 coordinate ranges and the owner, paged by
// $key; every row is checked again for owner, version, box and status.

import { ExpirationTime, bool, i32, key, str } from '@arkiv-network/sdk';
import { and, asc, between, eq, gt } from '@arkiv-network/sdk/query';
import { checkedOwner, findOne, fromJsonBytes, jsonBytes, scope, trustedRows } from '@graphpay/arkiv-graph';
import { identityKey, nodeOf, normalizedName } from './identity.mjs';
import { ENTITIES, LIFETIME, writerAddresses } from './model.mjs';

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;
export const SHOP_STATUS = ['active', 'paused', 'delisted'];

// Values of a shop row. lat and lng are micro-degrees (i32); name and hours go in the payload.
export function shopValues({ shopEns, epoch = 0, category, area, city, lat, lng, status = 'active', synthetic = false, dataset, name, hours }) {
  const ens = normalizedName(shopEns);
  if (!SHOP_STATUS.includes(status)) throw new Error(`money-graph: shop status "${status}" is not one of ${SHOP_STATUS.join(', ')}`);
  for (const v of [lat, lng]) if (!Number.isInteger(v) || v < I32_MIN || v > I32_MAX) throw new Error('money-graph: coordinates are i32 micro-degrees');
  return {
    shop_key: identityKey(nodeOf(ens), epoch),
    shop_ens: ens,
    category,
    area,
    city,
    lat,
    lng,
    status,
    synthetic: Boolean(synthetic),
    dataset,
    payload: jsonBytes({ name: name ?? null, hours: hours ?? null }),
  };
}

// Query-before-create: patches the row with this shop_key if W_DIRECTORY already holds
// one, else creates it. Scripts only (never while the site is live; ADR-0033).
export async function writeShop(arkiv, shop, { lifetimeDays = LIFETIME.shopDays } = {}) {
  if (!arkiv?.writer) throw new Error('money-graph: writeShop needs a W_DIRECTORY connection with a writer');
  const values = shopValues(shop);
  const existing = await findOne(arkiv.publicClient, ENTITIES.shop, { owner: arkiv.owner, where: [eq('shop_key', key(values.shop_key))] });
  if (existing) {
    const { shop_key: _k, ...set } = values;
    const { txs } = await arkiv.writer.send({ patches: [{ def: ENTITIES.shop, key: existing.$key, values: set }] });
    return { entityKey: existing.$key, txHash: txs[0].hash, created: false };
  }
  const { txs, createdKeys } = await arkiv.writer.send({ creates: [{ def: ENTITIES.shop, values, expiration: ExpirationTime.fromDays(lifetimeDays) }] });
  return { entityKey: createdKeys[0], txHash: txs[0].hash, created: true };
}

function checkBox(box) {
  for (const k of ['latMin', 'latMax', 'lngMin', 'lngMax']) {
    if (!Number.isInteger(box?.[k]) || box[k] < I32_MIN || box[k] > I32_MAX) throw new Error(`money-graph: box.${k} must be an i32 (micro-degrees)`);
  }
  if (box.latMin > box.latMax || box.lngMin > box.lngMax) throw new Error('money-graph: an empty box');
}

// The discovery query's filters: real shops only unless `synthetic` opts in.
export function discoveryFilters({ category, box, synthetic = false }) {
  checkBox(box);
  const filters = [...scope(ENTITIES.shop), between('lat', i32(box.latMin), i32(box.latMax)), between('lng', i32(box.lngMin), i32(box.lngMax))];
  if (category) filters.push(eq('category', str(category)));
  if (!synthetic) filters.push(eq('synthetic', bool(false)));
  return filters;
}

// Shops in a box, from W_DIRECTORY only, active, merged by shop_ens. Returns
// { shops, queries, calls } (queries as rendered, for the explain trace).
export async function discoverShops(publicClient, { category, box, synthetic = false, owner = writerAddresses().W_DIRECTORY, cap = 500 } = {}) {
  const o = checkedOwner(owner);
  const base = discoveryFilters({ category, box, synthetic });
  const seen = new Map();
  const queries = [];
  let last = null;
  let calls = 0;
  for (;;) {
    const filters = last ? [...base, gt('$key', key(last))] : base;
    const builder = publicClient.select('*').from(ENTITIES.shop.schema).where(...filters).ownedBy(o).orderBy(asc('$key')).limit(100);
    queries.push(builder.toString());
    const page = await builder.fetch();
    calls += 1;
    for (const r of trustedRows(ENTITIES.shop, o, page.entities)) {
      if (r.status !== 'active') continue;
      if (r.lat < box.latMin || r.lat > box.latMax || r.lng < box.lngMin || r.lng > box.lngMax) continue;
      if (!synthetic && r.synthetic) continue;
      if (category && r.category !== category) continue;
      const payload = fromJsonBytes(r.payload) ?? {};
      seen.set(r.shop_ens, { key: r.$key, shopKey: r.shop_key, ens: r.shop_ens, category: r.category, area: r.area ?? null, city: r.city ?? null, lat: r.lat, lng: r.lng, synthetic: r.synthetic, dataset: r.dataset ?? null, name: payload.name ?? null, hours: payload.hours ?? null });
    }
    if (page.entities.length < 100 || seen.size >= cap) break;
    last = page.entities.at(-1).$key;
  }
  return { shops: [...seen.values()], queries, calls, query: and(base).toString() };
}
