import { QUERY_ROOTS } from '@/shared/api/query-roots';

/**
 * `from` inclusive and `to` exclusive, both instants with the offset of
 * `America/Sao_Paulo`. The granularity is not a filter: the chart draws months,
 * so months are what is asked for.
 */
export interface SpendingDatasetFilters {
  from: string;
  to: string;
}

const root = [QUERY_ROOTS.spending] as const;

export const spendingKeys = {
  all: root,
  // Under the spending root on purpose: a note imported or classified invalidates it.
  dataset: (filters: SpendingDatasetFilters) => [...root, 'dataset', filters] as const,
};
