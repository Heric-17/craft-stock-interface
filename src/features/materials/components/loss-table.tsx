import { Trash2 } from 'lucide-react';

import { formatDateTime, formatMoney, formatQuantity } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';

import { STOCK_LOSS_REASON_LABELS } from '../model/labels';
import type { StockLoss } from '../model/stock-loss';

interface LossTableProps {
  losses: readonly StockLoss[];
  /** A deletion is being sent: no second one may start beside it. */
  busy: boolean;
  onDelete: (loss: StockLoss) => void;
}

function lossColumns(
  busy: boolean,
  onDelete: (loss: StockLoss) => void,
): readonly DataTableColumn<StockLoss>[] {
  return [
    {
      id: 'material',
      header: 'Insumo',
      role: 'primary',
      cell: (loss) => (
        <span className="flex max-w-64 min-w-0 flex-col gap-0.5">
          <span className="text-foreground font-semibold text-balance">{loss.materialName}</span>
          {loss.observation === null ? null : (
            <span className="text-muted-foreground line-clamp-2 text-xs" title={loss.observation}>
              {loss.observation}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'quantity',
      header: 'Quantidade',
      cell: (loss) => <span className="whitespace-nowrap">{formatQuantity(loss.quantity)}</span>,
    },
    {
      id: 'reason',
      header: 'Motivo',
      cell: (loss) => STOCK_LOSS_REASON_LABELS[loss.reason],
    },
    {
      id: 'value',
      header: 'Valor',
      // The API's figure, derived there from the cost frozen with the loss.
      cell: (loss) => (
        <span className="font-semibold whitespace-nowrap">{formatMoney(loss.value)}</span>
      ),
    },
    {
      id: 'date',
      header: 'Data',
      cell: (loss) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatDateTime(loss.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Ação',
      cell: (loss) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          aria-label={`Excluir perda de ${loss.materialName}`}
          onClick={() => onDelete(loss)}
        >
          <Trash2 aria-hidden="true" />
          Excluir
        </Button>
      ),
    },
  ];
}

/**
 * The loss history: a table from `xl` up and a list of cards below it. Every
 * figure is the API's. A loss recorded by mistake can be deleted, and that
 * leaves the stock alone — which the confirmation says before it happens.
 */
export function LossTable({ losses, busy, onDelete }: LossTableProps) {
  return (
    <DataTable
      caption="Perdas de estoque"
      columns={lossColumns(busy, onDelete)}
      rows={losses}
      getRowKey={(loss) => loss.id}
      // Six columns beside a sidebar: below `xl` they would hide behind a sideways scroll.
      tableFrom="xl"
    />
  );
}
