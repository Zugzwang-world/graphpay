// Guards with hand-made state and no model (planning/PROMPTS/10-agents.md step 2).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  base64JsonCodec,
  checkPaymentRequired,
  createRunState,
  createScrubber,
  header,
  interpretSettlement,
  onStorefront,
  parseMandate,
  payGuard,
  PAYMENT_ASSET,
  PAYMENT_NETWORK,
  rankShops,
  resolveAgentMode,
  talliesFromNodes,
  teamCast,
  volumeReference,
} from '../index.mjs';
import { MOCK_CONTRACT, mockAddress, mockGraphRows, mockNode } from '../mocks/index.mjs';

const cast = teamCast();
const good = cast.shopByRole('good');
const trap = cast.shopByRole('trap');
const NOON_IST = Date.parse('2026-11-06T06:30:00.000Z');
const { mandate } = parseMandate(cast.order.request, { now: NOON_IST, timeZone: cast.city.timeZone, currency: cast.city.currency, buyer: cast.persona.ens });

function readyState() {
  const state = createRunState({ mandate, codeNeed: null, requestId: '0x01' });
  state.need = { item: cast.food.item, quantity: cast.food.quantity };
  const nodes = mockGraphRows(cast)
    .filter((r) => r.kind === 'shop')
    .map((r) => ({ ...r, reputation: r.d90 }));
  state.ranking = rankShops(talliesFromNodes(nodes), volumeReference(cast));
  for (const shop of cast.shops) {
    state.offers.set(shop.ens, { shop: shop.ens, sku: 'x', item: cast.food.item, quantity: cast.food.quantity, priceUsdt: (shop.scenario.priceFor12Micro / 1e6).toFixed(2), etaMinutes: shop.scenario.etaMinutes, distanceKm: 1 });
  }
  state.scoutDone = true;
  state.analystDone = true;
  return state;
}

test('pay_shop waits until the scout and the analyst have both reported (G12)', () => {
  const state = readyState();
  state.analystDone = false;
  assert.equal(payGuard(state, good.ens, NOON_IST).reason, 'PHASE_NOT_READY');
  state.analystDone = true;
  state.scoutDone = false;
  assert.equal(payGuard(state, good.ens, NOON_IST).reason, 'PHASE_NOT_READY');
});

test('the trap is never paid: the guard refuses a shop code ranked ineligible (G2)', () => {
  const state = readyState();
  const out = payGuard(state, trap.ens, NOON_IST);
  assert.equal(out.reason, 'SHOP_NOT_ELIGIBLE');
  assert.equal(state.paying, null);
  assert.equal(payGuard(state, `unknown.${cast.root}`, NOON_IST).reason, 'SHOP_NOT_ELIGIBLE');
});

test('budget and deadline are checked against the mandate; NaN refuses (G3)', () => {
  let state = readyState();
  state.offers.set(good.ens, { ...state.offers.get(good.ens), priceUsdt: '6.000001' });
  assert.equal(payGuard(state, good.ens, NOON_IST).reason, 'OVER_BUDGET');
  state = readyState();
  assert.equal(payGuard(state, good.ens, Date.parse(mandate.deadlineIso) - 10 * 60_000).reason, 'MISSES_DEADLINE');
  state = readyState();
  state.offers.set(good.ens, { ...state.offers.get(good.ens), etaMinutes: Number.NaN });
  assert.equal(payGuard(state, good.ens, NOON_IST).reason, 'MISSES_DEADLINE');
});

test('one payment per errand: the reservation is taken synchronously, so three calls give one pass (G10)', () => {
  const state = readyState();
  const results = [payGuard(state, good.ens, NOON_IST), payGuard(state, good.ens, NOON_IST), payGuard(state, good.ens, NOON_IST)];
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, false, false],
  );
  assert.equal(results[1].reason, 'ONE_PAYMENT_PER_ERRAND');
});

