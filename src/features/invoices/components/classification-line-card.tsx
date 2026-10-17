import { CheckCircle2 } from 'lucide-react';

import type { Material } from '@/features/materials';
import { formatMoney, formatPrintedQuantity } from '@/shared/format';
import { CheckboxField } from '@/shared/ui/checkbox-field';
import { StatusBadge } from '@/shared/ui/status-badge';

import type { LineDraft, LineReading, StockFields } from '../model/classification-draft';
import type { PurchaseLine } from '../model/purchase-detail';

import { StockTargetFields } from './stock-target-fields';

interface ClassificationLineCardProps {
  line: PurchaseLine;
  draft: LineDraft;
  /** Absent for a line that was already entered into the stock. */
  reading: LineReading | undefined;
  /** The material the line points at, when it is known. */
  material: Material | undefined;
  onCompanyExpense: (checked: boolean) => void;
  onStockMaterial: (checked: boolean) => void;
  onPatch: (patch: Partial<StockFields>) => void;
  onPickMaterial: () => void;
}

/**
 * One line of the note: what it says, what it cost, and the two answers the
 * person gives — is it a company expense, is it an insumo that goes into stock.
 *
 * The quantity and the unit are labelled "como veio na nota" because that is all
 * they are: the shop's own words, which say how many packages were bought and
 * nothing about what is inside them.
 */
export function ClassificationLineCard({
  line,
  draft,
  reading,
  material,
  onCompanyExpense,
  onStockMaterial,
  onPatch,
  onPickMaterial,
}: ClassificationLineCardProps) {
  const locked = reading === undefined;
  const incomplete = reading !== undefined && Object.keys(reading.issues).length > 0;
  const headingId = `line-${line.id}`;

  return (
    <li>
      <section
        aria-labelledby={headingId}
        className="border-border bg-card shadow-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 id={headingId} className="text-base font-semibold text-pretty wrap-break-word">
              {line.description}
            </h3>
            <p className="text-muted-foreground text-sm">
              Como veio na nota: {formatPrintedQuantity(line.quantity, line.printedUnit)}
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="text-muted-foreground block text-xs">Valor bruto</span>
            <span className="text-base font-bold whitespace-nowrap">
              {formatMoney(line.grossValue)}
            </span>
          </p>
        </div>

        <div className="flex flex-col">
          <CheckboxField
            label="Gasto da empresa"
            checked={draft.isCompanyExpense}
            disabled={locked || draft.isStockMaterial}
            onChange={(event) => onCompanyExpense(event.target.checked)}
          />
          <CheckboxField
            label="Insumo de estoque"
            checked={draft.isStockMaterial}
            disabled={locked}
            onChange={(event) => onStockMaterial(event.target.checked)}
          />
        </div>

        {draft.isStockMaterial && !locked ? (
          <p className="text-muted-foreground -mt-2 text-xs text-pretty">
            Todo insumo de estoque é gasto da empresa, por isso essa marca fica fixa.
          </p>
        ) : null}

        {locked ? (
          <div className="bg-success-muted text-success flex items-start gap-2 rounded-md px-3 py-2.5 text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="text-pretty">
              {material === undefined
                ? 'Este item já deu entrada no estoque.'
                : `Este item já deu entrada no estoque de ${material.name}.`}{' '}
              Para acertar a quantidade, use “Corrigir contagem” no insumo.
            </p>
          </div>
        ) : null}

        {incomplete ? (
          <StatusBadge tone="warning" className="self-start">
            Falta completar
          </StatusBadge>
        ) : null}

        {draft.isStockMaterial && reading !== undefined ? (
          <StockTargetFields
            lineName={line.description}
            draft={draft}
            reading={reading}
            material={material}
            onPatch={onPatch}
            onPickMaterial={onPickMaterial}
          />
        ) : null}
      </section>
    </li>
  );
}
