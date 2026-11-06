import { describe, expect, it } from 'vitest';
import { seedState } from '@/demo/mock-data';
import { story } from '@/data/story';
import { usdt } from '@/lib/money';
import { payoutLedger, payoutRange, validPayoutRange } from './payoutData';

const now = Date.parse('2026-11-06T14:00:00Z');
const today = { from: '2026-11-06', to: '2026-11-06' };

describe('merchant payout periods and ledger', () => {
  it('uses city dates and a Monday-start week for the seeded renewal payments', () => {
    const state = seedState(now);
    const week = payoutRange('week', now, today);
    expect(week).toEqual({ from: '2026-11-02', to: '2026-11-06' });
    expect(payoutRange('month', now, today)).toEqual({ from: '2026-11-01', to: '2026-11-06' });
    expect(payoutRange('today', now, today)).toEqual(today);
    const ledger = payoutLedger(state.orders, story.shop.ens, week);
    expect(ledger.rows).toHaveLength(3);
    expect(ledger.rows.every((row) => row.type === 'order' && row.links[0]?.mock)).toBe(true);
    expect(ledger.received.amount).toBe(usdt(Number(state.orders[0]!.total.amount) * 3).amount);
    expect(ledger.refunded.amount).toBe('0.00');
    expect(ledger.net.amount).toBe(ledger.received.amount);
  });

  it('counts a settled refund on its own date, supports negative net, and excludes other shops', () => {
    const state = seedState(now);
    state.orders[0]!.refunds.push({
      id: 'rf-demo', amount: usdt('50.00'), full: false, reason: 'Demo', status: 'refunded',
      requestedAt: now - 1_000, settledAt: now,
      links: [{ label: 'View transaction', url: 'https://example.test/refund', mock: true }],
    });
    const otherShop = { ...state.orders[0]!, id: 'outside', shop: { ens: 'other.eth', name: 'Other' }, paidAt: now, refunds: [] };
    const ledger = payoutLedger([...state.orders, otherShop], story.shop.ens, today);
    expect(ledger.rows.map((row) => row.type)).toEqual(['refund']);
    expect(ledger.rows[0]?.amount.amount).toBe('-50.00');
    expect(ledger.received.amount).toBe('0.00');
    expect(ledger.refunded.amount).toBe('50.00');
    expect(ledger.net.amount).toBe('-50.00');
    expect(validPayoutRange({ from: '2026-11-07', to: '2026-11-06' })).toBe(false);
  });
});
