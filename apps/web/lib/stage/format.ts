// Small formatting rules shared by the stage and the phones: money as the phones show it, an order
// as "Order #4B28" (never a raw hash), a link's age from its own timestamp, a time in the city's zone.

export function usdt(amount: string | number | null | undefined): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

export function microUsdt(micro: string | number | bigint | null | undefined): string {
  if (micro === null || micro === undefined || micro === '') return '';
  const n = Number(micro) / 1e6;
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

export function percent(rate: number | null | undefined, places = 1): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '';
  const p = rate * 100;
  return `${p.toFixed(p >= 10 || places === 0 ? 0 : places)}%`;
}

// "#4378" from an order id (its first four hex digits after 0x, upper case).
export function orderNumber(orderId: string | null | undefined): string {
  return orderId && /^0x[0-9a-fA-F]{4}/.test(orderId) ? `#${orderId.slice(2, 6).toUpperCase()}` : '';
}

// "12 s ago", "3 min ago", "2 h ago" from a timestamp in ms.
export function ago(at: number | null | undefined, now: number): string {
  if (at === null || at === undefined || !Number.isFinite(at)) return '';
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

// "03:26" in the city's time zone.
export function clock(iso: string | number | null | undefined, timeZone: string): string {
  if (iso === null || iso === undefined) return '';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
}

// The first label of an ENS name ("payer" for payer.person.example.eth).
export const firstLabel = (ens: string): string => ens.split('.')[0] ?? ens;

export const HASH = /^0x[0-9a-fA-F]{64}$/;
