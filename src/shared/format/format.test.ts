import { describe, expect, it } from 'vitest';

import { Money, Percentage, requireDecimalString } from '@/shared/money';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import { NON_BREAKING_SPACE } from './decimal';
import { formatMoney, formatUnitCost } from './money';
import { formatBasisPoints, formatMarginPercent, formatPercent } from './percent';
import { formatQuantity } from './quantity';

const money = (value: string): Money => Money.parse(requireDecimalString(value));
const quantity = (value: string, unit: ConsumptionUnit): Quantity =>
  Quantity.parse(requireDecimalString(value), unit);

/** The space the formatters join a figure to its symbol with. */
const SPACE = NON_BREAKING_SPACE;

describe('formatMoney', () => {
  it('writes a closed amount in pt-BR, grouped, with both cents', () => {
    expect(formatMoney(money('1284.70'))).toBe(`R$${SPACE}1.284,70`);
    expect(formatMoney(money('3.36'))).toBe(`R$${SPACE}3,36`);
    expect(formatMoney(money('0.10'))).toBe(`R$${SPACE}0,10`);
    expect(formatMoney(Money.zero())).toBe(`R$${SPACE}0,00`);
  });

  it('groups every thousand', () => {
    expect(formatMoney(money('1234567.89'))).toBe(`R$${SPACE}1.234.567,89`);
    expect(formatMoney(money('1000.00'))).toBe(`R$${SPACE}1.000,00`);
  });

  it('puts the sign before the symbol, as pt-BR writes it', () => {
    expect(formatMoney(money('-3.45'))).toBe(`-R$${SPACE}3,45`);
  });

  it('joins the symbol to the amount with a space that does not break', () => {
    // At 360px a figure that wraps reads as two different things.
    expect(formatMoney(money('1.00'))).not.toContain(' ');
    expect(formatMoney(money('1.00'))).toContain(SPACE);
  });

  it('rounds an amount finer than a cent to the cent, once', () => {
    expect(formatMoney(money('0.1250'))).toBe(`R$${SPACE}0,13`);
    expect(formatMoney(money('0.1240'))).toBe(`R$${SPACE}0,12`);
    expect(formatMoney(money('-0.1250'))).toBe(`-R$${SPACE}0,13`);
  });

  it('does not write a sign on an amount that rounds to zero', () => {
    expect(formatMoney(money('-0.0010'))).toBe(`R$${SPACE}0,00`);
  });
});

/**
 * The reason `formatUnitCost` exists: `R$ 0,04/g` overstates a gram of flour
 * by 43% and `R$ 0,03/g` understates the kilo by two reais. Per kilo the same
 * figure is exact.
 */
describe('formatUnitCost', () => {
  it.each([
    ['0.0280', 'GRAM', `R$${SPACE}28,00/kg`],
    ['0.0380', 'MILLILITER', `R$${SPACE}38,00/L`],
    ['0.0420', 'CENTIMETER', `R$${SPACE}4,20/m`],
    ['0.1600', 'UNIT', `R$${SPACE}0,16/un`],
    ['0.1625', 'UNIT', `R$${SPACE}0,1625/un`],
  ] as const)('writes %p per %s as %p', (value, unit, expected) => {
    expect(formatUnitCost(money(value), unit)).toBe(expected);
  });

  it('keeps two places at least and four at most, with no trailing zeros', () => {
    expect(formatUnitCost(money('0.1620'), 'UNIT')).toBe(`R$${SPACE}0,162/un`);
    expect(formatUnitCost(money('0.1000'), 'UNIT')).toBe(`R$${SPACE}0,10/un`);
  });

  it('never shows the base unit, whose rounding is the error', () => {
    expect(formatUnitCost(money('0.0280'), 'GRAM')).not.toContain('/g');
  });

  it('groups and signs a large or negative unit cost', () => {
    expect(formatUnitCost(money('1.2345'), 'GRAM')).toBe(`R$${SPACE}1.234,50/kg`);
    expect(formatUnitCost(money('-0.0280'), 'GRAM')).toBe(`-R$${SPACE}28,00/kg`);
  });
});

