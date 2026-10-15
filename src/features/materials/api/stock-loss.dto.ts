import type { DecimalString } from '@/shared/money';
import type { ConsumptionUnit } from '@/shared/quantity';

import type { StockLossReason } from '../model/loss-reason';

/**
 * The wire shapes of the stock losses, written by hand from the backend's
 * `stock-losses.dto.ts` and section 10 of `api-contract.md`. Money is a
 * `DecimalString` and a quantity is a `number`: nothing outside `api/` and
 * `model/` sees either.
 *
 * Every loss answer carries the unit of its material, read from the material
 * when the answer is written (the cost is frozen; the unit is not). The
 * quantity is read in that unit, with no second call to find it out.
 *
 * There is no way to undo a loss, and so no reversal in any of these: whoever
 * recorded one by mistake corrects the stock with a recount.
 */

/** A loss typed in. `quantity` is positive: a loss is, by definition, something that left. */
export interface RecordLossRequestDto {
  quantity: number;
  reason: StockLossReason;
  observation?: string;
}

/** The loss that was recorded and, with it, the balance of the material once it was applied. */
export interface StockLossResultDto {
  id: string;
  materialId: string;
  materialName: string;
  consumptionUnit: ConsumptionUnit;
  consumptionUnitSymbol: string;
  quantity: number;
  reason: string;
  observation: string | null;
  /** Two places, from the fraction frozen when the loss was recorded. */
  value: DecimalString;
  costBasisAmount: DecimalString;
  costBasisQuantity: number;
  createdAt: string;
  stockQuantityAfter: number;
}

export interface StockLossDto {
  id: string;
  materialId: string;
  materialName: string;
  consumptionUnit: ConsumptionUnit;
  consumptionUnitSymbol: string;
  quantity: number;
  /** Kept a string on purpose: a reason this build has never heard of must not break the list. */
  reason: string;
  observation: string | null;
  /** Derived by the API from the frozen fraction. The screen never recomputes it. */
  value: DecimalString;
  costBasisAmount: DecimalString;
  costBasisQuantity: number;
  createdAt: string;
}

export interface StockLossPageDto {
  items: StockLossDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface LossTotalsDto {
  lossCount: number;
  lossValue: DecimalString;
}

export interface StockLossDatasetDto {
  from: string;
  to: string;
  byMonth: (LossTotalsDto & { month: string })[];
  byReason: (LossTotalsDto & { reason: string })[];
  byMaterial: (LossTotalsDto & { materialId: string; materialName: string })[];
}
