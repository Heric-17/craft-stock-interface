import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { invalidateStockDependents } from '@/shared/api/invalidate-stock-dependents';
import { QUERY_ROOTS } from '@/shared/api/query-roots';
import type { Quantity } from '@/shared/quantity';

import { toSale } from '../model/sale';
import type { PaymentStatus, ProductionStatus } from '../model/status';

import { saleKeys } from './sale-keys';
import {
  deleteSaleItem,
  patchItemQuantity,
  patchPaymentStatus,
  patchProductionStatus,
  patchSaleDetails,
  postSale,
} from './sale-requests';
import type { CreateSaleRequestDto, SaleDto, UpdateSaleDetailsRequestDto } from './sale.dto';

/**
 * Nothing here is applied optimistically. A sale's total, its state and the
 * stock behind it are the server's to calculate; the screen waits for the
 * answer, and that answer is what it shows.
 *
 * The answer is written into the detail's cache before the refetch: it is the
 * server's own, not a guess, and the screen that opens next shows the saved
 * sale without a skeleton in between. The cache keeps the DTO, so the units of
 * the materials are applied by the query that reads it.
 */
function keepAnswer(queryClient: QueryClient, dto: SaleDto) {
  queryClient.setQueryData(saleKeys.detail(dto.id), dto);

  return toSale(dto);
}

/**
 * What changes only the sale itself — who it is for, how it is paid, whether it
 * was paid. The sales root covers the history, the detail and the cards, which
 * are cells of a dataset that this sale is one of.
 */
async function invalidateSale(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.sales] });
}

/**
 * What changes which items a sale has: a new sale, a different quantity, a
 * removed line. The shortage list is derived from what the open sales consume,
 * so it is read again along with the sales. The materials themselves do not
 * move — nothing is debited until the sale is assembled.
 */
async function invalidateSaleNeeds(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.sales] }),
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.shortages] }),
  ]);
}

/**
 * Assembling a sale debits the stock of the materials it consumes, and going
 * back to pending returns it. That is a change to every material involved, so
 * to the cost, capacity and bottleneck of every product that uses them, and to
 * what is missing: the sales, the materials, the products and the shortages.
 */
async function invalidateProduction(queryClient: QueryClient): Promise<void> {
  await Promise.all([invalidateSale(queryClient), invalidateStockDependents(queryClient)]);
}

/** Registers a sale with its items. The total comes back from the API. */
export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateSaleRequestDto) => keepAnswer(queryClient, await postSale(body)),
    onSuccess: () => invalidateSaleNeeds(queryClient),
  });
}

/** The customer, the contact and the payment method. The API only accepts it while production is pending. */
export function useUpdateSaleDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateSaleDetailsRequestDto }) =>
      keepAnswer(queryClient, await patchSaleDetails(id, patch)),
    onSuccess: () => invalidateSale(queryClient),
  });
}

/** A different quantity for one line. The price it was frozen with does not change. */
export function useUpdateSaleItemQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saleId,
      itemId,
      quantity,
    }: {
      saleId: string;
      itemId: string;
      quantity: Quantity;
    }) => keepAnswer(queryClient, await patchItemQuantity(saleId, itemId, quantity.toApiNumber())),
    onSuccess: () => invalidateSaleNeeds(queryClient),
  });
}

export function useRemoveSaleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, itemId }: { saleId: string; itemId: string }) =>
      keepAnswer(queryClient, await deleteSaleItem(saleId, itemId)),
    onSuccess: () => invalidateSaleNeeds(queryClient),
  });
}

/**
 * Paid or not. It has no effect on the stock, and is independent of the
 * production axis: this mutation never sends, and never reads, the other one.
 */
export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, paymentStatus }: { id: string; paymentStatus: PaymentStatus }) =>
      keepAnswer(queryClient, await patchPaymentStatus(id, paymentStatus)),
    onSuccess: () => invalidateSale(queryClient),
  });
}

/**
 * Pending, assembled or delivered. Independent of payment, but not of the
 * stock: see {@link invalidateProduction}.
 */
export function useUpdateProductionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      productionStatus,
    }: {
      id: string;
      productionStatus: ProductionStatus;
    }) => keepAnswer(queryClient, await patchProductionStatus(id, productionStatus)),
    onSuccess: () => invalidateProduction(queryClient),
  });
}
