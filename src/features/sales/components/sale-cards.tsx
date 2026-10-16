import { Link } from 'react-router';

import { formatDateTime, formatMoney, formatQuantity } from '@/shared/format';
import { CatalogGrid } from '@/shared/ui/catalog-grid';
import { PhotoMosaic } from '@/shared/ui/photo-mosaic';

import { imageOfItem, shortSaleId, type CatalogImages, type Sale } from '../model/sale';

import { SaleAxisBadges } from './sale-status-badges';

/** How many items the summary names. */
const NAMES_SHOWN = 3;

interface SaleCardsProps {
  sales: readonly Sale[];
  images: CatalogImages;
  /** Relative to the list's screen: the detail of a sale is `<this screen>/<id>`. */
  hrefFor: (sale: Sale) => string;
}

/**
 * The sales history, as cards: who bought and for how much, a photo of each
 * thing sold so the order can be recognised without reading it, and the two
 * states side by side.
 *
 * The names are the **frozen** ones — what the item was called the day it was
 * sold — and the total is the API's. The photos are how the products look now,
 * and are only there to be recognised by.
 */
export function SaleCards({ sales, images, hrefFor }: SaleCardsProps) {
  return (
    <CatalogGrid
      label="Vendas"
      items={sales}
      getKey={(sale) => sale.id}
      renderItem={(sale) => <SaleCard sale={sale} images={images} href={hrefFor(sale)} />}
    />
  );
}

function SaleCard({ sale, images, href }: { sale: Sale; images: CatalogImages; href: string }) {
  const names = sale.items.slice(0, NAMES_SHOWN);
  const moreNames = sale.items.length - names.length;

  return (
    <article className="border-border bg-card shadow-card hover:border-primary focus-within:border-primary relative flex h-full flex-col overflow-hidden rounded-xl border transition-colors">
      {/* However many items there are, the photos share the whole frame: one fills it. */}
      <PhotoMosaic
        photos={sale.items.map((item) => ({
          key: item.id,
          src: imageOfItem(item, images),
          alt: item.name,
        }))}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              to={href}
              className='text-foreground text-base leading-snug font-semibold wrap-break-word after:absolute after:inset-0 after:content-[""] focus-visible:outline-none'
            >
              {sale.customerName}
            </Link>
            <p className="text-muted-foreground text-xs">Venda {shortSaleId(sale)}</p>
            <p className="text-muted-foreground text-xs whitespace-nowrap">
              {formatDateTime(sale.createdAt)}
            </p>
          </div>
          {/* The API's figure: the sum of the lines it already rounded. */}
          <p className="text-foreground shrink-0 text-xl font-bold whitespace-nowrap">
            {formatMoney(sale.totalAmount)}
          </p>
        </div>

        <ul className="flex flex-col gap-1">
          {names.map((item) => (
            <li key={item.id} className="text-foreground text-sm text-pretty">
              {item.name}
              <span className="text-muted-foreground whitespace-nowrap">
                {' · '}
                {formatQuantity(item.quantity)}
              </span>
            </li>
          ))}
          {moreNames > 0 ? (
            <li className="text-muted-foreground text-xs">
              {moreNames === 1 ? 'e mais 1 item' : `e mais ${moreNames} itens`}
            </li>
          ) : null}
        </ul>

        <div className="border-border mt-auto border-t pt-3">
          <SaleAxisBadges sale={sale} />
        </div>
      </div>
    </article>
  );
}
