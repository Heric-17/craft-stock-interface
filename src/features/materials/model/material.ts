import { Money } from '@/shared/money';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type {
  InventorySummaryDto,
  MaterialDto,
  MaterialPriceHistoryDto,
} from '../api/material.dto';

/**
 * A `Material` as the screens read it: `Money` and `Quantity`, never the
 * decimal string and the `number` the wire carries.
 *
 * Everything derived — the fractional cost, the stock value, the low-stock
 * flag — is the backend's answer, carried through untouched. Nothing here
 * recomputes it: `stockValue` is rounded per material on the server so that it
 * closes with the total of the inventory summary, and doing the sum again on
 * this side is how the card and the rows would stop agreeing.
 */
export interface Material {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  packageCost: Money;
  packageQuantity: Quantity;
  consumptionUnit: ConsumptionUnit;
  stockQuantity: Quantity;
  minimumStockAlert: Quantity;
  /** Cost of one base unit, four places. Shown per larger unit by `formatUnitCost`. */
  unitCost: Money;
  stockValue: Money;
  lowStock: boolean;
  isActive: boolean;
  /** ISO 8601, set when the material was discontinued. */
  discontinuedAt: string | null;
  updatedAt: string;
}

export function toMaterial(dto: MaterialDto): Material {
  const unit = dto.consumptionUnit;

  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    imageUrl: dto.imageUrl,
    packageCost: Money.parse(dto.packageCost),
    packageQuantity: Quantity.fromApi(dto.packageQuantity, unit),
    consumptionUnit: unit,
    stockQuantity: Quantity.fromApi(dto.stockQuantity, unit),
    minimumStockAlert: Quantity.fromApi(dto.minimumStockAlert, unit),
    unitCost: Money.parse(dto.unitCost),
    stockValue: Money.parse(dto.stockValue),
    lowStock: dto.lowStock,
    isActive: dto.isActive,
    discontinuedAt: dto.discontinuedAt,
    updatedAt: dto.updatedAt,
  };
}

/** The three figures of the cards, finished by the backend. */
export interface InventorySummary {
  materialCount: number;
  belowMinimumCount: number;
  totalStockValue: Money;
}

export function toInventorySummary(dto: InventorySummaryDto): InventorySummary {
  return {
    materialCount: dto.materialCount,
    belowMinimumCount: dto.belowMinimumCount,
    totalStockValue: Money.parse(dto.totalStockValue),
  };
}

export type PriceChangeOrigin = 'CREATION' | 'MANUAL_EDIT' | 'INVOICE_SYNC' | 'UNKNOWN';

export interface MaterialPriceChange {
  id: string;
  previousValue: Money;
  newValue: Money;
  origin: PriceChangeOrigin;
  /** ISO 8601. */
  changedAt: string;
}

function toOrigin(origin: string): PriceChangeOrigin {
  return origin === 'CREATION' || origin === 'MANUAL_EDIT' || origin === 'INVOICE_SYNC'
    ? origin
    : 'UNKNOWN';
}

/**
 * The history, newest change first: the list a person reads is "what happened
 * lately", and the API sends it in the order it was recorded.
 *
 * An origin this build has never heard of is kept as `UNKNOWN` and shown with a
 * generic label, so a value the backend adds tomorrow does not break the page.
 */
export function toPriceHistory(dtos: readonly MaterialPriceHistoryDto[]): MaterialPriceChange[] {
  return dtos
    .map((dto): MaterialPriceChange => ({
      id: dto.id,
      previousValue: Money.parse(dto.previousValue),
      newValue: Money.parse(dto.newValue),
      origin: toOrigin(dto.origin),
      changedAt: dto.changedAt,
    }))
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : a.changedAt > b.changedAt ? -1 : 0));
}
