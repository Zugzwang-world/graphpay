// POST /api/agents/run end to end: the passcode first, then the request check, then
// the runner seam (none yet: "not live"), then one errand at a time, streamed back.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setErrandRunnerForTests } from './agents-live.server.ts';
import { MIN_PASSCODE_LENGTH, PASSCODE_HEADER } from './passcode.ts';
import type { RunResult } from './contracts.ts';
import { POST } from '../app/api/agents/run/route.ts';
import { GET } from '../app/api/agents/run/[id]/events/route.ts';

const passcode = 'r'.repeat(MIN_PASSCODE_LENGTH + 2);
const call = (body: unknown, code: string | null = passcode) =>
  POST(new Request('https://example.test/api/agents/run', { method: 'POST', headers: code ? { [PASSCODE_HEADER]: code } : {}, body: JSON.stringify(body) }));
const result: RunResult = { status: 'paid', chosenShop: null, priceUsdt: null, receipt: null, orderId: null, arrivesAt: null, ranking: [], explainId: null, refusals: [], narrative: null, modelChoice: null, mandate: null, synthetic: true };

test('no passcode, no run: the runner is never called', async () => {
  process.env.DEMO_PASSCODE = passcode;
  let called = false;
  setErrandRunnerForTests(async () => ((called = true), result));
  assert.equal((await call({ request: 'hi' }, null)).status, 401);
  assert.equal((await call({ request: 'hi' }, 'wrong')).status, 401);
  assert.equal(called, false);
  setErrandRunnerForTests(null);
});

test('with the passcode but no runner wired, the answer is "not live yet"', async () => {
  process.env.DEMO_PASSCODE = passcode;
  setErrandRunnerForTests(null);
  const response = await call({ request: 'a request typed by a person' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'not live yet');
});

test('an empty, missing or oversized request is a 400', async () => {
  process.env.DEMO_PASSCODE = passcode;
  setErrandRunnerForTests(async () => result);
  for (const body of [{}, { request: '' }, { request: '   ' }, { request: 5 }, { request: 'x'.repeat(401) }]) assert.equal((await call(body)).status, 400);
  setErrandRunnerForTests(null);
});

test('a run streams back, a second while it runs is 409, and its id replays it', async () => {
  process.env.DEMO_PASSCODE = passcode;
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  setErrandRunnerForTests(async ({ request }) => {
    await gate;
    return { ...result, narrative: request };
  });
  const first = await call({ request: 'one' });
  assert.equal(first.status, 200);
  assert.equal((await call({ request: 'two' })).status, 409);
  release();
  const text = await first.text();
  assert.match(text, /event: started/);
  assert.match(text, /event: result/);
  const runId = /"runId":"([0-9a-f-]{36})"/.exec(text)?.[1];
  assert.ok(runId);
  const replay = await GET(new Request('https://example.test/x'), { params: Promise.resolve({ id: runId }) });
  assert.match(await replay.text(), /event: result/);
  assert.equal((await GET(new Request('https://example.test/x'), { params: Promise.resolve({ id: 'nope' }) })).status, 404);
  setErrandRunnerForTests(null);
});
