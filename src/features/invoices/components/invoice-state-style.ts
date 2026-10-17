import {
  CircleCheck,
  CloudOff,
  Hourglass,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import type { StatusTone } from '@/shared/ui/status-badge';

import type { InvoiceState } from '../model/pending-invoice';

/**
 * How each state of a note looks: an icon and a colour, so that a row can be
 * read at a glance and not only by reading its seal. The colour is a theme
 * tone, never a literal.
 */
export const INVOICE_STATE_TONES: Record<InvoiceState, StatusTone> = {
  PROCESSING: 'info',
  STALLED: 'warning',
  SOURCE_UNAVAILABLE: 'warning',
  STRUCTURE_CHANGED: 'danger',
  IMPORTED: 'success',
};

export const INVOICE_STATE_ICONS: Record<InvoiceState, LucideIcon> = {
  PROCESSING: LoaderCircle,
  STALLED: Hourglass,
  SOURCE_UNAVAILABLE: CloudOff,
  STRUCTURE_CHANGED: TriangleAlert,
  IMPORTED: CircleCheck,
};

/** The colours of the icon's tile, one per tone. */
export const INVOICE_TILE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-destructive-muted text-destructive',
  info: 'bg-info-muted text-info',
};
