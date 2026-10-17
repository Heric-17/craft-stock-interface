import { FileText, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import { formatCount } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

import { usePurchases } from '../api/use-purchases';

import { PurchaseRow } from './purchase-row';

/** Enough to see what came in lately, few enough to leave the capture form in view. */
const RECENT_COUNT = 5;

interface RecentInvoicesProps {
  /** Where the second step of a given purchase is. */
  classificationPath: (purchaseId: string) => string;
  /** Where every imported note is. */
  historyPath: string;
  /** What the empty list offers: start a new import. */
  onStartImport: () => void;
}

/**
 * The last notes that came in, from the purchase history: the shop, the day, the
 * amount paid. The queue of notes that have not been read yet is another list,
 * above this one, because a note that has not been read has none of those.
 */
export function RecentInvoices({
  classificationPath,
  historyPath,
  onStartImport,
}: RecentInvoicesProps) {
  const recent = usePurchases({ limit: RECENT_COUNT, offset: 0 });
  const page = recent.data;

  return (
    <section
      aria-labelledby="recent-invoices-title"
      className="border-border bg-card shadow-card flex flex-col rounded-xl border"
    >
      <div className="border-border flex items-start justify-between gap-3 border-b p-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="recent-invoices-title" className="text-base font-bold tracking-tight">
            Notas recentes
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            As últimas notas importadas, de qualquer aparelho. Toque numa nota para abri-la.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Atualizar lista"
          // A square the size of a fingertip, however narrow the title beside it gets.
          className="shrink-0"
          disabled={recent.isFetching}
          onClick={() => void recent.refetch()}
        >
          <RefreshCw
            aria-hidden="true"
            className={cn('size-5', recent.isFetching && 'animate-spin motion-reduce:animate-none')}
          />
        </Button>
      </div>

      {recent.isPending ? (
        <div className="p-4 sm:px-5">
          <LoadingSkeleton variant="table" count={3} />
        </div>
      ) : null}

      {recent.isError ? (
        <div className="p-4 sm:px-5">
          <ErrorState
            error={recent.error}
            title="Não foi possível carregar as notas"
            onRetry={() => void recent.refetch()}
            retrying={recent.isFetching}
          />
        </div>
      ) : null}

      {page === undefined ? null : page.total === 0 ? (
        <div className="p-4 sm:px-5">
          <EmptyState
            icon={FileText}
            title="Nenhuma nota importada ainda"
            description="Escaneie o QR Code da nota fiscal ou cole o endereço dele para começar."
            action={
              <Button type="button" variant="outline" onClick={onStartImport}>
                Colar o endereço
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul aria-label="Notas recentes" className="divide-border divide-y">
            {page.items.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
                href={classificationPath(purchase.id)}
              />
            ))}
          </ul>
          <div className="border-border flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {page.total > page.items.length
                ? `Mostrando as ${formatCount(page.items.length)} mais recentes de ${formatCount(page.total)}.`
                : page.total === 1
                  ? '1 nota importada.'
                  : `${formatCount(page.total)} notas importadas.`}
            </p>
            <Button asChild variant="outline">
              <Link to={historyPath}>Ver todas as compras</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
