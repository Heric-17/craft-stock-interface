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
