// USDT amounts: 6 decimals, carried as bigint micro-units ("micro") everywhere in code.

const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);
export const MAX_U64 = (1n << 64n) - 1n;

// '4.80' or 4.8 → 4800000n. Strings are exact; numbers are rounded to 6 decimals.
export function usdt(value) {
  if (typeof value === 'bigint') return value * UNIT;
  const text = typeof value === 'number' ? value.toFixed(DECIMALS) : String(value).trim();
  const m = /^(\d{1,13})(?:\.(\d{0,6}))?$/.exec(text);
  if (!m) throw new Error(`not a USDT amount: ${text.slice(0, 32)}`);
  return BigInt(m[1]) * UNIT + BigInt((m[2] ?? '').padEnd(DECIMALS, '0'));
}

// 4800000n → '4.80' (at least two decimals, trailing zeros beyond that dropped).
export function formatUsdt(micro) {
  const v = BigInt(micro);
  const sign = v < 0n ? '-' : '';
  const abs = v < 0n ? -v : v;
  const whole = abs / UNIT;
  let frac = (abs % UNIT).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  if (frac.length < 2) frac = frac.padEnd(2, '0');
  return `${sign}${whole}.${frac}`;
}

// A micro amount from a bigint, a safe integer or a decimal-digit string; never negative, at most uint64.
export function toMicro(value, what = 'amount') {
  let v;
  if (typeof value === 'bigint') v = value;
  else if (typeof value === 'number' && Number.isSafeInteger(value)) v = BigInt(value);
  else if (typeof value === 'string' && /^(0|[1-9]\d{0,19})$/.test(value)) v = BigInt(value);
  else throw new Error(`${what} must be an integer number of micro-USDT`);
  if (v < 0n || v > MAX_U64) throw new Error(`${what} is out of range`);
  return v;
}
