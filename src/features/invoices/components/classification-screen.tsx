import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import type { Material } from '@/features/materials';
import { isApiError, type ApiError } from '@/shared/api/api-error';
import { formatQuantity, formatUnitCost } from '@/shared/format';
import { useUnsavedChanges } from '@/shared/lib/use-unsaved-changes';
import { Button } from '@/shared/ui/button';
import type { CatalogOption } from '@/shared/ui/catalog-picker-sheet';
import { CatalogPickerSheet } from '@/shared/ui/catalog-picker-sheet';
import { Callout } from '@/shared/ui/callout';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { showErrorToast } from '@/shared/ui/error-toast';
import { FormSection } from '@/shared/ui/form-section';
import { StatusBadge } from '@/shared/ui/status-badge';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';

import { useClassifyPurchase } from '../api/use-invoice-mutations';
import {
  initialDraft,
  isDraftDirty,
  packageQuantityText,
  patchStockFields,
  readClassification,
  setCompanyExpense,
  setDiscountMode,
  setManualAmount,
  setStockMaterial,
  type ClassificationDraft,
  type StockFields,
} from '../model/classification-draft';
import { CONCLUDE_BLOCK_MESSAGES, DISCOUNT_MODE_LABELS, conclusionLines } from '../model/labels';
import type { PurchaseDetail } from '../model/purchase-detail';

import { ClassificationLineCard } from './classification-line-card';
import { ClassificationSummary } from './classification-summary';
import { DiscountSection } from './discount-section';

interface ClassificationScreenProps {
  purchase: PurchaseDetail;
  /** Every material, discontinued ones included: a line may already point at one. */
  materials: readonly Material[];
  /** Where the notes are listed: the way back, and where a concluded note goes. */
  historyPath: string;
}

/** Whether the API refused the discount, which is the one refusal that belongs to a section. */
function isDiscountRefusal(error: unknown): error is ApiError {
  return (
    isApiError(error) &&
    (error.code === 'DISCOUNT_ALLOCATION' || error.code === 'PENDING_DISCOUNT_ALLOCATION')
  );
}

/**
 * The second step of an import: what each line of the note is, which insumo the
 * stock lines feed, and how the discount is spread.
 *
 * Nothing is saved while this is open. The API's classification is not
 * idempotent — a request that carries a line as stock enters it again — so the
 * choices are held here and go out once, in the request that concludes, which
 * the API applies whole or not at all. A line it already entered into the stock
 * is shown as done and never sent again.
 */
