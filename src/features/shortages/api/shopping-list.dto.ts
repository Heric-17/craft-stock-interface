import type { DecimalString } from '@/shared/money';
import type { ConsumptionUnit } from '@/shared/quantity';

/**
 * The wire shape of `POST /sales/shopping-list`, written by hand from the
 * backend's `ShoppingListView`. The answer is an **object**, not an array: the
 * lines, and the estimate for the whole of them.
 *
 * Money is a `DecimalString` and a quantity is a `number`; nothing outside
 * `api/` and `model/` ever sees either.
 */

export type EstimateIssueDto = 'MISSING_PACKAGE_DATA';

export interface ShoppingListLineDto {
  materialId: string;
  materialName: string;
  /** The three quantities are in the material's `consumptionUnit`. */
  needed: number;
  stockQuantity: number;
  shortage: number;
  consumptionUnit: ConsumptionUnit;
  /** `un`, `g`, `ml` or `cm`, ready to show. */
  consumptionUnitSymbol: string;
  /**
   * Whole packages to cover `shortage`, rounded up: a material is bought in a
   * closed package. Zero when nothing is missing, **null** when the package data
   * does not allow the count.
   */
  packagesToBuy: number | null;
  /**
   * `packagesToBuy` times the package cost, two places. `"0.00"` when nothing is
   * missing, **null** — never zero — when it cannot be estimated.
   */
  estimatedCost: DecimalString | null;
  /** Set exactly when something is missing and the line could not be estimated. */
  estimateIssue: EstimateIssueDto | null;
}

export interface ShoppingListDto {
  lines: ShoppingListLineDto[];
  /** Adds only the lines that could be estimated: a floor while any line is not. */
  estimatedTotal: DecimalString;
  unestimatedLineCount: number;
}

export interface ShoppingListRequestDto {
  /** At least one. An id the API does not know is ignored. */
  saleIds: string[];
}
