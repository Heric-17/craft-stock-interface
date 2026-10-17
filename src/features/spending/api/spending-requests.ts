import { request } from '@/shared/api/http-client';

import type { SpendingDatasetFilters } from './spending-keys';
import type { SpendingDatasetDto } from './spending.dto';

/** The only place the path of the spending dataset is written. */
export function fetchSpendingDataset(
  filters: SpendingDatasetFilters,
  signal: AbortSignal,
): Promise<SpendingDatasetDto> {
  return request<SpendingDatasetDto>('/purchases/spending', {
    signal,
    query: { from: filters.from, to: filters.to, granularity: 'MONTH' },
  });
}
