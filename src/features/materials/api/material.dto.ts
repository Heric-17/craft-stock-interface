import type { DecimalString } from '@/shared/money';
import type { ConsumptionUnit } from '@/shared/quantity';

/**
 * The wire shapes of `/materials`, written by hand from the backend's
 * `MaterialView` and the presentation DTOs. There is no OpenAPI to generate
 * them from, so the MSW fixtures typed by these are what notices a drift.
 *
 * **Money is a `DecimalString`; a quantity is a `number`.** That asymmetry is
 * the contract — see `Quantity.fromApi` — and nothing outside `api/` and
 * `model/` ever sees either: the mapper in `model/material.ts` is the only
 * place they become `Money` and `Quantity`.
 */
export interface MaterialDto {
  id: string;
  name: string;
  description: string | null;
  /** Absolute and ready to use, or `null`. The frontend never builds one. */
  imageUrl: string | null;
  packageCost: DecimalString;
  packageQuantity: number;
  consumptionUnit: ConsumptionUnit;
  consumptionUnitSymbol: string;
  stockQuantity: number;
  minimumStockAlert: number;
  /** Four places, for display only. */
  unitCost: DecimalString;
  /** Two places, rounded per material by the backend. */
  stockValue: DecimalString;
  lowStock: boolean;
  isActive: boolean;
  discontinuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialPriceHistoryDto {
  id: string;
  materialId: string;
  previousValue: DecimalString;
  newValue: DecimalString;
  /** `CREATION`, `MANUAL_EDIT` or `INVOICE_SYNC` — kept a string on purpose. */
  origin: string;
  changedAt: string;
}

export interface InventorySummaryDto {
  materialCount: number;
  belowMinimumCount: number;
  totalStockValue: DecimalString;
}

export interface CreateMaterialRequestDto {
  name: string;
  description?: string;
  packageCost: string;
  packageQuantity: number;
  consumptionUnit: ConsumptionUnit;
  stockQuantity: number;
  minimumStockAlert: number;
}

/** Only the fields present are changed. */
export interface UpdateMaterialRequestDto {
  name?: string;
  packageCost?: string;
  packageQuantity?: number;
  minimumStockAlert?: number;
}

export interface ChangeConsumptionUnitRequestDto {
  consumptionUnit: ConsumptionUnit;
}

/**
 * Exactly one of the two quantities, plus the source. `relativeIncrement` adds
 * to the stock and may be negative to take from it; `absoluteQuantity` sets it.
 */
export type StockAdjustmentRequestDto =
  { source: 'MANUAL'; relativeIncrement: number } | { source: 'MANUAL'; absoluteQuantity: number };
