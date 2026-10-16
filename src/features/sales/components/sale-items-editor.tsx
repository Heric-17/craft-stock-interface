import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';

import type { CompositeProduct } from '@/features/composite-products';
import type { Material } from '@/features/materials';
import { formatCount, formatMoney, formatQuantity, formatUnitCost } from '@/shared/format';
import type { Money } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { CatalogPickerSheet, type CatalogOption } from '@/shared/ui/catalog-picker-sheet';
import { FigureTile } from '@/shared/ui/figure-tile';
import { ImageWithPlaceholder } from '@/shared/ui/image-with-placeholder';
import { MarginField } from '@/shared/ui/margin-field';
import { QuantityField } from '@/shared/ui/quantity-field';
import { ScaledQuantityField } from '@/shared/ui/scaled-quantity-field';
import { StatusBadge } from '@/shared/ui/status-badge';

import {
  newMaterialLine,
  newProductLine,
  type SaleFormValues,
  type SaleLineFormValues,
  type SaleLineKind,
} from '../model/sale-form';

interface SaleItemsEditorProps {
  control: Control<SaleFormValues>;
  setValue: UseFormSetValue<SaleFormValues>;
  /** The lines as the form array holds them, with the key it gave each. */
  lines: readonly (SaleLineFormValues & { id: string })[];
  /** Active products only: a discontinued one is not offered for a new sale. */
  products: readonly CompositeProduct[];
  /** Active materials only, for the same reason. */
  materials: readonly Material[];
  /** The preview's value for each line, in the same order. */
  lineTotals: readonly (Money | null)[];
  /** The list-level error: a sale with no item. */
  error?: string | undefined;
  disabled: boolean;
  onAdd: (line: SaleLineFormValues) => void;
  onRemove: (index: number) => void;
}

function compareNames(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR');
}

function productOption(product: CompositeProduct): CatalogOption {
  const canMake = product.productionCapacity > 0;

  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    group: 'PRODUCT',
    badges: canMake ? undefined : <StatusBadge tone="danger">Não dá para produzir</StatusBadge>,
    facts: [
      {
        label: 'Preço de venda',
        emphasis: true,
        value: <span className="whitespace-nowrap">{formatMoney(product.finalPrice)}</span>,
      },
      {
        label: 'Dá para produzir',
        value: (
          <span className="whitespace-nowrap">
            {product.productionCapacity === 1
              ? '1 unidade'
              : `${formatCount(product.productionCapacity)} unidades`}
          </span>
        ),
      },
    ],
  };
}

function materialOption(material: Material): CatalogOption {
  return {
    id: material.id,
    name: material.name,
    imageUrl: material.imageUrl,
    group: 'MATERIAL',
    badges: material.lowStock ? <StatusBadge tone="warning">Estoque baixo</StatusBadge> : undefined,
    facts: [
      {
        label: 'Custo fracionado',
        emphasis: true,
        value: (
          <span className="whitespace-nowrap">
            {formatUnitCost(material.unitCost, material.consumptionUnit)}
          </span>
        ),
      },
      {
        label: 'Em estoque',
        value: <span className="whitespace-nowrap">{formatQuantity(material.stockQuantity)}</span>,
      },
    ],
  };
}

/**
 * The items of a new sale: a product, or a material sold on its own.
 *
 * The picker offers **active** ones only, and only those not already on the
 * sale — products and loose materials as two tabs of one panel, each with its
 * photo and figures. A loose material asks for a margin that starts empty —
 * zero is a choice that has to be typed — and a product has none, since it
 * carries the margin of its bill of materials.
 */
