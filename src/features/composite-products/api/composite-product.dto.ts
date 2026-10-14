import type { DecimalString } from '@/shared/money';
import type { ConsumptionUnit } from '@/shared/quantity';

/**
 * The wire shapes of `/composite-products`, written by hand from the backend's
 * `CompositeProductView` and the presentation DTOs. There is no OpenAPI to
 * generate them from, so the MSW fixtures typed by these are what notices a
 * drift.
 *
 * **Money is a `DecimalString`; a quantity is a `number`.** That asymmetry is
 * the contract — see `Quantity.fromApi` — and nothing outside `api/` and
 * `model/` ever sees either: the mapper in `model/composite-product.ts` is the
 * only place they become `Money` and `Quantity`.
 *
 * `productionCapacity` and `possibleUnits` are counts of finished units, whole
 * numbers, and not quantities of a material.
 */

/** One `BomItem`, joined with its material's current cost and stock. */
export interface BomItemDto {
  materialId: string;
  materialName: string;
  /** How much of the material one produced unit consumes, in `consumptionUnit`. */
  quantity: number;
  consumptionUnit: ConsumptionUnit;
  consumptionUnitSymbol: string;
  /** Four places, for display only. */
  unitCost: DecimalString;
  lineCost: DecimalString;
  stockQuantity: number;
  possibleUnits: number;
}

export interface BottleneckDto {
  materialId: string;
  materialName: string;
  possibleUnits: number;
}

export interface CompositeProductDto {
  id: string;
  name: string;
  description: string | null;
  /** Absolute and ready to use, or `null`. The frontend never builds one. */
  imageUrl: string | null;
  fixedOperationalCost: DecimalString;
  /** Whole basis points: `3333` is 33,33%. Shown as a percentage, never as this. */
  profitMarginBasisPoints: number;
  manualPrice: DecimalString | null;
  materialsCost: DecimalString;
  totalCost: DecimalString;
  suggestedPrice: DecimalString;
  finalPrice: DecimalString;
  productionCapacity: number;
  bottleneck: BottleneckDto | null;
  billOfMaterials: BomItemDto[];
  isActive: boolean;
  discontinuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BomItemRequestDto {
  materialId: string;
  quantity: number;
}

export interface CreateCompositeProductRequestDto {
  name: string;
  description?: string;
  fixedOperationalCost: string;
  profitMarginBasisPoints: number;
  manualPrice?: string;
  billOfMaterials: BomItemRequestDto[];
}

/**
 * Only the fields present are changed. `description` and `manualPrice` follow
 * the same convention: omitted leaves them alone, `null` clears them.
 * `billOfMaterials`, when present, replaces the whole bill.
 */
export interface UpdateCompositeProductRequestDto {
  name?: string;
  description?: string | null;
  fixedOperationalCost?: string;
  profitMarginBasisPoints?: number;
  manualPrice?: string | null;
  billOfMaterials?: BomItemRequestDto[];
}
