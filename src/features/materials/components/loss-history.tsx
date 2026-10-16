import { PackageMinus, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { isApiError } from '@/shared/api/api-error';
import { messageForError } from '@/shared/api/error-messages';
import { formatCount, formatDateTime, formatMoney, formatQuantity } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { showErrorToast } from '@/shared/ui/error-toast';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { Pagination } from '@/shared/ui/pagination';

import type { StockLossFilters } from '../api/material-keys';
import { useDeleteStockLoss } from '../api/use-material-mutations';
import { useStockLosses } from '../api/use-materials';
import type { Material } from '../model/material';
import type { StockLoss } from '../model/stock-loss';

import { LossTable } from './loss-table';
import { StockAdjustmentSheet } from './stock-adjustment-sheet';

/** The notice after a deletion says something the person must act on: it stays long enough to be read. */
const NOTICE_DURATION_MS = 12_000;

interface LossHistoryProps {
  filters: StockLossFilters;
  /** Only for the "Corrigir contagem" shortcut of the notice: the list itself does not read it. */
  materials: readonly Material[];
  /** Whether anything narrows the list beyond the period: what "empty" means depends on it. */
  narrowed: boolean;
  onOffsetChange: (offset: number) => void;
  onClearFilters: () => void;
}

/**
 * The paginated loss list and the one thing that can be done to a row of it:
 * delete it, when it was recorded by mistake.
 *
 * Deleting a loss takes it off the list and out of the total of the period, and
 * **leaves the stock where it is**. What the loss took off the shelf stays off
 * until somebody counts it back, so the confirmation says so before, and the
 * notice after says how much to put back and offers the recount.
 *
 * The count above the list is `total`, the size of the filtered set, and never
 * the number of rows on screen.
 */
export function LossHistory({
  filters,
  materials,
  narrowed,
  onOffsetChange,
  onClearFilters,
}: LossHistoryProps) {
  const history = useStockLosses(filters);
  const remove = useDeleteStockLoss();
  const [target, setTarget] = useState<StockLoss | null>(null);
  // The material whose stock is being counted back, from the notice's shortcut.
  const [recount, setRecount] = useState<Material | null>(null);

  // Deleting the last loss of the last page leaves that page with nothing on it
  // while the list still has some: go back to the last page that has rows.
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

  if (history.isError || history.data === undefined) {
    return (
      <ErrorState
        error={history.error}
        title="Não foi possível carregar as perdas"
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
        title="Nenhuma perda encontrada"
        description="Nenhuma perda do período combina com o insumo e o motivo escolhidos."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={PackageMinus}
        title="Nenhuma perda neste período"
        description="As perdas aparecem aqui quando você dá baixa em um insumo, com o motivo e quanto custou."
      />
    );
  }

  function confirmDeletion(): void {
    if (target === null) {
      return;
    }

    remove.mutate(target.id, {
      onSuccess: (deleted) => {
        const material = materials.find((item) => item.id === deleted.materialId);
        const putBack = `${formatQuantity(deleted.quantity)} de ${deleted.materialName}`;

        toast.success(`Perda excluída. O estoque não foi alterado: adicione de volta ${putBack}.`, {
          duration: NOTICE_DURATION_MS,
          ...(material === undefined
            ? {}
            : { action: { label: 'Corrigir contagem', onClick: () => setRecount(material) } }),
        });
        setTarget(null);
      },
      onError: (error) => {
        setTarget(null);

        // Already gone — another tab, or a double click — is not a failure of
        // anything: the list has been read again and no longer has the row.
        if (isApiError(error) && error.code === 'STOCK_LOSS_NOT_FOUND') {
          toast.info(messageForError(error));

          return;
        }

        showErrorToast(error);
      },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {page.total === 1 ? '1 perda' : `${formatCount(page.total)} perdas`}
      </p>

      <LossTable
        losses={page.items}
        // The photo is read from the list the screen already has; the loss does not carry one.
        imageFor={(materialId) =>
          materials.find((material) => material.id === materialId)?.imageUrl ?? null
        }
        busy={remove.isPending}
        onDelete={setTarget}
      />

      <Pagination
        total={page.total}
        limit={page.limit}
        offset={page.offset}
        onOffsetChange={onOffsetChange}
        label="perdas"
        busy={history.isFetching}
      />

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target === null ? '' : `Excluir a perda de ${target.materialName}?`}
        description={
          target === null ? null : (
            <div className="flex flex-col gap-2">
              <p className="text-foreground font-medium">
                {formatQuantity(target.quantity)} de {target.materialName},{' '}
                {formatMoney(target.value)}, lançado em {formatDateTime(target.createdAt)}.
              </p>
              <p className="text-foreground">
                <strong>O estoque não será alterado.</strong> Excluir só tira a perda da lista e do
                total do período: o que ela tirou do estoque continua fora até você repor.
              </p>
              <p>Para repor, use “Corrigir contagem” no insumo. Não dá para restaurar a perda.</p>
            </div>
          )
        }
        confirmLabel="Excluir perda"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDeletion}
      />

      <StockAdjustmentSheet
        open={recount !== null}
        onOpenChange={(open) => !open && setRecount(null)}
        kind="RECOUNT"
        material={recount ?? undefined}
      />
    </div>
  );
}
