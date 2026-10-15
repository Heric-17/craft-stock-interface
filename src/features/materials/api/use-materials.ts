import { keepPreviousData, useQuery } from '@tanstack/react-query';

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
 * Each loss comes with the unit of its material, so the quantity is read as it
 * arrives and the list depends on nothing but its own request. The previous
 * page stays on screen while the next loads.
 */
export function useStockLosses(filters: StockLossFilters) {
  return useQuery({
    queryKey: materialKeys.lossList(filters),
    queryFn: async ({ signal }) => toStockLossPage(await fetchStockLosses(filters, signal)),
    placeholderData: keepPreviousData,
  });
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
