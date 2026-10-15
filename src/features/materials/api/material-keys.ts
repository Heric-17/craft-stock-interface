import { QUERY_ROOTS } from '@/shared/api/query-roots';

/** What narrows the list the backend returns. Both are parameters it accepts. */
export interface MaterialFilters {
  name?: string | undefined;
  includeDiscontinued: boolean;
}

export interface InventorySummaryFilters {
  includeDiscontinued: boolean;
}

/**
 * The loss history's filters, all parameters the API accepts. `from` and `to`
 * are instants with the offset of `America/Sao_Paulo`, built by `buildPeriodRange`.
 */
export interface StockLossFilters {
  from: string;
  to: string;
  materialId?: string | undefined;
  reason?: string | undefined;
  limit: number;
  offset: number;
}

export interface StockLossDatasetFilters {
  from: string;
  to: string;
}

const root = [QUERY_ROOTS.materials] as const;

export const materialKeys = {
  all: root,
  lists: () => [...root, 'list'] as const,
  list: (filters: MaterialFilters) => [...root, 'list', filters] as const,
  details: () => [...root, 'detail'] as const,
  detail: (id: string) => [...root, 'detail', id] as const,
  priceHistory: (id: string) => [...root, 'detail', id, 'price-history'] as const,
  summary: (filters: InventorySummaryFilters) => [...root, 'summary', filters] as const,
  // Under the materials root on purpose: a change to any material's stock
  // invalidates that root, and the loss list and its dataset go with it.
  losses: () => [...root, 'losses'] as const,
  lossList: (filters: StockLossFilters) => [...root, 'losses', 'list', filters] as const,
  lossDataset: (filters: StockLossDatasetFilters) =>
    [...root, 'losses', 'dataset', filters] as const,
};
