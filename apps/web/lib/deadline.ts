// The request's deadline (a local clock time such as "20:00" in the story city's
// time zone) as the next moment it happens, and a countdown to it. Code reads the
// deadline from the human's words; this only displays it.

const parts = (date: Date, timeZone: string) => {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
};

// Milliseconds that `timeZone` is ahead of UTC at `date`.
function offsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

export function nextDeadline(now: Date, clock: string, timeZone: string): Date | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  const today = parts(now, timeZone);
  for (let addDays = 0; addDays <= 1; addDays += 1) {
    const guess = Date.UTC(today.year, today.month - 1, today.day + addDays, hour, minute);
    // Use the zone's offset at the target moment (it can differ from now across a DST change).
    const at = new Date(guess - offsetMs(new Date(guess), timeZone));
    if (at.getTime() > now.getTime()) return at;
  }
  return null;
}

export function countdown(ms: number): string {
  if (ms <= 0) return 'now';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s).padStart(2, '0')} s`;
}
