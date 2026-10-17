import { describe, expect, it } from 'vitest';

import { NON_BREAKING_SPACE } from '@/shared/format';

import { ApiError } from './api-error';
import type { DiscountAllocationReason } from './error-codes';
import { discountAmountsSummary, errorDetail, messageForError } from './error-messages';

const R = `R$${NON_BREAKING_SPACE}`;

function allocation(details: Record<string, unknown>): ApiError {
  return new ApiError({
    statusCode: 422,
    code: 'DISCOUNT_ALLOCATION',
    error: 'DiscountAllocationError',
    // In English and for the log: nothing on screen may be read out of it.
    message: 'Allocated 999.99 does not match discountTotal 888.88.',
    details,
  });
}

const SENTENCES: Record<DiscountAllocationReason, string> = {
  SUM_MISMATCH: 'O desconto distribuído não fecha com o desconto da nota.',
  LINE_EXCEEDS_GROSS: 'Uma linha recebeu mais desconto do que ela vale.',
  DISCOUNT_EXCEEDS_GROSS: 'O desconto é maior do que as linhas de onde ele sairia.',
  NO_ELIGIBLE_LINE: 'Nenhuma linha desta nota se encaixa na forma de distribuição escolhida.',
  MANUAL_INPUT_MISSING: 'Informe quanto do desconto cabe a cada linha.',
  NEGATIVE_LINE_AMOUNT: 'O desconto de uma linha não pode ser negativo.',
  NEGATIVE_DISCOUNT_TOTAL: 'O desconto da nota não pode ser negativo.',
  NO_LINES: 'A nota tem desconto e nenhuma linha para receber esse desconto.',
  RESIDUE_UNALLOCATABLE:
    'Sobrou uma diferença de centavos que não cabe em nenhuma linha. Ajuste a distribuição à mão.',
};

describe('the sentence of each DISCOUNT_ALLOCATION reason', () => {
  it.each(Object.entries(SENTENCES))('%s has its own', (reason, sentence) => {
    expect(messageForError(allocation({ reason }))).toBe(sentence);
  });

  it('never says the same thing for two reasons', () => {
    expect(new Set(Object.values(SENTENCES)).size).toBe(Object.keys(SENTENCES).length);
  });

  it('falls back to a generic sentence for a reason the build has not heard of', () => {
    const message = messageForError(allocation({ reason: 'SOMETHING_NEW' }));

    // The details guard refuses an unknown reason, so the code's own sentence is used.
    expect(message).toBe('A distribuição do desconto não pôde ser aplicada.');
  });
});

describe('the amounts of a discount that did not close', () => {
  it('writes the sum and the discount as money, from details and not from the message', () => {
    const error = allocation({ reason: 'SUM_MISMATCH', expected: '6.00', provided: '4.50' });

    expect(discountAmountsSummary(error)).toBe(`Distribuído ${R}4,50 de ${R}6,00.`);
    expect(errorDetail(error)).toBe(`Distribuído ${R}4,50 de ${R}6,00.`);
  });

  it('writes what a line is worth and what it was given', () => {
    const error = allocation({
      reason: 'LINE_EXCEEDS_GROSS',
      itemId: 'item-1',
      expected: '5.00',
      provided: '5.01',
    });

    expect(discountAmountsSummary(error)).toBe(`A linha vale ${R}5,00 e recebeu ${R}5,01.`);
  });

  it('writes what the lines are worth against the discount', () => {
    const error = allocation({
      reason: 'DISCOUNT_EXCEEDS_GROSS',
      mode: 'COMPANY_ONLY',
      expected: '3.00',
      provided: '6.00',
    });

    expect(discountAmountsSummary(error)).toBe(`As linhas valem ${R}3,00 e o desconto é ${R}6,00.`);
  });

  it('adds nothing for a reason whose amounts say nothing more', () => {
    expect(
      discountAmountsSummary(allocation({ reason: 'NO_LINES', expected: '6.00' })),
    ).toBeUndefined();
    expect(discountAmountsSummary(allocation({ reason: 'NO_ELIGIBLE_LINE' }))).toBeUndefined();
  });

  it('shows no amount that is not a decimal string', () => {
    const error = allocation({ reason: 'SUM_MISMATCH', expected: 'seis reais', provided: '4.00' });

    expect(discountAmountsSummary(error)).toBeUndefined();
  });

  it('writes the pending attribution with what the lines add up to now', () => {
    const error = new ApiError({
      statusCode: 422,
      code: 'PENDING_DISCOUNT_ALLOCATION',
      error: 'PendingDiscountAllocationError',
      message: 'pending',
      details: { purchaseId: 'compra-1', expected: '6.00', provided: '0.00' },
    });

    expect(messageForError(error)).toBe(
      'Distribua todo o desconto entre as linhas antes de concluir esta compra.',
    );
    expect(discountAmountsSummary(error)).toBe(`Distribuído ${R}0,00 de ${R}6,00.`);
  });
});
