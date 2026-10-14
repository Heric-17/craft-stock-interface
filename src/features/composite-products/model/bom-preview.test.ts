import { describe, expect, it } from 'vitest';

import { Money, requireDecimalString } from '@/shared/money';
import {
  PRICING_CASES,
  WRONG_ORDER_CASES,
  type PricingCase,
} from '@/shared/money/pricing-formula-cases';
import { Quantity } from '@/shared/quantity';

import { previewPricing, type PricingDraft } from './bom-preview';

/**
 * The preview against the document it is specified by, case by case.
 *
 * The cases are the table of `pricing-formula.md` section 5, transcribed once
 * in `shared/money/pricing-formula-cases.ts` and repeated here without
 * adapting an expected value. A case that does not match is a divergence of
 * arithmetic between the two sides, and the number in the test is not the
 * thing to change.
 */

function money(value: string): Money {
  return Money.parse(requireDecimalString(value));
}

function quantity(value: string): Quantity {
  return Quantity.parse(requireDecimalString(value), 'GRAM');
}

function draftOf(input: PricingCase['input']): PricingDraft {
  return {
    lines: input.lines.map((line) => ({
      packageCost: money(line.packageCost),
      packageQuantity: quantity(line.packageQuantity),
      quantity: quantity(line.quantity),
    })),
    fixedOperationalCost: money(input.fixedOperationalCost),
    profitMarginBasisPoints: input.profitMarginBasisPoints,
    manualPrice:
      input.manualPrice === null
        ? { kind: 'none' }
        : { kind: 'price', price: money(input.manualPrice) },
  };
}

/** The preview, written the way the document writes its expected columns. */
function previewOf(input: PricingCase['input']) {
  const preview = previewPricing(draftOf(input));
  const cents = (value: Money | null): string => {
    expect(value).not.toBeNull();

    return value?.toCentsString() ?? '';
  };

  return {
    lineCosts: preview.lineCosts.map(cents),
    materialsCost: cents(preview.materialsCost),
    totalCost: cents(preview.totalCost),
    suggestedPrice: cents(preview.suggestedPrice),
    finalPrice: cents(preview.finalPrice),
  };
}

describe('the preview against the cases of pricing-formula.md', () => {
  it.each(PRICING_CASES)('$name: $description', (pricingCase) => {
    expect(previewOf(pricingCase.input)).toEqual(pricingCase.expected);
  });

  it('covers every case of the document, so one added there fails here until it is ported', () => {
    expect(PRICING_CASES).toHaveLength(10);
    expect(WRONG_ORDER_CASES).toHaveLength(3);
  });
});

describe('the orders that give a different answer', () => {
  it.each(WRONG_ORDER_CASES)('$name: $description', (wrongOrderCase) => {
    const { suggestedPrice } = previewOf(wrongOrderCase.input);

    expect(suggestedPrice).toBe(wrongOrderCase.expected.suggestedPrice);
    expect(suggestedPrice).not.toBe(wrongOrderCase.wrongSuggestedPrice);
  });
});

describe('the fractional cost of R$ 3,36', () => {
  // 120 g of a R$ 28,00 kilo bag: R$ 0,028 a gram, which is not a whole number
  // of cents, so the gram can never be the thing that is rounded.
  const line = {
    packageCost: money('28.00'),
    packageQuantity: quantity('1000'),
    quantity: quantity('120'),
  };

  it('costs R$ 3,36 when multiplied before it is divided', () => {
    const preview = previewPricing({
      lines: [line],
      fixedOperationalCost: money('0.00'),
      profitMarginBasisPoints: 0,
      manualPrice: { kind: 'none' },
    });

    expect(preview.lineCosts[0]?.toCentsString()).toBe('3.36');
    expect(preview.suggestedPrice?.toCentsString()).toBe('3.36');
  });

  it('is not the R$ 3,60 that rounding a gram to three cents first would give', () => {
    const wrong = line.packageCost.scaledToCents(1, 1000).scaledToCents(120, 1);

    expect(wrong.toCentsString()).toBe('3.60');
    expect(wrong.toCentsString()).not.toBe('3.36');
  });
});

describe('a form that is still being filled in', () => {
  const flour = {
    packageCost: money('28.00'),
    packageQuantity: quantity('1000'),
    quantity: quantity('120'),
  };

  const complete: PricingDraft = {
    lines: [flour],
    fixedOperationalCost: money('2.50'),
    profitMarginBasisPoints: 3500,
    manualPrice: { kind: 'none' },
  };

  it('prices the lines it can read and leaves the rest missing, never as zero', () => {
    const preview = previewPricing({
      ...complete,
      lines: [flour, { ...flour, quantity: null }],
    });

    expect(preview.lineCosts[0]?.toCentsString()).toBe('3.36');
    expect(preview.lineCosts[1]).toBeNull();
    expect(preview.materialsCost).toBeNull();
    expect(preview.totalCost).toBeNull();
    expect(preview.suggestedPrice).toBeNull();
    expect(preview.finalPrice).toBeNull();
  });

  it('has the cost of the materials before it has the fixed cost', () => {
    const preview = previewPricing({ ...complete, fixedOperationalCost: null });

    expect(preview.materialsCost?.toCentsString()).toBe('3.36');
    expect(preview.totalCost).toBeNull();
    expect(preview.suggestedPrice).toBeNull();
  });

  it('has the total cost before it has the margin', () => {
    const preview = previewPricing({ ...complete, profitMarginBasisPoints: null });

    expect(preview.totalCost?.toCentsString()).toBe('5.86');
    expect(preview.suggestedPrice).toBeNull();
    expect(preview.finalPrice).toBeNull();
  });

  it('lets a manual price stand even while the suggestion cannot be calculated', () => {
    const preview = previewPricing({
      ...complete,
      profitMarginBasisPoints: null,
      manualPrice: { kind: 'price', price: money('12.00') },
    });

    expect(preview.suggestedPrice).toBeNull();
    expect(preview.finalPrice?.toCentsString()).toBe('12.00');
  });

  it('shows no practiced price while the manual price cannot be read', () => {
    const preview = previewPricing({ ...complete, manualPrice: { kind: 'invalid' } });

    expect(preview.suggestedPrice?.toCentsString()).toBe('7.91');
    expect(preview.finalPrice).toBeNull();
  });

  it('prices an empty bill by its fixed cost alone', () => {
    const preview = previewPricing({ ...complete, lines: [] });

    expect(preview.materialsCost?.toCentsString()).toBe('0.00');
    expect(preview.totalCost?.toCentsString()).toBe('2.50');
    expect(preview.suggestedPrice?.toCentsString()).toBe('3.38');
  });

  it('has no cost for a package that holds nothing, instead of dividing by zero', () => {
    const preview = previewPricing({
      ...complete,
      lines: [{ ...flour, packageQuantity: quantity('0') }],
    });

    expect(preview.lineCosts[0]).toBeNull();
    expect(preview.materialsCost).toBeNull();
  });
});
