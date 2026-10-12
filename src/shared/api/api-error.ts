import {
  guardFor,
  type ErrorDetailsByCode,
  type StructuredDetailCode,
  type ValidationIssue,
} from './error-codes';

/**
 * The error body the API answers with, from its single exception filter.
 *
 * `code` is the contract: a stable identifier in SCREAMING_SNAKE_CASE that the
 * client branches and translates on. `error` is the class name behind it and is
 * diagnostic only — nothing is keyed by it. `message` is English, for the log.
 *
 * `errorId` is present only at 500 and above, and is the code the user hands to
 * whoever can look the failure up.
 */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  error: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
  correlationId?: string;
  errorId?: string;
}

/** Anything at or above this is a failure of ours, not of the request. */
const SERVER_ERROR_FLOOR = 500;

export class ApiError extends Error {
  readonly statusCode: number;
  /**
   * The stable error code, e.g. `ENTITY_IN_USE`. **This is what the message map
   * and every branch is keyed by.**
   */
  readonly code: string;
  /** The error class name, e.g. `EntityInUseError`. Diagnostic, never a key. */
  readonly error: string;
  readonly details: unknown;
  readonly correlationId: string | undefined;
  readonly errorId: string | undefined;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.error = body.error;
    this.details = body.details;
    this.correlationId = body.correlationId;
    this.errorId = body.errorId;
  }

  /**
   * The request never reached the API, or the answer was not something this
   * client could read. There is no `errorId` to show, because nothing was
   * recorded on the other side.
   */
  static networkFailure(cause: unknown): ApiError {
    const error = new ApiError({
      statusCode: 0,
      code: 'NETWORK_FAILURE',
      error: 'NetworkError',
      message: 'Request failed before the API answered.',
    });

    error.cause = cause;

    return error;
  }

  /** Nothing the user did caused this, and nothing they can do will fix it. */
  get isUnexpected(): boolean {
    return this.statusCode >= SERVER_ERROR_FLOOR || this.statusCode === 0;
  }

  /** The session is gone or was never there. */
  get isUnauthenticated(): boolean {
    return this.statusCode === 401;
  }

  /** The refresh token was refused: the session is over, not renewable. */
  get isSessionOver(): boolean {
    return this.code === 'INVALID_REFRESH_TOKEN';
  }

  /**
   * What the user reports to support. The `errorId` when the API recorded one,
   * the `correlationId` otherwise — which is what is left when the response had
   * no body, or failed before the handler and only carried the header.
   */
  get supportId(): string | undefined {
    return this.errorId ?? this.correlationId;
  }

  /**
   * The typed `details` of this error, or `undefined` when the code does not
   * match or the body was not the documented shape.
   *
   * This is the only way a component reads `details`: passing the code it is
   * handling gives it the right type back, so no caller ever needs an
   * assertion.
   */
  detailsFor<K extends StructuredDetailCode>(code: K): ErrorDetailsByCode[K] | undefined {
    if (this.code !== code) {
      return undefined;
    }

    return guardFor(code)(this.details) ? this.details : undefined;
  }

  /**
   * One entry per field the API refused, each naming the field by `path`.
   *
   * A form binds these to its inputs by that path — `billOfMaterials.0.quantity`
   * names exactly one field — never by matching the English text.
   *
   * The API has a second, older shape for this: a `ValidationPipe` without the
   * custom factory reports violations as a bare array of sentences. Those
   * arrive with an empty `path`, so a form shows them as form-level errors
   * instead of dropping them.
   */
  get validationIssues(): readonly ValidationIssue[] {
    if (this.code !== 'VALIDATION_FAILED' || !Array.isArray(this.details)) {
      return [];
    }

    return this.details.flatMap((entry): ValidationIssue[] => {
      if (typeof entry === 'string') {
        return [{ path: '', constraints: [entry] }];
      }

      if (typeof entry !== 'object' || entry === null) {
        return [];
      }

      const record = entry as Record<string, unknown>;

      if (typeof record.path !== 'string') {
        return [];
      }

      const constraints = Array.isArray(record.constraints)
        ? record.constraints.filter((item): item is string => typeof item === 'string')
        : [];

      return [{ path: record.path, constraints }];
    });
  }

  /** The violations reported for one field, by the path the API named it with. */
  issuesForPath(path: string): readonly string[] {
    return this.validationIssues
      .filter((issue) => issue.path === path)
      .flatMap((issue) => issue.constraints);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
