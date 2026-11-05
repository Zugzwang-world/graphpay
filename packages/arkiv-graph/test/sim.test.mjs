import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExpirationTime, str, u64, i32 } from '@arkiv-network/sdk';
import { and, eq, or, between } from '@arkiv-network/sdk/query';
import { defineEntity, entityValues, isRequestTooLarge, parseQuery, plainRow, renderQuery } from '../index.mjs';
import { setup } from './helpers.mjs';

const ctx = { project: 'demo' };
const note = defineEntity('note', { columns: ['topic:str/i', 'score:u64/i', 'lat:i32/i', 'hidden:str/o', 'body:bytes/o'] }, ctx);
const locked = defineEntity('receipt', { columns: ['amount:u64/i'], readonly: true }, ctx);
const day = ExpirationTime.fromDays(1);

async function create(t, def, values, expiration = day) {
  const res = await t.walletClient.createEntity(def.schema, entityValues(def, values), { expiration, flags: { readonly: def.readonly } });
  return res.entityKey;
}

const scoped = (def) => [eq('project', str('demo')), eq('type', str(def.type))];

test('the stock SDK writes and reads through ArkivSim; a repeated create duplicates', async () => {
  const t = setup();
  await create(t, note, { topic: 'a', score: 5n, lat: -19_000_000, hidden: 'x' });
  await create(t, note, { topic: 'a', score: 5n, lat: -19_000_000, hidden: 'x' });
  const res = await t.publicClient.select('*').from(note.schema).where(...scoped(note), eq('topic', str('a'))).ownedBy(t.owner).fetch();
  assert.equal(res.entities.length, 2);
  assert.notEqual(res.entities[0].$key, res.entities[1].$key);
  const row = plainRow(res.entities[0]);
  assert.equal(row.score, 5n);
  assert.equal(row.lat, -19_000_000);
  const count = await t.publicClient.count().from(note.schema).where(...scoped(note)).ownedBy(t.owner).fetch();
  assert.equal(count, 2n);
});

test('a filter on a stored-only attribute matches nothing; a u256 literal on a u64 column matches nothing', async () => {
  const t = setup();
  await create(t, note, { topic: 'a', score: 5n, lat: 1, hidden: 'x' });
  const q = (where) => t.publicClient.query(where, { limit: 10 });
  assert.equal((await q(`project = str('demo') AND hidden = str('x')`)).entities.length, 0);
  assert.equal((await q(`project = str('demo') AND score = u256(5)`)).entities.length, 0);
  assert.equal((await q(`project = str('demo') AND score = u64(5)`)).entities.length, 1);
});

test('i32 ranges, negative values and the owner filter', async () => {
  const t = setup();
  const other = setup();
  await create(t, note, { topic: 'geo', score: 1n, lat: -500 });
  await create(t, note, { topic: 'geo', score: 1n, lat: 700 });
  const inBox = await t.publicClient.select('*').from(note.schema).where(...scoped(note), between('lat', i32(-1000), i32(0))).ownedBy(t.owner).fetch();
  assert.equal(inBox.entities.length, 1);
  const spoof = await other.publicClient.select('*').from(note.schema).where(...scoped(note)).ownedBy(other.owner).fetch();
  assert.equal(spoof.entities.length, 0, 'another owner sees none of these rows');
});

test('pages of 100, limit 101 refused, ORDER BY with ties in creation order', async () => {
  const t = setup();
  const creates = Array.from({ length: 120 }, (_, i) => ({ schema: note.schema, values: entityValues(note, { topic: 'p', score: BigInt(i % 3), lat: i }), expiration: day }));
  await t.walletClient.executeBatch({ creates: creates.slice(0, 60) });
  await t.walletClient.executeBatch({ creates: creates.slice(60) });
  const page = await t.publicClient.query(`type = str('note') AND topic = str('p')`, { limit: 100 });
  assert.equal(page.entities.length, 100);
  await assert.rejects(t.sim.dispatch('arkiv_query', [`topic = str('p')`, { limit: '0x65' }]));
  const sorted = await t.publicClient.select('*').from(note.schema).where(...scoped(note)).orderBy({ kind: 'order', name: 'score', type: 'u64', direction: 'desc' }).limit(5).fetch();
  assert.deepEqual(sorted.entities.map((e) => e.score.value), [2n, 2n, 2n, 2n, 2n]);
  assert.deepEqual(sorted.entities.map((e) => e.lat.value), [2, 5, 8, 11, 14]);
});

