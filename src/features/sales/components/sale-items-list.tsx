import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { formatMoney, formatQuantity } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { showErrorToast } from '@/shared/ui/error-toast';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';

import { useRemoveSaleItem } from '../api/use-sale-mutations';
import {
  imageOfItem,
  isSaleEditable,
  type CatalogImages,
  type Sale,
  type SaleItem,
} from '../model/sale';

import { SaleItemQuantitySheet } from './sale-item-quantity-sheet';

interface SaleItemsListProps {
  sale: Sale;
  images: CatalogImages;
  /** The products' address, so a line can lead to its product. Navigation only. */
  productPath: string;
}

/**
 * What the sale holds, exactly as it was frozen: the name each item had, the
 * fraction it was priced by and the total the API derived from it. A product
 * that was renamed or repriced since is not reflected here — the history is a
 * record, and the link to the product exists to go and see it, not to update
 * the line.
 *
 * The photo is how the product looks now, and is only there to be recognised
 * by: each line gets a large one, because a name alone is not what people
 * recognise an order by.
 */
export function SaleItemsList({ sale, images, productPath }: SaleItemsListProps) {
  const editable = isSaleEditable(sale);
  const remove = useRemoveSaleItem();
  const [editing, setEditing] = useState<SaleItem | null>(null);
  const [removing, setRemoving] = useState<SaleItem | null>(null);

  function confirmRemoval(): void {
    if (removing === null) {
      return;
    }

    const target = removing;

    remove.mutate(
      { saleId: sale.id, itemId: target.id },
      {
        onSuccess: () => toast.success(`${target.name} saiu da venda.`),
        onError: showErrorToast,
        onSettled: () => setRemoving(null),
      },
    );
  }

  return (
    <>
      <ul aria-label="Itens da venda" className="flex flex-col gap-4">
        {sale.items.map((item) => (
          <li
            key={item.id}
            className="border-border bg-muted/40 flex flex-col gap-4 rounded-xl border p-4"
          >
            <div className="flex gap-4">
              <ImageWithPlaceholder
                src={imageOfItem(item, images)}
                alt={item.name}
                className="size-24 rounded-xl sm:size-32"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-foreground text-base leading-snug font-semibold text-balance">
                  {item.name}
                </p>
                <p>
                  <span className="bg-secondary text-secondary-foreground inline-block rounded-md px-2 py-1 text-sm font-bold whitespace-nowrap">
                    {formatQuantity(item.quantity)}
                  </span>
                </p>
                <p className="text-foreground mt-auto text-xl font-bold whitespace-nowrap">
                  {formatMoney(item.lineTotal)}
                </p>
              </div>
            </div>

            <dl className="border-border border-t pt-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">Preço na hora da venda</dt>
                <dd className="text-sm font-medium">
                  <span className="whitespace-nowrap">
                    {formatMoney(item.priceBasisAmount)} a cada{' '}
                    {formatQuantity(item.priceBasisQuantity)}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              {item.compositeProductId === null ? null : (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`${productPath}/${encodeURIComponent(item.compositeProductId)}`}>
                    <ExternalLink aria-hidden="true" />
                    Ver a ficha técnica do produto
                  </Link>
                </Button>
              )}
              {editable ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={remove.isPending}
                    aria-label={`Alterar a quantidade de ${item.name}`}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil aria-hidden="true" />
                    Alterar quantidade
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={remove.isPending}
                    aria-label={`Remover ${item.name} da venda`}
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 aria-hidden="true" />
                    Remover
                  </Button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <SaleItemQuantitySheet
        saleId={sale.id}
        item={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing === null ? '' : `Remover ${removing.name} da venda?`}
        description={
          <div className="flex flex-col gap-2">
            <p className="text-foreground">
              O item sai da venda e o total é recalculado pelo sistema. Os outros itens continuam
              com o preço que tinham.
            </p>
            <p>Uma venda precisa ter pelo menos um item.</p>
          </div>
        }
        confirmLabel="Remover item"
        destructive
        pending={remove.isPending}
        onConfirm={confirmRemoval}
      />
    </>
  );
}
