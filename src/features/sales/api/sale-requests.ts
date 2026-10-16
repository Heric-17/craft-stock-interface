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
