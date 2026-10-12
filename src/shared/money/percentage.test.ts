import { describe, expect, it } from 'vitest';

import { requireDecimalString } from './decimal-string';
import { Money } from './money';
import { InvalidMoneyOperationError } from './money.error';
import { Percentage } from './percentage';

const money = (value: string): Money => Money.parse(requireDecimalString(value));

describe('Percentage.ofMoney', () => {
  it('reads a share of a total at one place', () => {
    expect(Percentage.ofMoney(money('720.00'), money('1000.00'))?.toDecimalString()).toBe('72.0');
    expect(Percentage.ofMoney(money('764.44'), money('1000.00'))?.toDecimalString()).toBe('76.4');
  });

  it('rounds the one place by the same policy as everything else', () => {
    // 76,45% is a tie at the first place and rises.
    expect(Percentage.ofMoney(money('764.50'), money('1000.00'))?.toDecimalString()).toBe('76.5');
    expect(Percentage.ofMoney(money('764.49'), money('1000.00'))?.toDecimalString()).toBe('76.4');
  });

  it('answers null for a whole of zero, not Infinity and not NaN', () => {
    expect(Percentage.ofMoney(money('10.00'), Money.zero())).toBeNull();
    expect(Percentage.ofMoney(Money.zero(), Money.zero())).toBeNull();
  });

  it('is zero per cent when the part is zero, which is a real answer', () => {
    const share = Percentage.ofMoney(Money.zero(), money('1000.00'));

    expect(share?.isZero()).toBe(true);
    expect(share?.toDecimalString()).toBe('0.0');
  });
});

describe('Percentage.ofCounts', () => {
  it('reads a share of a count', () => {
    expect(Percentage.ofCounts(3, 8)?.toDecimalString()).toBe('37.5');
    expect(Percentage.ofCounts(1, 3)?.toDecimalString()).toBe('33.3');
    expect(Percentage.ofCounts(2, 3)?.toDecimalString()).toBe('66.7');
  });

  it('answers null for a whole of zero', () => {
    expect(Percentage.ofCounts(0, 0)).toBeNull();
  });

  it('refuses a count that is not whole', () => {
    expect(() => Percentage.ofCounts(1.5, 3)).toThrow(InvalidMoneyOperationError);
  });
});

describe('Percentage.change', () => {
  it('reads a rise and a fall against the first amount', () => {
    expect(Percentage.change(money('100.00'), money('132.00'))?.toDecimalString()).toBe('32.0');

    const fall = Percentage.change(money('100.00'), money('88.00'));

    expect(fall?.toDecimalString()).toBe('-12.0');
    expect(fall?.isNegative()).toBe(true);
  });

  it('answers null when the month before had nothing to compare against', () => {
    expect(Percentage.change(Money.zero(), money('400.00'))).toBeNull();
  });
});

describe('Percentage comparison and chart value', () => {
  it('compares two percentages', () => {
    const smaller = Percentage.ofCounts(1, 4)!;
    const larger = Percentage.ofCounts(3, 4)!;

    expect(smaller.compare(larger)).toBe(-1);
    expect(larger.compare(smaller)).toBe(1);
    expect(smaller.compare(Percentage.ofCounts(25, 100)!)).toBe(0);
  });

  it('leaves to a number only to position a point', () => {
    expect(Percentage.ofCounts(3, 8)?.toChartValue()).toBe(37.5);
    expect(Percentage.zero().toChartValue()).toBe(0);
  });
});
