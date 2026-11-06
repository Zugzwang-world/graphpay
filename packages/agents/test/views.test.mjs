// W4: the model reads short tool replies; the run log, the screens and the explainer keep the
// whole answer. And the concierge gets the limits code read from the request.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createRunLog, teamCast } from '../index.mjs';
import { analystView, scoutView } from '../src/buyer.mjs';
import { MODEL_VIEW, mcpJson, tracedMcpTools } from '../src/graph.mjs';
import { runMockErrand } from '../mocks/index.mjs';

const cast = teamCast();
const NOON_IST = Date.parse('2026-11-06T06:30:00.000Z');
const KEYS = Array.from({ length: 250 }, (_, i) => `0x${i.toString(16).padStart(64, '0')}`);

// The hosted MCP server's shape: the answer as JSON text in a content part.
const mcpAnswer = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }], isError: false });
const graphAnswer = { data: { nodes: [{ ens: 'a.graphpay.eth', reputation: { orders: '274', refundRate: '0.0328' } }] }, extensions: { arkiv: { calls: 5, explainId: '1ba16043160a', entityKeys: KEYS } } };
const trace = { calls: 5, queries: ['q1', 'q2', 'q3', 'q4', 'q5'], entityKeys: KEYS, blockNumber: '300728', note: 'complete' };

function fakeMcpTools() {
  const tool = (answer) => ({ description: 'x', inputSchema: z.object({}).passthrough(), execute: async () => answer, toModelOutput: ({ output }) => ({ type: 'content', value: output.content }) });
  return { graphql: tool(mcpAnswer(graphAnswer)), explain: tool(mcpAnswer(trace)), ask: tool({ content: [{ type: 'text', text: 'ens\\tstatus' }] }) };
}

test('the model reads a graph answer without its entity keys; the run log keeps the whole answer', async () => {
  const log = createRunLog();
  const tools = tracedMcpTools(fakeMcpTools(), log, 'analyst.x', { only: ['graphql', 'explain', 'ask'] });
  const out = await tools.graphql.execute({ query: 'q' }, { toolCallId: '1' });
  const model = await tools.graphql.toModelOutput({ toolCallId: '1', input: {}, output: out });
  assert.equal(model.type, 'json');
  assert.deepEqual(model.value, { data: graphAnswer.data, extensions: { arkiv: { explainId: '1ba16043160a', calls: 5 } } });
  assert.ok(JSON.stringify(model.value).length < JSON.stringify(out).length / 10);
  const logged = log.events.find((e) => e.type === 'tool.result' && e.tool === 'graphql');
  assert.deepEqual(mcpJson(logged.output).extensions.arkiv.entityKeys, KEYS, 'the screens and the explainer keep every key');
  const ex = await tools.explain.toModelOutput({ output: await tools.explain.execute({ explainId: '1ba16043160a' }, { toolCallId: '2' }) });
  assert.deepEqual(ex.value, { calls: 5, reads: 5, entities: 250, blockNumber: '300728', note: 'complete', shown: 'the full trace is on the human’s screen' });
  // A tool with no short view, an error or text that is not JSON: the tool's own conversion.
  const ask = await tools.ask.toModelOutput({ output: await tools.ask.execute({}, { toolCallId: '3' }) });
  assert.equal(ask.type, 'content');
  const failed = { content: [{ type: 'text', text: 'boom' }], isError: true };
  assert.equal((await tools.graphql.toModelOutput({ output: failed })).type, 'content');
});

test('a mock answer (a plain object) gets the same short view', () => {
  assert.deepEqual(MODEL_VIEW.graphql(mcpJson(graphAnswer)).extensions, { arkiv: { explainId: '1ba16043160a', calls: 5 } });
  assert.equal(mcpJson({ content: [{ type: 'text', text: 'not json' }] }), null);
});

test("the concierge reads its team's reports without the extras; the phones keep the whole reports", async () => {
  const { runLog } = await runMockErrand({ now: NOON_IST });
  const result = (tool) => runLog.events.find((e) => e.type === 'tool.result' && e.tool === tool).output;
  const scout = scoutView(result('scout'));
  assert.deepEqual(Object.keys(scout.offers[0]).sort(), ['distanceKm', 'etaMinutes', 'priceUsdt', 'shop']);
  assert.ok(result('scout').offers[0].sku, 'the log keeps the sku');
  const analyst = analystView(result('analyst'));
  assert.deepEqual(Object.keys(analyst).sort(), ['analystView', 'explainId', 'ranking', 'synthetic']);
  assert.ok(analyst.ranking.every((r) => Number.isFinite(r.score) && String(r.score).split('.')[1]?.length <= 3));
  assert.equal(analyst.ranking.find((r) => r.ens === cast.shopByRole('trap').ens).eligible, false, 'the trap veto reaches the concierge');
  assert.ok('analystExplainId' in result('analyst'), 'the log keeps the analyst’s own explain id');
});

test("the concierge's task carries the limits code read; a good model's need then matches them", async () => {
  const { runLog } = await runMockErrand({ now: NOON_IST });
  const start = runLog.events.find((e) => e.type === 'agent.start' && e.role === 'concierge');
  assert.deepEqual(start.task.limits, { budgetUsdt: runLog.result.mandate.budgetUsdt, deadlineIso: runLog.result.mandate.deadlineIso });
  assert.ok(runLog.events.some((e) => e.type === 'guard' && e.guard === 'G1' && /the need matches the human's words/.test(e.detail)));
});

test('the SDK sends the model the short view: the second prompt has the data and the explain id, not the keys', async () => {
  const { MockLanguageModelV4 } = await import('ai/test');
  const { ToolLoopAgent, isStepCount } = await import('ai');
  const prompts = [];
  const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt);
      return prompts.length === 1
        ? { content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'graphql', input: '{"query":"q"}' }], finishReason: { unified: 'tool-calls', raw: undefined }, usage, warnings: [] }
        : { content: [{ type: 'text', text: 'done' }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] };
    },
  });
  const tools = tracedMcpTools(fakeMcpTools(), createRunLog(), 'analyst.x', { only: ['graphql'] });
  await new ToolLoopAgent({ model, instructions: 'x', tools, stopWhen: isStepCount(3) }).generate({ prompt: 'go' });
  const sent = JSON.stringify(prompts[1].filter((m) => m.role === 'tool'));
  assert.match(sent, /1ba16043160a/);
  assert.match(sent, /a\.graphpay\.eth/);
  assert.doesNotMatch(sent, /entityKeys/);
  assert.ok(sent.length < 1500, `the tool reply the model reads is ${sent.length} characters`);
});
