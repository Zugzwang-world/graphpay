import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { dropClaim, heartbeatAgeS, leaseDecision, pidAlive, readClaim, writeClaim } from '../src/lease.mjs';

test('a second instance is refused while the heartbeat is fresher than 90 s', () => {
  const row = { instance: 'aaaa', state: 'running', updatedTs: 1000, updatedBlock: 500 };
  const fresh = heartbeatAgeS(row, { arkivBlock: 530 });
  assert.equal(fresh, 60);
  assert.equal(leaseDecision({ row, instance: 'bbbb', ageS: fresh }).ok, false);
  assert.equal(leaseDecision({ row, instance: 'bbbb', ageS: heartbeatAgeS(row, { arkivBlock: 546 }) }).ok, true, '92 s: stale');
  assert.equal(leaseDecision({ row, instance: 'aaaa', ageS: 0 }).ok, true, 'its own heartbeat');
  assert.equal(leaseDecision({ row: { ...row, state: 'stopped' }, instance: 'bbbb', ageS: 1 }).ok, true, 'a clean stop frees the lease');
  assert.equal(leaseDecision({ row: null, instance: 'bbbb', ageS: 0 }).ok, true);
});

test('the age falls back to the row timestamp without Arkiv block numbers', () => {
  assert.equal(heartbeatAgeS({ updatedTs: 1000 }, { nowS: 1095 }), 95);
});

test('a restart on the same machine takes over at once only when the old process has exited', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graphpay-lease-'));
  const path = join(dir, 'claim.json');
  writeClaim({ instance: 'aaaa', pid: process.pid, startedTs: 1 }, path);
  const row = { instance: 'aaaa', state: 'running', updatedTs: 0 };
  const alive = readClaim(path);
  assert.equal(leaseDecision({ row, instance: 'bbbb', ageS: 10, claim: { ...alive, alive: pidAlive(alive.pid) } }).ok, false, 'still running here');
  assert.equal(leaseDecision({ row, instance: 'bbbb', ageS: 10, claim: { ...alive, alive: false } }).ok, true, 'exited here');
  assert.equal(leaseDecision({ row, instance: 'bbbb', ageS: 10, claim: { instance: 'cccc', pid: 1, alive: false } }).ok, false, 'another instance\'s claim proves nothing');
  dropClaim('aaaa', path);
  assert.equal(readClaim(path), null);
});

test('the process holds caffeinate -ims -w <its pid> on macOS only', async () => {
  const { keepAwake } = await import('../src/awake.mjs');
  const calls = [];
  const spawnImpl = (cmd, args) => {
    calls.push([cmd, ...args]);
    return { pid: 4242, unref() {} };
  };
  assert.deepEqual(keepAwake({ pid: 77, platform: 'darwin', spawnImpl }), { held: true, pid: 4242, why: 'caffeinate -ims -w 77' });
  assert.deepEqual(calls, [['caffeinate', '-ims', '-w', '77']]);
  assert.equal(keepAwake({ pid: 77, platform: 'linux', spawnImpl }).held, false);
});
