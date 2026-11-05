// Friday item 1 on ArkivSim: shop_open, agent_presence and handoff rows from W_DIRECTORY,
// their renewals (never past now + the lifetime), their lapse, and the GraphQL reads.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExpirationTime } from '@arkiv-network/sdk';
import { generatePrivateKey } from 'viem/accounts';
import {
  ENTITIES,
  LIFETIME,
  activityHooks,
  agentsOnline,
  boxAround,
  closeShop,
  connectArkiv,
  createGraphEngine,
  discoverShops,
  handoffsFor,
  markPresence,
  newSim,
  openShop,
  openShopKeys,
  recordHandoff,
  runGraphql,
  writeShop,
  writerAddresses,
} from '../index.mjs';

// Test names only (sim.*): no story names in code.
const SHOP = 'alpha-sweets.sim.example.eth';
const OTHER = 'beta-sweets.sim.example.eth';
const OWNER = 'buyer.person.sim.example.eth';
const AGENT = `scout.${OWNER}`;
const PAYER = `payer.${OWNER}`;
const centre = { lat: 19.07, lng: 72.88 };

async function setup() {
  const sim = newSim();
  const directory = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  const reader = await connectArkiv({ backend: 'sim', sim });
  const writers = { ...writerAddresses(), W_DIRECTORY: directory.owner };
  const ask = async (query) => JSON.parse(JSON.stringify(await runGraphql({ engine: createGraphEngine(reader), query, writers })));
  return { sim, directory, reader, writers, ask, owner: directory.owner };
}

const expiresAt = async (t, key) => BigInt((await t.reader.publicClient.getEntity(key)).$expiresAt);
const reach = async (t, minutes) => (await t.reader.publicClient.getBlockNumber({ cacheTime: 0 })) + ExpirationTime.fromMinutes(minutes).minLifetime;

test('shop_open: on, renewed never past now + 15 min, off drops it from "open now", and it lapses', async () => {
  const t = await setup();
  const at = { lat: Math.round(19.072 * 1e6), lng: Math.round(72.881 * 1e6) };
  await writeShop(t.directory, { shopEns: SHOP, category: 'sweets', ...at });
  await writeShop(t.directory, { shopEns: OTHER, category: 'sweets', ...at });
  const { shops } = await discoverShops(t.reader.publicClient, { category: 'sweets', box: boxAround(centre, 3), owner: t.owner });
  const shopKey = shops.find((s) => s.ens === SHOP).shopKey;

  const on = await openShop(t.directory, { shopKey, shopEns: SHOP });
  assert.equal(on.created, true);
  assert.deepEqual([...(await openShopKeys(t.reader.publicClient, { owner: t.owner }))], [shopKey.toLowerCase()]);

  t.sim.advanceSeconds(5 * 60);
  const again = await openShop(t.directory, { shopKey, shopEns: SHOP });
  assert.deepEqual(again, { key: on.key, created: false }, 'found by shop_key and renewed');
  assert.ok((await expiresAt(t, on.key)) <= (await reach(t, LIFETIME.openMinutes)), 'never past now + 15 min');

  const box = '{ latMin: 19000000, latMax: 19200000, lngMin: 72800000, lngMax: 72950000 }';
  const res = await t.ask(`{ shops(category: "sweets", box: ${box}, openNow: true) { ens openNow } }`);
  assert.deepEqual(res.data.shops, [{ ens: SHOP, openNow: true }]);
  assert.equal(res.extensions.arkiv.calls, 2, 'the shops, then their Open rows');

  await closeShop(t.directory, { key: on.key });
  assert.equal((await openShopKeys(t.reader.publicClient, { owner: t.owner })).size, 0, 'off: out of "open now" at once');
  t.sim.advanceSeconds(16 * 60);
  assert.equal(await t.reader.publicClient.getEntity(on.key).catch(() => null), null, 'the row lapses');
});

