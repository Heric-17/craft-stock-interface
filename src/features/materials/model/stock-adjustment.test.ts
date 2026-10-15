import { describe, expect, it } from 'vitest';

import { formatQuantity, NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import { Quantity } from '@/shared/quantity';

import {
  buildLossRequest,
  buildStockEntryRequest,
  previewStockAfter,
  readLossDetails,
  readStockAdjustment,
  stockAdjustmentSchemaFor,
  type StockAdjustmentKind,
} from './stock-adjustment';

const SPACE = NON_BREAKING_SPACE;

const grams = (text: string) => Quantity.parse(requireDecimalString(text), 'GRAM');
const STOCK = grams('680');

function read(kind: StockAdjustmentKind, text: string, scale: 'base' | 'major' = 'base') {
  return readStockAdjustment(kind, text, 'GRAM', scale, STOCK);
}

function accepted(kind: StockAdjustmentKind, text: string, scale: 'base' | 'major' = 'base') {
  const reading = read(kind, text, scale);

  if (!reading.ok) {
    throw new Error(`expected "${text}" to be accepted: ${reading.message}`);
  }

  return reading.adjustment;
}

describe('an entry', () => {
  it('reads what was typed, in the unit of the field', () => {
    expect(accepted('ENTRY', '1,5', 'major').quantity.toApiNumber()).toBe(1500);
  });

  it('must be more than zero', () => {
    expect(read('ENTRY', '0')).toMatchObject({ ok: false, reason: 'NOT_POSITIVE' });
    expect(read('ENTRY', '-5')).toMatchObject({ ok: false, reason: 'NOT_POSITIVE' });
  });

  it('is not limited by the stock', () => {
    expect(read('ENTRY', '100000').ok).toBe(true);
  });
});

describe('a write-off', () => {
  it('reads what was typed, in the unit of the field', () => {
    expect(accepted('WRITE_OFF', '0,5', 'major').quantity.toApiNumber()).toBe(500);
  });

  it('must be more than zero', () => {
    expect(read('WRITE_OFF', '0')).toMatchObject({ ok: false, reason: 'NOT_POSITIVE' });
  });

  it('is refused when it is larger than the stock, saying how much there is', () => {
    const reading = read('WRITE_OFF', '680,001');

    expect(reading).toMatchObject({ ok: false, reason: 'EXCEEDS_STOCK' });
    expect(reading.ok ? '' : reading.message).toBe(`Você tem apenas 680${SPACE}g em estoque.`);
  });

  it('is accepted down to exactly zero', () => {
    expect(read('WRITE_OFF', '680').ok).toBe(true);
    expect(read('WRITE_OFF', '0,68', 'major').ok).toBe(true);
  });

  it('compares in the base unit even when typed in kilos', () => {
    expect(read('WRITE_OFF', '0,7', 'major')).toMatchObject({ ok: false, reason: 'EXCEEDS_STOCK' });
  });
});

describe('a recount', () => {
  it('may be zero, because somebody counted and found nothing', () => {
    expect(accepted('RECOUNT', '0').quantity.isZero()).toBe(true);
  });

  it('may be larger or smaller than the stock', () => {
    expect(read('RECOUNT', '5000').ok).toBe(true);
    expect(read('RECOUNT', '1').ok).toBe(true);
  });

  it('is never negative', () => {
    expect(read('RECOUNT', '-1')).toMatchObject({ ok: false, reason: 'NEGATIVE' });
  });
});

describe('what none of them accepts', () => {
  it.each(['ENTRY', 'WRITE_OFF', 'RECOUNT'] as const)('%s: text that is not a quantity', (kind) => {
    expect(read(kind, 'abc')).toMatchObject({ ok: false, reason: 'UNREADABLE' });
    expect(read(kind, '')).toMatchObject({ ok: false, reason: 'UNREADABLE' });
  });

  it.each(['ENTRY', 'WRITE_OFF', 'RECOUNT'] as const)(
    '%s: a fourth decimal place, which is refused rather than rounded',
    (kind) => {
      expect(read(kind, '0,1455')).toMatchObject({ ok: false, reason: 'UNREADABLE' });
    },
  );
});

describe('the preview of the stock left behind', () => {
  const preview = (kind: StockAdjustmentKind, text: string) =>
    formatQuantity(previewStockAfter(accepted(kind, text), STOCK));

  it('adds an entry', () => {
    expect(preview('ENTRY', '320')).toBe(`1${SPACE}kg`);
  });

  it('takes a write-off off', () => {
    expect(preview('WRITE_OFF', '80')).toBe(`600${SPACE}g`);
    expect(preview('WRITE_OFF', '680')).toBe(`0${SPACE}g`);
  });

  it('is exactly what was counted for a recount, whatever the stock was', () => {
    expect(preview('RECOUNT', '12')).toBe(`12${SPACE}g`);
  });

  it('is exact in thousandths: no float fuzz', () => {
    const fine = Quantity.parse(requireDecimalString('0.3'), 'GRAM');
    const taken = accepted('WRITE_OFF', '0,1');

    expect(previewStockAfter(taken, fine).toDecimalString()).toBe('0.200');
  });
});

describe('the request each one becomes', () => {
  it('an entry is a positive relativeIncrement on stock-entries', () => {
    expect(buildStockEntryRequest(accepted('ENTRY', '1,5', 'major'))).toEqual({
      source: 'MANUAL',
      relativeIncrement: 1500,
    });
  });

  it('a recount is an absoluteQuantity, and zero is sent as zero', () => {
    expect(buildStockEntryRequest(accepted('RECOUNT', '12'))).toEqual({
      source: 'MANUAL',
      absoluteQuantity: 12,
    });
    expect(buildStockEntryRequest(accepted('RECOUNT', '0'))).toEqual({
      source: 'MANUAL',
      absoluteQuantity: 0,
    });
  });

  it('a write-off is never a stock entry: the API refuses a negative increment there', () => {
    expect(() => buildStockEntryRequest(accepted('WRITE_OFF', '80'))).toThrow(/buildLossRequest/);
  });

  it('a write-off is a loss with the quantity taken, positive, and its reason', () => {
    expect(
      buildLossRequest(accepted('WRITE_OFF', '80').quantity, {
        reason: 'BREAKAGE',
        observation: 'caiu da prateleira',
      }),
    ).toEqual({
      quantity: 80,
      reason: 'BREAKAGE',
      observation: 'caiu da prateleira',
    });
  });

  it('leaves the observation out when there is none, rather than sending an empty one', () => {
    const request = buildLossRequest(accepted('WRITE_OFF', '0,5', 'major').quantity, {
      reason: 'EXPIRED',
      observation: null,
    });

    expect(request).toEqual({ quantity: 500, reason: 'EXPIRED' });
    expect(request).not.toHaveProperty('observation');
  });

  it('sends exactly the quantity the reading accepted, with three places', () => {
    expect(
      buildLossRequest(accepted('WRITE_OFF', '0,145').quantity, {
        reason: 'LOST',
        observation: null,
      }).quantity,
    ).toBe(0.145);
  });
});

describe('the reason of a write-off', () => {
  it('is chosen from the closed list and never assumed', () => {
    expect(readLossDetails('', '')).toEqual({
      ok: false,
      field: 'reason',
      message: 'Escolha o motivo da baixa.',
    });
    expect(readLossDetails('QUEBROU', '')).toMatchObject({ ok: false, field: 'reason' });
  });

  it('accepts each of the five reasons', () => {
    for (const reason of ['BREAKAGE', 'EXPIRED', 'SPOILAGE', 'LOST', 'OTHER']) {
      expect(readLossDetails(reason, '').ok).toBe(true);
    }
  });

  it('trims the observation and treats an empty one as absent', () => {
    expect(readLossDetails('LOST', '  caiu  ')).toEqual({
      ok: true,
      details: { reason: 'LOST', observation: 'caiu' },
    });
    expect(readLossDetails('LOST', '   ')).toEqual({
      ok: true,
      details: { reason: 'LOST', observation: null },
    });
  });

  it('refuses an observation over 500 characters, and takes exactly 500', () => {
    expect(readLossDetails('LOST', 'a'.repeat(500)).ok).toBe(true);
    expect(readLossDetails('LOST', 'a'.repeat(501))).toMatchObject({
      ok: false,
      field: 'observation',
    });
  });
});

describe('the form schema', () => {
  const fields = { materialId: 'mat-1', quantity: '1', scale: 'base' as const, observation: '' };

  it('asks for a material and a quantity', () => {
    const result = stockAdjustmentSchemaFor('ENTRY').safeParse({
      materialId: '',
      quantity: '  ',
      scale: 'base',
      reason: '',
      observation: '',
    });

    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual([
      'materialId',
      'quantity',
    ]);
  });

  it('asks for a reason only when something is written off', () => {
    expect(stockAdjustmentSchemaFor('ENTRY').safeParse({ ...fields, reason: '' }).success).toBe(
      true,
    );
    expect(stockAdjustmentSchemaFor('RECOUNT').safeParse({ ...fields, reason: '' }).success).toBe(
      true,
    );

    const result = stockAdjustmentSchemaFor('WRITE_OFF').safeParse({ ...fields, reason: '' });

    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['reason']);
    expect(
      stockAdjustmentSchemaFor('WRITE_OFF').safeParse({ ...fields, reason: 'BREAKAGE' }).success,
    ).toBe(true);
  });
});
