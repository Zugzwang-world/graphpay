/**
 * Starting data for the mock store. Everything here is SYNTHETIC sample data
 * (DESIGN_INSTRUCTIONS.md 13): plausible values a journey needs that the
 * story data does not give. Reset demo returns to exactly this.
 *
 * The customer starts with no orders and no renewals, so the empty states are
 * the first thing a judge sees; the merchant starts Closed with an empty day.
 * The only seeded history is the other customer's daily renewal (from earlier
 * days), so the merchant's Renewals and Payouts pages have something to show.
 */
import type { AgentState, DemoSnapshot, Order, Renewal, ShopAgentState } from './contract';
import { story, productById } from '@/data/story';
import { usdt } from '@/lib/money';
import { DAY, HOUR, isoDate } from '@/lib/time';
import { whitechainTx } from './links';

export interface MockState extends Omit<DemoSnapshot, 'mode' | 'now'> {
  nextOrderNumber: number;
}

function startOfCityDay(now: number): number {
  // Midnight in the city, found by stepping back from `now` by its city clock time.
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: story.city.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const [h, m, s] = clock.split(':').map(Number) as [number, number, number];
  return now - ((h * 60 + m) * 60 + s) * 1000 - (now % 1000);
}

export function seedAgents(now: number): AgentState[] {
  const owner = story.customer.ens;
  const used = usdt(story.spendingPass.usedTodayUsdt);
  const payerRole = story.spendingPass.payingRole;
  const expiresAt = startOfCityDay(now) + DAY;
  return story.agents.map((a) => ({
    ref: { ens: a.ens, role: a.role, owner },
    label: a.label,
    main: a.main,
    pays: Boolean(a.pays),
    does: a.does ?? '',
    status: 'active',
    pass: a.pays
      ? {
          cap: usdt(a.capUsdt ?? '0'),
          used: a.role === payerRole ? used : usdt('0'),
          period: 'day',
          expiresAt,
          state: 'active',
        }
      : undefined,
    refusedAttempts: [],
  }));
}

export function seedShopAgents(): ShopAgentState[] {
  return story.shop.agents.map((a) => ({
    ref: { ens: a.ens, role: a.role, owner: story.shop.ens },
    label: a.label,
    main: a.main,
  }));
}

function seedOtherCustomerRenewal(now: number, nextNumber: () => string): { renewal: Renewal; orders: Order[] } {
  const oc = story.otherCustomer;
  const product = productById(oc.productId) ?? story.products[0]!;
  const shop = { ens: story.shop.ens, name: story.shop.name };
  const agent = { ens: oc.agentEns, role: 'payer', owner: oc.ens };
  const today = startOfCityDay(now);
  const id = 'rn-seed-other';
  const orders: Order[] = [];
  const charges: Renewal['charges'] = [];
  // Daily charges on the three previous days at 9 am city time.
  for (const daysAgo of [3, 2, 1]) {
    const at = today - daysAgo * DAY + 9 * HOUR;
    const links = [whitechainTx(`seed-${daysAgo}`)];
    const order: Order = {
      id: `ord-seed-${daysAgo}`,
      number: nextNumber(),
      kind: 'renewal',
      renewalId: id,
      shop,
      items: [{ name: product.name, qty: 1, price: usdt(product.priceUsdt), productId: product.id }],
      total: usdt(product.priceUsdt),
      status: 'delivered',
      createdAt: at,
      paidAt: at,
      dispatchedAt: at + 10 * 60_000,
      deliveredAt: at + 40 * 60_000,
      buyer: agent,
      owner: { name: oc.name, ens: oc.ens },
      reputation: { orders: 18, refunds: 0, since: '2025' },
      risk: { level: 'safe', text: story.buyerReputation.riskVerdict },
      links,
      refunds: [],
      isNew: false,
      synthetic: true,
    };
    orders.push(order);
    charges.push({ at, orderId: order.id, amount: order.total, links });
  }
  const renewal: Renewal = {
    id,
    item: product.short,
    productId: product.id,
    shop,
    schedule: { frequency: 'daily', startDate: isoDate(today - 3 * DAY + HOUR) },
    scheduleText: 'every day',
    scheduleShort: oc.schedule,
    nextChargeAt: today + DAY + 9 * HOUR,
    amount: usdt(product.priceUsdt),
    status: 'active',
    payingAgent: agent,
    owner: { name: oc.name, ens: oc.ens },
    charges,
    createdAt: today - 3 * DAY,
    synthetic: true,
  };
  return { renewal, orders };
}

export function seedState(now: number): MockState {
  let n = 1039;
  const nextNumber = () => String(n++);
  const other = seedOtherCustomerRenewal(now, nextNumber);
  return {
    customer: { name: story.customer.name, ens: story.customer.ens },
    agents: seedAgents(now),
    shop: { ref: { ens: story.shop.ens, name: story.shop.name }, area: story.shop.area, open: false },
    shopAgents: seedShopAgents(),
    orders: [...other.orders],
    renewals: [other.renewal],
    errandRunning: false,
    nextOrderNumber: n,
  };
}

export { startOfCityDay };
