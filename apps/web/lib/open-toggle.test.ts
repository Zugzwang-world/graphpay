import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { connectArkiv, identityKey, newSim, nodeOf, openShopKeys } from '@graphpay/money-graph';
import { directoryConfigured, setShopOpen } from './open-toggle.server.ts';

// These tests check the gated mode; public access (ADR-0069) is tested on its own.
process.env.GRAPHPAY_PUBLIC_ACCESS = '0';

// Test names only (sim.*): the web code never holds story names.
const SHOP = 'alpha-sweets.sim.example.eth';
const shopKey = identityKey(nodeOf(SHOP), 0);

async function directory() {
  const sim = newSim();
  const dir = await connectArkiv({ backend: 'sim', sim, role: 'W_DIRECTORY', privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  const reader = await connectArkiv({ backend: 'sim', sim });
  const openNow = async (nowS: number) => (await openShopKeys(reader.publicClient, { owner: dir.owner as string, now: nowS })).has(shopKey.toLowerCase());
  return { dir, openNow };
}

test('Open lists the shop; a renewal keeps one row; Close takes it off at once; Close again writes nothing', async () => {
  const { dir, openNow } = await directory();
  const t0 = Math.floor(Date.now() / 1000);
  const first = await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: true, nowS: t0 });
  assert.equal(first.open, true);
  assert.equal(first.openUntil, t0 + 900);
  assert.match(first.entityKey ?? '', /^0x[0-9a-f]{64}$/);
  assert.equal(await openNow(t0 + 1), true);

  // Five minutes later: the same row is renewed, not a second one.
  const renewed = await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: true, nowS: t0 + 300 });
  assert.equal(renewed.entityKey, first.entityKey);
  assert.equal(await openNow(t0 + 301), true);

  const closed = await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: false, nowS: t0 + 400 });
  assert.deepEqual({ open: closed.open, openUntil: closed.openUntil }, { open: false, openUntil: null });
  assert.equal(closed.entityKey, first.entityKey);
  assert.equal(await openNow(t0 + 401), false);

  // Already closed: no entity key, nothing written.
  const again = await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: false, nowS: t0 + 500 });
  assert.deepEqual(again, { open: false, openUntil: null, entityKey: null });
});

test('a shop that was never opened closes without a write', async () => {
  const { dir } = await directory();
  assert.deepEqual(await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: false }), { open: false, openUntil: null, entityKey: null });
});

test('the toggle is on only when the W_DIRECTORY key is configured on this server', () => {
  assert.equal(directoryConfigured({}), false);
  assert.equal(directoryConfigured({ W_DIRECTORY_PRIVATE_KEY: '0x01' }), true);
});

test('a second Open right after the first writes nothing; one 5 minutes later renews', async () => {
  const { dir } = await directory();
  const t0 = Math.floor(Date.now() / 1000);
  const first = await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: true, nowS: t0 });
  const block = await dir.publicClient.getBlockNumber({ cacheTime: 0 });
  const again = await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: true, nowS: t0 + 20 });
  assert.equal(again.entityKey, first.entityKey);
  assert.equal(await dir.publicClient.getBlockNumber({ cacheTime: 0 }), block, 'a double tap sent a transaction');
  await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: true, nowS: t0 + 300 });
  assert.ok((await dir.publicClient.getBlockNumber({ cacheTime: 0 })) > block, 'the 5-minute renewal wrote nothing');
});

test('Open and Close that overlap run in order: the shop ends closed, never re-listed by a late Open', async () => {
  const { dir, openNow } = await directory();
  const t0 = Math.floor(Date.now() / 1000);
  await Promise.all([setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: true, nowS: t0 }), setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: false, nowS: t0 + 5 })]);
  assert.equal(await openNow(t0 + 6), false);
});

test('a failed close is an error, not a closed shop', async () => {
  const { dir, openNow } = await directory();
  const t0 = Math.floor(Date.now() / 1000);
  await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: true, nowS: t0 });
  const send = dir.writer?.send.bind(dir.writer);
  assert.ok(dir.writer && send);
  dir.writer.send = async () => {
    throw new Error('boom');
  };
  await assert.rejects(setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: false, nowS: t0 + 10 }), /boom/);
  assert.equal(await openNow(t0 + 11), true, 'the failed close left the shop listed');
  dir.writer.send = send;
  await setShopOpen({ arkiv: dir, shopKey, shopEns: SHOP, on: false, nowS: t0 + 20 });
  assert.equal(await openNow(t0 + 21), false, 'a later close works (the queue is not stuck)');
});

test('the route: 401 before any Arkiv call, 400 for a body that is not a boolean', async () => {
  const { POST } = await import('../app/api/merchant/open/route.ts');
  const env = { pass: process.env.DEMO_PASSCODE, key: process.env.W_DIRECTORY_PRIVATE_KEY };
  process.env.DEMO_PASSCODE = 'p'.repeat(28);
  process.env.W_DIRECTORY_PRIVATE_KEY = '0x01';
  try {
    const url = 'https://example.test/api/merchant/open';
    assert.equal((await POST(new Request(url, { method: 'POST', body: JSON.stringify({ on: true }) }))).status, 401);
    const headers = { 'x-demo-passcode': 'p'.repeat(28) };
    assert.equal((await POST(new Request(url, { method: 'POST', headers, body: JSON.stringify({ on: 'yes' }) }))).status, 400);
    assert.equal((await POST(new Request(url, { method: 'POST', headers, body: '{}' }))).status, 400);
  } finally {
    if (env.pass === undefined) delete process.env.DEMO_PASSCODE;
    else process.env.DEMO_PASSCODE = env.pass;
    if (env.key === undefined) delete process.env.W_DIRECTORY_PRIVATE_KEY;
    else process.env.W_DIRECTORY_PRIVATE_KEY = env.key;
  }
});
