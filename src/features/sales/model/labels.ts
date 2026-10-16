import { formatPercent } from '@/shared/format';
import type { Percentage } from '@/shared/money';

import type { PaymentStatus, ProductionStatus } from './status';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
};

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  PENDING: 'Pendente',
  ASSEMBLED: 'Montado',
  DELIVERED: 'Entregue',
};

/** The words of the filters, which read "everything" when nothing narrows the list. */
export const PAYMENT_FILTER_ALL = 'Todos os pagamentos';
export const PRODUCTION_FILTER_ALL = 'Toda a produção';

/** "1 venda", "24 vendas": a count of sales, from the API's `total`. */
export function salesCountText(count: number, formatted: string): string {
  return count === 1 ? '1 venda' : `${formatted} vendas`;
}

/**
 * The change against the month before, written for a card: `+12,6%` or `-3,0%`.
 * `null` is a month with nothing to compare against, which is said as such and
 * never as a percentage.
 */
export function changeText(change: Percentage | null): string {
  if (change === null) {
    return 'Sem mês anterior para comparar';
  }

  const sign = change.isNegative() || change.isZero() ? '' : '+';

  return `${sign}${formatPercent(change)} contra o mês anterior`;
}

/** What each card of the top says it is counting: a month's movement or the balance that is open. */
export const CARD_TEXT = {
  month: {
    label: 'Vendas no mês',
    scope: 'Movimento do mês atual',
  },
  production: {
    label: 'Pedidos em produção',
    scope: 'Saldo atual: pendentes e montados, de qualquer data',
  },
  receivable: {
    label: 'A receber',
    scope: 'Saldo atual: vendas não pagas, de qualquer data',
  },
} as const;
