import { QUERY_ROOTS } from '@/shared/api/query-roots';

/** The two parameters the activity endpoint accepts. It takes no other. */
export interface ActivityFilters {
  limit: number;
  offset: number;
}

const root = [QUERY_ROOTS.activity] as const;

export const activityKeys = {
  all: root,
  list: (filters: ActivityFilters) => [...root, 'list', filters] as const,
};