test('agent_presence: readonly, renewed while it runs, gone 15 minutes after the last renewal', async () => {
  const t = await setup();
  const first = await markPresence(t.directory, { agentEns: AGENT, ownerEns: OWNER, role: 'scout', session: 'run-1' });
  assert.equal(first.created, true);
  assert.equal((await t.reader.publicClient.getEntity(first.key)).$creationFlags?.readonly, true);
  t.sim.advanceSeconds(5 * 60);
  const before = await expiresAt(t, first.key);
  const renewed = await markPresence(t.directory, { agentEns: AGENT, ownerEns: OWNER, role: 'scout', session: 'run-1', key: first.key });
  assert.equal(renewed.created, false);
  assert.ok((await expiresAt(t, first.key)) > before);
  assert.ok((await expiresAt(t, first.key)) <= (await reach(t, LIFETIME.presenceMinutes)));

  const online = await agentsOnline(t.reader.publicClient, { owner: t.owner, ownerEns: OWNER });
  assert.deepEqual(online.map((a) => [a.agentEns, a.role, a.session]), [[AGENT, 'scout', 'run-1']]);
  const q = await t.ask(`{ agentsOnline(owner: "${OWNER}") { agent { ens } role session } }`);
  assert.deepEqual(q.data.agentsOnline, [{ agent: { ens: AGENT }, role: 'scout', session: 'run-1' }]);

  t.sim.advanceSeconds(16 * 60);
  assert.equal((await agentsOnline(t.reader.publicClient, { owner: t.owner, ownerEns: OWNER })).length, 0);
  const back = await markPresence(t.directory, { agentEns: AGENT, ownerEns: OWNER, role: 'scout', session: 'run-1', key: first.key });
  assert.equal(back.created, true, 'a lapsed row is created again');
});

test("handoffs: one run's, oldest first, readonly, gone after 30 minutes; the agents' hooks write both", async () => {
  const t = await setup();
  const hooks = activityHooks(t.directory);
  await hooks.presence('start', { agentEns: AGENT, ownerEns: OWNER, role: 'scout', session: 'run-2' });
  await hooks.presence('renew', { agentEns: AGENT, ownerEns: OWNER, role: 'scout', session: 'run-2' });
  assert.equal((await agentsOnline(t.reader.publicClient, { owner: t.owner, session: 'run-2' })).length, 1, 'one row per agent and run');

  await hooks.handoff(AGENT, PAYER, 'pay', { requestId: 'run-2' });
  t.sim.advanceSeconds(10);
  await recordHandoff(t.directory, { requestId: 'run-2', fromAgent: PAYER, toAgent: AGENT, step: 'receipt' });
  await recordHandoff(t.directory, { requestId: 'run-3', fromAgent: AGENT, toAgent: PAYER, step: 'pay' });
  const list = await handoffsFor(t.reader.publicClient, 'run-2', { owner: t.owner });
  assert.deepEqual(list.map((h) => h.step), ['pay', 'receipt']);
  assert.equal((await t.reader.publicClient.getEntity(list[0].key)).$creationFlags?.readonly, true);
  const q = await t.ask('{ handoffs(requestId: "run-2") { from { ens } to { ens } step } }');
  assert.deepEqual(q.data.handoffs.map((h) => [h.from.ens, h.to.ens, h.step]), [[AGENT, PAYER, 'pay'], [PAYER, AGENT, 'receipt']]);

  // Another wallet's rows look the same and are never read.
  const spoofer = await connectArkiv({ backend: 'sim', sim: t.sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey() });
  await recordHandoff(spoofer, { requestId: 'run-2', fromAgent: AGENT, toAgent: PAYER, step: 'refund' });
  assert.equal((await handoffsFor(t.reader.publicClient, 'run-2', { owner: t.owner })).length, 2);

  t.sim.advanceSeconds(31 * 60);
  assert.equal((await handoffsFor(t.reader.publicClient, 'run-2', { owner: t.owner })).length, 0);
  assert.ok(ENTITIES.handoff.readonly);
});
