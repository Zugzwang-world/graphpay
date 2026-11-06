import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@/demo/mock-adapter';
import { story } from '@/data/story';
import { usdt } from '@/lib/money';
import { canSubmitRefund, validRefundFile } from './refundFlow';
import { refundTrackerSteps } from '@/lib/refundTracker';

const prompt = story.quickPrompts.find((item) => item.kind === 'ask')!.text;

async function paidOrder() {
  const adapter = new MockAdapter();
  await adapter.setShopOpen(true);
  await vi.advanceTimersByTimeAsync(500);
  await adapter.sendPrompt(prompt);
  await vi.advanceTimersByTimeAsync(13_000);
  const order = (await adapter.getSnapshot()).orders.find((entry) => entry.owner.ens === story.customer.ens)!;
  return { adapter, order };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T14:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('F7 refund wizard gate and decisions', () => {
  it('shows accepted as checked, refunded as complete, and a decline at Requested', () => {
    expect(refundTrackerSteps('accepted').map((step) => step.state)).toEqual(['done', 'done', 'current']);
    expect(refundTrackerSteps('refunded').map((step) => step.state)).toEqual(['done', 'done', 'done']);
    expect(refundTrackerSteps('declined').map((step) => step.state)).toEqual(['failed', 'todo', 'todo']);
  });

  it('requires a confirmed amount, confirmed reason and valid photo', async () => {
    const { order } = await paidOrder();
    const photo = new File(['photo'], 'sweets.png', { type: 'image/png' });
    expect(canSubmitRefund(order, null, 'Squashed', true, photo)).toBe(false);
    expect(canSubmitRefund(order, usdt('4.00'), '', true, photo)).toBe(false);
    expect(canSubmitRefund(order, usdt('4.00'), 'Squashed', false, photo)).toBe(false);
    expect(canSubmitRefund(order, usdt('4.00'), 'Squashed', true, null)).toBe(false);
    expect(canSubmitRefund(order, usdt('4.01'), 'Squashed', true, photo)).toBe(false);
    expect(canSubmitRefund(order, usdt('4.00'), 'Squashed', true, photo)).toBe(true);
    expect(validRefundFile(new File(['x'], 'note.txt', { type: 'text/plain' }))).toBe(false);
    expect(validRefundFile({ type: 'application/pdf', size: 10 * 1024 * 1024 + 1 } as File)).toBe(false);
  });

  it('moves a full request through accepted and refunded on both phones', async () => {
    const { adapter, order } = await paidOrder();
    const photo = new File(['photo'], 'sweets.png', { type: 'image/png' });
    await adapter.requestRefund(order.id, { amount: order.total, reason: 'Squashed sweets', photo });
    await vi.advanceTimersByTimeAsync(800);
    let current = (await adapter.getSnapshot()).orders.find((entry) => entry.id === order.id)!;
    expect(current.refunds[0]).toMatchObject({ status: 'requested', full: true, reason: 'Squashed sweets', photoName: 'sweets.png' });
    expect(canSubmitRefund(current, order.total, 'Again', true, photo)).toBe(false);
    await adapter.approveRefund(order.id, order.total);
    await vi.advanceTimersByTimeAsync(900);
    current = (await adapter.getSnapshot()).orders.find((entry) => entry.id === order.id)!;
    expect(current.refunds[0]?.status).toBe('accepted');
    await vi.advanceTimersByTimeAsync(2_500);
    current = (await adapter.getSnapshot()).orders.find((entry) => entry.id === order.id)!;
    expect(current.refunds[0]?.status).toBe('refunded');
    expect(current.refunds[0]?.links).toHaveLength(1);
  });
});
