// A batch the node refuses part-way (on Rabdi, Sat 7 Nov: `Store(Entity(Store(HandleInvalid)))` on a
// batch's second transaction, after the first had landed) is undone and sent again, within the run
// or after a stopped run, so the store ends exactly as a clean load (ArkivSim, no network).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey } from 'viem/accounts';
import { readAll } from '@graphpay_ethglobal/arkiv-graph';
import { story } from '@graphpay/config';
import { ENTITIES, connectArkiv, newSim } from '@graphpay/money-graph';
import { generateCity, newManifest, seedGraph, undoSince } from '../index.mjs';

// The sim answers the `n`th transaction send (counted from 1) with the revert Rabdi gave.
function refusing(sim, n) {
  const fetch = sim.fetch;
  let sends = 0;
  sim.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (!Array.isArray(body) && body.method === 'eth_sendRawTransaction' && (sends += 1) === n) {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: 3, message: 'execution reverted: Store(Entity(Store(HandleInvalid)))' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return fetch(url, init);
  };
}

// Every row of the store, without its key or blocks.
async function rowsOf(conn) {
  const out = {};
  for (const t of ['edge', 'node', 'tally', 'link']) {
    const rows = await readAll(conn.publicClient, ENTITIES[t], { owner: conn.owner, cap: 100_000 });
    out[t] = rows.map((r) => JSON.stringify(Object.entries(r).filter(([k]) => !k.startsWith('$')).sort(), (_, v) => (typeof v === 'bigint' ? String(v) : v))).sort();
  }
  return out;
}

async function store(refuseSend = null) {
  const sim = newSim({ rateLimit: 1_000_000_000 });
  if (refuseSend) refusing(sim, refuseSend);
  const conn = await connectArkiv({ backend: 'sim', sim, role: 'W_SEED_EVENT', privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  const city = generateCity({ story, size: 'S', end: '2026-11-05' });
  return { conn, city, manifest: newManifest({ size: 'S', store: 'graph', owner: conn.owner, dataset: city.dataset, backend: 'sim' }) };
}

let clean;
test('a clean load, the reference', async () => {
  const { conn, city, manifest } = await store();
  await seedGraph(city, conn, { manifest });
  clean = await rowsOf(conn);
  assert.ok(clean.edge.length > 800);
});

// Send 9 is the second transaction of a batch (the first batches take one or two each).
test('a batch refused part-way is undone and sent again within the run', async () => {
  const { conn, city, manifest } = await store(9);
  const log = [];
  await seedGraph(city, conn, { manifest, pauseMs: 10, log: (l) => log.push(l) });
  assert.ok(log.some((l) => /undid [1-9]\d* creates/.test(l)), log.join('\n'));
  assert.deepEqual(await rowsOf(conn), clean);
});

test('after a run stopped part-way, its landed part is undone and the next run resumes at that batch', async () => {
  const { conn, city, manifest } = await store(9);
  const fromBlock = await conn.publicClient.getBlockNumber();
  const error = await seedGraph(city, conn, { manifest, retries: 0 }).catch((e) => e);
  assert.ok(Number.isInteger(error.batch), String(error.message));
  // The stopped run's manifest counts only whole batches, so its count is the first nonce to undo.
  const undo = await undoSince(conn, null, { nonce: manifest.transactions, fromBlock });
  assert.ok(undo.deleted > 0 && undo.restored === 0);
  await seedGraph(city, conn, { manifest: newManifest({ size: 'S', store: 'graph', owner: conn.owner, dataset: city.dataset, backend: 'sim' }), fromBatch: error.batch });
  assert.deepEqual(await rowsOf(conn), clean);
});
