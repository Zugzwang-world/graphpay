// Friday Swarm (ADR-0061): the menu on a gateway (an in-memory stand-in, no network) and its
// `menu` row on ArkivSim. The real gateway probe is recorded in docs/technical/FACTS.md.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { ENTITIES, QUERIES, ZERO_BATCH, SwarmError, castMenus, connectArkiv, menuBytes, menuDocument, menuValues, newSim, readMenu, sha256Hex, swarmClient, writeMenu, writerAddresses } from '../index.mjs';

const SHOP = 'alpha-sweets.sim.example.eth';
const ITEMS = [{ sku: 'box-12', name: 'jamun', unit: 'box of 12', quantity: 12, priceMicro: 4_800_000 }];

// A gateway that stores bytes by content: reference = sha-256 of name + bytes.
function fakeGateway({ reply = null } = {}) {
  const store = new Map();
  const seen = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    if (init.method === 'POST') {
      seen.push({ batch: init.headers['swarm-postage-batch-id'], encrypt: init.headers['swarm-encrypt'], path: u.pathname });
      if (reply) return reply();
      const bytes = new Uint8Array(init.body);
      const reference = createHash('sha256').update(u.searchParams.get('name')).update(bytes).digest('hex');
      store.set(reference, bytes);
      return new Response(JSON.stringify({ reference }), { status: 201 });
    }
    const [, , reference] = u.pathname.split('/');
    const bytes = store.get(reference);
    return bytes ? new Response(bytes, { status: 200 }) : new Response('not found', { status: 404 });
  };
  return { store, seen, fetchFn };
}

async function setup() {
  const sim = newSim();
  const directory = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  const reader = await connectArkiv({ backend: 'sim', sim });
  const gw = fakeGateway();
  const swarm = swarmClient({ gateway: 'https://gateway.example.test', fetchFn: gw.fetchFn });
  const document = menuDocument({ shopEns: SHOP, name: 'Alpha Sweets', items: ITEMS, version: 1 });
  return { directory, reader, gw, swarm, document, owner: directory.owner };
}

test('menu rows are indexed by shop_key only and trusted from W_DIRECTORY', () => {
  assert.deepEqual(QUERIES.menu, ['shop_key']);
  assert.equal(ENTITIES.menu.type, 'menu');
});

test('the gateway client: anonymous zero batch, never encrypted, only 64-hex references, https only', async () => {
  const gw = fakeGateway();
  const swarm = swarmClient({ gateway: 'https://gateway.example.test/', fetchFn: gw.fetchFn });
  const { reference, link } = await swarm.upload(new TextEncoder().encode('{}'), { name: 'menu.json' });
  assert.match(reference, /^[0-9a-f]{64}$/);
  assert.equal(link, `https://gateway.example.test/bzz/${reference}/menu.json`);
  assert.deepEqual(gw.seen, [{ batch: ZERO_BATCH, encrypt: undefined, path: '/bzz' }]);
  assert.equal(ZERO_BATCH.length, 64);
  assert.deepEqual(await swarm.read(reference, 'menu.json'), new TextEncoder().encode('{}'));
  assert.equal(await swarm.read('ab'.repeat(32), 'menu.json'), null);
  await assert.rejects(swarm.read('xyz', 'menu.json'), /64 hex/);
  await assert.rejects(swarm.upload(new Uint8Array(), { name: '../x' }), /file name/);
  assert.throws(() => swarmClient({ gateway: 'http://insecure.example.test', fetchFn: gw.fetchFn }), /https/);
  // An encrypted (128-hex) reference in a reply is refused.
  const enc = swarmClient({ gateway: 'https://gateway.example.test', fetchFn: fakeGateway({ reply: () => new Response(JSON.stringify({ reference: 'a'.repeat(128) }), { status: 201 }) }).fetchFn });
  await assert.rejects(enc.upload(new Uint8Array([1]), { name: 'menu.json' }), /64 hex/);
  // A refusal below 500 is not retried; the status is kept.
  const refused = fakeGateway({ reply: () => new Response('no', { status: 402 }) });
  const r = swarmClient({ gateway: 'https://gateway.example.test', fetchFn: refused.fetchFn });
  await assert.rejects(r.upload(new Uint8Array([1]), { name: 'menu.json' }), (e) => e instanceof SwarmError && e.status === 402);
  assert.equal(refused.seen.length, 1);
});

