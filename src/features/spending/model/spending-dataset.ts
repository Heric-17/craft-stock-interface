import { Money, type DecimalString } from '@/shared/money';

import type { SpendingDatasetDto } from '../api/spending.dto';

/**
 * The spending dataset as the screen reads it, money as `Money`.
 *
 * The API gives cells by dimension and the figures are derived from them in
 * `spending-metrics.ts`. Three things about the cells decide how:
 *
 *  - `months` only has the months that had spending. A month with no purchase is
 *    missing, not zero, and the series fills it in.
 *  - The count of purchases is additive across months, which is how many
 *    purchases there were. It is **not** additive across the two sides of the
 *    stock split: a purchase with lines of both kinds is in each side.
 *  - Money is additive everywhere, and is the paid value, not the sum of the
 *    lines: the difference is the discount.
 */

export interface SpendingCell {
  netSpend: Money;
  discountTotal: Money;
  purchaseCount: number;
}

export interface MonthCell extends SpendingCell {
  /** `YYYY-MM`, on the calendar of `America/Sao_Paulo`. */
  month: string;
}

export interface EstablishmentCell extends SpendingCell {
  /** The CNPJ, or the name when the note had none; `null` for purchases with no shop. */
  establishmentId: string | null;
  establishmentName: string | null;
}

export interface SpendingDataset {
  months: MonthCell[];
  establishments: EstablishmentCell[];
  /** The lines that become a stock material. Zero when there were none. */
  stockMaterial: SpendingCell;
  /** The lines that are only a company expense. Zero when there were none. */
  companyOnly: SpendingCell;
}

function toCell(dto: {
  netSpend: DecimalString;
  discountTotal: DecimalString;
  purchaseCount: number;
}): SpendingCell {
  return {
    netSpend: Money.parse(dto.netSpend),
    discountTotal: Money.parse(dto.discountTotal),
    purchaseCount: dto.purchaseCount,
  };
}

const NO_SPENDING: SpendingCell = {
  netSpend: Money.zero(),
  discountTotal: Money.zero(),
  purchaseCount: 0,
};

export function toSpendingDataset(dto: SpendingDatasetDto): SpendingDataset {
  const stock = dto.byStockMaterial.find((cell) => cell.isStockMaterial);
  const company = dto.byStockMaterial.find((cell) => !cell.isStockMaterial);

  return {
    months: dto.byPeriod.map((cell) => ({ month: cell.period, ...toCell(cell) })),
    establishments: dto.byEstablishment.map((cell) => ({
      establishmentId: cell.establishmentId,
      establishmentName: cell.establishmentName,
      ...toCell(cell),
    })),
    // The API always sends both sides; a side that is somehow missing is nothing spent.
    stockMaterial: stock === undefined ? NO_SPENDING : toCell(stock),
    companyOnly: company === undefined ? NO_SPENDING : toCell(company),
  };
}
