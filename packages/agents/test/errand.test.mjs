// Whole errands on the scripted mock models: good play, bad play and the
// payer's refusals (planning/PROMPTS/10-agents.md step 5). Shops are named by
// their story role, never by label (ADR-0047).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promptFor, runErrand, TAIL, teamCast, usageOf, usageTable } from '../index.mjs';
import { base64JsonCodec } from '../index.mjs';
import { createMockWorld, MOCK_SDL, mockAddress, runMockErrand } from '../mocks/index.mjs';

const cast = teamCast();
const good = cast.shopByRole('good').ens;
const trap = cast.shopByRole('trap').ens;
const payer = cast.payers.payer.ens;
const NOON_IST = Date.parse('2026-11-06T06:30:00.000Z');

const run = (options = {}) => runMockErrand({ now: NOON_IST, ...options });
const events = (runLog, type) => runLog.events.filter((e) => e.type === type);
const guards = (runLog, ok) => events(runLog, 'guard').filter((e) => e.ok === ok);
const refusals = (runLog) => runLog.result.refusals.map((r) => r.reason);
const paidAt = (world, shopEns) => world.hooks.surfaces.get(shopEns).paid;

test('the good shop is chosen and paid once, with the receipt and arrival from tool data', async () => {
  const { runLog, world, state } = await run();
  assert.equal(runLog.schema, 'graphpay.agent-run/v1');
  assert.equal(runLog.mode, 'mock');
  assert.equal(runLog.synthetic, true);
  assert.equal(runLog.request, cast.order.request);
  assert.equal(runLog.result.status, 'paid');
  assert.equal(runLog.result.chosenShop, good);
  assert.equal(runLog.result.priceUsdt, '4.800000');
  assert.match(runLog.result.receipt.transaction, /^0x[0-9a-f]{64}$/);
  assert.equal(runLog.result.receipt.payTo, mockAddress(good));
  assert.ok(runLog.result.arrivesAt);
  assert.ok(runLog.result.explainId);
  assert.equal(world.hooks.signed.length, 1);
  assert.equal(paidAt(world, good).length, 1);
  assert.equal(state.spentMicro, 4_800_000n);
  assert.equal(state.reservedMicro, 0n);
  assert.deepEqual(guards(runLog, false), []);
});

test('scout and analyst run in parallel: both start before either ends', async () => {
  const { runLog } = await run();
  const at = (type, role) => events(runLog, type).find((e) => e.role === role).seq;
  const lastStart = Math.max(at('agent.start', 'scout'), at('agent.start', 'analyst'));
  const firstEnd = Math.min(at('agent.end', 'scout'), at('agent.end', 'analyst'));
  assert.ok(lastStart < firstEnd, `starts ${lastStart} must precede ends ${firstEnd}`);
});

test('the analyst answers with an explain id and the risk agent checks graphql and ens_check in one step (the models make every call)', async () => {
  const { runLog } = await run({ steps: 'model' });
  const graphqlResult = events(runLog, 'tool.result').find((e) => e.tool === 'graphql' && e.agent === cast.buyer.analyst);
  assert.match(graphqlResult.output.extensions.arkiv.explainId, /^[0-9a-f]{12}$/);
  assert.ok(events(runLog, 'tool.call').some((e) => e.tool === 'explain'));
  const riskCalls = events(runLog, 'tool.call').filter((e) => e.agent.startsWith('risk.'));
  assert.deepEqual(riskCalls.map((e) => e.tool).sort(), ['ens_check', 'graphql']);
});

test('the trap is never paid: a price-only concierge picks it and the guard refuses', async () => {
  const { runLog, world } = await run({ play: { concierge: 'price-only' } });
  assert.equal(runLog.result.modelChoice, trap);
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['SHOP_NOT_ELIGIBLE']);
  assert.equal(world.hooks.signed.length, 0);
  assert.equal(paidAt(world, trap).length, 0);
});

test('the trap is never paid: a lying analyst cannot make it eligible (the models make every call)', async () => {
  const { runLog, world } = await run({ steps: 'model', play: { analyst: 'lying', concierge: 'trusts-analyst' } });
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['SHOP_NOT_ELIGIBLE']);
  assert.ok(guards(runLog, false).some((g) => g.guard === 'G2' && g.detail.includes("code's ranking stands")));
  assert.equal(runLog.result.ranking.find((r) => r.ens === trap).eligible, false);
  assert.equal(world.hooks.signed.length, 0);
});

