// W4: the routine steps in code (the default). Each model keeps one call for its judgment
// (concierge, analyst, risk); the scout, payer, storefront and dispatch are code under their
// own names, with the same events, messages and tool results the screens read.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RANKING_QUERY, runErrand, teamCast } from '../index.mjs';
import { createMockWorld, runMockErrand } from '../mocks/index.mjs';

const cast = teamCast();
const good = cast.shopByRole('good').ens;
const trap = cast.shopByRole('trap').ens;
const NOON_IST = Date.parse('2026-11-06T06:30:00.000Z');

const run = (options = {}) => runMockErrand({ now: NOON_IST, retryMs: 0, ...options });
const events = (runLog, type) => runLog.events.filter((e) => e.type === type);
const guards = (runLog, ok) => events(runLog, 'guard').filter((e) => e.ok === ok);
const refusals = (runLog) => runLog.result.refusals.map((r) => r.reason);

test('three model calls in all: the concierge, the analyst and the risk agent once each; the routine agents are code', async () => {
  const { runLog, metrics, world } = await run();
  assert.equal(runLog.result.status, 'paid');
  assert.equal(runLog.result.chosenShop, good);
  assert.equal(world.hooks.signed.length, 1);
  const ends = Object.fromEntries(events(runLog, 'agent.end').map((e) => [e.role, e]));
  for (const role of ['concierge', 'analyst', 'risk']) assert.equal(ends[role].calls.length, 1, role);
  for (const role of ['scout', 'payer', 'storefront', 'dispatch']) {
    assert.equal(ends[role].model, 'code', role);
    assert.deepEqual(ends[role].calls, [], role);
    assert.equal(ends[role].error, undefined, role);
  }
  assert.equal(metrics.calls, 3);
  const all = await run({ steps: 'model' });
  assert.ok(all.metrics.calls >= 17, `the all-model flow made ${all.metrics.calls} calls`);
});

test('every visible message is kept: the same messages, between the same agents, as when the models make every call', async () => {
  const coded = await run();
  const modeled = await run({ steps: 'model' });
  const lines = (runLog) => events(runLog, 'message').map((m) => `${m.from} → ${m.to}: ${m.text}`).sort();
  assert.deepEqual(lines(coded.runLog), lines(modeled.runLog));
  assert.deepEqual(coded.runLog.edges.length, modeled.runLog.edges.length);
  // What the phones and the explainer read, by tool: offers, the ranking, the quote, the payment.
  const results = (runLog) => new Set(events(runLog, 'tool.result').map((e) => e.tool));
  for (const tool of ['scout', 'analyst', 'pay_shop', 'directory_list', 'catalog_read', 'graphql', 'explain', 'get_quote', 'catalog_quote', 'pay_order', 'dispatch_confirm', 'ens_check']) {
    assert.ok(results(coded.runLog).has(tool), tool);
  }
  const shown = (runLog, tool) => events(runLog, 'tool.result').find((e) => e.tool === tool).output;
  assert.deepEqual(shown(coded.runLog, 'scout'), shown(modeled.runLog, 'scout'));
  assert.deepEqual(shown(coded.runLog, 'analyst').ranking, shown(modeled.runLog, 'analyst').ranking);
  assert.deepEqual(shown(coded.runLog, 'pay_shop'), shown(modeled.runLog, 'pay_shop'));
  // Both teams' agents still start and end, in parallel where they were.
  const at = (runLog, type, role) => events(runLog, type).find((e) => e.role === role).seq;
  assert.ok(Math.max(at(coded.runLog, 'agent.start', 'scout'), at(coded.runLog, 'agent.start', 'analyst')) < Math.min(at(coded.runLog, 'agent.end', 'scout'), at(coded.runLog, 'agent.end', 'analyst')));
  assert.deepEqual(events(coded.runLog, 'agent.start').map((e) => e.role).sort(), events(modeled.runLog, 'agent.start').map((e) => e.role).sort());
});

