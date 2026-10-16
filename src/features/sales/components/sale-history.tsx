import { SearchX, ShoppingBag } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { formatCount } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { Pagination } from '@/shared/ui/pagination';

import type { SaleFilters } from '../api/sale-keys';
import { useCatalogImages, useSales } from '../api/use-sales';
import { salesCountText } from '../model/labels';

import { SaleCards } from './sale-cards';

interface SaleHistoryProps {
  filters: SaleFilters;
  /** Whether either status filter narrows the list: what "empty" means depends on it. */
  narrowed: boolean;
  /** "Nova venda", offered where the history is empty. */
  newSaleAction: ReactNode;
  onOffsetChange: (offset: number) => void;
  onClearFilters: () => void;
}

/**
 * The paginated list of sales, in the four states every screen with data has.
 *
 * The count above the list is `total`, the size of the set the API filtered,
 * and never the number of rows on screen. The filters are sent with the request;
 * nothing here narrows the page it got.
 */
export function SaleHistory({
  filters,
  narrowed,
  newSaleAction,
  onOffsetChange,
  onClearFilters,
}: SaleHistoryProps) {
  const history = useSales(filters);
  const images = useCatalogImages();

  // A page that lost its last row — the filter changed under it, or a sale was
  // moved out of it — goes back to the last page that has rows.
  const current = history.data;
  useEffect(() => {
    if (
      current !== undefined &&
      current.items.length === 0 &&
      current.total > 0 &&
      current.offset > 0
    ) {
      onOffsetChange(Math.floor((current.total - 1) / current.limit) * current.limit);
    }
  }, [current, onOffsetChange]);

  if (history.isPending) {
    return <LoadingSkeleton variant="table" />;
  }

  if (history.isError) {
    return (
      <ErrorState
        error={history.error}
        title="Não foi possível carregar as vendas"
        onRetry={() => void history.refetch()}
        retrying={history.isFetching}
      />
    );
  }

  const page = history.data;

  if (page.total === 0) {
    return narrowed ? (
      <EmptyState
        icon={SearchX}
        title="Nenhuma venda encontrada"
        description="Nenhuma venda combina com o pagamento e a produção escolhidos."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={ShoppingBag}
        title="Nenhuma venda registrada"
        description="Registre a primeira venda para acompanhar o pagamento e a produção de cada pedido."
        action={newSaleAction}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {salesCountText(page.total, formatCount(page.total))}
      </p>
      <SaleCards
        sales={page.items}
        images={images}
        // Relative to the list's screen: the detail of a sale is `<this screen>/<id>`.
        hrefFor={(sale) => encodeURIComponent(sale.id)}
      />
      <Pagination
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        onOffsetChange={onOffsetChange}
        label="vendas"
        busy={history.isFetching}
      />
    </div>
  );
}
