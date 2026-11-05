import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutAbi } from '@graphpay/contracts';
import { d1Verdict, EDGE_EVENTS } from '../src/checks.mjs';

const SHOP = `0x${'aa'.repeat(32)}`;
const PAYER = `0x${'bb'.repeat(32)}`;
const STREAM = `chain:1874:0x${'dd'.repeat(20)}`;
const REF = `1874:0x${'cc'.repeat(32)}:3`;

const ops = () => [
  { op: 'create', type: 'edge', kind: 'pay', ref: REF },
  { op: 'patch', type: 'tally', node: SHOP, window: 'all' },
  { op: 'create', type: 'tally', node: SHOP, window: 'day' },
  { op: 'patch', type: 'tally', node: PAYER, window: 'all' },
  { op: 'create', type: 'tally', node: PAYER, window: 'day' },
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
  const noDay = ops().filter((o) => !(o.node === PAYER && o.window === 'day'));
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
