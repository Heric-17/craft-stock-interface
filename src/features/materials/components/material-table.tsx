import { formatMoney, formatQuantity, formatUnitCost } from '@/shared/format';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';

import type { Material } from '../model/material';

import { MaterialStatusBadges } from './material-status-badges';

const COLUMNS: readonly DataTableColumn<Material>[] = [
  {
    id: 'material',
    header: 'Insumo',
    role: 'primary',
    cell: (material) => (
      // The width cap is what lets a long name end in an ellipsis inside a table
      // cell, which otherwise grows to fit it and pushes the other columns out.
      <span className="flex max-w-72 min-w-0 items-center gap-3">
        <ImageWithPlaceholder src={material.imageUrl} alt={material.name} className="size-11" />
        <span className="flex min-w-0 flex-col">
          <span className="text-foreground truncate font-semibold" title={material.name}>
            {material.name}
          </span>
          <span className="text-muted-foreground text-xs">
            Embalagem {formatQuantity(material.packageQuantity)}
          </span>
        </span>
      </span>
    ),
  },
  {
    id: 'stock',
    header: 'Estoque atual',
    cell: (material) => (
      <span className="flex flex-col">
        <span className="font-semibold">{formatQuantity(material.stockQuantity)}</span>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          mín. {formatQuantity(material.minimumStockAlert)}
        </span>
      </span>
    ),
  },
  {
    id: 'unit-cost',
    header: 'Custo fracionado',
    cell: (material) => (
      <span className="whitespace-nowrap">
        {formatUnitCost(material.unitCost, material.consumptionUnit)}
      </span>
    ),
  },
  {
    id: 'stock-value',
    header: 'Valor em estoque',
    cell: (material) => (
      <span className="whitespace-nowrap">{formatMoney(material.stockValue)}</span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (material) => <MaterialStatusBadges material={material} />,
  },
];

/**
 * The list of materials: a table from `md` up and a list of cards below it,
 * which is the `DataTable` doing its job. Every figure is the backend's —
 * `stockValue` is the per-material rounded value, not a product made here.
 */
export function MaterialTable({
  materials,
  hrefFor,
}: {
  materials: readonly Material[];
  hrefFor: (material: Material) => string;
}) {
  return (
    <DataTable
      caption="Insumos"
      columns={COLUMNS}
      rows={materials}
      getRowKey={(material) => material.id}
      getRowHref={hrefFor}
      // Five columns beside a sidebar: below `lg` they would hide behind a sideways scroll.
      tableFrom="lg"
    />
  );
}
