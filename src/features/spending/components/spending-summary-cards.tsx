import { CircleDollarSign, PiggyBank, ReceiptText, Boxes } from 'lucide-react';

import {
  formatCount,
  formatMonthName,
  formatMonthNameShort,
  formatMoney,
  formatPercent,
  formatPeriodPreset,
  previousMonthLabel,
} from '@/shared/format';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { StatCard } from '@/shared/ui/stat-card';

import { useSpendingDataset } from '../api/use-spending-dataset';
import {
  CARD_TEXT,
  changeText,
  purchaseCountText,
  RUNNING_MONTH_COMPARISON_NOTE,
} from '../model/labels';
import {
  averageTicket,
  discountSavings,
  monthSpending,
  stockMaterialShare,
} from '../model/spending-metrics';

import type { PeriodWindow } from './use-period-window';

/**
 * The four cards at the top. The month and the ticket are the running month's, so
 * they read the dataset of this month and the one before it, which is exactly
 * what the comparison needs. The saving and the share belong to the period the
 * field chose and read that dataset.
 *
 * Every amount is what was paid, and every card says which stretch it covers: a
 * month's figure beside a period's is two kinds of number, and the captions are
 * what keep them from being read as one. None of it comes from the purchase list
 * under the cards, which is one page of a longer history.
 */
export function SpendingSummaryCards({ scope }: { scope: PeriodWindow }) {
  // This month and the one before it, whatever the period chosen: the comparison
  // does not exist in a period of one month.
  const month = useSpendingDataset(scope.comparisonRange);
  const period = useSpendingDataset(scope.range);

  if (month.isPending || period.isPending) {
    return <LoadingSkeleton variant="cards" count={4} />;
  }

  if (month.isError || period.isError) {
    return (
      <ErrorState
        error={month.isError ? month.error : period.error}
        title="Não foi possível carregar os números dos gastos"
        onRetry={() => {
          void month.refetch();
          void period.refetch();
        }}
        retrying={month.isFetching || period.isFetching}
      />
    );
  }

  const current = monthSpending(month.data, scope.currentMonth);
  const ticket = averageTicket(current.netSpend, current.purchaseCount);
  const share = stockMaterialShare(period.data);
  const periodName = formatPeriodPreset(scope.preset);

  return (
    <section aria-label="Resumo dos gastos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={CircleDollarSign}
        tone="warning"
        label={CARD_TEXT.month.label}
        // Zero is a result: a month with no spending is R$ 0,00.
        value={formatMoney(current.netSpend)}
        caption={`${formatMonthName(scope.currentMonth)}, ${RUNNING_MONTH_COMPARISON_NOTE} · ${changeText(
          current.change,
          formatMonthNameShort(previousMonthLabel(scope.currentMonth)),
        )}`}
      />
      <StatCard
        icon={ReceiptText}
        tone="info"
        label={CARD_TEXT.ticket.label}
        value={ticket === null ? 'Sem compras' : formatMoney(ticket)}
        caption={`${purchaseCountText(current.purchaseCount, formatCount(current.purchaseCount))} no mês`}
      />
      <StatCard
        icon={PiggyBank}
        tone="primary"
        label={CARD_TEXT.savings.label}
        // No discount at all is R$ 0,00, not an absence of data.
        value={formatMoney(discountSavings(period.data))}
        caption={`${periodName} · quanto os descontos tiraram do que você pagaria`}
      />
      <StatCard
        icon={Boxes}
        tone="primary"
        label={CARD_TEXT.stockShare.label}
        value={share.share === null ? 'Sem gastos' : formatPercent(share.share)}
        caption={`${periodName} · ${formatMoney(share.stockSpend)} em insumos de estoque e ${formatMoney(
          share.companySpend,
        )} só em gasto da empresa`}
      />
    </section>
  );
}
