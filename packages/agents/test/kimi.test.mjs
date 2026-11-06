// Kimi (Moonshot AI) as a provider in the agent presets: the key goes only to the
// configured host, the preset's effort and token cap reach the request, the full
// assistant message (reasoning_content, tool_calls) goes back every turn, and the
// cost comes from the config's Kimi prices.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config, story } from '@graphpay/config';
import { Output, ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
import { createMeter, createModelFactory, resolveAgentMode } from '../index.mjs';

const KEY = ['kimi', 'test', 'Q'.repeat(24)].join('-');
const env = { KIMI_API_KEY: KEY };
const roles = Object.keys(story.agentModels.presets.testing.roles);

// W4: the concierge and the analyst decide, so they stay at high; the routine roles run at low.
const HIGH = new Set(['concierge', 'analyst']);

test('the testing, video and live presets are Kimi, high for the concierge and the analyst and low for the routine roles; Anthropic stays as named fallbacks', () => {
  const presets = story.agentModels.presets;
  for (const [name, model] of [['testing', 'kimi-k3.1-pro'], ['video', 'kimi-k3.1-pro-highspeed'], ['live', 'kimi-k3.1-pro-highspeed']]) {
    for (const role of roles) assert.deepEqual({ ...presets[name].roles[role] }, { provider: 'moonshot', model, effort: HIGH.has(role) ? 'high' : 'low', maxTokens: 32000 }, `${name}/${role}`);
  }
  assert.equal(story.agentModels.active, 'testing');
  for (const name of ['anthropic-testing', 'anthropic-video', 'anthropic-live']) {
    assert.ok(roles.every((r) => presets[name].roles[r].provider === 'anthropic'), name);
  }
});

test('the factory needs the Kimi key for a Kimi preset and names the variable, never a value', () => {
  assert.throws(() => createModelFactory({ mode: 'live', env: {} }), (e) => /KIMI_API_KEY is not set/.test(e.message));
  assert.throws(() => createModelFactory({ mode: 'live', env: { ANTHROPIC_API_KEY: 'sk-ant-x' } }), /KIMI_API_KEY is not set/);
  const factory = createModelFactory({ mode: 'live', env: { AGENT_PRESET: 'anthropic-testing', ANTHROPIC_API_KEY: 'sk-ant-x' } });
  assert.equal(factory('concierge').settings.provider, 'anthropic');
  assert.throws(() => createModelFactory({ mode: 'live', env: { ...env, AGENT_PRESET: 'nope' } }), /not in the story config/);
});

test('the old mode name anthropic still means live', () => {
  assert.equal(resolveAgentMode({ AGENT_MODE: 'anthropic' }), 'live');
  assert.equal(createModelFactory({ mode: 'anthropic', env })('payer').settings.provider, 'moonshot');
});

function completion(message, finish = 'stop') {
  return {
    id: 'cmpl-1',
    object: 'chat.completion',
    created: 1,
    model: 'kimi-k3.1-pro',
    choices: [{ index: 0, message, finish_reason: finish }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, prompt_tokens_details: { cached_tokens: 40 }, completion_tokens_details: { reasoning_tokens: 30 } },
  };
}

test('requests carry the key only to the configured host, the preset effort and cap, and the full history', async () => {
  const seen = [];
  const answers = [
    completion({ role: 'assistant', content: null, reasoning_content: 'I should look the shop up first.', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"shop":"a"}' } }] }, 'tool_calls'),
    completion({ role: 'assistant', content: '{"answer":"done"}', reasoning_content: 'The lookup says ok.' }),
  ];
  const fetch = async (url, init) => {
    seen.push({ url: String(url), headers: Object.fromEntries(new Headers(init.headers)), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(answers[seen.length - 1]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const { model, callSettings, settings } = createModelFactory({ mode: 'live', env, fetch })('scout');
  const agent = new ToolLoopAgent({
    model,
    instructions: 'test',
    tools: { lookup: tool({ description: 'look up', inputSchema: z.object({ shop: z.string() }), execute: async () => ({ ok: true }) }) },
    output: Output.object({ schema: z.object({ answer: z.string() }) }),
    stopWhen: isStepCount(4),
    ...callSettings,
  });
  const result = await agent.generate({ prompt: 'go' });
  assert.equal(result.output.answer, 'done');
  assert.equal(seen.length, 2);
  const base = new URL(config.models.moonshot.apiBaseUrl);
  for (const r of seen) {
    assert.equal(new URL(r.url).host, base.host);
    assert.equal(r.url, `${config.models.moonshot.apiBaseUrl}/chat/completions`);
    assert.equal(r.headers.authorization, `Bearer ${KEY}`);
    assert.equal(r.body.model, settings.model);
    assert.equal(r.body.reasoning_effort, settings.effort, 'the effort is fixed for the whole errand');
    assert.equal(r.body.reasoning_effort, 'low', 'the scout is a routine role');
    assert.equal(r.body.max_tokens ?? r.body.max_completion_tokens, 32000, 'max output tokens are always set');
    assert.equal('temperature' in r.body, false, 'temperature is fixed by the model and never sent');
  }
  const assistant = seen[1].body.messages.find((m) => m.role === 'assistant');
  assert.equal(assistant.reasoning_content, 'I should look the shop up first.', 'reasoning goes back');
  assert.equal(assistant.tool_calls[0].id, 'call_1');
  assert.equal(assistant.tool_calls[0].function.name, 'lookup');
  const toolMessages = seen[1].body.messages.filter((m) => m.role === 'tool');
  assert.equal(toolMessages.length, 1, 'one tool message per call');
  assert.equal(toolMessages[0].tool_call_id, 'call_1');
});

test('apiCostUsd for Kimi: cache reads at the cached rate, the rest of the prompt and the output at list price', () => {
  const meter = createMeter();
  const settings = { provider: 'moonshot', model: 'kimi-k3.1-pro' };
  const usage = { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, inputTokenDetails: { noCacheTokens: 400, cacheReadTokens: 600 } };
  meter.step('scout', settings, { usage });
  assert.ok(Math.abs(meter.costUsd - (400 * 2 + 500 * 10 + 600 * 0.2) / 1e6) < 1e-12);
  const fast = createMeter();
  fast.step('scout', { provider: 'moonshot', model: 'kimi-k3.1-pro-highspeed' }, { usage });
  assert.ok(Math.abs(fast.costUsd - (400 * 4 + 500 * 20 + 600 * 0.2) / 1e6) < 1e-12);
  assert.throws(() => createMeter().step('scout', { provider: 'unknown', model: 'x' }, { usage }), /no cost rule/);
});

test('Kimi gets the output schema in its instructions, not as a response_format, and the reply is parsed and validated here', async () => {
  const { runAgent } = await import('../src/agents.mjs');
  const { createRunLog } = await import('../src/runlog.mjs');
  const seen = [];
  const replies = ['```json\n{"summary":"Paid it","chosenShop":null}\n```', 'I will think about it.', ''];
  const fetch = async (url, init) => {
    seen.push(JSON.parse(init.body));
    return new Response(JSON.stringify(completion({ role: 'assistant', content: replies[seen.length - 1], reasoning_content: 'ok' })), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const models = createModelFactory({ mode: 'live', env, fetch });
  const go = () => runAgent({ role: 'concierge', ens: 'concierge.x.graphpay.eth', task: { a: 1 }, tools: {}, models, log: createRunLog(), meter: createMeter() });
  const ok = await go();
  assert.deepEqual(ok.output, { summary: 'Paid it', chosenShop: null });
  assert.equal('response_format' in seen[0], false);
  const system = seen[0].messages.find((m) => m.role === 'system').content;
  assert.match(system, /JSON Schema/);
  assert.match(system, /chosenShop/);
  assert.match((await go()).error, /not the JSON/);
  assert.match((await go()).error, /empty reply/);
});

test('each model call is recorded on agent.end: tokens in and cached, out and reasoning, its cost, its tools and, when timed, its seconds', async () => {
  const { runAgent } = await import('../src/agents.mjs');
  const { createRunLog } = await import('../src/runlog.mjs');
  const answers = [
    completion({ role: 'assistant', content: null, reasoning_content: 'look first', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{}' } }] }, 'tool_calls'),
    completion({ role: 'assistant', content: '{"summary":"done","chosenShop":null}', reasoning_content: 'ok' }),
  ];
  let n = 0;
  const fetch = async () => new Response(JSON.stringify(answers[n++]), { status: 200, headers: { 'content-type': 'application/json' } });
  const models = createModelFactory({ mode: 'live', env, fetch });
  const log = createRunLog();
  const tools = { lookup: tool({ description: 'look up', inputSchema: z.object({}), execute: async () => ({ ok: true }) }) };
  await runAgent({ role: 'concierge', ens: 'concierge.x.graphpay.eth', task: { a: 1 }, tools, models, log, meter: createMeter({ timing: true }) });
  const end = log.events.find((e) => e.type === 'agent.end');
  assert.equal(end.effort, 'high');
  assert.equal(end.calls.length, 2);
  const price = config.models.pricingUsdPerMTok[models('concierge').settings.model];
  for (const call of end.calls) {
    assert.deepEqual([call.input, call.cached, call.output, call.reasoning], [100, 40, 50, 30]);
    assert.ok(Math.abs(call.usd - (60 * price.input + 40 * price.cacheRead + 50 * price.output) / 1e6) < 1e-9);
    assert.ok(Number.isFinite(call.seconds) && call.seconds >= 0);
    assert.ok(Number.isFinite(call.toolSeconds) && call.toolSeconds >= 0);
  }
  assert.deepEqual(end.calls.map((c) => c.tools), [['lookup'], []]);
  assert.ok(Number.isFinite(end.seconds));
  // Untimed (mock runs): the same record without seconds.
  n = 0;
  const quiet = createRunLog();
  await runAgent({ role: 'concierge', ens: 'concierge.x.graphpay.eth', task: { a: 1 }, tools, models, log: quiet, meter: createMeter() });
  const untimed = quiet.events.find((e) => e.type === 'agent.end');
  assert.equal('seconds' in untimed, false);
  assert.equal('seconds' in untimed.calls[0], false);
});
