import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/shared/api/api-error';
import { invalidateStockDependents } from '@/shared/api/invalidate-stock-dependents';
import { QUERY_ROOTS } from '@/shared/api/query-roots';

import { toImportedInvoice } from '../model/imported-invoice';

import { invoiceKeys } from './invoice-keys';
import type { ClassificationRequestDto } from './invoice.dto';
import { postClassification, postInvoiceImport, postInvoiceReprocess } from './invoice-requests';

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

/**
 * Concludes the classification of a note: one request carrying every line and
 * the way the discount is spread. It is the only moment anything is written,
 * because the same request that classifies a stock line also gives its entry,
 * and sending it twice would give the entry twice.
 *
 * What it invalidates, and why:
 *
 * - **Invoices and purchases.** The queue and the history show the note, and the
 *   purchase read by this very screen has new classifications and a new discount.
 * - **Materials, composite products and shortages.** A stock line raises a stock,
 *   can raise a package cost and can create a material, and every product that
 *   uses one of them has a different cost, price and capacity at the next read.
 * - **Spending.** Which lines are company expenses, and what the discount took
 *   off each, is what the spending panel adds up.
 *
 * Nothing is optimistic: the API decides, and the screen waits.
 */
export function useClassifyPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ purchaseId, body }: { purchaseId: string; body: ClassificationRequestDto }) =>
      postClassification(purchaseId, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
        queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.purchases] }),
        queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.spending] }),
        invalidateStockDependents(queryClient),
      ]),
    // A refusal writes nothing, so there is nothing to refresh — except what the
    // refusal itself says was out of date: a pending attribution the screen had
    // not seen yet, or a material that was deleted since the list was read.
    onError: async (error) => {
      if (!isApiError(error)) {
        return;
      }

      if (error.code === 'PENDING_DISCOUNT_ALLOCATION') {
        await queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.purchases] });
      } else if (error.code === 'MATERIAL_NOT_FOUND') {
        await queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.materials] });
      }
    },
  });
}