test('64 predicate leaves pass and 65 are refused with -32004', async () => {
  const t = setup();
  const terms = (n) => Array.from({ length: n }, (_, i) => eq('topic', str(`t${i}`)));
  await t.publicClient.query(and(eq('project', str('demo')), or(terms(63))), { limit: 1 });
  await assert.rejects(t.publicClient.query(and(eq('project', str('demo')), or(terms(64))), { limit: 1 }), (e) => e.code === -32004);
});

test('a readonly entity refuses a patch, can still be deleted', async () => {
  const t = setup();
  const k = await create(t, locked, { amount: 10n });
  await assert.rejects(t.walletClient.patchEntity(locked.schema, k, { set: { amount: u64(11n) } }), /ReadOnlyEntity|readonly|read-only/i);
  const flags = (await t.publicClient.select({ $creationFlags: true }).from(locked.schema).where(...scoped(locked)).ownedBy(t.owner).fetch()).entities[0].$creationFlags;
  assert.equal(flags.readonly, true);
  await t.walletClient.deleteEntity({ entityKey: k });
  assert.equal(await t.publicClient.getEntity(k).catch(() => null), null);
});

test('a batch is atomic: one failing operation reverts all of it', async () => {
  const t = setup();
  const k = await create(t, locked, { amount: 1n });
  await assert.rejects(
    t.walletClient.executeBatch({
      creates: [{ schema: note.schema, values: entityValues(note, { topic: 'atomic', score: 1n, lat: 0 }), expiration: day }],
      patches: [{ schema: locked.schema, entityKey: k, set: { amount: u64(2n) } }],
    }),
  );
  const n = await t.publicClient.count().from(note.schema).where(...scoped(note), eq('topic', str('atomic'))).fetch();
  assert.equal(n, 0n);
});

test('an entity is gone after its expiry (minute-scale)', async () => {
  const t = setup();
  await create(t, note, { topic: 'brief', score: 1n, lat: 0 }, ExpirationTime.fromMinutes(15));
  const count = () => t.publicClient.count().from(note.schema).where(...scoped(note), eq('topic', str('brief'))).fetch();
  assert.equal(await count(), 1n);
  t.sim.advanceSeconds(14 * 60);
  assert.equal(await count(), 1n);
  t.sim.advanceSeconds(2 * 60);
  assert.equal(await count(), 0n);
});

test('a request body over 256 KiB gets HTTP 413, visible down the cause chain', async () => {
  const t = setup();
  const big = `0x${'ab'.repeat(100_000)}`;
  const creates = [0, 1].map(() => ({ schema: note.schema, values: entityValues(note, { topic: 'big', score: 1n, lat: 0, body: big }), expiration: day }));
  const error = await t.walletClient.executeBatch({ creates }).catch((e) => e);
  assert.ok(error instanceof Error);
  assert.equal(isRequestTooLarge(error), true);
  assert.equal(t.sim.stats.status[413] >= 1, true);
});

test('the parser renders what the SDK renders, and parses its own output', () => {
  const text = and(eq('project', str("o'k")), or(eq('score', u64(3n)), between('lat', i32(-5), i32(5)))).toString();
  const parsed = parseQuery(`${text} ORDER BY score:u64 DESC`);
  assert.equal(renderQuery(parsed.where), text);
  assert.deepEqual(parsed.orderBy, { name: 'score', tag: 'u64', direction: 'DESC' });
  assert.throws(() => parseQuery(`a = str('x') OR (b = str('y')`));
});
