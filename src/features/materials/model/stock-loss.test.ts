import { describe, expect, it } from 'vitest';

import { Money, requireDecimalString } from '@/shared/money';
import {
  ceraQuebrou,
  emptyDataset,
  lossDto,
  lossResult,
  monthDataset,
  monthOfLosses,
} from '@/test/fixtures/stock-losses';

import {
  biggestLossMaterial,
  periodLossTotals,
  reasonsWithLosses,
  toStockLoss,
  toStockLossDataset,
  toStockLossPage,
  toStockLossResult,
} from './stock-loss';

const dec = requireDecimalString;

describe('a loss', () => {
  it('reads what was lost as a positive quantity in the unit the API sent with it', () => {
    const loss = toStockLoss(ceraQuebrou);

    expect(loss.quantity.toDecimalString()).toBe('100.000');
    expect(loss.quantity.unit).toBe('GRAM');
  });

  it('takes the unit from the loss itself, whichever it is', () => {
    const wicks = toStockLoss(lossDto({ consumptionUnit: 'UNIT', consumptionUnitSymbol: 'un' }));
    const ribbon = toStockLoss(
      lossDto({ consumptionUnit: 'CENTIMETER', consumptionUnitSymbol: 'cm' }),
    );

    expect(wicks.quantity.unit).toBe('UNIT');
    expect(ribbon.quantity.unit).toBe('CENTIMETER');
  });

  it('keeps the value the API derived, to the cent, and never computes one', () => {
    // 1 g with a frozen basis of R$ 40,00 per unit: nothing here could give 37,00.
    const loss = toStockLoss(
      lossDto({
        quantity: 1,
        value: dec('37.00'),
        costBasisAmount: dec('40.00'),
        costBasisQuantity: 1,
      }),
    );

    expect(loss.value.toCentsString()).toBe('37.00');
  });

  it('reads a fractional quantity exactly, however the double spells it', () => {
    expect(toStockLoss(lossDto({ quantity: 0.145 })).quantity.toDecimalString()).toBe('0.145');
  });

  it('shows a reason this build has never heard of as "other", without breaking', () => {
    expect(toStockLoss(lossDto({ reason: 'THEFT' })).reason).toBe('OTHER');
    expect(toStockLoss(lossDto({ reason: 'EXPIRED' })).reason).toBe('EXPIRED');
  });

  it('refuses a value that is not a decimal string', () => {
    expect(() => toStockLoss(lossDto({ value: 2.8 as unknown as ReturnType<typeof dec> }))).toThrow(
      /decimal string/,
    );
  });
});

describe('a page of losses', () => {
  it('keeps `total`, which is the size of the filtered set, beside the rows it has', () => {
    const page = toStockLossPage({
      items: monthOfLosses.slice(0, 2),
      total: 23,
      limit: 20,
      offset: 0,
    });

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(23);
  });

  it('reads each row in the unit that row came with', () => {
    const page = toStockLossPage({
      items: monthOfLosses.slice(0, 3),
      total: 3,
      limit: 20,
      offset: 0,
    });

    expect(page.items.map((loss) => loss.quantity.unit)).toEqual(['GRAM', 'MILLILITER', 'GRAM']);
  });
});

describe('the balance a loss left behind', () => {
  it('is the API’s, as a quantity of the material', () => {
    const result = toStockLossResult(lossResult({ stockQuantityAfter: 600 }));

    expect(result.stockQuantityAfter.toDecimalString()).toBe('600.000');
    expect(result.value.toCentsString()).toBe('2.24');
  });
});

describe('the period totals', () => {
  const dataset = toStockLossDataset(monthDataset);

  it('are the months of the dataset added up: count and value', () => {
    const totals = periodLossTotals(dataset);

    expect(totals.lossCount).toBe(22);
    expect(totals.lossValue.toCentsString()).toBe('14.06');
  });

  const sumOf = (items: typeof monthOfLosses) =>
    Money.sum(
      toStockLossPage({ items, total: items.length, limit: 20, offset: 0 }).items.map(
        (loss) => loss.value,
      ),
    ).toCentsString();

  it('are not what a page of the list adds up to', () => {
    // The first page is 20 of the 22 losses: R$ 13,64, which is not what was lost.
    expect(sumOf(monthOfLosses.slice(0, 20))).toBe('13.64');
    expect(periodLossTotals(dataset).lossValue.toCentsString()).not.toBe('13.64');
  });

  it('are what the whole list adds up to: the two sides close with each other', () => {
    expect(sumOf(monthOfLosses)).toBe('14.06');
    expect(periodLossTotals(dataset).lossValue.toCentsString()).toBe(sumOf(monthOfLosses));
    expect(periodLossTotals(dataset).lossCount).toBe(monthOfLosses.length);
  });

  it('add several months, each one already closed by the API', () => {
    const totals = periodLossTotals(
      toStockLossDataset({
        ...monthDataset,
        byMonth: [
          { month: '2026-08', lossCount: 1, lossValue: dec('0.10') },
          { month: '2026-09', lossCount: 2, lossValue: dec('0.20') },
          { month: '2026-10', lossCount: 3, lossValue: dec('0.30') },
        ],
      }),
    );

    // Exact: 0,10 + 0,20 + 0,30 is 0,60, not 0,6000000000000001.
    expect(totals.lossCount).toBe(6);
    expect(totals.lossValue.toCentsString()).toBe('0.60');
  });

  it('are zero for a period with no losses, which is a result and not a missing figure', () => {
    const totals = periodLossTotals(toStockLossDataset(emptyDataset));

    expect(totals.lossCount).toBe(0);
    expect(totals.lossValue.toCentsString()).toBe('0.00');
  });

  it('are zero for a dataset with no months at all, without dividing or crashing', () => {
    const totals = periodLossTotals(toStockLossDataset({ ...emptyDataset, byMonth: [] }));

    expect(totals.lossValue.isZero()).toBe(true);
  });
});

describe('the reasons and the biggest loss of a period', () => {
  const dataset = toStockLossDataset(monthDataset);

  it('lists only the reasons that cost something, biggest first', () => {
    expect(
      reasonsWithLosses(dataset).map((cell) => [cell.reason, cell.lossValue.toCentsString()]),
    ).toEqual([
      ['EXPIRED', '6.08'],
      ['BREAKAGE', '4.20'],
      ['LOST', '3.78'],
    ]);
  });

  it('picks the material that lost the most by value, not by count', () => {
    // Pavio lost 18 times and cost R$ 3,78; essência lost twice and cost R$ 6,08.
    expect(biggestLossMaterial(dataset)?.materialName).toBe('Essência baunilha');
  });

  it('picks nothing when nothing was lost', () => {
    expect(biggestLossMaterial(toStockLossDataset(emptyDataset))).toBeNull();
    expect(reasonsWithLosses(toStockLossDataset(emptyDataset))).toEqual([]);
  });
});
