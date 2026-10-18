import { describe, expect, it } from 'vitest';

import type { AuditTrailEntryDto } from '../api/audit.dto';

import { toActivityEntry } from './activity-entry';

function dto(changes: unknown): AuditTrailEntryDto {
  return {
    id: 'audit-1',
    occurredAt: '2026-10-12T14:32:00.000Z',
    transactionId: 'tx-1',
    userId: 'user-1',
    route: '/materials/:id',
    httpMethod: 'PATCH',
    correlationId: 'corr-1',
    entityType: 'Material',
    entityId: 'mat-1',
    entityLabel: 'Café',
    operation: 'UPDATE',
    changes: changes as AuditTrailEntryDto['changes'],
    intent: null,
  };
}

describe('toActivityEntry', () => {
  it('carries the changes as old and new, with nothing for a side the API left out', () => {
    const entry = toActivityEntry(
      dto({ stockQuantity: { old: '10', new: '5' }, name: { new: 'Café' } }),
    );

    expect(entry.changes).toEqual({
      stockQuantity: { old: '10', new: '5' },
      name: { old: null, new: 'Café' },
    });
  });

  it('leaves out a field that is not an old/new pair instead of breaking the feed', () => {
    const entry = toActivityEntry(
      dto({ name: 'Café', stockQuantity: { old: '10', new: '5' }, tags: [] }),
    );

    expect(Object.keys(entry.changes)).toEqual(['stockQuantity']);
  });

  it.each([null, 'text', ['a'], 42])('reads changes that are %p as no changes', (value) => {
    expect(toActivityEntry(dto(value)).changes).toEqual({});
  });
});
