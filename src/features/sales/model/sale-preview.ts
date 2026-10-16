import { applyMargin, Money } from '@/shared/money';
import type { Quantity } from '@/shared/quantity';

/**
 * The total of a sale, calculated here while the sale is still being typed.
 *
 * There is no simulation endpoint, so this is one of the two places the
 * frontend computes a business figure (the other is the price preview of the
 * bill of materials). Once the sale is saved, the screen shows the API's
 * figures and these are discarded; the two have to agree to the cent.
 *
 * Specification: section 7 of `pricing-formula.md` in the backend repository's
 * `docs/`. Reference implementation: `saleLineTotal` and `saleTotal` in the
 * backend's `src/modules/sales/domain/sale-line-total.ts`, and
 * `calculateLooseMaterialPriceBasis` in `loose-material-pricing.ts`, which
 * uses `applyMargin` from `src/shared/domain/money/margin.ts`.
 *
 * The order of operations, and the only places anything is rounded:
 *
 *  1. The line is priced by a **fraction**, `priceBasisAmount` over
 *     `priceBasisQuantity`, never by a price per unit:
 *       - a product is sold by the piece: its practiced price over a quantity
 *         of one;
 *       - a loose material is sold from the whole package: the package cost
 *         marked up, `round(packageCost x (10 000 + marginBasisPoints) / 10 000)`,
 *         over what the package holds;
 *  2. `lineTotal = round(priceBasisAmount x quantity / priceBasisQuantity)`,
 *     multiplied before divided and rounded once. 120 g from a R$ 28,00 kilo
 *     is R$ 3,36; dividing first (R$ 0,028 a gram, rounded to R$ 0,03) would
 *     give R$ 3,60;
 *  3. the total is the sum of the lines **already rounded**. Three lines of
 *     R$ 1,00 over a basis of 3 are R$ 0,33 each and R$ 0,99 together, not the
 *     R$ 1,00 that rounding the exact sum would give.
 *
 * Quantities enter as the exact integer a `Quantity` holds, so no step turns
 * one into a `number`.
 */

/** A product line: priced at the practiced price the product has right now. */
export interface ProductPreviewLine {
  kind: 'PRODUCT';
  /** The product's practiced price: the manual one when there is one. */
  finalPrice: Money;
  /** `null` while the field cannot be read. */
  quantity: Quantity | null;
}

/** A loose-material line: priced from the whole package, plus the margin typed. */
export interface MaterialPreviewLine {
  kind: 'MATERIAL';
  packageCost: Money;
  packageQuantity: Quantity;
  /** `null` while the margin is empty or unreadable. An empty margin is never zero. */
  marginBasisPoints: number | null;
  quantity: Quantity | null;
}

export type PreviewLine = ProductPreviewLine | MaterialPreviewLine;

export interface SalePreview {
  /** One per line, `null` for a line that cannot be priced yet. */
  lineTotals: readonly (Money | null)[];
  /** `null` while any line cannot be priced: a partial total would look whole. */
  total: Money | null;
}

/** A piece, in the thousandths a `Quantity` counts in. */
const ONE_PIECE = 1000n;

export function previewLineTotal(line: PreviewLine): Money | null {
  if (line.quantity === null) {
    return null;
  }

  if (line.kind === 'PRODUCT') {
    return line.finalPrice.scaledToCents(line.quantity.toScaledUnits(), ONE_PIECE);
  }

  if (line.marginBasisPoints === null || line.packageQuantity.isZero()) {
    return null;
  }

  const priceBasisAmount = applyMargin(line.packageCost, line.marginBasisPoints);

  return priceBasisAmount.scaledToCents(
    line.quantity.toScaledUnits(),
    line.packageQuantity.toScaledUnits(),
  );
}

export function previewSale(lines: readonly PreviewLine[]): SalePreview {
  const lineTotals = lines.map(previewLineTotal);
  const total = lineTotals.every((value): value is Money => value !== null)
    ? Money.sum(lineTotals)
    : null;

  return { lineTotals, total };
}
