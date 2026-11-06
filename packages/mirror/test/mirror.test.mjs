import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Actors, candidateNames, nodeOf } from '../src/actors.mjs';
import { Mirror } from '../src/mirror.mjs';
import { OrderBook } from '../src/orders.mjs';
import { ev, fakeSource, FakeLedger, fold, hash } from './fakes.mjs';
import { blockTime, DEPLOY_BLOCK, lifecycle } from './transcript.mjs';

const STREAM = 'chain:1874:test';

function setup({ events, ledger = new FakeLedger(), candidates, source } = {}) {
  const t = lifecycle();
  const src = source ?? fakeSource(events ?? t.events, { times: Object.fromEntries((events ?? t.events).map((e) => [e.block, blockTime(e.block)])) });
  const make = () =>
    new Mirror({ source: src, ledger, actors: new Actors(), orders: new OrderBook(), stream: STREAM, deployBlock: DEPLOY_BLOCK, candidates });
  return { t, src, ledger, make };
}

async function started(make, actors) {
  const m = make();
  await m.adopt();
  await m.register(actors);
  return m;
}

test('the lifecycle transcript is mirrored exactly: one batch per event, tallies as the lab', async () => {
  const { t, ledger, make } = setup();
  const m = await started(make, t.c.actors);
  await m.poll();
  const shop = fold(ledger.edges, t.nodes.shop);
  assert.deepEqual(
    { orders: shop.orders, paidMicro: shop.paidMicro, refunds: shop.refunds, refundedMicro: shop.refundedMicro, fails: shop.fails, delivered: shop.delivered, onTime: shop.onTime },
    t.expected,
  );
  // Every edge is its own batch with the checkpoint; refs are the event ids, each once.
  const edgeBatches = ledger.batches.filter((b) => b.ops[0] === 'edge');
  assert.equal(edgeBatches.length, ledger.edges.length);
  assert.ok(edgeBatches.every((b) => b.ops.includes('checkpoint')));
  for (const e of ledger.edges) assert.equal(ledger.refCount(e.ref), 1, e.ref);
  assert.ok(ledger.edges.every((e) => /^1874:0x[0-9a-f]{64}:\d+$/.test(e.ref)));
  // The renewal moved money once: its renew edge carries 0, the money is on its pay edge.
  const renew = ledger.edges.find((e) => e.kind === 'renew');
  assert.equal(renew.amountMicro, 0n);
  // The replayed settle (DUPLICATE) is recorded but not counted.
  const dup = ledger.edges.filter((e) => e.kind === 'fail' && !e.counted);
  assert.equal(dup.length, 1);
  assert.equal(dup[0].payload.reason, 'DUPLICATE');
  // The human-paid renewal is the persona's payment; agent payments carry the event's epoch.
  const humanPay = ledger.edges.find((e) => e.kind === 'pay' && e.fromNode === t.nodes.persona);
  assert.ok(humanPay, 'a human payment runs from the buyer');
  // Standing: the scout's revocation patched its node row (same epoch).
  assert.equal(ledger.nodes.get(t.nodes.scout).status, 'revoked');
  assert.equal(m.status().parked.length, 0);
  assert.equal(m.checkpoint.block, 190);
});

test('a replayed poll and a restart send nothing new', async () => {
  const { t, ledger, make } = setup();
  const m = await started(make, t.c.actors);
  await m.poll();
  const sent = ledger.batches.length;
  await m.poll();
  assert.equal(ledger.batches.length, sent, 'the same poll again: no transaction');
  const again = await started(make, t.c.actors);
  await again.poll();
  assert.equal(ledger.batches.length, sent, 'a restart resumes from the checkpoint');
  assert.equal(again.stats.written, 0);
});

test('a lost cursor is caught by ref: every event is skipped, no edge twice', async () => {
  const { t, ledger, make } = setup();
  const m = await started(make, t.c.actors);
  await m.poll();
  const edges = ledger.edges.length;
  ledger.checkpoints.clear();
  const again = await started(make, t.c.actors);
  await again.poll();
  assert.equal(ledger.edges.length, edges);
  assert.equal(again.stats.skippedRef, edges);
  for (const e of ledger.edges) assert.equal(ledger.refCount(e.ref), 1);
  // Standing has no ref: an unchanged policy is not patched again; a replayed change
  // converges on the latest policy.
  const patched = ledger.standing.slice(-again.stats.standing).map((s) => s.node);
  assert.ok(!patched.includes(t.nodes.payerAgent), 'the payer agent\'s unchanged policy is not re-sent');
  assert.equal(ledger.nodes.get(t.nodes.scout).status, 'revoked');
});

