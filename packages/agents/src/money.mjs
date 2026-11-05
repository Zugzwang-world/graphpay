// Money is a decimal string at the edges and a bigint of 6-decimal units inside,
// never a float (planning/SPEC/AGENTS.md §6: `Number('4.80') * 1e6` rounds wrong).

export const DECIMALS = 6;
export const UNIT = 1_000_000n;
// At most 12 whole digits: far above any budget here, and it keeps parsing cheap.
export const USDT_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;
const MICRO_PATTERN = /^\d{1,19}$/;

export function isUsdt(text) {
  return typeof text === 'string' && USDT_PATTERN.test(text);
}

// "4.8" → 4800000n. Throws on anything that is not a plain decimal string.
export function toMicro(text) {
  if (!isUsdt(text)) throw new TypeError('not a USDT amount (digits, at most 6 decimals)');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(DECIMALS, '0'));
}

// A micro amount from the wire or the config: a bigint, a safe integer or a digit string.
export function microFrom(value) {
  if (typeof value === 'bigint') {
    if (value < 0n) throw new RangeError('a micro amount cannot be negative');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('a micro amount must be a whole, safe, non-negative number');
    return BigInt(value);
  }
  if (typeof value === 'string' && MICRO_PATTERN.test(value)) return BigInt(value);
  throw new TypeError('not a micro amount');
}

// 4800000n → "4.800000" (the canonical form, as in the mandate).
export function fromMicro(micro) {
  const value = microFrom(micro);
  return `${value / UNIT}.${(value % UNIT).toString().padStart(DECIMALS, '0')}`;
}

// 4800000n → "4.80": at least two decimals, trailing zeros past them dropped.
export function displayUsdt(micro) {
  const [whole, fraction] = fromMicro(micro).split('.');
  return `${whole}.${fraction.replace(/0+$/, '').padEnd(2, '0')}`;
}
