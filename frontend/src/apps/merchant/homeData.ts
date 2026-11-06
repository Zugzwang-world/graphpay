import type { Money, Order } from '@/demo/contract';
import { add, ZERO } from '@/lib/money';
import { isSameCityDay } from '@/lib/time';

export interface MerchantDay {
  earned: Money;
  orderCount: number;
  refundCount: number;
  refunded: Money;
  orders: Order[];
}

function latestActivity(order: Order, now: number): number {
  const times = [order.paidAt, order.dispatchedAt, order.deliveredAt,
    ...order.refunds.flatMap((refund) => [refund.requestedAt, refund.settledAt])];
  return Math.max(...times.filter((at): at is number => Boolean(at && isSameCityDay(at, now))), 0);
}

/** Home totals and log are always derived from the shared order snapshot. */
export function merchantDay(orders: Order[], shopEns: string, now: number): MerchantDay {
  const shopOrders = orders.filter((order) => order.shop.ens === shopEns);
  const paidToday = shopOrders.filter((order) => order.paidAt && isSameCityDay(order.paidAt, now));
  const refundsToday = shopOrders.flatMap((order) => order.refunds.filter((refund) => refund.status === 'refunded' && refund.settledAt && isSameCityDay(refund.settledAt, now)));
  return {
    earned: paidToday.length ? add(...paidToday.map((order) => order.total)) : ZERO,
    orderCount: paidToday.length,
    refundCount: refundsToday.length,
    refunded: refundsToday.length ? add(...refundsToday.map((refund) => refund.amount)) : ZERO,
    orders: shopOrders.filter((order) => latestActivity(order, now) > 0).sort((a, b) => latestActivity(b, now) - latestActivity(a, now)),
  };
}