export function ClassificationScreen({
  purchase,
  materials,
  historyPath,
}: ClassificationScreenProps) {
  const navigate = useNavigate();
  const classify = useClassifyPurchase();

  const [initial] = useState(() => initialDraft(purchase));
  const [draft, setDraft] = useState<ClassificationDraft>(initial);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<ApiError | null>(null);

  const { blocker, allowLeaving } = useUnsavedChanges(isDraftDirty(initial, draft));

  const materialsById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );
  const locked = useMemo(
    () => new Set(purchase.lines.filter((line) => line.isStockMaterial).map((line) => line.id)),
    [purchase.lines],
  );
  const reading = readClassification(draft, purchase, materialsById, locked);
  const draftsById = new Map(draft.lines.map((line) => [line.itemId, line]));
  const asked = purchase.requiresDiscountAllocationChoice;
  const nothingToDo = reading.blocker === 'NOTHING_TO_CLASSIFY';

  const pickable: CatalogOption[] = useMemo(
    () =>
      materials
        .filter((material) => material.isActive)
        .map((material) => ({
          id: material.id,
          name: material.name,
          imageUrl: material.imageUrl,
          badges: material.lowStock ? (
            <StatusBadge tone="warning">Estoque baixo</StatusBadge>
          ) : null,
          facts: [
            {
              label: 'Custo fracionado',
              value: formatUnitCost(material.unitCost, material.consumptionUnit),
              emphasis: true,
            },
            { label: 'Em estoque', value: formatQuantity(material.stockQuantity) },
          ],
        })),
    [materials],
  );

  function update(change: (current: ClassificationDraft) => ClassificationDraft): void {
    setRefusal(null);
    setDraft(change);
  }

  function pick(option: CatalogOption): void {
    const material = materialsById.get(option.id);

    if (pickingFor === null || material === undefined) {
      return;
    }

    // The material's own package is the suggestion: it is confirmed or corrected
    // on the field below, where the echo says how it was read.
    const itemId = pickingFor;

    update((current) =>
      patchStockFields(current, itemId, {
        target: 'EXISTING',
        materialId: material.id,
        packageQuantity: packageQuantityText(material.packageQuantity),
        packageScale: 'base',
      }),
    );
  }

  async function conclude(): Promise<void> {
    if (reading.request === null) {
      return;
    }

    try {
      await classify.mutateAsync({ purchaseId: purchase.id, body: reading.request });
    } catch (error) {
      setConfirming(false);

      if (isDiscountRefusal(error)) {
        setRefusal(error);
      } else {
        showErrorToast(error);
      }

      return;
    }

    toast.success('Nota classificada.');
    allowLeaving();
    void navigate(historyPath, { replace: true });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ClassificationSummary purchase={purchase} />

      <FormSection
        title="Itens da nota"
        description="Diga o que cada item é. O que não for da empresa fica fora do painel de gastos."
      >
        <Callout>
          <p className="font-semibold">Como o custo do insumo é atualizado</p>
          <p>
            O custo usa o valor cheio da linha, sem o desconto, e só é atualizado quando o novo
            valor é maior do que o custo atual. Se for igual ou menor, o custo continua o mesmo.
          </p>
        </Callout>

        <ul
          aria-label="Itens da nota"
          className="grid gap-4 lg:grid-cols-2 lg:items-start [&>li]:min-w-0"
        >
          {purchase.lines.map((line) => {
            const lineDraft = draftsById.get(line.id);

            return lineDraft === undefined ? null : (
              <ClassificationLineCard
                key={line.id}
                line={line}
                draft={lineDraft}
                reading={reading.lines.get(line.id)}
                material={
                  lineDraft.materialId === null
                    ? undefined
                    : materialsById.get(lineDraft.materialId)
                }
                onCompanyExpense={(checked) =>
                  update((current) => setCompanyExpense(current, line.id, checked))
                }
                onStockMaterial={(checked) =>
                  update((current) => setStockMaterial(current, line.id, checked))
                }
                onPatch={(patch: Partial<StockFields>) =>
                  update((current) => patchStockFields(current, line.id, patch))
                }
                onPickMaterial={() => setPickingFor(line.id)}
              />
            );
          })}
        </ul>
      </FormSection>

      {asked && !nothingToDo ? (
        <DiscountSection
          purchase={purchase}
          reading={reading}
          manualInputs={draft.manual}
          pending={purchase.allocationPending}
          refusal={refusal}
          onMode={(mode) => update((current) => setDiscountMode(current, mode))}
          onManualAmount={(itemId, text) =>
            update((current) => setManualAmount(current, itemId, text))
          }
        />
      ) : null}

      <div className="border-border bg-card sticky bottom-3 z-5 flex flex-col gap-3 rounded-xl border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm">
        <p id="conclude-note" className="text-muted-foreground text-sm text-pretty">
          {reading.blocker === null
            ? 'Tudo certo. Você confere o resumo antes de concluir.'
            : CONCLUDE_BLOCK_MESSAGES[reading.blocker]}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            asChild
            variant="outline"
            className={nothingToDo ? undefined : 'hidden sm:inline-flex'}
          >
            <Link to={historyPath}>{nothingToDo ? 'Voltar para as notas' : 'Cancelar'}</Link>
          </Button>
          {nothingToDo ? null : (
            <Button
              type="button"
              disabled={reading.blocker !== null || classify.isPending}
              aria-describedby="conclude-note"
              onClick={() => setConfirming(true)}
            >
              Concluir classificação
            </Button>
          )}
        </div>
      </div>

      <CatalogPickerSheet
        open={pickingFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPickingFor(null);
          }
        }}
        title="Escolher insumo"
        description="O estoque desta linha entra no insumo que você escolher."
        searchLabel="Buscar insumo"
        searchPlaceholder="Nome do insumo"
        listLabel="Insumos disponíveis"
        options={pickable}
        nothingToPick={{
          title: 'Nenhum insumo cadastrado',
          description: 'Use “Criar insumo novo” para cadastrar este item agora.',
        }}
        noun={{ one: 'insumo', many: 'insumos' }}
        onPick={pick}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Concluir a classificação?"
        confirmLabel="Concluir"
        pending={classify.isPending}
        onConfirm={() => void conclude()}
        description={
          <div className="flex flex-col gap-3">
            <ul className="text-foreground flex list-disc flex-col gap-1 pl-5">
              {conclusionLines(reading.summary).map((text) => (
                <li key={text}>{text}</li>
              ))}
              {reading.mode === null ? null : (
                <li>Desconto: {DISCOUNT_MODE_LABELS[reading.mode]}.</li>
              )}
            </ul>
            {reading.summary.stockEntries > 0 ? (
              <p>
                A entrada no estoque não se desfaz. Se uma quantidade sair errada, acerte com
                “Corrigir contagem” no insumo.
              </p>
            ) : null}
          </div>
        }
      />

      <UnsavedChangesDialog blocker={blocker} what="a classificação desta nota" />
    </div>
  );
}
