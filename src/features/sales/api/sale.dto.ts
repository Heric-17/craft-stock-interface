import type { DecimalString } from '@/shared/money';
import type { ConsumptionUnit } from '@/shared/quantity';

import type { PaymentStatus, ProductionStatus } from '../model/status';

/**
 * The wire shapes of `/sales`, written by hand from the backend's `SaleView`
 * and the presentation DTOs. There is no OpenAPI to generate them from, so the
 * MSW fixtures typed by these are what notice a drift.
 *
 * Money is a `DecimalString` and a quantity is a `number`: nothing outside
 * `api/` and `model/` ever sees either.
 */

export interface SaleItemDto {
  id: string;
  /** Exactly one of the two is not null. Only for navigating. */
  compositeProductId: string | null;
  materialId: string | null;
  quantity: number;
  /** The name when the sale was made. */
  itemNameSnapshot: string;
  /** Two places, frozen. */
  priceBasisAmount: DecimalString;
  /** Frozen. For a loose material it is the package's quantity. */
  priceBasisQuantity: number;
  /**
   * The unit `quantity` and `priceBasisQuantity` are in: **the one the line was sold
   * in**, frozen with the price. A product is always `UNIT`. It is not the unit the
   * material has today, which may have changed since.
   */
  consumptionUnit: ConsumptionUnit;
  /** `un`, `g`, `ml` or `cm`, ready to show. */
  consumptionUnitSymbol: string;
  /** Four places, derived at read time. */
  unitPrice: DecimalString;
  /** Two places, derived at read time. */
  lineTotal: DecimalString;
}

export interface SaleDto {
  id: string;
  customerName: string;
  customerContact: string | null;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  items: SaleItemDto[];
  totalAmount: DecimalString;
  createdAt: string;
  updatedAt: string;
}

export interface SalePageDto {
  items: SaleDto[];
  total: number;
  limit: number;
  offset: number;
}

/** Exactly one of `compositeProductId` / `materialId`. */
export interface CreateSaleItemRequestDto {
  compositeProductId?: string;
  materialId?: string;
  quantity: number;
  /** Whole basis points, for a loose material only: `5000` is 50%. Zero sells at cost. */
  marginBasisPoints?: number;
}

export interface CreateSaleRequestDto {
  customerName: string;
  customerContact?: string;
  paymentMethod: string;
  items: CreateSaleItemRequestDto[];
}

/** Only the fields present are changed; `customerContact: null` clears it. */
export interface UpdateSaleDetailsRequestDto {
  customerName?: string;
  customerContact?: string | null;
  paymentMethod?: string;
}

// -- The dataset behind the cards ---------------------------------------------

export interface SalesTotalsDto {
  saleCount: number;
  totalAmount: DecimalString;
}

export interface SalesDatasetDto {
  from: string;
  to: string;
  /** Movement: sales created in the period, one cell per month, all of them present. */
  byMonth: (SalesTotalsDto & { month: string })[];
  /** Movement: the period's sales only. */
  byPaymentStatus: (SalesTotalsDto & { paymentStatus: PaymentStatus })[];
  byProductionStatus: (SalesTotalsDto & { productionStatus: ProductionStatus })[];
  /**
   * Balance: every sale that is not both paid and delivered, whatever its
   * date. It does not move with the period.
   */
  openItems: (SalesTotalsDto & {
    paymentStatus: PaymentStatus;
    productionStatus: ProductionStatus;
  })[];
}
