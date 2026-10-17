import { useState } from 'react';

import { imageOfItem, shortSaleId, type CatalogImages, type Sale } from '@/features/sales';
import { formatDateTime, formatQuantity } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { PhotoMosaic } from '@/shared/ui/photo-mosaic';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';

import { salesCountText } from '../model/labels';

interface SalesPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every sale with production pending: what there is to choose from. */
  sales: readonly Sale[];
  /** The ids ticked right now. */
  selectedIds: readonly string[];
  images: CatalogImages;
  onApply: (ids: ReadonlySet<string>) => void;
}

/** How many items a sale names before "e mais". */
const NAMES_SHOWN = 3;

/**
 * Which of the open orders the shopping list is built from. The ticks are a
 * draft until "Usar" is pressed, so ticking three sales is one request for the
 * list and not three; closing the panel any other way leaves the choice as it was.
 */
export function SalesPickerSheet({
  open,
  onOpenChange,
  sales,
  selectedIds,
  images,
  onApply,
}: SalesPickerSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Escolher as vendas da lista"
      width="wide"
    >
      <PickerBody
        sales={sales}
        initial={selectedIds}
        images={images}
        onApply={(ids) => {
          onApply(ids);
          onOpenChange(false);
        }}
        onCancel={() => onOpenChange(false)}
      />
    </ResponsiveSheet>
  );
}

function PickerBody({
  sales,
  initial,
  images,
  onApply,
  onCancel,
}: {
  sales: readonly Sale[];
  initial: readonly string[];
  images: CatalogImages;
  onApply: (ids: ReadonlySet<string>) => void;
  onCancel: () => void;
}) {
  // The body is mounted when the panel opens, so each opening starts from the
  // choice that is in force and not from a draft somebody abandoned.
  const [draft, setDraft] = useState<ReadonlySet<string>>(() => new Set(initial));

  function toggle(id: string): void {
    setDraft((current) => {
      const next = new Set(current);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });
  }

  return (
    <SheetPanel
      title="Escolher as vendas da lista"
      description="Só entram as vendas com produção pendente: são as que ainda vão usar o estoque."
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button disabled={draft.size === 0} onClick={() => onApply(draft)}>
            {draft.size === 0 ? 'Escolha ao menos uma venda' : `Usar ${salesCountText(draft.size)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraft(new Set(sales.map((sale) => sale.id)))}
        >
          Marcar todas
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDraft(new Set())}>
          Desmarcar todas
        </Button>
      </div>

      <ul aria-label="Vendas com produção pendente" className="flex flex-col gap-3">
        {sales.map((sale) => (
          <li key={sale.id}>
            <SaleOption
              sale={sale}
              images={images}
              checked={draft.has(sale.id)}
              onToggle={() => toggle(sale.id)}
            />
          </li>
        ))}
      </ul>
    </SheetPanel>
  );
}

/**
 * One sale, with the photos of what was sold so the order is recognised at a
 * glance. The names and quantities are the ones frozen on the sale; the photos
 * are how the products look today, and are not part of the name of the tick.
 */
function SaleOption({
  sale,
  images,
  checked,
  onToggle,
}: {
  sale: Sale;
  images: CatalogImages;
  checked: boolean;
  onToggle: () => void;
}) {
  const names = sale.items.slice(0, NAMES_SHOWN);
  const more = sale.items.length - names.length;

  return (
    <label className="border-border bg-card has-checked:border-primary flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="border-input accent-primary mt-1 size-5 shrink-0 rounded"
      />
      <span aria-hidden="true" className="w-20 shrink-0 overflow-hidden rounded-lg">
        <PhotoMosaic
          photos={sale.items.map((item) => ({
            key: item.id,
            src: imageOfItem(item, images),
            alt: item.name,
          }))}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground text-sm font-semibold wrap-break-word">
          {sale.customerName}
        </span>
        <span className="text-muted-foreground text-xs">
          Venda {shortSaleId(sale)} · {formatDateTime(sale.createdAt)}
        </span>
        <span className="text-muted-foreground text-xs text-pretty">
          {names.map((item) => `${item.name} · ${formatQuantity(item.quantity)}`).join(', ')}
          {more > 0 ? ` e mais ${more === 1 ? '1 item' : `${more} itens`}` : ''}
        </span>
      </span>
    </label>
  );
}
