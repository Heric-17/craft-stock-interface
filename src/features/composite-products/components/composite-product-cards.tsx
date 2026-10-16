import { formatDateTime, formatMarginPercent, formatMoney } from '@/shared/format';
import { CatalogCard } from '@/shared/ui/catalog-card';
import { CatalogGrid } from '@/shared/ui/catalog-grid';

import type { CompositeProduct } from '../model/composite-product';

import { CapacityBadge, DiscontinuedBadge } from './product-status-badges';

interface CompositeProductCardsProps {
  products: readonly CompositeProduct[];
  /** Relative to the list's screen: the editor of a product is `<this screen>/<id>`. */
  hrefFor: (product: CompositeProduct) => string;
}

/**
 * The products, as large cards: the photo first and big, because the person
 * has to know which product it is at a glance, then the figures that decide
 * what to do with it. Every figure is the backend's.
 *
 * "Dá para produzir" is what the current stock allows, not what was produced,
 * and the label says so. There is no status and no category: the model has
 * neither.
 */
export function CompositeProductCards({ products, hrefFor }: CompositeProductCardsProps) {
  return (
    <CatalogGrid
      label="Fichas técnicas"
      items={products}
      getKey={(product) => product.id}
      renderItem={(product) => (
        <CatalogCard
          name={product.name}
          imageUrl={product.imageUrl}
          href={hrefFor(product)}
          muted={!product.isActive}
          badges={product.isActive ? undefined : <DiscontinuedBadge />}
          facts={[
            {
              label: 'Preço sugerido',
              emphasis: true,
              value: (
                <span className="flex flex-col">
                  <span className="whitespace-nowrap">{formatMoney(product.suggestedPrice)}</span>
                  {product.manualPrice === null ? null : (
                    // Only when someone typed a price of their own: otherwise the
                    // practiced price is the suggested one, and saying it twice is noise.
                    <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
                      Praticado {formatMoney(product.manualPrice)}
                    </span>
                  )}
                </span>
              ),
            },
            {
              label: 'Custo total',
              value: <span className="whitespace-nowrap">{formatMoney(product.totalCost)}</span>,
            },
            {
              label: 'Margem',
              value: (
                <span className="whitespace-nowrap">
                  {formatMarginPercent(product.profitMarginBasisPoints)}
                </span>
              ),
            },
            {
              label: 'Dá para produzir',
              value: <CapacityBadge capacity={product.productionCapacity} />,
            },
          ]}
          footer={
            <span className="flex flex-col gap-0.5">
              {product.bottleneck === null ? null : (
                <span>Gargalo: {product.bottleneck.materialName}</span>
              )}
              <span>Atualizada {formatDateTime(product.updatedAt)}</span>
            </span>
          }
        />
      )}
    />
  );
}
