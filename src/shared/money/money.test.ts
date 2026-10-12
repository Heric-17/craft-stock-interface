import { describe, expect, it } from 'vitest';

import { requireDecimalString } from './decimal-string';
import { Money } from './money';
import { InvalidMoneyOperationError } from './money.error';
import { FRACTIONAL_AMOUNT_VECTORS, PARSE_VECTORS, SCALED_VECTORS } from './rounding-vectors';

const money = (value: string): Money => Money.parse(requireDecimalString(value));

describe('Money.parse', () => {
  it('reads a closed amount, with its two places', () => {
    expect(money('19.90').toDecimalString()).toBe('19.9000');
    expect(money('19.90').toCentsString()).toBe('19.90');
  });

  it('reads a display unit cost, with its four places', () => {
    expect(money('0.0280').toDecimalString()).toBe('0.0280');
  });

  it('reads an amount with no fractional part', () => {
    expect(money('42').toCentsString()).toBe('42.00');
  });

  it('reads a negative amount', () => {
    expect(money('-3.45').toCentsString()).toBe('-3.45');
    expect(money('-3.45').isNegative()).toBe(true);
  });

  it('refuses a number, which has already lost whatever it lost', () => {
    expect(() => Money.parse(0.1 as unknown as ReturnType<typeof requireDecimalString>)).toThrow(
      InvalidMoneyOperationError,
    );
    expect(() => Money.parse(10 as unknown as ReturnType<typeof requireDecimalString>)).toThrow(
      /never a number/,
    );
  });

  it.each(['not-a-number', '1.2.3', '', '1e3', '.5', '1.', '+1', '1,5', ' 1.5 '])(
    'refuses %p, which is not a decimal amount',
    (value) => {
      expect(() => requireDecimalString(value)).toThrow(InvalidMoneyOperationError);
    },
  );

  it('refuses a fifth decimal place instead of rounding it away in silence', () => {
    // The API sends two places or four. A fifth is a contract change, and
    // rounding it here would leave a plausible number on screen with no sign
    // that anything moved.
    expect(() => requireDecimalString('0.00005')).toThrow(InvalidMoneyOperationError);
  });
});

describe('Money arithmetic', () => {
  it('adds and subtracts exactly', () => {
    expect(money('10.00').plus(money('3.33')).toCentsString()).toBe('13.33');
    expect(money('10.00').minus(money('3.33')).toCentsString()).toBe('6.67');
  });

  it('sums ten ten-cent amounts to exactly one real', () => {
    const dimes = Array.from({ length: 10 }, () => money('0.10'));

    expect(Money.sum(dimes).toCentsString()).toBe('1.00');
    expect(Money.sum(dimes).toDecimalString()).toBe('1.0000');
  });

  it('sums nothing to zero', () => {
    expect(Money.sum([]).isZero()).toBe(true);
  });

  it('keeps a fraction of a cent alive that a chained divide would destroy', () => {
    const packageCost = money('28.00');

    expect(packageCost.scaledToCents(120, 1000).toCentsString()).toBe('3.36');
    // What dividing first produces, for contrast: the per-unit cost rounded to
    // the cent before it was ever multiplied.
    expect(packageCost.scaledToCents(1, 1000).scaledToCents(120, 1).toCentsString()).toBe('3.60');
  });

  it('multiplies before dividing', () => {
    expect(money('10.00').scaledToCents(1, 3).toCentsString()).toBe('3.33');
    expect(money('10.00').scaledToCents(3, 3).toCentsString()).toBe('10.00');
  });

  it('takes an exact integer multiplier as a bigint, which is what a Quantity hands over', () => {
    // 120 g of a 1 kg bag, with the quantity in thousandths of a gram.
    expect(money('28.00').scaledToCents(120_000n, 1_000_000n).toCentsString()).toBe('3.36');
  });

  it('is not thrown off by binary fuzz on a multiplier', () => {
    expect(
      money('5.00')
        .scaledToCents(0.1 + 0.2, 1)
        .toCentsString(),
    ).toBe('1.50');
  });

  it('leaves the original untouched', () => {
    const original = money('28.00');
    original.scaledToCents(120, 1000);

    expect(original.toCentsString()).toBe('28.00');
  });

  it('refuses a non-finite multiplier or divisor', () => {
    expect(() => money('1.00').scaled(Number.NaN, 1)).toThrow(InvalidMoneyOperationError);
    expect(() => money('1.00').scaled(Number.POSITIVE_INFINITY, 1)).toThrow(
      InvalidMoneyOperationError,
    );
    expect(() => money('1.00').scaled(1, Number.NaN)).toThrow(InvalidMoneyOperationError);
  });

  it('refuses a divisor of zero, and one that is zero at six decimal places', () => {
    expect(() => money('1.00').scaled(1, 0)).toThrow(InvalidMoneyOperationError);
    expect(() => money('1.00').scaled(1, 1e-9)).toThrow(InvalidMoneyOperationError);
  });

  it('compares and recognises zero', () => {
    expect(money('1.00').compare(money('2.00'))).toBe(-1);
    expect(money('2.00').compare(money('1.00'))).toBe(1);
    expect(money('1.00').compare(money('1.0000'))).toBe(0);
    expect(money('1.00').equals(money('1.00'))).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
  });
});

