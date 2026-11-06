// Rows that do not fit the schema: the SDK leaves them out of a page but the node counts them
// toward the limit and the offset (QueryResult.skipped). Paging must read past them: a page
// that returns fewer rows than its limit is the last only when it also covered fewer matches.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExpirationTime, connect, createStore, defineGraph, findOne, readAll } from '../index.mjs';

// The same entity before and after a required column was added: v0 rows do not fit v1.
const v0 = defineGraph({ project: 'app', entities: { item: { columns: ['n:u64/i'] } } });
const v1 = defineGraph({ project: 'app', entities: { item: { columns: ['n:u64/i', 'label:str'] } } });
const exp = ExpirationTime.fromDays(1);

async function seed({ old, current }) {
  const arkiv = await connect();
  const write = (def, values) => arkiv.writer.send({ creates: values.map((v) => ({ def, values: v, expiration: exp })) }, { split: true });
  await write(v0.defs.item, Array.from({ length: old }, () => ({ n: 0n })));
  await write(v1.defs.item, Array.from({ length: current }, (_, i) => ({ n: BigInt(i + 1), label: `x${i}` })));
  return arkiv;
}

test('readAll reads past rows that do not fit, even whole pages of them', async () => {
  const mixed = await seed({ old: 120, current: 130 });
  assert.equal((await readAll(mixed.publicClient, v1.defs.item, { owner: mixed.owner })).length, 130);
  // 300 rows that do not fit around one that does: some pages hold no row at all.
  const sparse = await seed({ old: 300, current: 1 });
  const rows = await readAll(sparse.publicClient, v1.defs.item, { owner: sparse.owner });
  assert.deepEqual(rows.map((r) => r.n), [1n]);
});

test('findOne finds a row behind matches that do not fit', async () => {
  const arkiv = await seed({ old: 150, current: 1 });
  const row = await findOne(arkiv.publicClient, v1.defs.item, { owner: arkiv.owner });
  assert.equal(row?.label, 'x0');
});

test('store.query pages past rows that do not fit and says how many it left out', async () => {
  const arkiv = await seed({ old: 120, current: 130 });
  const store = createStore({ graph: v1, arkiv });
  const { rows, explain, truncated } = await store.query('item', { limit: 300 });
  assert.equal(rows.length, 130);
  assert.equal(truncated, false);
  assert.ok(explain.warnings.some((w) => /did not fit the schema/.test(w)), explain.warnings.join('; '));
});

test('rows left out for the schema count against the cap, so a read stays bounded', async () => {
  const arkiv = await seed({ old: 300, current: 1 });
  await assert.rejects(readAll(arkiv.publicClient, v1.defs.item, { owner: arkiv.owner, cap: 150 }), /more than 150/);
  const calls = arkiv.sim.stats.requests;
  await readAll(arkiv.publicClient, v1.defs.item, { owner: arkiv.owner, cap: 150, truncate: true });
  assert.ok(arkiv.sim.stats.requests - calls <= 4, `${arkiv.sim.stats.requests - calls} calls`);
});
