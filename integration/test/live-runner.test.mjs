// The live runner's own guards, without a network: the names it needs, the rate limit and the
// one-errand-at-a-time rule (the start-up is replaced through buildParts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLiveRunner, LIVE_RUNNER_NEEDS, liveRunnerMissing, RUNS_PER_HOUR } from '../src/live-runner.mjs';

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

test('the rate limit counts started errands over a rolling hour', async () => {
  let t = 0;
  const run = createLiveRunner(full, { now: () => t, buildParts: async () => Promise.reject(Object.assign(new Error('offline'), { code: 'OFFLINE' })) });
  for (let i = 0; i < RUNS_PER_HOUR; i += 1) await assert.rejects(run(input), { code: 'OFFLINE' });
  await assert.rejects(run(input), { code: 'LIVE_RUNNER_RATE_LIMITED' });
  t = 3_600_001;
  await assert.rejects(run(input), { code: 'OFFLINE' });
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
