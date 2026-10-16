import { Archive, ArchiveRestore, Pencil, Trash2, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { isApiError, type ApiError } from '@/shared/api/api-error';
import { entityInUseSummary, messageForError } from '@/shared/api/error-messages';
import { formatDateTime, formatMoney, formatQuantity, formatUnitCost } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { ErrorState } from '@/shared/ui/error-state';
import { showErrorToast } from '@/shared/ui/error-toast';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';
import { Skeleton } from '@/shared/ui/skeleton';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';

import {
  useDeleteMaterial,
  useDiscontinueMaterial,
  useReactivateMaterial,
  useRemoveMaterialImage,
  useUploadMaterialImage,
} from '../api/use-material-mutations';
import { useMaterial } from '../api/use-materials';
import type { Material } from '../model/material';
import type { StockAdjustmentKind } from '../model/stock-adjustment';

import { MaterialStatusBadges } from './material-status-badges';
import { PhotoButton } from '@/shared/ui/photo-button';
import { PriceHistorySection } from './price-history-section';
import { StockActions } from './stock-actions';

interface MaterialDetailSheetProps {
  /** The material to show, or `null` while the sheet is closed. */
  materialId: string | null;
  /** Where the loss history is, relative to the screen this opens over. */
  lossesPath: string;
  onClose: () => void;
  onEdit: (material: Material) => void;
  onAdjustStock: (material: Material, kind: StockAdjustmentKind) => void;
}

/**
 * One material in full: the figures, its photo, the price history and every
 * action that changes its life — edit, change the stock by hand, discontinue,
 * reactivate, delete. The id comes from the address, so a link to a discontinued material
 * opens it too: the API answers for those.
 */
export function MaterialDetailSheet({
  materialId,
  lossesPath,
  onClose,
  onEdit,
  onAdjustStock,
}: MaterialDetailSheetProps) {
  return (
    <ResponsiveSheet
      open={materialId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Detalhes do insumo"
    >
      {materialId === null ? null : (
        <DetailBody
          key={materialId}
          materialId={materialId}
          lossesPath={lossesPath}
          onClose={onClose}
          onEdit={onEdit}
          onAdjustStock={onAdjustStock}
        />
      )}
    </ResponsiveSheet>
  );
}

type Dialog = 'discontinue' | 'delete' | 'remove-photo' | { inUse: ApiError } | null;

function DetailBody({
  materialId,
  lossesPath,
  onClose,
  onEdit,
  onAdjustStock,
}: Omit<MaterialDetailSheetProps, 'materialId'> & { materialId: string }) {
  const query = useMaterial(materialId);
  const [dialog, setDialog] = useState<Dialog>(null);

  const discontinue = useDiscontinueMaterial();
  const reactivate = useReactivateMaterial();
  const remove = useDeleteMaterial();
  const upload = useUploadMaterialImage();
  const removeImage = useRemoveMaterialImage();

  if (query.isPending) {
    return (
      <SheetPanel title="Carregando…">
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Carregando o insumo…</span>
          <Skeleton className="size-24 rounded-lg" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </SheetPanel>
    );
  }

  if (query.isError) {
    return (
      <SheetPanel title="Insumo">
        <ErrorState
          error={query.error}
          title="Não foi possível abrir este insumo"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </SheetPanel>
    );
  }

  const material = query.data;
  const busy =
    discontinue.isPending ||
    reactivate.isPending ||
    remove.isPending ||
    upload.isPending ||
    removeImage.isPending;

  return (
    <>
      <SheetPanel
        title={material.name}
        footer={
          <>
            <Button variant="outline" onClick={() => onEdit(material)} disabled={busy}>
              <Pencil aria-hidden="true" />
              Editar
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <ImageWithPlaceholder src={material.imageUrl} alt={material.name} className="size-24" />
          <div className="flex min-w-0 flex-col gap-2">
            <MaterialStatusBadges material={material} />
            {material.discontinuedAt === null ? null : (
              <p className="text-muted-foreground text-xs">
                Descontinuado em {formatDateTime(material.discontinuedAt)}
              </p>
            )}
          </div>
        </div>

        <StockActions
          material={material}
          onAdjust={(kind) => onAdjustStock(material, kind)}
          disabled={busy}
        />

        <div className="flex flex-wrap gap-2">
          <PhotoButton
            label={material.imageUrl === null ? 'Adicionar foto' : 'Trocar foto'}
            disabled={busy}
            onPick={(file) =>
              upload.mutate(
                { id: material.id, file },
                {
                  onSuccess: () => toast.success('Foto atualizada.'),
                  onError: showErrorToast,
                },
              )
            }
          />
          {material.imageUrl === null ? null : (
            <Button
              variant="ghost"
              disabled={busy}
              className="text-destructive hover:bg-destructive-muted hover:text-destructive"
              onClick={() => setDialog('remove-photo')}
            >
              Remover foto
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Fact term="Embalagem" detail={formatQuantity(material.packageQuantity)} />
          <Fact term="Custo da embalagem" detail={formatMoney(material.packageCost)} />
          <Fact
            term="Custo fracionado"
            detail={formatUnitCost(material.unitCost, material.consumptionUnit)}
          />
          <Fact term="Valor em estoque" detail={formatMoney(material.stockValue)} />
          <Fact term="Estoque mínimo" detail={formatQuantity(material.minimumStockAlert)} />
        </dl>

        <PriceHistorySection materialId={material.id} />

        <Button asChild variant="outline" className="shrink-0">
          <Link to={`${lossesPath}?materialId=${encodeURIComponent(material.id)}`}>
            <TrendingDown aria-hidden="true" />
            Ver perdas deste insumo
          </Link>
        </Button>

        <div className="border-border flex flex-col gap-2 border-t pt-4">
          {material.isActive ? (
            <Button variant="outline" onClick={() => setDialog('discontinue')} disabled={busy}>
              <Archive aria-hidden="true" />
              Descontinuar
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                reactivate.mutate(material.id, {
                  onSuccess: () => toast.success(`${material.name} voltou a ficar ativo.`),
                  onError: showErrorToast,
                })
              }
            >
              <ArchiveRestore aria-hidden="true" />
              {reactivate.isPending ? 'Reativando…' : 'Reativar'}
            </Button>
          )}
          <Button variant="destructive" onClick={() => setDialog('delete')} disabled={busy}>
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
        </div>
      </SheetPanel>

      <ConfirmDialog
        open={dialog === 'discontinue'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Descontinuar ${material.name}?`}
        description="Ele deixa de aparecer ao montar uma ficha técnica ou uma venda nova, mas continua no histórico do que já foi feito. Você pode reativá-lo quando quiser."
        confirmLabel="Descontinuar"
        pending={discontinue.isPending}
        onConfirm={() =>
          discontinue.mutate(material.id, {
            onSuccess: () => {
              toast.success(`${material.name} foi descontinuado.`);
              setDialog(null);
            },
            onError: (error) => {
              setDialog(null);
              showErrorToast(error);
            },
          })
        }
      />

      <ConfirmDialog
        open={dialog === 'remove-photo'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Remover a foto de ${material.name}?`}
        description="O insumo fica sem foto até você enviar outra. Não dá para desfazer: a foto removida não pode ser recuperada."
        confirmLabel="Remover foto"
        destructive
        pending={removeImage.isPending}
        onConfirm={() =>
          removeImage.mutate(material.id, {
            onSuccess: () => {
              toast.success('Foto removida.');
              setDialog(null);
            },
            onError: (error) => {
              setDialog(null);
              showErrorToast(error);
            },
          })
        }
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Excluir ${material.name}?`}
        description="A exclusão é definitiva e só é possível para um insumo que nunca foi usado. Se ele estiver em vendas, fichas técnicas ou compras, você poderá descontinuá-lo em vez de excluir."
        confirmLabel="Excluir"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(material.id, {
            onSuccess: () => {
              toast.success(`${material.name} foi excluído.`);
              setDialog(null);
              onClose();
            },
            onError: (error) => {
              // Being in use is an answer, not a failure: say by what, and
              // offer the way out the system has for it.
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
        title="Não dá para excluir este insumo"
        description={
          <div className="flex flex-col gap-2">
            <p className="text-foreground font-medium">
              {typeof dialog === 'object' && dialog !== null
                ? (entityInUseSummary(dialog.inUse) ?? messageForError(dialog.inUse))
                : null}
            </p>
            <p>
              Descontinuar tira {material.name} das telas de venda e de ficha nova, e mantém tudo o
              que já foi registrado com ele.
            </p>
          </div>
        }
        confirmLabel="Descontinuar em vez de excluir"
        cancelLabel="Agora não"
        pending={discontinue.isPending}
        onConfirm={() =>
          discontinue.mutate(material.id, {
            onSuccess: () => {
              toast.success(`${material.name} foi descontinuado.`);
              setDialog(null);
            },
            onError: (error) => {
              setDialog(null);
              showErrorToast(error);
            },
          })
        }
      />
    </>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.08em] uppercase">
        {term}
      </dt>
      <dd className="text-sm font-semibold">{detail}</dd>
    </div>
  );
}