describe('formatQuantity', () => {
  it.each([
    ['680', 'GRAM', `680${SPACE}g`],
    ['120', 'MILLILITER', `120${SPACE}ml`],
    ['1440', 'GRAM', `1,44${SPACE}kg`],
    ['8', 'UNIT', `8${SPACE}un`],
    ['999', 'GRAM', `999${SPACE}g`],
    ['1000', 'GRAM', `1${SPACE}kg`],
    ['2500', 'MILLILITER', `2,5${SPACE}L`],
    ['150', 'CENTIMETER', `150${SPACE}cm`],
    ['1000', 'CENTIMETER', `10${SPACE}m`],
    ['0.145', 'GRAM', `0,145${SPACE}g`],
    ['0', 'GRAM', `0${SPACE}g`],
  ] as const)('writes %p %s as %p', (value, unit, expected) => {
    expect(formatQuantity(quantity(value, unit))).toBe(expected);
  });

  it('keeps three places at most in the larger unit', () => {
    expect(formatQuantity(quantity('1000.001', 'GRAM'))).toBe(`1${SPACE}kg`);
    expect(formatQuantity(quantity('1234.567', 'GRAM'))).toBe(`1,235${SPACE}kg`);
  });

  it('with exact, keeps the larger unit only when nothing is lost to the rounding', () => {
    // The echo under a field must never show a gram more or less than was typed.
    expect(formatQuantity(quantity('1234.567', 'GRAM'), { exact: true })).toBe(
      `1.234,567${SPACE}g`,
    );
    expect(formatQuantity(quantity('1500.5', 'GRAM'), { exact: true })).toBe(`1.500,5${SPACE}g`);
    expect(formatQuantity(quantity('1500', 'GRAM'), { exact: true })).toBe(`1,5${SPACE}kg`);
    expect(formatQuantity(quantity('1234567', 'GRAM'), { exact: true })).toBe(
      `1.234,567${SPACE}kg`,
    );
    expect(formatQuantity(quantity('2500', 'MILLILITER'), { exact: true })).toBe(`2,5${SPACE}L`);
    expect(formatQuantity(quantity('1050', 'CENTIMETER'), { exact: true })).toBe(`10,5${SPACE}m`);
    expect(formatQuantity(quantity('1000.001', 'CENTIMETER'), { exact: true })).toBe(
      `1.000,001${SPACE}cm`,
    );
  });

  it('keeps UNIT in units at every size, because there is no larger one', () => {
    expect(formatQuantity(quantity('1500', 'UNIT'))).toBe(`1.500${SPACE}un`);
  });

  it('always carries the unit, because a number alone means nothing here', () => {
    for (const unit of ['UNIT', 'GRAM', 'MILLILITER', 'CENTIMETER'] as const) {
      expect(formatQuantity(quantity('12', unit))).toMatch(/[a-z]$/i);
    }
  });

  it('signs a negative quantity', () => {
    expect(formatQuantity(quantity('-250', 'GRAM'))).toBe(`-250${SPACE}g`);
  });
});

describe('formatPercent', () => {
  it('writes a share at one place', () => {
    expect(formatPercent(Percentage.ofCounts(764, 1000)!)).toBe('76,4%');
    expect(formatPercent(Percentage.zero())).toBe('0,0%');
  });

  it('writes a fall with its sign', () => {
    expect(formatPercent(Percentage.change(money('100.00'), money('88.00'))!)).toBe('-12,0%');
  });
});

describe('formatBasisPoints', () => {
  it.each([
    [3333, '33,33'],
    [3500, '35'],
    [50, '0,5'],
    [0, '0'],
    [10_000, '100'],
    [99_999, '999,99'],
  ])('writes %i basis points as %p', (basisPoints, expected) => {
    expect(formatBasisPoints(basisPoints)).toBe(expected);
  });

  it('never shows anyone a number of basis points', () => {
    expect(formatMarginPercent(3333)).toBe('33,33%');
    expect(formatMarginPercent(3333)).not.toContain('3333');
  });
});
