import { CONSUMPTION_UNIT_LABELS, type Material } from '@/features/materials';
import { formatQuantity, formatUnitCost } from '@/shared/format';
import { CONSUMPTION_UNITS, type ConsumptionUnit } from '@/shared/quantity';
import { Button } from '@/shared/ui/button';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { SelectField } from '@/shared/ui/select-field';
import { TextField } from '@/shared/ui/text-field';

import type {
  LineDraft,
  LineReading,
  StockFields,
  StockTarget,
} from '../model/classification-draft';
import { STOCK_TARGET_LABELS } from '../model/labels';

interface StockTargetFieldsProps {
  /** The line's description, so that the groups of two lines do not read alike. */
  lineName: string;
  draft: LineDraft;
  reading: LineReading;
  /** The material the line is linked to, when it exists. */
  material: Material | undefined;
  onPatch: (patch: Partial<StockFields>) => void;
  onPickMaterial: () => void;
}

const TARGETS: StockTarget[] = ['EXISTING', 'NEW'];

/**
 * What a stock line adds its package to: an insumo that already exists, chosen
 * from the catalogue with its photo, or a new one made right here with the name
 * and the unit it will be consumed in.
 *
 * How much one package holds is always the person's answer. The note says "1 UN"
 * of a cheese and has no way of knowing it is 200 g, so the field starts empty
 * and a value is only ever the one that was typed or confirmed.
 */
export function StockTargetFields({
  lineName,
  draft,
  reading,
  material,
  onPatch,
  onPickMaterial,
}: StockTargetFieldsProps) {
  return (
    <div className="border-border flex flex-col gap-4 border-t pt-4">
      <SegmentedControl
        label={`Insumo de ${lineName}`}
        options={TARGETS.map((target) => ({ value: target, label: STOCK_TARGET_LABELS[target] }))}
        value={draft.target}
        onChange={(target) => onPatch({ target, packageQuantity: '', packageScale: 'base' })}
      />

      {draft.target === 'EXISTING' ? (
        <ExistingMaterial draft={draft} material={material} onPickMaterial={onPickMaterial} />
      ) : (
        <NewMaterialFields draft={draft} onPatch={onPatch} />
      )}

      {reading.unit === null ? null : (
        <PackageQuantityField
          draft={draft}
          reading={reading}
          unit={reading.unit}
          onPatch={onPatch}
        />
      )}
    </div>
  );
}

function ExistingMaterial({
  draft,
  material,
  onPickMaterial,
}: {
  draft: LineDraft;
  material: Material | undefined;
  onPickMaterial: () => void;
}) {
  if (draft.materialId === null || material === undefined) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={onPickMaterial}>
        Escolher insumo
      </Button>
    );
  }

  return (
    // On a phone the photo and the name take the row and the button goes under
    // them: beside them it left the name a column a few letters wide.
    <div className="bg-muted flex flex-col gap-3 rounded-lg p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ImageWithPlaceholder src={material.imageUrl} alt={material.name} className="size-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-pretty wrap-break-word">{material.name}</span>
          <span className="text-muted-foreground text-xs">
            Em estoque: {formatQuantity(material.stockQuantity)}
          </span>
          <span className="text-muted-foreground text-xs">
            Custo fracionado: {formatUnitCost(material.unitCost, material.consumptionUnit)}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={onPickMaterial}
      >
        Trocar
      </Button>
    </div>
  );
}

function NewMaterialFields({
  draft,
  onPatch,
}: {
  draft: LineDraft;
  onPatch: (patch: Partial<StockFields>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Nome do insumo novo"
        autoComplete="off"
        value={draft.newMaterialName}
        onChange={(event) => onPatch({ newMaterialName: event.target.value })}
      />
      <SelectField
        label="Unidade de consumo"
        value={draft.newMaterialUnit}
        onChange={(event) =>
          onPatch({
            newMaterialUnit: event.target.value,
            packageQuantity: '',
            packageScale: 'base',
          })
        }
        hint="A unidade em que o insumo é gasto nas fichas técnicas. Depois de usada, não troca mais."
      >
        <option value="" disabled>
          Escolha a unidade
        </option>
        {CONSUMPTION_UNITS.map((value) => (
          <option key={value} value={value}>
            {CONSUMPTION_UNIT_LABELS[value]}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function PackageQuantityField({
  draft,
  reading,
  unit,
  onPatch,
}: {
  draft: LineDraft;
  reading: LineReading;
  unit: ConsumptionUnit;
  onPatch: (patch: Partial<StockFields>) => void;
}) {
  // An empty field is "not answered yet", which the bar under the list already
  // says; only a value that was typed and cannot be read is an error on the field.
  const issue = draft.packageQuantity.trim() === '' ? undefined : reading.issues.packageQuantity;

  return (
    <div className="flex flex-col gap-2">
      <ScaledQuantityField
        label="Quanto cabe em cada embalagem"
        unit={unit}
        scale={draft.packageScale}
        onScaleChange={(packageScale) => onPatch({ packageScale })}
        value={draft.packageQuantity}
        onChange={(packageQuantity) => onPatch({ packageQuantity })}
        error={issue}
      />
      <p className="text-muted-foreground text-xs text-pretty">
        É a sua resposta, na unidade de consumo do insumo. O que a nota imprime (UN, KG, PCT) não
        diz quanto há dentro da embalagem.
      </p>
    </div>
  );
}
