import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { QUERY_ROOTS } from '@/shared/api/query-roots';

import { toCompositeProduct } from '../model/composite-product';

import { compositeProductKeys } from './composite-product-keys';
import {
  deleteCompositeProduct,
  deleteCompositeProductImage,
  patchCompositeProduct,
  postCompositeProduct,
  postCompositeProductImage,
  postDiscontinue,
  postReactivate,
} from './composite-product-requests';
import type {
  CompositeProductDto,
  CreateCompositeProductRequestDto,
  UpdateCompositeProductRequestDto,
} from './composite-product.dto';

/**
 * Every mutation here invalidates the same two things: the composite products
 * and the shortage list.
 *
 * The backend derives cost, suggested price and production capacity at read
 * time, so a product's list row and detail both come from it again. The
 * shortage list is derived from the open sales and what their products
 * consume, so a changed bill of materials — or a product taken out of use — is
 * a change to what is missing. The materials are **not** invalidated: nothing
 * here touches a material's own cost, stock or state.
 *
 * None of it is applied optimistically. The server calculates; the screen
 * waits for it, and the product it answers with is what the detail shows.
 */
async function invalidateProductDependents(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.compositeProducts] }),
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.shortages] }),
  ]);
}

/**
 * The answer is written into the detail's cache before the refetch: it is the
 * server's own answer, not a guess, and it lets the editor that opens next show
 * the saved product without a skeleton in between.
 */
function keepAnswer(queryClient: QueryClient, dto: CompositeProductDto) {
  const product = toCompositeProduct(dto);
  queryClient.setQueryData(compositeProductKeys.detail(product.id), product);

  return product;
}

/** Registers a product with its bill of materials. The photo is a second call. */
export function useCreateCompositeProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateCompositeProductRequestDto) =>
      keepAnswer(queryClient, await postCompositeProduct(body)),
    onSuccess: () => invalidateProductDependents(queryClient),
  });
}

/**
 * Edits a product. Sends only what changed, and the bill of materials only when
 * it did: it replaces the bill whole, and the API refuses it while a line
 * points at a discontinued material.
 */
export function useUpdateCompositeProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateCompositeProductRequestDto }) =>
      keepAnswer(queryClient, await patchCompositeProduct(id, patch)),
    onSuccess: () => invalidateProductDependents(queryClient),
  });
}

export function useDiscontinueCompositeProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => keepAnswer(queryClient, await postDiscontinue(id)),
    onSuccess: () => invalidateProductDependents(queryClient),
  });
}

export function useReactivateCompositeProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => keepAnswer(queryClient, await postReactivate(id)),
    onSuccess: () => invalidateProductDependents(queryClient),
  });
}

/**
 * A physical delete, allowed only while no sale refers to the product.
 * `ENTITY_IN_USE` is an answer, not a failure: the screen explains what refers
 * to it and offers to discontinue instead.
 *
 * The deleted product's own queries are dropped first, so nothing tries to
 * fetch a record that no longer exists.
 */
export function useDeleteCompositeProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCompositeProduct(id),
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: compositeProductKeys.detail(id) });
      await invalidateProductDependents(queryClient);
    },
  });
}

/** The second call of "create with a photo", and of changing one later. */
export function useUploadCompositeProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) =>
      keepAnswer(queryClient, await postCompositeProductImage(id, file)),
    onSuccess: () => invalidateProductDependents(queryClient),
  });
}

export function useRemoveCompositeProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      keepAnswer(queryClient, await deleteCompositeProductImage(id)),
    onSuccess: () => invalidateProductDependents(queryClient),
  });
}
