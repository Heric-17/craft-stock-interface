import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import type { CompositeProduct } from '@/features/composite-products';
import type { Material } from '@/features/materials';
import { isApiError } from '@/shared/api/api-error';
import { messageForError } from '@/shared/api/error-messages';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { formatMoney } from '@/shared/format';
import { useUnsavedChanges } from '@/shared/lib/use-unsaved-changes';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { showErrorToast } from '@/shared/ui/error-toast';
import { FormSection } from '@/shared/ui/form-section';
import { PageHeader } from '@/shared/ui/page-header';
import { TextField } from '@/shared/ui/text-field';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';

import { useCreateSale } from '../api/use-sale-mutations';
import {
  buildCreateSaleRequest,
  EMPTY_SALE_FORM,
  previewLinesFrom,
  readSaleForm,
  saleFormSchema,
  type SaleFormValues,
} from '../model/sale-form';
import { previewSale } from '../model/sale-preview';

import { SaleItemsEditor } from './sale-items-editor';

interface NewSaleFormProps {
  products: readonly CompositeProduct[];
  materials: readonly Material[];
}

/**
 * Registers a sale: the customer, how it is paid, and what it holds — products
 * and materials sold on their own.
 *
 * The value shown while typing is a **preview**, worked out here with the same
 * order of operations as the API and labelled as such. Once the sale is saved
 * the screen opens it and shows the API's own total; the two have to agree to
 * the cent, and when they do not the API's is the one that counts.
 */
export function NewSaleForm({ products, materials }: NewSaleFormProps) {
  const navigate = useNavigate();
  const create = useCreateSale();

  const { control, handleSubmit, setError, setValue, getValues, formState } =
    useForm<SaleFormValues>({
      resolver: zodResolver(saleFormSchema),
      defaultValues: EMPTY_SALE_FORM,
    });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  // Leaving with a sale half typed asks first.
  const { blocker, allowLeaving } = useUnsavedChanges(formState.isDirty);
  const values = useWatch({ control });

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const materialsById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );

  // What the form means right now, read the same way it will be sent.
  const preview = previewSale(
    previewLinesFrom(values as SaleFormValues, productsById, materialsById),
  );

  async function save(formValues: SaleFormValues): Promise<void> {
    const { parsed } = readSaleForm(formValues);

    if (parsed === null) {
      return;
    }

    try {
      const created = await create.mutateAsync(buildCreateSaleRequest(parsed));

      toast.success('Venda registrada.');
      // Relative to the route: the saved sale is a sibling of "nova", under the list.
      allowLeaving();
      void navigate(`../${encodeURIComponent(created.id)}`, { relative: 'path', replace: true });
    } catch (error) {
      if (!applyApiErrorToForm(error, setError)) {
        showErrorToast(error);

        return;
      }

      // The API names no line for a missing margin, so it is shown on every
      // loose-material line. The form already refuses an empty one, so this is
      // what remains when something slipped past it.
      if (isApiError(error) && error.code === 'MISSING_LOOSE_MATERIAL_MARGIN') {
        getValues('items').forEach((line, index) => {
          if (line.kind === 'MATERIAL') {
            setError(`items.${index}.margin`, { type: 'server', message: messageForError(error) });
          }
        });
      }
    }
  }

  const formError = formState.errors.root?.api?.message;
  const itemsError = formState.errors.items?.message ?? formState.errors.items?.root?.message;
  const pending = create.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to=".."
          relative="path"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 self-start text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para as vendas
        </Link>
        <PageHeader
          eyebrow="Vendas"
          title="Nova venda"
          description="Escolha o que foi vendido e veja o total enquanto preenche."
        />
      </div>

      <form
        noValidate
        onSubmit={(event) => void handleSubmit(save)(event)}
        className="flex max-w-3xl min-w-0 flex-col gap-6"
      >
        <FormSection title="Cliente e pagamento">
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
                placeholder="Pix, dinheiro, cartão…"
                name={field.name}
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </FormSection>

        <FormSection
          title="Itens"
          description="Um produto é vendido pelo preço da ficha técnica. Um insumo avulso é vendido pelo custo da embalagem mais a margem que você definir."
        >
          <SaleItemsEditor
            control={control}
            setValue={setValue}
            lines={fields}
            products={products}
            materials={materials}
            lineTotals={preview.lineTotals}
            error={itemsError}
            disabled={pending}
            onAdd={(line) => append(line)}
            onRemove={remove}
          />
        </FormSection>

        {formError === undefined ? null : (
          <Callout tone="danger" alert>
            {formError}
          </Callout>
        )}

        <div className="border-border bg-card sticky bottom-3 z-5 flex flex-col gap-3 rounded-xl border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground text-sm">Total (prévia)</span>
            <span className="text-lg font-bold tracking-tight whitespace-nowrap">
              {preview.total === null ? '—' : formatMoney(preview.total)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs text-pretty">
            Prévia com os preços de agora. Depois de registrar, vale o total calculado pelo sistema.
          </p>
          <div className="flex flex-row gap-2 [&>*]:flex-1 sm:[&>*]:flex-none sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate('..', { relative: 'path' })}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Registrando…' : 'Registrar venda'}
            </Button>
          </div>
        </div>
      </form>

      <UnsavedChangesDialog blocker={blocker} what="o que você preencheu da venda" />
    </div>
  );
}
