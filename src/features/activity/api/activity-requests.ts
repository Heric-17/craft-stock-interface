import { request } from '@/shared/api/http-client';

import type { ActivityFilters } from './activity-keys';
import type { AuditTrailPageDto } from './audit.dto';

/**
 * The user's feed, not the technical trail: `/audit-log/activity` is restricted
 * to the things a person recognises, and takes `limit` and `offset` only.
 */
export function fetchActivity(
  filters: ActivityFilters,
  signal: AbortSignal,
): Promise<AuditTrailPageDto> {
  return request<AuditTrailPageDto>('/audit-log/activity', {
    signal,
    query: { limit: filters.limit, offset: filters.offset },
  });
}