test('a stale read loses the nonce race and starts over: the other writer wins, no duplicate', async () => {
  const { t, ledger, make } = setup();
  const m = await started(make, t.c.actors);
  // Another writer lands this very event at our nonce between our read and our send.
  const first = t.events.find((e) => e.name === 'OrderCreated');
  ledger.beforeSend = (l) => {
    l.edges.push({ ref: first.id, kind: 'order', fromNode: t.nodes.payerAgent, toNode: t.nodes.shop, amountMicro: first.args.amountMicro, counted: true });
    l.checkpoints.set(STREAM, { block: first.block, logIndex: first.logIndex, events: 1 });
    l.nonce += 1;
  };
  await assert.rejects(m.poll(), { code: 'NONCE_TAKEN' });
  assert.deepEqual(m.checkpoint, { block: first.block, logIndex: first.logIndex, events: 1 }, 're-adopted from Arkiv');
  await m.poll();
  for (const e of ledger.edges) assert.equal(ledger.refCount(e.ref), 1, e.ref);
  assert.deepEqual(fold(ledger.edges, t.nodes.shop).orders, t.expected.orders);
});

test('a failed write discards, re-adopts and re-reads from the checkpoint', async () => {
  const { t, ledger, make } = setup();
  const m = await started(make, t.c.actors);
  ledger.failNext = Object.assign(new Error('Execution error without revert data'), { code: 'SEND_FAILED' });
  await assert.rejects(m.poll());
  assert.equal(m.scannedTo, DEPLOY_BLOCK - 1, 'nothing landed: the next poll starts from the deploy block');
  await m.poll();
  assert.deepEqual(fold(ledger.edges, t.nodes.shop).paidMicro, t.expected.paidMicro);
  for (const e of ledger.edges) assert.equal(ledger.refCount(e.ref), 1);
});

test('events of an unknown actor are parked; the checkpoint never passes them; registration releases them', async () => {
  const { t, ledger } = setup();
  const strangerName = `stranger.${t.c.names.persona}`;
  const stranger = nodeOf(strangerName);
  const o = hash('stranger-order');
  const events = [
    ...t.events.filter((e) => e.block <= 110),
    ev('OrderCreated', { orderId: o, shopNode: t.nodes.shop, buyerNode: stranger, payerNode: stranger, merchant: '0x', amountMicro: 1n, deadline: 0n, parentOrderId: hash('none'), kind: 0 }, 115),
    ...t.events.filter((e) => e.block > 110 && e.block <= 130),
  ];
  const src = fakeSource(events);
  const make = () => new Mirror({ source: src, ledger, actors: new Actors(), orders: new OrderBook(), stream: STREAM, deployBlock: DEPLOY_BLOCK });
  const m = await started(make, t.c.actors);
  await m.poll();
  assert.equal(m.status().parked.length, 1);
  assert.deepEqual(ledger.checkpoints.get(STREAM).block, 114, 'held just before the parked event');
  assert.ok(ledger.edges.some((e) => e.kind === 'refund'), 'later events are still written');
  // A restart finds the parked event again from the held checkpoint.
  const again = await started(make, t.c.actors);
  await again.poll();
  assert.equal(again.status().parked.length, 1);
  await again.register([{ ens: strangerName, kind: 'agent' }]);
  await again.poll();
  assert.equal(again.status().parked.length, 0);
  assert.ok(ledger.edges.some((e) => e.fromNode === stranger));
  assert.equal(ledger.checkpoints.get(STREAM).block, 130, 'the checkpoint moves on once nothing is parked');
});