test('the model cannot widen the limits: a concierge asking for 10× the budget still pays within 6', async () => {
  const { runLog, state } = await run({ steps: 'model', play: { concierge: 'widen-limits' } });
  assert.equal(state.need.budgetUsdt, '6.000000');
  assert.ok(events(runLog, 'guard').some((g) => g.guard === 'G1' && /budget 60 → 6\.000000/.test(g.detail)));
  assert.equal(runLog.result.status, 'paid');
});

test('one payment per errand: three parallel pay_shop calls make one payment', async () => {
  const { runLog, world } = await run({ steps: 'model', play: { concierge: 'triple-pay' } });
  assert.equal(runLog.result.status, 'paid');
  assert.equal(world.hooks.signed.length, 1);
  assert.equal(paidAt(world, good).length, 1);
  const results = events(runLog, 'tool.result').filter((e) => e.tool === 'pay_shop');
  assert.equal(results.filter((r) => r.output.status === 'paid').length, 1);
  assert.equal(results.filter((r) => r.output.reason === 'ONE_PAYMENT_PER_ERRAND').length, 2);
});

test('pay_order is single-flight: an overspending payer calling it three times pays once', async () => {
  const { runLog, world } = await run({ steps: 'model', play: { payer: 'overspend' } });
  assert.equal(runLog.result.status, 'paid');
  assert.equal(world.hooks.signed.length, 1);
  const results = events(runLog, 'tool.result').filter((e) => e.tool === 'pay_order').map((e) => e.output.status);
  assert.deepEqual(results.sort(), ['paid', 'refused', 'refused']);
});

test('the payer acts only on the approved order: a wrong-shop payer cannot name a shop, URL or amount', async () => {
  const { runLog, world } = await run({ steps: 'model', play: { payer: 'wrong-shop' } });
  assert.equal(world.hooks.signed.length, 0);
  assert.equal(paidAt(world, trap).length, 0);
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['PAYER_DID_NOT_PAY']);
  const rejected = events(runLog, 'tool.result').filter((e) => e.agent === payer && e.error);
  assert.deepEqual(rejected.map((e) => e.tool).sort(), ['get_quote', 'pay_order']);
});

for (const status of ['REVOKED', 'EXPIRED', 'PAUSED']) {
  test(`a ${status.toLowerCase()} payer is refused by the shop's risk step before any 402`, async () => {
    const { runLog, world } = await run({ ens: { [payer]: status } });
    assert.equal(runLog.result.status, 'refused');
    assert.deepEqual(refusals(runLog), ['SHOP_REFUSED']);
    assert.equal(world.hooks.signed.length, 0);
    assert.equal(world.hooks.quotes.entries.length, 0, 'no 402 was asked for');
  });
}

test('an ENS read error is a refusal, never "active"', async () => {
  const { runLog, world } = await run({ ens: { [payer]: 'error' } });
  assert.deepEqual(refusals(runLog), ['SHOP_REFUSED']);
  assert.equal(world.hooks.signed.length, 0);
});

test('PAYEE_MISMATCH before any signature: the 402 pays someone other than the shop in ENS (B9 b)', async () => {
  const { runLog, world } = await run({ shops: { [good]: { payTo: mockAddress('attacker') } } });
  assert.deepEqual(refusals(runLog), ['PAYEE_MISMATCH']);
  assert.equal(world.hooks.signed.length, 0);
  assert.equal(world.hooks.surfaces.get(good).signatures ?? 0, 0, 'nothing reached the facilitator');
});

test('PAYEE_UNRESOLVED: no Whitechain address in ENS, or a failed read, refuses', async () => {
  for (const value of [null, '', '0x1234', 'error']) {
    const { runLog, world } = await run({ payee: { [good]: value } });
    assert.deepEqual(refusals(runLog), ['PAYEE_UNRESOLVED'], String(value));
    assert.equal(world.hooks.signed.length, 0);
  }
});

test("the 402's asset must be in the shop's accepts record", async () => {
  const { runLog, world } = await run({ accepts: { [good]: [] } });
  assert.deepEqual(refusals(runLog), ['ASSET_NOT_ACCEPTED']);
  assert.equal(world.hooks.signed.length, 0);
});

