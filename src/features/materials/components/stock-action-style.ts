import { ClipboardCheck, PackageMinus, PackagePlus, type LucideIcon } from 'lucide-react';

import type { StockAdjustmentKind } from '../model/stock-adjustment';

/**
 * What makes the three acts look different from each other: an icon of their
 * own and a tone of their own — something arrived (green), something was lost
 * (red), the count was corrected (blue). The words do the rest, but a person
 * with a bottle in one hand should not have to read to tell a loss from an
 * entry.
 *
 * Theme tokens only, as everywhere: the tone is a class, never a colour.
 */
export const STOCK_ACTION_STYLE: Record<
  StockAdjustmentKind,
  { icon: LucideIcon; tone: string; selected: string }
> = {
  ENTRY: {
    icon: PackagePlus,
    tone: 'bg-success-muted text-success',
    selected: 'border-success ring-success/30 ring-2',
  },
  WRITE_OFF: {
    icon: PackageMinus,
    tone: 'bg-destructive-muted text-destructive',
    selected: 'border-destructive ring-destructive/30 ring-2',
  },
  RECOUNT: {
    icon: ClipboardCheck,
    tone: 'bg-info-muted text-info',
    selected: 'border-info ring-info/30 ring-2',
  },
};

export const STOCK_ACTION_KINDS: readonly StockAdjustmentKind[] = ['ENTRY', 'WRITE_OFF', 'RECOUNT'];
