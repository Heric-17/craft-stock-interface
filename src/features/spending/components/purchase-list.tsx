import { SearchX, X } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';

import { PurchaseRow, usePurchases, type PurchaseFilters } from '@/features/invoices';
import { formatCount } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { Pagination } from '@/shared/ui/pagination';

import {
  DISCOUNT_TO_DISTRIBUTE,
  DISCOUNT_TO_DISTRIBUTE_EXPLANATION,
  purchaseCountText,
} from '../model/labels';

/** The API's default page, and a size that reads well on a phone. */
const PAGE_SIZE = 20;

interface PurchaseListProps {
  /** The period, already cut into the instants the API takes. */
  period: Pick<PurchaseFilters, 'from' | 'to'>;
  /** Narrows the list to one shop; the API's own parameter. */
  establishmentId: string | undefined;
  /** Where one purchase opens. */
  purchasePath: (purchaseId: string) => string;
  /** Where the classification of a given purchase is: what "Classificar" opens. */
  classificationPath: (purchaseId: string) => string;
  /** Where importing a note goes, for a list with nothing in it. */
  importPath: string;
  /** Takes the shop filter off. */
  onClearEstablishment: () => void;
}

/**
 * The purchases of a period, newest first, a page at a time, in the four states
 * every list has. The period and the shop go to the API as the parameters it
 * accepts, and the count is the API's `total` for them — never the number of rows
 * on screen, and never a sum of what the rows hold.
 */
export function PurchaseList({
  period,
  establishmentId,
  purchasePath,
  classificationPath,
  importPath,
  onClearEstablishment,
}: PurchaseListProps) {
  // A different filter is a different list, so it starts from its first page. The
  // page is kept with the filter it belongs to, which is how it resets without an
  // effect: a page of another filter is not this one's.
  const key = `${period.from ?? ''}|${period.to ?? ''}|${establishmentId ?? ''}`;
  const [pageOf, setPageOf] = useState<{ key: string; offset: number }>({ key: '', offset: 0 });
  const offset = pageOf.key === key ? pageOf.offset : 0;

  const history = usePurchases({ ...period, establishmentId, limit: PAGE_SIZE, offset });

  if (history.isPending) {
    return <LoadingSkeleton variant="table" />;
  }

  if (history.isError) {
    return (
      <ErrorState
        error={history.error}
        title="Não foi possível carregar as compras"
        onRetry={() => void history.refetch()}
        retrying={history.isFetching}
      />
    );
  }

  const page = history.data;

  if (page.total === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Nenhuma compra neste período"
        description={
          establishmentId === undefined
            ? 'Nenhuma compra tem data dentro do período escolhido. Mude o período ou importe uma nota.'
            : 'Este estabelecimento não tem compra no período escolhido. Mude o período ou veja todos os estabelecimentos.'
        }
        action={
          establishmentId === undefined ? (
            <Button asChild variant="outline">
              <Link to={importPath}>Importar nota</Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onClearEstablishment}>
              Ver todos os estabelecimentos
            </Button>
          )
        }
      />
    );
  }

  // The API's answer for the shop is the same on every row, so the first one names it.
  const establishmentName = page.items[0]?.establishmentName;
  const hasPendingDiscount = page.items.some((purchase) => purchase.allocationPending);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {purchaseCountText(page.total, formatCount(page.total))} no período
        </p>
        {establishmentId === undefined ? null : (
          <Button type="button" variant="outline" size="sm" onClick={onClearEstablishment}>
            <X aria-hidden="true" />
            Só {establishmentName ?? establishmentId}
            <span className="sr-only">: tirar o filtro</span>
          </Button>
        )}
      </div>

      {hasPendingDiscount ? (
        <Callout tone="warning">
          <span className="font-semibold">{DISCOUNT_TO_DISTRIBUTE}.</span>{' '}
          {DISCOUNT_TO_DISTRIBUTE_EXPLANATION}
        </Callout>
      ) : null}

      <ul
        aria-label="Compras"
        className="border-border bg-card shadow-card divide-border divide-y overflow-hidden rounded-xl border"
      >
        {page.items.map((purchase) => (
          <PurchaseRow
            key={purchase.id}
            purchase={purchase}
            href={purchasePath(purchase.id)}
            action={
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to={classificationPath(purchase.id)}>
                  Classificar{' '}
                  <span className="sr-only">compra de {purchase.establishmentName}</span>
                </Link>
              </Button>
            }
          />
        ))}
      </ul>
      <Pagination
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        onOffsetChange={(next) => setPageOf({ key, offset: next })}
        label="compras"
        busy={history.isFetching}
      />
    </div>
  );
}