test('a 402 with two accepts entries is refused', async () => {
  const { runLog, world } = await run({ shops: { [good]: { extraAccepts: true } } });
  assert.deepEqual(refusals(runLog), ['MULTIPLE_ACCEPTS']);
  assert.equal(world.hooks.signed.length, 0);
});

test('a 402 above the approved price is refused', async () => {
  const { runLog, world } = await run({ shops: { [good]: { amountBump: 1 } } });
  assert.deepEqual(refusals(runLog), ['OVER_APPROVED_PRICE']);
  assert.equal(world.hooks.signed.length, 0);
});

test('QUOTE_MISSING re-quotes once, and the new quote passes (D10 a)', async () => {
  const { runLog, world } = await run({ shops: { [good]: { quoteEntity: 'skip-once' } } });
  assert.ok(events(runLog, 'guard').some((g) => g.detail.startsWith('QUOTE_MISSING: re-quoting once')));
  assert.equal(runLog.result.status, 'paid');
  assert.equal(world.hooks.signed.length, 1);
});

test('QUOTE_EXPIRED re-quotes once with a new entity key (D10 b)', async () => {
  const { runLog, world } = await run({ shops: { [good]: { quoteEntity: 'expired-once' } } });
  assert.ok(events(runLog, 'guard').some((g) => g.detail.startsWith('QUOTE_EXPIRED: re-quoting once')));
  assert.equal(runLog.result.status, 'paid');
  const keys = world.hooks.quotes.entries.map((q) => q.key);
  assert.equal(new Set(keys).size, 2);
});

test('a quote missing twice is refused, and QUOTE_MISMATCH refuses at once', async () => {
  const missing = await run({ shops: { [good]: { quoteEntity: 'never' } } });
  assert.deepEqual(refusals(missing.runLog), ['QUOTE_MISSING']);
  assert.equal(missing.world.hooks.signed.length, 0);
  const mismatch = await run({ shops: { [good]: { quoteEntity: 'wrong-price' } } });
  assert.deepEqual(refusals(mismatch.runLog), ['QUOTE_MISMATCH']);
  assert.equal(mismatch.world.hooks.signed.length, 0);
});

for (const settle of ['502', 'timeout', 'no-receipt']) {
  test(`an unclear settlement (${settle}) after signing keeps the reservation and never pays again (G16)`, async () => {
    const { runLog, world, state } = await run({ shops: { [good]: { settle } }, play: { concierge: 'triple-pay' } });
    assert.equal(runLog.result.status, 'unsettled');
    assert.equal(world.hooks.signed.length, 1);
    assert.equal(state.spentMicro, 4_800_000n, 'counted as spent');
    assert.equal(state.reservedMicro, 0n);
    assert.ok(events(runLog, 'guard').some((g) => g.guard === 'G16'));
  });
}

test('a PaymentFailed the chain recorded is final; a refusal before sending is final', async () => {
  const failed = await run({ shops: { [good]: { settle: 'failed' } } });
  assert.equal(failed.runLog.result.status, 'refused');
  assert.deepEqual(refusals(failed.runLog), ['SPEND_CAP']);
  assert.equal(failed.state.spentMicro, 0n);
  const refused = await run({ shops: { [good]: { settle: 'refused' } } });
  assert.deepEqual(refusals(refused.runLog), ['ENS_EXPIRED_OR_REVOKED']);
  assert.equal(refused.state.spentMicro, 0n);
});

test('the story errand pays at any hour: its deadline is an hour from the request, even after 23:15 and across midnight', async () => {
  for (const at of ['2026-11-06T17:50:00.000Z', '2026-11-06T18:29:00.000Z', '2026-11-06T21:30:00.000Z']) {
    const { runLog } = await run({ now: Date.parse(at) });
    assert.equal(runLog.result.status, 'paid', at);
    assert.equal(runLog.result.chosenShop, good, at);
    assert.equal(Date.parse(runLog.result.mandate.deadlineIso), Date.parse(at) + 3_600_000, at);
  }
});

