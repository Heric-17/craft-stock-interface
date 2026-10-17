import type { PurchaseLine } from '@/features/invoices';
import { formatPercent } from '@/shared/format';
import type { Percentage } from '@/shared/money';

/** The badge of a purchase whose discount was not spread over its lines yet. */
export const DISCOUNT_TO_DISTRIBUTE = 'Desconto a distribuir';

/** What a purchase in that state means for the panel, said wherever the badge is. */
export const DISCOUNT_TO_DISTRIBUTE_EXPLANATION =
  'Enquanto o desconto não for distribuído entre os itens, esta compra não entra nos números do painel de gastos.';

/** "1 compra", "24 compras": a count of purchases. */
export function purchaseCountText(count: number, formatted: string): string {
  return count === 1 ? '1 compra' : `${formatted} compras`;
}

/**
 * The change against the month before, written for a card. `null` is a month with
 * nothing to compare against, which is said as such and never as a percentage.
 */
export function changeText(change: Percentage | null, previousMonthName: string): string {
  if (change === null) {
    return 'Sem gastos no mês anterior para comparar';
  }

  const sign = change.isNegative() || change.isZero() ? '' : '+';

  return `${sign}${formatPercent(change)} contra ${previousMonthName}`;
}

/** The running month is not finished, and the comparison with a closed one is unfair to it. */
export const RUNNING_MONTH_COMPARISON_NOTE = 'mês ainda em andamento';

/** In the tooltip of the dashed bar. */
export const RUNNING_MONTH_CHART_NOTE =
  'Mês em andamento: ainda incompleto, não compare com os meses fechados.';

/** Under the chart: what the dashed bar is. */
export const RUNNING_MONTH_LEGEND = 'Barra tracejada: mês em andamento, ainda incompleto.';

export const RUNNING_MONTH_BADGE = 'em andamento';

/** What each card says it is counting, and over which stretch of time. */
export const CARD_TEXT = {
  month: { label: 'Total no mês' },
  ticket: { label: 'Ticket médio' },
  savings: { label: 'Economia em descontos' },
  stockShare: { label: 'Insumos de estoque no gasto' },
} as const;

/**
 * What the panel adds up and what it leaves out, in a few lines: the two facts
 * that make a figure here differ from one somebody expects.
 */
export const SPENDING_HELP = {
  title: 'Como ler estes números',
  paidValue:
    'O painel soma o valor pago: o preço dos itens menos o desconto da nota. Por isso o total pode ser menor do que a soma das linhas.',
  materialCost:
    'O custo do insumo é outra conta: ele usa o valor cheio da linha, sem desconto, e só sobe.',
  split:
    'A divisão do gasto é entre o que vira insumo de estoque e o que é só gasto da empresa, como embalagem e aluguel. Não é uma categoria que você escolhe.',
} as const;

export type LineClassification = 'STOCK_MATERIAL' | 'COMPANY_EXPENSE' | 'PERSONAL';

export function lineClassification(
  line: Pick<PurchaseLine, 'isCompanyExpense' | 'isStockMaterial'>,
): LineClassification {
  if (line.isStockMaterial) {
    return 'STOCK_MATERIAL';
  }

  return line.isCompanyExpense ? 'COMPANY_EXPENSE' : 'PERSONAL';
}

export const LINE_CLASSIFICATION_LABELS: Record<LineClassification, string> = {
  STOCK_MATERIAL: 'Insumo de estoque',
  COMPANY_EXPENSE: 'Gasto da empresa',
  PERSONAL: 'Gasto pessoal',
};

/** A purchase of the list that has no shop on the note. */
export const NO_ESTABLISHMENT_NAME = 'Sem estabelecimento';
