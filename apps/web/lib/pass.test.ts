import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passState, remainingMicro } from './pass.ts';

const base = { status: 'ACTIVE' as const, capMicro: '6000000', spentTodayMicro: '0' };
const now = new Date('2026-11-06T10:00:00Z');

test('an active agent with room left is Active', () => assert.equal(passState(base, now), 'Active'));

test('spending the whole cap is Used up', () => {
  assert.equal(passState({ ...base, spentTodayMicro: '6000000' }, now), 'Used up');
  assert.equal(passState({ ...base, spentTodayMicro: '5999999' }, now), 'Active');
});

test('a stopped agent never reads Active, even with room left', () => {
  assert.equal(passState({ ...base, status: 'PAUSED' }, now), 'Paused');
  assert.equal(passState({ ...base, status: 'REVOKED' }, now), 'Revoked');
  assert.equal(passState({ ...base, status: 'EXPIRED' }, now), 'Expired');
  assert.equal(passState({ ...base, status: 'UNKNOWN' }, now), 'Unknown');
});

test('a lapsed policy is Expired; a future one is not', () => {
  assert.equal(passState({ ...base, expiresAt: '2026-11-06T09:59:59Z' }, now), 'Expired');
  assert.equal(passState({ ...base, expiresAt: '2026-11-07T00:00:00Z' }, now), 'Active');
});

test('revoked outranks used up', () => assert.equal(passState({ ...base, status: 'REVOKED', spentTodayMicro: '6000000' }, now), 'Revoked'));

test('remaining never goes below zero', () => {
  assert.equal(remainingMicro('6000000', '1200000'), 4_800_000n);
  assert.equal(remainingMicro('6000000', '7000000'), 0n);
});
