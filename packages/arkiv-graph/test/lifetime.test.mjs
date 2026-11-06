// A store keeps its rows alive and its writes whole: a row it patches is extended before it
// expires, a split write sends whole events with their checkpoint in each transaction (so a
// failure part-way leaves nothing half-counted), and a batch the SDK refuses before sending
// fails at once instead of waiting out the recovery window.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ArkivSim, ENTITY_ADDRESS, ExpirationTime, arkivChain, arkivClients, arkivTransport, connect, createStore, createWriter, defineGraph, nodeKeyOf } from '../index.mjs';

const graph = () =>
  defineGraph({
    project: 'lifetime-test',
    node: { columns: ['handle:str'] },
    totals: { counters: ['follows', 'likes'], rules: { follow: { follows: 'count' }, like: { likes: 'count' } } },
  });
const person = (handle) => ({ node: nodeKeyOf(handle), epoch: 0, kind: 'person', columns: { handle } });
const ts = 1_760_000_000;
const like = (ref, from, block, logIndex = 0) => ({ ref, kind: 'like', from: person(from), to: person('grace'), ts, position: { block, logIndex } });
const likesOf = async (store, who = 'grace') => (await store.query('totals', { filter: { node: { eq: nodeKeyOf(who) }, window: { eq: 'all' } } })).rows.map((r) => r.likes);

test('rows a store keeps patching outlive the lifetime they were created with', async () => {
  const arkiv = await connect();
  const store = createStore({ graph: graph(), arkiv, stream: 's', days: 1 });
  await store.write([like('e1', 'ada', 1n)]);
  for (let i = 2; i <= 5; i += 1) {
    arkiv.sim.advanceSeconds(13 * 3600); // past half the lifetime: the next write extends what it patches
    await store.write([like(`e${i}`, 'ada', BigInt(i))]);
  }
  // 52 hours after the rows were created with a 1-day lifetime.
  assert.deepEqual(await likesOf(store), [5n]);
  // A fresh store adopts the extended rows and their checkpoint: a replay counts nothing twice.
  const restarted = createStore({ graph: graph(), arkiv, stream: 's', days: 1 });
  assert.deepEqual((await restarted.write([like('e4', 'ada', 4n), like('e5', 'ada', 5n)])).applied, []);
  assert.deepEqual(await likesOf(restarted), [5n]);
});

test('a write well inside the lifetime sends no extension', async () => {
  const arkiv = await connect();
  const store = createStore({ graph: graph(), arkiv, stream: 's', days: 30 });
  await store.write([like('e1', 'ada', 1n)]);
  arkiv.sim.advanceSeconds(3600);
  const before = arkiv.sim.stats.byMethod.eth_sendRawTransaction ?? 0;
  const ops = [];
  const send = arkiv.writer.send;
  arkiv.writer.send = (batch, options) => (ops.push(batch.extensions?.length ?? 0), send(batch, options));
  await store.write([like('e2', 'ada', 2n)]);
  assert.deepEqual(ops, [0]);
  assert.equal((arkiv.sim.stats.byMethod.eth_sendRawTransaction ?? 0) - before, 1);
});

test('a split write that fails part-way leaves whole events behind, and a replay completes it exactly', async () => {
  const arkiv = await connect();
  const store = createStore({ graph: graph(), arkiv, stream: 's' });
  await store.write([like('seed', 'zed', 1n)]);
  const events = Array.from({ length: 12 }, (_, i) => like(`e${i}`, `fan${i}`, 2n, i));
  const real = arkiv.walletClient.executeBatch.bind(arkiv.walletClient);
  let calls = 0;
  arkiv.walletClient.executeBatch = async (batch, options) => {
    calls += 1;
    if (calls === 2) throw Object.assign(new Error('execution reverted'), { name: 'ExecutionRevertedError' });
    return real(batch, options);
  };
  await assert.rejects(store.write(events, { split: true }), { name: 'WriteRevertedError' });
  arkiv.walletClient.executeBatch = real;
  assert.ok(calls >= 2);
  const retry = await store.write(events, { split: true });
  assert.equal(retry.applied.length + retry.skipped.length, 12);
  assert.ok(retry.skipped.length > 0, 'the first transaction landed whole, so its events are skipped');
  assert.deepEqual(await likesOf(store), [13n]);
  const edges = await store.query('edge', { filter: { to_node: { eq: nodeKeyOf('grace') } }, limit: 200 });
  assert.equal(edges.rows.length, 13);
  for (let i = 0; i < 12; i += 1) assert.deepEqual(await likesOf(store, `fan${i}`), [1n], `fan${i}`);
});

