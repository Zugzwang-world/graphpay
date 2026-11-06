import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { ContractFunctionRevertedError, encodeErrorResult, namehash } from 'viem';
import { checkoutAbi } from '@graphpay/contracts';
import { siteModel } from './site.server.ts';
import { allowanceCovers } from './renew.server.ts';
import { revertOf } from './subscription-live.server.ts';
import { SUBSCRIBE_COOLDOWN_MS, SubscriptionRefusal, cancelSubscription, forgetSubscriptions, ofPlan, planOf, subscribe, summaryOf, type Created, type SubState, type SubscriptionDeps } from './subscription.server.ts';

const T0 = 1_800_000_000_000;
const SUB = `0x${'5a'.repeat(32)}`;
const OTHER = `0x${'6b'.repeat(32)}`;
const tx = `0x${'ab'.repeat(32)}`;

function sub(over: Partial<SubState> = {}): SubState {
  const plan = planOf();
  return { subId: SUB, subscriberNode: plan.subscriberNode, shopNode: plan.shopNode, payerNode: plan.payerNode, subscriber: `0x${'11'.repeat(20)}`, merchant: `0x${'22'.repeat(20)}`, amountMicro: plan.priceMicro, period: plan.periodSeconds, nextChargeAt: 1_800_000_120n, cycle: 1, retryAt: 0n, failures: 0, status: 'ACTIVE', ...over };
}

function deps(over: { status?: string; subs?: SubState[]; at?: number; create?: Created | Error; cancel?: Error } = {}) {
  const created: unknown[] = [];
  const cancelled: SubState[] = [];
  const d: SubscriptionDeps = {
    payerStatus: async () => over.status ?? 'ACTIVE',
    latest: async () => over.subs ?? [],
    create: async (plan) => {
      created.push(plan);
      if (over.create instanceof Error) throw over.create;
      return over.create ?? { subId: SUB, transaction: tx, status: 'confirmed', firstChargeAt: 1_800_000_000, nextChargeAt: 1_800_000_120, charged: true, firstOrderId: `0x${'80'.repeat(32)}`, failReason: null, allowanceMicro: String(plan.priceMicro * BigInt(plan.maxCharges)) };
    },
    cancel: async (s) => {
      cancelled.push(s);
      if (over.cancel) throw over.cancel;
      return { subId: s.subId, transaction: tx, status: 'confirmed', effectiveAt: 1_800_000_200 };
    },
    now: () => over.at ?? T0,
  };
  return { d, created, cancelled };
}
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof SubscriptionRefusal ? e.code : `error:${String(e)}`));

beforeEach(() => forgetSubscriptions());

test('the plan is the story\'s: the persona subscribes, the payer agent pays, the renewal shop, price, demo clock and charge bound', () => {
  const m = siteModel();
  const plan = planOf();
  assert.equal(plan.plan, m.renewal.plan);
  assert.equal(plan.priceMicro, BigInt(m.renewal.priceMicro));
  assert.equal(plan.periodSeconds, m.renewal.demoPeriod.seconds);
  assert.equal(plan.periodLabel, m.renewal.demoPeriod.label);
  assert.equal(plan.maxCharges, m.renewal.demoPeriod.maxCharges);
  assert.equal(plan.subscriberNode, namehash(m.persona.ens).toLowerCase(), 'a cancel lands on the persona, never on the paying agent');
  assert.equal(plan.payerNode, namehash(m.payer.ens).toLowerCase());
  assert.equal(plan.shopNode, namehash(m.renewal.shopEns).toLowerCase());
});

test('subscribe creates one subscription with the story\'s terms and answers what the chain will charge', async () => {
  const { d, created } = deps();
  const out = await subscribe({}, d);
  assert.equal(created.length, 1);
  assert.equal(out.status, 'active');
  assert.equal(out.subId, SUB);
  assert.equal(out.transaction, tx);
  assert.equal(out.priceMicro, siteModel().renewal.priceMicro);
  assert.equal(out.period, siteModel().renewal.demoPeriod.label);
  assert.equal(out.allowanceMicro, String(planOf().priceMicro * BigInt(planOf().maxCharges)));
  assert.equal(out.nextChargeAt, new Date(1_800_000_120_000).toISOString());
  assert.deepEqual(out.firstCharge, { orderId: `0x${'80'.repeat(32)}`, charged: true, failReason: null });
});

test('a receipt that does not come in time is pending, never a failure', async () => {
  const { d } = deps({ create: { subId: SUB, transaction: tx, status: 'pending', firstChargeAt: 1_800_000_000, nextChargeAt: 1_800_000_120, charged: null, firstOrderId: null, failReason: null, allowanceMicro: '7200000' } });
  assert.equal((await subscribe({}, d)).status, 'pending');
});

test('one live subscription to the plan at a time; a paused payer and another plan are refused before anything is signed', async () => {
  const active = deps({ subs: [sub()] });
  await assert.rejects(subscribe({}, active.d), (e: unknown) => e instanceof SubscriptionRefusal && e.code === 'ALREADY_SUBSCRIBED' && e.extra.subId === SUB);
  assert.equal(active.created.length, 0);
  const paused = deps({ status: 'PAUSED' });
  assert.equal(await code(subscribe({}, paused.d)), 'PAYER_NOT_ACTIVE');
  assert.equal(paused.created.length, 0);
  assert.equal(await code(subscribe({ plan: 'another-plan' }, deps().d)), 'NOT_THIS_PLAN');
  // A cancelled one, or another payer's, does not block a new one.
  const fresh = deps({ subs: [sub({ status: 'CANCELLED' }), sub({ subId: OTHER, payerNode: namehash('someone.eth') })] });
  assert.equal(await code(subscribe({}, fresh.d)), 'ok');
});

