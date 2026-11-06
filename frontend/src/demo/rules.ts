/**
 * Pure rules shared by the mock adapter, the event reducer and the pages, so
 * every part of the app agrees on what a state means.
 */
import type { AgentState, Money, Order, PassState, Refund, RenewalSchedule, SpendingPass } from './contract';
import { add, cmp, sub, toCents, usdt, ZERO } from '@/lib/money';
import { DAY, HOUR, WEEKDAYS, WEEKDAYS_SHORT, cityWeekday, isoDate } from '@/lib/time';
import { story } from '@/data/story';
import { copy, fill } from '@/copy';

/* ---------- city calendar ---------- */

/** Midnight in the city's time zone for the city day containing `ms`. */
export function startOfCityDay(ms: number): number {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: story.city.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(ms);
  const [h, m, s] = clock.split(':').map(Number) as [number, number, number];
  return ms - ((h * 60 + m) * 60 + s) * 1000 - (((ms % 1000) + 1000) % 1000);
}

/** Midnight in the city on an ISO date (YYYY-MM-DD). */
export function cityMidnight(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  // Noon UTC falls on the same calendar date for every offset between -11 and +11.
  return startOfCityDay(Date.UTC(y, m - 1, d, 12));
}

/** Renewal charges happen at 9 am city time. */
export const CHARGE_HOUR = 9;

function dayOfMonthOf(ms: number): number {
  return Number(isoDate(ms).slice(8, 10));
}

/** The first charge time of a schedule on or after its start date. */
export function firstChargeAt(s: RenewalSchedule): number {
  let day = cityMidnight(s.startDate);
  for (let i = 0; i < 62; i++) {
    if (matches(s, day)) return day + CHARGE_HOUR * HOUR;
    day = startOfCityDay(day + DAY + HOUR);
  }
  return cityMidnight(s.startDate) + CHARGE_HOUR * HOUR;
}

function matches(s: RenewalSchedule, dayMs: number): boolean {
  switch (s.frequency) {
    case 'daily':
      return true;
    case 'weekly':
    case 'biweekly':
      return cityWeekday(dayMs + HOUR) === (s.weekday ?? 0);
    case 'monthly':
      return dayOfMonthOf(dayMs + HOUR) === (s.dayOfMonth ?? 1);
  }
}

/** The charge after `prev`, one period later. */
export function nextChargeAfter(s: RenewalSchedule, prev: number): number {
  const day = startOfCityDay(prev);
  switch (s.frequency) {
    case 'daily':
      return startOfCityDay(day + DAY + HOUR) + CHARGE_HOUR * HOUR;
    case 'weekly':
      return startOfCityDay(day + 7 * DAY + HOUR) + CHARGE_HOUR * HOUR;
    case 'biweekly':
      return startOfCityDay(day + 14 * DAY + HOUR) + CHARGE_HOUR * HOUR;
    case 'monthly': {
      const iso = isoDate(day + HOUR);
      let y = Number(iso.slice(0, 4));
      let m = Number(iso.slice(5, 7)) + 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      const dd = String(Math.min(s.dayOfMonth ?? 1, 28)).padStart(2, '0');
      return cityMidnight(`${y}-${String(m).padStart(2, '0')}-${dd}`) + CHARGE_HOUR * HOUR;
    }
  }
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function scheduleText(s: RenewalSchedule): string {
  const day = WEEKDAYS[s.weekday ?? 0];
  const t = copy.schedule;
  switch (s.frequency) {
    case 'daily':
      return t.daily;
    case 'weekly':
      return fill(t.weekly, { day });
    case 'biweekly':
      return fill(t.biweekly, { day });
    case 'monthly':
      return fill(t.monthly, { date: ordinal(s.dayOfMonth ?? 1) });
  }
}

export function scheduleShort(s: RenewalSchedule): string {
  const day = WEEKDAYS_SHORT[s.weekday ?? 0] ?? WEEKDAYS_SHORT[0];
  const t = copy.schedule;
  switch (s.frequency) {
    case 'daily':
      return t.dailyShort;
    case 'weekly':
      return day;
    case 'biweekly':
      return fill(t.biweeklyShort, { day });
    case 'monthly':
      return ordinal(s.dayOfMonth ?? 1);
  }
}

/* ---------- spending pass ---------- */

/** The pass state; the worst state wins (C7): revoked > paused > expired > used up > active. */
export function passState(pass: Pick<SpendingPass, 'cap' | 'used' | 'expiresAt'>, status: AgentState['status'], now: number): PassState {
  if (status === 'revoked') return 'revoked';
  if (status === 'paused') return 'paused';
  if (now > pass.expiresAt) return 'expired';
  if (toCents(pass.cap) <= 0 || cmp(pass.used, pass.cap) >= 0) return 'used_up';
  return 'active';
}

export function passRemaining(pass: Pick<SpendingPass, 'cap' | 'used'>): Money {
  const r = sub(pass.cap, pass.used);
  return toCents(r) < 0 ? ZERO : r;
}

/* ---------- orders and refunds ---------- */

export function isPaid(o: Order): boolean {
  return o.status !== 'ordered';
}

/** Refunds that moved or will move money (accepted or refunded). */
export function refundedTotal(o: Order): Money {
  return add(ZERO, ...o.refunds.filter((r) => r.status === 'refunded').map((r) => r.amount));
}

/** Money promised back but not settled yet, plus money settled. */
function committedRefunds(o: Order): Money {
  return add(ZERO, ...o.refunds.filter((r) => r.status === 'refunded' || r.status === 'accepted').map((r) => r.amount));
}

/** The most a refund can still be for: paid minus what is already refunded or accepted. */
export function refundableMax(o: Order): Money {
  const left = sub(o.total, committedRefunds(o));
  return toCents(left) < 0 ? ZERO : left;
}

export function isFullyRefunded(o: Order): boolean {
  return toCents(refundedTotal(o)) >= toCents(o.total);
}

/** A refund waiting for the shop or on its way. */
export function openRefund(o: Order): Refund | undefined {
  return o.refunds.find((r) => r.status === 'requested' || r.status === 'accepted');
}

export function latestRefund(o: Order): Refund | undefined {
  return o.refunds[o.refunds.length - 1];
}

export type RefundEligibility = { ok: true } | { ok: false; why: 'not_paid' | 'fully_refunded' | 'open_refund' };

export function canRequestRefund(o: Order): RefundEligibility {
  if (!isPaid(o)) return { ok: false, why: 'not_paid' };
  if (toCents(refundableMax(o)) <= 0) return { ok: false, why: 'fully_refunded' };
  if (openRefund(o)) return { ok: false, why: 'open_refund' };
  return { ok: true };
}

/** The chip a customer sees on an order: its step, or Refunded once fully refunded. */
export function orderChip(o: Order): 'ordered' | 'paid' | 'dispatched' | 'delivered' | 'refunded' {
  return isFullyRefunded(o) ? 'refunded' : o.status;
}

export { usdt };
