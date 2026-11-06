import type { Link, Money, Order, OrderStep, RefundStatus } from '@/demo/contract';
import { toAmount, toCents, usdt } from '@/lib/money';
import { cityWeekday, isoDate } from '@/lib/time';

export type PayoutPeriod = 'today' | 'week' | 'month' | 'custom';
export type PayoutRange = { from: string; to: string };
export type PayoutRow = {
  id: string;
  orderId: string;
  type: 'order' | 'refund';
  number: string;
  buyerEns: string;
  at: number;
  amount: Money;
  status: OrderStep | RefundStatus;
  links: Link[];
};

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

export function payoutRange(period: PayoutPeriod, now: number, custom: PayoutRange): PayoutRange {
  const today = isoDate(now);
  if (period === 'custom') return custom;
  if (period === 'today') return { from: today, to: today };
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: shiftDate(today, -((cityWeekday(now) + 6) % 7)), to: today };
}

export function validPayoutRange(range: PayoutRange): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(range.from) && /^\d{4}-\d{2}-\d{2}$/.test(range.to) && range.from <= range.to;
}

/** The log and summary use the same settled transactions that the mock CSV exports. */
export function payoutLedger(orders: Order[], shopEns: string, range: PayoutRange): { rows: PayoutRow[]; received: Money; refunded: Money; net: Money } {
  const rows: PayoutRow[] = [];
  for (const order of orders) {
    if (order.shop.ens !== shopEns) continue;
    if (order.paidAt && inRange(order.paidAt, range)) rows.push({
      id: `payment-${order.id}`, orderId: order.id, type: 'order', number: order.number,
      buyerEns: order.buyer.ens, at: order.paidAt, amount: order.total,
      status: order.status, links: order.links,
    });
    for (const refund of order.refunds) {
      if (refund.status !== 'refunded' || !refund.settledAt || !inRange(refund.settledAt, range)) continue;
      rows.push({
        id: `refund-${refund.id}`, orderId: order.id, type: 'refund', number: order.number,
        buyerEns: order.buyer.ens, at: refund.settledAt, amount: usdt(toAmount(-toCents(refund.amount))),
        status: refund.status, links: refund.links,
      });
    }
  }
  rows.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  const receivedCents = rows.filter((row) => row.type === 'order').reduce((sum, row) => sum + toCents(row.amount), 0);
  const refundedCents = -rows.filter((row) => row.type === 'refund').reduce((sum, row) => sum + toCents(row.amount), 0);
  return { rows, received: usdt(toAmount(receivedCents)), refunded: usdt(toAmount(refundedCents)), net: usdt(toAmount(receivedCents - refundedCents)) };
}

function inRange(at: number, range: PayoutRange): boolean {
  const date = isoDate(at);
  return date >= range.from && date <= range.to;
}
