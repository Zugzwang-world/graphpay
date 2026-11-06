import type { Money } from '@/demo/contract';

/**
 * Money is a decimal string with two places (DESIGN_INSTRUCTIONS.md 4.3).
 * Arithmetic runs on integer cents so 4.00 - 1.00 never becomes 2.9999.
 */

export function usdt(amount: string | number): Money {
  return { amount: toAmount(toCents(amount)), currency: 'USDT' };
}

export function toCents(v: string | number | Money): number {
  const s = typeof v === 'object' ? v.amount : String(v);
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function toAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function add(...m: Money[]): Money {
  return usdt(toAmount(m.reduce((s, x) => s + toCents(x), 0)));
}

export function sub(a: Money, b: Money): Money {
  return usdt(toAmount(toCents(a) - toCents(b)));
}

export function cmp(a: Money, b: Money): number {
  return toCents(a) - toCents(b);
}

export function isZero(m: Money): boolean {
  return toCents(m) === 0;
}

export const ZERO: Money = { amount: '0.00', currency: 'USDT' };

/** "4.00 USDT" */
export function formatMoney(m: Money | string, opts: { sign?: boolean } = {}): string {
  const amount = typeof m === 'string' ? toAmount(toCents(m)) : toAmount(toCents(m));
  const signed = opts.sign && toCents(amount) > 0 ? `+${amount}` : amount;
  return `${signed} USDT`;
}

/** "4.00" with thousands separators for larger amounts, two decimals always. */
export function formatAmount(m: Money | string): string {
  const cents = toCents(m);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-IN');
  return `${sign}${whole}.${String(abs % 100).padStart(2, '0')}`;
}

export type AmountCheck =
  | { ok: true; value: Money }
  | { ok: false; problem: 'empty' | 'not_a_number' | 'zero' | 'negative' | 'too_many_decimals' | 'above_max'; max?: Money };

/** Validation shared by every AmountEntry (DESIGN_INSTRUCTIONS.md 5e). */
export function checkAmount(input: string, max?: Money): AmountCheck {
  const s = input.trim();
  if (s === '') return { ok: false, problem: 'empty' };
  if (!/^-?\d*\.?\d*$/.test(s) || s === '.' || s === '-') return { ok: false, problem: 'not_a_number' };
  if (/\.\d{3,}$/.test(s)) return { ok: false, problem: 'too_many_decimals' };
  const cents = toCents(s);
  if (Number.isNaN(cents)) return { ok: false, problem: 'not_a_number' };
  if (cents < 0) return { ok: false, problem: 'negative' };
  if (cents === 0) return { ok: false, problem: 'zero' };
  if (max && cents > toCents(max)) return { ok: false, problem: 'above_max', max };
  return { ok: true, value: usdt(toAmount(cents)) };
}