test('menuValues refuses a reference that is not 64 hex (a 128-hex one is never stored)', () => {
  const bytes = menuBytes({ a: 1 });
  assert.throws(() => menuValues({ shopEns: SHOP, version: 1, reference: 'a'.repeat(128), bytes }), /64 hex/);
  assert.throws(() => menuValues({ shopEns: SHOP, version: 1, reference: 'AB'.repeat(32), bytes }), /64 hex/);
  const v = menuValues({ shopEns: SHOP, version: 1, reference: 'ab'.repeat(32), bytes });
  assert.equal(v.content_hash, sha256Hex(bytes));
  assert.equal(v.size, BigInt(bytes.length));
});

test('write a menu: uploaded, read back, one row; the same menu again changes nothing; a change is version 2', async () => {
  const t = await setup();
  const first = await writeMenu(t.directory, t.swarm, { shopEns: SHOP, document: t.document });
  assert.equal(first.created, true);
  assert.equal(first.version, 1);
  const again = await writeMenu(t.directory, t.swarm, { shopEns: SHOP, document: t.document });
  assert.equal(again.unchanged, true);
  assert.equal(again.txHash, null);
  assert.equal(again.entityKey, first.entityKey);
  const changed = await writeMenu(t.directory, t.swarm, { shopEns: SHOP, document: { ...t.document, items: [{ ...ITEMS[0], priceMicro: 5_000_000 }] } });
  assert.equal(changed.created, false);
  assert.equal(changed.version, 2);
  assert.equal(changed.entityKey, first.entityKey);
  assert.notEqual(changed.reference, first.reference);
  const got = await readMenu(t.reader.publicClient, t.swarm, { shopEns: SHOP, owner: t.owner });
  assert.equal(got.verified, true);
  assert.equal(got.row.version, 2n);
  assert.equal(got.document.items[0].priceMicro, 5_000_000);
  assert.equal(got.link, changed.link);
  assert.equal(got.document.synthetic, true);
});

test('reading: a lost menu is uploaded again with the same reference; a changed byte is refused; no row is null', async () => {
  const t = await setup();
  const w = await writeMenu(t.directory, t.swarm, { shopEns: SHOP, document: t.document });
  t.gw.store.clear();
  const lost = await readMenu(t.reader.publicClient, t.swarm, { shopEns: SHOP, owner: t.owner });
  assert.equal(lost.missing, true);
  assert.equal(lost.document, null);
  const back = await readMenu(t.reader.publicClient, t.swarm, { shopEns: SHOP, owner: t.owner, document: { ...t.document, version: 1 } });
  assert.equal(back.reuploaded, true);
  assert.equal(back.verified, true);
  assert.equal(back.row.swarm_ref, w.reference);
  assert.equal((await readMenu(t.reader.publicClient, t.swarm, { shopEns: SHOP, owner: t.owner })).verified, true);
  // The gateway returns other bytes under the reference: not verified, no document.
  t.gw.store.set(w.reference, new TextEncoder().encode('{"tampered":true}'));
  const bad = await readMenu(t.reader.publicClient, t.swarm, { shopEns: SHOP, owner: t.owner });
  assert.equal(bad.verified, false);
  assert.equal(bad.document, null);
  assert.equal(await readMenu(t.reader.publicClient, t.swarm, { shopEns: 'nobody.sim.example.eth', owner: t.owner }), null);
});

test('another wallet\'s menu row is not trusted', async () => {
  const t = await setup();
  const stranger = await connectArkiv({ backend: 'sim', sim: t.directory.sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  await writeMenu(stranger, t.swarm, { shopEns: SHOP, document: t.document });
  assert.equal(await readMenu(t.reader.publicClient, t.swarm, { shopEns: SHOP, owner: t.owner }), null);
});

test('the cast menus come from the story config and carry no wallet or personal data', () => {
  const menus = castMenus();
  assert.ok(menus.length >= 1);
  for (const m of menus) {
    assert.match(m.shopEns, /\./);
    const doc = menuDocument({ ...m, version: 1 });
    assert.doesNotMatch(JSON.stringify(doc), /0x[0-9a-fA-F]{40}/);
    assert.equal(doc.synthetic, true);
  }
});
