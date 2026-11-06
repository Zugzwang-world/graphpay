import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAdapter } from './mock-adapter';
import type { DemoEvent, DemoEventType, DemoSnapshot, EventOf, Order } from './contract';
import { encodeSchedule } from './contract';
import { applyEvent } from './state';
import { story, payingAgent } from '@/data/story';
import { usdt } from '@/lib/money';
import { isoDate } from '@/lib/time';

/** Drives the mock with fake timers and records every event. */
async function setup() {
  const adapter = new MockAdapter();
  const events: DemoEvent[] = [];
  let mirror: DemoSnapshot = await adapter.getSnapshot();
  adapter.subscribe((e) => {
    events.push(e);
    if (e.type !== 'demo.reset') mirror = applyEvent(mirror, e);
  });
  const of = <T extends DemoEventType>(t: T) => events.filter((e): e is EventOf<T> => e.type === t);
  const run = (ms = 60_000) => vi.advanceTimersByTimeAsync(ms);
  const snap = () => adapter.getSnapshot();
  const resync = async () => {
    mirror = await adapter.getSnapshot();
  };
  return { adapter, events, of, run, snap, mirror: () => mirror, resync };
}

const customerOrders = (s: DemoSnapshot): Order[] => s.orders.filter((o) => o.owner.ens === story.customer.ens);
const payer = payingAgent();
const askPrompt = story.quickPrompts.find((q) => q.kind === 'ask')!.text;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T14:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('starting state', () => {
  it('starts closed, with no customer orders or renewals', async () => {
    const { snap } = await setup();
    const s = await snap();
    expect(s.mode).toBe('mock');
    expect(s.shop.open).toBe(false);
    expect(customerOrders(s)).toHaveLength(0);
    expect(s.renewals.filter((r) => r.owner.ens === story.customer.ens)).toHaveLength(0);
    expect(s.agents.find((a) => a.ref.ens === payer.ens)?.pass?.used.amount).toBe(story.spendingPass.usedTodayUsdt);
  });
});

