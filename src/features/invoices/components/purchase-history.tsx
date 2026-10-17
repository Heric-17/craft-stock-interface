import { SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { formatCount } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { Pagination } from '@/shared/ui/pagination';

import type { PurchaseFilters } from '../api/purchase-keys';
import { usePurchases } from '../api/use-purchases';
import { invoiceCountText } from '../model/labels';

import { PurchaseRow } from './purchase-row';

interface PurchaseHistoryProps {
  /** The period, already cut into the instants the API takes. */
  period: Pick<PurchaseFilters, 'from' | 'to'>;
  /** Where importing a note goes. */
  importPath: string;
  classificationPath: (purchaseId: string) => string;
}

/** The API's default page, and a size that reads well on a phone. */
const PAGE_SIZE = 20;

/**
 * Every imported note of a period, a page at a time, in the four states every
 * list has. The count is the API's `total` for the period, never the number of
 * rows on screen, and the period goes to the API as the parameters it accepts.
 */
export function PurchaseHistory({ period, importPath, classificationPath }: PurchaseHistoryProps) {
  // A different period is a different list, so it starts from its first page.
  // The page it was on is kept with the period it belongs to, which is how it
  // resets without an effect: a page of another period is not this one's.
  const [pageOf, setPageOf] = useState<{ key: string; offset: number }>({ key: '', offset: 0 });
  const key = `${period.from ?? ''}|${period.to ?? ''}`;
  const offset = pageOf.key === key ? pageOf.offset : 0;

  const history = usePurchases({ ...period, limit: PAGE_SIZE, offset });

  if (history.isPending) {
    return <LoadingSkeleton variant="table" />;
  }

  if (history.isError) {
    return (
      <ErrorState
        error={history.error}
        title="Não foi possível carregar as notas"
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
        title="Nenhuma nota neste período"
        description="Nenhuma nota importada tem data dentro do período escolhido. Mude o período ou importe uma nota."
        action={
          <Button asChild variant="outline">
            <Link to={importPath}>Importar nota</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {invoiceCountText(page.total, formatCount(page.total))} no período
      </p>
      <ul
        aria-label="Notas importadas"
        className="border-border bg-card shadow-card divide-border divide-y overflow-hidden rounded-xl border"
      >
        {page.items.map((purchase) => (
          <PurchaseRow
            key={purchase.id}
            purchase={purchase}
            href={classificationPath(purchase.id)}
          />
        ))}
      </ul>
      <Pagination
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        onOffsetChange={(next) => setPageOf({ key, offset: next })}
        label="notas"
        busy={history.isFetching}
      />
    </div>
  );
}
