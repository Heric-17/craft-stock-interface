import type { DecimalString } from '@/shared/money';

import type { DiscountAllocationMode } from '../model/discount-mode';

/** The shop, as the API writes it: its CNPJ when it has one, its name otherwise, as `id`. */
export interface EstablishmentDto {
  id: string;
  name: string;
  cnpj: string | null;
}

/**
 * `PurchaseSummaryView` of the API: one row of the purchase history. It carries
 * the totals and the number of lines, not the lines themselves — the classification
 * screen reads those. Every purchase that came from a note is one of these, and
 * the shop, the amount and the access key the queue does not know are here.
 */
export interface PurchaseSummaryDto {
  id: string;
  /** ISO 8601: when the note was issued. */
  purchaseDate: string;
  /** The 44 digits of the NFC-e, or `null` for a purchase typed in by hand. */
  accessKey: string | null;
  establishment: EstablishmentDto | null;
  /** Two places, the lines at full price. */
  grossTotal: DecimalString;
  /** Two places. */
  discountTotal: DecimalString;
  /** Two places: what was paid. */
  netTotal: DecimalString;
  /** Still waiting for the discount to be attributed to the lines. */
  allocationPending: boolean;
  itemCount: number;
  /** Whether a captured note is behind it. `false` for a purchase typed in by hand. */
  hasInvoice: boolean;
  /** ISO 8601: when it was imported. */
  createdAt: string;
}

export interface PurchasePageDto {
  items: PurchaseSummaryDto[];
  total: number;
  limit: number;
  offset: number;
}

/** One line of a purchase, `PurchaseItemView` of the API. */
export interface PurchaseItemDto {
  id: string;
  materialId: string | null;
  /** The product's code at the shop. */
  code: string | null;
  /** As the note printed it. */
  description: string;
  /** How many packages: a `number`, up to three places. */
  quantity: number;
  /** As the note printed it, with the till's numeric suffix (`UND9`). Informative only. */
  unit: string | null;
  /** Two places. */
  unitPrice: DecimalString;
  /** Two places, always the full price. */
  grossValue: DecimalString;
  /** Two places. */
  allocatedDiscount: DecimalString;
  /** Two places, `grossValue - allocatedDiscount`. */
  netValue: DecimalString;
  isCompanyExpense: boolean;
  isStockMaterial: boolean;
}

/**
 * `PurchaseDetailView` of the API: the purchase with its lines. The picture of
 * the note as captured (`rawInvoiceData`) comes with it and is not read here.
 */
export interface PurchaseDetailDto {
  id: string;
  purchaseDate: string;
  accessKey: string | null;
  establishment: EstablishmentDto | null;
  grossTotal: DecimalString;
  discountTotal: DecimalString;
  netTotal: DecimalString;
  discountAllocationMode: DiscountAllocationMode;
  allocationPending: boolean;
  createdAt: string;
  /** The order is not guaranteed: the lines are keyed by `id`. */
  items: PurchaseItemDto[];
}
