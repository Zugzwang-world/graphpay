import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentStatusOf, newestPayment, orderStatusOf, orderSummary, policyOf, type OrderEdge, type Policy } from './customer-state.ts';
import { readCustomerState, type Sources } from './customer-state.server.ts';
import { siteModel } from './site.server.ts';

const NOW = 1_800_000_000;
const policy = (over: Partial<Policy> = {}): Policy => ({ epoch: 2, wallet: `0x${'11'.repeat(20)}`, revoked: false, dailyCapMicro: 6_000_000n, expiry: BigInt(NOW + 86_400), ...over });
const tx = `0x${'ab'.repeat(32)}`;
const pay = (ts: number, orderId: string | null, extra: Partial<OrderEdge> = {}): OrderEdge => ({ kind: 'pay', amountMicro: '4800000', ts: String(ts), ref: `1874:${tx}:0`, orderId, to: { ens: 'shop.sim.example.eth' }, ...extra });

test('a stopped agent never reads Active: revoked, expired and paused each win, and an unreadable name is Unknown', () => {
  assert.equal(agentStatusOf('ACTIVE', policy(), NOW), 'ACTIVE');
  assert.equal(agentStatusOf('ACTIVE', policy({ revoked: true }), NOW), 'REVOKED');
  assert.equal(agentStatusOf('REVOKED', policy(), NOW), 'REVOKED');
  assert.equal(agentStatusOf('ACTIVE', policy({ expiry: BigInt(NOW - 1) }), NOW), 'EXPIRED');
  assert.equal(agentStatusOf('EXPIRED', policy(), NOW), 'EXPIRED');
  assert.equal(agentStatusOf('PAUSED', policy(), NOW), 'PAUSED');
  assert.equal(agentStatusOf('PAUSED', policy({ revoked: true }), NOW), 'REVOKED');
  assert.equal(agentStatusOf('UNKNOWN', policy(), NOW), 'UNKNOWN');
  assert.equal(agentStatusOf('ACTIVE', null, NOW), 'UNKNOWN', 'no policy is not an active agent');
  assert.equal(agentStatusOf('ACTIVE', policy({ expiry: 0n }), NOW), 'ACTIVE', 'expiry 0 is no expiry');
});

test('the contract holds no policy when every field is zero', () => {
  assert.equal(policyOf({ epoch: 0, wallet: `0x${'00'.repeat(20)}`, revoked: false, dailyCapMicro: 0n, expiry: 0n }), null);
  assert.equal(policyOf({ epoch: 1, wallet: `0x${'11'.repeat(20)}`, revoked: false, dailyCapMicro: 5n, expiry: 0n })?.epoch, 1);
});

test('the last order is the newest payment that carries an order id; its status follows its refunds and delivery', () => {
  const newest = newestPayment([pay(100, '0xold'), pay(300, '0xnew'), pay(400, null), { ...pay(500, '0xrefund'), kind: 'refund' }]);
  assert.equal(newest?.orderId, '0xnew');
  assert.equal(newestPayment([]), null);
  const p = pay(1, '0xo');
  assert.equal(orderStatusOf(p, []), 'PAID');
  assert.equal(orderStatusOf(p, [{ kind: 'deliver', amountMicro: '0' }]), 'DELIVERED');
  assert.equal(orderStatusOf(p, [{ kind: 'refund', amountMicro: '800000' }]), 'PARTIALLY_REFUNDED');
  assert.equal(orderStatusOf(p, [{ kind: 'refund', amountMicro: '800000' }, { kind: 'refund', amountMicro: '4000000' }]), 'REFUNDED');
  assert.equal(orderSummary(p, [])?.transaction, tx);
  assert.equal(orderSummary(p, [])?.item, null, 'what was bought is not on the edge, so it is not invented');
  assert.equal(orderSummary(pay(1, '0xo', { ref: 'hist:1' }), []), null, 'no settlement transaction, no summary');
});

