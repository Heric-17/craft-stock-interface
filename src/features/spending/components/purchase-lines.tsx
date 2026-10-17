import { formatMoney, formatPrintedQuantity } from '@/shared/format';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { StatusBadge, type StatusTone } from '@/shared/ui/status-badge';

import type { PurchaseLine } from '@/features/invoices';

import {
  lineClassification,
  LINE_CLASSIFICATION_LABELS,
  type LineClassification,
} from '../model/labels';

const CLASSIFICATION_TONES: Record<LineClassification, StatusTone> = {
  STOCK_MATERIAL: 'success',
  COMPANY_EXPENSE: 'info',
  PERSONAL: 'neutral',
};

const COLUMNS: readonly DataTableColumn<PurchaseLine>[] = [
  {
    id: 'description',
    header: 'Item',
    role: 'primary',
    cell: (line) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-pretty wrap-break-word">
          {line.description}
        </span>
        <span className="text-muted-foreground text-xs">
          Como veio na nota: {formatPrintedQuantity(line.quantity, line.printedUnit)}
        </span>
      </span>
    ),
  },
  {
    id: 'classification',
    header: 'Classificação',
    cell: (line) => {
      const classification = lineClassification(line);

      return (
        <StatusBadge tone={CLASSIFICATION_TONES[classification]}>
          {LINE_CLASSIFICATION_LABELS[classification]}
        </StatusBadge>
      );
    },
  },
  {
    id: 'gross',
    header: 'Valor bruto',
    align: 'end',
    cell: (line) => <span className="whitespace-nowrap">{formatMoney(line.grossValue)}</span>,
  },
  {
    id: 'discount',
    header: 'Desconto atribuído',
    align: 'end',
    cell: (line) => (
      <span className="whitespace-nowrap">{formatMoney(line.allocatedDiscount)}</span>
    ),
  },
  {
    id: 'net',
    header: 'Valor líquido',
    align: 'end',
    cell: (line) => (
      <span className="font-bold whitespace-nowrap">{formatMoney(line.netValue)}</span>
    ),
  },
];

/**
 * The lines of a purchase as the API worked them out: the full price, the discount
 * attributed to the line and what it cost after it. Nothing is added or
 * subtracted here — the net value of a line is the API's, not `gross − discount`
 * done on this side.
 *
 * Five columns do not fit beside the sidebar until the screen is wide, so the table
 * only starts at `xl`; below it each line is a card, with the same figures.
 */
export function PurchaseLines({ lines }: { lines: readonly PurchaseLine[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={lines}
      getRowKey={(line) => line.id}
      caption="Itens da compra"
      tableFrom="xl"
    />
  );
}
