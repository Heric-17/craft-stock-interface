import { QUERY_ROOTS } from '@/shared/api/query-roots';

/** What narrows the list the backend returns: the one parameter it accepts. */
export interface CompositeProductFilters {
  includeDiscontinued: boolean;
}

const root = [QUERY_ROOTS.compositeProducts] as const;

export const compositeProductKeys = {
  all: root,
  lists: () => [...root, 'list'] as const,
  list: (filters: CompositeProductFilters) => [...root, 'list', filters] as const,
  details: () => [...root, 'detail'] as const,
  detail: (id: string) => [...root, 'detail', id] as const,
};