test('a second subscribe waits out the cooldown; a refusal before signing frees it, any other failure keeps it', async () => {
  assert.equal(await code(subscribe({}, deps().d)), 'ok');
  assert.equal(await code(subscribe({}, deps({ at: T0 + 1000 }).d)), 'TOO_SOON');
  assert.equal(await code(subscribe({}, deps({ at: T0 + SUBSCRIBE_COOLDOWN_MS }).d)), 'ok');
  forgetSubscriptions();
  assert.equal(await code(subscribe({}, deps({ create: new SubscriptionRefusal('OVER_PASS') }).d)), 'OVER_PASS');
  assert.equal(await code(subscribe({}, deps().d)), 'ok');
  forgetSubscriptions();
  assert.equal(await code(subscribe({}, deps({ create: new Error('socket closed') }).d)), 'error:Error: socket closed');
  assert.equal(await code(subscribe({}, deps({ at: T0 + 1000 }).d)), 'TOO_SOON');
});

test('only the payer\'s own subscriptions to the plan count: another subscriber, payer or shop is not one', () => {
  const plan = planOf();
  const mine = sub();
  const subs = [sub({ subId: OTHER, subscriberNode: namehash('x.eth') }), sub({ subId: OTHER, shopNode: namehash('y.eth') }), sub({ subId: OTHER, payerNode: namehash('z.eth') }), mine];
  assert.deepEqual(ofPlan(subs, plan), [mine]);
});

test('cancel signs for the payer\'s active subscription; the page can name only its own', async () => {
  const live = deps({ subs: [sub()] });
  const out = await cancelSubscription({}, live.d);
  assert.deepEqual([out.status, out.subId, out.transaction], ['cancelled', SUB, tx]);
  assert.equal(live.cancelled.length, 1);
  assert.equal(await code(cancelSubscription({ subId: OTHER }, deps({ subs: [sub()] }).d)), 'NOT_THIS_SUBSCRIPTION');
  assert.equal(await code(cancelSubscription({}, deps({ subs: [] }).d)), 'NO_SUBSCRIPTION');
  const done = deps({ subs: [sub({ status: 'CANCELLED' })] });
  assert.equal(await code(cancelSubscription({ subId: SUB }, done.d)), 'NOT_ACTIVE');
  assert.equal(done.cancelled.length, 0);
});

test('the phone\'s line: charges newest first, the next charge only while active and covered, charges left from the allowance', () => {
  const plan = planOf();
  const charges = [{ at: 1_800_000_000, transaction: `0x${'01'.repeat(32)}` }, { at: 1_800_000_130, transaction: `0x${'02'.repeat(32)}` }];
  const full = { amount: plan.priceMicro * 2n, expiration: 1_800_001_000 };
  const s = summaryOf(sub({ cycle: 2, nextChargeAt: 1_800_000_240n }), plan, charges, full, 1_800_000_150);
  assert.deepEqual(s.renewals.map((r) => r.transaction), [`0x${'02'.repeat(32)}`, `0x${'01'.repeat(32)}`]);
  assert.equal(s.chargesLeft, 2);
  assert.equal(s.nextChargeAt, new Date(1_800_000_240_000).toISOString());
  assert.equal(s.active, true);
  assert.equal(summaryOf(sub(), plan, [], { amount: plan.priceMicro, expiration: 1_800_000_100 }, 1_800_000_150).chargesLeft, 0, 'an expired allowance covers nothing');
  assert.equal(summaryOf(sub(), plan, [], { amount: plan.priceMicro - 1n, expiration: 1_800_001_000 }, 1_800_000_150).nextChargeAt, null, 'a spent allowance has no next charge');
  const cancelled = summaryOf(sub({ status: 'CANCELLED' }), plan, charges, full, 1_800_000_150);
  assert.deepEqual([cancelled.active, cancelled.status, cancelled.nextChargeAt, cancelled.chargesLeft], [false, 'CANCELLED', null, 0]);
  assert.equal(summaryOf(sub({ retryAt: 1_800_090_000n }), plan, [], full, 1_800_000_150).nextChargeAt, new Date(1_800_090_000_000).toISOString(), 'after a failed charge, the retry time');
});

test('the cron renews only what the signed allowance still covers', () => {
  assert.equal(allowanceCovers({ amount: 2_400_000n, expiration: 200 }, 2_400_000n, 100n), true);
  assert.equal(allowanceCovers({ amount: 2_399_999n, expiration: 200 }, 2_400_000n, 100n), false);
  assert.equal(allowanceCovers({ amount: 9_000_000n, expiration: 100 }, 2_400_000n, 100n), false);
});

test('a checkout revert is named by its error and field, never by a message', () => {
  const data = encodeErrorResult({ abi: checkoutAbi, errorName: 'BadInput', args: ['payer node'] });
  assert.equal(revertOf(new ContractFunctionRevertedError({ abi: checkoutAbi as never, data, functionName: 'createSubscription' })), 'BadInput: payer node');
  const plain = encodeErrorResult({ abi: checkoutAbi, errorName: 'BadState' });
  assert.equal(revertOf(new ContractFunctionRevertedError({ abi: checkoutAbi as never, data: plain, functionName: 'cancelWithSig' })), 'BadState');
  assert.equal(revertOf(new Error('https://secret.example/key')), null);
});