test('a split write sends several transactions, each with whole events', async () => {
  const arkiv = await connect();
  const store = createStore({ graph: graph(), arkiv, stream: 's' });
  const events = Array.from({ length: 40 }, (_, i) => like(`e${i}`, `fan${i}`, 1n, i));
  await assert.rejects(store.write(events), /only split mode cuts a batch/);
  const r = await store.write(events, { split: true });
  assert.equal(r.applied.length, 40);
  assert.ok(r.txs.length > 1);
  assert.deepEqual(await likesOf(store), [40n]);
});

test('days must be a lifetime Arkiv accepts', async () => {
  const arkiv = await connect();
  for (const days of [0, -1, 183, 365, Number.NaN, '30']) assert.throws(() => createStore({ graph: graph(), arkiv, days }), /days is how long rows live/, String(days));
  assert.doesNotThrow(() => createStore({ graph: graph(), arkiv, days: 182 }));
});

test('a batch the SDK refuses before sending fails at once, with the SDK error', async () => {
  const sim = new ArkivSim({ chainId: 31337001, entityContract: ENTITY_ADDRESS });
  const transport = arkivTransport({ url: 'http://arkivsim.invalid/', fetchFn: sim.fetch });
  const { publicClient, walletClient, sentHashes } = arkivClients({ transport, chain: arkivChain({ id: 31337001 }), account: privateKeyToAccount(generatePrivateKey()), pollingInterval: 20 });
  const writer = createWriter({ walletClient, publicClient, entityContract: ENTITY_ADDRESS, sentHashes, recoveryMs: 5_000, pollMs: 100 });
  const g = graph();
  const plan = g.plan([like('e1', 'ada', 1n)], g.newState(), {});
  const started = Date.now();
  await assert.rejects(writer.send({ creates: plan.creates.map((c) => ({ ...c, expiration: ExpirationTime.fromDays(365) })) }), { name: 'InvalidExpiryError' });
  assert.ok(Date.now() - started < 2_000, 'no recovery wait');
  assert.equal(sim.stats.byMethod.eth_sendRawTransaction ?? 0, 0);
});

test('a filter over the predicate budget is refused with a clear error, before any read', async () => {
  const arkiv = await connect();
  const store = createStore({ graph: graph(), arkiv });
  const keys = (n) => Array.from({ length: n }, (_, i) => nodeKeyOf(`p${i}`));
  assert.equal((await store.query('totals', { filter: { node: { in: keys(61) } } })).rows.length, 0);
  const calls = arkiv.sim.stats.requests;
  await assert.rejects(store.query('totals', { filter: { node: { in: keys(62) } } }), /65 predicates.*allows 64/);
  assert.equal(arkiv.sim.stats.requests, calls);
});

test('a u64 filter takes a bigint, a safe integer or digits, and an i32 filter a bigint in range', async () => {
  const { compileFilter } = await import('../index.mjs');
  const def = defineGraph({ project: 'f', entities: { item: { columns: ['n:u64/i', 'x:i32/i'] } } }).defs.item;
  for (const ok of [5n, 5, '5', '0x05']) assert.doesNotThrow(() => compileFilter(def, { n: { eq: ok } }), String(ok));
  for (const bad of [true, '', ' 5', 2 ** 60 + 1, 1.5, -1]) assert.throws(() => compileFilter(def, { n: { eq: bad } }), /needs an integer|outside u64/, String(bad));
  assert.doesNotThrow(() => compileFilter(def, { x: { gte: -5n } }));
  assert.throws(() => compileFilter(def, { x: { gte: 2n ** 40n } }), /outside i32/);
});

test('a split write the node finds too large goes out in smaller groups, still whole events', async () => {
  // A node whose request limit is below the 120 KB the store plans for answers 413.
  const arkiv = await connect({ sim: new ArkivSim({ chainId: 31337001, entityContract: ENTITY_ADDRESS, requestLimit: 64 * 1024 }) });
  const store = createStore({ graph: graph(), arkiv, stream: 's' });
  const events = Array.from({ length: 12 }, (_, i) => like(`e${i}`, `fan${i}`, 1n, i));
  const r = await store.write(events, { split: true });
  assert.equal(r.applied.length, 12);
  assert.ok((arkiv.sim.stats.status[413] ?? 0) > 0, 'the node refused a group as too large');
  assert.deepEqual(await likesOf(store), [12n]);
});

test('days must be a lifetime the Arkiv SDK can set', async () => {
  const arkiv = await connect();
  assert.throws(() => createStore({ graph: graph(), arkiv, days: 1e-5 }), /not a lifetime Arkiv can set/);
});
