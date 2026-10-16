import { PackageMinus } from 'lucide-react';

import { formatCount, formatMoney, type PeriodRange } from '@/shared/format';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';

import { useStockLossDataset } from '../api/use-materials';
import { STOCK_LOSS_REASON_LABELS } from '../model/labels';
import { biggestLossMaterial, periodLossTotals, reasonsWithLosses } from '../model/stock-loss';

/**
 * "Perdas no período": what was lost between two dates, and where it went.
 *
 * Every figure here comes from the API's dataset — the months added up, the
 * reasons and the materials it already grouped — and **none** from the rows of
 * the list below, which is a page of a longer list and one filter away from
 * being a different subset. The card therefore answers for the whole period,
 * whatever the list is filtered by, and says so.
 */
export function LossPeriodCard({ range }: { range: PeriodRange }) {
  const dataset = useStockLossDataset({ from: range.from, to: range.to });

  if (dataset.isPending) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="border-border bg-card shadow-card flex flex-col gap-3 rounded-xl border p-5"
      >
        <span className="sr-only">Carregando as perdas do período…</span>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  if (dataset.isError) {
    return (
      <ErrorState
        error={dataset.error}
        title="Não foi possível carregar as perdas do período"
        onRetry={() => void dataset.refetch()}
        retrying={dataset.isFetching}
      />
    );
  }

  const totals = periodLossTotals(dataset.data);
  const reasons = reasonsWithLosses(dataset.data);
  const biggest = biggestLossMaterial(dataset.data);

  return (
    <section
      aria-label="Perdas no período"
      className="border-border bg-card shadow-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="bg-destructive-muted text-destructive grid size-11 shrink-0 place-items-center rounded-lg"
        >
          <PackageMinus className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-muted-foreground text-xs">Perdas no período</h2>
          {/* Zero is a result, not a missing figure: nothing was lost. */}
          <p className="text-foreground text-2xl font-bold tracking-tight whitespace-nowrap">
            {formatMoney(totals.lossValue)}
          </p>
          <p className="text-muted-foreground text-xs">
            {totals.lossCount === 0
              ? 'Nenhuma perda neste período.'
              : totals.lossCount === 1
                ? '1 perda'
                : `${formatCount(totals.lossCount)} perdas`}
          </p>
        </div>
      </div>

      {totals.lossCount === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.08em] uppercase">
              Por motivo
            </h3>
            <ul className="flex flex-col gap-1.5">
              {reasons.map((cell) => (
                <li key={cell.reason} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    {STOCK_LOSS_REASON_LABELS[cell.reason]}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({formatCount(cell.lossCount)})
                    </span>
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {formatMoney(cell.lossValue)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {biggest === null ? null : (
            <div className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.08em] uppercase">
                Maior perda
              </h3>
              <p className="text-sm">
                <span className="font-semibold text-balance">{biggest.materialName}</span>
                <br />
                <span className="font-semibold whitespace-nowrap">
                  {formatMoney(biggest.lossValue)}
                </span>{' '}
                <span className="text-muted-foreground text-xs">
                  em{' '}
                  {biggest.lossCount === 1 ? '1 perda' : `${formatCount(biggest.lossCount)} perdas`}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-muted-foreground text-xs text-pretty">
        Soma de todas as perdas do período, sem os filtros da lista.
      </p>
    </section>
  );
}
