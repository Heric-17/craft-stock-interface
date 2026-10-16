import { formatMoney, formatQuantity, formatUnitCost } from '@/shared/format';
import { CatalogCard } from '@/shared/ui/catalog-card';
import { CatalogGrid } from '@/shared/ui/catalog-grid';

import type { Material } from '../model/material';

import { MaterialStatusBadges } from './material-status-badges';

interface MaterialCardsProps {
  materials: readonly Material[];
  hrefFor: (material: Material) => string;
}

/**
 * The materials, as large cards: the photo first and big, so a jar of wax is
 * not mistaken for a jar of soap, then the stock — the figure the day depends
 * on — and what a unit costs.
 *
 * Every figure is the backend's. `stockValue` is the per-material rounded
 * value, not a product made here, and the cost is shown per larger unit like
 * everywhere else.
 */
export function MaterialCards({ materials, hrefFor }: MaterialCardsProps) {
  return (
    <CatalogGrid
      label="Insumos"
      items={materials}
      getKey={(material) => material.id}
      renderItem={(material) => (
        <CatalogCard
          name={material.name}
          imageUrl={material.imageUrl}
          href={hrefFor(material)}
          muted={!material.isActive}
          badges={<MaterialStatusBadges material={material} />}
          facts={[
            {
              label: 'Estoque atual',
              emphasis: true,
              value: (
                <span className="flex flex-col">
                  <span className="whitespace-nowrap">
                    {formatQuantity(material.stockQuantity)}
                  </span>
                  <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
                    mín. {formatQuantity(material.minimumStockAlert)}
                  </span>
                </span>
              ),
            },
            {
              label: 'Custo fracionado',
              value: (
                <span className="whitespace-nowrap">
                  {formatUnitCost(material.unitCost, material.consumptionUnit)}
                </span>
              ),
            },
            {
              label: 'Embalagem',
              value: (
                <span className="whitespace-nowrap">
                  {formatQuantity(material.packageQuantity)}
                </span>
              ),
            },
            {
              label: 'Valor em estoque',
              value: <span className="whitespace-nowrap">{formatMoney(material.stockValue)}</span>,
            },
          ]}
        />
      )}
    />
  );
}
