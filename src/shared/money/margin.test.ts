import { describe, expect, it } from 'vitest';

import { requireDecimalString } from './decimal-string';
import {
  applyMargin,
  basisPointsFromDecimalString,
  isBasisPoints,
  MAX_MARGIN_BASIS_POINTS,
} from './margin';
import { Money } from './money';
import { InvalidMoneyOperationError } from './money.error';
import { MARGIN_VECTORS } from './rounding-vectors';

const money = (value: string): Money => Money.parse(requireDecimalString(value));

describe('applyMargin', () => {
  it.each(MARGIN_VECTORS)(
    '$amount at $basisPoints bp = $result ($note)',
    ({ amount, basisPoints, result }) => {
      expect(applyMargin(money(amount), basisPoints).toCentsString()).toBe(result);
    },
  );

  it('marks up at the largest margin the column holds', () => {
    expect(applyMargin(money('0.01'), MAX_MARGIN_BASIS_POINTS).toCentsString()).toBe('0.11');
  });

  /**
   * The backend sweeps every margin the column can hold against an oracle in
   * plain integers. The same oracle here, on a sample of the range: what it
   * catches is a factor built in floating point, which fails on the ties.
   */
  it('agrees with exact integer arithmetic across the range', () => {
    const costsInCents = [1, 3, 7, 25, 99, 125, 250, 490, 1001, 12_345, 99_999, 123_457];
    let compared = 0;

    for (let basisPoints = 0; basisPoints <= MAX_MARGIN_BASIS_POINTS; basisPoints += 7) {
      for (const cents of costsInCents) {
        const amount = money(centsToDecimal(cents));
        const expected = (2n * BigInt(cents) * BigInt(10_000 + basisPoints) + 10_000n) / 20_000n;

        expect(applyMargin(amount, basisPoints).toCentsString()).toBe(
          centsToDecimal(Number(expected)),
        );
        compared += 1;
      }
    }

    expect(compared).toBeGreaterThan(100_000);
  });

  it.each([-1, 33.33, 100_000, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %p, which is not a whole number of basis points the column holds',
    (basisPoints) => {
      expect(() => applyMargin(money('1.00'), basisPoints)).toThrow(InvalidMoneyOperationError);
    },
  );
});

describe('basisPointsFromDecimalString', () => {
  it.each([
    ['33.33', 3333],
    ['35', 3500],
    ['0.5', 50],
    ['0', 0],
    ['100', 10_000],
    ['999.99', 99_999],
  ])('reads %p as %i basis points', (value, expected) => {
    expect(basisPointsFromDecimalString(value)).toBe(expected);
  });

  it('rounds a third place to the two the field holds', () => {
    expect(basisPointsFromDecimalString('33.335')).toBe(3334);
  });

  it.each(['1000', '-5', '', 'abc', '1e3'])('refuses %p', (value) => {
    expect(basisPointsFromDecimalString(value)).toBeNull();
  });
});

describe('isBasisPoints', () => {
  it('accepts the whole range the column holds and nothing else', () => {
    expect(isBasisPoints(0)).toBe(true);
    expect(isBasisPoints(MAX_MARGIN_BASIS_POINTS)).toBe(true);
    expect(isBasisPoints(MAX_MARGIN_BASIS_POINTS + 1)).toBe(false);
    expect(isBasisPoints(-1)).toBe(false);
    expect(isBasisPoints(3333.5)).toBe(false);
  });
});

function centsToDecimal(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);

  return `${negative ? '-' : ''}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
