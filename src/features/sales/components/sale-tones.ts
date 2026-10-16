import type { StatusTone } from '@/shared/ui/status-badge';

import type { PaymentStatus, ProductionStatus } from '../model/status';

/**
 * What each state looks like. The colour means the same thing on both axes —
 * orange is waiting, blue is on its way, green is done — so a row can be read
 * by colour before it is read by word.
 */
export const PAYMENT_TONES = {
  PENDING: 'warning',
  PAID: 'success',
} as const satisfies Record<PaymentStatus, StatusTone>;

export const PRODUCTION_TONES = {
  PENDING: 'warning',
  ASSEMBLED: 'info',
  DELIVERED: 'success',
} as const satisfies Record<ProductionStatus, StatusTone>;
