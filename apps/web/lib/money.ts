// Money is a decimal string at the edges and a bigint of 6-decimal units inside,
// never a float (planning/SPEC/AGENTS.md §6).

const DECIMALS = 6n;
const UNIT = 10n ** DECIMALS;
const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;
const INTEGER = /^\d{1,24}$/;

export function parseUsdt(text: string): bigint {
  if (!DECIMAL.test(text)) throw new Error('not a USDT amount');
  const [whole = '0', fraction = ''] = text.split('.');
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(Number(DECIMALS), '0'));
}

export function toMicro(value: bigint | number | string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('not a micro amount');
    return BigInt(value);
  }
  if (!INTEGER.test(value)) throw new Error('not a micro amount');
  return BigInt(value);
}

// 4800000 → "4.80"; 1234567 → "1.234567". At least `minDecimals`, never rounded.
export function formatMicro(value: bigint | number | string, minDecimals = 2): string {
  const micro = toMicro(value);
  const whole = micro / UNIT;
  let fraction = (micro % UNIT).toString().padStart(Number(DECIMALS), '0').replace(/0+$/, '');
  if (fraction.length < minDecimals) fraction = fraction.padEnd(minDecimals, '0');
  return fraction === '' ? whole.toString() : `${whole}.${fraction}`;
}

// Native balances (18 decimals) for chips: "0.8123" with four places, rounded down.
export function formatWei(value: bigint | string, places = 4): string {
  const wei = typeof value === 'bigint' ? value : BigInt(value);
  const unit = 10n ** 18n;
  const scale = 10n ** BigInt(places);
  const scaled = (wei * scale) / unit;
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(places, '0');
  return places === 0 ? whole.toString() : `${whole}.${fraction}`;
}
