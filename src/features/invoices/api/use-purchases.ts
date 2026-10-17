import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { toPurchasePage } from '../model/purchase';
import { toPurchaseDetail } from '../model/purchase-detail';

import { purchaseKeys, type PurchaseFilters } from './purchase-keys';
import { fetchPurchase, fetchPurchases } from './purchase-requests';

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

/**
 * One purchase with its lines, for the classification screen. The id comes from
 * the address, so a malformed one is the API's 400 and not something to guard
 * against here.
 */
export function usePurchase(id: string) {
  return useQuery({
    queryKey: purchaseKeys.detail(id),
    queryFn: ({ signal }) => fetchPurchase(id, signal),
    select: toPurchaseDetail,
  });
}
