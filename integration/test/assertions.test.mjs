import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertChoice, assertKilled, assertMirrored, assertRefund, assertSettled, assertTallies } from '../src/assertions.mjs';

// Test-only names and numbers (the run takes them from the story config).
const shops = { good: 'good.example.eth', runnerUp: 'runner.example.eth', trap: 'trap.example.eth', trapNode: `0x${'0e'.repeat(32)}` };
const ORDER = `0x${'0a'.repeat(32)}`;
const ref = (n) => `1874:0x${'ab'.repeat(32)}:${n}`;
const runLog = {
  result: {
    status: 'paid',
    chosenShop: shops.good,
    orderId: ORDER,
    explainId: '0123456789ab',
    ranking: [
      { ens: shops.good, score: 0.916, eligible: true },
      { ens: shops.runnerUp, score: 0.863, eligible: true },
      { ens: shops.trap, score: 0.75, eligible: false },
    ],
    receipt: { network: 'WHITECHAIN', explorerUrl: 'https://explorer.example/tx/0x1' },
  },
};
const events = [
  { id: ref(1), name: 'OrderCreated', block: 100, args: { orderId: ORDER, shopNode: `0x${'0d'.repeat(32)}` } },
  { id: ref(2), name: 'PaymentSettled', block: 100, args: { orderId: ORDER } },
];
const balances = { before: { payer: 20_000_000n, good: 1_000_000n, trap: 5_000_000n }, after: { payer: 15_200_000n, good: 5_800_000n, trap: 5_000_000n } };

test('A–C pass on a clean run and fail on a paid trap or a short trail', () => {
  assert.equal(assertChoice({ runLog, events, balances, shops }).pass, true);
  const paidTrap = [...events, { id: ref(3), name: 'PaymentSettled', block: 101, args: { shopNode: shops.trapNode } }];
  assert.deepEqual(assertChoice({ runLog, events: paidTrap, balances, shops }).failed, ['no trap order or payment on-chain']);
  assert.equal(assertSettled({ runLog, events, balances, priceMicro: 4_800_000n, network: 'WHITECHAIN' }).pass, true);
  const trail = { cursorBlock: 102, edges: [{ kind: 'order', ref: ref(1) }, { kind: 'pay', ref: ref(2) }, { kind: 'deliver', ref: ref(4) }] };
  assert.equal(assertMirrored({ trail, events }).pass, true);
  assert.deepEqual(assertMirrored({ trail: { ...trail, cursorBlock: 99 }, events }).failed, ['cursor at or past the settle block']);
});

test('D–F read deltas, not totals', () => {
  const t = (o) => ({ orders: 0, paidMicro: 0, delivered: 0, onTime: 0, refunds: 0, refundedMicro: 0, ...o });
  const graph = {
    before: { good: { today: t({}), all: t({ orders: 241 }) }, payer: { today: t({}) } },
    after: { good: { today: t({ orders: 1, paidMicro: 4_800_000, delivered: 1, onTime: 1 }), all: t({ orders: 242 }) }, payer: { today: t({ paidMicro: 4_800_000 }) } },
  };
  assert.equal(assertTallies({ graph, priceMicro: 4_800_000n }).pass, true);
  const refunded = { before: graph.after, after: { ...graph.after, good: { today: { ...graph.after.good.today, refunds: 1, refundedMicro: 800_000 }, all: { ...graph.after.good.all, refunds: 1 } } } };
  assert.equal(assertRefund({ graph: refunded, trail: { edges: [{ kind: 'pay' }, { kind: 'refund' }] }, refundMicro: 800_000n }).pass, true);
  assert.equal(assertKilled({ kill: { status: 402, reason: 'ENS_EXPIRED_OR_REVOKED', receiptMs: 1_000, refusedMs: 21_500, failEdge: '0xkey' } }).pass, true);
  assert.deepEqual(assertKilled({ kill: { status: 402, reason: 'ENS_EXPIRED_OR_REVOKED', receiptMs: 1_000, refusedMs: 30_000, failEdge: '0xkey' } }).failed, ['within 25 s of the kill']);
});
