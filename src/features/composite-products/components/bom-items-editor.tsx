import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';

import type { Material } from '@/features/materials';
import { formatMoney, formatQuantity } from '@/shared/format';
import type { Money } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { FigureTile } from '@/shared/ui/figure-tile';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { StatusBadge } from '@/shared/ui/status-badge';

import {
  newBomLine,
  type BomLineFormValues,
  type CompositeProductFormValues,
} from '../model/composite-product-form';

import { MaterialPickerSheet } from './material-picker-sheet';

interface BomItemsEditorProps {
  control: Control<CompositeProductFormValues>;
  setValue: UseFormSetValue<CompositeProductFormValues>;
  /** The lines as the form array holds them, with the key it gave each. */
  lines: readonly (BomLineFormValues & { id: string })[];
  /** Every material, discontinued ones included: they are needed to read a line, not to pick one. */
  materials: readonly Material[];
  /** The preview's cost of each line, in the same order. */
  lineCosts: readonly (Money | null)[];
  disabled: boolean;
  onAdd: (line: BomLineFormValues) => void;
  onRemove: (index: number) => void;
}

/**
 * The bill of materials: one row per material, with how much of it one unit
 * consumes — typed in the material's own unit, with a shortcut to the larger
 * one — and what that line costs.
 *
 * The picker (a panel with search, photo, cost and stock) offers **active** materials only, and only the ones not already on
 * the bill. A material that was discontinued after it was put on a bill is not
 * in it: it stays on its row, with a seal, intact, and leaves only when the
 * person removes the line.
 */
export function BomItemsEditor({
  control,
  setValue,
  lines,
  materials,
  lineCosts,
  disabled,
  onAdd,
  onRemove,
}: BomItemsEditorProps) {
  const [picking, setPicking] = useState(false);
  const byId = new Map(materials.map((material) => [material.id, material]));
  const used = new Set(lines.map((line) => line.materialId));
  const available = materials
    .filter((material) => material.isActive && !used.has(material.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const hasDiscontinued = lines.some((line) => byId.get(line.materialId)?.isActive === false);

  return (
    <div className="flex flex-col gap-4">
      {lines.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm text-pretty">
          Nenhum item ainda. Escolha abaixo os insumos que cada unidade do produto consome.
        </p>
      ) : (
        <ul aria-label="Itens da ficha" className="flex flex-col gap-3">
          {lines.map((line, index) => (
            <BomLineRow
              key={line.id}
              index={index}
              line={line}
              material={byId.get(line.materialId)}
              cost={lineCosts[index] ?? null}
              control={control}
              setValue={setValue}
              disabled={disabled}
              onRemove={() => onRemove(index)}
            />
          ))}
        </ul>
      )}

      {hasDiscontinued ? (
        <Callout tone="warning">
          Um insumo desta ficha foi descontinuado. Ele continua na ficha, mas as mudanças nos itens
          só são salvas depois que você remover a linha dele ou reativar o insumo.
        </Callout>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || available.length === 0}
          onClick={() => setPicking(true)}
        >
          <Plus aria-hidden="true" />
          Adicionar insumo
        </Button>
        <p className="text-muted-foreground text-xs text-pretty">
          {available.length === 0
            ? 'Todos os insumos ativos já estão na ficha, ou ainda não há insumo cadastrado.'
            : 'Só aparecem insumos ativos que ainda não estão na ficha.'}
        </p>
      </div>

      <MaterialPickerSheet
        open={picking}
        onOpenChange={setPicking}
        materials={available}
        onPick={(material) => onAdd(newBomLine(material))}
      />
    </div>
  );
}

interface BomLineRowProps {
  index: number;
  line: BomLineFormValues;
  material: Material | undefined;
  cost: Money | null;
  control: Control<CompositeProductFormValues>;
  setValue: UseFormSetValue<CompositeProductFormValues>;
  disabled: boolean;
  onRemove: () => void;
}

function BomLineRow({
  index,
  line,
  material,
  cost,
  control,
  setValue,
  disabled,
  onRemove,
}: BomLineRowProps) {
  const scale = useWatch({ control, name: `billOfMaterials.${index}.scale` });
  const discontinued = material?.isActive === false;

  return (
    <li className="border-border bg-muted/40 @container flex flex-col gap-4 rounded-xl border p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <ImageWithPlaceholder
          src={material?.imageUrl ?? null}
          alt={line.materialName}
          className="size-20 rounded-xl sm:size-24"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-foreground text-base leading-snug font-semibold text-balance">
            {line.materialName}
          </p>
          {discontinued ? (
            <div>
              <StatusBadge tone="neutral">Descontinuado</StatusBadge>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remover ${line.materialName} da ficha`}
          disabled={disabled}
          onClick={onRemove}
          className="text-destructive hover:bg-destructive-muted hover:text-destructive -mt-1 -mr-1 shrink-0"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      {/* The field and the figures it is checked against sit side by side once the card is wide enough. */}
      <div className="grid gap-4 @[34rem]:grid-cols-[minmax(0,1fr)_14rem]">
        <Controller
          control={control}
          name={`billOfMaterials.${index}.quantity`}
          render={({ field, fieldState }) => (
            <ScaledQuantityField
              label={`Quantidade de ${line.materialName} por unidade`}
              unit={line.consumptionUnit}
              scale={scale}
              onScaleChange={(next) =>
                setValue(`billOfMaterials.${index}.scale`, next, { shouldDirty: true })
              }
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              error={fieldState.error?.message}
            />
          )}
        />

        <dl className="grid grid-cols-2 gap-2 @[34rem]:grid-cols-1 @[34rem]:content-start">
          <FigureTile label="Custo da linha (prévia)" tone="primary">
            {cost === null ? '—' : formatMoney(cost)}
          </FigureTile>
          {material === undefined ? null : (
            <FigureTile label="Em estoque">{formatQuantity(material.stockQuantity)}</FigureTile>
          )}
        </dl>
      </div>
    </li>
  );
}
