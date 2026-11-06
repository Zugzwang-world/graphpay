// The site errand script's reading of a stream (W4: tokens and seconds per agent and per call).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { story } from '../../packages/config/index.mjs';
import { parseSiteArgs, readErrand, summarize } from '../agents/site-errand.mjs';

const call = (over = {}) => ({ input: 1000, cached: 600, output: 200, reasoning: 150, usd: 0.0042, tools: [], seconds: 2.5, toolSeconds: 0, ...over });

test('the arguments: the story request by default; a request and a frames file may be given', () => {
  assert.deepEqual(parseSiteArgs([]), { request: story.order.request, frames: null });
  assert.equal(parseSiteArgs(['--request', 'two dosas under 9 USDT within an hour']).request, 'two dosas under 9 USDT within an hour');
  assert.throws(() => parseSiteArgs(['--runs', '3']), /usage/);
  assert.throws(() => parseSiteArgs(['--request']), /usage/);
});

test('a stream is read frame by frame and summed per agent and per call, with the result and the timeline', async () => {
  const frames = [
    ['started', { runId: 'run-1' }],
    ['trace', { seq: 1, type: 'agent.start', agent: 'concierge.x', role: 'concierge', task: {} }],
    ['trace', { seq: 2, type: 'agent.start', agent: 'scout.x', role: 'scout', task: {} }],
    ['trace', { seq: 3, type: 'agent.end', agent: 'scout.x', role: 'scout', output: {}, effort: 'low', seconds: 4.1, calls: [call({ tools: ['directory_list'] }), call()] }],
    ['trace', { seq: 4, type: 'agent.end', agent: 'concierge.x', role: 'concierge', output: {}, effort: 'high', seconds: 9, calls: [call({ seconds: 6 })] }],
    ['result', { status: 'paid', chosenShop: 'shop.x', priceUsdt: '4.800000', orderId: '0x01', receipt: { transaction: '0xab', explorerUrl: 'https://explorer/tx/0xab' }, refusals: [], mandate: { deadlineIso: '2026-11-07T00:50:00+05:30' } }],
  ];
  const body = frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(': keep-alive\n\n');
  const read = await readErrand(new Response(body), performance.now());
  assert.equal(read.length, frames.length);
  const s = summarize(read, { request: 'r', startedAt: 't', seconds: 9.5 });
  assert.equal(s.runId, 'run-1');
  assert.equal(s.result.status, 'paid');
  assert.equal(s.result.explorerUrl, 'https://explorer/tx/0xab');
  assert.equal(s.result.deadlineIso, '2026-11-07T00:50:00+05:30');
  assert.deepEqual(s.usage.total, { agents: 2, calls: 3, input: 3000, cached: 1800, output: 600, reasoning: 450, usd: 0.0126, modelSeconds: 11 });
  assert.deepEqual(s.usage.agents.map((a) => [a.role, a.effort, a.calls, a.seconds]), [['scout', 'low', 2, 4.1], ['concierge', 'high', 1, 9]]);
  assert.deepEqual(s.timeline.map((t) => `${t.type} ${t.role}`), ['agent.start concierge', 'agent.start scout', 'agent.end scout', 'agent.end concierge']);
});
