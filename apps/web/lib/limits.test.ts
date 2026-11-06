import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { ContractFunctionRevertedError, encodeErrorResult } from 'viem';
import { permissionedResolverAbi } from '@graphpay/ens';
import { siteModel } from './site.server.ts';
import { revertName } from './limits-live.server.ts';
import { EXPECTED_REVERT, LIMIT_COOLDOWN_MS, LimitRefusal, forgetLimits, overPass, overPassPlan, raiseOwnCap, type AttemptOutcome, type OverPassDeps, type Pass, type RaiseCapDeps } from './limits.server.ts';

const T0 = 1_800_000_000_000;
const ORDER = `0x${'0a'.repeat(32)}`;
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof LimitRefusal ? e.code : `error:${String(e)}`));

function passDeps(over: { pass?: Partial<Pass>; outcome?: AttemptOutcome; price?: string; quantity?: number; item?: string; at?: number } = {}) {
  const plan = overPassPlan();
  const attempts: unknown[] = [];
  const d: OverPassDeps = {
    pass: async () => ({ policyCapMicro: 300_000_000n, ensCapMicro: 300_000_000n, spentMicro: 82_800_000n, ...over.pass }),
    quote: async () => ({ orderId: ORDER, priceMicro: over.price ?? String(plan.priceMicro), quantity: over.quantity ?? plan.quantity, item: over.item ?? plan.sku }),
    attempt: async (q) => {
      attempts.push(q);
      return over.outcome ?? { status: 'refused', reason: 'CAP_EXCEEDED' };
    },
    record: async () => ({ ref: `att:${ORDER}:0xpayer:12345678`, entityKey: `0x${'ee'.repeat(32)}` }),
    now: () => over.at ?? T0,
  };
  return { d, attempts };
}

beforeEach(() => forgetLimits());

test('the "everyone" order is the story\'s quantity of the order\'s own item, priced from the catalog', () => {
  const m = siteModel();
  const plan = overPassPlan();
  const product = m.merchant.products.find((p) => p.sku === m.order.sku)!;
  assert.equal(plan.quantity, m.order.overPass.quantity);
  assert.equal(plan.request, m.order.overPass.request);
  assert.equal(plan.priceMicro, (BigInt(product.priceMicro) * BigInt(plan.quantity)) / BigInt(product.quantity));
});

test('over the pass: the facilitator\'s verify refuses the attempt, nothing is ever sent, and its Arkiv record is returned', async () => {
  const { d, attempts } = passDeps();
  const out = await overPass(d);
  assert.equal(attempts.length, 1);
  assert.deepEqual([out.refused, out.reason, out.sent], [true, 'CAP_EXCEEDED', false]);
  assert.equal(out.passMicro, '300000000');
  assert.equal(out.leftMicro, String(300_000_000n - 82_800_000n));
  assert.equal(out.arkiv?.ref.startsWith('att:'), true);
});

test('only an attempt above the whole pass is signed (the lower of the ENS cap and the policy cap)', async () => {
  const plan = overPassPlan();
  // Above what is left but not above the pass itself: never signed.
  const fitsPass = passDeps({ pass: { policyCapMicro: plan.priceMicro, ensCapMicro: plan.priceMicro, spentMicro: plan.priceMicro } });
  assert.equal(await code(overPass(fitsPass.d)), 'NOT_OVER_PASS');
  assert.equal(fitsPass.attempts.length, 0);
  // The policy would allow it, the owner's ENS cap does not: it is over the pass.
  forgetLimits();
  const ensLower = passDeps({ pass: { policyCapMicro: plan.priceMicro * 10n, ensCapMicro: 100_000_000n, spentMicro: 0n } });
  const out = await overPass(ensLower.d);
  assert.equal(out.passMicro, '100000000');
  assert.equal(ensLower.attempts.length, 1);
});

test('a quote that is not the story\'s order is never signed', async () => {
  for (const over of [{ price: '1' }, { quantity: 1 }, { item: 'other-sku' }]) {
    forgetLimits();
    const { d, attempts } = passDeps(over);
    assert.equal(await code(overPass(d)), 'QUOTE_CHANGED');
    assert.equal(attempts.length, 0);
  }
});

test('a verify that would accept it is reported as not refused, and still sends nothing; no answer is an error', async () => {
  const valid = await overPass(passDeps({ outcome: { status: 'valid' } }).d);
  assert.deepEqual([valid.refused, valid.sent, valid.arkiv], [false, false, null]);
  forgetLimits();
  assert.match(await code(overPass(passDeps({ outcome: { status: 'unknown' } }).d)), /^error:/);
});

