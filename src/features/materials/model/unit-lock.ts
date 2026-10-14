import type { ApiError } from '@/shared/api/api-error';
import { formatQuantity } from '@/shared/format';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { Material } from './material';

/**
 * Why a material's consumption unit cannot change. The unit reinterprets every
 * quantity recorded against the material, so it is locked while any exists —
 * and the way out is different for each reason, which is why the screen says
 * which one it is.
 */
export type UnitLock =
  | { reason: 'STOCK_ON_HAND'; stock: Quantity }
  | { reason: 'BOM_REFERENCES'; billOfMaterialsCount: number };

/**
 * What the screen can know before asking: stock on hand. Whether a bill of
 * materials uses the material is not on a `Material`, so that reason is learned
 * from the API's answer, by {@link unitLockFromError}.
 */
export function unitLockOf(material: Material): UnitLock | null {
  return material.stockQuantity.isZero()
    ? null
    : { reason: 'STOCK_ON_HAND', stock: material.stockQuantity };
}

/**
 * The lock the API reported, read from `details` — the quantities and counts it
 * sends, never the English message.
 */
export function unitLockFromError(error: ApiError, unit: ConsumptionUnit): UnitLock | null {
  const details = error.detailsFor('CONSUMPTION_UNIT_LOCKED');

  if (details === undefined) {
    return null;
  }

  return details.reason === 'STOCK_ON_HAND'
    ? { reason: 'STOCK_ON_HAND', stock: Quantity.fromApi(details.stockQuantity, unit) }
    : { reason: 'BOM_REFERENCES', billOfMaterialsCount: details.bomItemReferences };
}

/** The sentence written beside the disabled field. */
export function unitLockText(lock: UnitLock): string {
  if (lock.reason === 'STOCK_ON_HAND') {
    return `Há ${formatQuantity(lock.stock)} em estoque deste insumo. Zere o estoque para poder trocar a unidade.`;
  }

  return lock.billOfMaterialsCount === 1
    ? 'Uma ficha técnica usa este insumo nesta unidade. Remova essa linha para poder trocá-la.'
    : `${lock.billOfMaterialsCount} fichas técnicas usam este insumo nesta unidade. Remova essas linhas para poder trocá-la.`;
}
