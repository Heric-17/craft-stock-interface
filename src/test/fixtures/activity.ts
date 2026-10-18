import { http, HttpResponse } from 'msw';

import type { AuditTrailEntryDto } from '@/features/activity/api/audit.dto';
import { env } from '@/shared/config/env';
import { toIntOr } from '@/shared/lib/to-int';

import { apiErrorBody } from './materials';

const API = env.VITE_API_URL;

export { apiErrorBody };

/**
 * The clock the screen of this file runs on: the afternoon of 12 October 2026 in
 * Sao Paulo, so "Hoje" is that day and "Ontem" the one before it.
 */
export const ACTIVITY_NOW = '2026-10-12T17:00:00-03:00';

/** The person looking at the screen (see `marina` in `test/auth.ts`). */
export const VIEWER_ID = 'f5a8f3a2-7a53-4a5e-9e61-0c8f9a0f3b11';

let sequence = 0;

/**
 * An entry of the trail the way the backend writes one: the column names of the
 * database, decimals as strings without fixed places, dates as ISO 8601.
 */
export function auditEntryDto(
  overrides: Partial<AuditTrailEntryDto> & Pick<AuditTrailEntryDto, 'entityType' | 'operation'>,
): AuditTrailEntryDto {
  sequence += 1;

  return {
    id: `audit-${sequence}`,
    occurredAt: '2026-10-12T14:32:00-03:00',
    transactionId: `tx-${sequence}`,
    userId: VIEWER_ID,
    route: '/materials/:id',
    httpMethod: 'PATCH',
    correlationId: `corr-${sequence}`,
    entityId: 'mat-cera',
    entityLabel: 'Cera de soja',
    intent: null,
    changes: {},
    ...overrides,
  };
}

/** The package cost of the wax went up: the example of the brief. */
export const custoDaCeraSubiu = auditEntryDto({
  entityType: 'Material',
  operation: 'UPDATE',
  occurredAt: '2026-10-12T14:32:00-03:00',
  changes: { packageCost: { old: '22.9', new: '24.5' } },
});

/** Yesterday morning, by someone else. */
export const vendaPaga = auditEntryDto({
  entityType: 'Sale',
  operation: 'UPDATE',
  occurredAt: '2026-10-11T10:18:00-03:00',
  userId: 'someone-else',
  entityId: 'sale-1',
  entityLabel: 'Maria',
  route: '/sales/:id/payment-status',
  changes: { paymentStatus: { old: 'PENDING', new: 'PAID' } },
});

/** Yesterday, earlier: the same day as the sale. 100 g of wax lost. */
export const perdaDeCera = auditEntryDto({
  entityType: 'StockLoss',
  operation: 'CREATE',
  occurredAt: '2026-10-11T08:05:00-03:00',
  entityId: 'loss-1',
  entityLabel: null,
  route: '/materials/:id/losses',
  httpMethod: 'POST',
  changes: {
    id: { old: null, new: 'loss-1' },
    materialId: { old: null, new: 'mat-cera' },
    quantity: { old: null, new: '100' },
    reason: { old: null, new: 'BREAKAGE' },
    observation: { old: null, new: null },
    costBasisAmount: { old: null, new: '28' },
    costBasisQuantity: { old: null, new: '1000' },
    createdAt: { old: null, new: '2026-10-11T11:05:00.000Z' },
  },
});

/** A product registered last year, by a write with no signed-in user. */
export const produtoAntigo = auditEntryDto({
  entityType: 'CompositeProduct',
  operation: 'CREATE',
  occurredAt: '2025-12-30T09:00:00-03:00',
  userId: null,
  entityId: 'prod-1',
  entityLabel: 'Vela de baunilha',
  route: '/composite-products',
  httpMethod: 'POST',
  changes: { name: { old: null, new: 'Vela de baunilha' } },
});

interface ActivityHandlerOptions {
  /** The whole feed, newest first. The route cuts it by `limit` and `offset`. */
  entries?: AuditTrailEntryDto[];
  /** Sees every URL the route receives, which is how a test checks the parameters. */
  onRequest?: (url: URL) => void;
  /** Makes the feed fail with this status and body. */
  failure?: { status: number; body: ReturnType<typeof apiErrorBody> };
}

/** `GET /audit-log/activity`, paged the way the API pages: `{ items, total, limit, offset }`. */
export function activityHandlers(options: ActivityHandlerOptions = {}) {
  const {
    entries = [custoDaCeraSubiu, vendaPaga, perdaDeCera, produtoAntigo],
    onRequest,
    failure,
  } = options;

  return [
    http.get(`${API}/audit-log/activity`, ({ request }) => {
      const url = new URL(request.url);
      onRequest?.(url);

      if (failure !== undefined) {
        return HttpResponse.json(failure.body, { status: failure.status });
      }

      const limit = toIntOr(url.searchParams.get('limit'), 20);
      const offset = toIntOr(url.searchParams.get('offset'), 0);

      return HttpResponse.json({
        items: entries.slice(offset, offset + limit),
        total: entries.length,
        limit,
        offset,
      });
    }),
  ];
}