// A 402 that passes every synchronous check, and the context it is checked in.
function fixture() {
  const storefront = 'https://agents.mock.invalid/shops/good';
  const orderId = `0x${'ab'.repeat(32)}`;
  const payUrl = `${storefront}/orders/${orderId}/pay`;
  const payer = cast.payers.payer.ens;
  const merchant = mockAddress(good.ens);
  const req = {
    scheme: 'graphpay-order',
    network: PAYMENT_NETWORK,
    asset: PAYMENT_ASSET,
    amount: '4800000',
    payTo: merchant,
    maxTimeoutSeconds: 600,
    extra: {
      contract: MOCK_CONTRACT,
      shopName: good.ens,
      order: { orderId, parentOrderId: `0x${'0'.repeat(64)}`, buyerNode: mockNode(cast.persona.ens), shopNode: mockNode(good.ens), payerNode: mockNode(payer), merchant, amountMicro: '4800000', kind: '0' },
    },
  };
  const pr = { x402Version: 2, resource: { url: payUrl }, accepts: [req] };
  const ctx = {
    approved: { shopEns: good.ens, storefront, maxPriceMicro: 4_800_000n },
    pending: { orderId, payUrl, priceMicro: 4_800_000n },
    nodes: { shop: mockNode(good.ens), payer: mockNode(payer), buyer: mockNode(cast.persona.ens) },
    network: PAYMENT_NETWORK,
    asset: PAYMENT_ASSET,
    contracts: new Set([MOCK_CONTRACT]),
    budgetLeftMicro: 6_000_000n,
  };
  return { pr, req, ctx };
}

const mutate = (pr, f) => {
  const copy = structuredClone(pr);
  f(copy, copy.accepts[0]);
  return copy;
};

test('client spend controls check every field of the 402 before any signature (G5)', () => {
  const { pr, ctx } = fixture();
  assert.equal(checkPaymentRequired(pr, ctx).ok, true);
  const cases = [
    ['MULTIPLE_ACCEPTS', (p, r) => p.accepts.push({ ...r })],
    ['BAD_402', (p) => (p.x402Version = 1)],
    ['RESOURCE_MISMATCH', (p) => (p.resource.url = 'https://evil.invalid/pay')],
    ['SCHEME_NOT_ALLOWED', (p, r) => (r.scheme = 'exact')],
    ['NETWORK_NOT_ALLOWED', (p, r) => (r.network = 'eip155:1')],
    ['ASSET_NOT_ALLOWED', (p, r) => (r.asset = mockAddress('another token'))],
    ['OVER_APPROVED_PRICE', (p, r) => (r.amount = r.extra.order.amountMicro = '4800001')],
    ['UNKNOWN_CONTRACT', (p, r) => (r.extra.contract = mockAddress('another contract'))],
    ['SHOP_MISMATCH', (p, r) => (r.extra.shopName = trap.ens)],
    ['ORDER_MISMATCH', (p, r) => (r.extra.order.orderId = `0x${'cd'.repeat(32)}`)],
    ['ORDER_MISMATCH', (p, r) => (r.extra.order.merchant = mockAddress('someone'))],
    ['ORDER_MISMATCH', (p, r) => (r.extra.order.shopNode = mockNode(trap.ens))],
    ['ORDER_MISMATCH', (p, r) => (r.extra.order.kind = '1')],
  ];
  for (const [reason, f] of cases) assert.equal(checkPaymentRequired(mutate(pr, f), ctx).reason, reason, reason);
  assert.equal(checkPaymentRequired(pr, { ...ctx, budgetLeftMicro: 4_799_999n }).reason, 'OVER_BUDGET');
  assert.equal(checkPaymentRequired(pr, { ...ctx, pending: { ...ctx.pending, priceMicro: 4_700_000n } }).reason, 'AMOUNT_MISMATCH');
  assert.equal(checkPaymentRequired(pr, { ...ctx, contracts: new Set() }).reason, 'UNKNOWN_CONTRACT');
});

test('the pay URL must be on the approved storefront (same origin, at or below its path, https)', () => {
  const s = 'https://agents.mock.invalid/shops/good';
  assert.equal(onStorefront(`${s}/orders/1/pay`, s), true);
  assert.equal(onStorefront('https://agents.mock.invalid/shops/goodie/orders/1/pay', s), false);
  assert.equal(onStorefront('https://agents.mock.invalid.evil.invalid/shops/good/x', s), false);
  assert.equal(onStorefront('https://user:pw@agents.mock.invalid/shops/good/x', s), false);
  assert.equal(onStorefront('http://agents.mock.invalid/shops/good/x', 'http://agents.mock.invalid/shops/good'), false);
});

