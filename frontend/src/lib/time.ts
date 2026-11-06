import { story } from '@/data/story';

/** Every displayed time uses the city's time zone (DESIGN_INSTRUCTIONS.md 4.3). */
const tz = story.city.timeZone;

export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(ms);
}

export function formatTimeWithZone(ms: number): string {
  return `${formatTime(ms)} ${story.city.timeZoneLabel}`;
}

/** "Sun 9 Nov" */
export function formatShortDate(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`;
}

/** "6 Nov 2026" */
export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
}

/** "6 Nov, 8:41 pm" */
export function formatDateTime(ms: number): string {
  return `${new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short' }).format(ms)}, ${formatTime(ms)}`;
}

/** YYYY-MM-DD in the city's time zone. */
export function isoDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

export function isSameCityDay(a: number, b: number): boolean {
  return isoDate(a) === isoDate(b);
}

/** "14:52" for a countdown. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Weekday (0 = Sunday) of a timestamp in the city's time zone. */
export function cityWeekday(ms: number): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(ms);
  return WEEKDAYS_SHORT.indexOf(name as (typeof WEEKDAYS_SHORT)[number]);
}
