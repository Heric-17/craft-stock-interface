import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  hasProcessingInvoice,
  POLL_INTERVAL_MS,
  toPendingInvoicePage,
} from '../model/pending-invoice';

import { invoiceKeys, type PendingInvoiceFilters } from './invoice-keys';
import { fetchPendingInvoices } from './invoice-requests';

/**
 * One page of the import queue, as the API filters it. The previous page stays
 * on screen while the next one loads.
 *
 * It is read again every few seconds while a note on this page is being
 * processed — a scan made on a phone, finished on whatever screen is open — and
 * not at all otherwise. The decision is made from what the last response said,
 * so the polling stops by itself the moment nothing is left to wait for.
 */
export function usePendingInvoices(filters: PendingInvoiceFilters) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: ({ signal }) => fetchPendingInvoices(filters, signal),
    placeholderData: keepPreviousData,
    select: toPendingInvoicePage,
    refetchInterval: (query) => {
      const page = query.state.data;

      return page !== undefined && hasProcessingInvoice(page.items, new Date())
        ? POLL_INTERVAL_MS
        : false;
    },
  });
}
