import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutAbi } from '@graphpay/contracts';
import { readAll } from '@graphpay/arkiv-graph';
import { ENTITIES } from '@graphpay/money-graph';
import { d1Verdict, EDGE_EVENTS, mirrorTxOf, recount, storedTally } from '../src/checks.mjs';
import { withRawSendHook } from '../src/intercept.mjs';

const SHOP = `0x${'aa'.repeat(32)}`;
const PAYER = `0x${'bb'.repeat(32)}`;
const STREAM = `chain:1874:0x${'dd'.repeat(20)}`;
const REF = `1874:0x${'cc'.repeat(32)}:3`;

const ops = () => [
  { op: 'create', type: 'edge', kind: 'pay', ref: REF },
  { op: 'patch', type: 'tally', node: SHOP, window: 'all' },
  { op: 'create', type: 'tally', node: SHOP, window: 'day:20762' },
  { op: 'patch', type: 'tally', node: PAYER, window: 'all' },
  { op: 'create', type: 'tally', node: PAYER, window: 'day:20762' },
  { op: 'patch', type: 'link', kind: 'pay', from: PAYER, to: SHOP },
  { op: 'patch', type: 'checkpoint', stream: STREAM },
];
const tx = (list) => ({ found: true, ref: REF, status: 'success', gasUsed: 298_000, ops: list });

test('D1: the pay edge, four tallies, the link and the checkpoint in one transaction pass; gas is recorded', () => {
  const v = d1Verdict(tx(ops()), { shopNode: SHOP, payerNode: PAYER, stream: STREAM });
  assert.equal(v.pass, true, v.failed.join(', '));
  assert.equal(v.gasRatioToLab, 0.96);
});

test('D1: a missing day tally, an extra row or a reverted transaction fails, and says which', () => {
  const noDay = ops().filter((o) => !(o.node === PAYER && o.window.startsWith('day:')));
  assert.deepEqual(d1Verdict(tx(noDay), { shopNode: SHOP, payerNode: PAYER, stream: STREAM }).failed, ['payer day tally', 'four tally rows']);
  const extra = [...ops(), { op: 'create', type: 'node' }];
  assert.deepEqual(d1Verdict(tx(extra), { shopNode: SHOP, payerNode: PAYER, stream: STREAM }).failed, ['nothing else']);
  assert.deepEqual(d1Verdict({ ...tx(ops()), status: 'reverted' }, { shopNode: SHOP, payerNode: PAYER, stream: STREAM }).failed, ['mined successfully']);
  assert.equal(d1Verdict({ found: false, ref: REF }, { shopNode: SHOP, payerNode: PAYER, stream: STREAM }).pass, false);
});

test('every edge event the checks count is an event of the checkout ABI', () => {
  const names = new Set(checkoutAbi.filter((x) => x.type === 'event').map((x) => x.name));
  for (const n of EDGE_EVENTS) assert.ok(names.has(n), n);
});

// ArkivSim with M7a's real planner: the lifecycle transcript, mirrored, then the checks.
async function mirroredSim({ hook } = {}) {
  const { randomBytes } = await import('node:crypto');
  const { connectArkiv, newSim } = await import('@graphpay/money-graph');
  const { arkivLedger } = await import('../src/arkiv.mjs');
  const { Actors } = await import('../src/actors.mjs');
  const { OrderBook } = await import('../src/orders.mjs');
  const { Mirror } = await import('../src/mirror.mjs');
  const { fakeSource } = await import('./fakes.mjs');
  const { blockTime, DEPLOY_BLOCK, lifecycle } = await import('./transcript.mjs');
  const sim = newSim();
  if (hook) sim.fetch = withRawSendHook(sim.fetch, hook);
  const conn = await connectArkiv({ backend: 'sim', sim, role: 'W_LEDGER', privateKey: `0x${randomBytes(32).toString('hex')}`, recoveryMs: 300, pollMs: 20 });
  const t = lifecycle();
  const stream = 'chain:1874:sim';
  const ledger = arkivLedger({ arkiv: conn, stream });
  const orders = new OrderBook({ load: (id) => ledger.loadOrder(id), loadSub: (id) => ledger.loadSub(id) });
  const times = Object.fromEntries(t.events.map((e) => [e.block, blockTime(e.block)]));
  const mirror = new Mirror({ source: fakeSource(t.events, { times }), ledger, actors: new Actors(), orders, stream, deployBlock: DEPLOY_BLOCK });
  await mirror.adopt();
  await mirror.register(t.c.actors);
  await mirror.poll();
  return { pc: conn.publicClient, owner: conn.owner, stream, t };
}

test('ArkivSim: every mirrored payment passes D1 (day rows are `day:<n>`), and the recount equals every stored tally', async () => {
  const { pc, owner, stream, t } = await mirroredSim();
  const edges = await readAll(pc, ENTITIES.edge, { owner });
  const pays = edges.filter((e) => e.kind === 'pay');
  assert.ok(pays.length > 0);
  for (const p of pays) {
    const v = d1Verdict(await mirrorTxOf(pc, { ref: p.ref, owner }), { shopNode: p.to_node, payerNode: p.from_node, stream });
    assert.equal(v.pass, true, `${p.ref}: ${v.failed.join(', ')}`);
  }
  for (const [name, node] of Object.entries(t.nodes)) {
    const stored = await storedTally(pc, { owner, node });
    if (!stored) continue;
    const counted = await recount(pc, { owner, node });
    for (const k of ['orders', 'refunds', 'delivered', 'onTime', 'paidMicro', 'refundedMicro']) assert.equal(counted[k], stored[k], `${name} ${k}`);
  }
});

test('ArkivSim: the transport hook sees every raw send the mirror makes', async () => {
  let held = 0;
  const { pc, owner } = await mirroredSim({ hook: async ({ send, nonce }) => {
    assert.equal(typeof nonce, 'number');
    held += 1;
    return send();
  } });
  const sent = await pc.getTransactionCount({ address: owner });
  assert.ok(held > 0);
  assert.equal(held, sent);
});
