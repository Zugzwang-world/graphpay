// The mirror on ArkivSim with M7a's real planner, writer and entities (no fakes on the
// Arkiv side): what lands in the tally rows is what the agents will read.

import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { jsonBytes, readAll } from '@graphpay_ethglobal/arkiv-graph';
import { connectArkiv, ENTITIES, newSim, recordEdge } from '@graphpay/money-graph';
import { generatePrivateKey } from 'viem/accounts';
import { Actors } from '../src/actors.mjs';
import { arkivLedger } from '../src/arkiv.mjs';
import { historyBuyers, historyCounts, historyParams, planHistory, writeHistory } from '../src/history.mjs';
import { Mirror } from '../src/mirror.mjs';
import { OrderBook } from '../src/orders.mjs';
import { foldRecorder } from '../src/recorder.mjs';
import { createWorkers } from '../src/workers.mjs';
import { fakeSource, hash } from './fakes.mjs';
import { blockTime, DEPLOY_BLOCK, lifecycle } from './transcript.mjs';

const STREAM = 'chain:1874:sim';

async function sim() {
  const s = newSim();
  const conn = (role) => connectArkiv({ backend: 'sim', sim: s, role, privateKey: generatePrivateKey(), recoveryMs: 300, pollMs: 20 });
  return { ledgerConn: await conn('W_LEDGER'), syncConn: await conn('W_SYNC') };
}

function mirrorOn(conn, events, { syncOwner } = {}) {
  const ledger = arkivLedger({ arkiv: conn, stream: STREAM, recorderOwner: syncOwner });
  const actors = new Actors();
  const orders = new OrderBook({ load: (id) => ledger.loadOrder(id), loadSub: (id) => ledger.loadSub(id) });
  const times = Object.fromEntries(events.map((e) => [e.block, blockTime(e.block)]));
  const mirror = new Mirror({ source: fakeSource(events, { times }), ledger, actors, orders, stream: STREAM, deployBlock: DEPLOY_BLOCK });
  return { ledger, actors, mirror };
}

const tallyOf = async (conn, node, window = 'all') => (await readAll(conn.publicClient, ENTITIES.tally, { owner: conn.owner })).find((r) => r.node === node && r.window === window);

test('ArkivSim: the lifecycle lands as the lab measured it, one edge per ref, and a restart writes nothing', async () => {
  const { ledgerConn } = await sim();
  const t = lifecycle();
  const a = mirrorOn(ledgerConn, t.events);
  await a.mirror.adopt();
  await a.mirror.register(t.c.actors);
  await a.mirror.poll();
  const shop = await tallyOf(ledgerConn, t.nodes.shop);
  assert.deepEqual(
    [shop.orders, shop.paid_micro, shop.refunds, shop.refunded_micro, shop.fails, shop.delivered, shop.on_time],
    [5n, t.expected.paidMicro, 1n, t.expected.refundedMicro, 2n, 3n, 3n],
  );
  const edges = await readAll(ledgerConn.publicClient, ENTITIES.edge, { owner: ledgerConn.owner });
  assert.equal(new Set(edges.map((e) => e.ref)).size, edges.length);
  assert.equal(edges.length, a.mirror.stats.written);
  const scout = (await readAll(ledgerConn.publicClient, ENTITIES.node, { owner: ledgerConn.owner })).find((n) => n.node === t.nodes.scout);
  assert.equal(scout.status, 'revoked');

  const b = mirrorOn(ledgerConn, t.events);
  await b.mirror.adopt();
  await b.mirror.register(t.c.actors);
  await b.mirror.poll();
  assert.equal(b.mirror.stats.written, 0);
  assert.equal((await readAll(ledgerConn.publicClient, ENTITIES.edge, { owner: ledgerConn.owner })).length, edges.length);
  assert.deepEqual(await tallyOf(ledgerConn, t.nodes.shop), shop);
});

test('ArkivSim: a recorder refusal is folded into fails once, without a second edge', async () => {
  const { ledgerConn, syncConn } = await sim();
  const t = lifecycle();
  const events = t.events.filter((e) => e.block <= 110);
  const a = mirrorOn(ledgerConn, events, { syncOwner: syncConn.owner });
  await a.mirror.adopt();
  await a.mirror.register(t.c.actors);
  await a.mirror.poll();
  const wallet = `0x${'a1'.repeat(20)}`;
  const ts = blockTime(112);
  const orderId = hash('refused');
  await recordEdge(syncConn, {
    ref: `att:${orderId}:${wallet}:1`,
    kind: 'fail',
    from: { ens: t.c.names.scout, epoch: 0 },
    to: { ens: t.c.names.good, epoch: 0 },
    amountMicro: 400_000n,
    ts,
    orderId,
    payload: jsonBytes({ onchain: false, reason: 'ENS_EXPIRED_OR_REVOKED', payer: wallet }),
  });
  const bindings = { nodeOfWallet: async (w) => (w === wallet ? t.nodes.scout : null) };
  const before = (await tallyOf(ledgerConn, t.nodes.shop)).fails;
  const first = await foldRecorder({ ledger: a.ledger, bindings, nowS: ts + 200 });
  const again = await foldRecorder({ ledger: a.ledger, bindings, nowS: ts + 300 });
  assert.equal(first.folded, 1);
  assert.equal(again.folded, 0);
  assert.equal((await tallyOf(ledgerConn, t.nodes.shop)).fails, before + 1n);
  assert.equal((await tallyOf(ledgerConn, t.nodes.scout)).fails, 1n);
  const mine = await readAll(ledgerConn.publicClient, ENTITIES.edge, { owner: ledgerConn.owner });
  assert.ok(!mine.some((e) => e.ref.startsWith('att:')), 'the refusal edge stays W_SYNC\'s; the mirror wrote no copy');
});

