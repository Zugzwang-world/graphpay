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
  assert.equal(failed.runLog.result.status, 'refused');
  assert.deepEqual(refusals(failed.runLog), ['NO_OFFER']);
  assert.equal(down.hooks.signed.length, 0);
  assert.match(events(failed.runLog, 'agent.end').find((e) => e.role === 'scout').error, /arkiv 429/);
});

test('steps must be code or model', async () => {
  await assert.rejects(run({ steps: 'magic' }), /steps must be one of code, model/);
});

test('when the graph tools cannot be listed, the analyst still ends, nothing is eligible and nothing is paid', async () => {
  const world = createMockWorld({ now: NOON_IST });
  world.mcp.tools = async () => {
    throw new Error('mcp down');
  };
  const { runLog } = await runErrand({ now: NOON_IST, mode: 'mock', retryMs: 0, cast: world.cast, hooks: world.hooks, mcp: world.mcp, mockModels: world.mockModels });
  assert.ok(events(runLog, 'agent.end').some((e) => e.role === 'analyst'));
  assert.ok(guards(runLog, false).some((g) => g.guard === 'G2' && /GRAPH_READ_FAILED/.test(g.detail)));
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['NO_ELIGIBLE_SHOP']);
  assert.equal(world.hooks.signed.length, 0);
});

test('a run stopped before paying pays nothing: no quote, no 402, no signature', async () => {
  const ac = new AbortController();
  const { runLog, world } = await run({ signal: ac.signal, onEvent: (e) => e.type === 'agent.end' && e.role === 'scout' && ac.abort() });
  assert.equal(world.hooks.signed.length, 0);
  assert.equal(world.hooks.quotes.entries.length, 0, 'no 402 was asked for');
  assert.ok(refusals(runLog).includes('STOPPED'));
  assert.notEqual(runLog.result.status, 'paid');
});

test("a failed concierge model leaves the model's choice and prose empty; code's purchase is recorded, and the screens see no refusal", async () => {
  const { runLog } = await run({ faults: { concierge: 'empty' } });
  assert.equal(runLog.result.status, 'paid');
  assert.equal(runLog.result.chosenShop, good);
  assert.equal(runLog.result.modelChoice, null);
  assert.equal(runLog.result.narrative, null);
  const end = events(runLog, 'agent.end').find((e) => e.role === 'concierge');
  assert.equal(end.error, undefined);
  assert.match(end.modelError, /empty reply/);
});

test('the trap is vetoed however the model spells it', async () => {
  const { runLog, world } = await run({ play: { concierge: 'trap-upper' } });
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['SHOP_NOT_ELIGIBLE']);
  assert.equal(world.hooks.signed.length, 0);
});

test('an eligible pick that does not fit the limits is a slip, not a veto: code pays its best fitting offer', async () => {
  // Within 48 minutes the good shop (45) fits and the runner-up (50) does not.
  const { runLog, world } = await run({ play: { concierge: 'late-pick' }, request: cast.order.request.replace('an hour', '48 minutes') });
  assert.equal(runLog.result.status, 'paid');
  assert.equal(runLog.result.chosenShop, good);
  assert.deepEqual(refusals(runLog), ['MISSES_DEADLINE']);
  assert.equal(world.hooks.signed.length, 1);
  assert.ok(guards(runLog, true).some((g) => g.guard === 'G2' && /does not fit the limits \(MISSES_DEADLINE\)/.test(g.detail)));
});

test("the shop's buyer check tries a read that throws once more: a dropped connection does not refuse the buyer, a second failure still does", async () => {
  const flaky = (failures) => {
    const world = createMockWorld({ now: NOON_IST });
    const call = world.mcp.call.bind(world.mcp);
    const tools = world.mcp.tools.bind(world.mcp);
    let left = failures;
    world.mcp.call = async (name, args) => {
      if (name === 'ask' && left-- > 0) throw new TypeError('fetch failed');
      return call(name, args);
    };
    world.mcp.tools = async () => {
      const t = await tools();
      const ask = t.ask;
      return { ...t, ask: { ...ask, execute: async (input, options) => { if (left-- > 0) throw new TypeError('fetch failed'); return ask.execute(input, options); } } };
    };
    return world;
  };
  const opts = (world) => ({ now: NOON_IST, mode: 'mock', retryMs: 0, cast: world.cast, hooks: world.hooks, mcp: world.mcp, mockModels: world.mockModels });
  const once = flaky(1);
  const recovered = await runErrand(opts(once));
  assert.equal(recovered.runLog.result.status, 'paid');
  const twice = flaky(10);
  const refused = await runErrand(opts(twice));
  assert.equal(refused.runLog.result.status, 'refused');
  assert.deepEqual(refusals(refused.runLog), ['SHOP_REFUSED']);
  assert.equal(twice.hooks.signed.length, 0);
});
