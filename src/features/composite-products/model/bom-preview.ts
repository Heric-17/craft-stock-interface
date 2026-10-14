import { applyMargin, Money } from '@/shared/money';
import type { Quantity } from '@/shared/quantity';

/**
 * The suggested price, calculated here while a bill of materials is still
 * being edited.
 *
 * There is no simulation endpoint, so this is the one place the frontend
 * computes a business figure — an exception the project allows for exactly
 * this, and nowhere else. The preview and the value the API returns after
 * saving come from two implementations of **one** formula, and they have to
 * agree to the cent.
 *
 * Specification: `pricing-formula.md` in the backend repository's `docs/`.
 * Reference implementation: `calculateCompositeProductPricing`, in the
 * backend's `src/modules/composite-products/domain/composite-product-pricing.ts`,
 * with `applyMargin` from `src/shared/domain/money/margin.ts`. The ten cases of
 * its section 5 are what `bom-preview.test.ts` repeats, one by one.
 *
 * The order of operations, and the only two places anything is rounded:
 *
 *  1. `lineCost = round(packageCost x quantity / packageQuantity)`, per line.
 *     Multiplied before divided and rounded once: R$ 28,00 a kilo is
 *     R$ 0,028 a gram, which does not fit in cents, and 120 g of it costs
 *     R$ 3,36 — not the R$ 3,60 that rounding the gram first would give;
 *  2. `materialsCost` is the sum of the lines already rounded;
 *  3. `totalCost = materialsCost + fixedOperationalCost`, exact;
 *  4. `suggestedPrice = round(totalCost x (10 000 + marginBasisPoints) / 10 000)`.
 *     The margin goes on the total, never on each line, and it is a whole
 *     number of basis points so that no float is involved: `125 x 1,348` in
 *     floating point is `168,49999999999997`, and the exact `168,5` is a tie
 *     that goes up;
 *  5. `finalPrice = manualPrice ?? suggestedPrice`.
 *
 * Quantities enter as the exact integer a `Quantity` holds, so no step turns
 * one into a `number`. Capacity and the bottleneck are **not** here: they
 * depend on stock, the spec does not cover them, and the API's answer is the
 * only one the screen shows.
 */

/** One line of the bill, with what pricing needs from its material. */
export interface PreviewLine {
  /** The whole purchased package: what the material is priced by. */
  packageCost: Money;
  /** What the package holds, in the material's consumption unit. */
  packageQuantity: Quantity;
  /** How much one produced unit consumes, in the same unit. `null` while it cannot be read. */
  quantity: Quantity | null;
}

/** The practiced price as the form has it: absent on purpose, unreadable, or a value. */
export type ManualPriceDraft =
  { kind: 'none' } | { kind: 'invalid' } | { kind: 'price'; price: Money };

/**
 * Everything the form holds, each piece `null` while it cannot be read. A
 * field that is empty or half typed is **not** treated as zero: a figure that
 * depends on it is shown as missing instead of as a plausible wrong number.
 */
export interface PricingDraft {
  lines: readonly PreviewLine[];
  fixedOperationalCost: Money | null;
  profitMarginBasisPoints: number | null;
  manualPrice: ManualPriceDraft;
}

export interface PricingPreview {
  /** One per line, `null` for a line whose quantity cannot be read. */
  lineCosts: readonly (Money | null)[];
  materialsCost: Money | null;
  totalCost: Money | null;
  suggestedPrice: Money | null;
  finalPrice: Money | null;
}

/**
 * What one line costs: `packageCost x quantity / packageQuantity`, rounded once
 * to the cent. `null` for a package that holds nothing, which has no cost per
 * unit to speak of and which the API never sends.
 */
export function bomLineCost(line: PreviewLine & { quantity: Quantity }): Money | null {
  if (line.packageQuantity.isZero()) {
    return null;
  }

  return line.packageCost.scaledToCents(
    line.quantity.toScaledUnits(),
    line.packageQuantity.toScaledUnits(),
  );
}

export function previewPricing(draft: PricingDraft): PricingPreview {
  const lineCosts = draft.lines.map((line) =>
    line.quantity === null ? null : bomLineCost({ ...line, quantity: line.quantity }),
  );
  const materialsCost = lineCosts.every(isMoney) ? Money.sum(lineCosts) : null;

  const totalCost =
    materialsCost !== null && draft.fixedOperationalCost !== null
      ? materialsCost.plus(draft.fixedOperationalCost)
      : null;

  const suggestedPrice =
    totalCost !== null && draft.profitMarginBasisPoints !== null
      ? applyMargin(totalCost, draft.profitMarginBasisPoints)
      : null;

  return {
    lineCosts,
    materialsCost,
    totalCost,
    suggestedPrice,
    finalPrice: finalPriceOf(draft.manualPrice, suggestedPrice),
  };
}

function finalPriceOf(manualPrice: ManualPriceDraft, suggestedPrice: Money | null): Money | null {
  switch (manualPrice.kind) {
    case 'price':
      return manualPrice.price;
    case 'none':
      return suggestedPrice;
    case 'invalid':
      return null;
  }
}

function isMoney(value: Money | null): value is Money {
  return value !== null;
}
