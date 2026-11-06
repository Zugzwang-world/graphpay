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

const IMAGE_TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']);
const IMAGE_MAX_BYTES = 64 * 1024;

// An item's optional image, as the menu document carries it: where it is on Swarm (a 64-hex
// reference, the file name) and what it should hash to. Never inline bytes.
function imageField(image) {
  if (!REFERENCE.test(image?.ref ?? '')) throw new Error('money-graph: a menu image reference is 64 hex digits');
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(image.name ?? '')) throw new Error('money-graph: a menu image needs a plain file name');
  if (!IMAGE_TYPES.has(image.contentType)) throw new Error(`money-graph: a menu image is one of ${[...IMAGE_TYPES].join(', ')}`);
  if (!/^[0-9a-f]{64}$/.test(image.sha256 ?? '')) throw new Error('money-graph: a menu image needs its sha-256');
  return { ref: image.ref, name: image.name, contentType: image.contentType, sha256: image.sha256, bytes: Number(image.bytes) };
}

// Uploads one small image we own through the gateway, reads it back and checks the hash;
// returns the descriptor an item's `image` field holds.
export async function uploadMenuImage(swarm, { bytes, name, contentType }) {
  if (!IMAGE_TYPES.has(contentType)) throw new Error(`money-graph: a menu image is one of ${[...IMAGE_TYPES].join(', ')}`);
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > IMAGE_MAX_BYTES) throw new Error(`money-graph: a menu image is 1 to ${IMAGE_MAX_BYTES} bytes`);
  const { reference } = await swarm.upload(bytes, { name, contentType });
  const back = await swarm.read(reference, name);
  if (!back || sha256Hex(back) !== sha256Hex(bytes)) throw new Error('money-graph: the gateway did not return the image we uploaded');
  return imageField({ ref: reference, name, contentType, sha256: sha256Hex(bytes), bytes: bytes.length });
}

// Where an item's image opens (a menu without images has none).
export const menuImageLink = (swarm, image) => swarm.link(image.ref, image.name);

// The public document: only what the shop publishes anyway. Prices are micro-USDT (6 decimals).
// An item may carry an `image` (see uploadMenuImage), and the shop its storefront photo as
// `shop.image`; menus without either read as before.
export function menuDocument({ shopEns, name, items, version, synthetic = true, image = null }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('money-graph: a menu needs at least one item');
  return {
    schema: 'graphpay.menu.v1',
    synthetic: Boolean(synthetic),
    version,
    shop: { ens: normalizedName(shopEns), name, ...(image ? { image: imageField(image) } : {}) },
    items: items.map((i) => ({ sku: i.sku, name: i.name, unit: i.unit, quantity: i.quantity, priceMicro: i.priceMicro, ...(i.image ? { image: imageField(i.image) } : {}) })),
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

// W_DIRECTORY is shared with the live site's quotes and activity rows, so a transaction the writer
// finds by nonce is this write only if it holds this write's row: a create of this type with this
// shop_key and the `expected` values (a concurrent run's row for the same shop differs in them).
const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
export function ownCreate(arkiv, def, shopKey, expected = {}) {
  return async (createdKeys) => {
    if (!createdKeys?.[0]) return false;
    const e = await arkiv.publicClient.getEntity(createdKeys[0]);
    const a = e?.$attributes ?? e?.attributes;
    if (a?.type?.value !== def.type || !same(a?.shop_key?.value, shopKey)) return false;
    return Object.entries(expected).every(([k, v]) => v == null || same(a?.[k]?.value, v));
  };
}

// The row with this key now carries every one of `expected` (a patch landed, ours or one to the same end).
export function rowHolds(arkiv, entityKey, expected) {
  return async () => {
    const e = await arkiv.publicClient.getEntity(entityKey);
    const a = e?.$attributes ?? e?.attributes;
    return Boolean(a) && Object.entries(expected).every(([k, v]) => v == null || same(a?.[k]?.value, v));
  };
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
    const patched = rowHolds(arkiv, existing.$key, { swarm_ref: values.swarm_ref, content_hash: values.content_hash, version: values.version });
    const { txs } = await arkiv.writer.send({ patches: [{ def: ENTITIES.menu, key: existing.$key, values: set }] }, { verifyRecovered: patched });
    return { entityKey: existing.$key, txHash: txs[0].hash, reference, link, version: doc.version, created: false, unchanged: false };
  }
  const { txs, createdKeys } = await arkiv.writer.send({ creates: [{ def: ENTITIES.menu, values, expiration: ExpirationTime.fromDays(lifetimeDays) }] }, { verifyRecovered: ownCreate(arkiv, ENTITIES.menu, shopKey, { swarm_ref: values.swarm_ref, content_hash: values.content_hash }) });
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

// The active story's cast menus: [{ key, shopEns, name, items }] from the story config.
// The story's `image` is a path on our own site (for the phones); a menu's image is a Swarm reference, so it is left out here.
export function castMenus(cast = activeCast()) {
  const names = new Map(castEntries(cast).filter((e) => e.kind === 'shop').map((e) => [e.key, e.ensName]));
  return cast.shops.map((s) => ({ key: s.key, shopEns: names.get(s.key), name: s.displayName, items: s.products.map(({ image: _site, ...item }) => item), synthetic: true }));
}
