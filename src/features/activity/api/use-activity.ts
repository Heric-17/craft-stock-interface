import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { toActivityPage } from '../model/activity-entry';

import { activityKeys, type ActivityFilters } from './activity-keys';
import { fetchActivity } from './activity-requests';

/**
 * One page of the feed, newest first. `total` is the size of the whole feed.
 *
 * Read fresh every time the screen opens: every write of every other screen
 * lands in the trail, so there is no list of mutations to invalidate this from,
 * and a feed that answers from a thirty-second-old cache would leave out what
 * the person just did. The previous page stays on screen while the next loads.
 */
export function useActivity(filters: ActivityFilters) {
  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: async ({ signal }) => toActivityPage(await fetchActivity(filters, signal)),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}
