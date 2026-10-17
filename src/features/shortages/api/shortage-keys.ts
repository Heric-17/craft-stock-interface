import { QUERY_ROOTS } from '@/shared/api/query-roots';

/** What the shopping list is asked for: the sales it is built from. */
export interface ShoppingListFilters {
  saleIds: readonly string[];
}

const root = [QUERY_ROOTS.shortages] as const;

export const shortageKeys = {
  all: root,
  lists: () => [...root, 'list'] as const,
  list: (filters: ShoppingListFilters) => [...root, 'list', filters] as const,
};
