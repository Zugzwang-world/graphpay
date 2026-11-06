import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connect, createStore, defineGraph, nodeKeyOf } from '../index.mjs';

const graph = () =>
  defineGraph({
    project: 'store-test',
    node: { columns: ['name:str'] },
    totals: { counters: ['wins', 'points'], rules: { win: { wins: 'count', points: 'value' } } },
  });
const who = (name, kind = 'player') => ({ node: nodeKeyOf(name), epoch: 0, kind, columns: { name } });
const ts = 1_760_000_000;

test('connect: no URL is ArkivSim with a funded key; a URL needs a chain id; a bad key is refused', async () => {
  const a = await connect();
  assert.equal(a.backend, 'sim');
  assert.match(a.owner, /^0x[0-9a-f]{40}$/);
  assert.ok(a.writer);
  await assert.rejects(connect({ rpcUrl: 'http://127.0.0.1:1/' }), /chainId/);
  await assert.rejects(connect({ privateKey: '0x12' }), /not a valid/);
  assert.throws(() => createStore({ graph: graph(), arkiv: { writer: null } }), /private key/);
});

test('store: write, query with filter and order, explain id is stable, replays with a position are skipped', async () => {
  const arkiv = await connect();
  const store = createStore({ graph: graph(), arkiv, stream: 's' });
  const events = [
    { ref: 'a', kind: 'win', from: who('chess', 'game'), to: who('ada'), value: 30n, ts, position: { block: 10n, logIndex: 0 } },
    { ref: 'b', kind: 'win', from: who('chess', 'game'), to: who('grace'), value: 20n, ts, position: { block: 10n, logIndex: 1 } },
    { ref: 'c', kind: 'win', from: who('go', 'game'), to: who('ada'), value: 25n, ts, position: { block: 11n, logIndex: 0 } },
  ];
  const first = await store.write(events);
  assert.deepEqual(first.applied, ['a', 'b', 'c']);
  const board = await store.query('totals', { filter: { window: { eq: 'all' }, kind: { eq: 'player' } }, orderBy: { field: 'points', direction: 'desc' } });
  assert.deepEqual(board.rows.map((r) => [r.node, r.points, r.wins]), [[nodeKeyOf('ada'), 55n, 2n], [nodeKeyOf('grace'), 20n, 1n]]);
  assert.equal(board.explain.calls, 1);
  const again = await store.query('totals', { filter: { window: { eq: 'all' }, kind: { eq: 'player' } }, orderBy: { field: 'points', direction: 'desc' } });
  assert.equal(again.explain.explainId, board.explain.explainId);
  assert.ok(store.explainStore.get(board.explain.explainId));
  // A restarted store adopts what Arkiv holds and skips the events it has already counted.
  const restarted = createStore({ graph: graph(), arkiv, stream: 's' });
  const replay = await restarted.write(events);
  assert.deepEqual(replay.applied, []);
  assert.deepEqual(replay.skipped, ['a', 'b', 'c']);
  const afterReplay = await restarted.query('totals', { filter: { node: { eq: nodeKeyOf('ada') }, window: { eq: 'all' } } });
  assert.equal(afterReplay.rows[0].points, 55n);
});

test('store: a bad filter or entity is an error, an empty "in" matches nothing', async () => {
  const store = createStore({ graph: graph(), arkiv: await connect(), stream: 's' });
  await assert.rejects(store.query('nope'), /unknown entity/);
  await assert.rejects(store.query('totals', { filter: { wins: { eq: 1 } } }), /stored only/);
  await assert.rejects(store.query('totals', { orderBy: { field: 'missing' } }), /unknown field/);
  await assert.rejects(store.query('totals', { orderBy: { field: 'points', direction: 'ASC' } }), /asc.*desc/);
  await assert.rejects(store.query('totals', { limit: 0 }), /positive integer/);
  assert.deepEqual((await store.query('totals', { filter: { kind: { in: [] } } })).rows, []);
});

test('rows from another wallet are never trusted by a store', async () => {
  const sim = (await connect()).sim;
  const mine = await connect({ sim });
  const theirs = await connect({ sim });
  await createStore({ graph: graph(), arkiv: theirs, stream: 's' }).write([{ ref: 'x', kind: 'win', from: who('chess', 'game'), to: who('mallory'), value: 999n, ts }]);
  const store = createStore({ graph: graph(), arkiv: mine, stream: 's' });
  assert.deepEqual((await store.query('totals', { filter: { window: { eq: 'all' } } })).rows, []);
});
