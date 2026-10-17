import { previousMonthLabel } from '@/shared/format';
import { Money, Percentage } from '@/shared/money';

import type { MonthCell, SpendingDataset } from './spending-dataset';

/**
 * The figures of the spending screen, one function each, derived from the
 * dataset and from nothing else. Every amount is what was **paid**: the lines at
 * full price minus the discount attributed to them, which the API has already
 * worked out. The panel is not the sum of the lines, and the difference is the
 * saving.
 *
 * Purchases whose discount is still to be attributed are not in the dataset, on
 * purpose, so the screen never computes a period with the discount half applied.
 * Nothing here puts them back.
 */

// -- A month -----------------------------------------------------------------

export interface MonthSpending {
  netSpend: Money;
  purchaseCount: number;
  /**
   * Against the month before it. `null` when that month had no spending: there is
   * no base to compare with, which is not the same as an infinite increase.
   */
  change: Percentage | null;
}

function monthCell(dataset: SpendingDataset, month: string): MonthCell | undefined {
  return dataset.months.find((cell) => cell.month === month);
}

/**
 * What was spent in `month` and how that compares with the month before it. The
 * dataset leaves a month with no purchase out, so both months are looked up by
 * their label and a missing one is zero — a month without spending is a result,
 * and last month's zero is why there is nothing to compare against.
 */
export function monthSpending(dataset: SpendingDataset, month: string): MonthSpending {
  const current = monthCell(dataset, month);
  const previous = monthCell(dataset, previousMonthLabel(month));
  const netSpend = current?.netSpend ?? Money.zero();

  return {
    netSpend,
    purchaseCount: current?.purchaseCount ?? 0,
    change: Percentage.change(previous?.netSpend ?? Money.zero(), netSpend),
  };
}

/**
 * The average spent per purchase: what was paid divided by how many purchases it
 * took, rounded once, to the cent. `null` when there was no purchase, because an
 * average of nothing is not R$ 0,00.
 */
export function averageTicket(netSpend: Money, purchaseCount: number): Money | null {
  if (purchaseCount === 0) {
    return null;
  }

  return netSpend.scaledToCents(1n, BigInt(purchaseCount));
}

// -- A period ----------------------------------------------------------------

export interface PeriodSpending {
  netSpend: Money;
  /**
   * How many purchases, from the months. A purchase is in exactly one month, so
   * this is a true count. It is not the sum of the two sides of the stock
   * split, where a purchase with both kinds of line is in each.
   */
  purchaseCount: number;
}

export function periodSpending(dataset: SpendingDataset): PeriodSpending {
  return {
    netSpend: Money.sum(dataset.months.map((cell) => cell.netSpend)),
    purchaseCount: dataset.months.reduce((count, cell) => count + cell.purchaseCount, 0),
  };
}

/**
 * What the discounts saved in the period. A period with none is `R$ 0,00`, a
 * result like any other, and it is shown as such.
 */
export function discountSavings(dataset: SpendingDataset): Money {
  return Money.sum(dataset.months.map((cell) => cell.discountTotal));
}

export interface StockMaterialShare {
  /** Spent on lines that became a stock material. */
  stockSpend: Money;
  /** Spent on lines that are only a company expense. */
  companySpend: Money;
  /** `null` when nothing was spent: there is no share of zero. */
  share: Percentage | null;
  /** The other side of the same total. */
  companyShare: Percentage | null;
}

/**
 * How the spending divides between what became stock and what is only a company
 * expense (packaging, rent). It is the classification the lines already have,
 * not a category somebody chose. Money is added across the two sides; the
 * purchase count is not, and is not read here.
 */
export function stockMaterialShare(dataset: SpendingDataset): StockMaterialShare {
  const stockSpend = dataset.stockMaterial.netSpend;
  const companySpend = dataset.companyOnly.netSpend;

  const total = stockSpend.plus(companySpend);

  return {
    stockSpend,
    companySpend,
    share: Percentage.ofMoney(stockSpend, total),
    companyShare: Percentage.ofMoney(companySpend, total),
  };
}

// -- The chart ---------------------------------------------------------------

export interface MonthlyPoint {
  /** `YYYY-MM`. */
  month: string;
  netSpend: Money;
  discountTotal: Money;
  purchaseCount: number;
  /** The month is still running: its bar is not comparable with a closed month's. */
  partial: boolean;
}

/**
 * One point per month, oldest first, with the months that had no purchase filled
 * in at zero. `months` is every month the period covers; a month the dataset has
 * and the list does not is kept rather than dropped, so a chart never shows less
 * than the cards add up to.
 *
 * `currentMonth` is marked partial. The period always ends with the running
 * month, and a bar for a month that has not finished says less than a closed
 * month's, which is what the eye compares it with.
 */
export function monthlySeries(
  dataset: SpendingDataset,
  months: readonly string[],
  currentMonth: string,
): MonthlyPoint[] {
  const labels = [...new Set([...months, ...dataset.months.map((cell) => cell.month)])].sort();

  return labels.map((month) => {
    const cell = monthCell(dataset, month);

    return {
      month,
      netSpend: cell?.netSpend ?? Money.zero(),
      discountTotal: cell?.discountTotal ?? Money.zero(),
      purchaseCount: cell?.purchaseCount ?? 0,
      partial: month === currentMonth,
    };
  });
}

// -- The shops ---------------------------------------------------------------

export interface RankedEstablishment {
  /** What a row is keyed by. Purchases with no shop have no id, so they are keyed apart. */
  key: string;
  /** `null` for purchases that have no shop: there is nothing to filter the list by. */
  establishmentId: string | null;
  /** The name the note printed, the CNPJ when it printed only that, `null` for no shop. */
  name: string | null;
  netSpend: Money;
  discountTotal: Money;
  purchaseCount: number;
}

/**
 * The shops by what was paid at them, most first. The API already sends them in
 * that order; sorting again is what keeps the ranking true if it ever does not,
 * and the stable sort leaves a tie in the order it came.
 */
export function establishmentRanking(dataset: SpendingDataset): RankedEstablishment[] {
  return [...dataset.establishments]
    .sort((a, b) => b.netSpend.compare(a.netSpend))
    .map((cell, index) => ({
      key: cell.establishmentId ?? `without-establishment-${index}`,
      establishmentId: cell.establishmentId,
      name: cell.establishmentName ?? cell.establishmentId,
      netSpend: cell.netSpend,
      discountTotal: cell.discountTotal,
      purchaseCount: cell.purchaseCount,
    }));
}
