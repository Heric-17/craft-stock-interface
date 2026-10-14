import { formatDateTime, formatMoney } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { UnexpectedError } from '@/shared/ui/unexpected-error';

import { usePriceHistory } from '../api/use-materials';
import { PRICE_ORIGIN_LABELS } from '../model/labels';

/**
 * Each change of the package cost, newest first, with where it came from: the
 * invoice that raised it or somebody editing it by hand. The costs shown are
 * the ones the API recorded — nothing here is a difference computed on screen.
 */
export function PriceHistorySection({ materialId }: { materialId: string }) {
  const history = usePriceHistory(materialId);

  return (
    <section aria-labelledby="price-history-title" className="flex flex-col gap-3">
      <h3 id="price-history-title" className="text-sm font-bold tracking-tight">
        Histórico de preço
      </h3>

      {history.isPending ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Carregando o histórico de preço…</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : history.isError ? (
        <div className="flex flex-col items-start gap-3">
          <UnexpectedError error={history.error} />
          <Button variant="outline" onClick={() => void history.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : history.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma alteração de custo registrada para este insumo.
        </p>
      ) : (
        <ol className="border-border divide-border divide-y rounded-lg border">
          {history.data.map((change) => (
            <li key={change.id} className="flex flex-col gap-0.5 px-3 py-2.5">
              <span className="text-sm font-semibold">
                {change.origin === 'CREATION'
                  ? formatMoney(change.newValue)
                  : `${formatMoney(change.previousValue)} → ${formatMoney(change.newValue)}`}
              </span>
              <span className="text-muted-foreground text-xs">
                {PRICE_ORIGIN_LABELS[change.origin]} · {formatDateTime(change.changedAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
