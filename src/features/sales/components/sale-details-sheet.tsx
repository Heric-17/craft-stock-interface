import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { showErrorToast } from '@/shared/ui/error-toast';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';
import { TextField } from '@/shared/ui/text-field';

import { useUpdateSaleDetails } from '../api/use-sale-mutations';
import type { Sale } from '../model/sale';
import {
  buildDetailsPatch,
  hasDetailsChanges,
  saleDetailsFormValuesFrom,
  saleDetailsSchema,
  type SaleDetailsFormValues,
} from '../model/sale-edit';

interface SaleDetailsSheetProps {
  sale: Sale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Who the sale is for and how it is paid. Only while the production is still pending. */
export function SaleDetailsSheet({ sale, open, onOpenChange }: SaleDetailsSheetProps) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Editar dados da venda">
      <DetailsBody sale={sale} onClose={() => onOpenChange(false)} />
    </ResponsiveSheet>
  );
}

function DetailsBody({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const update = useUpdateSaleDetails();
  const { control, handleSubmit, setError, formState } = useForm<SaleDetailsFormValues>({
    resolver: zodResolver(saleDetailsSchema),
    defaultValues: saleDetailsFormValuesFrom(sale),
  });

  async function save(values: SaleDetailsFormValues): Promise<void> {
    const patch = buildDetailsPatch(values, sale);

    if (!hasDetailsChanges(patch)) {
      toast.info('Não há alterações para salvar.');
      onClose();

      return;
    }

    try {
      await update.mutateAsync({ id: sale.id, patch });
      toast.success('Dados da venda atualizados.');
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
        title="Editar dados da venda"
        description="Os itens e os preços não mudam por aqui."
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Salvando…' : 'Salvar dados'}
            </Button>
          </>
        }
      >
        <Controller
          control={control}
          name="customerName"
          render={({ field, fieldState }) => (
            <TextField
              label="Cliente"
              autoComplete="off"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="customerContact"
          render={({ field, fieldState }) => (
            <TextField
              label="Contato (opcional)"
              autoComplete="off"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="paymentMethod"
          render={({ field, fieldState }) => (
            <TextField
              label="Forma de pagamento"
              autoComplete="off"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
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
