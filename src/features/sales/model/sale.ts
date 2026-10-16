import { Money } from '@/shared/money';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { SaleDto, SaleItemDto, SalePageDto } from '../api/sale.dto';

import type { PaymentStatus, ProductionStatus } from './status';

/**
 * A line of a sale as the history reads it: the name and the price **frozen**
 * when the sale was made. Nothing here is looked up from the product or the
 * material as they are today — `compositeProductId` and `materialId` are only
 * there so a screen can navigate to them.
 *
 * `priceBasisAmount` over `priceBasisQuantity` is the fraction the line was
 * priced by, and `lineTotal` is the API's figure derived from it. The fraction
 * is kept whole instead of divided down to a price per unit because that
 * division is where the cents are lost.
 *
 * The unit is the one the line was **sold in**, frozen with the price and
 * carried by the line itself. It is never looked up from the material, which
 * may have changed unit since: a sale of 120 g stays 120 g.
 */
export interface SaleItem {
  id: string;
  compositeProductId: string | null;
  materialId: string | null;
  /** The name at the time of the sale. */
  name: string;
  unit: ConsumptionUnit;
  quantity: Quantity;
  priceBasisAmount: Money;
  priceBasisQuantity: Quantity;
  /** Four places, for display only; shown per larger unit by `formatUnitCost`. */
  unitPrice: Money;
  lineTotal: Money;
}

export interface Sale {
  id: string;
  customerName: string;
  customerContact: string | null;
  /** Free text, not a list the system knows. */
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  items: SaleItem[];
  /** The API's total: the sum of the lines, each already rounded to the cent. */
  totalAmount: Money;
  /** ISO 8601. */
  createdAt: string;
}

export interface SalePage {
  items: Sale[];
  /** The size of the filtered set, not of this page. */
  total: number;
  limit: number;
  offset: number;
}

/**
 * The photos of what can be sold, by id. A sale does not carry them: its lines
 * are a record of what was agreed, and a photo is how the product or material
 * looks *now*. They are read from the product and material lists only so a
 * line can be recognised at a glance, and nothing frozen on the line — name,
 * price, quantity — is ever taken from them.
 */
export interface CatalogImages {
  products: ReadonlyMap<string, string | null>;
  materials: ReadonlyMap<string, string | null>;
}

export const NO_CATALOG_IMAGES: CatalogImages = { products: new Map(), materials: new Map() };

/** The photo for a line, or `null` for the reserved space: no photo, or not loaded yet. */
export function imageOfItem(
  item: Pick<SaleItem, 'compositeProductId' | 'materialId'>,
  images: CatalogImages,
): string | null {
  if (item.compositeProductId !== null) {
    return images.products.get(item.compositeProductId) ?? null;
  }

  return item.materialId === null ? null : (images.materials.get(item.materialId) ?? null);
}

export function toSaleItem(dto: SaleItemDto): SaleItem {
  const unit = dto.consumptionUnit;

  return {
    id: dto.id,
    compositeProductId: dto.compositeProductId,
    materialId: dto.materialId,
    name: dto.itemNameSnapshot,
    unit,
    quantity: Quantity.fromApi(dto.quantity, unit),
    priceBasisAmount: Money.parse(dto.priceBasisAmount),
    priceBasisQuantity: Quantity.fromApi(dto.priceBasisQuantity, unit),
    unitPrice: Money.parse(dto.unitPrice),
    lineTotal: Money.parse(dto.lineTotal),
  };
}

export function toSale(dto: SaleDto): Sale {
  return {
    id: dto.id,
    customerName: dto.customerName,
    customerContact: dto.customerContact,
    paymentMethod: dto.paymentMethod,
    paymentStatus: dto.paymentStatus,
    productionStatus: dto.productionStatus,
    items: dto.items.map(toSaleItem),
    totalAmount: Money.parse(dto.totalAmount),
    createdAt: dto.createdAt,
  };
}

export function toSalePage(dto: SalePageDto): SalePage {
  return {
    items: dto.items.map(toSale),
    total: dto.total,
    limit: dto.limit,
    offset: dto.offset,
  };
}

/**
 * The only identifier a sale has is its UUID — there is no order number — so a
 * short form of it is what a person can read out or recognise. It is the start
 * of the real id and nothing invented.
 */
export function shortSaleId(sale: Pick<Sale, 'id'>): string {
  return sale.id.slice(0, 8);
}

/** Whether the sale's customer, payment method and items can still be changed. */
export function isSaleEditable(sale: Pick<Sale, 'productionStatus'>): boolean {
  return sale.productionStatus === 'PENDING';
}
