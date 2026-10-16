/**
 * The two axes of a sale, kept apart everywhere: whether it was paid says
 * nothing about whether it was made, and the other way round. There is no
 * combined "status" anywhere in this feature, in a type, a filter or a badge.
 */

export const PAYMENT_STATUSES = ['PENDING', 'PAID'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PRODUCTION_STATUSES = ['PENDING', 'ASSEMBLED', 'DELIVERED'] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isProductionStatus(value: string): value is ProductionStatus {
  return (PRODUCTION_STATUSES as readonly string[]).includes(value);
}