test('ArkivSim: the history lands whole, and a live event after it adds to the same tallies', async () => {
  const { ledgerConn } = await sim();
  const t = lifecycle();
  const a = mirrorOn(ledgerConn, t.events.filter((e) => e.block <= 110));
  await a.mirror.adopt();
  await a.mirror.register(t.c.actors);
  const endDay = Math.floor(blockTime(DEPLOY_BLOCK) / 86_400);
  const plan = planHistory(historyParams({ scale: 0.01, endDay }));
  a.ledger.openHistory(plan.stream);
  await a.mirror.register(historyBuyers().map((b) => ({ ...b, dataset: plan.stream })));
  const out = await writeHistory({ ledger: a.ledger, plan, actors: a.actors, run: (fn) => a.mirror.lock.run(fn) });
  assert.equal(out.written, plan.events.length);
  const good = t.c.cast.shops.find((s) => s.storyRole === 'good');
  const counts = historyCounts(good, 0.01);
  const afterHistory = await tallyOf(ledgerConn, t.nodes.shop);
  assert.equal(afterHistory.orders, BigInt(counts.orders));
  assert.equal(afterHistory.refunds, BigInt(counts.refunds));
  assert.equal(afterHistory.delivered, BigInt(counts.orders));
  assert.equal(afterHistory.on_time, BigInt(counts.orders - counts.late));
  assert.equal(afterHistory.synthetic, true);
  // The live stream on top: its ledger re-reads the rows the history moved.
  await a.mirror.poll();
  const afterLive = await tallyOf(ledgerConn, t.nodes.shop);
  assert.equal(afterLive.orders, afterHistory.orders + 1n);
  assert.equal(afterLive.paid_micro, afterHistory.paid_micro + BigInt(t.c.cast.order.priceMicro));
});

test('ArkivSim: a second workers process is refused while the first one\'s heartbeat is fresh', async () => {
  const { ledgerConn } = await sim();
  const t = lifecycle();
  const dir = mkdtempSync(join(tmpdir(), 'graphpay-workers-'));
  let clock = blockTime(200) * 1000;
  const make = (claim) => {
    const a = mirrorOn(ledgerConn, t.events);
    return createWorkers({ mirror: a.mirror, ledger: a.ledger, actors: a.actors, bootstrap: t.c.actors, claimPath: join(dir, claim), now: () => clock, pollMs: 60_000, beatMs: 60_000, foldMs: 60_000 });
  };
  const first = make('a.json');
  await first.start();
  const second = make('b.json');
  await assert.rejects(second.start(), { code: 'LEASE_HELD' });
  await first.stop();
  clock += 5_000;
  const third = make('c.json');
  await third.start();
  assert.equal(third.state.running, true, 'a clean stop frees the lease');
  await third.stop();
});

test('ArkivSim: the instance whose heartbeat row came first keeps the lease; the later one stops itself', async () => {
  const { ledgerConn } = await sim();
  const t = lifecycle();
  const dir = mkdtempSync(join(tmpdir(), 'graphpay-race-'));
  const clock = blockTime(200) * 1000;
  const make = (claim, instance) => {
    const a = mirrorOn(ledgerConn, t.events);
    return { a, w: createWorkers({ mirror: a.mirror, ledger: a.ledger, actors: a.actors, bootstrap: t.c.actors, claimPath: join(dir, claim), instance, now: () => clock, pollMs: 60_000, beatMs: 60_000, foldMs: 60_000 }) };
  };
  const first = make('a.json', 'ffff');
  await first.w.start();
  // The second one read the heartbeats before the first's row existed (it passes the
  // lease), and has the smaller id: order of creation decides, not the id.
  const second = make('b.json', '0000');
  const read = second.a.ledger.readHeartbeats;
  let calls = 0;
  second.a.ledger.readHeartbeats = async () => (calls++ === 0 ? [] : read());
  await assert.rejects(second.w.start(), { code: 'LEASE_HELD' });
  assert.equal(second.w.state.alive, false);
  await first.w.beat();
  assert.equal(first.w.state.alive, true, 'the first keeps running');
  await first.w.stop();
});

test('ArkivSim: a long catch-up still beats between events', async () => {
  const { ledgerConn } = await sim();
  const t = lifecycle();
  const dir = mkdtempSync(join(tmpdir(), 'graphpay-beat-'));
  let clock = blockTime(200) * 1000;
  const a = mirrorOn(ledgerConn, t.events);
  const w = createWorkers({ mirror: a.mirror, ledger: a.ledger, actors: a.actors, bootstrap: t.c.actors, claimPath: join(dir, 'c.json'), now: () => clock, pollMs: 600_000, beatMs: 30_000, foldMs: 600_000 });
  // Each event of the catch-up takes 40 s of clock: every one is a due beat.
  assert.equal(a.mirror.between, null);
  const ledgerWrite = a.ledger.writeEdge;
  a.ledger.writeEdge = async (...args) => {
    clock += 40_000;
    return ledgerWrite(...args);
  };
  await w.start();
  const beats = (await a.ledger.readHeartbeats()).find((r) => r.instance === w.state.instance);
  assert.ok(beats.updatedTs >= Math.floor(clock / 1000) - 40, 'the heartbeat followed the catch-up');
  await w.stop();
});
