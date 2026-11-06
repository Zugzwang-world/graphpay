// A keyed endpoint whose quota is spent answers 429 QUOTA_EXCEEDED to queries; the transport
// repeats the refused call on the keyless fallback and keeps using it for a while.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArkivSim, arkivChain, arkivClients, arkivTransport, assertChain } from '../index.mjs';
import { CHAIN_ID, ENTITY_CONTRACT } from './helpers.mjs';

const KEYED = 'http://keyed.invalid/secret-access-key-123';
const PUBLIC = 'http://public.invalid/';

function rig({ fallbackMs } = {}) {
  const sim = new ArkivSim({ chainId: CHAIN_ID, entityContract: ENTITY_CONTRACT });
  const seen = [];
  let quota = false;
  const fetchFn = async (url, init) => {
    seen.push(String(url));
    const method = /"method":"([^"]+)"/.exec(init.body)?.[1];
    if (String(url) === KEYED && quota && method !== 'eth_chainId') return new Response(JSON.stringify({ error: 'QUOTA_EXCEEDED', message: 'quota exhausted' }), { status: 429 });
    return sim.fetch(url, init);
  };
  const transport = arkivTransport({ url: KEYED, fallbackUrl: PUBLIC, fallbackMs, fetchFn, secrets: ['secret-access-key-123'] });
  const { publicClient, stats } = arkivClients({ transport, chain: arkivChain({ id: CHAIN_ID }), pollingInterval: 10 });
  return { publicClient, stats, seen, spend: () => { quota = true; }, refill: () => { quota = false; } };
}

test('a spent quota falls back to the public endpoint, repeats the call, and later calls go there', async () => {
  const t = rig();
  await assertChain(t.publicClient, CHAIN_ID);
  assert.equal(t.seen.at(-1), KEYED);
  t.spend();
  assert.equal(await t.publicClient.getBlockNumber() >= 0n, true);
  assert.deepEqual(t.seen.slice(-2), [KEYED, PUBLIC], 'refused on the key, repeated on the fallback');
  assert.equal(t.stats.fallbacks, 1);
  await t.publicClient.getBlockNumber();
  assert.equal(t.seen.at(-1), PUBLIC, 'stays on the fallback');
  assert.equal(t.stats.fallbacks, 1);
});

test('after the fallback window the key is tried again, and a refill brings it back', async () => {
  const t = rig({ fallbackMs: 30 });
  t.spend();
  await t.publicClient.getBlockNumber();
  assert.equal(t.stats.fallbacks, 1);
  await new Promise((r) => setTimeout(r, 60));
  t.refill();
  await t.publicClient.getBlockNumber();
  assert.equal(t.seen.at(-1), KEYED);
  t.spend();
  await new Promise((r) => setTimeout(r, 60));
  await t.publicClient.getBlockNumber();
  assert.equal(t.stats.fallbacks, 2);
});

test('other 429s are not a quota: no fallback, and no secret in the error', async () => {
  const sim = new ArkivSim({ chainId: CHAIN_ID, entityContract: ENTITY_CONTRACT });
  const fetchFn = async (url, init) => (/eth_blockNumber/.test(init.body) ? new Response('slow down', { status: 429 }) : sim.fetch(url, init));
  const transport = arkivTransport({ url: KEYED, fallbackUrl: PUBLIC, fetchFn, secrets: ['secret-access-key-123'] });
  const { publicClient, stats } = arkivClients({ transport, chain: arkivChain({ id: CHAIN_ID }) });
  await assert.rejects(publicClient.getBlockNumber(), (e) => {
    assert.doesNotMatch(`${e.message} ${e.details} ${e.cause?.message}`, /secret-access-key/);
    return true;
  });
  assert.equal(stats.fallbacks, 0);
});
