// The live runner's own guards, without a network: the names it needs, the rate limit and the
// one-errand-at-a-time rule (the start-up is replaced through buildParts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLiveRunner, FACILITATOR_BUSY, LIVE_RUNNER_NEEDS, liveRunnerMissing, payWithRetry, VERIFY_UNAVAILABLE } from '../src/live-runner.mjs';

const full = Object.fromEntries(LIVE_RUNNER_NEEDS.map((n) => [n, n === 'ALLOW_REAL_NETWORK' ? '1' : `value-of-${n.toLowerCase()}`]));
const input = { runId: 'run-test', request: 'test', onEvent: () => {}, signal: new AbortController().signal };

test('it names what is missing, never a value, and answers null without it', () => {
  assert.deepEqual(liveRunnerMissing(full), []);
  const { ALLOW_REAL_NETWORK, ...noNetwork } = full;
  assert.deepEqual(liveRunnerMissing(noNetwork), ['ALLOW_REAL_NETWORK']);
  assert.deepEqual(liveRunnerMissing({ ...full, ALLOW_REAL_NETWORK: 'yes' }), ['ALLOW_REAL_NETWORK']);
  assert.equal(createLiveRunner(noNetwork), null);
  for (const line of liveRunnerMissing(noNetwork)) assert.ok(!line.includes('value-of-'));
});

test('no rate limit (the founder): start-up failures never block the next errand', async () => {
  const run = createLiveRunner(full, { buildParts: async () => Promise.reject(Object.assign(new Error('offline'), { code: 'OFFLINE' })) });
  for (let i = 0; i < 10; i += 1) await assert.rejects(run(input), { code: 'OFFLINE' });
});

test('one errand at a time, until its last step has finished', async () => {
  let release;
  const run = createLiveRunner(full, { buildParts: () => new Promise((_, reject) => (release = () => reject(new Error('done')))) });
  const first = run(input);
  await assert.rejects(run(input), { code: 'LIVE_RUNNER_BUSY' });
  release();
  await assert.rejects(first, /done/);
  // Cleared after its last step, and a busy refusal took no rate-limit slot.
  await assert.rejects(Promise.race([run(input), new Promise((_, no) => setTimeout(() => no(new Error('still pending')), 50))]), (e) => e.code !== 'LIVE_RUNNER_BUSY');
});

test('a signed payment is sent again only when the shop says its verify failed or it was starting', async () => {
  const answers = (list) => {
    const calls = [];
    return { calls, pay: async (args) => (calls.push(args), list.shift()) };
  };
  const sleep = async () => {};
  const unavailable = { status: 502, body: { error: VERIFY_UNAVAILABLE } };
  // The settle 502 can come after a broadcast: never retried.
  const settleUnknown = { status: 502, body: { error: 'facilitator unavailable; retry is safe' } };
  const paid = { status: 200, body: { status: 'paid' } };
  // 502, 502, then paid: two retries with the same arguments.
  let a = answers([unavailable, unavailable, paid]);
  assert.equal((await payWithRetry(a.pay, { signature: 's' }, { sleep })).status, 200);
  assert.equal(a.calls.length, 3);
  assert.ok(a.calls.every((c) => c.signature === 's'));
  // The facilitator busy (before any send) is retried too.
  a = answers([{ status: 502, body: { error: FACILITATOR_BUSY, reason: 'busy' } }, paid]);
  assert.equal((await payWithRetry(a.pay, { signature: 's' }, { sleep })).status, 200);
  assert.equal(a.calls.length, 2);
  // Never more than the waits allow.
  a = answers([unavailable, unavailable, unavailable, paid]);
  assert.equal((await payWithRetry(a.pay, { signature: 's' }, { sleep })).status, 502);
  assert.equal(a.calls.length, 3);
  // A receipt timeout (504) or a refusal is not retried: it may have moved money, or it is final.
  for (const r of [settleUnknown, { status: 504, body: { status: 'pending', reason: 'receipt_timeout' } }, { status: 402, body: { status: 'refused' } }, { status: 503, body: { status: 'pending', reason: 'in_flight' } }]) {
    a = answers([r, paid]);
    assert.equal((await payWithRetry(a.pay, { signature: 's' }, { sleep })).status, r.status);
    assert.equal(a.calls.length, 1);
  }
  // A stopped run is not retried.
  const stopped = new AbortController();
  stopped.abort();
  a = answers([unavailable, paid]);
  assert.equal((await payWithRetry(a.pay, { signature: 's' }, { sleep, signal: stopped.signal })).status, 502);
  assert.equal(a.calls.length, 1);
  // Stopped during the wait: nothing more is sent.
  const later = new AbortController();
  a = answers([unavailable, paid]);
  assert.equal((await payWithRetry(a.pay, { signature: 's' }, { sleep: async () => later.abort(), signal: later.signal })).status, 502);
  assert.equal(a.calls.length, 1);
});
