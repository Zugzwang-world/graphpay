import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@/demo/mock-adapter';
import { story } from '@/data/story';
import { merchantDay } from './homeData';

const prompt = story.quickPrompts.find((item) => item.kind === 'ask')!.text;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T14:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('F6 merchant home and shared order', () => {
  it('starts with an empty day and preserves past orders while closed', async () => {
    const adapter = new MockAdapter();
    const start = await adapter.getSnapshot();
    const day = merchantDay(start.orders, start.shop.ref.ens, start.now);
    expect(start.shop.open).toBe(false);
    expect(day.orderCount).toBe(0);
    expect(day.earned.amount).toBe('0.00');
    expect(day.orders).toHaveLength(0);
    expect(start.orders.length).toBeGreaterThan(0);
  });

  it('adds a new paid row, clears New on opening, and updates both phones on dispatch and delivery', async () => {
    const adapter = new MockAdapter();
    await adapter.setShopOpen(true);
    await vi.advanceTimersByTimeAsync(500);
    await adapter.sendPrompt(prompt);
    await vi.advanceTimersByTimeAsync(13_000);
    let snapshot = await adapter.getSnapshot();
    let day = merchantDay(snapshot.orders, snapshot.shop.ref.ens, snapshot.now);
    expect(day.orderCount).toBe(1);
    expect(day.earned.amount).toBe('4.00');
    expect(day.orders[0]).toMatchObject({ status: 'paid', isNew: true });
    const id = day.orders[0]!.id;
    await adapter.markOrderSeen!(id);
    snapshot = await adapter.getSnapshot();
    expect(snapshot.orders.find((order) => order.id === id)?.isNew).toBe(false);
    await adapter.dispatch(id);
    await vi.advanceTimersByTimeAsync(1_000);
    snapshot = await adapter.getSnapshot();
    expect(snapshot.orders.find((order) => order.id === id)?.status).toBe('dispatched');
    await vi.advanceTimersByTimeAsync(6_100);
    snapshot = await adapter.getSnapshot();
    day = merchantDay(snapshot.orders, snapshot.shop.ref.ens, snapshot.now);
    expect(snapshot.orders.find((order) => order.id === id)?.status).toBe('delivered');
    expect(day.orders[0]?.status).toBe('delivered');
    expect(day.orderCount).toBe(1);
  });

  it('counts refunds settled today even for an order paid on an earlier day', async () => {
    const adapter = new MockAdapter();
    const snapshot = await adapter.getSnapshot();
    const past = snapshot.orders[0]!;
    const refund = { id: 'rf-test', amount: past.total, full: true, reason: 'test', status: 'refunded' as const, requestedAt: snapshot.now - 10_000, settledAt: snapshot.now, links: [] };
    const day = merchantDay([{ ...past, refunds: [refund] }, ...snapshot.orders.slice(1)], snapshot.shop.ref.ens, snapshot.now);
    expect(day.orderCount).toBe(0);
    expect(day.refundCount).toBe(1);
    expect(day.refunded.amount).toBe(past.total.amount);
    expect(day.orders[0]?.id).toBe(past.id);
  });
});
