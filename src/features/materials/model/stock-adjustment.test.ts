import { describe, expect, it } from 'vitest';

import { formatQuantity, NON_BREAKING_SPACE } from '@/shared/format';
import { requireDecimalString } from '@/shared/money';
import { Quantity } from '@/shared/quantity';

import {
  buildStockAdjustmentRequest,
  previewStockAfter,
  readStockAdjustment,
  stockAdjustmentSchema,
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
    expect(reading.ok ? '' : reading.message).toBe(
      `Não dá para dar baixa em mais do que há em estoque (680${SPACE}g).`,
    );
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
  it('an entry is a positive relativeIncrement', () => {
    expect(buildStockAdjustmentRequest(accepted('ENTRY', '1,5', 'major'))).toEqual({
      source: 'MANUAL',
      relativeIncrement: 1500,
    });
  });

  it('a write-off is a negative relativeIncrement', () => {
    expect(buildStockAdjustmentRequest(accepted('WRITE_OFF', '80'))).toEqual({
      source: 'MANUAL',
      relativeIncrement: -80,
    });
  });

  it('a recount is an absoluteQuantity, and zero is sent as zero', () => {
    expect(buildStockAdjustmentRequest(accepted('RECOUNT', '12'))).toEqual({
      source: 'MANUAL',
      absoluteQuantity: 12,
    });
    expect(buildStockAdjustmentRequest(accepted('RECOUNT', '0'))).toEqual({
      source: 'MANUAL',
      absoluteQuantity: 0,
    });
  });

  it('sends exactly the quantity the reading accepted', () => {
    const adjustment = accepted('WRITE_OFF', '0,145');

    expect(buildStockAdjustmentRequest(adjustment)).toEqual({
      source: 'MANUAL',
      relativeIncrement: -0.145,
    });
  });
});

describe('the form schema', () => {
  it('asks for a material and a quantity', () => {
    const result = stockAdjustmentSchema.safeParse({
      materialId: '',
      quantity: '  ',
      scale: 'base',
    });

    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual([
      'materialId',
      'quantity',
    ]);
  });
});
