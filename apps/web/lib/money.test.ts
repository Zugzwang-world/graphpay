import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMicro, formatWei, parseUsdt, toMicro } from './money.ts';

test('micro amounts print with two places at least and never round', () => {
  assert.equal(formatMicro(4_800_000), '4.80');
  assert.equal(formatMicro('400000'), '0.40');
  assert.equal(formatMicro(1_234_567n), '1.234567');
  assert.equal(formatMicro(0), '0.00');
  assert.equal(formatMicro(6_000_000, 0), '6');
});

test('decimal USDT strings parse to exact micro units', () => {
  assert.equal(parseUsdt('4.80'), 4_800_000n);
  assert.equal(parseUsdt('0.000001'), 1n);
  assert.equal(parseUsdt('6'), 6_000_000n);
  for (const bad of ['', '4.8000001', '-1', '1e6', '4,80', ' 4.80', '0x10']) assert.throws(() => parseUsdt(bad), bad);
});

test('only whole, non-negative micro values are accepted', () => {
  assert.equal(toMicro('4800000'), 4_800_000n);
  for (const bad of [-1, 1.5, Number.NaN, '4.8', '-5', '']) assert.throws(() => toMicro(bad as never), String(bad));
});

test('native balances print rounded down to four places', () => {
  assert.equal(formatWei(812_345_678_900_000_000n), '0.8123');
  assert.equal(formatWei('2000000000000000000'), '2.0000');
});
