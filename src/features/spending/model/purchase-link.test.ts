import { describe, expect, it } from 'vitest';

import {
  purchasesLink,
  readPurchasesFilter,
  withoutEstablishment,
  withPeriod,
} from './purchase-link';

describe('purchasesLink', () => {
  it('opens the list narrowed to a shop and a period, in Portuguese in the address', () => {
    expect(
      purchasesLink('/compras', { establishmentId: '12345678000123', preset: 'LAST_6_MONTHS' }),
    ).toBe('/compras?estabelecimento=12345678000123&periodo=6-meses');
  });

  it('escapes a shop that is known only by its name', () => {
    const link = purchasesLink('/compras', { establishmentId: 'Casa & Cia / Centro' });

    expect(link).toBe('/compras?estabelecimento=Casa+%26+Cia+%2F+Centro');
  });

  it('is the list itself with no filter', () => {
    expect(purchasesLink('/compras', {})).toBe('/compras');
  });
});

describe('readPurchasesFilter', () => {
  it('reads back what purchasesLink wrote, for every period', () => {
    for (const preset of ['THIS_MONTH', 'LAST_6_MONTHS', 'LAST_12_MONTHS'] as const) {
      const link = purchasesLink('/compras', { establishmentId: 'Casa & Cia', preset });
      const params = new URL(link, 'https://exemplo.com.br').searchParams;

      expect(readPurchasesFilter(params)).toEqual({ establishmentId: 'Casa & Cia', preset });
    }
  });

  it('ignores a period it does not know and an empty shop', () => {
    expect(readPurchasesFilter(new URLSearchParams('periodo=ontem&estabelecimento='))).toEqual({
      establishmentId: undefined,
      preset: undefined,
    });
  });
});

describe('the address edits', () => {
  it('takes the shop off and keeps the period', () => {
    const params = withoutEstablishment(new URLSearchParams('estabelecimento=abc&periodo=6-meses'));

    expect(params.toString()).toBe('periodo=6-meses');
  });

  it('sets the period and keeps the shop', () => {
    const params = withPeriod(new URLSearchParams('estabelecimento=abc'), 'THIS_MONTH');

    expect(params.toString()).toBe('estabelecimento=abc&periodo=este-mes');
  });
});
