import assert from 'node:assert/strict';
import { test } from 'node:test';
import { foldRecorder, walletOf } from '../src/recorder.mjs';
import { cast, FakeLedger, hash } from './fakes.mjs';

const c = cast();
const agent = c.node(c.names.scout);
const shop = c.node(c.names.good);
const bound = `0x${'a1'.repeat(20)}`;
const other = `0x${'b2'.repeat(20)}`;
const bindings = { nodeOfWallet: async (w) => (w.toLowerCase() === bound ? agent : null) };
const refusal = (n, wallet, ts) => ({
  ref: `att:${hash(`o${n}`)}:${wallet}:${n}`,
  kind: 'fail',
  fromNode: agent,
  toNode: shop,
  ts,
  payload: { onchain: false, reason: 'ENS_EXPIRED_OR_REVOKED' },
});

test('a recorder refusal is folded into fails exactly once, only for a bound wallet', async () => {
  const ledger = new FakeLedger();
  ledger.recorderEdges.push(refusal(1, bound, 1000), refusal(2, other, 1000), { ref: 'req:x:1', kind: 'request', fromNode: agent, toNode: shop, ts: 1001, payload: {} });
  const first = await foldRecorder({ ledger, bindings, nowS: 2000 });
  assert.deepEqual([first.folded, first.unattributed, first.requests], [1, 1, 1]);
  assert.equal(ledger.folded.length, 1);
  assert.equal(walletOf(ledger.folded[0]), bound);
  const again = await foldRecorder({ ledger, bindings, nowS: 2000 });
  assert.equal(again.folded, 0);
  assert.equal(ledger.folded.length, 1, 'the checkpoint covers it');
});

test('records younger than the settle window wait; same-second records fold in one batch', async () => {
  const ledger = new FakeLedger();
  ledger.recorderEdges.push(refusal(1, bound, 1000), refusal(2, bound, 1000), refusal(3, bound, 1950));
  const out = await foldRecorder({ ledger, bindings, nowS: 2000, settleS: 120 });
  assert.equal(out.folded, 2);
  assert.equal(ledger.batches.length, 1, 'one batch for the two records of one second');
  const later = await foldRecorder({ ledger, bindings, nowS: 2100, settleS: 120 });
  assert.equal(later.folded, 1);
});