describe('journey 1: ask and pay', () => {
  it('a closed shop is not considered and nothing is charged', async () => {
    const { adapter, of, run, snap } = await setup();
    await adapter.sendPrompt(askPrompt);
    await run();
    const compared = of('shops.compared')[0]!;
    expect(compared.choices.some((c) => c.shop.ens === story.shop.ens)).toBe(false);
    expect(of('quote.created')).toHaveLength(0);
    expect(of('payment.refused').at(-1)?.reason).toBe('shop_closed');
    expect(customerOrders(await snap())).toHaveLength(0);
    expect((await snap()).errandRunning).toBe(false);
  });

  it('runs end to end: trap rejected, quote, signed, settled, dispatched, delivered', async () => {
    const { adapter, events, of, run, snap } = await setup();
    await adapter.setShopOpen(true);
    await run(1000);
    expect(of('shop.status').at(-1)?.open).toBe(true);

    await adapter.sendPrompt(askPrompt);
    await run();

    const compared = of('shops.compared')[0]!;
    const trap = compared.choices.find((c) => c.verdict === 'rejected');
    expect(trap?.reason).toBe(story.shops.find((s) => s.storyRole === 'trap')?.rejectedBecause);
    expect(compared.choices.find((c) => c.verdict === 'chosen')?.shop.ens).toBe(story.shop.ens);
    expect(of('graph.read')[0]?.reads).toBe(2);

    const quote = of('quote.created')[0]!;
    expect(quote.total.amount).toBe('4.00');
    expect(quote.validUntil - Date.now()).toBeLessThanOrEqual(15 * 60_000);

    const order = (key: string) => events.findIndex((e) => e.type === key);
    expect(order('quote.created')).toBeLessThan(order('payment.signed'));
    expect(order('payment.signed')).toBeLessThan(order('payment.settled'));
    expect(order('payment.settled')).toBeLessThan(order('merchant.notification'));

    const settled = of('payment.settled')[0]!;
    expect(settled.links[0]?.mock).toBe(true);
    expect(of('merchant.notification')[0]).toMatchObject({ kind: 'new_order', orderId: quote.orderId });

    let s = await snap();
    const o = s.orders.find((x) => x.id === quote.orderId)!;
    expect(o.status).toBe('paid');
    expect(o.isNew).toBe(true);
    expect(s.agents.find((a) => a.ref.ens === payer.ens)?.pass?.used.amount).toBe('6.00');
    expect(s.errandRunning).toBe(false);

    await adapter.markOrderSeen!(o.id);
    await adapter.dispatch(o.id);
    await run(2000);
    s = await snap();
    expect(s.orders.find((x) => x.id === o.id)?.status).toBe('dispatched');
    expect(s.orders.find((x) => x.id === o.id)?.isNew).toBe(false);
    await run(10_000);
    expect((await snap()).orders.find((x) => x.id === o.id)?.status).toBe('delivered');
  });

  it('a second order over the cap is refused with reason cap', async () => {
    const { adapter, of, run, snap } = await setup();
    await adapter.setShopOpen(true);
    await adapter.sendPrompt(askPrompt);
    await run();
    await adapter.sendPrompt(askPrompt);
    await run();
    expect(of('payment.refused').at(-1)?.reason).toBe('cap');
    expect(customerOrders(await snap()).filter((o) => o.status !== 'ordered')).toHaveLength(1);
    expect((await snap()).agents.find((a) => a.ref.ens === payer.ens)?.refusedAttempts.at(-1)?.reason).toBe('cap');
  });

  it('closing the shop while a quote is open withdraws it', async () => {
    const { adapter, of, run, snap } = await setup();
    await adapter.setShopOpen(true);
    await run(1000);
    await adapter.sendPrompt(askPrompt);
    while (of('quote.created').length === 0) await run(100);
    await adapter.setShopOpen(false);
    await run();
    expect(of('payment.settled')).toHaveLength(0);
    expect(of('payment.refused').at(-1)?.reason).toBe('shop_closed');
    expect(customerOrders(await snap())).toHaveLength(0);
  });

  it('a quote that expires before payment re-quotes by itself and still settles', async () => {
    const adapter = new MockAdapter({ quoteValidityMs: 1000 });
    const events: DemoEvent[] = [];
    adapter.subscribe((e) => events.push(e));
    await adapter.setShopOpen(true);
    await adapter.sendPrompt(askPrompt);
    await vi.advanceTimersByTimeAsync(60_000);
    const quotes = events.filter((e) => e.type === 'quote.created');
    expect(quotes.length).toBeGreaterThanOrEqual(2);
    expect(new Set(quotes.map((q) => (q as EventOf<'quote.created'>).orderId)).size).toBe(1);
    expect(events.some((e) => e.type === 'payment.refused')).toBe(false);
    expect(events.filter((e) => e.type === 'payment.settled')).toHaveLength(1);
  });

  it('a settled quote never re-quotes later', async () => {
    const { adapter, of, run } = await setup();
    await adapter.setShopOpen(true);
    await adapter.sendPrompt(askPrompt);
    await run();
    expect(of('quote.created')).toHaveLength(1);
    await run(20 * 60_000);
    expect(of('quote.created')).toHaveLength(1);
  });

  it('a recoverable error can be retried', async () => {
    const { adapter, of, run } = await setup();
    adapter.failNextPrompt = true;
    await adapter.sendPrompt(askPrompt);
    await run();
    expect(of('error')[0]).toMatchObject({ recoverable: true, retry: 'sendPrompt' });
  });
});

async function paidOrder(h: Awaited<ReturnType<typeof setup>>): Promise<Order> {
  await h.adapter.setShopOpen(true);
  await h.adapter.sendPrompt(askPrompt);
  await h.run();
  return customerOrders(await h.snap()).find((o) => o.status === 'paid')!;
}

describe('journey 2: refund', () => {
  it('partial request, approved for that amount, settles with a link', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await h.adapter.requestRefund(o.id, { amount: usdt('1.00'), reason: 'Two pieces were squashed', photo: new File(['x'], 'p.jpg', { type: 'image/jpeg' }) });
    await h.run(2000);
    expect(h.of('refund.requested')[0]).toMatchObject({ orderId: o.id, amount: { amount: '1.00' } });
    expect(h.of('merchant.notification').at(-1)).toMatchObject({ kind: 'refund_request', orderId: o.id });

    await h.adapter.approveRefund(o.id, usdt('1.00'));
    await h.run(1000);
    expect((await h.snap()).orders.find((x) => x.id === o.id)?.refunds[0]?.status).toBe('accepted');
    await h.run(5000);
    const s = await h.snap();
    const r = s.orders.find((x) => x.id === o.id)!.refunds[0]!;
    expect(r.status).toBe('refunded');
    expect(r.links[0]?.mock).toBe(true);
    expect(h.of('refund.settled')[0]?.amount.amount).toBe('1.00');
  });

  it('the merchant can approve another amount', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await h.adapter.requestRefund(o.id, { amount: usdt('3.00'), reason: 'Late' });
    await h.run(2000);
    await h.adapter.approveRefund(o.id, usdt('2.00'));
    await h.run(10_000);
    expect(h.of('refund.settled')[0]?.amount.amount).toBe('2.00');
  });

  it('declined with a note reaches the customer', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await h.adapter.requestRefund(o.id, { amount: usdt('4.00'), reason: 'Changed my mind' });
    await h.run(2000);
    await h.adapter.declineRefund(o.id, 'Sweets cannot be returned once delivered.');
    await h.run(2000);
    const r = (await h.snap()).orders.find((x) => x.id === o.id)!.refunds[0]!;
    expect(r.status).toBe('declined');
    expect(r.note).toBe('Sweets cannot be returned once delivered.');
  });

  it('rejects amounts above what was paid', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await expect(h.adapter.requestRefund(o.id, { amount: usdt('5.00'), reason: 'x' })).rejects.toThrow();
  });
});

