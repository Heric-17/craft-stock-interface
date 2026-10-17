import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { QUERY_ROOTS } from '@/shared/api/query-roots';

import { toImportedInvoice } from '../model/imported-invoice';

import { invoiceKeys } from './invoice-keys';
import { postInvoiceImport, postInvoiceReprocess } from './invoice-requests';

/**
 * Both ways of reading a note end the same way, and the queue changes on every
 * outcome — not only on success:
 *
 * - **Always, the queue.** Importing queues a capture before it reads anything,
 *   so a failure leaves a row behind in the state it failed in, and a duplicate
 *   closes the capture against the purchase that already exists.
 * - **On success, the purchases and the spending.** A note that was read is a
 *   purchase, and it enters the spending panel with every line as a company
 *   expense until it is classified. Materials are untouched: the stock only
 *   moves when the classification is concluded.
 */
async function invalidateQueue(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
}

async function invalidateNewPurchase(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.purchases] }),
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.spending] }),
  ]);
}

/**
 * Captures a QR Code URL and imports the note behind it. Nothing is optimistic:
 * the answer is whatever the portal gave the API, and the screen waits for it.
 */
export function useImportInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (url: string) => toImportedInvoice(await postInvoiceImport(url)),
    onSuccess: () => invalidateNewPurchase(queryClient),
    onSettled: () => invalidateQueue(queryClient),
  });
}

/** Picks a capture of the queue up again, typically one parked because the portal was down. */
export function useReprocessInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pendingInvoiceId: string) =>
      toImportedInvoice(await postInvoiceReprocess(pendingInvoiceId)),
    onSuccess: () => invalidateNewPurchase(queryClient),
    onSettled: () => invalidateQueue(queryClient),
  });
}
