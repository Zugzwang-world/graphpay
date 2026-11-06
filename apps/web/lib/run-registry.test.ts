import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RunResult, TraceEvent } from './contracts.ts';
import { createRegistry, streamRun, type ErrandRunner } from './run-registry.server.ts';

const result: RunResult = { status: 'paid', chosenShop: null, priceUsdt: null, receipt: null, orderId: null, arrivesAt: null, ranking: [], explainId: null, refusals: [], narrative: null, modelChoice: null, mandate: null, synthetic: true };
const trace = (seq: number): TraceEvent => ({ seq, type: 'guard', guard: 'G1', ok: true, detail: `step ${seq}` });
const tick = () => new Promise((r) => setTimeout(r, 5));

// A run that waits for `release()` before it finishes.
function gated() {
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const runner: ErrandRunner = async ({ onEvent }) => {
    onEvent(trace(1));
    await gate;
    onEvent(trace(2));
    return result;
  };
  return { runner, release };
}

test('one errand at a time: a second start is busy until the first ends', async () => {
  const registry = createRegistry();
  const first = gated();
  const a = registry.start(first.runner, 'request');
  assert.equal(a.ok, true);
  assert.deepEqual(registry.start(first.runner, 'again'), { ok: false, reason: 'busy' });
  first.release();
  await tick();
  assert.equal(registry.start(first.runner, 'later').ok, true);
});

test('a failing runner ends the run with one fixed line, never its error text', async () => {
  const registry = createRegistry();
  const started = registry.start(async () => {
    throw new Error('https://keyed.example/rpc?key=SECRET failed');
  }, 'request');
  assert.ok(started.ok);
  await tick();
  const last = started.run.frames.at(-1);
  assert.deepEqual(last, { event: 'failed', data: { error: 'the errand failed' } });
  assert.ok(!JSON.stringify(started.run.frames).includes('SECRET'));
  assert.equal(registry.start(async () => result, 'next').ok, true);
});

test('a run past its time limit is aborted and reported as out of time', async () => {
  const registry = createRegistry({ maxRunMs: 10 });
  const started = registry.start(({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('x')))), 'request');
  assert.ok(started.ok);
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(started.run.frames.at(-1), { event: 'failed', data: { error: 'the errand ran out of time' } });
});

test('finished runs are kept for a while, then swept', async () => {
  let clock = 1000;
  const registry = createRegistry({ keepMs: 100, now: () => clock });
  const started = registry.start(async () => result, 'request');
  assert.ok(started.ok);
  await tick();
  assert.ok(registry.get(started.run.id));
  clock += 101;
  assert.equal(registry.get(started.run.id), null);
});

test('a stream replays what happened, follows the run live and ends with the result', async () => {
  const registry = createRegistry();
  const g = gated();
  const started = registry.start(g.runner, 'request');
  assert.ok(started.ok);
  await tick();
  const response = streamRun(started.run);
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  g.release();
  const text = await response.text();
  const events = [...text.matchAll(/^event: (\w+)$/gm)].map((m) => m[1]);
  assert.deepEqual(events, ['started', 'trace', 'trace', 'result']);
});

test('a stream of a finished run replays it and closes', async () => {
  const registry = createRegistry();
  const started = registry.start(async ({ onEvent }) => (onEvent(trace(1)), result), 'request');
  assert.ok(started.ok);
  await tick();
  const text = await streamRun(started.run).text();
  assert.match(text, /event: result/);
});

test('a runner that ignores the abort signal still frees the slot at the time limit', async () => {
  const registry = createRegistry({ maxRunMs: 10 });
  const started = registry.start(() => new Promise(() => {}), 'request');
  assert.ok(started.ok);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(started.run.done, true);
  assert.equal(registry.start(async () => result, 'next').ok, true);
});

test('a throwing watcher does not stop the run or the other watchers', async () => {
  const registry = createRegistry();
  const g = gated();
  const started = registry.start(g.runner, 'request');
  assert.ok(started.ok);
  const seen: string[] = [];
  started.run.listeners.add(() => {
    throw new Error('bad watcher');
  });
  started.run.listeners.add((frame) => void seen.push(frame.event));
  g.release();
  await tick();
  assert.deepEqual(seen, ['trace', 'result']);
});

test('the result is scrubbed of configured secret values', async () => {
  const { scrubSecrets } = await import('./run-registry.server.ts');
  const secret = 'sk-test-value-1234567890';
  const out = scrubSecrets({ narrative: `the key ${secret} leaked`, nested: [secret] }, { SOME_API_KEY: secret, OTHER: 'not-a-secret-name-value' });
  assert.ok(!JSON.stringify(out).includes(secret));
  assert.match(out.narrative, /\[redacted\]/);
});

test('the runner is told the run id the site knows the run by (the handoff rows are queried by it)', async () => {
  const registry = createRegistry();
  let seen: string | null = null;
  const started = registry.start(async ({ runId }) => {
    seen = runId;
    return { status: 'no-purchase', chosenShop: null, priceUsdt: null, receipt: null, orderId: null, arrivesAt: null, ranking: [], explainId: null, refusals: [], narrative: null, modelChoice: null, mandate: null, synthetic: true };
  }, 'a request');
  assert.equal(started.ok, true);
  await tick();
  assert.equal(seen, started.ok ? started.run.id : null);
  assert.match(String(seen), /\S/);
});

test("a runner's refusal code picks a fixed line; its message never leaves the server", async () => {
  const lines: string[] = [];
  for (const code of ['LIVE_RUNNER_BUSY', 'LIVE_RUNNER_RATE_LIMITED', 'RATE_LIMITED', 'constructor', undefined]) {
    const registry = createRegistry();
    const runner: ErrandRunner = async () => {
      throw Object.assign(new Error('https://rpc.example/secret-key-1234567890 failed'), code === undefined ? {} : { code });
    };
    const started = registry.start(runner, 'test');
    assert.ok(started.ok);
    await tick();
    const frames = JSON.stringify(started.run.frames);
    assert.ok(!frames.includes('secret-key') && !frames.includes('rpc.example'), frames);
    const failed = started.run.frames.find((f) => f.event === 'failed');
    assert.ok(failed && failed.event === 'failed' && typeof failed.data.error === 'string');
    lines.push(failed.data.error);
  }
  assert.match(lines[0] ?? "", /^busy/);
  // No rate limit any more (the founder): an old or foreign code is the plain line.
  assert.deepEqual(lines.slice(1), ['the errand failed', 'the errand failed', 'the errand failed', 'the errand failed']);
});