export function SaleItemsEditor({
  control,
  setValue,
  lines,
  products,
  materials,
  lineTotals,
  error,
  disabled,
  onAdd,
  onRemove,
}: SaleItemsEditorProps) {
  const [picking, setPicking] = useState(false);

  const used = new Set(lines.map((line) => `${line.kind}:${line.refId}`));
  const availableProducts = products
    .filter((product) => product.isActive && !used.has(`PRODUCT:${product.id}`))
    .sort(compareNames);
  const availableMaterials = materials
    .filter((material) => material.isActive && !used.has(`MATERIAL:${material.id}`))
    .sort(compareNames);
  const nothingToAdd = availableProducts.length === 0 && availableMaterials.length === 0;

  const imageOf = (line: SaleLineFormValues): string | null =>
    (line.kind === 'PRODUCT'
      ? products.find((product) => product.id === line.refId)?.imageUrl
      : materials.find((material) => material.id === line.refId)?.imageUrl) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {lines.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm text-pretty">
          Nenhum item ainda. Escolha abaixo um produto ou um insumo para vender.
        </p>
      ) : (
        <ul aria-label="Itens da venda" className="flex flex-col gap-3">
          {lines.map((line, index) => (
            <SaleLineRow
              key={line.id}
              index={index}
              line={line}
              imageUrl={imageOf(line)}
              total={lineTotals[index] ?? null}
              control={control}
              setValue={setValue}
              disabled={disabled}
              onRemove={() => onRemove(index)}
            />
          ))}
        </ul>
      )}

      {error === undefined ? null : (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || nothingToAdd}
          onClick={() => setPicking(true)}
        >
          <Plus aria-hidden="true" />
          Adicionar item
        </Button>
        <p className="text-muted-foreground text-xs text-pretty">
          {nothingToAdd
            ? 'Todos os produtos e insumos ativos já estão na venda, ou ainda não há nenhum cadastrado.'
            : 'Só aparecem produtos e insumos ativos que ainda não estão na venda.'}
        </p>
      </div>

      <CatalogPickerSheet
        open={picking}
        onOpenChange={setPicking}
        title="Adicionar item à venda"
        description="Escolha um produto ou um insumo para vender."
        searchLabel="Buscar item"
        searchPlaceholder="Buscar pelo nome…"
        listLabel="Itens disponíveis"
        groups={[
          { id: 'PRODUCT', label: 'Produtos' },
          { id: 'MATERIAL', label: 'Insumos avulsos' },
        ]}
        options={[
          ...availableProducts.map(productOption),
          ...availableMaterials.map(materialOption),
        ]}
        nothingToPick={{
          title: 'Nada para adicionar',
          description:
            'Todos os produtos e insumos ativos já estão na venda, ou ainda não há nenhum cadastrado.',
        }}
        noun={{ one: 'item', many: 'itens' }}
        onPick={(option) => {
          const kind = option.group as SaleLineKind | undefined;

          if (kind === 'PRODUCT') {
            const picked = availableProducts.find((product) => product.id === option.id);

            if (picked !== undefined) {
              onAdd(newProductLine(picked));
            }
          } else if (kind === 'MATERIAL') {
            const picked = availableMaterials.find((material) => material.id === option.id);

            if (picked !== undefined) {
              onAdd(newMaterialLine(picked));
            }
          }
        }}
      />
    </div>
  );
}

interface SaleLineRowProps {
  index: number;
  line: SaleLineFormValues;
  imageUrl: string | null;
  total: Money | null;
  control: Control<SaleFormValues>;
  setValue: UseFormSetValue<SaleFormValues>;
  disabled: boolean;
  onRemove: () => void;
}

function SaleLineRow({
  index,
  line,
  imageUrl,
  total,
  control,
  setValue,
  disabled,
  onRemove,
}: SaleLineRowProps) {
  const scale = useWatch({ control, name: `items.${index}.scale` });
  const isMaterial = line.kind === 'MATERIAL';

  return (
    <li className="border-border bg-muted/40 @container flex flex-col gap-4 rounded-xl border p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <ImageWithPlaceholder
          src={imageUrl}
          alt={line.name}
          className="size-20 rounded-xl sm:size-24"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-foreground text-base leading-snug font-semibold text-balance">
            {line.name}
          </p>
          <div>
            <StatusBadge tone={isMaterial ? 'info' : 'neutral'}>
              {isMaterial ? 'Insumo avulso' : 'Produto'}
            </StatusBadge>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remover ${line.name} da venda`}
          disabled={disabled}
          onClick={onRemove}
          className="text-destructive hover:bg-destructive-muted hover:text-destructive -mt-1 -mr-1 shrink-0"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      {/* The fields, and the value they make, side by side once the card is wide enough. */}
      <div className="grid gap-4 @[34rem]:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex flex-col gap-4">
          <Controller
            control={control}
            name={`items.${index}.quantity`}
            render={({ field, fieldState }) =>
              isMaterial ? (
                <ScaledQuantityField
                  label={`Quantidade de ${line.name}`}
                  unit={line.consumptionUnit}
                  scale={scale}
                  onScaleChange={(next) =>
                    setValue(`items.${index}.scale`, next, { shouldDirty: true })
                  }
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  error={fieldState.error?.message}
                />
              ) : (
                <QuantityField
                  label={`Quantidade de ${line.name}`}
                  unit="UNIT"
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  error={fieldState.error?.message}
                />
              )
            }
          />

          {isMaterial ? (
            <div className="flex flex-col gap-1">
              <Controller
                control={control}
                name={`items.${index}.margin`}
                render={({ field, fieldState }) => (
                  <MarginField
                    label={`Margem sobre ${line.name}`}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={disabled}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <p className="text-muted-foreground text-xs text-pretty">
                Percentual somado ao custo da embalagem. Digite 0 para vender a preço de custo.
              </p>
            </div>
          ) : null}
        </div>

        <dl className="@[34rem]:content-start">
          <FigureTile label="Valor do item (prévia)" tone="primary">
            {total === null ? '—' : formatMoney(total)}
          </FigureTile>
        </dl>
      </div>
    </li>
  );
}
