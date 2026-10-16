import { describe, expect, it } from 'vitest';

import { formatPercent } from '@/shared/format';
import { requireDecimalString as dec } from '@/shared/money';

import type { SalesDatasetDto } from '../api/sale.dto';

import { changeText } from './labels';
import { amountToReceive, monthSales, ordersInProduction, toSalesDataset } from './sales-metrics';

/**
 * The dataset of `api-contract.md` section 8.1, worked by hand. September sold
 * R$ 1.840,50; October R$ 2.071,00. The open sales are the balance: two
 * unmade-and-unpaid orders from any date, one delivered but unpaid, one made
 * and paid.
 */
const DATASET: SalesDatasetDto = {
  from: '2026-09-01T03:00:00.000Z',
  to: '2026-11-01T03:00:00.000Z',
  byMonth: [
    { month: '2026-10', saleCount: 14, totalAmount: dec('2071.00') },
    { month: '2026-09', saleCount: 12, totalAmount: dec('1840.50') },
  ],
  // The movement of the period. Deliberately different from the balance below:
  // reading these for "to receive" would give a smaller, wrong number.
  byPaymentStatus: [
    { paymentStatus: 'PENDING', saleCount: 1, totalAmount: dec('90.00') },
    { paymentStatus: 'PAID', saleCount: 25, totalAmount: dec('3821.50') },
  ],
  byProductionStatus: [
    { productionStatus: 'PENDING', saleCount: 1, totalAmount: dec('90.00') },
    { productionStatus: 'ASSEMBLED', saleCount: 0, totalAmount: dec('0.00') },
    { productionStatus: 'DELIVERED', saleCount: 25, totalAmount: dec('3821.50') },
  ],
  openItems: [
    {
      paymentStatus: 'PENDING',
      productionStatus: 'PENDING',
      saleCount: 2,
      totalAmount: dec('220.00'),
    },
    {
      paymentStatus: 'PENDING',
      productionStatus: 'ASSEMBLED',
      saleCount: 1,
      totalAmount: dec('75.30'),
    },
    {
      paymentStatus: 'PENDING',
      productionStatus: 'DELIVERED',
      saleCount: 1,
      totalAmount: dec('190.00'),
    },
    {
      paymentStatus: 'PAID',
      productionStatus: 'PENDING',
      saleCount: 3,
      totalAmount: dec('310.20'),
    },
    {
      paymentStatus: 'PAID',
      productionStatus: 'ASSEMBLED',
      saleCount: 1,
      totalAmount: dec('75.00'),
    },
  ],
};

const dataset = toSalesDataset(DATASET);

describe('monthSales: movement', () => {
  it('reads the current month from its own cell, whatever order the cells arrive in', () => {
    const october = monthSales(dataset, '2026-10');

    expect(october.saleCount).toBe(14);
    expect(october.totalAmount.toCentsString()).toBe('2071.00');
  });

  it('compares with the cell right before it: 2071,00 against 1840,50 is +12,5%', () => {
    // (2071.00 - 1840.50) / 1840.50 = 12.5237...% -> 12,5 with one place.
    const change = monthSales(dataset, '2026-10').change;

    expect(change).not.toBeNull();
    expect(formatPercent(change!)).toBe('12,5%');
    expect(changeText(change)).toBe('+12,5% contra o mês anterior');
  });

  it('shows a fall with its sign and no plus', () => {
    const september = monthSales(
      toSalesDataset({
        ...DATASET,
        byMonth: [
          { month: '2026-09', saleCount: 20, totalAmount: dec('2000.00') },
          { month: '2026-10', saleCount: 9, totalAmount: dec('1500.00') },
        ],
      }),
      '2026-10',
    );

    expect(changeText(september.change)).toBe('-25,0% contra o mês anterior');
  });

  it('has no change to show when the month before sold nothing', () => {
    const afterAZeroMonth = monthSales(
      toSalesDataset({
        ...DATASET,
        byMonth: [
          { month: '2026-09', saleCount: 0, totalAmount: dec('0.00') },
          { month: '2026-10', saleCount: 3, totalAmount: dec('400.00') },
        ],
      }),
      '2026-10',
    );

    expect(afterAZeroMonth.change).toBeNull();
    expect(changeText(afterAZeroMonth.change)).toBe('Sem mês anterior para comparar');
  });

  it('has no change to show when the current month is the first cell', () => {
    const only = monthSales(
      toSalesDataset({
        ...DATASET,
        byMonth: [{ month: '2026-10', saleCount: 3, totalAmount: dec('400.00') }],
      }),
      '2026-10',
    );

    expect(only.change).toBeNull();
    expect(only.totalAmount.toCentsString()).toBe('400.00');
  });

  it('reports a month that sold nothing as R$ 0,00, not as a missing figure', () => {
    const quiet = monthSales(
      toSalesDataset({
        ...DATASET,
        byMonth: [
          { month: '2026-09', saleCount: 5, totalAmount: dec('500.00') },
          { month: '2026-10', saleCount: 0, totalAmount: dec('0.00') },
        ],
      }),
      '2026-10',
    );

    expect(quiet.saleCount).toBe(0);
    expect(quiet.totalAmount.isZero()).toBe(true);
    expect(formatPercent(quiet.change!)).toBe('-100,0%');
  });
});

describe('the open balance', () => {
  it('counts orders in production from the open sales: pending and assembled, any payment', () => {
    // PENDING production: 2 + 3 = 5 sales; ASSEMBLED: 1 + 1 = 2. Delivered is out.
    const production = ordersInProduction(dataset);

    expect(production.saleCount).toBe(7);
    expect(production.totalAmount.toCentsString()).toBe('680.50');
  });

  it('adds up the amount to receive over every unpaid open sale, delivered ones included', () => {
    // 220.00 + 75.30 + 190.00: the unpaid sale that was already delivered is still owed.
    const receivable = amountToReceive(dataset);

    expect(receivable.saleCount).toBe(4);
    expect(receivable.totalAmount.toCentsString()).toBe('485.30');
  });

  it('does not read the status cells of the period, which would give a smaller, wrong number', () => {
    // byPaymentStatus.PENDING says R$ 90,00: the unpaid among the period's sales only.
    expect(amountToReceive(dataset).totalAmount.toCentsString()).not.toBe('90.00');
  });

  it('keeps balance and movement apart: the two are never added', () => {
    const month = monthSales(dataset, '2026-10').totalAmount;
    const receivable = amountToReceive(dataset).totalAmount;

    expect(month.plus(receivable).toCentsString()).toBe('2556.30');
    // Each card shows its own figure; no function here produces that sum.
    expect(month.toCentsString()).toBe('2071.00');
    expect(receivable.toCentsString()).toBe('485.30');
  });

  it('is zero, and says so, when nothing is open', () => {
    const empty = toSalesDataset({ ...DATASET, openItems: [] });

    expect(amountToReceive(empty).totalAmount.isZero()).toBe(true);
    expect(ordersInProduction(empty).saleCount).toBe(0);
  });
});
