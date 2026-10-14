import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { isApiError, type ApiError } from '@/shared/api/api-error';
import { entityInUseSummary, messageForError } from '@/shared/api/error-messages';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { showErrorToast } from '@/shared/ui/error-toast';

import {
  useDeleteCompositeProduct,
  useDiscontinueCompositeProduct,
  useReactivateCompositeProduct,
} from '../api/use-composite-product-mutations';
import type { CompositeProduct } from '../model/composite-product';

interface ProductLifecycleActionsProps {
  product: CompositeProduct;
  /** Something else on the screen is saving: nothing here may race it. */
  disabled: boolean;
  /** The product no longer exists: the screen has nowhere to stay. */
  onDeleted: () => void;
}

type Dialog = 'discontinue' | 'delete' | { inUse: ApiError } | null;

/**
 * Discontinue, reactivate and delete a product.
 *
 * A discontinued product leaves the selectors of a new sale and keeps its
 * history. Deleting is only possible while no sale refers to it, and
 * `ENTITY_IN_USE` is an answer, not a failure: the screen says what refers to
 * the product, from the counts in `details`, and offers to discontinue it
 * instead.
 */
export function ProductLifecycleActions({
  product,
  disabled,
  onDeleted,
}: ProductLifecycleActionsProps) {
  const [dialog, setDialog] = useState<Dialog>(null);

  const discontinue = useDiscontinueCompositeProduct();
  const reactivate = useReactivateCompositeProduct();
  const remove = useDeleteCompositeProduct();

  const busy = disabled || discontinue.isPending || reactivate.isPending || remove.isPending;

  function discontinueNow(): void {
    discontinue.mutate(product.id, {
      onSuccess: () => {
        toast.success(`${product.name} foi descontinuado.`);
        setDialog(null);
      },
      onError: (error) => {
        setDialog(null);
        showErrorToast(error);
      },
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        {product.isActive ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialog('discontinue')}
            disabled={busy}
          >
            <Archive aria-hidden="true" />
            Descontinuar
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              reactivate.mutate(product.id, {
                onSuccess: () => toast.success(`${product.name} voltou a ficar ativo.`),
                onError: showErrorToast,
              })
            }
          >
            <ArchiveRestore aria-hidden="true" />
            {reactivate.isPending ? 'Reativando…' : 'Reativar'}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setDialog('delete')}
          disabled={busy}
        >
          <Trash2 aria-hidden="true" />
          Excluir
        </Button>
      </div>

      <ConfirmDialog
        open={dialog === 'discontinue'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Descontinuar ${product.name}?`}
        description="Ele deixa de aparecer ao montar uma venda nova, mas continua no histórico do que já foi vendido. Você pode reativá-lo quando quiser."
        confirmLabel="Descontinuar"
        pending={discontinue.isPending}
        onConfirm={discontinueNow}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Excluir ${product.name}?`}
        description="A exclusão é definitiva e só é possível para um produto que nunca foi vendido. Se ele estiver em alguma venda, você poderá descontinuá-lo em vez de excluir."
        confirmLabel="Excluir"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(product.id, {
            onSuccess: () => {
              toast.success(`${product.name} foi excluído.`);
              setDialog(null);
              onDeleted();
            },
            onError: (error) => {
              if (isApiError(error) && error.detailsFor('ENTITY_IN_USE') !== undefined) {
                setDialog({ inUse: error });

                return;
              }

              setDialog(null);
              showErrorToast(error);
            },
          })
        }
      />

      <ConfirmDialog
        open={typeof dialog === 'object' && dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Não dá para excluir este produto"
        description={
          <div className="flex flex-col gap-2">
            <p className="text-foreground font-medium">
              {typeof dialog === 'object' && dialog !== null
                ? (entityInUseSummary(dialog.inUse) ?? messageForError(dialog.inUse))
                : null}
            </p>
            <p>
              Descontinuar tira {product.name} das vendas novas e mantém tudo o que já foi
              registrado com ele.
            </p>
          </div>
        }
        confirmLabel="Descontinuar em vez de excluir"
        cancelLabel="Agora não"
        pending={discontinue.isPending}
        onConfirm={discontinueNow}
      />
    </>
  );
}