test('a second tap within the minute gets the last answer (one attempt, one record); after it, a new attempt', async () => {
  const first = passDeps();
  await overPass(first.d);
  const again = passDeps({ at: T0 + 1000 });
  const repeat = await overPass(again.d);
  assert.deepEqual([repeat.repeated, repeat.orderId, again.attempts.length], [true, ORDER, 0]);
  const later = passDeps({ at: T0 + LIMIT_COOLDOWN_MS });
  assert.equal((await overPass(later.d)).repeated, undefined);
  assert.equal(later.attempts.length, 1);
  // A failure is never kept: the next tap tries again.
  forgetLimits();
  assert.equal(await code(overPass(passDeps({ price: '1' }).d)), 'QUOTE_CHANGED');
  assert.equal(await code(overPass(passDeps().d)), 'ok');
});

function capDeps(over: { current?: bigint; revert?: string | null; at?: number } = {}) {
  const records: Parameters<RaiseCapDeps['record']>[0][] = [];
  const simulated: bigint[] = [];
  const d: RaiseCapDeps = {
    ensCap: async () => over.current ?? 300_000_000n,
    simulate: async (cap) => {
      simulated.push(cap);
      const at = { resolver: `0x${'33'.repeat(20)}`, block: '12078219' };
      return over.revert === null ? { reverted: false, ...at } : { reverted: true, revert: over.revert ?? EXPECTED_REVERT, ...at };
    },
    record: async (entry) => {
      records.push(entry);
      return { entityKey: '0xkey', txHash: '0xtx' };
    },
    now: () => over.at ?? T0,
  };
  return { d, records, simulated };
}

test('the agent\'s own cap raise is refused by the resolver, sent nowhere, and recorded with its revert reason and block', async () => {
  const { d, records, simulated } = capDeps();
  const out = await raiseOwnCap({ capMicro: '999000000' }, d, 'graphpay.cap_micro');
  assert.deepEqual([out.refused, out.sent, out.simulated, out.revert, out.attemptedMicro, out.currentMicro, out.block], [true, false, true, EXPECTED_REVERT, '999000000', '300000000', '12078219']);
  assert.deepEqual(simulated, [999_000_000n]);
  assert.equal(records.length, 1);
  assert.equal(out.agent, siteModel().payer.ens);
  assert.equal(out.owner, siteModel().persona.ens);
});

test('without a figure the agent asks for double its cap; a figure that is not a raise is refused before the simulation', async () => {
  const doubled = capDeps({ current: 100_000_000n });
  assert.equal((await raiseOwnCap({}, doubled.d, 'k')).attemptedMicro, '200000000');
  forgetLimits();
  const lower = capDeps();
  assert.equal(await code(raiseOwnCap({ capMicro: '1000000' }, lower.d, 'k')), 'NOT_A_RAISE');
  assert.equal(lower.simulated.length, 0);
  assert.equal(await code(raiseOwnCap({ capMicro: '-5' }, capDeps().d, 'k')), 'BAD_CAP');
  assert.equal(await code(raiseOwnCap({ capMicro: '9'.repeat(14) }, capDeps().d, 'k')), 'BAD_CAP');
});

test('only the resolver\'s own role refusal counts: no revert, or another one, writes nothing', async () => {
  const allowed = capDeps({ revert: null });
  assert.equal(await code(raiseOwnCap({ capMicro: '999000000' }, allowed.d, 'k')), 'NOT_REFUSED');
  assert.equal(allowed.records.length, 0);
  forgetLimits();
  const other = capDeps({ revert: 'InvalidRecord' });
  assert.match(await code(raiseOwnCap({ capMicro: '999000000' }, other.d, 'k')), /^error:/);
  assert.equal(other.records.length, 0);
});

test('the revert reason is the resolver\'s error name, from its ABI, never a message', () => {
  const data = encodeErrorResult({ abi: permissionedResolverAbi, errorName: 'EACUnauthorizedAccountRoles', args: [1n, 2n, `0x${'44'.repeat(20)}`] });
  assert.equal(revertName(new ContractFunctionRevertedError({ abi: permissionedResolverAbi, data, functionName: 'setText' })), 'EACUnauthorizedAccountRoles');
  assert.equal(revertName(new Error('https://secret.example/key')), null);
});