describe('journey 3: renewal', () => {
  it('created, charged now, seen by the merchant, cancelled', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    // Raise the cap first so a renewal charge fits after the order.
    await h.adapter.setCap!(payer.ens, usdt('20.00'));
    await h.run(2000);
    await h.adapter.startRenewal(o.id, encodeSchedule({ frequency: 'weekly', weekday: 0, startDate: isoDate(Date.now()) }));
    await h.run(2000);
    const created = h.of('renewal.created')[0]!.renewal;
    expect(created.scheduleText).toBe('every Sunday');
    expect(created.scheduleShort).toBe('Sun');
    const firstNext = created.nextChargeAt!;

    await h.adapter.runNextRenewal();
    await h.run(5000);
    const charged = h.of('renewal.charged').at(-1)!.renewal;
    expect(charged.status).toBe('charged');
    expect(charged.charges).toHaveLength(1);
    expect(charged.nextChargeAt!).toBeGreaterThan(firstNext);
    expect(h.of('merchant.notification').at(-1)?.kind).toBe('renewal');
    const renewalOrder = (await h.snap()).orders.find((x) => x.renewalId === created.id)!;
    expect(renewalOrder.kind).toBe('renewal');
    expect(renewalOrder.status).toBe('paid');

    await h.adapter.cancelRenewal(created.id);
    await h.run(2000);
    expect(h.of('renewal.cancelled')[0]?.renewal.status).toBe('cancelled');
    expect(h.of('renewal.cancelled')[0]?.renewal.nextChargeAt).toBeNull();
  });

  it('skipped while the shop is closed, retried when it opens', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await h.adapter.setCap!(payer.ens, usdt('20.00'));
    await h.adapter.startRenewal(o.id, encodeSchedule({ frequency: 'daily', startDate: isoDate(Date.now()) }));
    await h.run(3000);
    await h.adapter.setShopOpen(false);
    await h.run(1000);
    await h.adapter.runNextRenewal();
    await h.run(5000);
    const rid = h.of('renewal.created')[0]!.renewal.id;
    expect((await h.snap()).renewals.find((r) => r.id === rid)?.status).toBe('skipped');
    expect(h.of('payment.refused').at(-1)).toMatchObject({ reason: 'shop_closed', renewalId: rid });

    await h.adapter.setShopOpen(true);
    await h.run(10_000);
    const r = (await h.snap()).renewals.find((x) => x.id === rid)!;
    expect(r.status).toBe('charged');
    expect(r.charges).toHaveLength(1);
  });
});

describe('journey 4: pause agent', () => {
  it('a paused payer is refused before any quote, then resumes', async () => {
    const h = await setup();
    await h.adapter.setShopOpen(true);
    await h.adapter.pauseAgent(payer.ens);
    await h.run(2000);
    expect(h.of('agent.permission')[0]).toMatchObject({ change: 'paused' });
    expect(h.of('agent.permission')[0]?.links[0]?.url).toContain(story.explorers.ens);

    await h.adapter.sendPrompt(askPrompt);
    await h.run();
    expect(h.of('quote.created')).toHaveLength(0);
    const refused = h.of('payment.refused').at(-1)!;
    expect(refused.reason).toBe('paused');
    expect(refused.links.length).toBeGreaterThan(0);
    const s = await h.snap();
    const a = s.agents.find((x) => x.ref.ens === payer.ens)!;
    expect(a.pass?.state).toBe('paused');
    expect(a.refusedAttempts.at(-1)?.reason).toBe('paused');

    await h.adapter.resumeAgent(payer.ens);
    await h.run(2000);
    expect((await h.snap()).agents.find((x) => x.ref.ens === payer.ens)?.status).toBe('active');
  });

  it('revoke is final', async () => {
    const h = await setup();
    await h.adapter.revokeAgent(payer.ens);
    await h.run(2000);
    await h.adapter.resumeAgent(payer.ens);
    await h.run(2000);
    expect((await h.snap()).agents.find((x) => x.ref.ens === payer.ens)?.status).toBe('revoked');
    await expect(h.adapter.setCap!(payer.ens, usdt('10.00'))).rejects.toThrow();
  });
});

