import { ClipboardCheck, PackageMinus, PackagePlus, type LucideIcon } from 'lucide-react';

import { formatQuantity } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { buttonVariants } from '@/shared/ui/button-variants';

import { STOCK_ADJUSTMENT_TEXT } from '../model/labels';
import type { Material } from '../model/material';
import type { StockAdjustmentKind } from '../model/stock-adjustment';

const ACTIONS: readonly { kind: StockAdjustmentKind; icon: LucideIcon }[] = [
  { kind: 'ENTRY', icon: PackagePlus },
  { kind: 'WRITE_OFF', icon: PackageMinus },
  { kind: 'RECOUNT', icon: ClipboardCheck },
];

interface StockActionsProps {
  material: Material;
  onAdjust: (kind: StockAdjustmentKind) => void;
  disabled?: boolean;
}

/**
 * The stock of a material and the three ways to change it by hand, side by
 * side and each with its own icon and name: an entry, a write-off and a
 * recount are different acts even though they move the same number.
 *
 * A discontinued material has no stock to change, so it shows none of them.
 */
export function StockActions({ material, onAdjust, disabled = false }: StockActionsProps) {
  return (
    <section aria-labelledby="stock-actions-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="stock-actions-title" className="text-sm font-bold tracking-tight">
          Estoque
        </h3>
        <p className="text-sm">
          <span className="text-muted-foreground">Atual: </span>
          <span className="font-semibold">{formatQuantity(material.stockQuantity)}</span>
        </p>
      </div>

      {material.isActive ? (
        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map(({ kind, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              onClick={() => onAdjust(kind)}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'h-auto min-h-16 flex-col gap-1.5 px-1.5 py-2 text-center leading-tight whitespace-normal',
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              {STOCK_ADJUSTMENT_TEXT[kind].action}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
