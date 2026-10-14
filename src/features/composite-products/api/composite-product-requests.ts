import { request } from '@/shared/api/http-client';

import type { CompositeProductFilters } from './composite-product-keys';
import type {
  CompositeProductDto,
  CreateCompositeProductRequestDto,
  UpdateCompositeProductRequestDto,
} from './composite-product.dto';

/**
 * One function per route of `/composite-products`, and the only place those
 * paths are written. The hooks wrap them; nothing else calls the HTTP client.
 */

export function fetchCompositeProducts(
  filters: CompositeProductFilters,
  signal: AbortSignal,
): Promise<CompositeProductDto[]> {
  return request<CompositeProductDto[]>('/composite-products', {
    signal,
    query: { includeDiscontinued: filters.includeDiscontinued },
  });
}

export function fetchCompositeProduct(
  id: string,
  signal: AbortSignal,
): Promise<CompositeProductDto> {
  return request<CompositeProductDto>(`/composite-products/${encodeURIComponent(id)}`, { signal });
}

export function postCompositeProduct(
  body: CreateCompositeProductRequestDto,
): Promise<CompositeProductDto> {
  return request<CompositeProductDto>('/composite-products', { method: 'POST', body });
}

export function patchCompositeProduct(
  id: string,
  body: UpdateCompositeProductRequestDto,
): Promise<CompositeProductDto> {
  return request<CompositeProductDto>(`/composite-products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
}

export function postDiscontinue(id: string): Promise<CompositeProductDto> {
  return request<CompositeProductDto>(`/composite-products/${encodeURIComponent(id)}/discontinue`, {
    method: 'POST',
  });
}

export function postReactivate(id: string): Promise<CompositeProductDto> {
  return request<CompositeProductDto>(`/composite-products/${encodeURIComponent(id)}/reactivate`, {
    method: 'POST',
  });
}

export function deleteCompositeProduct(id: string): Promise<void> {
  return request<void>(`/composite-products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** The second call of "create with a photo": `multipart/form-data`, field `file`. */
export function postCompositeProductImage(id: string, file: File): Promise<CompositeProductDto> {
  const formData = new FormData();
  formData.append('file', file);

  return request<CompositeProductDto>(`/composite-products/${encodeURIComponent(id)}/image`, {
    method: 'POST',
    formData,
  });
}

export function deleteCompositeProductImage(id: string): Promise<CompositeProductDto> {
  return request<CompositeProductDto>(`/composite-products/${encodeURIComponent(id)}/image`, {
    method: 'DELETE',
  });
}
