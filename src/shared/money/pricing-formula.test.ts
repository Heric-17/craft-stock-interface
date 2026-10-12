import { describe, expect, it } from 'vitest';

import { Quantity } from '@/shared/quantity';

import { requireDecimalString } from './decimal-string';
import { applyMargin } from './margin';
import { Money } from './money';
import {
  PRICING_CASES,
  WRONG_ORDER_CASES,
  type PricingCase,
  type PricingLine,
} from './pricing-formula-cases';

/**
 * The suggested price, assembled out of the shared primitives in the order
 * `pricing-formula.md` section 3 fixes: `scaledToCents` for each line and
 * `applyMargin` once, on the total.
 *
 * The screen's own preview belongs to the `composite-products` feature, in its
 * `model/`. What is pinned here is the arithmetic underneath it — the two
 * roundings and where they fall — because that is what `shared/money` owes the
 * preview, and a divergence found at this level is the same cent of error with
 * one less layer to look through.
 *
 * Quantities travel as `bigint` thousandths, so no step turns one into a
 * `number`.
 */
function calculatePricing(input: PricingCase['input']) {
  const lineCosts = input.lines.map(lineCost);
  const materialsCost = Money.sum(lineCosts);
  const totalCost = materialsCost.plus(money(input.fixedOperationalCost));
  const suggestedPrice = applyMargin(totalCost, input.profitMarginBasisPoints);
  const manualPrice = input.manualPrice === null ? null : money(input.manualPrice);

  return {
    lineCosts: lineCosts.map((cost) => cost.toCentsString()),
    materialsCost: materialsCost.toCentsString(),
    totalCost: totalCost.toCentsString(),
    suggestedPrice: suggestedPrice.toCentsString(),
    finalPrice: (manualPrice ?? suggestedPrice).toCentsString(),
  };
}

describe('the suggested price contract', () => {
  it.each(PRICING_CASES)('$name: $description', (pricingCase) => {
    expect(calculatePricing(pricingCase.input)).toEqual({
      lineCosts: pricingCase.expected.lineCosts,
      materialsCost: pricingCase.expected.materialsCost,
      totalCost: pricingCase.expected.totalCost,
      suggestedPrice: pricingCase.expected.suggestedPrice,
      finalPrice: pricingCase.expected.finalPrice,
    });
  });

  it('covers every case of the document, so a case added there fails here until it is ported', () => {
    expect(PRICING_CASES).toHaveLength(10);
    expect(WRONG_ORDER_CASES).toHaveLength(3);
  });
});

/**
 * The orders that look right and are not. Each one asserts both halves: that
 * the implementation gives the documented result, and that it does not give
 * the documented wrong one.
 */
describe('the orders that give a different answer', () => {
  it.each(WRONG_ORDER_CASES)('$name: $description', (wrongOrderCase) => {
    const { suggestedPrice } = calculatePricing(wrongOrderCase.input);

    expect(suggestedPrice).toBe(wrongOrderCase.expected.suggestedPrice);
    expect(suggestedPrice).not.toBe(wrongOrderCase.wrongSuggestedPrice);
  });

  it('dividing before multiplying overstates a fractional ingredient by 7%', () => {
    const [wrongOrderCase] = WRONG_ORDER_CASES;
    const line = wrongOrderCase?.input.lines[0];
    const unitCost = money(line!.packageCost).scaledToCents(1, Number(line!.packageQuantity));

    expect(unitCost.scaledToCents(Number(line!.quantity), 1).toCentsString()).toBe(
      wrongOrderCase?.wrongSuggestedPrice,
    );
  });

  it('marking up each line and summing rounds once per line and drifts', () => {
    const wrongOrderCase = WRONG_ORDER_CASES[1]!;
    const markedUpLines = wrongOrderCase.input.lines.map((line) =>
      applyMargin(lineCost(line), wrongOrderCase.input.profitMarginBasisPoints),
    );

    expect(Money.sum(markedUpLines).toCentsString()).toBe(wrongOrderCase.wrongSuggestedPrice);
  });

  it('a floating-point factor loses the tie the exact value sits on', () => {
    const wrongOrderCase = WRONG_ORDER_CASES[2]!;
    const { profitMarginBasisPoints } = wrongOrderCase.input;
    const totalCents = 125;
    const wrongCents = Math.round(totalCents * (1 + profitMarginBasisPoints / 10_000));

    expect(`${Math.trunc(wrongCents / 100)}.${wrongCents % 100}`).toBe(
      wrongOrderCase.wrongSuggestedPrice,
    );
    expect(applyMargin(money('1.25'), profitMarginBasisPoints).toCentsString()).toBe(
      wrongOrderCase.expected.suggestedPrice,
    );
  });
});

function lineCost(line: PricingLine): Money {
  return money(line.packageCost).scaledToCents(
    quantityUnits(line.quantity),
    quantityUnits(line.packageQuantity),
  );
}

/** A quantity of the document, as the exact integer a `Quantity` holds. */
function quantityUnits(value: string): bigint {
  return Quantity.parse(requireDecimalString(value), 'GRAM').toScaledUnits();
}

function money(value: string): Money {
  return Money.parse(requireDecimalString(value));
}
