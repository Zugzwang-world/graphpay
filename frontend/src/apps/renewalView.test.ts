import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAdapter } from '@/demo/mock-adapter';
import { encodeSchedule, type DemoEvent } from '@/demo/contract';
import { firstChargeAt, scheduleText } from '@/demo/rules';
import { story } from '@/data/story';
import { usdt } from '@/lib/money';
import { DAY, isoDate } from '@/lib/time';
import { customerRenewalSections, fitsRenewalPass, merchantRenewalSections, renewalSchedule } from './renewalView';

const prompt = story.quickPrompts.find((item) => item.kind === 'ask')!.text;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T14:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('F8 renewal setup and sections', () => {
  it('builds the selected schedule and checks a future charge against the period cap', async () => {
    const adapter = new MockAdapter();
    const snapshot = await adapter.getSnapshot();
    const payer = snapshot.agents.find((agent) => agent.ref.role === story.spendingPass.payingRole)!;
    const schedule = renewalSchedule('weekly', isoDate(Date.now() + DAY), 0, 1);
    expect(schedule).toEqual({ frequency: 'weekly', startDate: isoDate(Date.now() + DAY), weekday: 0 });
    expect(scheduleText(schedule)).toBe('every Sunday');
    expect(firstChargeAt(schedule)).toBeGreaterThan(Date.now());
    expect(fitsRenewalPass(usdt('4.00'), payer.pass)).toBe(true);
    expect(fitsRenewalPass(usdt('7.00'), payer.pass)).toBe(false);
  });

  it('groups a skipped customer renewal, then its retry and cancellation on both phones', async () => {
    const adapter = new MockAdapter();
    const events: DemoEvent[] = [];
    adapter.subscribe((event) => events.push(event));
    await adapter.setShopOpen(true);
    await vi.advanceTimersByTimeAsync(500);
    await adapter.sendPrompt(prompt);
    await vi.advanceTimersByTimeAsync(13_000);
    const order = (await adapter.getSnapshot()).orders.find((entry) => entry.owner.ens === story.customer.ens)!;
    await adapter.startRenewal(order.id, encodeSchedule(renewalSchedule('daily', isoDate(Date.now() + DAY), 0, 1)));
    await vi.advanceTimersByTimeAsync(1_000);
    let snapshot = await adapter.getSnapshot();
    const id = customerRenewalSections(snapshot.renewals, story.customer.ens).current[0]!.id;
    expect(merchantRenewalSections(snapshot.renewals, snapshot.shop.ref.ens, snapshot.now).current.some((renewal) => renewal.id === id)).toBe(true);

    await adapter.setShopOpen(false);
    await vi.advanceTimersByTimeAsync(400);
    await adapter.runNextRenewal();
    await vi.advanceTimersByTimeAsync(2_400);
    snapshot = await adapter.getSnapshot();
    expect(customerRenewalSections(snapshot.renewals, story.customer.ens).current[0]).toMatchObject({ id, status: 'skipped', skippedReason: 'shop_closed' });
    expect(events.some((event) => event.type === 'agent.pass.period' && event.agent.ens === order.buyer.ens)).toBe(true);
    expect(merchantRenewalSections(snapshot.renewals, snapshot.shop.ref.ens, snapshot.now).current.some((renewal) => renewal.id === id && renewal.status === 'skipped')).toBe(true);

    await adapter.setShopOpen(true);
    await vi.advanceTimersByTimeAsync(2_000);
    snapshot = await adapter.getSnapshot();
    expect(snapshot.renewals.find((renewal) => renewal.id === id)?.status).toBe('charged');
    expect(snapshot.agents.find((agent) => agent.ref.ens === order.buyer.ens)?.pass?.used.amount).toBe('4.00');
    expect(merchantRenewalSections(snapshot.renewals, snapshot.shop.ref.ens, snapshot.now).chargedToday.some((renewal) => renewal.id === id)).toBe(true);

    await adapter.cancelRenewal(id);
    await vi.advanceTimersByTimeAsync(600);
    snapshot = await adapter.getSnapshot();
    expect(customerRenewalSections(snapshot.renewals, story.customer.ens).cancelled[0]?.id).toBe(id);
    expect(merchantRenewalSections(snapshot.renewals, snapshot.shop.ref.ens, snapshot.now).cancelled.some((renewal) => renewal.id === id)).toBe(true);
  });
});
