import { formatDateTime, formatMarginPercent, formatMoney } from '@/shared/format';
import { DataTable, type DataTableColumn } from '@/shared/ui/data-table';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';

import type { CompositeProduct } from '../model/composite-product';

import { CapacityBadge, DiscontinuedBadge } from './product-status-badges';

const COLUMNS: readonly DataTableColumn<CompositeProduct>[] = [
  {
    id: 'product',
    header: 'Produto',
    role: 'primary',
    cell: (product) => (
      // The width cap is what keeps a long name from growing the cell and pushing
      // the other five columns out of a table that has to fit beside a sidebar.
      // The name wraps to two lines and ends in an ellipsis after that, instead
      // of being cut at one line and losing most of what it says.
      <span className="flex max-w-56 min-w-0 items-center gap-3">
        <ImageWithPlaceholder src={product.imageUrl} alt={product.name} className="size-11" />
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span
            className="text-foreground line-clamp-2 max-w-full font-semibold wrap-break-word"
            title={product.name}
          >
            {product.name}
          </span>
          {product.isActive ? null : <DiscontinuedBadge />}
        </span>
      </span>
    ),
  },
  {
    id: 'total-cost',
    header: 'Custo total',
    cell: (product) => <span className="whitespace-nowrap">{formatMoney(product.totalCost)}</span>,
  },
  {
    id: 'suggested-price',
    header: 'Preço sugerido',
    cell: (product) => (
      <span className="flex flex-col">
        <span className="font-semibold whitespace-nowrap">
          {formatMoney(product.suggestedPrice)}
        </span>
        {product.manualPrice === null ? null : (
          // Only when someone typed a price of their own: otherwise the practiced
          // price is the suggested one, and saying it twice is noise.
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            Praticado {formatMoney(product.manualPrice)}
          </span>
        )}
      </span>
    ),
  },
  {
    id: 'margin',
    header: 'Margem',
    cell: (product) => (
      <span className="whitespace-nowrap">
        {formatMarginPercent(product.profitMarginBasisPoints)}
      </span>
    ),
  },
  {
    id: 'capacity',
    header: 'Dá para produzir',
    cell: (product) => (
      <span className="flex flex-col items-start gap-1">
        <CapacityBadge capacity={product.productionCapacity} />
        {product.bottleneck === null ? null : (
          <span className="text-muted-foreground text-xs">
            Gargalo: {product.bottleneck.materialName}
          </span>
        )}
      </span>
    ),
  },
  {
    id: 'updated-at',
    header: 'Atualizada em',
    cell: (product) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {formatDateTime(product.updatedAt)}
      </span>
    ),
  },
];

/**
 * The list of products: a table from `xl` up and a list of cards below it,
 * which is the `DataTable` doing its job. Every figure is the backend's.
 *
 * `capacity` is what the current stock allows, not what was produced, and the
 * column says so in its name. There is no status and no category: the model has
 * neither.
 */
export function CompositeProductTable({
  products,
  hrefFor,
}: {
  products: readonly CompositeProduct[];
  hrefFor: (product: CompositeProduct) => string;
}) {
  return (
    <DataTable
      caption="Fichas técnicas"
      columns={COLUMNS}
      rows={products}
      getRowKey={(product) => product.id}
      getRowHref={hrefFor}
      // Six columns beside a sidebar: below `xl` they would hide behind a sideways scroll.
      tableFrom="xl"
    />
  );
}