test("the analyst's visible graph read is code's fixed query, in the graph's spelling of the city, then its explain", async () => {
  const { runLog, world } = await run();
  const call = events(runLog, 'tool.call').find((e) => e.tool === 'graphql');
  assert.equal(call.agent, cast.buyer.analyst);
  assert.equal(call.input.query, RANKING_QUERY);
  assert.equal(call.input.variables.city, cast.city.name.toLowerCase());
  const answer = events(runLog, 'tool.result').find((e) => e.tool === 'graphql').output;
  const explain = events(runLog, 'tool.call').find((e) => e.tool === 'explain');
  assert.equal(explain.input.explainId, answer.extensions.arkiv.explainId);
  assert.equal(runLog.result.explainId, answer.extensions.arkiv.explainId);
  // One ranking read in all: code's own read and the model's are the same traced call now.
  assert.equal(events(runLog, 'tool.call').filter((e) => e.tool === 'graphql').length, 1);
  assert.equal(world.mcp.calls.filter((c) => c.tool === 'graphql').length, 1, 'no second, untraced read');
  const modeled = await run({ steps: 'model' });
  assert.equal(modeled.world.mcp.calls.filter((c) => c.tool === 'graphql').length, 3, "the all-model flow reads three times: code's query, the analyst's and the risk agent's");
  const riskTools = events(runLog, 'tool.call').filter((e) => e.agent.startsWith('risk.')).map((e) => e.tool).sort();
  assert.deepEqual(riskTools, ['ask', 'ens_check']);
});

test('the trap veto stands: a concierge that picks the trap is refused, and code does not pay another shop instead', async () => {
  const { runLog, world } = await run({ play: { concierge: 'price-only' } });
  assert.equal(runLog.result.modelChoice, trap);
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['SHOP_NOT_ELIGIBLE']);
  assert.equal(world.hooks.signed.length, 0);
});

test("a lying analyst's opinion never reaches the concierge: code's ranking keeps the trap out, the feed shows the disagreement, the good shop is paid", async () => {
  const lying = await run({ play: { analyst: 'lying', concierge: 'trusts-analyst' } });
  assert.ok(guards(lying.runLog, false).some((g) => g.guard === 'G2' && g.detail.includes("code's ranking stands")));
  const start = events(lying.runLog, 'tool.result').find((e) => e.tool === 'analyst');
  assert.equal(start.output.ranking.find((r) => r.ens === trap).eligible, false);
  assert.equal(lying.runLog.result.status, 'paid');
  assert.equal(lying.runLog.result.chosenShop, good);
  assert.equal(lying.world.hooks.surfaces.get(trap).paid.length, 0);
});

test('no stop after planning: a concierge that names no shop, or a shop not in the ranking, still buys code’s best fitting offer', async () => {
  for (const play of ['no-choice', 'unknown-choice']) {
    const { runLog, world } = await run({ play: { concierge: play } });
    assert.equal(runLog.result.status, 'paid', play);
    assert.equal(runLog.result.chosenShop, good, play);
    assert.equal(world.hooks.signed.length, 1, play);
    assert.ok(guards(runLog, true).some((g) => g.guard === 'G2' && /code's best eligible offer within the limits is/.test(g.detail)), play);
  }
});

test("the risk agent may only be stricter: its decline refuses the buyer even when code's check passes", async () => {
  const { runLog, world } = await run({ play: { risk: 'declines' } });
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['SHOP_REFUSED']);
  assert.equal(world.hooks.signed.length, 0);
  assert.ok(guards(runLog, false).some((g) => g.guard === 'G9' && /risk agent: MOCK: the risk agent says no/.test(g.detail)));
});

test('a directory read that fails is tried once more; a second failure leaves no offers and no purchase', async () => {
  const once = createMockWorld({ now: NOON_IST });
  const directory = once.hooks.directory;
  let failures = 1;
  once.hooks.directory = async (q) => {
    if (failures-- > 0) throw new Error('arkiv 429');
    return directory(q);
  };
  const opts = (world) => ({ now: NOON_IST, mode: 'mock', retryMs: 0, cast: world.cast, hooks: world.hooks, mcp: world.mcp, mockModels: world.mockModels });
  const retried = await runErrand(opts(once));
  assert.equal(retried.runLog.result.status, 'paid');
  assert.equal(events(retried.runLog, 'tool.call').filter((e) => e.tool === 'directory_list').length, 2);
  const down = createMockWorld({ now: NOON_IST });
  down.hooks.directory = async () => {
    throw new Error('arkiv 429');
  };
  const failed = await runErrand(opts(down));
  assert.equal(failed.runLog.result.status, 'no-purchase');
  assert.equal(down.hooks.signed.length, 0);
  assert.match(events(failed.runLog, 'agent.end').find((e) => e.role === 'scout').error, /arkiv 429/);
});

test('steps must be code or model', async () => {
  await assert.rejects(run({ steps: 'magic' }), /steps must be one of code, model/);
});
