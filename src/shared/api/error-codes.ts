/**
 * The stable error codes the API publishes, and the shape of the `details` that
 * travels with each one.
 *
 * `code` is the contract. It is derived on the API side from the error class
 * name (`EntityInUseError` -> `ENTITY_IN_USE`) and verified there by a catalogue
 * test, so it does not move when someone rewords a sentence. The `error` field
 * — the class name — is diagnostic, and nothing here is keyed by it.
 *
 * The English `message` is for the log. Reading a number or an id out of it,
 * with a regular expression or otherwise, is forbidden: every fact the screen
 * needs is in `details`, typed below.
 */

/** Failures that do not come from the domain. */
export const NON_DOMAIN_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;

/** Domain failures that carry structured `details`. */
export const STRUCTURED_DETAIL_CODES = [
  'ENTITY_IN_USE',
  'INSUFFICIENT_STOCK',
  'CONSUMPTION_UNIT_LOCKED',
  'DUPLICATE_INVOICE',
  'DISCOUNT_ALLOCATION',
  'PENDING_DISCOUNT_ALLOCATION',
  'UNSUPPORTED_IMAGE_MIME_TYPE',
  'RATE_LIMIT_EXCEEDED',
] as const;

export type StructuredDetailCode = (typeof STRUCTURED_DETAIL_CODES)[number];

/**
 * How many records of each kind point at the entity, broken down by kind
 * because "used by 3 recipes" and "sold 3 times" need different sentences and
 * lead to different ways out.
 *
 * The counts sit at the root of `details`, not nested: this mirrors
 * `EntityInUseDetails` on the API side, where the counts are spread beside
 * `entityName`. `total` arrives already summed.
 */
export interface EntityInUseDetails {
  entityName: string;
  entityId: string;
  saleItems: number;
  bomItems: number;
  purchaseItems: number;
  stockMovements: number;
  /** Registered stock losses: history, so they block a delete. */
  stockLosses: number;
  total: number;
}

/**
 * A write-off larger than the stock. `stockQuantity` and `requestedQuantity` are
 * `number`s in the material's own consumption unit, which the details do not
 * repeat: the screen that sent the request knows it.
 */
export interface InsufficientStockDetails {
  materialId: string;
  stockQuantity: number;
  requestedQuantity: number;
}

/** Why the consumption unit is locked. The way out differs for each. */
export type ConsumptionUnitLockReason = 'STOCK_ON_HAND' | 'BOM_REFERENCES';

export interface ConsumptionUnitLockedDetails {
  materialId: string;
  reason: ConsumptionUnitLockReason;
  /** Non-zero when the reason is `STOCK_ON_HAND`. */
  stockQuantity: number;
  /** Non-zero when the reason is `BOM_REFERENCES`. */
  bomItemReferences: number;
}

export interface DuplicateInvoiceDetails {
  accessKey: string;
  existingPurchaseId: string;
}

/**
 * One family of rules, one code, discriminated by `reason`. Which fields are
 * present depends on the reason — see the table in `docs/api-reference.md`,
 * section 3.3.
 */
export type DiscountAllocationReason =
  | 'SUM_MISMATCH'
  | 'LINE_EXCEEDS_GROSS'
  | 'DISCOUNT_EXCEEDS_GROSS'
  | 'NO_ELIGIBLE_LINE'
  | 'MANUAL_INPUT_MISSING'
  | 'NEGATIVE_LINE_AMOUNT'
  | 'NEGATIVE_DISCOUNT_TOTAL'
  | 'NO_LINES'
  | 'RESIDUE_UNALLOCATABLE';

export interface DiscountAllocationDetails {
  reason: DiscountAllocationReason;
  /** Decimal string: what the amount had to be. */
  expected?: string;
  /** Decimal string: what was actually attributed. */
  provided?: string;
  itemId?: string;
  mode?: string;
}

export interface PendingDiscountAllocationDetails {
  purchaseId: string;
  /** Decimal string: the whole discount of the note. */
  expected: string;
  /** Decimal string: what the lines currently add up to. */
  provided: string;
}

export interface UnsupportedImageMimeTypeDetails {
  mimeType: string;
  /** What the picker should offer instead, so the list lives in one place. */
  supported: readonly string[];
}

/**
 * Too many requests from this address to this route. It is neither the
 * client's fault nor ours: the same request passes once the wait is over.
 *
 * `retryAfterSeconds` is a whole number, rounded up and never below 1, and it
 * is what a countdown runs on — it does not depend on the clock of the device.
 * `retryAt` is the same instant as ISO-8601.
 */
export interface RateLimitExceededDetails {
  retryAfterSeconds: number;
  retryAt: string;
}

/**
 * One offending field of a rejected body.
 *
 * `path` is the field's name in the API's DTO, with a dot for a nested object
 * and an index for an array member: `billOfMaterials.0.quantity`. It is the
 * contract a form binds an error to a field by — never a prefix of the English
 * text in `constraints`, which is diagnostic.
 */
export interface ValidationIssue {
  path: string;
  constraints: readonly string[];
}

