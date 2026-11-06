// A shop's menu on Swarm (ADR-0061): public JSON, no personal data, uploaded through the
// gateway; Arkiv keeps its 64-hex reference and the sha-256 of its bytes in a `menu` row
// (W_DIRECTORY, mutable, one per shop). A reader fetches the reference and checks the
// hash; if the gateway no longer has it the menu is uploaded again (the same bytes give the
// same reference, so the Arkiv row does not change).

import { ExpirationTime, key } from '@arkiv-network/sdk';
import { eq } from '@arkiv-network/sdk/query';
import { checkedOwner, findOne } from '@graphpay_ethglobal/arkiv-graph';
import { activeCast, castEntries } from '@graphpay/config';
import { identityKey, nodeOf, normalizedName } from './identity.mjs';
import { ENTITIES, LIFETIME, writerAddresses } from './model.mjs';
import { sha256Hex } from './swarm.mjs';

export const MENU_FILE = 'menu.json';
const REFERENCE = /^[0-9a-f]{64}$/;

// The public document: only what the shop publishes anyway. Prices are micro-USDT (6 decimals).
export function menuDocument({ shopEns, name, items, version, synthetic = true }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('money-graph: a menu needs at least one item');
  return {
    schema: 'graphpay.menu.v1',
    synthetic: Boolean(synthetic),
    version,
    shop: { ens: normalizedName(shopEns), name },
    items: items.map((i) => ({ sku: i.sku, name: i.name, unit: i.unit, quantity: i.quantity, priceMicro: i.priceMicro })),
  };
}

// Stable bytes: the same document always gives the same bytes, hash and reference.
export const menuBytes = (document) => new TextEncoder().encode(JSON.stringify(document));

export function menuValues({ shopEns, epoch = 0, version, reference, bytes }) {
  if (!REFERENCE.test(reference ?? '')) throw new Error('money-graph: a menu reference is 64 hex digits (an encrypted 128-hex reference is never stored)');
  const ens = normalizedName(shopEns);
  return { shop_key: identityKey(nodeOf(ens), epoch), shop_ens: ens, version: BigInt(version), swarm_ref: reference, content_hash: sha256Hex(bytes), size: BigInt(bytes.length) };
}

async function currentRow(arkiv, shopKey, owner) {
  return findOne(arkiv.publicClient, ENTITIES.menu, { owner, where: [eq('shop_key', key(shopKey))] });
}

// Uploads the menu, reads it back and checks the hash, then creates or patches the `menu`
// row. The same bytes as the row already holds change nothing on Arkiv. Scripts only, like
// writeShop (ADR-0033). Returns { entityKey, txHash|null, reference, link, version, created, unchanged }.
export async function writeMenu(arkiv, swarm, { shopEns, epoch = 0, document, lifetimeDays = LIFETIME.shopDays }) {
  if (!arkiv?.writer) throw new Error('money-graph: writeMenu needs a W_DIRECTORY connection with a writer');
  const shopKey = identityKey(nodeOf(normalizedName(shopEns)), epoch);
  const existing = await currentRow(arkiv, shopKey, arkiv.owner);
  const doc = { ...document, version: existing ? Number(existing.version) : 1 };
  let bytes = menuBytes(doc);
  // A changed menu is a new version.
  if (existing && existing.content_hash !== sha256Hex(bytes)) {
    doc.version = Number(existing.version) + 1;
    bytes = menuBytes(doc);
  }
  const { reference, link } = await swarm.upload(bytes, { name: MENU_FILE });
  const back = await swarm.read(reference, MENU_FILE);
  if (!back || sha256Hex(back) !== sha256Hex(bytes)) throw new Error('money-graph: the gateway did not return the menu we uploaded');
  const values = menuValues({ shopEns, epoch, version: doc.version, reference, bytes });
  if (existing) {
    if (existing.swarm_ref === reference && existing.content_hash === values.content_hash) return { entityKey: existing.$key, txHash: null, reference, link, version: doc.version, created: false, unchanged: true };
    const { shop_key: _k, ...set } = values;
    const { txs } = await arkiv.writer.send({ patches: [{ def: ENTITIES.menu, key: existing.$key, values: set }] });
    return { entityKey: existing.$key, txHash: txs[0].hash, reference, link, version: doc.version, created: false, unchanged: false };
  }
  const { txs, createdKeys } = await arkiv.writer.send({ creates: [{ def: ENTITIES.menu, values, expiration: ExpirationTime.fromDays(lifetimeDays) }] });
  return { entityKey: createdKeys[0], txHash: txs[0].hash, reference, link, version: doc.version, created: true, unchanged: false };
}

// The menu of a shop: the W_DIRECTORY row, then the bytes from the gateway, checked against
// the row's hash. With `document` (the source of truth held by the caller), a menu the
// gateway has lost is uploaded again before it is returned. Returns null when there is no row.
export async function readMenu(publicClient, swarm, { shopEns, epoch = 0, owner = writerAddresses().W_DIRECTORY, document = null }) {
  const o = checkedOwner(owner);
  const shopKey = identityKey(nodeOf(normalizedName(shopEns)), epoch);
  const row = await currentRow({ publicClient }, shopKey, o);
  if (!row) return null;
  let bytes = await swarm.read(row.swarm_ref, MENU_FILE);
  let reuploaded = false;
  if (bytes === null && document) {
    const again = menuBytes({ ...document, version: Number(row.version) });
    if (sha256Hex(again) === row.content_hash) {
      const { reference } = await swarm.upload(again, { name: MENU_FILE });
      if (reference === row.swarm_ref) {
        bytes = again;
        reuploaded = true;
      }
    }
  }
  if (bytes === null) return { row, document: null, link: swarm.link(row.swarm_ref, MENU_FILE), reuploaded, verified: false, missing: true };
  const verified = sha256Hex(bytes) === row.content_hash;
  return { row, document: verified ? JSON.parse(new TextDecoder().decode(bytes)) : null, link: swarm.link(row.swarm_ref, MENU_FILE), reuploaded, verified, missing: false };
}

// The active story's cast menus: [{ shopEns, name, items }] from the story config.
export function castMenus(cast = activeCast()) {
  const names = new Map(castEntries(cast).filter((e) => e.kind === 'shop').map((e) => [e.key, e.ensName]));
  return cast.shops.map((s) => ({ shopEns: names.get(s.key), name: s.displayName, items: s.products, synthetic: true }));
}
