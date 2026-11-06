// W_DIRECTORY is shared with the live site. When a menu or shop write's send is lost and another
// writer of the same key has taken its nonce, the write must not take that transaction for its
// own (on Fri 6 Nov a live handoff row and a presence row were reported as menu rows). ArkivSim,
// two connections with one key; the cases are the reviewer's reproductions.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { ExpirationTime } from '@arkiv-network/sdk';
import { fromJsonBytes, readAll } from '@graphpay_ethglobal/arkiv-graph';
import { ENTITIES, connectArkiv, createQuote, identityKey, menuBytes, menuDocument, newSim, nodeOf, openShop, quoteValues, sha256Hex, swarmClient, writeMenu, writeShop } from '../index.mjs';

const SHOP = 'alpha-sweets.sim.example.eth';
const ITEMS = [{ sku: 'box-12', name: 'jamun', unit: 'box of 12', quantity: 12, priceMicro: 4_800_000 }];
const shopKey = identityKey(nodeOf(SHOP), 0);
const LAT = 19_076_000;
const LNG = 72_877_000;

function gateway() {
  const store = new Map();
  const gw = { salt: 'a' };
  gw.fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    if (init.method === 'POST') {
      const bytes = new Uint8Array(init.body);
      const reference = createHash('sha256').update(gw.salt).update(u.searchParams.get('name')).update(bytes).digest('hex');
      store.set(reference, bytes);
      return new Response(JSON.stringify({ reference }), { status: 201 });
    }
    const bytes = store.get(u.pathname.split('/')[2]);
    return bytes ? new Response(bytes, { status: 200 }) : new Response('not found', { status: 404 });
  };
  return gw;
}

async function setup() {
  const sim = newSim();
  const key = `0x${randomBytes(32).toString('hex')}`;
  const dir = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: key, recoveryMs: 300, pollMs: 20 });
  const other = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: key, recoveryMs: 300, pollMs: 20 });
  const gw = gateway();
  return { dir, other, gw, swarm: swarmClient({ gateway: 'https://gateway.example.test', fetchFn: gw.fetchFn }) };
}

const sdkBatch = (writer, batch) => {
  const out = { creates: [], patches: [], deletes: [], extensions: [] };
  for (const op of writer.operations(batch)) out[{ create: 'creates', patch: 'patches', delete: 'deletes', extend: 'extensions' }[op.kind]].push(op.params);
  return out;
};

// The first send of `conn` runs `first` (another writer's transaction at our nonce, or ours), then loses its response.
function loseFirstResponse(conn, first) {
  const real = conn.walletClient.executeBatch.bind(conn.walletClient);
  const seen = { calls: 0, foreign: null };
  conn.walletClient.executeBatch = async (batch, opts) => {
    seen.calls += 1;
    if (seen.calls === 1) {
      seen.foreign = await first(batch, opts, real);
      throw new Error('socket hang up');
    }
    return real(batch, opts);
  };
  return seen;
}

const quote = (requestId) => ({ requestId, shopKey, agentEns: 'payer.someone.sim.example.eth', price: 1_000_000n, validUntil: 1_900_000_000n });
const foreignQuote = (other) => (_b, opts) => other.walletClient.executeBatch(sdkBatch(other.writer, { creates: [{ def: ENTITIES.quote, values: quoteValues(quote(`0x${'ab'.repeat(32)}`)), expiration: ExpirationTime.fromMinutes(15) }] }), opts);
const foreignExtend = (other, k) => (_b, opts) => other.walletClient.executeBatch(sdkBatch(other.writer, { extensions: [{ key: k, expiration: ExpirationTime.fromMinutes(15) }] }), opts);
const doc = (name = 'Alpha Sweets') => menuDocument({ shopEns: SHOP, name, items: ITEMS, version: 1 });
const menus = (t) => readAll(t.dir.publicClient, ENTITIES.menu, { owner: t.dir.owner });
const shops = (t) => readAll(t.dir.publicClient, ENTITIES.shop, { owner: t.dir.owner });

