import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disposableAgent, namespacePlan } from '@graphpay/ens';
import { keepEnsWatcher, watchedNames } from '../src/ens.mjs';

test('the watcher tracks the owners, the agents and every disposable agent that has a wallet role', () => {
  const plan = namespacePlan();
  const names = watchedNames({ roles: { DISPOSABLE_2: '0x1', DISPOSABLE_3: '0x2', FUNDER: '0x3' } });
  for (const n of [...plan.owners.map((o) => o.name), ...plan.agents.map((a) => a.name), disposableAgent(2).name, disposableAgent(3).name]) assert.ok(names.includes(n), n);
  assert.ok(!names.includes(disposableAgent(4).name));
  assert.equal(new Set(names).size, names.length);
});

test('a failed start is retried until it runs, and stop() ends the retries', async () => {
  const timers = [];
  const lines = [];
  // ENS_WATCHER=0 makes the start succeed at once; a missing Sepolia RPC makes it fail first.
  let calls = 0;
  const opts = {
    get env() {
      calls += 1;
      return calls === 1 ? null : { ENS_WATCHER: '0' };
    },
    values: [],
    log: (l) => lines.push(l),
  };
  const kept = keepEnsWatcher(opts, { retryMs: 1, setTimer: (fn) => timers.push(fn), clearTimer: () => {} });
  await new Promise((r) => setImmediate(r));
  assert.match(lines.join('\n'), /start failed/);
  assert.equal(timers.length, 1);
  await timers[0]();
  assert.match(lines.at(-1), /off \(ENS_WATCHER=0\)/);
  kept.stop();
});
