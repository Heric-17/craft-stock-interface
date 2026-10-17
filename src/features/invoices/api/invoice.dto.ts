import type { ConsumptionUnit } from '@/shared/quantity';

import type { DiscountAllocationMode } from '../model/discount-mode';
import type { PendingInvoiceStatus } from '../model/status';

/**
 * `PendingInvoiceView` of the API: one capture in the import queue. It does not
 * carry the shop, the total or the access key — those exist only once the note
 * has been read, on the purchase it became.
 */
export interface PendingInvoiceDto {
  id: string;
  /** The URL of the QR Code. */
  url: string;
  status: PendingInvoiceStatus;
  attemptCount: number;
  /** ISO 8601. */
  lastAttemptAt: string | null;
  purchaseId: string | null;
  /** The reason of the last failure, in English and for the log: never shown, never read. */
  lastError: string | null;
  /** ISO 8601. */
  createdAt: string;
}

export interface PendingInvoicePageDto {
  items: PendingInvoiceDto[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * What `POST /invoices/imports` and `POST /invoices/pending/:id/reprocess`
 * answer with: the note that was read. Only what the capture screen uses is
 * typed here — the lines, the totals and the discount belong to the
 * classification screen, which is where they are read.
 */
export interface ImportedInvoiceDto {
  purchaseId: string;
  pendingInvoiceId: string | null;
  merchantName: string | null;
}

/** The insumo a stock line is to create, when none of the existing ones is it. */
export interface NewMaterialRequestDto {
  name: string;
  consumptionUnit: ConsumptionUnit;
}

/**
 * One line of the classification. The line is a stock line when `isStockMaterial`
 * is set, and then it names its material (`materialId`, or `newMaterial` to create
 * one) and how much one package holds. A line that is not stock sends neither.
 */
export interface ClassifiedItemRequestDto {
  itemId: string;
  isCompanyExpense: boolean;
  isStockMaterial: boolean;
  materialId?: string;
  newMaterial?: NewMaterialRequestDto;
  /** A `number` with at most three places: the column holds `Decimal(12,3)`. */
  packageQuantity?: number;
}

export interface ManualAllocationRequestDto {
  itemId: string;
  /** Two places. */
  allocatedDiscount: string;
}

/**
 * `POST /invoices/purchases/:purchaseId/classification`. The lines and the
 * discount mode go in the same request on purpose: the API spreads the discount
 * at the end, over the lines as they will be, so a combination that is valid
 * together is not refused halfway.
 */
export interface ClassificationRequestDto {
  items: ClassifiedItemRequestDto[];
  discountAllocationMode?: DiscountAllocationMode;
  manualAllocation?: ManualAllocationRequestDto[];
}
