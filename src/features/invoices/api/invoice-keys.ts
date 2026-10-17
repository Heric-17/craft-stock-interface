import { QUERY_ROOTS } from '@/shared/api/query-roots';

import type { PendingInvoiceStatus } from '../model/status';

/**
 * The queue's filter and page, all parameters the API accepts. They are sent
 * with the request: `total` is the size of the filtered queue, which only holds
 * if the filter ran there.
 */
export interface PendingInvoiceFilters {
  status?: PendingInvoiceStatus | undefined;
  limit: number;
  offset: number;
}

const root = [QUERY_ROOTS.invoices] as const;

export const invoiceKeys = {
  all: root,
  lists: () => [...root, 'list'] as const,
  list: (filters: PendingInvoiceFilters) => [...root, 'list', filters] as const,
};
