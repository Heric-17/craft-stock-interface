import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { isApiError } from '@/shared/api/api-error';
import { insufficientStockSummary } from '@/shared/api/error-messages';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { formatMoney, formatQuantity } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { showErrorToast } from '@/shared/ui/error-toast';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { SelectField } from '@/shared/ui/select-field';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';
import { TextAreaField } from '@/shared/ui/text-area-field';
import { UnexpectedError } from '@/shared/ui/unexpected-error';

import { useAdjustStock, useRecordLoss } from '../api/use-material-mutations';
import { useMaterial, useMaterials } from '../api/use-materials';
import { STOCK_ADJUSTMENT_TEXT, STOCK_LOSS_REASON_LABELS } from '../model/labels';
import { MAX_OBSERVATION_LENGTH, STOCK_LOSS_REASONS } from '../model/loss-reason';
import type { Material } from '../model/material';
import {
  EMPTY_STOCK_ADJUSTMENT_FORM,
  previewStockAfter,
  readLossDetails,
  readStockAdjustment,
  stockAdjustmentSchemaFor,
  type StockAdjustmentFormValues,
  type StockAdjustmentKind,
} from '../model/stock-adjustment';

import { STOCK_ACTION_KINDS, STOCK_ACTION_STYLE } from './stock-action-style';

interface StockAdjustmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The act the panel opens on. The person can switch to another inside it. */
  kind: StockAdjustmentKind;
  /** Opened from a material: it is already chosen. From the page header it is not. */
  material?: Material | undefined;
}

/**
 * One panel to adjust a stock by hand, with the three acts side by side at the
 * top: an entry, a write-off or loss, and a recount. They share the form
 * because they share its shape; they do not share a name, an icon or a tone,
 * since "something arrived", "something broke" and "the count is off" are
 * different things to the person doing them. Two of them reach the API by the
 * same route, and the screen does not let that show.
 */
export function StockAdjustmentSheet({
  open,
  onOpenChange,
  kind,
  material,
}: StockAdjustmentSheetProps) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Ajustar estoque">
      <AdjustmentBody initialKind={kind} material={material} onClose={() => onOpenChange(false)} />
    </ResponsiveSheet>
  );
}

