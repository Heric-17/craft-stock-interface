import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { formatQuantity, quantityInputText, type QuantityInputScale } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { showErrorToast } from '@/shared/ui/error-toast';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';

import { useUpdateSaleItemQuantity } from '../api/use-sale-mutations';
import type { SaleItem } from '../model/sale';
import { readEditedQuantity } from '../model/sale-edit';

interface SaleItemQuantitySheetProps {
  saleId: string;
  /** The line being changed, or `null` while the panel is closed. */
  item: SaleItem | null;
  onOpenChange: (open: boolean) => void;
}

export function SaleItemQuantitySheet({ saleId, item, onOpenChange }: SaleItemQuantitySheetProps) {
  return (
    <ResponsiveSheet
      open={item !== null}
      onOpenChange={onOpenChange}
      title="Alterar a quantidade do item"
    >
      {item === null ? null : (
        <QuantityBody
          saleId={saleId}
          item={item}
          quantityText={quantityInputText(item.quantity)}
          onClose={() => onOpenChange(false)}
        />
      )}
    </ResponsiveSheet>
  );
}

interface QuantityFormValues {
  quantity: string;
  scale: QuantityInputScale;
}

function QuantityBody({
  saleId,
  item,
  quantityText,
  onClose,
}: {
  saleId: string;
  item: SaleItem;
  quantityText: string;
  onClose: () => void;
}) {
  const update = useUpdateSaleItemQuantity();
  // The unit the line was sold in: it does not change with the material.
  const unit = item.unit;

  const schema = z
    .object({ quantity: z.string(), scale: z.enum(['base', 'major']) })
    .superRefine((values, ctx) => {
      if (readEditedQuantity(values.quantity, unit, values.scale) === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['quantity'],
          message:
            values.quantity.trim() === ''
              ? 'Informe a quantidade.'
              : 'Informe uma quantidade maior do que zero, com até 3 casas decimais.',
        });
      }
    });

  const { control, handleSubmit, setError, formState } = useForm<QuantityFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: quantityText, scale: 'base' },
  });

  async function save(values: QuantityFormValues): Promise<void> {
    const quantity = readEditedQuantity(values.quantity, unit, values.scale);

    if (quantity === null) {
      return;
    }

    try {
      await update.mutateAsync({ saleId, itemId: item.id, quantity });
      toast.success(`Quantidade de ${item.name} alterada.`);
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
        title="Alterar a quantidade"
        description="O preço do item continua o que foi combinado na venda. O total é recalculado pelo sistema."
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Salvando…' : 'Salvar quantidade'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1">
          <p className="text-foreground text-base font-semibold text-balance">{item.name}</p>
          <p className="text-muted-foreground text-sm">
            Quantidade atual: {formatQuantity(item.quantity)}
          </p>
        </div>

        <Controller
          control={control}
          name="quantity"
          render={({ field, fieldState }) => (
            <Controller
              control={control}
              name="scale"
              render={({ field: scaleField }) => (
                <ScaledQuantityField
                  label="Nova quantidade"
                  unit={unit}
                  scale={scaleField.value}
                  onScaleChange={scaleField.onChange}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          )}
        />

        {formError === undefined ? null : (
          <Callout tone="danger" alert>
            {formError}
          </Callout>
        )}
      </SheetPanel>
    </form>
  );
}
