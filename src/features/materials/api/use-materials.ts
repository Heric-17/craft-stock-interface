import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { toInventorySummary, toMaterial, toPriceHistory } from '../model/material';
import { toStockLossDataset, toStockLossPage } from '../model/stock-loss';

import {
  materialKeys,
  type InventorySummaryFilters,
  type MaterialFilters,
  type StockLossDatasetFilters,
  type StockLossFilters,
} from './material-keys';
import {
  fetchInventorySummary,
  fetchMaterial,
  fetchMaterials,
  fetchPriceHistory,
  fetchStockLossDataset,
  fetchStockLosses,
} from './material-requests';

/**
 * The list of materials, as the API filters it: `name` is its search and
 * `includeDiscontinued` its switch. The list is a bounded set that comes back
 * whole, so counting its items is fine — adding up money from it is not, and
 * the cards read `useInventorySummary` for that.
 *
 * The previous answer stays on screen while a new search loads, so typing does
 * not flash the whole table into a skeleton on every pause.
 */
export function useMaterials(filters: MaterialFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: materialKeys.list(filters),
    queryFn: async ({ signal }) => (await fetchMaterials(filters, signal)).map(toMaterial),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** One material by id. The API answers for a discontinued one too. */
export function useMaterial(id: string | null) {
  return useQuery({
    queryKey: materialKeys.detail(id ?? ''),
    queryFn: async ({ signal }) => toMaterial(await fetchMaterial(id ?? '', signal)),
    enabled: id !== null,
  });
}

/** Each change of a package cost, with where it came from. */
export function usePriceHistory(id: string | null) {
  return useQuery({
    queryKey: materialKeys.priceHistory(id ?? ''),
    queryFn: async ({ signal }) => toPriceHistory(await fetchPriceHistory(id ?? '', signal)),
    enabled: id !== null,
  });
}

/**
 * The three figures of the cards. The backend adds them up — over every
 * material, rounding the value of each one before summing — so this screen
 * never does it from the rows it has.
 */
export function useInventorySummary(filters: InventorySummaryFilters) {
  return useQuery({
    queryKey: materialKeys.summary(filters),
    queryFn: async ({ signal }) => toInventorySummary(await fetchInventorySummary(filters, signal)),
  });
}

/**
 * One page of the loss history, as the API filters it: period, material and
 * reason are its parameters, and `total` is the size of the filtered set.
 *
 * A loss does not say which unit its material is measured in, so the quantity
 * is read with the unit of the material it names, from the list of every
 * material (discontinued ones too: a loss outlives the discontinuation). The
 * answer comes only when both are in, so a row never shows a quantity without
 * its unit. The previous page stays on screen while the next loads.
 */
export function useStockLosses(filters: StockLossFilters) {
  const losses = useQuery({
    queryKey: materialKeys.lossList(filters),
    queryFn: ({ signal }) => fetchStockLosses(filters, signal),
    placeholderData: keepPreviousData,
  });
  const materials = useMaterials({ includeDiscontinued: true });

  const page = useMemo(() => {
    if (losses.data === undefined || materials.data === undefined) {
      return undefined;
    }

    const units = new Map(
      materials.data.map((material) => [material.id, material.consumptionUnit]),
    );

    return toStockLossPage(losses.data, (materialId) => units.get(materialId));
  }, [losses.data, materials.data]);

  return {
    page,
    materials: materials.data,
    isPending: losses.isPending || materials.isPending,
    isFetching: losses.isFetching || materials.isFetching,
    isError: losses.isError || materials.isError,
    error: losses.error ?? materials.error,
    refetch: () => Promise.all([losses.refetch(), materials.refetch()]),
  };
}

/**
 * The period's dataset: by month, by reason and by material. How much was lost
 * comes from here and never from adding up the pages of the list.
 */
export function useStockLossDataset(filters: StockLossDatasetFilters) {
  return useQuery({
    queryKey: materialKeys.lossDataset(filters),
    queryFn: async ({ signal }) => toStockLossDataset(await fetchStockLossDataset(filters, signal)),
  });
}
