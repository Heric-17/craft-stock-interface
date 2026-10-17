import { describe, expect, it } from 'vitest';

import { formatMoney } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';

import type { PurchaseSummaryDto } from '../api/purchase.dto';

import { shortAccessKey, toPurchasePage, toPurchaseSummary } from './purchase';

const dec = requireDecimalString;

function dto(overrides: Partial<PurchaseSummaryDto> = {}): PurchaseSummaryDto {
  return {
    id: 'compra-1',
    purchaseDate: '2026-10-12T17:20:00.000Z',
    accessKey: '35261012345678000123650010000012341000012345',
    establishment: { id: '12345678000123', name: 'Casa das Essências', cnpj: '12345678000123' },
    grossTotal: dec('253.90'),
    discountTotal: dec('5.00'),
    netTotal: dec('248.90'),
    allocationPending: false,
    itemCount: 8,
    hasInvoice: true,
    createdAt: '2026-10-12T17:25:00.000Z',
    ...overrides,
  };
}

describe('toPurchaseSummary', () => {
  it('reads the amounts as money and names the shop', () => {
    const purchase = toPurchaseSummary(dto());

    expect(purchase.establishmentName).toBe('Casa das Essências');
    expect(formatMoney(purchase.netTotal)).toMatch(/248,90$/);
    expect(formatMoney(purchase.discountTotal)).toMatch(/5,00$/);
    expect(formatMoney(purchase.grossTotal)).toMatch(/253,90$/);
    expect(purchase.itemCount).toBe(8);
  });

  it('says so when the note did not name its shop, instead of leaving the row nameless', () => {
    expect(toPurchaseSummary(dto({ establishment: null })).establishmentName).toBe(
      'Estabelecimento não identificado',
    );
  });

  it('keeps the API total of the filtered history, not the size of the page', () => {
    const page = toPurchasePage({ items: [dto()], total: 41, limit: 20, offset: 40 });

    expect(page.total).toBe(41);
    expect(page.items).toHaveLength(1);
  });
});

describe('shortAccessKey', () => {
  it('keeps both ends of the key', () => {
    expect(shortAccessKey('35261012345678000123650010000012341000012345')).toBe('3526…2345');
  });

  it('leaves a short value whole', () => {
    expect(shortAccessKey('12345678')).toBe('12345678');
  });
});