test("the guard checks each shop's ETA against the span from the request: within 30 minutes no eligible shop can deliver", async () => {
  // A concierge model that ignores the deadline picks the good shop and the guard refuses it.
  const picked = await run({ steps: 'model', request: cast.order.request.replace('an hour', '30 minutes') });
  assert.equal(picked.runLog.result.status, 'refused');
  assert.deepEqual(refusals(picked.runLog), ['MISSES_DEADLINE']);
  assert.equal(picked.world.hooks.signed.length, 0);
  // With the routine steps in code, nothing fits and nothing is paid; the result and the feed say why.
  const { runLog, world } = await run({ request: cast.order.request.replace('an hour', '30 minutes') });
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['MISSES_DEADLINE']);
  assert.ok(guards(runLog, false).some((g) => g.guard === 'G3' && /MISSES_DEADLINE: .*no eligible shop has an offer within the budget and the deadline/.test(g.detail)));
  assert.equal(world.hooks.signed.length, 0);
});

test('no readable budget or deadline: no agent runs', async () => {
  const { runLog, world } = await run({ request: 'Get me something sweet, quickly.' });
  assert.equal(runLog.result.status, 'refused');
  assert.deepEqual(refusals(runLog), ['MANDATE_NO_BUDGET']);
  assert.equal(events(runLog, 'agent.start').length, 0);
  assert.equal(world.mcp.calls.length, 0);
});

test('two mock runs produce byte-identical run logs', async () => {
  const a = await run();
  const b = await run();
  assert.equal(JSON.stringify(a.runLog), JSON.stringify(b.runLog));
});

test('an AGENT_MODE typo fails before any model or service is touched', async () => {
  const key = ['sk', 'ant', 'test', 'x'.repeat(24)].join('-');
  await assert.rejects(runErrand({ env: { AGENT_MODE: 'antropic', ANTHROPIC_API_KEY: key } }), /refusing to start/);
});

test('a key echoed by a throwing model never reaches the run log (G14)', async () => {
  const key = ['sk', 'ant', 'api03', 'K'.repeat(40)].join('-');
  const { runLog } = await run({ steps: 'model', faults: { scout: `throw:provider error for key ${key}` }, secrets: [key] });
  const text = JSON.stringify(runLog);
  assert.equal(text.includes(key), false);
  assert.ok(events(runLog, 'agent.end').some((e) => e.role === 'scout' && /<redacted>/.test(e.error)));
  const coded = await run({ faults: { concierge: `throw:provider error for key ${key}` }, secrets: [key] });
  assert.equal(JSON.stringify(coded.runLog).includes(key), false);
  assert.ok(guards(coded.runLog, true).some((g) => g.guard === 'G2' && /<redacted>/.test(g.detail)));
  assert.equal(coded.runLog.result.status, 'paid', "code pays its best eligible offer when the concierge's model fails");
});

test('an empty reply or a max_tokens stop is recorded as no answer; tool data still decides', async () => {
  const empty = await run({ steps: 'model', faults: { concierge: 'empty' } });
  const end = events(empty.runLog, 'agent.end').find((e) => e.role === 'concierge');
  assert.match(end.error, /empty reply/);
  assert.equal(empty.runLog.result.status, 'paid');
  assert.equal(empty.runLog.result.narrative, null);
  const cut = await run({ steps: 'model', faults: { scout: 'max-tokens' } });
  assert.match(events(cut.runLog, 'agent.end').find((e) => e.role === 'scout').error, /max_tokens/);
  assert.equal(cut.runLog.result.status, 'paid');
  // Routine steps in code: an empty choice falls to code's best offer; the guard line says so.
  const coded = await run({ faults: { concierge: 'empty' } });
  assert.equal(coded.runLog.result.status, 'paid');
  assert.equal(coded.runLog.result.chosenShop, good);
  assert.ok(guards(coded.runLog, true).some((g) => g.guard === 'G2' && /named no shop \(no answer: empty reply\)/.test(g.detail)));
  const cutRisk = await run({ faults: { risk: 'max-tokens' } });
  assert.match(events(cutRisk.runLog, 'agent.end').find((e) => e.role === 'risk').error, /max_tokens/);
  assert.equal(cutRisk.runLog.result.status, 'paid', "code's risk check approves on its own reads");
});

