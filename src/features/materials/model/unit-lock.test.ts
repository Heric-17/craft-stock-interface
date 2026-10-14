import { describe, expect, it } from 'vitest';

import { ApiError } from '@/shared/api/api-error';
import { NON_BREAKING_SPACE } from '@/shared/format';
import { cera, materialDto } from '@/test/fixtures/materials';

import { toMaterial } from './material';
import { unitLockFromError, unitLockOf, unitLockText } from './unit-lock';

const SPACE = NON_BREAKING_SPACE;

function lockedError(details: unknown): ApiError {
  return new ApiError({
    statusCode: 422,
    code: 'CONSUMPTION_UNIT_LOCKED',
    error: 'ConsumptionUnitLockedError',
    message: 'English, for the log.',
    details,
  });
}

describe('the lock the screen can see on its own', () => {
  it('locks the unit while there is stock, and says how much', () => {
    const lock = unitLockOf(toMaterial(cera));

    expect(lock?.reason).toBe('STOCK_ON_HAND');
    expect(unitLockText(lock!)).toBe(
      `Há 680${SPACE}g em estoque deste insumo. Zere o estoque para poder trocar a unidade.`,
    );
  });

  it('leaves the unit free when there is no stock', () => {
    expect(unitLockOf(toMaterial(materialDto({ stockQuantity: 0 })))).toBeNull();
  });
});

describe('the lock the API reports', () => {
  const unit = 'GRAM' as const;

  it('reads the stock on hand from details', () => {
    const lock = unitLockFromError(
      lockedError({
        materialId: 'mat-cera',
        reason: 'STOCK_ON_HAND',
        stockQuantity: 1500,
        bomItemReferences: 0,
      }),
      unit,
    );

    expect(unitLockText(lock!)).toBe(
      `Há 1,5${SPACE}kg em estoque deste insumo. Zere o estoque para poder trocar a unidade.`,
    );
  });

  it('writes a different sentence when a bill of materials is what holds the unit', () => {
    const lock = unitLockFromError(
      lockedError({
        materialId: 'mat-cera',
        reason: 'BOM_REFERENCES',
        stockQuantity: 0,
        bomItemReferences: 3,
      }),
      unit,
    );

    expect(unitLockText(lock!)).toBe(
      '3 fichas técnicas usam este insumo nesta unidade. Remova essas linhas para poder trocá-la.',
    );
  });

  it('uses the singular for one bill of materials', () => {
    const lock = unitLockFromError(
      lockedError({
        materialId: 'mat-cera',
        reason: 'BOM_REFERENCES',
        stockQuantity: 0,
        bomItemReferences: 1,
      }),
      unit,
    );

    expect(unitLockText(lock!)).toBe(
      'Uma ficha técnica usa este insumo nesta unidade. Remova essa linha para poder trocá-la.',
    );
  });

  it('is nothing for another error', () => {
    const other = new ApiError({
      statusCode: 422,
      code: 'MATERIAL_NOT_FOUND',
      error: 'E',
      message: 'm',
    });

    expect(unitLockFromError(other, unit)).toBeNull();
  });
});
