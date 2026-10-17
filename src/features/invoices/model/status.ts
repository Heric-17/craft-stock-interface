/** What the queue says about a capture, as the API names it. */
export const PENDING_INVOICE_STATUSES = ['PENDING', 'UNSTABLE', 'IMPORTED'] as const;

export type PendingInvoiceStatus = (typeof PENDING_INVOICE_STATUSES)[number];

export function isPendingInvoiceStatus(value: string): value is PendingInvoiceStatus {
  return (PENDING_INVOICE_STATUSES as readonly string[]).includes(value);
}