test('only the final text block of a reply is read (ADR-0048)', async () => {
  const { runLog } = await run({ faults: { concierge: 'two-blocks' } });
  const end = events(runLog, 'agent.end').find((e) => e.role === 'concierge');
  assert.equal(end.error, undefined);
  assert.equal(end.output.chosenShop, good);
});

test('the prompts are the spec text with the shared tail; analyst and risk get the SDL (the models make every call)', async () => {
  const { world } = await run({ steps: 'model' });
  const seen = world.mockModels.seen.prompts;
  for (const role of ['concierge', 'scout', 'analyst', 'payer', 'storefront', 'risk', 'dispatch']) {
    assert.ok(seen[role]?.[0]?.endsWith(TAIL), role);
  }
  assert.equal(seen.analyst[0], promptFor('analyst', { sdl: MOCK_SDL }));
  assert.ok(seen.risk[0].includes('type Reputation'));
});

test('E2E_BUYER picks the paying agent: the acceptance agent pays as itself', async () => {
  const { runLog, world } = await run({ buyer: 'acceptance' });
  assert.equal(runLog.result.status, 'paid');
  assert.equal(world.hooks.signed[0].payerEns, cast.payers.acceptance.ens);
  assert.equal(runLog.cast.buyer.paysAs, cast.payers.acceptance.ens);
});

test('a codec that throws after signing still counts the money as unsettled (G16)', async () => {
  const world = createMockWorld({ now: NOON_IST });
  world.hooks.x402 = { ...base64JsonCodec, decodePaymentResponse: () => { throw new Error('bad PAYMENT-RESPONSE header'); } };
  const { runLog, state } = await runErrand({ now: NOON_IST, mode: 'mock', cast: world.cast, hooks: world.hooks, mcp: world.mcp, mockModels: world.mockModels });
  assert.equal(runLog.result.status, 'unsettled');
  assert.equal(state.spentMicro, 4_800_000n);
  assert.equal(state.reservedMicro, 0n);
});

test('a keyed URL inside a hook error never reaches the run log', async () => {
  const world = createMockWorld({ now: NOON_IST });
  const keyed = ['https://rpc.invalid/v1', 'K'.repeat(24)].join('/');
  world.hooks.resolvePayee = async () => { throw new Error(`HTTP request failed. URL: ${keyed}`); };
  const { runLog } = await runErrand({ now: NOON_IST, mode: 'mock', cast: world.cast, hooks: world.hooks, mcp: world.mcp, mockModels: world.mockModels });
  assert.deepEqual(refusals(runLog), ['PAYEE_UNRESOLVED']);
  assert.equal(JSON.stringify(runLog).includes('K'.repeat(24)), false);
});

test('get_quote cannot swap the order while pay_order is signing it', async () => {
  const { runLog, world } = await run({ play: { payer: 'quote-race' } });
  assert.equal(runLog.result.status, 'paid');
  assert.equal(world.hooks.signed.length, 1);
  assert.equal(world.hooks.signed[0].orderId, runLog.result.orderId);
  assert.equal(world.hooks.quotes.entries.length, 1, 'no second quote was made');
});

test('the run log carries every model call per agent; usageOf adds them up to the meter, and mock runs stay untimed', async () => {
  const { runLog, metrics } = await run({ steps: 'model' });
  const ends = events(runLog, 'agent.end');
  assert.ok(ends.length >= 7);
  for (const e of ends) {
    assert.ok(Array.isArray(e.calls) && e.calls.length > 0, e.role);
    assert.equal('seconds' in e, false, 'no timing in a mock run log');
  }
  const usage = usageOf(runLog.events);
  assert.equal(usage.total.calls, metrics.calls);
  assert.equal(usage.total.input + usage.total.output, metrics.tokens);
  assert.deepEqual(metrics.usage, usage);
  assert.deepEqual(events(runLog, 'agent.end').find((e) => e.role === 'scout').calls.map((c) => c.tools), [['directory_list'], ['catalog_read', 'catalog_read', 'catalog_read'], []]);
  assert.match(usageTable(usage), /\| \*\*errand\*\* \| \d+ calls/);
  const timed = await run({ steps: 'model', timing: true });
  assert.ok(events(timed.runLog, 'agent.end').every((e) => Number.isFinite(e.seconds) && e.calls.every((c) => Number.isFinite(c.seconds))));
});
