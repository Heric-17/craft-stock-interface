import { request } from '@/shared/api/http-client';

import type { PurchaseFilters } from './purchase-keys';
import type { PurchasePageDto } from './purchase.dto';

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