test('a payment from the zero node (a checkout-kit wallet with no ENS name) is passed, never parked: the checkpoint moves on', async () => {
  const { t, ledger } = setup();
  const zero = `0x${'0'.repeat(64)}`;
  const o = hash('kit-order');
  const events = [
    ...t.events.filter((e) => e.block <= 110),
    ev('OrderCreated', { orderId: o, shopNode: t.nodes.shop, buyerNode: zero, payerNode: zero, merchant: '0x', amountMicro: 4_800_000n, deadline: 0n, parentOrderId: hash('none'), kind: 0 }, 115),
    ...t.events.filter((e) => e.block > 110 && e.block <= 130),
  ];
  const src = fakeSource(events);
  const make = () => new Mirror({ source: src, ledger, actors: new Actors(), orders: new OrderBook(), stream: STREAM, deployBlock: DEPLOY_BLOCK });
  const m = await started(make, t.c.actors);
  await m.poll();
  assert.equal(m.status().parked.length, 0, 'nothing parked');
  assert.ok(!ledger.edges.some((e) => e.orderId === o || e.ref.includes(o)), 'nothing written for it');
  assert.equal(ledger.checkpoints.get(STREAM).block, 130, 'the checkpoint passes it');
});

test('a numbered disposable agent is recognised by its node and registered with the policy epoch', async () => {
  const { t, ledger } = setup();
  const candidates = candidateNames({ cast: t.c.cast, disposableMax: 3 });
  const [node, entry] = [...candidates.entries()][1];
  const events = [ev('AgentPolicySet', { payerNode: node, epoch: 2, wallet: `0x${'ab'.repeat(20)}`, revoked: false, dailyCapMicro: 1_000_000n, expiry: 0n }, 105)];
  const make = () =>
    new Mirror({ source: fakeSource(events), ledger, actors: new Actors(), orders: new OrderBook(), stream: STREAM, deployBlock: DEPLOY_BLOCK, candidates });
  const m = await started(make, t.c.actors);
  await m.poll();
  assert.equal(ledger.nodes.get(node).ens, entry.ens);
  assert.equal(ledger.nodes.get(node).epoch, 2);
  assert.equal(m.stats.standing, 0, 'registered with the configured cap: the policy changes nothing');
  assert.equal(m.status().parked.length, 0);
});

test('a policy that differs from the node row patches its standing, same epoch only', async () => {
  const { t, ledger } = setup();
  const n = t.nodes.payerAgent;
  const events = [
    ev('AgentPolicySet', { payerNode: n, epoch: 0, wallet: `0x${'cd'.repeat(20)}`, revoked: false, dailyCapMicro: 2_000_000n, expiry: 0n }, 105),
    ev('AgentPolicySet', { payerNode: n, epoch: 1, wallet: `0x${'cd'.repeat(20)}`, revoked: true, dailyCapMicro: 0n, expiry: 0n }, 106),
  ];
  const make = () => new Mirror({ source: fakeSource(events), ledger, actors: new Actors(), orders: new OrderBook(), stream: STREAM, deployBlock: DEPLOY_BLOCK });
  const m = await started(make, t.c.actors);
  await m.poll();
  assert.equal(m.stats.standing, 1);
  assert.equal(ledger.nodes.get(n).capMicro, 2_000_000n);
  assert.equal(ledger.nodes.get(n).status, 'active', 'a policy of another epoch never patches this one');
});

test('/sync waits on the poll lock and returns only after the writes landed', async () => {
  const { t, ledger, make } = setup();
  const m = await started(make, t.c.actors);
  const slow = ledger.writeEdge.bind(ledger);
  ledger.writeEdge = async (...args) => {
    await new Promise((r) => setTimeout(r, 2));
    return slow(...args);
  };
  const poll = m.poll();
  const synced = await m.sync();
  await poll;
  assert.equal(synced.stats.written, ledger.edges.length);
  assert.equal(synced.checkpoint.block, 190);
});

test('the chain source reads up to head − confirmations in ranges of at most 1,000 blocks', async () => {
  const { t, ledger } = setup();
  const src = fakeSource(t.events, { head: DEPLOY_BLOCK + 2500 });
  const make = () => new Mirror({ source: src, ledger, actors: new Actors(), orders: new OrderBook(), stream: STREAM, deployBlock: DEPLOY_BLOCK });
  const m = await started(make, t.c.actors);
  await m.poll();
  assert.ok(src.calls.every((c) => c.to - c.from + 1 <= 1000));
  assert.equal(src.calls.at(-1).to, DEPLOY_BLOCK + 2500 - 2);
  assert.equal(m.scannedTo, DEPLOY_BLOCK + 2498);
});
