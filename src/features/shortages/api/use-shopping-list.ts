import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useMaterials } from '@/features/materials';

import { toMaterialPackages, toShoppingList, type MaterialPackages } from '../model/shopping-list';

import { shortageKeys } from './shortage-keys';
import { fetchShoppingList } from './shortage-requests';

/**
 * What is missing for a set of sales, as the API works it out. The ids are
 * sorted so the same set is the same cache entry whatever order it was picked
 * in, and nothing is asked while the set is empty: the API refuses it.
 *
 * The previous answer stays on screen while a new set loads, so ticking a sale
 * does not flash the whole table into a skeleton.
 *
 * Nothing in the answer is worked out on this side — not the packages, not the
 * estimate, not the total.
 */
export function useShoppingList(saleIds: readonly string[]) {
  const ids = useMemo(() => [...saleIds].sort(), [saleIds]);

  return useQuery({
    queryKey: shortageKeys.list({ saleIds: ids }),
    queryFn: async ({ signal }) =>
      toShoppingList(await fetchShoppingList({ saleIds: ids }, signal)),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * The photo and the package of each material, from the material list. A line of
 * the shopping list carries neither: it says *how many* packages, and what one
 * of them is — "1 kg" — lives on the material. Discontinued ones are included,
 * since an open sale may still need one.
 *
 * Nothing waits for it: until it arrives a line shows the reserved space for
 * the photo and says "2 embalagens" without the size.
 */
export function useMaterialPackages(): ReadonlyMap<string, MaterialPackages> {
  const materials = useMaterials({ includeDiscontinued: true });

  return useMemo(() => toMaterialPackages(materials.data ?? []), [materials.data]);
}
