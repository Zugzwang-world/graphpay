import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { namehash } from 'viem';
import { siteModel } from './site.server.ts';
import { REORDER_COOLDOWN_MS, ReorderRefusal, codeOf, forgetReorders, reorder, type PayOutcome, type ReorderDeps } from './reorder.server.ts';

const PARENT = `0x${'ab'.repeat(32)}`;
const OTHER = `0x${'cd'.repeat(32)}`;
const model = () => siteModel();

function deps(over: Partial<{ status: string; shopNode: string; buyerNode: string; last: string | null; at: number; price: string; quantity: number; outcome: PayOutcome | Error; hold: Promise<void>; terms: Record<string, unknown>; exp: number }> = {}) {
  const paid: unknown[] = [];
  const quoted: { parentOrderId: string; buyer: string }[] = [];
  const d: ReorderDeps = {
    lastOrderId: async () => (over.last === undefined ? PARENT : over.last),
    readOrder: async () => ({ status: over.status ?? 'PAID', amountMicro: 4_800_000n, refundedMicro: 0n, merchant: `0x${'11'.repeat(20)}`, shopNode: over.shopNode ?? namehash(model().merchant.ens), buyerNode: over.buyerNode ?? namehash(model().persona.ens) }),
    quote: async (input) => {
      quoted.push(input);
      const m = model();
      const terms = { orderId: '0x1', shop: m.merchant.ens, item: m.order.reorder.sku, quantity: m.order.reorder.quantity, priceMicro: m.order.reorder.priceMicro, parentOrderId: input.parentOrderId, buyer: input.buyer, payer: m.payer.ens, exp: over.exp ?? 1_800_000_600, ...over.terms };
      return { buyer: input.buyer, terms, payUrl: 'https://example.test/pay', priceMicro: over.price ?? model().order.reorder.priceMicro, quantity: over.quantity ?? model().order.reorder.quantity };
    },
    pay: async (quote) => {
      paid.push(quote);
      if (over.hold) await over.hold;
      if (over.outcome instanceof Error) throw over.outcome;
      return over.outcome ?? { status: 'paid', orderId: '0xnew', transaction: '0xtx' };
    },
    now: () => over.at ?? 1_800_000_000_000,
  };
  return { d, paid, quoted };
}
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof ReorderRefusal ? e.code : `error:${String(e)}`));

beforeEach(() => forgetReorders());

test('a paid last order is ordered again once, the quote built from the chain and the story', async () => {
  const { d, paid, quoted } = deps();
  const out = await reorder({ parentOrderId: PARENT }, d);
  assert.equal(out.status, 'paid');
  assert.equal(out.transaction, '0xtx');
  assert.equal(out.parentOrderId, PARENT);
  assert.equal(paid.length, 1);
  assert.deepEqual(quoted, [{ parentOrderId: PARENT, buyer: model().persona.ens }]);
});

test('the buyer name is whichever of the payer agent and its person the order was bought under', async () => {
  const { d, quoted } = deps({ buyerNode: namehash(model().payer.ens) });
  await reorder({}, d);
  assert.equal(quoted[0]!.buyer, model().payer.ens);
});

test('the page cannot name another order; no order at all is refused', async () => {
  assert.equal(await code(reorder({ parentOrderId: OTHER }, deps().d)), 'NOT_THIS_ORDER');
  assert.equal(await code(reorder({}, deps({ last: null }).d)), 'NO_ORDER');
});

test('another shop, another buyer, and an unpaid or refunded order are refused before any quote', async () => {
  for (const [over, want] of [
    [{ shopNode: `0x${'00'.repeat(32)}` }, 'NOT_OURS'],
    [{ buyerNode: `0x${'00'.repeat(32)}` }, 'NOT_OURS'],
    [{ status: 'CREATED' }, 'NOT_REORDERABLE'],
    [{ status: 'REFUNDED' }, 'NOT_REORDERABLE'],
  ] as const) {
    const { d, quoted, paid } = deps(over);
    assert.equal(await code(reorder({}, d)), want);
    assert.equal(quoted.length + paid.length, 0);
  }
});

test('a quote whose price or quantity is not the story\'s is never signed', async () => {
  for (const over of [{ price: '1' }, { quantity: 99 }]) {
    const { d, paid } = deps(over);
    assert.equal(await code(reorder({}, d)), 'PRICE_CHANGED');
    assert.equal(paid.length, 0);
  }
});

