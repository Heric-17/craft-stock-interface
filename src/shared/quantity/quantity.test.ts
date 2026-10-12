import { describe, expect, it } from 'vitest';

import { requireDecimalString } from '@/shared/money/decimal-string';
import { InvalidQuantityOperationError } from '@/shared/money/money.error';

import { CONSUMPTION_UNITS, isConsumptionUnit, majorUnitFactor } from './consumption-unit';
import { Quantity } from './quantity';

const parse = (value: string, unit: Parameters<typeof Quantity.parse>[1] = 'GRAM'): Quantity =>
  Quantity.parse(requireDecimalString(value), unit);

/**
 * The frontier. A quantity arrives as a `number`, which is the one place the
 * API treats a fractional value differently from money, and these are the
 * vectors that pin the conversion: each value has to come back as the same
 * decimal it went in as, including the maximum the column holds.
 */
describe('Quantity.fromApi', () => {
  it.each([
    [2.5, '2.500'],
    [0.145, '0.145'],
    [1500.001, '1500.001'],
    [0, '0.000'],
    [999_999_999.999, '999999999.999'],
    [-2.5, '-2.500'],
  ])('reads %p as %p and serialises it back unchanged', (value, decimal) => {
    const quantity = Quantity.fromApi(value, 'GRAM');

    expect(quantity.toDecimalString()).toBe(decimal);
    expect(quantity.toApiNumber()).toBe(value);
  });

  it('reads the digits rather than multiplying, which is where 0,145 is lost', () => {
    // 0.145 arrives as 0.14499999999999999; multiplying by 1000 gives
    // 144.99999999999997, and truncating that loses a thousandth on every
    // line that has one.
    expect(Quantity.fromApi(0.145, 'GRAM').toScaledUnits()).toBe(145n);
    expect(Quantity.fromApi(0.1 + 0.2, 'GRAM').toScaledUnits()).toBe(300n);
  });

  /**
   * A fourth place cannot reach here from the API — the columns are
   * `Decimal(12,3)` and the input DTOs validate three places — so what this
   * pins is that the extra digit is dropped by reading the value's exact
   * decimal expansion, not by inventing a digit. `0.1445` is held as a double
   * slightly below the tie and goes down; `0.1446` is above it and goes up.
   * Which side of a tie an out-of-contract value falls on is decided by the
   * value, which is the point: nothing is fabricated.
   */
  it('drops a fourth place the contract does not carry', () => {
    expect(Quantity.fromApi(0.1446, 'GRAM').toDecimalString()).toBe('0.145');
    expect(Quantity.fromApi(0.1444, 'GRAM').toDecimalString()).toBe('0.144');
    expect(Quantity.fromApi(0.1445, 'GRAM').toDecimalString()).toBe('0.144');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'refuses %p, which is not a quantity',
    (value) => {
      expect(() => Quantity.fromApi(value, 'GRAM')).toThrow(InvalidQuantityOperationError);
    },
  );

  it('refuses a value too large to have a plain decimal form', () => {
    expect(() => Quantity.fromApi(1e21, 'GRAM')).toThrow(InvalidQuantityOperationError);
  });
});

describe('Quantity.parse', () => {
  it('reads a quantity written as a decimal string', () => {
    expect(parse('120').toDecimalString()).toBe('120.000');
    expect(parse('0.145').toScaledUnits()).toBe(145n);
  });

  it('refuses a number, which goes through fromApi', () => {
    expect(() =>
      Quantity.parse(120 as unknown as ReturnType<typeof requireDecimalString>, 'GRAM'),
    ).toThrow(InvalidQuantityOperationError);
  });
});

/**
 * The larger unit exists only on this side. Someone types "1,5 kg" and 1500 in
 * `GRAM` is what travels.
 */
describe('Quantity.fromMajorUnit', () => {
  it('turns 1,5 kg into 1500 g', () => {
    const quantity = Quantity.fromMajorUnit(requireDecimalString('1.5'), 'GRAM');

    expect(quantity.toDecimalString()).toBe('1500.000');
    expect(quantity.toApiNumber()).toBe(1500);
    expect(quantity.unit).toBe('GRAM');
  });

  it('turns 1,5 L into 1500 ml and 1,5 m into 150 cm', () => {
    expect(Quantity.fromMajorUnit(requireDecimalString('1.5'), 'MILLILITER').toApiNumber()).toBe(
      1500,
    );
    expect(Quantity.fromMajorUnit(requireDecimalString('1.5'), 'CENTIMETER').toApiNumber()).toBe(
      150,
    );
  });

  it('leaves UNIT alone, having no larger unit', () => {
    expect(Quantity.fromMajorUnit(requireDecimalString('8'), 'UNIT').toApiNumber()).toBe(8);
  });

  it('keeps every digit a person can usefully type', () => {
    expect(Quantity.fromMajorUnit(requireDecimalString('0.0001'), 'GRAM').toDecimalString()).toBe(
      '0.100',
    );
  });
});

describe('Quantity arithmetic', () => {
  it('adds and subtracts within one unit', () => {
    expect(parse('680').plus(parse('760')).toDecimalString()).toBe('1440.000');
    expect(parse('1440').minus(parse('760')).toDecimalString()).toBe('680.000');
    expect(
      Quantity.sum([parse('0.145'), parse('0.145'), parse('0.145')], 'GRAM').toApiNumber(),
    ).toBe(0.435);
  });

  it('refuses to add quantities in different units, which is not a conversion the system does', () => {
    expect(() => parse('100').plus(parse('100', 'MILLILITER'))).toThrow(
      InvalidQuantityOperationError,
    );
  });

  it('compares and recognises zero and negative', () => {
    expect(parse('100').compare(parse('200'))).toBe(-1);
    expect(parse('200').compare(parse('100'))).toBe(1);
    expect(parse('100').compare(parse('100.000'))).toBe(0);
    expect(Quantity.zero('GRAM').isZero()).toBe(true);
    expect(parse('-1').isNegative()).toBe(true);
  });

  it('hands an exact integer to Money, so no line cost goes through a number', () => {
    expect(parse('120').toScaledUnits()).toBe(120_000n);
  });
});

describe('consumption units', () => {
  it('knows the four the API sends and nothing else', () => {
    expect(CONSUMPTION_UNITS).toEqual(['UNIT', 'GRAM', 'MILLILITER', 'CENTIMETER']);
    expect(isConsumptionUnit('GRAM')).toBe(true);
    expect(isConsumptionUnit('KILOGRAM')).toBe(false);
  });

  it('knows how many base units make the larger one', () => {
    expect(majorUnitFactor('GRAM')).toBe(1000);
    expect(majorUnitFactor('MILLILITER')).toBe(1000);
    expect(majorUnitFactor('CENTIMETER')).toBe(100);
    expect(majorUnitFactor('UNIT')).toBe(1);
  });
});
