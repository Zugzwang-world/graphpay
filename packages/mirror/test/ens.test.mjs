import assert from 'node:assert/strict';
import { test } from 'node:test';
import { disposableAgent, namespacePlan } from '@graphpay/ens';
import { isDisposableName, keepEnsWatcher, spareKeeper, watchedNames } from '../src/ens.mjs';

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

test('the spare keeper runs one at a time, folds the kicks that come while it runs into one more run, and logs its lines', async () => {
  const lines = [];
  const runs = [];
  let finish;
  const run = (file, args) => {
    runs.push([file.split('/').slice(-3).join('/'), ...args]);
    return new Promise((resolve) => {
      finish = () => resolve({ code: 0, out: 'spare ready: a name\n' });
    });
  };
  const keeper = spareKeeper({ log: (l) => lines.push(l), run });
  const first = keeper.kick('start');
  keeper.kick('one revoked');
  keeper.kick('two revoked');
  assert.equal(runs.length, 1);
  finish();
  await first;
  await new Promise((r) => setImmediate(r));
  assert.equal(runs.length, 2); // the two kicks while it ran became one more run
  finish();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(runs[0], ['scripts/ens/spare.mjs', '--yes']);
  assert.ok(lines.includes('spare keeper: spare ready: a name'));
  assert.ok(lines.some((l) => /\(start\): exit 0/.test(l)));
  const off = spareKeeper({ log: () => {}, run: () => assert.fail('a disabled keeper must not run'), disabled: true });
  await off.kick('start');
});

test('only a numbered disposable agent of the persona counts as disposable', () => {
  const plan = namespacePlan();
  assert.ok(isDisposableName(disposableAgent(2).name));
  assert.ok(isDisposableName(disposableAgent(17).name));
  for (const n of [...plan.owners.map((o) => o.name), ...plan.agents.map((a) => a.name)]) assert.ok(!isDisposableName(n), n);
  const label = disposableAgent(2).label;
  assert.ok(!isDisposableName(`${label}.${plan.owners.at(-1).name}`)); // the same label under a shop
  assert.ok(!isDisposableName(disposableAgent(2).name.replace(/[0-9]+/, '0')));
});

test('a failed keeper run is tried again after a while; exit 2 (a missing key) waits for a person', async () => {
  const lines = [];
  const timers = [];
  const codes = [1, 0];
  let runs = 0;
  const keeper = spareKeeper({ log: (l) => lines.push(l), run: async () => ({ code: codes[runs++] ?? 0, out: '' }), retryMs: 5, setTimer: (fn) => timers.push(fn) });
  await keeper.kick('start');
  await new Promise((r) => setImmediate(r));
  assert.equal(timers.length, 1); // exit 1: one retry scheduled
  await timers.shift()();
  await new Promise((r) => setImmediate(r));
  assert.equal(runs, 2);
  assert.equal(timers.length, 0); // exit 0: no more
  const blocked = spareKeeper({ log: () => {}, run: async () => ({ code: 2, out: '' }), setTimer: (fn) => timers.push(fn) });
  await blocked.kick('start');
  await new Promise((r) => setImmediate(r));
  assert.equal(timers.length, 0);
});
