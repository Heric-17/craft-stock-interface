/**
 * The wire shapes of the activity feed, written by hand from section 17 of
 * `api-contract.md` and the backend's `audit-log.dto.ts`.
 *
 * The API sends structured data and never a sentence: the words are put
 * together in `model/`. `changes` is `{ column: { old, new } }`, and its values
 * are whatever the database held, serialised — decimals as strings without
 * fixed places, dates as ISO 8601, `null` where there was nothing — so they are
 * `unknown` here and read one field at a time by the sentence.
 */

export interface FieldChangeDto {
  old: unknown;
  new: unknown;
}

export interface AuditTrailEntryDto {
  id: string;
  occurredAt: string;
  transactionId: string;
  /** Who made the request. `null` when there was no signed-in user. */
  userId: string | null;
  route: string;
  httpMethod: string;
  correlationId: string;
  /** The name of the model written (`Material`, `Sale`…), not an enum of actions. */
  entityType: string;
  entityId: string;
  /** Only for materials, products, sales and purchases; `null` for the rest. */
  entityLabel: string | null;
  /** Kept a string on purpose: an operation this build has never heard of must not break the feed. */
  operation: string;
  changes: Record<string, FieldChangeDto>;
  /** Set only when the diff alone does not say what the person meant. */
  intent: string | null;
}

export interface AuditTrailPageDto {
  items: AuditTrailEntryDto[];
  total: number;
  limit: number;
  offset: number;
}
