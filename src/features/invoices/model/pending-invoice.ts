import type { PendingInvoiceDto, PendingInvoicePageDto } from '../api/invoice.dto';

import type { PendingInvoiceStatus } from './status';

/**
 * How often the queue is read again while a note is being processed.
 */
export const POLL_INTERVAL_MS = 5_000;

/**
 * How long a capture with no attempt recorded is believed to be in progress.
 *
 * The import runs inside the request that created it, and the longest it can
 * take is three reads of the portal with a pause between them — well under a
 * minute. A capture still without any attempt after this long is not being
 * worked on: the server restarted in the middle of it. Treating it as
 * "processing" forever would poll for nothing and leave the person with no way
 * to retry.
 */
export const PROCESSING_TIMEOUT_MS = 5 * 60_000;

/**
 * What a capture is, as the screen tells it. The API's `status` has three
 * values and the screen needs five, because two of them hide two different
 * situations:
 *
 * - `PENDING` with no attempt recorded is a note being read right now (a scan
 *   made on a phone, being watched from a computer). `PENDING` with an attempt
 *   recorded is one the portal answered but could not be read: the API parks it
 *   there on purpose, as `INVOICE_STRUCTURE_CHANGED`, so it becomes retryable
 *   the moment the reader is fixed. Nothing else ever leaves a capture in
 *   `PENDING` after an attempt.
 * - `UNSTABLE` is the portal not answering, `INVOICE_SOURCE_UNAVAILABLE`.
 */
export type InvoiceState =
  'PROCESSING' | 'STALLED' | 'SOURCE_UNAVAILABLE' | 'STRUCTURE_CHANGED' | 'IMPORTED';

/** What decides the state. The API's shape and the view model both fit it. */
export interface InvoiceStateInput {
  status: PendingInvoiceStatus;
  attemptCount: number;
  /** ISO 8601. */
  createdAt: string;
}

export function deriveInvoiceState(invoice: InvoiceStateInput, now: Date): InvoiceState {
  if (invoice.status === 'IMPORTED') {
    return 'IMPORTED';
  }

  if (invoice.status === 'UNSTABLE') {
    return 'SOURCE_UNAVAILABLE';
  }

  if (invoice.attemptCount > 0) {
    return 'STRUCTURE_CHANGED';
  }

  const waitingFor = now.getTime() - new Date(invoice.createdAt).getTime();

  return waitingFor > PROCESSING_TIMEOUT_MS ? 'STALLED' : 'PROCESSING';
}

/** Whether any of these captures is being read right now: what keeps the polling going. */
export function hasProcessingInvoice(invoices: readonly InvoiceStateInput[], now: Date): boolean {
  return invoices.some((invoice) => deriveInvoiceState(invoice, now) === 'PROCESSING');
}

/** A capture in the queue. The API does not say which shop it was, or for how much: that is only known once it is imported. */
export interface PendingInvoice {
  id: string;
  status: PendingInvoiceStatus;
  attemptCount: number;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601, or `null` before the first attempt finishes. */
  lastAttemptAt: string | null;
  /** The purchase this capture became. Set once it is imported. */
  purchaseId: string | null;
}

export interface PendingInvoicePage {
  items: PendingInvoice[];
  /** The size of the filtered queue, not of this page. */
  total: number;
  limit: number;
  offset: number;
}

export function toPendingInvoice(dto: PendingInvoiceDto): PendingInvoice {
  return {
    id: dto.id,
    status: dto.status,
    attemptCount: dto.attemptCount,
    createdAt: dto.createdAt,
    lastAttemptAt: dto.lastAttemptAt,
    purchaseId: dto.purchaseId,
  };
}

export function toPendingInvoicePage(dto: PendingInvoicePageDto): PendingInvoicePage {
  return {
    items: dto.items.map(toPendingInvoice),
    total: dto.total,
    limit: dto.limit,
    offset: dto.offset,
  };
}

/**
 * Two lists the API answered, each newest first, as one. ISO timestamps of the
 * same shape sort as text, which is what keeps this free of any date arithmetic.
 */
export function mergeNewestFirst(
  first: readonly PendingInvoice[],
  second: readonly PendingInvoice[],
): PendingInvoice[] {
  return [...first, ...second].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
