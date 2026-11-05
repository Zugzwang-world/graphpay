import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFrames, streamEvents, waitingForIn } from './sse-client.ts';

test('frames split on blank lines; a partial frame waits for more', () => {
  const { frames, rest } = parseFrames('event: call\ndata: {"call":1}\n\n: keep-alive\n\nevent: answer\ndata: {"a"');
  assert.deepEqual(frames, [{ event: 'call', data: '{"call":1}' }]);
  assert.equal(rest, 'event: answer\ndata: {"a"');
});

test('multi-line data joins with newlines and the default event is message', () => {
  assert.deepEqual(parseFrames('data: a\ndata: b\r\n\r\n').frames, [{ event: 'message', data: 'a\nb' }]);
});

test('a stream delivers every event in order', async (t) => {
  const body = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode('event: call\ndata: 1\n\nevent: ca'));
      controller.enqueue(enc.encode('ll\ndata: 2\n\n'));
      controller.close();
    },
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
  const seen: string[] = [];
  const outcome = await streamEvents('/api/race', (event, data) => seen.push(`${event}:${data}`));
  assert.deepEqual(outcome, { kind: 'ended' });
  assert.deepEqual(seen, ['call:1', 'call:2']);
});

test('a 503 "not live yet" answer is read as JSON, not as a stream', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'not live yet', waitingFor: 'M9 live benchmark' }, { status: 503 }));
  const outcome = await streamEvents('/api/race', () => assert.fail('no events expected'));
  assert.equal(outcome.kind, 'refused');
  assert.equal(waitingForIn(outcome), 'M9 live benchmark');
});
