import { env } from '@/shared/config/env';

import { ApiError, type ApiErrorBody } from './api-error';

/**
 * The only module in the application that calls `fetch`.
 *
 * Everything above it goes through the query hooks in
 * `features/<feature>/api`, which is why the dependency rules refuse an import
 * of this file from anywhere else: a second place that talks to the network is
 * a second place that has to remember the base URL, the error shape and the
 * session.
 *
 * The session layer — the in-memory access token and the single-flight
 * refresh — attaches here through {@link setAuthorization}, so this module
 * stays free of any knowledge about how a session is obtained.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** Serialised as JSON. Mutually exclusive with `formData`. */
  body?: unknown;
  /** For the image uploads, which are a second call with `multipart/form-data`. */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

type AuthorizationProvider = () => string | null;

let authorization: AuthorizationProvider = () => null;

/**
 * Hands the client a way to read the current access token. Called once, by the
 * session module; the token itself never lives here and never leaves memory.
 */
export function setAuthorization(provider: AuthorizationProvider): void {
  authorization = provider;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = new URL(`${env.VITE_API_URL}${path.startsWith('/') ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * The header the API exposes through CORS so a failure can be traced even when
 * the body carries nothing — an empty response, or a failure that happened
 * before the handler ran.
 */
const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/**
 * Reads the error body the API's exception filter produces. A response that
 * is not that shape — a proxy's HTML error page, a gateway timeout — still has
 * to become an `ApiError`, so the status carries it.
 *
 * `correlationId` is read from the header whenever the body did not bring one:
 * without it an unexpected failure reaches the user with nothing to report.
 */
async function toApiError(response: Response): Promise<ApiError> {
  const headerCorrelationId = response.headers.get(CORRELATION_ID_HEADER);

  const fallback: ApiErrorBody = {
    statusCode: response.status,
    // A body that is not the documented shape has no `code` to branch on. It
    // falls back by status band in `messageForError`, which is why these two
    // values are deliberately not codes the API publishes.
    code: response.status >= 500 ? 'INTERNAL_ERROR' : 'UNEXPECTED_RESPONSE',
    error: response.status >= 500 ? 'InternalServerError' : 'UnexpectedResponse',
    message: response.statusText,
    ...(headerCorrelationId !== null ? { correlationId: headerCorrelationId } : {}),
    // The API only sends `errorId` at 500 and above. When the body is
    // unreadable, the header is the only thing left to report.
    ...(response.status >= 500 && headerCorrelationId !== null
      ? { errorId: headerCorrelationId }
      : {}),
  };

  try {
    const body: unknown = await response.json();

    if (typeof body !== 'object' || body === null) {
      return new ApiError(fallback);
    }

    const parsed = body as Partial<ApiErrorBody>;

    // The body's own value wins; the header fills in only what it left out.
    const correlationId = parsed.correlationId ?? fallback.correlationId;
    const errorId = parsed.errorId ?? fallback.errorId;

    return new ApiError({
      ...fallback,
      ...parsed,
      statusCode: typeof parsed.statusCode === 'number' ? parsed.statusCode : response.status,
      code: typeof parsed.code === 'string' ? parsed.code : fallback.code,
      error: typeof parsed.error === 'string' ? parsed.error : fallback.error,
      message: typeof parsed.message === 'string' ? parsed.message : fallback.message,
      // Spread conditionally: under `exactOptionalPropertyTypes` an explicit
      // `undefined` is not the same as an absent field.
      ...(correlationId !== undefined ? { correlationId } : {}),
      ...(errorId !== undefined ? { errorId } : {}),
    });
  } catch {
    return new ApiError(fallback);
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, query, signal } = options;

  const headers = new Headers();
  const token = authorization();

  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // `multipart/form-data` sets its own Content-Type, boundary included.
  // Setting it by hand is how an upload silently arrives unparseable.
  if (formData === undefined && body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      // Not optional, and not only for `/auth/*`: the refresh token lives in an
      // `HttpOnly` cookie the browser sends on its own, and the SPA is served
      // from a different origin than the API. Without this the cookie never
      // goes out and the refresh fails with a 401 that looks unexplained.
      credentials: 'include',
      ...(formData !== undefined
        ? { body: formData }
        : body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
      ...(signal !== undefined ? { signal } : {}),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause;
    }

    throw ApiError.networkFailure(cause);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  // 204, and the DELETE routes that answer with nothing.
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return undefined as T;
  }

  return (await response.json()) as T;
}
