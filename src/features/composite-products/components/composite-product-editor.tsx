import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import type { Material } from '@/features/materials';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { formatDateTime } from '@/shared/format';
import { useIsExtraLargeDesktop } from '@/shared/lib/use-media-query';
import { useUnsavedChanges } from '@/shared/lib/use-unsaved-changes';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { showErrorToast } from '@/shared/ui/error-toast';
import { FormSection } from '@/shared/ui/form-section';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';
import { MarginField } from '@/shared/ui/margin-field';
import { MoneyField } from '@/shared/ui/money-field';
import { PageHeader } from '@/shared/ui/page-header';
import { PhotoButton } from '@/shared/ui/photo-button';
import { TextField } from '@/shared/ui/text-field';
import { UnexpectedError } from '@/shared/ui/unexpected-error';
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog';

import {
  useCreateCompositeProduct,
  useRemoveCompositeProductImage,
  useUpdateCompositeProduct,
  useUploadCompositeProductImage,
} from '../api/use-composite-product-mutations';
import { previewPricing } from '../model/bom-preview';
import type { CompositeProduct } from '../model/composite-product';
import {
  buildCreateRequest,
  buildUpdate,
  compositeProductFormSchema,
  compositeProductFormValuesFrom,
  EMPTY_COMPOSITE_PRODUCT_FORM,
  hasChanges,
  pricingDraftFrom,
  pricingFieldsDiffer,
  readCompositeProductForm,
  sameBillOfMaterials,
  type CompositeProductFormValues,
  type ParsedCompositeProductForm,
} from '../model/composite-product-form';
import { figuresOfPreview, figuresOfProduct, type ResultSource } from '../model/result-figures';

import { BomItemsEditor } from './bom-items-editor';

import { ProductLifecycleActions } from './product-lifecycle-actions';
import { ResultPanel } from './result-panel';

interface CompositeProductEditorProps {
  /** The product being edited; absent when registering a new one. */
  product?: CompositeProduct | undefined;
  /** Every material, discontinued ones included: a line may still point at one. */
  materials: readonly Material[];
}

/** A product that was saved while its photo was not. */
interface SavedWithoutPhoto {
  product: CompositeProduct;
  file: File;
  error: unknown;
}

/**
 * Registers a product or edits one: its data and photo, its bill of materials,
 * and the fixed cost, margin and manual price that make its price — with the
 * result beside it, changing as the form does.
 *
 * The figures in the result are the API's for a saved product and a preview
 * once something that moves a price is edited, and say which. After saving, the
 * form is read back from the API's answer, so what is on screen is what the
 * system holds.
 */
