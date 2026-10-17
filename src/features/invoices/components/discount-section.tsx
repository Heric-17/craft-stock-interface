import { BadgePercent } from 'lucide-react';
import { useId } from 'react';

import { messageForError, errorDetail } from '@/shared/api/error-messages';
import type { ApiError } from '@/shared/api/api-error';
import { formatMoney } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { Callout } from '@/shared/ui/callout';
import { FormSection } from '@/shared/ui/form-section';
import { MoneyField } from '@/shared/ui/money-field';

import type { ClassificationReading } from '../model/classification-draft';
import { DISCOUNT_ALLOCATION_MODES, type DiscountAllocationMode } from '../model/discount-mode';
import {
  DISCOUNT_MODE_BLOCK_REASONS,
  DISCOUNT_MODE_HINTS,
  DISCOUNT_MODE_LABELS,
  MANUAL_LINE_ISSUE_MESSAGES,
} from '../model/labels';
import type { PurchaseDetail } from '../model/purchase-detail';

interface DiscountSectionProps {
  purchase: PurchaseDetail;
  reading: ClassificationReading;
  manualInputs: Readonly<Record<string, string>>;
  /** The attribution was invalidated by an edit and has not been spread again. */
  pending: boolean;
  /** The last refusal about the discount, to be told where the choice is made. */
  refusal: ApiError | null;
  onMode: (mode: DiscountAllocationMode) => void;
  onManualAmount: (itemId: string, text: string) => void;
}

/**
 * How the discount of the note is spread over its lines. It is asked only of a
 * note that has one, and the three automatic ways are the API's arithmetic: this
 * screen does not know how much each line will receive until the API says so.
 */
export function DiscountSection({
  purchase,
  reading,
  manualInputs,
  pending,
  refusal,
  onMode,
  onManualAmount,
}: DiscountSectionProps) {
  const legendId = useId();

  return (
    <FormSection
      title="Desconto da nota"
      description={`A nota teve ${formatMoney(purchase.discountTotal)} de desconto, mas não diz de qual item ele é. Escolha como dividir.`}
      icon={BadgePercent}
      tone="warning"
    >
      {pending ? (
        <Callout tone="warning" alert>
          <p className="font-semibold">O desconto desta nota está pendente.</p>
          <p>
            Uma alteração nos itens desfez a divisão do desconto. Enquanto você não escolher de novo
            como dividir, não dá para concluir, e a compra fica fora do painel de gastos.
          </p>
        </Callout>
      ) : null}

      <div role="radiogroup" aria-labelledby={legendId} className="grid gap-2 lg:grid-cols-2">
        <p id={legendId} className="sr-only">
          Como dividir o desconto
        </p>
        {DISCOUNT_ALLOCATION_MODES.map((mode) => {
          const availability = reading.availability[mode];

          return (
            <ModeOption
              key={mode}
              mode={mode}
              selected={reading.mode === mode}
              disabledReason={
                availability.enabled ? null : DISCOUNT_MODE_BLOCK_REASONS[availability.block]
              }
              onSelect={() => onMode(mode)}
            />
          );
        })}
      </div>

      {reading.manual === null ? null : (
        <ManualLines
          purchase={purchase}
          reading={reading.manual}
          inputs={manualInputs}
          onChange={onManualAmount}
        />
      )}

      {refusal === null ? null : (
        <Callout tone="danger" alert>
          <p className="font-semibold">{messageForError(refusal)}</p>
          {errorDetail(refusal) === undefined ? null : <p>{errorDetail(refusal)}</p>}
          <p>Nada foi salvo. Ajuste a divisão e conclua de novo.</p>
        </Callout>
      )}

      <p className="text-muted-foreground text-xs text-pretty">
        O desconto não muda o custo do insumo: o custo continua sendo o valor cheio da linha.
      </p>
    </FormSection>
  );
}

function ModeOption({
  mode,
  selected,
  disabledReason,
  onSelect,
}: {
  mode: DiscountAllocationMode;
  selected: boolean;
  disabledReason: string | null;
  onSelect: () => void;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const disabled = disabledReason !== null;

  return (
    <label
      htmlFor={id}
      className={cn(
        'border-input flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors',
        disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-accent cursor-pointer',
        selected && 'border-primary bg-secondary',
      )}
    >
      <input
        id={id}
        type="radio"
        name="discount-mode"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        aria-describedby={noteId}
        className="accent-primary mt-0.5 size-5 shrink-0"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{DISCOUNT_MODE_LABELS[mode]}</span>
        <span id={noteId} className="text-muted-foreground text-xs text-pretty">
          {disabledReason ?? DISCOUNT_MODE_HINTS[mode]}
        </span>
      </span>
    </label>
  );
}

function ManualLines({
  purchase,
  reading,
  inputs,
  onChange,
}: {
  purchase: PurchaseDetail;
  reading: NonNullable<ClassificationReading['manual']>;
  inputs: Readonly<Record<string, string>>;
  onChange: (itemId: string, text: string) => void;
}) {
  const byId = new Map(reading.lines.map((line) => [line.itemId, line]));
  const overspent = reading.remaining.isNegative();

  return (
    <div className="flex flex-col gap-3">
      <p
        aria-live="polite"
        className={cn(
          'bg-card sticky top-16 z-5 rounded-lg border px-3 py-2.5 text-sm font-semibold',
          reading.closes
            ? 'border-success text-success'
            : overspent
              ? 'border-destructive text-destructive'
              : 'border-border text-foreground',
        )}
      >
        Atribuído {formatMoney(reading.assigned)} de {formatMoney(reading.expected)}
        {reading.closes ? null : (
          <span className="text-muted-foreground block text-xs font-normal">
            {overspent
              ? `Passou ${formatMoney(reading.remaining.times(-1))}.`
              : `Faltam ${formatMoney(reading.remaining)}.`}
          </span>
        )}
      </p>

      <ul className="grid gap-3 lg:grid-cols-2 lg:items-start [&>li]:min-w-0">
        {purchase.lines.map((line) => {
          const entry = byId.get(line.id);
          const issue = entry?.issue ?? null;

          return (
            <li key={line.id}>
              <div
                role="group"
                aria-label={`Desconto de ${line.description}`}
                className="border-border flex flex-col gap-2 rounded-lg border p-3"
              >
                <p className="text-sm font-semibold text-pretty wrap-break-word">
                  {line.description}
                </p>
                <p className="text-muted-foreground text-xs">
                  Valor do item {formatMoney(line.grossValue)}: o desconto não pode passar disso.
                </p>
                <MoneyField
                  label="Desconto atribuído"
                  value={inputs[line.id] ?? ''}
                  onChange={(text) => onChange(line.id, text)}
                  error={issue === null ? undefined : MANUAL_LINE_ISSUE_MESSAGES[issue]}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
