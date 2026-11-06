import type { Money, Renewal, RenewalFrequency, RenewalSchedule, SpendingPass } from '@/demo/contract';
import { cmp } from '@/lib/money';
import { isSameCityDay } from '@/lib/time';

export function renewalSchedule(frequency: RenewalFrequency, startDate: string, weekday: number, dayOfMonth: number): RenewalSchedule {
  if (frequency === 'weekly' || frequency === 'biweekly') return { frequency, startDate, weekday };
  if (frequency === 'monthly') return { frequency, startDate, dayOfMonth };
  return { frequency, startDate };
}

/** A future charge is checked against the cap for one period, not today's usage. */
export function fitsRenewalPass(amount: Money, pass?: SpendingPass): boolean {
  return Boolean(pass && cmp(amount, pass.cap) <= 0);
}

export function customerRenewalSections(renewals: Renewal[], ownerEns: string) {
  const mine = renewals.filter((renewal) => renewal.owner.ens === ownerEns);
  return {
    current: mine.filter((renewal) => renewal.status !== 'cancelled').sort((a, b) => (a.status === 'skipped' ? -1 : a.nextChargeAt ?? Infinity) - (b.status === 'skipped' ? -1 : b.nextChargeAt ?? Infinity)),
    cancelled: mine.filter((renewal) => renewal.status === 'cancelled').sort((a, b) => b.createdAt - a.createdAt),
  };
}

export function merchantRenewalSections(renewals: Renewal[], shopEns: string, now: number) {
  const shop = renewals.filter((renewal) => renewal.shop.ens === shopEns);
  const current = shop.filter((renewal) => renewal.status !== 'cancelled');
  const chargedToday = current.filter((renewal) => renewal.charges.at(-1)?.at && isSameCityDay(renewal.charges.at(-1)!.at, now));
  const rest = current.filter((renewal) => !chargedToday.includes(renewal));
  const byNext = (a: Renewal, b: Renewal) => (a.status === 'skipped' ? -1 : a.nextChargeAt ?? Infinity) - (b.status === 'skipped' ? -1 : b.nextChargeAt ?? Infinity);
  return {
    chargedToday: chargedToday.sort(byNext),
    current: rest.sort(byNext),
    cancelled: shop.filter((renewal) => renewal.status === 'cancelled').sort((a, b) => b.createdAt - a.createdAt),
  };
}
