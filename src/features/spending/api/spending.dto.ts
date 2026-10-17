import type { DecimalString } from '@/shared/money';

/**
 * `SpendingDatasetView` of the API: spending by dimension, never a finished
 * figure. Only the lines that are a company expense count, and a purchase whose
 * discount is still to be attributed is out of every dimension.
 */

/** One month of `byPeriod`. Only months with spending are present. */
export interface SpendingPeriodCellDto {
  /** `YYYY-MM` on the calendar of `America/Sao_Paulo`, for `MONTH`. */
  period: string;
  /** Two places: what was paid. */
  netSpend: DecimalString;
  /** Two places: what the discounts saved on those lines. Zero is a result. */
  discountTotal: DecimalString;
  purchaseCount: number;
}

/** One shop of `byEstablishment`, richest first. */
export interface SpendingEstablishmentCellDto {
  /** The CNPJ, or the name when the note had none. `null` for a purchase with no shop. */
  establishmentId: string | null;
  /** `null` when only the CNPJ is known, or for a purchase with no shop. */
  establishmentName: string | null;
  netSpend: DecimalString;
  discountTotal: DecimalString;
  purchaseCount: number;
}

/**
 * One side of `byStockMaterial`: the lines that become a stock material, or the
 * ones that are only a company expense. Both sides always come, `true` first.
 *
 * `purchaseCount` is **not additive** across the two sides: a purchase with
 * lines of both kinds is counted in each. Money is additive; the count is not.
 */
export interface SpendingStockCellDto {
  isStockMaterial: boolean;
  netSpend: DecimalString;
  discountTotal: DecimalString;
  purchaseCount: number;
}

export type SpendingGranularity = 'DAY' | 'MONTH';

export interface SpendingDatasetDto {
  from: string;
  to: string;
  granularity: SpendingGranularity;
  byPeriod: SpendingPeriodCellDto[];
  byEstablishment: SpendingEstablishmentCellDto[];
  byStockMaterial: SpendingStockCellDto[];
}
