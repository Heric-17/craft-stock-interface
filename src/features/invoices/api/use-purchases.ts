import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { toPurchasePage } from '../model/purchase';

import { purchaseKeys, type PurchaseFilters } from './purchase-keys';
import { fetchPurchases } from './purchase-requests';

/**
 * One page of the purchase history, newest first, as the API filters it: the
 * period is its parameter and `total` is the size of the filtered set. The
 * previous page stays on screen while the next one loads.
 */
export function usePurchases(filters: PurchaseFilters) {
  return useQuery({
    queryKey: purchaseKeys.list(filters),
    queryFn: ({ signal }) => fetchPurchases(filters, signal),
    placeholderData: keepPreviousData,
    select: toPurchasePage,
  });
}
