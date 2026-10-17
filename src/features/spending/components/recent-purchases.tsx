import { ArrowUpRight, ReceiptText } from 'lucide-react';
import { Link } from 'react-router';

import { PurchaseRow, usePurchases } from '@/features/invoices';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

/** Enough to see what came in lately; the whole history is behind "Ver todas". */
const RECENT_COUNT = 5;

interface RecentPurchasesProps {
  /** Where the whole list is. */
  purchasesPath: string;
  /** Where one purchase opens. */
  purchasePath: (purchaseId: string) => string;
  /** What the empty list offers: importing a note. */
  importPath: string;
}

/**
 * The latest purchases, from the paginated list, shown as they are. Nothing on
 * this screen is added up from them: they are the newest of a history that is
 * longer than this page, and the figures come from the dataset.
 *
 * A purchase whose discount is still to be attributed is here with its badge, and
 * is not in the figures above — the row says so, so the two do not look like a
 * mistake.
 */
export function RecentPurchases({ purchasesPath, purchasePath, importPath }: RecentPurchasesProps) {
  const recent = usePurchases({ limit: RECENT_COUNT, offset: 0 });

  return (
    <section
      aria-labelledby="recent-purchases-title"
      className="border-border bg-card shadow-card flex min-w-0 flex-col rounded-xl border"
    >
      <div className="border-border flex items-start justify-between gap-3 border-b p-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="recent-purchases-title" className="text-base font-bold tracking-tight">
            Compras recentes
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">Últimas compras registradas.</p>
        </div>
        <Button asChild variant="ghost" className="shrink-0">
          <Link to={purchasesPath}>
            Ver todas
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {recent.isPending ? <LoadingSkeleton variant="table" count={3} className="p-4" /> : null}

      {recent.isError ? (
        <div className="p-4">
          <ErrorState
            error={recent.error}
            title="Não foi possível carregar as compras"
            onRetry={() => void recent.refetch()}
            retrying={recent.isFetching}
          />
        </div>
      ) : null}

      {recent.isSuccess && recent.data.items.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Nenhuma compra ainda"
          description="As compras aparecem aqui assim que você importa uma nota."
          className="m-4 border-0"
          action={
            <Button asChild variant="outline">
              <Link to={importPath}>Importar nota</Link>
            </Button>
          }
        />
      ) : null}

      {recent.isSuccess && recent.data.items.length > 0 ? (
        <ul aria-label="Compras recentes" className="divide-border divide-y">
          {recent.data.items.map((purchase) => (
            <PurchaseRow key={purchase.id} purchase={purchase} href={purchasePath(purchase.id)} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
