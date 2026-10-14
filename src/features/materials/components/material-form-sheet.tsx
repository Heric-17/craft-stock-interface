import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { isApiError } from '@/shared/api/api-error';
import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { CONSUMPTION_UNITS, isConsumptionUnit } from '@/shared/quantity';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { showErrorToast } from '@/shared/ui/error-toast';
import { MoneyField } from '@/shared/ui/money-field';
import { QuantityField } from '@/shared/ui/quantity-field';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { SelectField } from '@/shared/ui/select-field';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';
import { TextField } from '@/shared/ui/text-field';
import { UnexpectedError } from '@/shared/ui/unexpected-error';

import {
  useCreateMaterial,
  useUpdateMaterial,
  useUploadMaterialImage,
} from '../api/use-material-mutations';
import { CONSUMPTION_UNIT_LABELS } from '../model/labels';
import type { Material } from '../model/material';
import {
  buildCreateRequest,
  buildUpdate,
  EMPTY_MATERIAL_FORM,
  hasChanges,
  materialFormSchema,
  materialFormValuesFrom,
  packageCostChanged,
  readMaterialForm,
  type MaterialFormValues,
} from '../model/material-form';
import { unitLockFromError, unitLockOf, unitLockText, type UnitLock } from '../model/unit-lock';

import { PhotoButton } from './photo-button';

interface MaterialFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The material being edited; absent when registering a new one. */
  material?: Material | undefined;
}

/**
 * Registers a material or edits one. The body mounts when the sheet opens and
 * goes away when it closes, so a form never carries yesterday's typing.
 */
export function MaterialFormSheet({ open, onOpenChange, material }: MaterialFormSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={material === undefined ? 'Novo insumo' : `Editar ${material.name}`}
    >
      <MaterialFormBody material={material} onClose={() => onOpenChange(false)} />
    </ResponsiveSheet>
  );
}

/** A material that was saved while its photo was not. */
interface SavedWithoutPhoto {
  material: Material;
  file: File;
  error: unknown;
}

