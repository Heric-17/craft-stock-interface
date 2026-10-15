import { request } from '@/shared/api/http-client';

import type {
  InventorySummaryFilters,
  MaterialFilters,
  StockLossDatasetFilters,
  StockLossFilters,
} from './material-keys';
import type {
  ChangeConsumptionUnitRequestDto,
  CreateMaterialRequestDto,
  InventorySummaryDto,
  MaterialDto,
  MaterialPriceHistoryDto,
  StockEntryRequestDto,
  UpdateMaterialRequestDto,
} from './material.dto';
import type {
  RecordLossRequestDto,
  StockLossDatasetDto,
  StockLossDto,
  StockLossPageDto,
  StockLossResultDto,
} from './stock-loss.dto';

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

export function postStockEntry(id: string, body: StockEntryRequestDto): Promise<MaterialDto> {
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

/**
 * A loss with its reason. Not the same route as an entry, even though both
 * change the stock: the API keeps this one as a record with a frozen cost, and
 * answers with it and the balance that is left.
 */
export function postStockLoss(id: string, body: RecordLossRequestDto): Promise<StockLossResultDto> {
  return request<StockLossResultDto>(`/materials/${encodeURIComponent(id)}/losses`, {
    method: 'POST',
    body,
  });
}

/**
 * Deletes a loss that was recorded by mistake and answers with what was deleted,
 * in the shape of a row of the list, so the screen can say how much to put back.
 *
 * **The stock does not change.** The loss leaves the list and the total of the
 * period and nothing else: what it took out of the shelf stays out until
 * somebody counts it back.
 */
export function deleteStockLoss(lossId: string): Promise<StockLossDto> {
  return request<StockLossDto>(`/materials/losses/${encodeURIComponent(lossId)}`, {
    method: 'DELETE',
  });
}

export function fetchStockLosses(
  filters: StockLossFilters,
  signal: AbortSignal,
): Promise<StockLossPageDto> {
  return request<StockLossPageDto>('/materials/losses', {
    signal,
    query: {
      from: filters.from,
      to: filters.to,
      materialId: filters.materialId,
      reason: filters.reason,
      limit: filters.limit,
      offset: filters.offset,
    },
  });
}

export function fetchStockLossDataset(
  filters: StockLossDatasetFilters,
  signal: AbortSignal,
): Promise<StockLossDatasetDto> {
  return request<StockLossDatasetDto>('/materials/losses/dataset', {
    signal,
    query: { from: filters.from, to: filters.to },
  });
}
