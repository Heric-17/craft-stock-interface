import { describe, expect, it } from 'vitest';

import { formatMoney, formatPercent } from '@/shared/format';
import { Money, requireDecimalString } from '@/shared/money';
import { EMPTY_SPENDING, spendingDatasetDto, spendingDatasetFor } from '@/test/fixtures/spending';

import type { SpendingDatasetDto } from '../api/spending.dto';

import { toSpendingDataset } from './spending-dataset';
import {
  averageTicket,
  discountSavings,
  establishmentRanking,
  monthlySeries,
  monthSpending,
  periodSpending,
  stockMaterialShare,
} from './spending-metrics';

const dec = requireDecimalString;
const money = (value: string): Money => Money.parse(dec(value));
const text = (value: Money | null): string | null => (value === null ? null : formatMoney(value));

const SIX_MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

/** The six months of the fixture, as the screen reads them. */
const six = toSpendingDataset(spendingDatasetDto());
const empty = toSpendingDataset(EMPTY_SPENDING);

/** A single purchase, the way the API writes one with no discount. */
function single(overrides: Partial<SpendingDatasetDto> = {}) {
  return toSpendingDataset(
    spendingDatasetDto({
      byPeriod: [
        { period: '2026-10', netSpend: dec('90.00'), discountTotal: dec('0.00'), purchaseCount: 1 },
      ],
      byEstablishment: [
        {
          establishmentId: 'mercado-do-ze',
          establishmentName: 'Mercado do Zé',
          netSpend: dec('90.00'),
          discountTotal: dec('0.00'),
          purchaseCount: 1,
        },
      ],
      byStockMaterial: [
        {
          isStockMaterial: true,
          netSpend: dec('54.00'),
          discountTotal: dec('0.00'),
          purchaseCount: 1,
        },
        {
          isStockMaterial: false,
          netSpend: dec('36.00'),
          discountTotal: dec('0.00'),
          purchaseCount: 1,
        },
      ],
      ...overrides,
    }),
  );
}

describe('toSpendingDataset', () => {
  it('keeps the amounts as Money and the counts as counts', () => {
    const october = six.months.find((cell) => cell.month === '2026-10');

    expect(october?.netSpend.equals(money('1180.00'))).toBe(true);
    expect(october?.discountTotal.equals(money('30.50'))).toBe(true);
    expect(october?.purchaseCount).toBe(6);
  });

  it('reads both sides of the split, and a side that is missing is nothing spent', () => {
    expect(formatMoney(six.stockMaterial.netSpend)).toBe(formatMoney(money('2191.35')));
    expect(formatMoney(six.companyOnly.netSpend)).toBe(formatMoney(money('939.15')));

    const oneSide = toSpendingDataset(
      spendingDatasetDto({
        byStockMaterial: [
          {
            isStockMaterial: true,
            netSpend: dec('10.00'),
            discountTotal: dec('1.00'),
            purchaseCount: 1,
          },
        ],
      }),
    );

    expect(oneSide.companyOnly.netSpend.isZero()).toBe(true);
    expect(oneSide.companyOnly.purchaseCount).toBe(0);
  });
});

describe('monthSpending', () => {
  it('gives what was paid in the month, how many purchases, and the change against the month before', () => {
    const october = monthSpending(six, '2026-10');

    expect(text(october.netSpend)).toBe(formatMoney(money('1180.00')));
    expect(october.purchaseCount).toBe(6);
    // (1.180,00 − 1.000,00) ÷ 1.000,00
    expect(october.change === null ? null : formatPercent(october.change)).toBe('18,0%');
  });

  it('has no base to compare with when the month before had no spending', () => {
    // July is the month after June, which has no row: it is zero, not a hole to guess at.
    const july = monthSpending(six, '2026-07');

    expect(text(july.netSpend)).toBe(formatMoney(money('450.50')));
    expect(july.change).toBeNull();
  });

  it('is zero, with no comparison, in a period with no purchase at all', () => {
    const october = monthSpending(empty, '2026-10');

    expect(october.netSpend.isZero()).toBe(true);
    expect(october.purchaseCount).toBe(0);
    expect(october.change).toBeNull();
  });

  it('reports a fall as negative', () => {
    const august = monthSpending(
      toSpendingDataset(
        spendingDatasetDto({
          byPeriod: [
            {
              period: '2026-07',
              netSpend: dec('450.50'),
              discountTotal: dec('0.00'),
              purchaseCount: 4,
            },
            {
              period: '2026-08',
              netSpend: dec('200.00'),
              discountTotal: dec('0.00'),
              purchaseCount: 2,
            },
          ],
        }),
      ),
      '2026-08',
    );

    expect(august.change?.isNegative()).toBe(true);
    expect(august.change === null ? null : formatPercent(august.change)).toBe('-55,6%');
  });

  it('finds the month before January in the December of the year before', () => {
    const dataset = toSpendingDataset(
      spendingDatasetDto({
        byPeriod: [
          {
            period: '2025-12',
            netSpend: dec('200.00'),
            discountTotal: dec('0.00'),
            purchaseCount: 2,
          },
          {
            period: '2026-01',
            netSpend: dec('300.00'),
            discountTotal: dec('0.00'),
            purchaseCount: 3,
          },
        ],
      }),
    );

    const change = monthSpending(dataset, '2026-01').change;

    // (300,00 − 200,00) ÷ 200,00
    expect(change === null ? null : formatPercent(change)).toBe('50,0%');
  });

  it('reads a month that has a purchase and whose previous month has none as a month with nothing to compare', () => {
    expect(monthSpending(single(), '2026-10').change).toBeNull();
  });
});

