import type { AuditTrailEntryDto, AuditTrailPageDto } from '../api/audit.dto';

/** One field that changed. `null` on a side means there was nothing there. */
export interface FieldChange {
  old: unknown;
  new: unknown;
}

/**
 * One write in the user's feed, as the screens read it. The API sends no
 * sentence; `describeActivity` makes one from this.
 *
 * `operation` and `entityType` stay strings: the feed is the one place where a
 * value this build has never heard of is expected, because the backend can add
 * a model or an operation long before the screen learns its name.
 */
export interface ActivityEntry {
  id: string;
  occurredAt: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  operation: string;
  intent: string | null;
  changes: Readonly<Record<string, FieldChange>>;
}

export interface ActivityPage {
  items: ActivityEntry[];
  /** The size of the whole feed, as the API counted it — never `items.length`. */
  total: number;
  limit: number;
  offset: number;
}

export function toActivityEntry(dto: AuditTrailEntryDto): ActivityEntry {
  return {
    id: dto.id,
    occurredAt: dto.occurredAt,
    userId: dto.userId,
    entityType: dto.entityType,
    entityId: dto.entityId,
    entityLabel: dto.entityLabel,
    operation: dto.operation,
    intent: dto.intent,
    changes: readChanges(dto.changes),
  };
}

export function toActivityPage(dto: AuditTrailPageDto): ActivityPage {
  return {
    items: dto.items.map(toActivityEntry),
    total: dto.total,
    limit: dto.limit,
    offset: dto.offset,
  };
}

/**
 * `changes` is JSON the database wrote, so what comes back is checked rather
 * than trusted: a field that is not `{ old, new }` is left out instead of
 * breaking the whole feed over one row.
 */
function readChanges(raw: unknown): Record<string, FieldChange> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const changes: Record<string, FieldChange> = {};

  for (const [field, change] of Object.entries(raw)) {
    if (typeof change === 'object' && change !== null && !Array.isArray(change)) {
      const { old, new: next } = change as { old?: unknown; new?: unknown };

      changes[field] = { old: old ?? null, new: next ?? null };
    }
  }

  return changes;
}