describe('journey 5: cap refusal', () => {
  it('the agent cannot raise its own cap; the owner can change it', async () => {
    const h = await setup();
    await h.adapter.tryRaiseCap(payer.ens, usdt(story.demo.capRaiseAttemptUsdt));
    await h.run(3000);
    const r = h.of('cap.change.refused')[0]!;
    expect(r.attempted.amount).toBe('50.00');
    expect(r.links[0]?.mock).toBe(true);
    expect((await h.snap()).agents.find((a) => a.ref.ens === payer.ens)?.pass?.cap.amount).toBe(story.spendingPass.capUsdt);

    await h.adapter.setCap!(payer.ens, usdt('8.00'));
    await h.run(2000);
    expect((await h.snap()).agents.find((a) => a.ref.ens === payer.ens)?.pass?.cap.amount).toBe('8.00');
  });
});

describe('journey 6: export', () => {
  it('builds a CSV with a link per row', async () => {
    const h = await setup();
    await paidOrder(h);
    const today = isoDate(Date.now());
    const blobPromise = h.adapter.exportCsv({ from: '2026-01-01', to: today });
    await h.run(2000);
    const csv = await (await blobPromise).text();
    const lines = csv.trim().split(/\r\n/);
    expect(lines[0]).toContain('transaction_link');
    // The seeded other-customer renewals (3) plus today's order.
    expect(lines.length - 1).toBe(4);
    for (const line of lines.slice(1)) expect(line).toMatch(/https:\/\//);
  });
});

describe('journey 7: reorder and reset', () => {
  it('reorder makes a new paid order', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await h.adapter.setCap!(payer.ens, usdt('20.00'));
    await h.run(2000);
    await h.adapter.reorder(o.id);
    await h.run();
    expect(customerOrders(await h.snap()).filter((x) => x.status === 'paid')).toHaveLength(2);
  });

  it('reorder on a closed shop gives the closed note and no quote', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await h.adapter.setShopOpen(false);
    await h.run(1000);
    const quotes = h.of('quote.created').length;
    await h.adapter.reorder(o.id);
    await h.run();
    expect(h.of('quote.created')).toHaveLength(quotes);
    expect(h.of('payment.refused').at(-1)?.reason).toBe('shop_closed');
  });

  it('reset returns to the starting data and cancels pending steps', async () => {
    const h = await setup();
    await h.adapter.setShopOpen(true);
    await h.adapter.sendPrompt(askPrompt);
    await h.run(3000);
    await h.adapter.resetDemo();
    await h.run();
    const s = await h.snap();
    expect(s.shop.open).toBe(false);
    expect(customerOrders(s)).toHaveLength(0);
    expect(h.of('payment.settled')).toHaveLength(0);
    expect(h.adapter.pendingSteps).toBe(0);
  });
});

describe('the reducer stays in sync with the store', () => {
  it('replaying events over the snapshot gives the same orders, renewals and agents', async () => {
    const h = await setup();
    const o = await paidOrder(h);
    await h.adapter.setCap!(payer.ens, usdt('20.00'));
    await h.adapter.requestRefund(o.id, { amount: usdt('1.00'), reason: 'Squashed' });
    await h.run(3000);
    await h.adapter.approveRefund(o.id, usdt('1.00'));
    await h.adapter.startRenewal(o.id, encodeSchedule({ frequency: 'weekly', weekday: 0, startDate: isoDate(Date.now()) }));
    await h.adapter.dispatch(o.id);
    await h.run(10_000);
    await h.adapter.runNextRenewal();
    await h.adapter.pauseAgent(story.agents.find((a) => a.role === 'scout')!.ens);
    await h.adapter.tryRaiseCap(payer.ens, usdt('50.00'));
    await h.run(10_000);
    // A skipped renewal while closed, then the retry on opening.
    await h.adapter.setShopOpen(false);
    await h.run(1000);
    await h.adapter.runNextRenewal();
    await h.run(5000);
    await h.adapter.setShopOpen(true);
    await h.run(10_000);

    const truth = await h.snap();
    const mirror = h.mirror();
    const norm = (s: DemoSnapshot) => ({
      orders: s.orders.map((x) => ({ id: x.id, status: x.status, refunds: x.refunds.map((r) => [r.status, r.amount.amount]) })).sort((a, b) => a.id.localeCompare(b.id)),
      renewals: s.renewals.map((r) => [r.id, r.status, r.charges.length, r.nextChargeAt]).sort(),
      agents: s.agents.map((a) => [a.ref.ens, a.status, a.pass?.cap.amount, a.pass?.used.amount, a.refusedAttempts.length]),
      open: s.shop.open,
    });
    expect(norm(mirror)).toEqual(norm(truth));
  });
});
