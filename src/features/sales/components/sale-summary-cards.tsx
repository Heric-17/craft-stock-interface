import { CalendarDays, Hammer, Wallet } from 'lucide-react';
import { useMemo } from 'react';

import { buildMonthsRange, businessMonthLabel, formatCount, formatMoney } from '@/shared/format';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { StatCard } from '@/shared/ui/stat-card';

import { useSalesDataset } from '../api/use-sales';
import { CARD_TEXT, changeText } from '../model/labels';
import { amountToReceive, monthSales, ordersInProduction } from '../model/sales-metrics';

/**
 * The three cards at the top, from the sales dataset and from nothing else —
 * not a row of the list below, which is one page of a longer history.
 *
 * They are two different kinds of number and say so. "Vendas no mês" is
 * movement: the sales created this month, compared with last month. "Pedidos
 * em produção" and "A receber" are balance: every open sale, whatever its
 * date, so an order from last quarter that was never paid is in "A receber".
 * The two are never added, and each caption says which it is.
 *
 * The window asked for is this month and the one before it, which is exactly
 * what the comparison needs.
 */
export function SaleSummaryCards() {
  const range = useMemo(() => buildMonthsRange(2), []);
  const currentMonth = useMemo(() => businessMonthLabel(), []);
  const dataset = useSalesDataset(range);

  if (dataset.isPending) {
    return <LoadingSkeleton variant="cards" />;
  }

  if (dataset.isError) {
    return (
      <ErrorState
        error={dataset.error}
        title="Não foi possível carregar os números das vendas"
        onRetry={() => void dataset.refetch()}
        retrying={dataset.isFetching}
      />
    );
  }

  const month = monthSales(dataset.data, currentMonth);
  const production = ordersInProduction(dataset.data);
  const receivable = amountToReceive(dataset.data);

  return (
    <section aria-label="Resumo das vendas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        icon={CalendarDays}
        tone="primary"
        label={CARD_TEXT.month.label}
        // Zero is a result: a month that sold nothing is R$ 0,00.
        value={formatMoney(month.totalAmount)}
        caption={`${CARD_TEXT.month.scope} · ${changeText(month.change)}`}
      />
      <StatCard
        icon={Hammer}
        tone="info"
        label={CARD_TEXT.production.label}
        value={formatCount(production.saleCount)}
        caption={CARD_TEXT.production.scope}
      />
      <StatCard
        icon={Wallet}
        tone="warning"
        label={CARD_TEXT.receivable.label}
        value={formatMoney(receivable.totalAmount)}
        caption={CARD_TEXT.receivable.scope}
      />
    </section>
  );
}
