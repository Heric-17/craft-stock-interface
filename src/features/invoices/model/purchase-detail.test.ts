import { describe, expect, it } from 'vitest';

import { requireDecimalString as dec } from '@/shared/money';

import type { PurchaseDetailDto, PurchaseItemDto } from '../api/purchase.dto';

import { readablePrintedUnit, toPurchaseDetail } from './purchase-detail';

function item(overrides: Partial<PurchaseItemDto>): PurchaseItemDto {
  return {
    id: 'item-1',
    materialId: null,
    code: null,
    description: 'FARINHA DE TRIGO 1KG',
    quantity: 2,
    unit: 'UND9',
    unitPrice: dec('10.00'),
    grossValue: dec('20.00'),
    allocatedDiscount: dec('0.00'),
    netValue: dec('20.00'),
    isCompanyExpense: true,
    isStockMaterial: false,
    ...overrides,
  };
}

function dto(overrides: Partial<PurchaseDetailDto> = {}): PurchaseDetailDto {
  return {
    id: 'compra-1',
    purchaseDate: '2026-10-12T17:20:00.000Z',
    accessKey: null,
    establishment: { id: '1', name: 'Mercado do Zé', cnpj: null },
    grossTotal: dec('30.00'),
    discountTotal: dec('0.00'),
    netTotal: dec('30.00'),
    discountAllocationMode: 'PROPORTIONAL',
    allocationPending: false,
    createdAt: '2026-10-12T17:25:00.000Z',
    items: [item({})],
    ...overrides,
  };
}

describe('readablePrintedUnit', () => {
  it('takes the till suffix off a known unit', () => {
    expect(readablePrintedUnit('UND9')).toBe('UN');
    expect(readablePrintedUnit('KG9')).toBe('KG');
    expect(readablePrintedUnit('pct')).toBe('PCT');
  });

  it('leaves a code it does not know exactly as printed', () => {
    expect(readablePrintedUnit('XYZ9')).toBe('XYZ9');
  });

  it('says nothing for a note that printed no unit', () => {
    expect(readablePrintedUnit(null)).toBeNull();
    expect(readablePrintedUnit('  ')).toBeNull();
  });
});

describe('toPurchaseDetail', () => {
  it('asks how to spread the discount only for a note that has one', () => {
    expect(toPurchaseDetail(dto()).requiresDiscountAllocationChoice).toBe(false);
    expect(
      toPurchaseDetail(dto({ discountTotal: dec('6.00'), netTotal: dec('24.00') }))
        .requiresDiscountAllocationChoice,
    ).toBe(true);
  });

  it('keeps the lines in a stable order, whatever order they arrive in', () => {
    const lines = [
      item({ id: 'c', description: 'Pavio' }),
      item({ id: 'a', description: 'Cera' }),
      item({ id: 'b', description: 'Cera' }),
    ];
    const forward = toPurchaseDetail(dto({ items: lines })).lines.map((entry) => entry.id);
    const backward = toPurchaseDetail(dto({ items: [...lines].reverse() })).lines.map(
      (entry) => entry.id,
    );

    expect(forward).toEqual(['a', 'b', 'c']);
    expect(backward).toEqual(forward);
  });

  it('names the shop, or says it is unknown', () => {
    expect(toPurchaseDetail(dto()).establishmentName).toBe('Mercado do Zé');
    expect(toPurchaseDetail(dto({ establishment: null })).establishmentName).toBe(
      'Estabelecimento não identificado',
    );
  });
});
