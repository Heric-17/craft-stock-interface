import { TriangleAlert } from 'lucide-react';

import { formatMoney, formatQuantity } from '@/shared/format';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';
import { StatusBadge } from '@/shared/ui/status-badge';

import { LINE_STATUS_LABELS, UNESTIMATED_LINE_TEXT } from '../model/labels';
import {
  isLineMarked,
  isUnestimated,
  needsPurchase,
  type LineMarks,
  type MaterialPackages,
  type ShoppingListLine,
} from '../model/shopping-list';
import { packagesPhrase } from '../model/shopping-text';

interface ShortageTableProps {
  lines: readonly ShoppingListLine[];
  packages: ReadonlyMap<string, MaterialPackages>;
  marks: LineMarks;
  onToggle: (line: ShoppingListLine) => void;
}

/**
 * What the open sales need, line by line, against what is in stock.
 *
 * A table from `xl` up and cards below it — six columns do not fit next to the
 * sidebar any sooner — and on a phone each card carries the same figures, with
 * the tick on the first line of it. Every quantity has its unit and every
 * figure is the API's; the only thing this component decides is how a line that
 * the API could not estimate is drawn.
 */
export function ShortageTable({ lines, packages, marks, onToggle }: ShortageTableProps) {
  const columns: DataTableColumn<ShoppingListLine>[] = [
    {
      id: 'material',
      header: 'Insumo',
      role: 'primary',
      cell: (line) => (
        <MaterialCell
          line={line}
          imageUrl={packages.get(line.materialId)?.imageUrl ?? null}
          marked={isLineMarked(line, marks)}
          onToggle={() => onToggle(line)}
        />
      ),
    },
    { id: 'needed', header: 'Necessário', cell: (line) => formatQuantity(line.needed) },
    { id: 'stock', header: 'Em estoque', cell: (line) => formatQuantity(line.stock) },
    {
      id: 'shortage',
      header: 'Falta comprar',
      cell: (line) => <ShortageCell line={line} packageSize={packages.get(line.materialId)} />,
    },
    { id: 'cost', header: 'Custo estimado', cell: (line) => <CostCell line={line} /> },
    { id: 'status', header: 'Situação', cell: (line) => <StatusCell line={line} /> },
  ];

  return (
    <DataTable
      caption="Necessidade de insumos"
      columns={columns}
      rows={lines}
      getRowKey={(line) => line.materialId}
      tableFrom="xl"
    />
  );
}

/**
 * The tick, the photo and the name, as one label: the whole of it is the target.
 * A material that is not missing cannot be ticked, since there is nothing to put
 * on the list for it. The photo is only there to be recognised by, so it stays
 * out of the name the tick is announced with.
 */
function MaterialCell({
  line,
  imageUrl,
  marked,
  onToggle,
}: {
  line: ShoppingListLine;
  imageUrl: string | null;
  marked: boolean;
  onToggle: () => void;
}) {
  const disabled = !needsPurchase(line);

  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 has-disabled:cursor-default">
      <input
        type="checkbox"
        checked={marked}
        disabled={disabled}
        onChange={onToggle}
        className="border-input accent-primary size-5 shrink-0 rounded"
      />
      <span aria-hidden="true" className="shrink-0">
        <ImageWithPlaceholder src={imageUrl} alt={line.name} className="size-12" />
      </span>
      <span className="text-foreground text-sm font-semibold wrap-break-word">{line.name}</span>
    </label>
  );
}

/** What is missing, and how many closed packages that is: the purchase is in packages. */
function ShortageCell({
  line,
  packageSize,
}: {
  line: ShoppingListLine;
  packageSize: MaterialPackages | undefined;
}) {
  if (!needsPurchase(line)) {
    return <Nothing />;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-warning font-bold">{formatQuantity(line.shortage)}</p>
      <p className="text-muted-foreground text-xs text-pretty">
        {line.packagesToBuy === null
          ? UNESTIMATED_LINE_TEXT.packages
          : packagesPhrase(line.packagesToBuy, packageSize)}
      </p>
    </div>
  );
}

/**
 * The API's estimate for the line. A line it could not estimate says so, with
 * the reason, and never shows a price: unknown is not R$ 0,00.
 */
function CostCell({ line }: { line: ShoppingListLine }) {
  if (!needsPurchase(line)) {
    return <Nothing />;
  }

  if (isUnestimated(line) || line.estimatedCost === null) {
    return (
      <div className="flex flex-col gap-0.5">
        <p className="text-warning flex items-center gap-1.5 font-semibold">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {UNESTIMATED_LINE_TEXT.badge}
        </p>
        <p className="text-muted-foreground text-xs text-pretty">{UNESTIMATED_LINE_TEXT.reason}</p>
      </div>
    );
  }

  return <p className="font-semibold whitespace-nowrap">{formatMoney(line.estimatedCost)}</p>;
}

function StatusCell({ line }: { line: ShoppingListLine }) {
  return needsPurchase(line) ? (
    <StatusBadge tone="warning">{LINE_STATUS_LABELS.buy}</StatusBadge>
  ) : (
    <StatusBadge tone="success">{LINE_STATUS_LABELS.enough}</StatusBadge>
  );
}

/** Nothing to buy: a dash, said to a screen reader in words. */
function Nothing() {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Nada a comprar</span>
    </span>
  );
}
