import { request } from '@/shared/api/http-client';

import type { PurchaseFilters } from './purchase-keys';
import type { PurchaseDetailDto, PurchasePageDto } from './purchase.dto';

export function fetchPurchases(
  filters: PurchaseFilters,
  signal: AbortSignal,
): Promise<PurchasePageDto> {
  return request<PurchasePageDto>('/purchases', {
    signal,
    query: {
      from: filters.from,
      to: filters.to,
      limit: filters.limit,
      offset: filters.offset,
    },
  });
}

/** One purchase with its lines. The id must be a UUID: anything else is a 400. */
export function fetchPurchase(id: string, signal: AbortSignal): Promise<PurchaseDetailDto> {
  return request<PurchaseDetailDto>(`/purchases/${encodeURIComponent(id)}`, { signal });
}