/**
 * Four places is what makes a fractional cost readable, and this is the
 * conversion that depends on it being exact: a gram of flour shown per kilo.
 */
describe('Money at four places', () => {
  it('converts a per-gram cost to a per-kilo cost with no rounding at all', () => {
    expect(money('0.0280').times(1000).toDecimalString()).toBe('28.0000');
  });

  it('keeps the fourth place a closed amount would have lost', () => {
    expect(money('0.1625').toDecimalString()).toBe('0.1625');
    expect(money('0.1625').roundToCents().toDecimalString()).toBe('0.1600');
  });
});

/**
 * The rounding policy as a contract. Ported from the backend; see
 * `rounding-vectors.ts` for where each case comes from and why no expected
 * value here may be adjusted.
 */
describe('Money rounding policy', () => {
  it.each(SCALED_VECTORS)(
    'scaled to the cent: $amount x $multiplier / $divisor = $result ($note)',
    ({ amount, multiplier, divisor, result }) => {
      expect(money(amount).scaledToCents(multiplier, divisor).toCentsString()).toBe(result);
    },
  );

  it.each(PARSE_VECTORS)('read to the cent: $input = $cents', ({ input, cents }) => {
    expect(money(input).roundToCents().toCentsString()).toBe(cents);
  });

  it.each(FRACTIONAL_AMOUNT_VECTORS)(
    'four places: $amount / $divisor = $result ($note)',
    ({ amount, divisor, result }) => {
      expect(money(amount).scaled(1, divisor).toDecimalString()).toBe(result);
    },
  );

  /**
   * Every exact tie reachable with a three-decimal quantity, against an oracle
   * written in plain integers. The backend runs the same sweep; a float
   * implementation fails a few per cent of these.
   */
  it('decides every exact tie by the rule, never by the float representation', () => {
    let ties = 0;

    for (const cents of [1, 5, 10, 25, 99, 100, 250, 1234, 2800]) {
      for (const divisor of [1, 2, 4, 8, 20, 40, 1000]) {
        for (let milli = 1; milli <= 3000; milli += 1) {
          const numerator = 2 * cents * milli;
          const denominator = divisor * 1000;

          if (numerator % denominator !== 0 || (numerator / denominator) % 2 === 0) {
            continue;
          }

          ties += 1;
          const expected = Math.floor((cents * milli) / denominator) + 1;
          const amount = money(
            `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`,
          );

          expect(amount.scaledToCents(milli / 1000, divisor).toCentsString()).toBe(
            centsToString(expected),
          );
          expect(amount.scaledToCents(-milli / 1000, divisor).toCentsString()).toBe(
            `-${centsToString(expected)}`,
          );
        }
      }
    }

    expect(ties).toBeGreaterThan(2000);
  });

  it('rounds to the cent in one step, never through four places first', () => {
    // 99 cents over a 0,200 package, one thousandth consumed: exactly 0,495 of
    // a cent, which rounds down to nothing. Rounding at four places first
    // would make it 0,0050 and then a whole cent.
    expect(money('0.99').scaledToCents(1n, 200n).toCentsString()).toBe('0.00');
    expect(money('0.99').scaled(1n, 200n).toDecimalString()).toBe('0.0050');
  });
});

describe('Money.toChartValue', () => {
  it('is the one way out to a number, for positioning a bar', () => {
    expect(money('1284.70').toChartValue()).toBe(1284.7);
    expect(money('0.0280').toChartValue()).toBe(0.028);
  });
});

function centsToString(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
