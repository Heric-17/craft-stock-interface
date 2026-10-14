import { describe, expect, it } from 'vitest';

import { formatMoney, formatQuantity, formatUnitCost, NON_BREAKING_SPACE } from '@/shared/format';
import { Money, requireDecimalString } from '@/shared/money';
import { Quantity } from '@/shared/quantity';
import {
  cera,
  essencia,
  inventorySummary,
  materialDto,
  pavio,
  priceHistory,
} from '@/test/fixtures/materials';

import { toInventorySummary, toMaterial, toPriceHistory } from './material';

const SPACE = NON_BREAKING_SPACE;

describe('toMaterial', () => {
  it('turns the wire strings and numbers into Money and Quantity', () => {
    const material = toMaterial(cera);

    expect(material.packageCost).toBeInstanceOf(Money);
    expect(material.unitCost).toBeInstanceOf(Money);
    expect(material.stockValue).toBeInstanceOf(Money);
    expect(material.packageQuantity).toBeInstanceOf(Quantity);
    expect(material.stockQuantity).toBeInstanceOf(Quantity);
    expect(material.minimumStockAlert).toBeInstanceOf(Quantity);
  });

  it('keeps every quantity in the consumption unit of the material', () => {
    const material = toMaterial(essencia);

    expect(material.packageQuantity.unit).toBe('MILLILITER');
    expect(material.stockQuantity.unit).toBe('MILLILITER');
    expect(material.minimumStockAlert.unit).toBe('MILLILITER');
  });

  it('carries the fractional cost with its four places, exact', () => {
    // 0.0280 per gram is 28,00 per kilo: the conversion loses nothing.
    expect(formatUnitCost(toMaterial(cera).unitCost, 'GRAM')).toBe(`R$${SPACE}28,00/kg`);
    expect(formatUnitCost(toMaterial(essencia).unitCost, 'MILLILITER')).toBe(`R$${SPACE}380,00/L`);
    expect(formatUnitCost(toMaterial(pavio).unitCost, 'UNIT')).toBe(`R$${SPACE}0,21/un`);
  });

  it('never shows a per-gram cost with two places', () => {
    const shown = formatUnitCost(toMaterial(cera).unitCost, 'GRAM');

    expect(shown).not.toContain('/g');
    expect(shown).not.toContain(`0,03`);
  });

  it('reads a fractional quantity the way it was typed on the other side', () => {
    // 0.145 reaches the browser as 0.14499999999999999 and must not become 144.
    const material = toMaterial(materialDto({ stockQuantity: 0.145, packageQuantity: 1500.001 }));

    expect(formatQuantity(material.stockQuantity)).toBe(`0,145${SPACE}g`);
    expect(material.packageQuantity.toDecimalString()).toBe('1500.001');
  });

  it('carries the backend stock value and low-stock flag untouched', () => {
    const material = toMaterial(essencia);

    expect(formatMoney(material.stockValue)).toBe(`R$${SPACE}6,84`);
    expect(material.lowStock).toBe(true);
  });

  it('does not recompute the stock value, even when the product would differ', () => {
    // 0.0280 x 680 is 19.04; a value the backend rounded otherwise stays as sent.
    const material = toMaterial(materialDto({ stockValue: requireDecimalString('19.05') }));

    expect(formatMoney(material.stockValue)).toBe(`R$${SPACE}19,05`);
  });

  it('keeps the discontinuation of a discontinued material', () => {
    const material = toMaterial(
      materialDto({ isActive: false, discontinuedAt: '2026-09-20T15:00:00.000Z' }),
    );

    expect(material.isActive).toBe(false);
    expect(material.discontinuedAt).toBe('2026-09-20T15:00:00.000Z');
  });

  it('keeps the image URL exactly as the API sent it, and null as null', () => {
    expect(toMaterial(materialDto({ imageUrl: 'https://cdn.exemplo.com/a.jpg' })).imageUrl).toBe(
      'https://cdn.exemplo.com/a.jpg',
    );
    expect(toMaterial(cera).imageUrl).toBeNull();
  });

  it('refuses a quantity that is not a finite number', () => {
    expect(() => toMaterial(materialDto({ stockQuantity: Number.NaN }))).toThrow();
  });
});

describe('toInventorySummary', () => {
  it('carries the counts and turns the total into Money', () => {
    const summary = toInventorySummary(inventorySummary);

    expect(summary.materialCount).toBe(3);
    expect(summary.belowMinimumCount).toBe(1);
    expect(formatMoney(summary.totalStockValue)).toBe(`R$${SPACE}39,32`);
  });
});

describe('toPriceHistory', () => {
  it('lists the newest change first', () => {
    expect(toPriceHistory(priceHistory).map((change) => change.id)).toEqual([
      'ph-3',
      'ph-2',
      'ph-1',
    ]);
  });

  it('knows the three origins and shows anything else as unknown', () => {
    const origins = toPriceHistory([
      ...priceHistory,
      {
        ...priceHistory[0]!,
        id: 'ph-4',
        origin: 'SOMETHING_NEW',
        changedAt: '2026-10-05T12:00:00.000Z',
      },
    ]).map((change) => change.origin);

    expect(origins).toEqual(['UNKNOWN', 'MANUAL_EDIT', 'INVOICE_SYNC', 'CREATION']);
  });

  it('turns both values into Money', () => {
    const [latest] = toPriceHistory(priceHistory);

    expect(formatMoney(latest!.previousValue)).toBe(`R$${SPACE}28,00`);
    expect(formatMoney(latest!.newValue)).toBe(`R$${SPACE}30,00`);
  });
});