test('menu create: a foreign create with our shop key takes our nonce; it is refused, ours is sent again, one row', async () => {
  const t = await setup();
  const seen = loseFirstResponse(t.dir, foreignQuote(t.other));
  const r = await writeMenu(t.dir, t.swarm, { shopEns: SHOP, document: doc() });
  const rows = await menus(t);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].$key, r.entityKey);
  assert.notEqual(r.txHash, seen.foreign.txHash);
});

test('menu create: our own transaction landed and its response was lost; it is taken once, with no second create', async () => {
  const t = await setup();
  const seen = loseFirstResponse(t.dir, (b, opts, real) => real(b, opts));
  const r = await writeMenu(t.dir, t.swarm, { shopEns: SHOP, document: doc() });
  assert.equal(seen.calls, 1);
  const rows = await menus(t);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].$key, r.entityKey);
});

test('menu patch: a changed menu, a foreign transaction at our nonce; the row ends with the new hash', async () => {
  const t = await setup();
  await writeMenu(t.dir, t.swarm, { shopEns: SHOP, document: doc() });
  const q = await createQuote(t.other, quote(`0x${'ef'.repeat(32)}`));
  const seen = loseFirstResponse(t.dir, foreignExtend(t.other, q.entityKey));
  const r = await writeMenu(t.dir, t.swarm, { shopEns: SHOP, document: doc('Alpha Sweets 2') });
  const rows = await menus(t);
  assert.equal(rows.length, 1);
  assert.notEqual(r.txHash, seen.foreign.txHash);
  assert.equal(rows[0].content_hash, sha256Hex(menuBytes({ ...doc('Alpha Sweets 2'), version: 2 })));
});

test('menu patch: only the reference changes (the same bytes elsewhere); the row ends with the new reference', async () => {
  const t = await setup();
  await writeMenu(t.dir, t.swarm, { shopEns: SHOP, document: doc() });
  t.gw.salt = 'b';
  const q = await createQuote(t.other, quote(`0x${'12'.repeat(32)}`));
  const seen = loseFirstResponse(t.dir, foreignExtend(t.other, q.entityKey));
  const r = await writeMenu(t.dir, t.swarm, { shopEns: SHOP, document: doc() });
  const rows = await menus(t);
  assert.equal(rows[0].swarm_ref, r.reference);
  assert.notEqual(r.txHash, seen.foreign.txHash);
});

test('shop patch: only the name changes, a live open-toggle extension takes our nonce; the row ends with the new name', async () => {
  const t = await setup();
  await writeShop(t.dir, { shopEns: SHOP, category: 'sweets', lat: LAT, lng: LNG, name: 'Old Name' });
  const open = await openShop(t.other, { shopKey, shopEns: SHOP });
  const seen = loseFirstResponse(t.dir, foreignExtend(t.other, open.key));
  const r = await writeShop(t.dir, { shopEns: SHOP, category: 'sweets', lat: LAT, lng: LNG, name: 'New Name' });
  const rows = await shops(t);
  assert.equal(fromJsonBytes(rows[0].payload)?.name, 'New Name');
  assert.notEqual(r.txHash, seen.foreign.txHash);
  // The same values again change nothing and send nothing.
  const again = await writeShop(t.dir, { shopEns: SHOP, category: 'sweets', lat: LAT, lng: LNG, name: 'New Name' });
  assert.equal(again.unchanged, true);
  assert.equal(again.txHash, null);
});

test('shop create: a foreign create with our shop key takes our nonce; it is refused, ours is sent again, one row', async () => {
  const t = await setup();
  const seen = loseFirstResponse(t.dir, foreignQuote(t.other));
  const r = await writeShop(t.dir, { shopEns: SHOP, category: 'sweets', lat: LAT, lng: LNG, name: 'Alpha' });
  const rows = await shops(t);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].$key, r.entityKey);
  assert.notEqual(r.txHash, seen.foreign.txHash);
});