describe('averageTicket', () => {
  it('is what was paid divided by the purchases, rounded once, to the cent', () => {
    // 1.180,00 ÷ 6 = 196,666…
    expect(text(averageTicket(money('1180.00'), 6))).toBe(formatMoney(money('196.67')));
    // 10,00 ÷ 6 = 1,666… and 10,00 ÷ 3 = 3,333…
    expect(text(averageTicket(money('10.00'), 6))).toBe(formatMoney(money('1.67')));
    expect(text(averageTicket(money('10.00'), 3))).toBe(formatMoney(money('3.33')));
  });

  it('is the amount itself for a single purchase', () => {
    const only = monthSpending(single(), '2026-10');

    expect(text(averageTicket(only.netSpend, only.purchaseCount))).toBe(
      formatMoney(money('90.00')),
    );
  });

  it('is not an average at all when there was no purchase', () => {
    expect(averageTicket(Money.zero(), 0)).toBeNull();
  });

  it('rounds half a cent away from zero, in the one rounding', () => {
    // 0,03 ÷ 2 = 0,015 → 0,02
    expect(text(averageTicket(money('0.03'), 2))).toBe(formatMoney(money('0.02')));
  });
});

describe('periodSpending', () => {
  it('adds what was paid and how many purchases, from the months', () => {
    const total = periodSpending(six);

    expect(formatMoney(total.netSpend)).toBe(formatMoney(money('3130.50')));
    expect(total.purchaseCount).toBe(20);
  });

  it('is zero for an empty period', () => {
    const total = periodSpending(empty);

    expect(total.netSpend.isZero()).toBe(true);
    expect(total.purchaseCount).toBe(0);
  });

  it('does not add the purchases of the two sides of the split: a purchase with both kinds of line is in each', () => {
    // One purchase, with a line that became stock and one that is only a company
    // expense: the API counts it once in `byPeriod` and once in each side.
    const mixed = single();

    expect(mixed.stockMaterial.purchaseCount + mixed.companyOnly.purchaseCount).toBe(2);
    expect(periodSpending(mixed).purchaseCount).toBe(1);

    // And in the six months: 17 + 9 = 26 would be the inflated number, for 20 purchases.
    expect(six.stockMaterial.purchaseCount + six.companyOnly.purchaseCount).toBe(26);
    expect(periodSpending(six).purchaseCount).toBe(20);
  });
});

describe('discountSavings', () => {
  it('adds what the discounts saved in the period', () => {
    // 12,00 + 20,00 + 0,00 + 50,00 + 30,50
    expect(text(discountSavings(six))).toBe(formatMoney(money('112.50')));
  });

  it('is zero, as a value, for a note without discount', () => {
    const saved = discountSavings(single());

    expect(saved.isZero()).toBe(true);
    expect(formatMoney(saved)).toBe(formatMoney(Money.zero()));
    expect(formatMoney(saved)).toMatch(/^R\$.0,00$/);
  });

  it('is zero for an empty period too', () => {
    expect(discountSavings(empty).isZero()).toBe(true);
  });
});