function AdjustmentBody({
  initialKind,
  material: given,
  onClose,
}: {
  initialKind: StockAdjustmentKind;
  material: Material | undefined;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(initialKind);
  // What the API refused with, written from its own details. Cleared as soon as
  // the quantity changes: it was about the one that was sent.
  const [refusal, setRefusal] = useState<string | null>(null);

  const text = STOCK_ADJUSTMENT_TEXT[kind];
  const adjust = useAdjustStock();
  const recordLoss = useRecordLoss();
  const pending = adjust.isPending || recordLoss.isPending;

  // Only active materials can have their stock changed. The same query the
  // page's unfiltered list uses, so it is usually already in the cache.
  const candidates = useMaterials({ includeDiscontinued: false }, { enabled: given === undefined });
  // The material the panel was opened from is read again, live: its stock is
  // what the write-off is checked against, and a refused write-off refreshes it.
  const live = useMaterial(given?.id ?? null);

  const schema = useMemo(() => stockAdjustmentSchemaFor(kind), [kind]);
  const { control, handleSubmit, setError, clearErrors, setValue, formState } =
    useForm<StockAdjustmentFormValues>({
      resolver: zodResolver(schema),
      defaultValues: { ...EMPTY_STOCK_ADJUSTMENT_FORM, materialId: given?.id ?? '' },
    });

  const materialId = useWatch({ control, name: 'materialId' });
  const quantityText = useWatch({ control, name: 'quantity' });
  const scale = useWatch({ control, name: 'scale' });

  const chosen =
    given !== undefined && given.id === materialId
      ? (live.data ?? given)
      : candidates.data?.find((candidate) => candidate.id === materialId);

  // What the field says right now, read once: the preview below it and the
  // request that is sent come from this same reading.
  const reading =
    chosen === undefined || quantityText.trim() === ''
      ? null
      : readStockAdjustment(
          kind,
          quantityText,
          chosen.consumptionUnit,
          scale,
          chosen.stockQuantity,
        );
  // A write-off larger than the stock never leaves this screen: the button is
  // off and the balance is on display instead.
  const exceedsStock = reading?.ok === false && reading.reason === 'EXCEEDS_STOCK';

  function chooseKind(next: StockAdjustmentKind): void {
    if (next === kind) {
      return;
    }

    // A number typed for an entry must not quietly become a loss: what was typed
    // belongs to the act it was typed for.
    setKind(next);
    setValue('quantity', '');
    setValue('scale', 'base');
    setValue('reason', '');
    setValue('observation', '');
    clearErrors();
    setRefusal(null);
  }

  async function save(values: StockAdjustmentFormValues): Promise<void> {
    if (chosen === undefined) {
      setError('materialId', { message: 'Escolha o insumo.' });

      return;
    }

    const result = readStockAdjustment(
      kind,
      values.quantity,
      chosen.consumptionUnit,
      values.scale,
      chosen.stockQuantity,
    );

    if (!result.ok) {
      setError('quantity', { message: result.message });

      return;
    }

    try {
      if (kind === 'WRITE_OFF') {
        const details = readLossDetails(values.reason, values.observation);

        if (!details.ok) {
          setError(details.field, { message: details.message });

          return;
        }

        const recorded = await recordLoss.mutateAsync({
          id: chosen.id,
          unit: chosen.consumptionUnit,
          quantity: result.adjustment.quantity,
          details: details.details,
        });

        toast.success(
          `${text.done(chosen.name, formatQuantity(recorded.stockQuantityAfter))} Valor perdido: ${formatMoney(recorded.value)}.`,
        );
      } else {
        const updated = await adjust.mutateAsync({ id: chosen.id, adjustment: result.adjustment });

        toast.success(text.done(updated.name, formatQuantity(updated.stockQuantity)));
      }

      onClose();
    } catch (error) {
      // The stock was changed somewhere else since this screen read it: the API
      // says how much there is, and that figure — not a recomputed one — is what
      // the person is told. The panel stays open and reads the new balance.
      const insufficient = isApiError(error)
        ? insufficientStockSummary(error, chosen.consumptionUnit)
        : undefined;

      if (insufficient !== undefined) {
        setRefusal(insufficient);

        return;
      }

      if (!applyApiErrorToForm(error, setError)) {
        showErrorToast(error);
      }
    }
  }

  const formError = formState.errors.root?.api?.message;

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(save)(event)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetPanel
        title={text.action}
        description={text.description}
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || exceedsStock}>
              {pending ? text.submitting : text.submit}
            </Button>
          </>
        }
      >
        <ActionPicker kind={kind} onChange={chooseKind} disabled={pending} />

        {given !== undefined ? (
          <p className="text-foreground text-base font-semibold">{given.name}</p>
        ) : candidates.isError ? (
          <UnexpectedError error={candidates.error} />
        ) : (
          <Controller
            control={control}
            name="materialId"
            render={({ field, fieldState }) => (
              <SelectField
                label="Insumo"
                name={field.name}
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={candidates.isPending}
                error={fieldState.error?.message}
              >
                <option value="" disabled>
                  {candidates.isPending ? 'Carregando insumos…' : 'Escolha o insumo'}
                </option>
                {(candidates.data ?? []).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </SelectField>
            )}
          />
        )}

        {chosen === undefined ? (
          <p className="text-muted-foreground text-sm">{text.chooseMaterial}</p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Estoque atual:{' '}
              <span className="text-foreground font-semibold">
                {formatQuantity(chosen.stockQuantity)}
              </span>
            </p>
            <Controller
              control={control}
              name="quantity"
              render={({ field, fieldState }) => (
                <ScaledQuantityField
                  label={text.field}
                  unit={chosen.consumptionUnit}
                  scale={scale}
                  onScaleChange={(next) => setValue('scale', next)}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => {
                    setRefusal(null);
                    field.onChange(value);
                  }}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />

            {/* The balance, or the reason the button is off, goes right under the quantity: that is where the eye is when it happens. */}
            {reading?.ok === true ? (
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {kind === 'WRITE_OFF'
                  ? 'Prévia: saldo depois da baixa'
                  : 'Prévia: o estoque ficará com'}{' '}
                <span className="text-foreground font-semibold">
                  {formatQuantity(previewStockAfter(reading.adjustment, chosen.stockQuantity))}
                </span>
              </p>
            ) : exceedsStock ? (
              <Callout tone="warning" alert>
                {reading.message}
              </Callout>
            ) : null}

            {kind === 'WRITE_OFF' ? (
              <>
                <Controller
                  control={control}
                  name="reason"
                  render={({ field, fieldState }) => (
                    <SelectField
                      label="Motivo da baixa"
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    >
                      <option value="" disabled>
                        Escolha o motivo
                      </option>
                      {STOCK_LOSS_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {STOCK_LOSS_REASON_LABELS[reason]}
                        </option>
                      ))}
                    </SelectField>
                  )}
                />
                <Controller
                  control={control}
                  name="observation"
                  render={({ field, fieldState }) => (
                    <TextAreaField
                      label="Observação (opcional)"
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      maxLength={MAX_OBSERVATION_LENGTH}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </>
            ) : null}

            {refusal !== null && !exceedsStock ? (
              <Callout tone="danger" alert>
                {refusal}
              </Callout>
            ) : null}
          </>
        )}

        {formError === undefined ? null : (
          <Callout tone="danger" alert>
            {formError}
          </Callout>
        )}
      </SheetPanel>
    </form>
  );
}

/**
 * The three acts as three tiles, each with its own icon and tone. A radio
 * group: exactly one is chosen, and the arrow keys move between them.
 */
function ActionPicker({
  kind,
  onChange,
  disabled,
}: {
  kind: StockAdjustmentKind;
  onChange: (kind: StockAdjustmentKind) => void;
  disabled: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="O que você quer fazer" className="grid grid-cols-3 gap-2">
      {STOCK_ACTION_KINDS.map((option) => {
        const { icon: Icon, tone, selected } = STOCK_ACTION_STYLE[option];
        const isSelected = option === kind;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              'border-border bg-card text-card-foreground hover:bg-muted flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border px-1.5 py-2 text-center text-xs leading-tight font-medium disabled:opacity-60',
              isSelected && selected,
            )}
          >
            <span
              aria-hidden="true"
              className={cn('grid size-9 place-items-center rounded-full', tone)}
            >
              <Icon className="size-5" />
            </span>
            {STOCK_ADJUSTMENT_TEXT[option].action}
          </button>
        );
      })}
    </div>
  );
}
