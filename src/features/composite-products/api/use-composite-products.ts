import { useQuery } from '@tanstack/react-query';

import { toCompositeProduct } from '../model/composite-product';

import { compositeProductKeys, type CompositeProductFilters } from './composite-product-keys';
import { fetchCompositeProduct, fetchCompositeProducts } from './composite-product-requests';

/**
 * The list of products, as the API filters it: `includeDiscontinued` is the
 * one parameter it accepts. The list is a bounded set that comes back whole,
 * so counting its items is fine.
 */
export function useCompositeProducts(filters: CompositeProductFilters) {
  return useQuery({
    queryKey: compositeProductKeys.list(filters),
    queryFn: async ({ signal }) =>
      (await fetchCompositeProducts(filters, signal)).map(toCompositeProduct),
  });
}

/** One product by id. The API answers for a discontinued one too. */
export function useCompositeProduct(id: string | null) {
  return useQuery({
    queryKey: compositeProductKeys.detail(id ?? ''),
    queryFn: async ({ signal }) =>
      toCompositeProduct(await fetchCompositeProduct(id ?? '', signal)),
    enabled: id !== null,
  });
}
