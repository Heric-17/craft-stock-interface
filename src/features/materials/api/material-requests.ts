import { request } from '@/shared/api/http-client';

import type { MaterialFilters, InventorySummaryFilters } from './material-keys';
import type {
  ChangeConsumptionUnitRequestDto,
  CreateMaterialRequestDto,
  InventorySummaryDto,
  MaterialDto,
  MaterialPriceHistoryDto,
  StockAdjustmentRequestDto,
  UpdateMaterialRequestDto,
} from './material.dto';

/**
 * One function per route of `/materials`, and the only place those paths are
 * written. The hooks wrap them; nothing else calls the HTTP client.
 */

export function fetchMaterials(
  filters: MaterialFilters,
  signal: AbortSignal,
): Promise<MaterialDto[]> {
  return request<MaterialDto[]>('/materials', {
    signal,
    query: { name: filters.name, includeDiscontinued: filters.includeDiscontinued },
  });
}

export function fetchMaterial(id: string, signal: AbortSignal): Promise<MaterialDto> {
  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}`, { signal });
}

export function fetchPriceHistory(
  id: string,
  signal: AbortSignal,
): Promise<MaterialPriceHistoryDto[]> {
  return request<MaterialPriceHistoryDto[]>(`/materials/${encodeURIComponent(id)}/price-history`, {
    signal,
  });
}

export function fetchInventorySummary(
  filters: InventorySummaryFilters,
  signal: AbortSignal,
): Promise<InventorySummaryDto> {
  return request<InventorySummaryDto>('/materials/inventory-summary', {
    signal,
    query: { includeDiscontinued: filters.includeDiscontinued },
  });
}

export function postMaterial(body: CreateMaterialRequestDto): Promise<MaterialDto> {
  return request<MaterialDto>('/materials', { method: 'POST', body });
}

export function patchMaterial(id: string, body: UpdateMaterialRequestDto): Promise<MaterialDto> {
  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}`, { method: 'PATCH', body });
}

export function patchConsumptionUnit(
  id: string,
  body: ChangeConsumptionUnitRequestDto,
): Promise<MaterialDto> {
  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}/consumption-unit`, {
    method: 'PATCH',
    body,
  });
}

export function postStockEntry(id: string, body: StockAdjustmentRequestDto): Promise<MaterialDto> {
  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}/stock-entries`, {
    method: 'POST',
    body,
  });
}

export function postDiscontinue(id: string): Promise<MaterialDto> {
  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}/discontinue`, {
    method: 'POST',
  });
}

export function postReactivate(id: string): Promise<MaterialDto> {
  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}/reactivate`, {
    method: 'POST',
  });
}

export function deleteMaterial(id: string): Promise<void> {
  return request<void>(`/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** The second call of "create with a photo": `multipart/form-data`, field `file`. */
export function postMaterialImage(id: string, file: File): Promise<MaterialDto> {
  const formData = new FormData();
  formData.append('file', file);

  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}/image`, {
    method: 'POST',
    formData,
  });
}

export function deleteMaterialImage(id: string): Promise<MaterialDto> {
  return request<MaterialDto>(`/materials/${encodeURIComponent(id)}/image`, { method: 'DELETE' });
}
