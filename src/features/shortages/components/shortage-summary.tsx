import { ShoppingCart } from 'lucide-react';

import { formatMoney } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { Skeleton } from '@/shared/ui/skeleton';

import { partialTotalText, salesCountText } from '../model/labels';
import type { ShoppingList } from '../model/shopping-list';

interface ShortageSummaryProps {
  /** How many sales the list is built from now. */
  saleCount: number;
  /** How many sales have production pending: the API's `total`. */
  pendingTotal: number;
  onChooseSales: () => void;
  /** `undefined` until the first answer arrives, and while there is nothing to ask for. */
  list: ShoppingList | undefined;
}

/**
 * Which sales the list is for and what the API estimates it costs.
 *
 * The total is the API's. While any line could not be estimated it is a floor,
 * not the whole, and the card says so right under it: a number that looks
 * complete and is not is how a shopping budget comes up short at the counter.
 */
export function ShortageSummary({
  saleCount,
  pendingTotal,
  onChooseSales,
  list,
}: ShortageSummaryProps) {
  const partial = list !== undefined && list.unestimatedLineCount > 0;

  return (
    <section
      aria-label="Resumo da lista de compras"
      className="border-border bg-card shadow-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="bg-warning-muted text-warning grid size-11 shrink-0 place-items-center rounded-lg"
          >
            <ShoppingCart className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-foreground text-sm font-bold">
              {salesCountText(saleCount)} considerada{saleCount === 1 ? '' : 's'}
            </p>
            <p className="text-muted-foreground text-xs">
              {saleCount === pendingTotal
                ? 'Todas as vendas com produção pendente'
                : `De ${salesCountText(pendingTotal)} com produção pendente`}
            </p>
            <div>
              <Button variant="ghost" size="sm" className="-ml-3" onClick={onChooseSales}>
                Escolher vendas
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 sm:items-end">
          <p className="text-muted-foreground text-xs">
            {partial ? 'Total estimado parcial' : 'Total estimado'}
          </p>
          {list === undefined ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            // The API's figure. Zero is a result: nothing to buy costs R$ 0,00.
            <p className="text-warning text-xl font-bold whitespace-nowrap">
              {formatMoney(list.estimatedTotal)}
            </p>
          )}
        </div>
      </div>

      {partial ? (
        <Callout tone="warning">{partialTotalText(list.unestimatedLineCount)}</Callout>
      ) : null}
    </section>
  );
}
