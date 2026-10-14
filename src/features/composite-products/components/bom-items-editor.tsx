import { Trash2 } from 'lucide-react';
import { Controller, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';

import type { Material } from '@/features/materials';
import { baseUnitSymbol, formatMoney, formatQuantity } from '@/shared/format';
import type { Money } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { SelectField } from '@/shared/ui/select-field';
import { StatusBadge } from '@/shared/ui/status-badge';

import {
  newBomLine,
  type BomLineFormValues,
  type CompositeProductFormValues,
} from '../model/composite-product-form';

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
 * The picker offers **active** materials only, and only the ones not already on
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

      <SelectField
        label="Adicionar insumo"
        value=""
        disabled={disabled || available.length === 0}
        onChange={(event) => {
          const picked = available.find((material) => material.id === event.target.value);

          if (picked !== undefined) {
            onAdd(newBomLine(picked));
          }
        }}
        hint={
          available.length === 0
            ? 'Todos os insumos ativos já estão na ficha, ou ainda não há insumo cadastrado.'
            : 'Só aparecem insumos ativos que ainda não estão na ficha.'
        }
      >
        <option value="" disabled>
          Escolha um insumo
        </option>
        {available.map((material) => (
          <option key={material.id} value={material.id}>
            {material.name} ({baseUnitSymbol(material.consumptionUnit)})
          </option>
        ))}
      </SelectField>
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
    <li className="border-border flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-foreground text-sm font-semibold text-balance">{line.materialName}</p>
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
          className="-mt-1 -mr-1 shrink-0"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

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

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs">Custo da linha (prévia)</dt>
          <dd className="text-sm font-semibold whitespace-nowrap">
            {cost === null ? '—' : formatMoney(cost)}
          </dd>
        </div>
        {material === undefined ? null : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Em estoque</dt>
            <dd className="text-sm font-semibold whitespace-nowrap">
              {formatQuantity(material.stockQuantity)}
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}
