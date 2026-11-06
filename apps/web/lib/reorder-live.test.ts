import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outcomeOf } from './reorder-live.server.ts';

const TX = `0x${'ab'.repeat(32)}`;

test('the shop\'s answers become paid, failed or unknown, and only a clean refusal frees the hold', () => {
  assert.equal(outcomeOf(200, { status: 'paid', transaction: TX }, '0x1', '1200000').status, 'paid');
  assert.equal(outcomeOf(200, { status: 'paid', transaction: TX }, '0x1', '1200000').transaction, TX);
  // Refused before anything was sent: nothing to wait for.
  assert.equal(outcomeOf(402, { status: 'refused' }, '0x1', '1').status, 'failed');
  assert.equal(outcomeOf(409, { error: 'order id taken by other terms' }, '0x1', '1').status, 'failed');
  // An unreadable body or an empty 4xx is not a clean refusal: the signature may still settle.
  assert.equal(outcomeOf(409, {}, '0x1', '1').status, 'unknown');
  assert.equal(outcomeOf(400, null, '0x1', '1').status, 'unknown');
  // A transaction exists, the shop is down, rate limited, or the answer is unreadable: the signature may still settle.
  assert.equal(outcomeOf(402, { status: 'failed', transaction: TX }, '0x1', '1').status, 'unknown');
  for (const code of [500, 502, 503, 504, 429]) assert.equal(outcomeOf(code, {}, '0x1', '1').status, 'unknown');
  assert.equal(outcomeOf(200, {}, '0x1', '1').status, 'unknown');
  assert.equal(outcomeOf(200, { status: 'paid', transaction: 'not a hash' }, '0x1', '1').transaction, undefined);
});
