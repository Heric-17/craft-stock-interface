import { QUERY_ROOTS } from '@/shared/api/query-roots';

/** What narrows the list the backend returns. Both are parameters it accepts. */
export interface MaterialFilters {
  name?: string | undefined;
  includeDiscontinued: boolean;
}

export interface InventorySummaryFilters {
  includeDiscontinued: boolean;
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
};
