import type { QueryClient } from '@tanstack/react-query';

import { QUERY_ROOTS } from './query-roots';

/**
 * Everything that is read from a `Material` and has to be read again after one
 * changes: the materials themselves, the composite products that use them and
 * the shortage list.
 *
 * The backend derives cost, suggested price, production capacity, bottleneck
 * and "needs buying" at read time. So a new package cost, a stock entry, a
 * discontinuation or a photo is a change to every product whose bill of
 * materials mentions the material, and the screens that show those figures
 * must not keep answering from the cache.
 *
 * Resolves when the queries that are on screen have refetched, so a mutation
 * that awaits it does not report success while the list still shows the old
 * number.
 */
export async function invalidateStockDependents(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.materials] }),
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.compositeProducts] }),
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.shortages] }),
  ]);
}
