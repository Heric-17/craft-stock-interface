import { formatMonthName, formatSheetMoney, formatSheetPercent } from '@/shared/format';

import { NO_ESTABLISHMENT_NAME } from './labels';
import type { SpendingDataset } from './spending-dataset';
import {
  discountSavings,
  establishmentRanking,
  monthlySeries,
  periodSpending,
  stockMaterialShare,
} from './spending-metrics';

export interface SpendingReportInput {
  dataset: SpendingDataset;
  /** Every month the period covers, oldest first. */
  months: readonly string[];
  /** The running month, which the report marks as not finished. */
  currentMonth: string;
  /** The period as the screen names it: "Últimos 6 meses". */
  periodLabel: string;
}

/**
 * The rows of the spending report, from the dataset the screen already holds and
 * through the same derivations the screen uses, so the file and the panel cannot
 * say two different things. Amounts are in reais, in Brazilian form, with nothing
 * around them; the header of each column says what it is.
 *
 * The count of purchases is given by month and for the period, where it adds up.
 * The split between stock and other company expenses carries amounts and shares
 * only: its counts overlap, and a column that does not add up is not offered.
 */
export function buildSpendingReport({
  dataset,
  months,
  currentMonth,
  periodLabel,
}: SpendingReportInput): string[][] {
  const series = monthlySeries(dataset, months, currentMonth);
  const total = periodSpending(dataset);
  const split = stockMaterialShare(dataset);

  return [
    ['Gastos da empresa'],
    ['Período', periodLabel],
    ['Valores em reais (R$): o valor pago, já com o desconto.'],
    [],
    ['Gasto por mês'],
    ['Mês', 'Gasto (R$)', 'Economia em descontos (R$)', 'Compras'],
    ...series.map((point) => [
      point.partial
        ? `${formatMonthName(point.month)} (em andamento)`
        : formatMonthName(point.month),
      formatSheetMoney(point.netSpend),
      formatSheetMoney(point.discountTotal),
      String(point.purchaseCount),
    ]),
    [
      'Total do período',
      formatSheetMoney(total.netSpend),
      formatSheetMoney(discountSavings(dataset)),
      String(total.purchaseCount),
    ],
    [],
    ['Onde você compra'],
    ['Estabelecimento', 'Gasto (R$)', 'Economia em descontos (R$)', 'Compras'],
    ...establishmentRanking(dataset).map((shop) => [
      shop.name ?? NO_ESTABLISHMENT_NAME,
      formatSheetMoney(shop.netSpend),
      formatSheetMoney(shop.discountTotal),
      String(shop.purchaseCount),
    ]),
    [],
    ['Insumos de estoque e gasto da empresa'],
    ['Tipo', 'Gasto (R$)', 'Participação (%)'],
    [
      'Insumo de estoque',
      formatSheetMoney(split.stockSpend),
      split.share === null ? '' : formatSheetPercent(split.share),
    ],
    [
      'Só gasto da empresa',
      formatSheetMoney(split.companySpend),
      split.companyShare === null ? '' : formatSheetPercent(split.companyShare),
    ],
  ];
}

/** `gastos-2026-05-a-2026-10.csv`: the file says which months it covers. */
export function spendingReportFileName(months: readonly string[]): string {
  const first = months[0];
  const last = months[months.length - 1];

  return first === undefined || last === undefined || first === last
    ? `gastos-${first ?? 'periodo'}.csv`
    : `gastos-${first}-a-${last}.csv`;
}
