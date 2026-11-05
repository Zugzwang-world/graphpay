import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRunFile, RUN_SCHEMA, transcript } from '../src/runfile.mjs';

const runLog = { label: 'test errand (SYNTHETIC)', events: [{ type: 'message', from: 'a.example.eth', to: 'b.example.eth', text: 'hello' }, { type: 'guard', guard: 'G1', ok: true, detail: 'mandate' }] };
const base = { model: 'mock', startedAt: '2026-11-06T00:00:00.000Z', endedAt: '2026-11-06T00:02:16.000Z', runLog };
const events = [{ id: `1874:0x${'ab'.repeat(32)}:2`, name: 'PaymentSettled', block: 100n, txHash: `0x${'ab'.repeat(32)}` }];

test('a real run links every chain event and mirror write to its explorer; a fork run links none', () => {
  const real = buildRunFile({ ...base, network: 'real', events, writes: [{ ref: events[0].id, txHash: `0x${'cd'.repeat(32)}` }], assertions: [{ id: 'A', pass: true, failed: [] }] });
  assert.equal(real.schema, RUN_SCHEMA);
  assert.equal(real.receipts, 'WHITECHAIN');
  assert.equal(real.seconds, 136);
  assert.equal(real.chain[0].block, '100');
  assert.match(real.chain[0].explorer, /\/tx\/0xabab/);
  assert.match(real.mirror[0].explorer, /\/tx\/0xcdcd/);
  assert.equal(real.pass, true);
  const fork = buildRunFile({ ...base, network: 'fork', events, assertions: [{ id: 'A', pass: false, failed: ['x'] }] });
  assert.equal(fork.receipts, 'FORK');
  assert.equal(fork.chain[0].explorer, null);
  assert.equal(fork.pass, false);
  assert.match(transcript(fork), /FAIL \(x\)/);
  assert.match(transcript(fork), /a\.example\.eth → b\.example\.eth/);
});
