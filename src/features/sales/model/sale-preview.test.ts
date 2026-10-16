import { describe, expect, it } from 'vitest';

import { Money, requireDecimalString as dec } from '@/shared/money';
import { Quantity } from '@/shared/quantity';

import { previewLineTotal, previewSale, type PreviewLine } from './sale-preview';

const money = (value: string) => Money.parse(dec(value));
const grams = (value: string) => Quantity.parse(dec(value), 'GRAM');
const pieces = (value: string) => Quantity.parse(dec(value), 'UNIT');

function material(
  packageCost: string,
  packageQuantity: string,
  quantity: string | null,
  marginBasisPoints: number | null,
): PreviewLine {
  return {
    kind: 'MATERIAL',
    packageCost: money(packageCost),
    packageQuantity: grams(packageQuantity),
    marginBasisPoints,
    quantity: quantity === null ? null : grams(quantity),
  };
}

function product(finalPrice: string, quantity: string | null): PreviewLine {
  return {
    kind: 'PRODUCT',
    finalPrice: money(finalPrice),
    quantity: quantity === null ? null : pieces(quantity),
  };
}

/**
 * The vectors are the backend's own: `sale-line-total.spec.ts` and
 * `loose-material-pricing.spec.ts`, repeated with the same inputs and the same
 * expected values. A case that does not match is a disagreement between the
 * two implementations of one rule, not a number to adjust here.
 */
describe('previewLineTotal: a loose material', () => {
  it('multiplies before dividing: 120 g of a R$ 28,00 kilo at cost is R$ 3,36, not R$ 3,60', () => {
    expect(previewLineTotal(material('28.00', '1000', '120', 0))?.toCentsString()).toBe('3.36');
  });

  it('marks the whole package up before pricing the fraction: 50% makes the kilo R$ 42,00', () => {
    // 42.00 x 120 / 1000 = 5.04
    expect(previewLineTotal(material('28.00', '1000', '120', 5000))?.toCentsString()).toBe('5.04');
  });

  it('keeps the cent a per-gram markup would throw away: R$ 10,00 at 35% is R$ 13,50 a kilo', () => {
    // 13.50 x 1000 / 1000
    expect(previewLineTotal(material('10.00', '1000', '1000', 3500))?.toCentsString()).toBe(
      '13.50',
    );
  });

  it('rounds the marked-up package once, half away from zero: R$ 19,99 at 7% is R$ 21,39', () => {
    // 1999 c x 10700 / 10000 = 2138,93 c -> 21.39
    expect(previewLineTotal(material('19.99', '1', '1', 700))?.toCentsString()).toBe('21.39');
  });

  it('marks up by 33,33% without a float in the way: R$ 28,00 becomes R$ 37,33', () => {
    // 2800 c x 13333 / 10000 = 3733,24 c
    expect(previewLineTotal(material('28.00', '1', '1', 3333))?.toCentsString()).toBe('37.33');
  });

  it('prices a fraction of a thousandth exactly: 1,5 kg typed is 1500 g', () => {
    // 28.00 x 1500 / 1000 = 42.00
    expect(previewLineTotal(material('28.00', '1000', '1500', 0))?.toCentsString()).toBe('42.00');
  });

  it('cannot be priced without a margin: empty is never taken as zero', () => {
    expect(previewLineTotal(material('28.00', '1000', '120', null))).toBeNull();
  });

  it('prices a margin of zero, typed on purpose, at cost', () => {
    expect(previewLineTotal(material('28.00', '1000', '1000', 0))?.toCentsString()).toBe('28.00');
  });

  it('cannot be priced without a readable quantity', () => {
    expect(previewLineTotal(material('28.00', '1000', null, 0))).toBeNull();
  });
});

describe('previewLineTotal: a product', () => {
  it('is the practiced price times the pieces', () => {
    expect(previewLineTotal(product('11.27', '3'))?.toCentsString()).toBe('33.81');
  });

  it('rounds half away from zero on an exact tie: 0,25 x 1,14 is 0,29', () => {
    // 0.25 x 1.14 = 0.285 exactly; a float computes 28.499999999999996 cents.
    expect(previewLineTotal(product('0.25', '1.14'))?.toCentsString()).toBe('0.29');
  });

  it('cannot be priced without a readable quantity', () => {
    expect(previewLineTotal(product('11.27', null))).toBeNull();
  });
});

describe('previewSale', () => {
  it('sums the lines after rounding each one: three thirds of R$ 1,00 are R$ 0,99', () => {
    // 1.00 x 1 / 3 for each: the backend's `saleTotal` vector.
    const thirds = [
      material('1.00', '3', '1', 0),
      material('1.00', '3', '1', 0),
      material('1.00', '3', '1', 0),
    ];

    const { lineTotals, total } = previewSale(thirds);

    expect(lineTotals.map((line) => line?.toCentsString())).toEqual(['0.33', '0.33', '0.33']);
    expect(total?.toCentsString()).toBe('0.99');
    // Rounding the exact sum once would give the number the lines above do not add up to.
    expect(money('1.00').scaledToCents(3n, 3n).toCentsString()).toBe('1.00');
  });

  it('adds a product and a loose material', () => {
    const { total } = previewSale([product('11.27', '2'), material('28.00', '1000', '120', 0)]);

    // 22.54 + 3.36
    expect(total?.toCentsString()).toBe('25.90');
  });

  it('has no total while any line cannot be priced, instead of a partial one that looks whole', () => {
    const { lineTotals, total } = previewSale([
      product('11.27', '2'),
      material('28.00', '1000', '120', null),
    ]);

    expect(lineTotals[0]?.toCentsString()).toBe('22.54');
    expect(lineTotals[1]).toBeNull();
    expect(total).toBeNull();
  });

  it('is zero for no lines', () => {
    expect(previewSale([]).total?.isZero()).toBe(true);
  });
});
