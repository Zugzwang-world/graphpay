import { describe, expect, it } from 'vitest';
import { checkAmount, usdt } from './money';

describe('amount entry limits', () => {
  const max = usdt('4.00');

  it('accepts a valid partial or exact full amount', () => {
    expect(checkAmount('1.25', max)).toEqual({ ok: true, value: usdt('1.25') });
    expect(checkAmount('4.00', max)).toEqual({ ok: true, value: max });
  });

  it.each([
    ['', 'empty'],
    ['nope', 'not_a_number'],
    ['0', 'zero'],
    ['-1', 'negative'],
    ['1.234', 'too_many_decimals'],
    ['4.01', 'above_max'],
  ])('refuses %j with %s', (input, problem) => {
    expect(checkAmount(input, max)).toMatchObject({ ok: false, problem });
  });
});