function MaterialFormBody({
  material,
  onClose,
}: {
  material: Material | undefined;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [lockFromApi, setLockFromApi] = useState<UnitLock | null>(null);
  const [savedWithoutPhoto, setSavedWithoutPhoto] = useState<SavedWithoutPhoto | null>(null);

  const create = useCreateMaterial();
  const update = useUpdateMaterial();
  const upload = useUploadMaterialImage();

  const { control, handleSubmit, setError, setValue, formState } = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: material === undefined ? EMPTY_MATERIAL_FORM : materialFormValuesFrom(material),
  });

  const unitText = useWatch({ control, name: 'consumptionUnit' });
  const scale = useWatch({ control, name: 'packageScale' });
  const costText = useWatch({ control, name: 'packageCost' });
  const unit = isConsumptionUnit(unitText) ? unitText : null;
  const editing = material !== undefined;
  const lock = lockFromApi ?? (material === undefined ? null : unitLockOf(material));
  const pending = create.isPending || update.isPending || upload.isPending;

  async function save(values: MaterialFormValues): Promise<void> {
    const { parsed } = readMaterialForm(values);

    if (parsed === null) {
      return;
    }

    if (material === undefined) {
      await register(buildCreateRequest(parsed));
    } else {
      await edit(buildUpdate(parsed, material), material);
    }
  }

  async function register(request: ReturnType<typeof buildCreateRequest>): Promise<void> {
    let created: Material;

    try {
      created = await create.mutateAsync(request);
    } catch (error) {
      if (!applyApiErrorToForm(error, setError)) {
        showErrorToast(error);
      }

      return;
    }

    if (photo === null) {
      toast.success('Insumo cadastrado.');
      onClose();

      return;
    }

    // The material exists now and stays: a photo that did not go up is not a
    // reason to undo the registration. The panel says so and offers another go.
    try {
      await upload.mutateAsync({ id: created.id, file: photo });
      toast.success('Insumo cadastrado com foto.');
      onClose();
    } catch (error) {
      setSavedWithoutPhoto({ material: created, file: photo, error });
    }
  }

  async function edit(changes: ReturnType<typeof buildUpdate>, original: Material): Promise<void> {
    if (!hasChanges(changes)) {
      onClose();

      return;
    }

    try {
      await update.mutateAsync({ id: original.id, update: changes });
      toast.success('Insumo atualizado.');
      onClose();
    } catch (error) {
      const refused = isApiError(error) ? unitLockFromError(error, original.consumptionUnit) : null;

      if (refused !== null) {
        // The API knew something the screen did not: put the unit back, write
        // the reason beside it, and let the rest of the form be saved again.
        setLockFromApi(refused);
        setValue('consumptionUnit', original.consumptionUnit);

        return;
      }

      if (!applyApiErrorToForm(error, setError)) {
        showErrorToast(error);
      }
    }
  }

  if (savedWithoutPhoto !== null) {
    return (
      <PhotoUploadFailed
        failure={savedWithoutPhoto}
        retrying={upload.isPending}
        onRetry={(file) =>
          upload.mutate(
            { id: savedWithoutPhoto.material.id, file },
            {
              onSuccess: () => {
                toast.success('Foto enviada.');
                onClose();
              },
              onError: (error) => setSavedWithoutPhoto({ ...savedWithoutPhoto, file, error }),
            },
          )
        }
        onDone={onClose}
      />
    );
  }

  const formError = formState.errors.root?.api?.message;

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(save)(event)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <SheetPanel
        title={editing ? 'Editar insumo' : 'Novo insumo'}
        description={
          editing
            ? undefined
            : 'Cadastre o insumo como ele é comprado: a embalagem fechada, com o custo dela.'
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      >
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label="Nome"
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
          name="consumptionUnit"
          render={({ field, fieldState }) => (
            <SelectField
              label="Unidade de consumo"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={lock !== null}
              error={fieldState.error?.message}
              hint={
                lock !== null
                  ? unitLockText(lock)
                  : editing
                    ? 'Não dá para trocar depois que houver estoque ou uso em ficha técnica.'
                    : 'A unidade em que o insumo é gasto nas fichas técnicas. Depois de usada, não troca mais.'
              }
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
          )}
        />

        {unit === null ? null : (
          <Controller
            control={control}
            name="packageQuantity"
            render={({ field, fieldState }) => (
              <ScaledQuantityField
                label="Quanto a embalagem contém"
                unit={unit}
                scale={scale}
                onScaleChange={(next) => setValue('packageScale', next)}
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

        <Controller
          control={control}
          name="packageCost"
          render={({ field, fieldState }) => (
            <MoneyField
              label="Custo da embalagem"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />

        {material !== undefined && packageCostChanged(costText, material) ? (
          <Callout tone="warning">
            Ao salvar um novo custo, todo produto que usa este insumo muda de custo na hora, e a
            alteração fica registrada no histórico de preço.
          </Callout>
        ) : null}

        {unit === null ? null : (
          <Controller
            control={control}
            name="minimumStockAlert"
            render={({ field, fieldState }) => (
              <QuantityField
                label="Estoque mínimo"
                unit={unit}
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

        {editing ? null : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-foreground text-sm font-medium">Foto (opcional)</span>
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
                    <Button type="button" variant="ghost" onClick={() => setPhoto(null)}>
                      Remover
                    </Button>
                  </>
                )}
              </div>
            </div>
            <Callout>
              O estoque começa em zero. Depois de salvar, use “Dar entrada” para registrar o que
              você tem.
            </Callout>
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

interface PhotoUploadFailedProps {
  failure: SavedWithoutPhoto;
  retrying: boolean;
  onRetry: (file: File) => void;
  onDone: () => void;
}

/**
 * The material was saved and its photo was not. The registration is never
 * undone for that: this says so, says why in the same words the API gave, and
 * offers the same file again, another one, or finishing without a photo.
 */
function PhotoUploadFailed({ failure, retrying, onRetry, onDone }: PhotoUploadFailedProps) {
  return (
    <SheetPanel
      title="Insumo cadastrado"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onDone} disabled={retrying}>
            Concluir sem foto
          </Button>
          <Button type="button" onClick={() => onRetry(failure.file)} disabled={retrying}>
            {retrying ? 'Enviando…' : 'Tentar de novo'}
          </Button>
        </>
      }
    >
      <Callout tone="warning" alert>
        <strong>{failure.material.name}</strong> foi cadastrado, mas a foto não foi enviada. O
        cadastro está salvo e você não precisa refazê-lo.
      </Callout>
      <UnexpectedError error={failure.error} />
      <div>
        <PhotoButton label="Escolher outra foto" onPick={onRetry} disabled={retrying} />
      </div>
    </SheetPanel>
  );
}
