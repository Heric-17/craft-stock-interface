import { describe, expect, it } from 'vitest';

import { productionChangeEffect, productionConfirmation } from './production-change';
import { PRODUCTION_STATUSES, type ProductionStatus } from './status';

/**
 * The backend's own table (`api-contract.md`, section 11.2), cell by cell: pending
 * means nothing was debited, any other state means it was, and the stock moves
 * only when a sale crosses that line.
 */
const TABLE: Record<ProductionStatus, Record<ProductionStatus, string>> = {
  PENDING: { PENDING: 'NONE', ASSEMBLED: 'DEBITS_STOCK', DELIVERED: 'DEBITS_STOCK' },
  ASSEMBLED: { PENDING: 'RETURNS_STOCK', ASSEMBLED: 'NONE', DELIVERED: 'NONE' },
  DELIVERED: { PENDING: 'RETURNS_STOCK', ASSEMBLED: 'NONE', DELIVERED: 'NONE' },
};

describe('productionChangeEffect', () => {
  for (const from of PRODUCTION_STATUSES) {
    for (const to of PRODUCTION_STATUSES) {
      it(`${from} -> ${to} is ${TABLE[from][to]}`, () => {
        expect(productionChangeEffect(from, to)).toBe(TABLE[from][to]);
      });
    }
  }

  it('debits when a pending sale is delivered without being assembled first', () => {
    expect(productionChangeEffect('PENDING', 'DELIVERED')).toBe('DEBITS_STOCK');
  });

  it('returns the stock when a delivered sale goes back to pending', () => {
    expect(productionChangeEffect('DELIVERED', 'PENDING')).toBe('RETURNS_STOCK');
  });
});

describe('productionConfirmation', () => {
  it('says the stock will be debited, in the words of the state it goes to', () => {
    const assembled = productionConfirmation('DEBITS_STOCK', 'ASSEMBLED');
    const delivered = productionConfirmation('DEBITS_STOCK', 'DELIVERED');

    expect(assembled.title).toBe('Marcar esta venda como montada?');
    expect(delivered.title).toBe('Marcar esta venda como entregue?');
    expect(assembled.effect).toContain('debitado');
    expect(delivered.effect).toContain('debitado');
    expect(delivered.confirmLabel).toBe('Marcar como entregue');
  });

  it('says that only what exists is debited, and that going back returns exactly that', () => {
    const { note } = productionConfirmation('DEBITS_STOCK', 'DELIVERED');

    expect(note).toContain('debita só o que existe');
    expect(note).toContain('volta exatamente o que foi debitado');
  });

  it('says the stock will be returned, that editing opens again and that it is debited anew', () => {
    const back = productionConfirmation('RETURNS_STOCK', 'PENDING');

    expect(back.effect).toContain('devolvido');
    expect(back.note).toContain('volta a poder ser editada');
    expect(back.note).toContain('debitado de novo');
  });
});