export function CompositeProductEditor({ product, materials }: CompositeProductEditorProps) {
  const navigate = useNavigate();
  const sideBySide = useIsExtraLargeDesktop();

  const [photo, setPhoto] = useState<File | null>(null);
  const [confirmingPhotoRemoval, setConfirmingPhotoRemoval] = useState(false);
  const [savedWithoutPhoto, setSavedWithoutPhoto] = useState<SavedWithoutPhoto | null>(null);

  const create = useCreateCompositeProduct();
  const update = useUpdateCompositeProduct();
  const upload = useUploadCompositeProductImage();
  const removeImage = useRemoveCompositeProductImage();

  const savedValues = useMemo(
    () => (product === undefined ? null : compositeProductFormValuesFrom(product)),
    [product],
  );

  const { control, handleSubmit, setError, setValue, reset, formState } =
    useForm<CompositeProductFormValues>({
      resolver: zodResolver(compositeProductFormSchema),
      defaultValues: savedValues ?? EMPTY_COMPOSITE_PRODUCT_FORM,
    });
  const { fields, append, remove } = useFieldArray({ control, name: 'billOfMaterials' });
  const values = useWatch({ control });

  // Leaving with typed work — or a photo picked and not yet sent — asks first.
  const { blocker, allowLeaving } = useUnsavedChanges(formState.isDirty || photo !== null);

  const editing = product !== undefined;
  const pending = create.isPending || update.isPending || upload.isPending;
  const imageBusy = upload.isPending || removeImage.isPending;

  const materialsById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );

  // What the form means right now, read the same way it will be sent.
  const draft = pricingDraftFrom(values as CompositeProductFormValues, materialsById);
  const preview = previewPricing(draft);

  const source: ResultSource =
    product === undefined || savedValues === null
      ? 'new'
      : pricingFieldsDiffer(values as CompositeProductFormValues, savedValues)
        ? 'preview'
        : 'saved';
  const figures =
    source === 'saved' && product !== undefined
      ? figuresOfProduct(product)
      : figuresOfPreview(draft, preview);
  const capacityStale =
    savedValues !== null && !sameBillOfMaterials(values as CompositeProductFormValues, savedValues);

  async function save(formValues: CompositeProductFormValues): Promise<void> {
    const { parsed } = readCompositeProductForm(formValues);

    if (parsed === null) {
      return;
    }

    if (product === undefined) {
      await register(parsed);
    } else {
      await edit(parsed, product);
    }
  }

  async function register(parsed: ParsedCompositeProductForm): Promise<void> {
    let created: CompositeProduct;

    try {
      created = await create.mutateAsync(buildCreateRequest(parsed));
    } catch (error) {
      if (!applyApiErrorToForm(error, setError)) {
        showErrorToast(error);
      }

      return;
    }

    if (photo === null) {
      toast.success('Ficha técnica cadastrada.');
      openSaved(created);

      return;
    }

    // The product exists now and stays: a photo that did not go up is not a
    // reason to undo the registration. The screen says so and offers another go.
    try {
      await upload.mutateAsync({ id: created.id, file: photo });
      toast.success('Ficha técnica cadastrada com foto.');
      openSaved(created);
    } catch (error) {
      setSavedWithoutPhoto({ product: created, file: photo, error });
    }
  }

  async function edit(
    parsed: ParsedCompositeProductForm,
    original: CompositeProduct,
  ): Promise<void> {
    const patch = buildUpdate(parsed, original);

    if (!hasChanges(patch)) {
      toast.info('Não há alterações para salvar.');

      return;
    }

    try {
      const updated = await update.mutateAsync({ id: original.id, patch });
      toast.success('Ficha técnica atualizada.');
      // The form is read back from the API's own answer: what is on screen is
      // what the system holds, however it rounded.
      reset(compositeProductFormValuesFrom(updated));
    } catch (error) {
      if (!applyApiErrorToForm(error, setError)) {
        showErrorToast(error);
      }
    }
  }

  /** Relative to the route: the saved product is a sibling of "nova", under the list. */
  function openSaved(saved: CompositeProduct): void {
    allowLeaving();
    void navigate(`../${encodeURIComponent(saved.id)}`, { relative: 'path', replace: true });
  }

  if (savedWithoutPhoto !== null) {
    return (
      <PhotoUploadFailed
        failure={savedWithoutPhoto}
        retrying={upload.isPending}
        onRetry={(file) =>
          upload.mutate(
            { id: savedWithoutPhoto.product.id, file },
            {
              onSuccess: () => {
                toast.success('Foto enviada.');
                openSaved(savedWithoutPhoto.product);
              },
              onError: (error) => setSavedWithoutPhoto({ ...savedWithoutPhoto, file, error }),
            },
          )
        }
        onDone={() => openSaved(savedWithoutPhoto.product)}
      />
    );
  }

  const resultPanel = (variant: 'side' | 'summary') => (
    <ResultPanel
      variant={variant}
      source={source}
      figures={figures}
      saved={product ?? null}
      capacityStale={capacityStale}
    />
  );

  const formError = formState.errors.root?.api?.message;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to=".."
          relative="path"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 self-start text-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para as fichas técnicas
        </Link>
        <PageHeader
          eyebrow="Fichas técnicas"
          title={product === undefined ? 'Nova ficha técnica' : product.name}
          {...(product === undefined
            ? {
                description:
                  'Monte o produto a partir dos insumos que cada unidade consome e veja o preço enquanto preenche.',
              }
            : {})}
        />
        {product !== undefined && !product.isActive ? (
          <Callout tone="warning">
            Este produto está descontinuado
            {product.discontinuedAt === null
              ? ''
              : ` desde ${formatDateTime(product.discontinuedAt)}`}
            . Ele não aparece em vendas novas, mas continua no histórico. Reative para voltar a
            vendê-lo.
          </Callout>
        ) : null}
      </div>

      {sideBySide ? null : resultPanel('summary')}

      <div className={sideBySide ? 'grid grid-cols-[minmax(0,1fr)_22rem] items-start gap-8' : ''}>
        <div className="flex min-w-0 flex-col gap-6">
          <form
            noValidate
            onSubmit={(event) => void handleSubmit(save)(event)}
            className="flex min-w-0 flex-col gap-6"
          >
            <FormSection title="Dados do produto">
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Nome do produto"
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
                name="description"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Descrição (opcional)"
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

              <div className="flex flex-col gap-2">
                <span className="text-foreground text-sm font-medium">Foto (opcional)</span>
                {product === undefined ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <PhotoButton
                      label={photo === null ? 'Escolher foto' : 'Trocar foto'}
                      onPick={setPhoto}
                      disabled={pending}
                    />
                    {photo === null ? null : (
                      <>
                        <span className="text-muted-foreground min-w-0 truncate text-sm">
                          {photo.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                          onClick={() => setPhoto(null)}
                        >
                          Remover
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <ImageWithPlaceholder
                      src={product.imageUrl}
                      alt={product.name}
                      className="size-20"
                    />
                    <PhotoButton
                      label={product.imageUrl === null ? 'Adicionar foto' : 'Trocar foto'}
                      disabled={imageBusy}
                      onPick={(file) =>
                        upload.mutate(
                          { id: product.id, file },
                          {
                            onSuccess: () => toast.success('Foto atualizada.'),
                            onError: showErrorToast,
                          },
                        )
                      }
                    />
                    {product.imageUrl === null ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={imageBusy}
                        className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                        onClick={() => setConfirmingPhotoRemoval(true)}
                      >
                        Remover foto
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection
              title="Itens da ficha"
              description="O que cada unidade do produto consome de cada insumo, na unidade em que o insumo é gasto."
            >
              <BomItemsEditor
                control={control}
                setValue={setValue}
                lines={fields}
                materials={materials}
                lineCosts={preview.lineCosts}
                disabled={pending}
                onAdd={(line) => append(line)}
                onRemove={remove}
              />
            </FormSection>

            <FormSection
              title="Custos e preço"
              description="A margem é aplicada sobre o custo total. Com um preço manual, ele vale no lugar do sugerido."
            >
              <Controller
                control={control}
                name="fixedOperationalCost"
                render={({ field, fieldState }) => (
                  <MoneyField
                    label="Custo fixo por unidade"
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
                name="profitMargin"
                render={({ field, fieldState }) => (
                  <MarginField
                    label="Margem de lucro"
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
                name="manualPrice"
                render={({ field, fieldState }) => (
                  <MoneyField
                    label="Preço manual (opcional)"
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <p className="text-muted-foreground text-xs text-pretty">
                Deixe o preço manual em branco para vender pelo preço sugerido.
              </p>
            </FormSection>

            {formError === undefined ? null : (
              <Callout tone="danger" alert>
                {formError}
              </Callout>
            )}

            {/* Only the buttons float: no card around them, so the form is not covered by a bar. */}
            <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-5 flex flex-row gap-2 sm:justify-end [&>*]:flex-1 [&>*]:shadow-md sm:[&>*]:flex-none">
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigate('..', { relative: 'path' })}
                disabled={pending}
              >
                {editing ? 'Voltar' : 'Cancelar'}
              </Button>
              <Button type="submit" disabled={pending || (editing && !formState.isDirty)}>
                {pending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Salvar ficha técnica'}
              </Button>
            </div>
          </form>

          {product === undefined ? null : (
            <FormSection title="Ciclo de vida">
              <ProductLifecycleActions
                product={product}
                disabled={pending}
                onDeleted={() => {
                  allowLeaving();
                  void navigate('..', { relative: 'path', replace: true });
                }}
              />
            </FormSection>
          )}
        </div>

        {sideBySide ? (
          <aside className="sticky top-24 flex flex-col gap-4">{resultPanel('side')}</aside>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmingPhotoRemoval}
        onOpenChange={setConfirmingPhotoRemoval}
        title={`Remover a foto de ${product?.name ?? 'este produto'}?`}
        description="O produto fica sem foto até você enviar outra. Não dá para desfazer: a foto removida não pode ser recuperada."
        confirmLabel="Remover foto"
        destructive
        pending={removeImage.isPending}
        onConfirm={() => {
          if (product === undefined) {
            return;
          }

          removeImage.mutate(product.id, {
            onSuccess: () => {
              toast.success('Foto removida.');
              setConfirmingPhotoRemoval(false);
            },
            onError: (error) => {
              setConfirmingPhotoRemoval(false);
              showErrorToast(error);
            },
          });
        }}
      />

      <UnsavedChangesDialog blocker={blocker} what="as alterações desta ficha técnica" />
    </div>
  );
}

interface PhotoUploadFailedProps {
  failure: SavedWithoutPhoto;
  retrying: boolean;
  onRetry: (file: File) => void;
  onDone: () => void;
}

/**
 * The product was saved and its photo was not. The registration is never undone
 * for that: this says so, says why in the same words the API gave, and offers
 * the same file again, another one, or finishing without a photo.
 */
function PhotoUploadFailed({ failure, retrying, onRetry, onDone }: PhotoUploadFailedProps) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <PageHeader eyebrow="Fichas técnicas" title="Ficha técnica cadastrada" />
      <Callout tone="warning" alert>
        <strong>{failure.product.name}</strong> foi cadastrada, mas a foto não foi enviada. O
        cadastro está salvo e você não precisa refazê-lo.
      </Callout>
      <UnexpectedError error={failure.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => onRetry(failure.file)} disabled={retrying}>
          {retrying ? 'Enviando…' : 'Tentar de novo'}
        </Button>
        <PhotoButton label="Escolher outra foto" onPick={onRetry} disabled={retrying} />
        <Button type="button" variant="outline" onClick={onDone} disabled={retrying}>
          Concluir sem foto
        </Button>
      </div>
    </div>
  );
}
