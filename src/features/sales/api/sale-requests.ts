import { request } from '@/shared/api/http-client';

import type { ProductionStatus, PaymentStatus } from '../model/status';

import type { SaleFilters, SalesDatasetFilters } from './sale-keys';
import type {
  CreateSaleRequestDto,
  SaleDto,
  SalePageDto,
  SalesDatasetDto,
  UpdateSaleDetailsRequestDto,
} from './sale.dto';

/**
 * One function per route of `/sales`, and the only place those paths are
 * written. The hooks wrap them; nothing else calls the HTTP client.
 */

const saleUrl = (id: string) => `/sales/${encodeURIComponent(id)}`;

export function fetchSales(filters: SaleFilters, signal: AbortSignal): Promise<SalePageDto> {
  return request<SalePageDto>('/sales', {
    signal,
    query: {
      paymentStatus: filters.paymentStatus,
      productionStatus: filters.productionStatus,
      limit: filters.limit,
      offset: filters.offset,
    },
  });
}

/** The API's ceiling for `limit`: a bigger one is refused with a 400. */
const MAX_PAGE_SIZE = 100;

/**
 * Every sale whose production is still pending, read page by page until the
 * API's own `total` is reached. The shortage list is built from a set of sale
 * ids, and a screen that only knew the first page would leave the rest of the
 * open orders out of what has to be bought, without any sign of it.
 */
export async function fetchEveryProductionPendingSale(signal: AbortSignal): Promise<SalePageDto> {
  const items: SaleDto[] = [];

  for (;;) {
    const page = await fetchSales(
      { productionStatus: 'PENDING', limit: MAX_PAGE_SIZE, offset: items.length },
      signal,
    );

    items.push(...page.items);

    // A page with nothing in it ends the loop even if `total` says otherwise: a
    // sale that moved out between two requests must not make this wait forever.
    if (page.items.length === 0 || items.length >= page.total) {
      return { items, total: page.total, limit: MAX_PAGE_SIZE, offset: 0 };
    }
  }
}

export function fetchSale(id: string, signal: AbortSignal): Promise<SaleDto> {
  return request<SaleDto>(saleUrl(id), { signal });
}

export function fetchSalesDataset(
  filters: SalesDatasetFilters,
  signal: AbortSignal,
): Promise<SalesDatasetDto> {
  return request<SalesDatasetDto>('/sales/analytics', {
    signal,
    query: { from: filters.from, to: filters.to },
  });
}

export function postSale(body: CreateSaleRequestDto): Promise<SaleDto> {
  return request<SaleDto>('/sales', { method: 'POST', body });
}

export function patchSaleDetails(id: string, body: UpdateSaleDetailsRequestDto): Promise<SaleDto> {
  return request<SaleDto>(saleUrl(id), { method: 'PATCH', body });
}

export function patchItemQuantity(
  saleId: string,
  itemId: string,
  quantity: number,
): Promise<SaleDto> {
  return request<SaleDto>(`${saleUrl(saleId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: { quantity },
  });
}

export function deleteSaleItem(saleId: string, itemId: string): Promise<SaleDto> {
  return request<SaleDto>(`${saleUrl(saleId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}

export function patchPaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<SaleDto> {
  return request<SaleDto>(`${saleUrl(id)}/payment-status`, {
    method: 'PATCH',
    body: { paymentStatus },
  });
}

export function patchProductionStatus(
  id: string,
  productionStatus: ProductionStatus,
): Promise<SaleDto> {
  return request<SaleDto>(`${saleUrl(id)}/production-status`, {
    method: 'PATCH',
    body: { productionStatus },
  });
}