const sources = (over: Partial<Sources> = {}): Sources => ({
  ensStatus: async () => 'ACTIVE',
  policy: async () => policy(),
  spentToday: async () => 1_500_000n,
  payments: async () => [pay(NOW - 60, '0xorder')],
  trail: async () => [{ kind: 'pay', amountMicro: '4800000', ts: String(NOW - 60), ref: `1874:${tx}:0`, orderId: '0xorder' }],
  subscription: async () => null,
  ...over,
});

test('the state of the story payer agent: cap and spend from the contract, status from ENS and the policy, last order from the graph', async () => {
  const state = await readCustomerState(sources(), NOW);
  assert.equal(state.agent.ens, siteModel().payer.ens);
  assert.deepEqual({ status: state.agent.status, epoch: state.agent.epoch }, { status: 'ACTIVE', epoch: 2 });
  assert.equal(state.capMicro, '6000000');
  assert.equal(state.spentTodayMicro, '1500000');
  assert.equal(state.policyExpiresAt, new Date((NOW + 86_400) * 1000).toISOString());
  assert.equal(state.lastOrder?.status, 'PAID');
  assert.equal(state.subscription, null);
});

test('the last order is read from today first, and from the last 30 days only when today has none', async () => {
  const today = Math.floor(NOW / 86_400);
  const asked: number[] = [];
  const byDay = (days: Record<number, OrderEdge[]>): Sources['payments'] => async (_, sinceDay) => (asked.push(sinceDay), days[sinceDay] ?? []);
  const old = [pay(NOW - 3 * 86_400, '0xold')];
  const fresh = await readCustomerState(sources({ payments: byDay({ [today]: [pay(NOW - 60, '0xtoday')], [today - 30]: old }), trail: async () => [] }), NOW);
  assert.equal(fresh.lastOrder?.orderId, '0xtoday');
  assert.deepEqual(asked, [today], 'a payment today needs no 30-day read');
  asked.length = 0;
  const quiet = await readCustomerState(sources({ payments: byDay({ [today - 30]: old }), trail: async () => [] }), NOW);
  assert.equal(quiet.lastOrder?.orderId, '0xold');
  assert.deepEqual(asked, [today, today - 30]);
});

test('a paused name is Paused on the phone; no payments is no last order', async () => {
  const state = await readCustomerState(sources({ ensStatus: async () => 'PAUSED', payments: async () => [] }), NOW);
  assert.equal(state.agent.status, 'PAUSED');
  assert.equal(state.lastOrder, null);
});

test('one source failing fails the whole answer (no half-known agent is shown as active)', async () => {
  await assert.rejects(readCustomerState(sources({ policy: async () => Promise.reject(new Error('rpc down')) }), NOW), /rpc down/);
});

test('the subscription comes from its own source, and an unreadable one is no subscription, never a failed state', async () => {
  const summary = { subId: `0x${'cd'.repeat(32)}`, plan: 'p', period: 'demo', priceMicro: '2400000', nextChargeAt: null, renewals: [], active: false, status: 'CANCELLED' as const, cycle: 1, periodSeconds: 120, chargesLeft: 0, item: 'box', shopEns: 'shop.example.eth' };
  assert.deepEqual((await readCustomerState(sources({ subscription: async () => summary }), NOW)).subscription, summary);
  const state = await readCustomerState(sources({ subscription: async () => Promise.reject(new Error('rpc down')) }), NOW);
  assert.equal(state.subscription, null);
  assert.equal(state.agent.status, 'ACTIVE');
});

test('the checkout address is read from the deployment record (whitechain.contracts.checkout.address)', async () => {
  const { checkoutAddress } = await import('./site.server.ts');
  const { config } = await import('@graphpay/config');
  assert.equal(checkoutAddress(), config.whitechain.contracts.checkout.address);
  assert.match(checkoutAddress() ?? '', /^0x[0-9a-fA-F]{40}$/);
  assert.equal(checkoutAddress({}), null);
  assert.equal(checkoutAddress({ checkout: { address: 'nope' } }), null);
});
