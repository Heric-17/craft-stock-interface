import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { formatQuantity } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { showErrorToast } from '@/shared/ui/error-toast';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { SelectField } from '@/shared/ui/select-field';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';
import { UnexpectedError } from '@/shared/ui/unexpected-error';

import { useAdjustStock } from '../api/use-material-mutations';
import { useMaterials } from '../api/use-materials';
import { STOCK_ADJUSTMENT_TEXT } from '../model/labels';
import type { Material } from '../model/material';
import {
  EMPTY_STOCK_ADJUSTMENT_FORM,
  previewStockAfter,
  readStockAdjustment,
  stockAdjustmentSchema,
  type StockAdjustmentFormValues,
  type StockAdjustmentKind,
} from '../model/stock-adjustment';

interface StockAdjustmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: StockAdjustmentKind;
  /** Opened from a material: it is already chosen. From the page header it is not. */
  material?: Material | undefined;
}

/**
 * One panel for the three manual changes to a stock — entry, write-off and
 * recount — with the words of the one that was opened. They share the form
 * because they share its shape; they do not share a name, since "something
 * arrived", "something broke" and "the count is off" are different things to
 * the person doing them.
 */
export function StockAdjustmentSheet({
  open,
  onOpenChange,
  kind,
  material,
}: StockAdjustmentSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={STOCK_ADJUSTMENT_TEXT[kind].title}
    >
      <AdjustmentBody kind={kind} material={material} onClose={() => onOpenChange(false)} />
    </ResponsiveSheet>
  );
}

function AdjustmentBody({
  kind,
  material: given,
  onClose,
}: {
  kind: StockAdjustmentKind;
  material: Material | undefined;
  onClose: () => void;
}) {
  const text = STOCK_ADJUSTMENT_TEXT[kind];
  const adjust = useAdjustStock();
  // Only active materials can have their stock changed. The same query the
  // page's unfiltered list uses, so it is usually already in the cache.
  const candidates = useMaterials({ includeDiscontinued: false }, { enabled: given === undefined });

  const { control, handleSubmit, setError, setValue, formState } =
    useForm<StockAdjustmentFormValues>({
      resolver: zodResolver(stockAdjustmentSchema),
      defaultValues: { ...EMPTY_STOCK_ADJUSTMENT_FORM, materialId: given?.id ?? '' },
    });

  const materialId = useWatch({ control, name: 'materialId' });
  const quantityText = useWatch({ control, name: 'quantity' });
  const scale = useWatch({ control, name: 'scale' });

  const chosen =
    given !== undefined && given.id === materialId
      ? given
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
      const updated = await adjust.mutateAsync({ id: chosen.id, adjustment: result.adjustment });

      toast.success(text.done(updated.name, formatQuantity(updated.stockQuantity)));
      onClose();
    } catch (error) {
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
            <Button type="button" variant="outline" onClick={onClose} disabled={adjust.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={adjust.isPending}>
              {adjust.isPending ? text.submitting : text.submit}
            </Button>
          </>
        }
      >
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
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            {reading?.ok === true ? (
              <p className="text-muted-foreground text-sm" aria-live="polite">
                Prévia: o estoque ficará com{' '}
                <span className="text-foreground font-semibold">
                  {formatQuantity(previewStockAfter(reading.adjustment, chosen.stockQuantity))}
                </span>
              </p>
            ) : reading?.reason === 'EXCEEDS_STOCK' ? (
              <Callout tone="warning" alert>
                {reading.message}
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
