import { Money, Percentage, type DecimalString } from '@/shared/money';

import type { SalesDatasetDto } from '../api/sale.dto';

import type { PaymentStatus, ProductionStatus } from './status';

/**
 * The sales dataset as the cards read it, and the three figures derived from it.
 *
 * The API gives cells by dimension, not finished figures, and the dimensions
 * are **not the same kind of number**:
 *
 *  - `months` is *movement*: the sales created in the period, one cell per
 *    month. It respects the period that was asked for.
 *  - `open` is *balance*: every sale that is not both paid and delivered,
 *    whatever its date. A sale from last year that is still unpaid is in it.
 *    It does not move with the period.
 *
 * Mixing the two gives a number that is neither, so each derivation below
 * reads one of them and says which. "Sales this month" is movement; "in
 * production" and "to receive" are balance. The by-status cells of the same
 * response (`byPaymentStatus`, `byProductionStatus`) are movement as well — the
 * `PENDING` cell of those is the pending among the *period's* sales only, and
 * an old sale still open is not in it — which is why they are not read here.
 */

export interface SalesCell {
  saleCount: number;
  totalAmount: Money;
}

export interface MonthCell extends SalesCell {
  /** `YYYY-MM`, on the calendar of `America/Sao_Paulo`. */
  month: string;
}

export interface OpenCell extends SalesCell {
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
}

export interface SalesDataset {
  months: MonthCell[];
  open: OpenCell[];
}

function toCell(dto: { saleCount: number; totalAmount: DecimalString }): SalesCell {
  return { saleCount: dto.saleCount, totalAmount: Money.parse(dto.totalAmount) };
}

export function toSalesDataset(dto: SalesDatasetDto): SalesDataset {
  return {
    months: dto.byMonth.map((cell) => ({ month: cell.month, ...toCell(cell) })),
    open: dto.openItems.map((cell) => ({
      paymentStatus: cell.paymentStatus,
      productionStatus: cell.productionStatus,
      ...toCell(cell),
    })),
  };
}

// -- Movement ----------------------------------------------------------------

export interface MonthSales {
  saleCount: number;
  totalAmount: Money;
  /** `null` when there is no month before it in the dataset, or it sold nothing. */
  change: Percentage | null;
}

/**
 * Sales of `currentMonth` and how they compare with the month right before it
 * in the dataset. The cells arrive for every month of the period, zeros
 * included — a month with no sales is a cell, not a missing one — so the
 * previous month is the previous cell and not a date calculation.
 *
 * A previous month with no sales has nothing to be compared against: the
 * change is `null`, not an infinite increase.
 */
export function monthSales(dataset: SalesDataset, currentMonth: string): MonthSales {
  const months = [...dataset.months].sort((a, b) => a.month.localeCompare(b.month));
  const index = months.findIndex((cell) => cell.month === currentMonth);
  const current = index === -1 ? undefined : months[index];
  const previous = index > 0 ? months[index - 1] : undefined;

  const totalAmount = current?.totalAmount ?? Money.zero();

  return {
    saleCount: current?.saleCount ?? 0,
    totalAmount,
    change: previous === undefined ? null : Percentage.change(previous.totalAmount, totalAmount),
  };
}

// -- Balance -----------------------------------------------------------------

/** Orders whose production is not finished: still to make, or made and not delivered. */
const IN_PRODUCTION: readonly ProductionStatus[] = ['PENDING', 'ASSEMBLED'];

export interface OpenBalance {
  saleCount: number;
  totalAmount: Money;
}

/**
 * Orders in production: the open sales whose production is `PENDING` or
 * `ASSEMBLED`. A balance — the sales are counted whatever date they were made.
 * What counts as "in production" is this screen's definition, not the API's.
 */
export function ordersInProduction(dataset: SalesDataset): OpenBalance {
  return sumCells(dataset.open.filter((cell) => IN_PRODUCTION.includes(cell.productionStatus)));
}

/**
 * Amount to receive: the open sales not yet paid, whatever their production
 * stage and whatever date they were made. A balance.
 */
export function amountToReceive(dataset: SalesDataset): OpenBalance {
  return sumCells(dataset.open.filter((cell) => cell.paymentStatus === 'PENDING'));
}

function sumCells(cells: readonly OpenCell[]): OpenBalance {
  return {
    saleCount: cells.reduce((count, cell) => count + cell.saleCount, 0),
    totalAmount: Money.sum(cells.map((cell) => cell.totalAmount)),
  };
}