test('a second tap is refused while the first is running and for two minutes after a paid one', async () => {
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  const first = deps({ hold });
  const running = reorder({}, first.d);
  await new Promise((r) => setTimeout(r, 5));
  const second = deps();
  assert.equal(await code(reorder({}, second.d)), 'TOO_SOON');
  assert.equal(second.paid.length, 0);
  release();
  await running;
  assert.equal(await code(reorder({}, deps({ at: 1_800_000_000_000 + 1000 }).d)), 'TOO_SOON');
  assert.equal(await code(reorder({}, deps({ at: 1_800_000_000_000 + REORDER_COOLDOWN_MS }).d)), 'ok');
});

test('an unclear outcome is pending and holds every re-order until the signature cannot settle', async () => {
  const at = 1_800_000_000_000;
  const unknown = await reorder({}, deps({ at, exp: 1_800_000_600, outcome: { status: 'unknown', orderId: '0xnew', reason: 'merchant_unreachable' } }).d);
  assert.equal(unknown.status, 'pending');
  // Past the two-minute cooldown, still inside the signature's life: refused.
  assert.equal(await code(reorder({}, deps({ at: at + REORDER_COOLDOWN_MS + 1000 }).d)), 'TOO_SOON');
  // The child becoming the newest order does not help: the hold is on the payer agent.
  assert.equal(await code(reorder({}, deps({ last: OTHER, at: at + 300_000 }).d)), 'TOO_SOON');
  // After the deadline and a minute of skew, a new tap is allowed.
  assert.equal(await code(reorder({}, deps({ at: 1_800_000_000_000 + 600_000 + 61_000 }).d)), 'ok');
});

test('after a paid re-order the next one (on the child, or on the same parent) waits out the cooldown', async () => {
  const at = 1_800_000_000_000;
  await reorder({}, deps({ at }).d);
  assert.equal(await code(reorder({}, deps({ last: OTHER, at: at + 15_000 }).d)), 'TOO_SOON');
  assert.equal(await code(reorder({}, deps({ at: at + REORDER_COOLDOWN_MS }).d)), 'ok');
});

test('a definite failure or nothing to sign releases the hold', async () => {
  assert.equal(await code(reorder({}, deps({ outcome: { status: 'failed', reason: 'OVER_DAILY_CAP' } }).d)), 'OVER_DAILY_CAP');
  assert.equal(await code(reorder({}, deps({ outcome: { status: 'not_payable', orderId: '0x1' } }).d)), 'NOT_PAID');
  assert.equal(await code(reorder({}, deps({ outcome: { status: 'free' } }).d)), 'NOT_PAID');
  assert.equal(await code(reorder({}, deps().d)), 'ok');
});

test('a buyer refusal before signing releases the hold; any other error keeps it', async () => {
  const refusal = Object.assign(new Error('x'), { code: 'PASS_REVOKED' });
  await assert.rejects(reorder({}, deps({ outcome: refusal }).d), /x/);
  assert.equal(await code(reorder({}, deps().d)), 'ok');
  forgetReorders();
  await assert.rejects(reorder({}, deps({ outcome: new Error('socket closed') }).d), /socket closed/);
  assert.equal(await code(reorder({}, deps().d)), 'TOO_SOON');
});

test('terms that are not the story\'s shop, item, parent, buyer or payer are never signed', async () => {
  for (const terms of [{ shop: 'other.eth' }, { item: 'other-sku' }, { parentOrderId: OTHER }, { buyer: 'someone.eth' }, { payer: 'other.eth' }, { priceMicro: '1' }]) {
    const { d, paid } = deps({ terms });
    assert.equal(await code(reorder({}, d)), 'PRICE_CHANGED');
    assert.equal(paid.length, 0);
  }
});

test('a refusal from the buyer reaches the phone as its code; other errors do not', () => {
  assert.equal(codeOf({ code: 'OVER_PERIOD_CAP', message: 'rpc https://secret.example/key' }), 'OVER_PERIOD_CAP');
  assert.equal(codeOf(new Error('https://secret.example/key')), null);
  assert.equal(codeOf({ code: 'lower case' }), null);
});