test('an unclear settlement is not a failure: only three answers after a signature are final (G16)', () => {
  const enc = (v) => base64JsonCodec.encode(v);
  const tx = `0x${'12'.repeat(32)}`;
  const kind = (res) => interpretSettlement(res, base64JsonCodec).kind;
  assert.equal(kind({ status: 200, headers: { 'payment-response': enc({ success: true, transaction: tx }) } }), 'paid');
  assert.equal(kind({ status: 200, headers: {}, body: { status: 'paid' } }), 'unsettled');
  assert.equal(kind({ status: 502, headers: {} }), 'unsettled');
  assert.equal(kind({ status: 504, headers: {} }), 'unsettled');
  assert.equal(kind(null), 'unsettled');
  assert.equal(kind({ status: 402, headers: { 'Payment-Response': enc({ success: false, errorReason: 'SPEND_CAP', transaction: tx }) } }), 'failed');
  assert.equal(kind({ status: 402, headers: { 'PAYMENT-RESPONSE': enc({ success: false, errorReason: 'ENS_EXPIRED_OR_REVOKED' }) } }), 'refused');
  assert.equal(kind({ status: 400, headers: {}, body: { reason: 'BAD_REQUEST' } }), 'refused');
});

test('headers are looked up without regard to case (pitfall 6)', () => {
  assert.equal(header({ 'PAYMENT-REQUIRED': 'a' }, 'payment-required'), 'a');
  assert.equal(header({ 'payment-required': 'b' }, 'PAYMENT-REQUIRED'), 'b');
  assert.equal(header(new Headers({ 'Payment-Required': 'c' }), 'payment-required'), 'c');
  assert.equal(header(undefined, 'x'), undefined);
});

test('no secret in the log: the scrubber removes configured values and key shapes (G14)', () => {
  // Key-shaped values are built at run time, so the secret scan never sees a literal.
  const configured = ['sk', 'ant', 'api03', 'Q'.repeat(40)].join('-');
  const xai = ['xai', 'Z'.repeat(30)].join('-');
  const scrub = createScrubber([configured, 'a-long-config-secret-value']);
  const text = `provider said: bad key ${configured}; also ${xai}; x-api-key: ${'k'.repeat(24)}; a-long-config-secret-value`;
  const out = scrub(text);
  for (const leak of [configured, xai, 'k'.repeat(24), 'a-long-config-secret-value']) assert.equal(out.includes(leak), false, leak);
  assert.match(out, /<redacted>/);
});

test('an AGENT_MODE typo never starts a paid run', () => {
  assert.equal(resolveAgentMode({}), 'mock');
  assert.equal(resolveAgentMode({ AGENT_MODE: 'mock' }), 'mock');
  assert.equal(resolveAgentMode({ AGENT_MODE: 'auto' }), 'mock');
  assert.equal(resolveAgentMode({ AGENT_MODE: 'auto', ANTHROPIC_API_KEY: 'x' }), 'mock', 'the active preset is Kimi: an Anthropic key alone starts nothing');
  assert.equal(resolveAgentMode({ AGENT_MODE: 'auto', KIMI_API_KEY: 'x' }), 'live');
  assert.equal(resolveAgentMode({ AGENT_MODE: 'auto', AGENT_PRESET: 'anthropic-testing', ANTHROPIC_API_KEY: 'x' }), 'live');
  assert.equal(resolveAgentMode({ AGENT_MODE: 'live' }), 'live');
  assert.equal(resolveAgentMode({ AGENT_MODE: 'anthropic' }), 'live', 'the old name of live');
  for (const typo of ['antropic', 'Anthropic', 'lve', 'Live', 'mock ', 'ANTHROPIC']) assert.throws(() => resolveAgentMode({ AGENT_MODE: typo }), /refusing to start/, typo);
});
