import { request } from '@/shared/api/http-client';

import type { PendingInvoiceFilters } from './invoice-keys';
import type {
  ClassificationRequestDto,
  ImportedInvoiceDto,
  PendingInvoicePageDto,
} from './invoice.dto';

/**
 * One function per route of `/invoices` this screen uses, and the only place
 * those paths are written. The hooks wrap them; nothing else calls the HTTP
 * client.
 */

export function fetchPendingInvoices(
  filters: PendingInvoiceFilters,
  signal: AbortSignal,
): Promise<PendingInvoicePageDto> {
  return request<PendingInvoicePageDto>('/invoices/pending', {
    signal,
    query: { status: filters.status, limit: filters.limit, offset: filters.offset },
  });
}

/**
 * The API reads the portal before it answers, retrying on its own when the
 * portal does not respond: this request can take several seconds, and that is
 * the import, not a fault.
 */
export function postInvoiceImport(url: string): Promise<ImportedInvoiceDto> {
  return request<ImportedInvoiceDto>('/invoices/imports', { method: 'POST', body: { url } });
}

export function postInvoiceReprocess(pendingInvoiceId: string): Promise<ImportedInvoiceDto> {
  return request<ImportedInvoiceDto>(
    `/invoices/pending/${encodeURIComponent(pendingInvoiceId)}/reprocess`,
    { method: 'POST' },
  );
}

/**
 * Says what the note bought. **Not idempotent:** every call that carries a line
 * as stock gives that line's stock entry again, so a line is sent once, in the
 * request that concludes the classification, and never to save a draft.
 */
export function postClassification(
  purchaseId: string,
  body: ClassificationRequestDto,
): Promise<ImportedInvoiceDto> {
  return request<ImportedInvoiceDto>(
    `/invoices/purchases/${encodeURIComponent(purchaseId)}/classification`,
    { method: 'POST', body },
  );
}