describe('stockMaterialShare', () => {
  it('is what became stock out of everything paid, with the two amounts that make it up', () => {
    const split = stockMaterialShare(six);

    expect(formatMoney(split.stockSpend)).toBe(formatMoney(money('2191.35')));
    expect(formatMoney(split.companySpend)).toBe(formatMoney(money('939.15')));
    expect(split.share === null ? null : formatPercent(split.share)).toBe('70,0%');
    expect(split.companyShare === null ? null : formatPercent(split.companyShare)).toBe('30,0%');
  });

  it('is 60 per cent for the purchase of the contract: 54,00 of 90,00', () => {
    const split = stockMaterialShare(single());

    expect(split.share === null ? null : formatPercent(split.share)).toBe('60,0%');
  });

  it('has no share when nothing was spent: there is no share of zero', () => {
    const split = stockMaterialShare(empty);

    expect(split.share).toBeNull();
    expect(split.companyShare).toBeNull();
  });

  it('is zero per cent, not missing, when everything was a company expense', () => {
    const split = stockMaterialShare(
      single({
        byStockMaterial: [
          {
            isStockMaterial: true,
            netSpend: dec('0.00'),
            discountTotal: dec('0.00'),
            purchaseCount: 0,
          },
          {
            isStockMaterial: false,
            netSpend: dec('90.00'),
            discountTotal: dec('0.00'),
            purchaseCount: 1,
          },
        ],
      }),
    );

    expect(split.share === null ? null : formatPercent(split.share)).toBe('0,0%');
  });
});

describe('monthlySeries', () => {
  it('has one point per month of the period, in order, with the month without a purchase at zero', () => {
    const series = monthlySeries(six, SIX_MONTHS, '2026-10');

    expect(series.map((point) => point.month)).toEqual(SIX_MONTHS);

    const june = series.find((point) => point.month === '2026-06');

    expect(june?.netSpend.isZero()).toBe(true);
    expect(june?.discountTotal.isZero()).toBe(true);
    expect(june?.purchaseCount).toBe(0);
  });

  it('marks the running month as partial, and only it', () => {
    const series = monthlySeries(six, SIX_MONTHS, '2026-10');

    expect(series.filter((point) => point.partial).map((point) => point.month)).toEqual([
      '2026-10',
    ]);
  });

  it('draws every month at zero for an empty period, the running one still marked', () => {
    const series = monthlySeries(empty, SIX_MONTHS, '2026-10');

    expect(series).toHaveLength(6);
    expect(series.every((point) => point.netSpend.isZero())).toBe(true);
    expect(series.at(-1)?.partial).toBe(true);
  });

  it('keeps a month of the dataset that the list of months did not name, so the chart never shows less than the cards', () => {
    const series = monthlySeries(six, ['2026-09', '2026-10'], '2026-10');

    expect(series.map((point) => point.month)).toEqual([
      '2026-05',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('adds up, point by point, to what the period says', () => {
    const series = monthlySeries(six, SIX_MONTHS, '2026-10');

    expect(formatMoney(Money.sum(series.map((point) => point.netSpend)))).toBe(
      formatMoney(periodSpending(six).netSpend),
    );
  });

  it('reads the window the way the API cuts it: two months are September and October', () => {
    const twoMonths = toSpendingDataset(
      spendingDatasetFor('2026-09-01T00:00:00-03:00', '2026-11-01T00:00:00-03:00'),
    );

    expect(twoMonths.months.map((cell) => cell.month)).toEqual(['2026-09', '2026-10']);
  });
});

describe('establishmentRanking', () => {
  it('puts the shop where most was paid first, with what was paid and how many purchases', () => {
    const ranking = establishmentRanking(six);

    expect(ranking.map((shop) => shop.name)).toEqual([
      'Casa das Essências',
      'Embalagens Aurora',
      '11222333000144',
      null,
    ]);
    expect(formatMoney(ranking[0]?.netSpend ?? Money.zero())).toBe(formatMoney(money('1500.00')));
    expect(ranking[0]?.purchaseCount).toBe(8);
  });

  it('orders by what was paid even if the API did not', () => {
    const ranking = establishmentRanking(
      toSpendingDataset(
        spendingDatasetDto({
          byEstablishment: [
            {
              establishmentId: 'pequeno',
              establishmentName: 'Pequeno',
              netSpend: dec('10.00'),
              discountTotal: dec('0.00'),
              purchaseCount: 1,
            },
            {
              establishmentId: 'grande',
              establishmentName: 'Grande',
              netSpend: dec('500.00'),
              discountTotal: dec('0.00'),
              purchaseCount: 2,
            },
          ],
        }),
      ),
    );

    expect(ranking.map((shop) => shop.name)).toEqual(['Grande', 'Pequeno']);
  });

  it('names a shop known only by its CNPJ by the CNPJ, and keeps the purchases with no shop apart, with nothing to filter by', () => {
    const ranking = establishmentRanking(six);
    const cnpjOnly = ranking.find((shop) => shop.establishmentId === '11222333000144');
    const noShop = ranking.find((shop) => shop.establishmentId === null);

    expect(cnpjOnly?.name).toBe('11222333000144');
    expect(noShop?.name).toBeNull();
    expect(noShop?.key).not.toBe(cnpjOnly?.key);
  });

  it('is empty for a period with no purchase', () => {
    expect(establishmentRanking(empty)).toEqual([]);
  });
});
