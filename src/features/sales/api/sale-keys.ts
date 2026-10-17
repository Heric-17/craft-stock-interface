import { QUERY_ROOTS } from '@/shared/api/query-roots';

import type { PaymentStatus, ProductionStatus } from '../model/status';

/**
 * The history's filters, all parameters the API accepts. They are sent with
 * the request and never applied to the page on this side: `total` is the size
 * of the filtered set, which only holds if the filter ran there.
 */
export interface SaleFilters {
  paymentStatus?: PaymentStatus | undefined;
  productionStatus?: ProductionStatus | undefined;
  limit: number;
  offset: number;
}

/** `from` inclusive, `to` exclusive, both instants with the offset of `America/Sao_Paulo`. */
export interface SalesDatasetFilters {
  from: string;
  to: string;
}

const root = [QUERY_ROOTS.sales] as const;

export const saleKeys = {
  all: root,
  lists: () => [...root, 'list'] as const,
  list: (filters: SaleFilters) => [...root, 'list', filters] as const,
  details: () => [...root, 'detail'] as const,
  detail: (id: string) => [...root, 'detail', id] as const,
  // Every sale whose production is still pending, whole. Under the sales root
  // like the rest, so any change to a sale reads it again.
  productionPending: () => [...root, 'production-pending'] as const,
  // Under the sales root on purpose: any change to a sale invalidates it, and
  // the cards at the top of the list go with it.
  dataset: (filters: SalesDatasetFilters) => [...root, 'dataset', filters] as const,
};
