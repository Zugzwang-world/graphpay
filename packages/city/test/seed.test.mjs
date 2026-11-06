// A batch the node refuses part-way (on Rabdi, Sat 7 Nov: `Store(Entity(Store(HandleInvalid)))` on a
// batch's second transaction, after the first had landed) is undone, creates and patches, and sent
// again; a run that stops there leaves Arkiv at the batch before; a run that died there is undone
// from outside. Each ends exactly as a clean load (ArkivSim, no network).
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

// The clean load, and the first send that follows a landed transaction carrying patches (that
// transaction is not its batch's last), so a refusal there leaves patches to set back.
let clean;
let afterPatches;
test('a clean load, the reference', async () => {
  const { conn, city, manifest } = await store();
  const sends = [];
  const send = conn.writer.send;
  conn.writer.send = async (batch, opts) => {
    const r = await send(batch, opts);
    sends.push(r.txs.map((t) => t.patches));
    return r;
  };
  await seedGraph(city, conn, { manifest });
  clean = await rowsOf(conn);
  assert.ok(clean.edge.length > 800);
  let n = 0;
  for (const chunks of sends) {
    for (const [j, patches] of chunks.entries()) {
      n += 1;
      if (afterPatches === undefined && j < chunks.length - 1 && patches > 0) afterPatches = n + 1;
    }
  }
  assert.ok(afterPatches, 'a batch with patches in a transaction before its last');
});

test('a batch refused after patches landed is undone, patches set back, and sent again within the run', async () => {
  const { conn, city, manifest } = await store(afterPatches);
  const log = [];
  await seedGraph(city, conn, { manifest, pauseMs: 10, log: (l) => log.push(l) });
  assert.ok(log.some((l) => /undid [1-9]\d* creates and [1-9]\d* patches/.test(l)), log.join('\n'));
  assert.deepEqual(await rowsOf(conn), clean);
});

test('a run that stops at a refused batch leaves Arkiv at the batch before, and the next run resumes there', async () => {
  const { conn, city, manifest } = await store(afterPatches);
  const error = await seedGraph(city, conn, { manifest, retries: 0, pauseMs: 10 }).catch((e) => e);
  assert.ok(Number.isInteger(error.batch) && error.undone.restored > 0, String(error.message));
  await seedGraph(city, conn, { manifest: newManifest({ size: 'S', store: 'graph', owner: conn.owner, dataset: city.dataset, backend: 'sim' }), fromBatch: error.batch });
  assert.deepEqual(await rowsOf(conn), clean);
});

test('a run that died part-way is undone from outside (creates only) and the next run resumes at that batch', async () => {
  // Send 9 is the second transaction of a batch whose first carries only creates.
  const { conn, city, manifest } = await store(9);
  const fromBlock = await conn.publicClient.getBlockNumber();
  const error = await seedGraph(city, conn, { manifest, retries: 0, undoOnFailure: false }).catch((e) => e);
  assert.ok(Number.isInteger(error.batch), String(error.message));
  // The dead run's manifest counts only whole batches, so its count is the first nonce to undo.
  const undo = await undoSince(conn, null, { nonce: manifest.transactions, fromBlock });
  assert.ok(undo.deleted > 0 && undo.restored === 0);
  await seedGraph(city, conn, { manifest: newManifest({ size: 'S', store: 'graph', owner: conn.owner, dataset: city.dataset, backend: 'sim' }), fromBatch: error.batch });
  assert.deepEqual(await rowsOf(conn), clean);
});

test('an outside undo refuses a landed patch it cannot set back', async () => {
  const { conn, city, manifest } = await store(afterPatches);
  const fromBlock = await conn.publicClient.getBlockNumber();
  await seedGraph(city, conn, { manifest, retries: 0, undoOnFailure: false }).catch(() => {});
  await assert.rejects(undoSince(conn, null, { nonce: manifest.transactions, fromBlock }), /cannot set back/);
});

test('a run resumes only where the store ends', async () => {
  const { conn, city, manifest } = await store(afterPatches);
  const error = await seedGraph(city, conn, { manifest, retries: 0, pauseMs: 10 }).catch((e) => e);
  const fresh = () => newManifest({ size: 'S', store: 'graph', owner: conn.owner, dataset: city.dataset, backend: 'sim' });
  await assert.rejects(seedGraph(city, conn, { manifest: fresh(), fromBatch: error.batch + 1 }), /holds \d+ edge rows, but batch/);
  await assert.rejects(seedGraph(city, conn, { manifest: fresh(), fromBatch: error.batch - 1 }), /holds \d+ edge rows, but batch/);
  await assert.rejects(seedGraph(city, conn, { manifest: fresh(), fromBatch: 1.5 }), /not a batch number/);
});
