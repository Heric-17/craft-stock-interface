import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useCompositeProducts } from '@/features/composite-products';
import { useMaterials } from '@/features/materials';

import { toSalesDataset } from '../model/sales-metrics';
import { NO_CATALOG_IMAGES, toSale, toSalePage, type CatalogImages } from '../model/sale';

import { saleKeys, type SaleFilters, type SalesDatasetFilters } from './sale-keys';
import { fetchSale, fetchSales, fetchSalesDataset } from './sale-requests';

/**
 * The photos of the products and materials a sale can hold. Nothing waits for
 * them: until they arrive, a line shows the reserved space instead of a photo.
 * Discontinued ones are included, since an old sale may hold one.
 */
export function useCatalogImages(): CatalogImages {
  const products = useCompositeProducts({ includeDiscontinued: true });
  const materials = useMaterials({ includeDiscontinued: true });

  return useMemo(
    () =>
      products.data === undefined && materials.data === undefined
        ? NO_CATALOG_IMAGES
        : {
            products: new Map(
              (products.data ?? []).map((product) => [product.id, product.imageUrl]),
            ),
            materials: new Map(
              (materials.data ?? []).map((material) => [material.id, material.imageUrl]),
            ),
          },
    [products.data, materials.data],
  );
}

/**
 * One page of the sales history, as the API filters it: the two status axes are
 * its parameters, and `total` is the size of the filtered set. The previous
 * page stays on screen while the next one loads.
 */
export function useSales(filters: SaleFilters) {
  return useQuery({
    queryKey: saleKeys.list(filters),
    queryFn: ({ signal }) => fetchSales(filters, signal),
    placeholderData: keepPreviousData,
    select: toSalePage,
  });
}

/** One sale by id. The cache keeps the API's own answer, read into the view model on the way out. */
export function useSale(id: string) {
  return useQuery({
    queryKey: saleKeys.detail(id),
    queryFn: ({ signal }) => fetchSale(id, signal),
    select: toSale,
  });
}

/**
 * The dataset behind the cards: cells by month and by status, plus the sales
 * still open whatever their date. The figures are derived from it in
 * `model/sales-metrics.ts`, and never from the rows of the paginated list.
 */
export function useSalesDataset(filters: SalesDatasetFilters) {
  return useQuery({
    queryKey: saleKeys.dataset(filters),
    queryFn: async ({ signal }) => toSalesDataset(await fetchSalesDataset(filters, signal)),
  });
}
