import { Money } from '@/shared/money';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { BomItemDto, CompositeProductDto } from '../api/composite-product.dto';

/**
 * A `BomItem` as the screens read it: `Money` and `Quantity`, never the
 * decimal string and the `number` the wire carries.
 *
 * `quantity`, `stockQuantity` and `unitCost` are all in the material's
 * `consumptionUnit`, which travels with them: `120` beside a line says
 * nothing on its own.
 */
export interface BomItem {
  materialId: string;
  materialName: string;
  /** How much of the material one produced unit consumes. */
  quantity: Quantity;
  consumptionUnit: ConsumptionUnit;
  /** Cost of one base unit, four places. Shown per larger unit by `formatUnitCost`. */
  unitCost: Money;
  lineCost: Money;
  stockQuantity: Quantity;
  /** How many units the stock of this one material alone would allow. */
  possibleUnits: number;
}

/** The material that runs out first, as the API names it. */
export interface Bottleneck {
  materialId: string;
  materialName: string;
  possibleUnits: number;
}

/**
 * A `CompositeProduct` as the screens read it.
 *
 * Every cost, price and capacity here is the backend's answer, carried through
 * untouched: they are computed at read time from the bill of materials and the
 * current state of each material. The one thing this feature computes itself —
 * the preview while a form is being edited — lives in `bom-preview.ts`, and is
 * never put in one of these.
 */
export interface CompositeProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  fixedOperationalCost: Money;
  /** Whole basis points, for the form to turn into the percentage it shows. */
  profitMarginBasisPoints: number;
  manualPrice: Money | null;
  materialsCost: Money;
  totalCost: Money;
  suggestedPrice: Money;
  /** The practiced price: the manual one when there is one, the suggested otherwise. */
  finalPrice: Money;
  /** How many units the current stock allows. Not a history of what was produced. */
  productionCapacity: number;
  bottleneck: Bottleneck | null;
  billOfMaterials: BomItem[];
  isActive: boolean;
  /** ISO 8601, set when the product was discontinued. */
  discontinuedAt: string | null;
  updatedAt: string;
}

function toBomItem(dto: BomItemDto): BomItem {
  const unit = dto.consumptionUnit;

  return {
    materialId: dto.materialId,
    materialName: dto.materialName,
    quantity: Quantity.fromApi(dto.quantity, unit),
    consumptionUnit: unit,
    unitCost: Money.parse(dto.unitCost),
    lineCost: Money.parse(dto.lineCost),
    stockQuantity: Quantity.fromApi(dto.stockQuantity, unit),
    possibleUnits: dto.possibleUnits,
  };
}

export function toCompositeProduct(dto: CompositeProductDto): CompositeProduct {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    imageUrl: dto.imageUrl,
    fixedOperationalCost: Money.parse(dto.fixedOperationalCost),
    profitMarginBasisPoints: dto.profitMarginBasisPoints,
    manualPrice: dto.manualPrice === null ? null : Money.parse(dto.manualPrice),
    materialsCost: Money.parse(dto.materialsCost),
    totalCost: Money.parse(dto.totalCost),
    suggestedPrice: Money.parse(dto.suggestedPrice),
    finalPrice: Money.parse(dto.finalPrice),
    productionCapacity: dto.productionCapacity,
    bottleneck: dto.bottleneck,
    billOfMaterials: dto.billOfMaterials.map(toBomItem),
    isActive: dto.isActive,
    discontinuedAt: dto.discontinuedAt,
    updatedAt: dto.updatedAt,
  };
}

/** The line of the bill that is the bottleneck, to say how much of it there is and how much a unit takes. */
export function bottleneckItem(product: CompositeProduct): BomItem | null {
  const { bottleneck } = product;

  if (bottleneck === null) {
    return null;
  }

  return product.billOfMaterials.find((item) => item.materialId === bottleneck.materialId) ?? null;
}
