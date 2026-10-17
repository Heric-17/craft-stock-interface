import { useQuery } from '@tanstack/react-query';

import { toSpendingDataset } from '../model/spending-dataset';

import { spendingKeys, type SpendingDatasetFilters } from './spending-keys';
import { fetchSpendingDataset } from './spending-requests';

/**
 * The spending dataset of a period, by month. The figures on screen are derived
 * from it in `model/spending-metrics.ts` — never asked of the API as a finished
 * number, and never added up from the rows of the purchase list, which is one
 * page of a longer history.
 */
export function useSpendingDataset(filters: SpendingDatasetFilters) {
  return useQuery({
    queryKey: spendingKeys.dataset(filters),
    queryFn: ({ signal }) => fetchSpendingDataset(filters, signal),
    select: toSpendingDataset,
  });
}