/** The `details` of each code that has one, keyed by the code. */
export interface ErrorDetailsByCode {
  ENTITY_IN_USE: EntityInUseDetails;
  INSUFFICIENT_STOCK: InsufficientStockDetails;
  CONSUMPTION_UNIT_LOCKED: ConsumptionUnitLockedDetails;
  DUPLICATE_INVOICE: DuplicateInvoiceDetails;
  DISCOUNT_ALLOCATION: DiscountAllocationDetails;
  PENDING_DISCOUNT_ALLOCATION: PendingDiscountAllocationDetails;
  UNSUPPORTED_IMAGE_MIME_TYPE: UnsupportedImageMimeTypeDetails;
  RATE_LIMIT_EXCEEDED: RateLimitExceededDetails;
  VALIDATION_FAILED: readonly ValidationIssue[];
}

export type DetailedErrorCode = keyof ErrorDetailsByCode;

/**
 * Narrowing guards, one per structured code.
 *
 * They check the fields the screen actually reads rather than validating the
 * whole shape: the point is that a component never needs a type assertion, and
 * that a malformed body degrades into "unknown error" instead of a crash
 * halfway through a render.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNumbers(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof record[key] === 'number');
}

export function isEntityInUseDetails(value: unknown): value is EntityInUseDetails {
  return (
    isRecord(value) &&
    typeof value.entityName === 'string' &&
    typeof value.entityId === 'string' &&
    hasNumbers(value, [
      'saleItems',
      'bomItems',
      'purchaseItems',
      'stockMovements',
      'stockLosses',
      'total',
    ])
  );
}

export function isInsufficientStockDetails(value: unknown): value is InsufficientStockDetails {
  return (
    isRecord(value) &&
    typeof value.materialId === 'string' &&
    hasNumbers(value, ['stockQuantity', 'requestedQuantity'])
  );
}

export function isConsumptionUnitLockedDetails(
  value: unknown,
): value is ConsumptionUnitLockedDetails {
  return (
    isRecord(value) &&
    typeof value.materialId === 'string' &&
    (value.reason === 'STOCK_ON_HAND' || value.reason === 'BOM_REFERENCES') &&
    hasNumbers(value, ['stockQuantity', 'bomItemReferences'])
  );
}

export function isDuplicateInvoiceDetails(value: unknown): value is DuplicateInvoiceDetails {
  return (
    isRecord(value) &&
    typeof value.accessKey === 'string' &&
    typeof value.existingPurchaseId === 'string'
  );
}

const DISCOUNT_ALLOCATION_REASONS: readonly string[] = [
  'SUM_MISMATCH',
  'LINE_EXCEEDS_GROSS',
  'DISCOUNT_EXCEEDS_GROSS',
  'NO_ELIGIBLE_LINE',
  'MANUAL_INPUT_MISSING',
  'NEGATIVE_LINE_AMOUNT',
  'NEGATIVE_DISCOUNT_TOTAL',
  'NO_LINES',
  'RESIDUE_UNALLOCATABLE',
];

export function isDiscountAllocationDetails(value: unknown): value is DiscountAllocationDetails {
  return (
    isRecord(value) &&
    typeof value.reason === 'string' &&
    DISCOUNT_ALLOCATION_REASONS.includes(value.reason)
  );
}

export function isPendingDiscountAllocationDetails(
  value: unknown,
): value is PendingDiscountAllocationDetails {
  return (
    isRecord(value) &&
    typeof value.purchaseId === 'string' &&
    typeof value.expected === 'string' &&
    typeof value.provided === 'string'
  );
}

export function isUnsupportedImageMimeTypeDetails(
  value: unknown,
): value is UnsupportedImageMimeTypeDetails {
  return (
    isRecord(value) &&
    typeof value.mimeType === 'string' &&
    Array.isArray(value.supported) &&
    value.supported.every((item) => typeof item === 'string')
  );
}

export function isRateLimitExceededDetails(value: unknown): value is RateLimitExceededDetails {
  return (
    isRecord(value) &&
    typeof value.retryAfterSeconds === 'number' &&
    Number.isFinite(value.retryAfterSeconds) &&
    value.retryAfterSeconds >= 1 &&
    typeof value.retryAt === 'string'
  );
}

const GUARDS: { [K in StructuredDetailCode]: (value: unknown) => value is ErrorDetailsByCode[K] } =
  {
    ENTITY_IN_USE: isEntityInUseDetails,
    INSUFFICIENT_STOCK: isInsufficientStockDetails,
    CONSUMPTION_UNIT_LOCKED: isConsumptionUnitLockedDetails,
    DUPLICATE_INVOICE: isDuplicateInvoiceDetails,
    DISCOUNT_ALLOCATION: isDiscountAllocationDetails,
    PENDING_DISCOUNT_ALLOCATION: isPendingDiscountAllocationDetails,
    UNSUPPORTED_IMAGE_MIME_TYPE: isUnsupportedImageMimeTypeDetails,
    RATE_LIMIT_EXCEEDED: isRateLimitExceededDetails,
  };

/**
 * The guard for one structured code. `ApiError.detailsFor` is what components
 * use; this is the table behind it.
 */
export function guardFor<K extends StructuredDetailCode>(
  code: K,
): (value: unknown) => value is ErrorDetailsByCode[K] {
  return GUARDS[code];
}
