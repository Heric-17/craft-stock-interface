import { ApiError, isApiError } from './api-error';
import { isAuthTokenResponse, type AuthTokenResponseDto } from './auth-response.dto';
import { configureSession, request } from './http-client';

/**
 * The session: who is signed in, and the access token that proves it.
 *
 * **The access token lives in a module variable and nowhere else** — not in
 * React state, not in `localStorage`, not in `sessionStorage`, not in a log. A
 * reload empties it on purpose, and the refresh token, which survives the
 * reload, is an `HttpOnly` cookie this code can neither read nor send by hand:
 * the browser attaches it to `/auth/*` calls on its own.
 *
 * The state is a small external store (`getSessionSnapshot`/`subscribeSession`)
 * rather than a React context, so the HTTP client can renew the session without
 * knowing React exists, and the screens read it with `useSyncExternalStore`.
 *
 * There is no expiry timer and no "your session is about to end" warning. The
 * API slides the session on every refresh and sets no absolute ceiling, so the
 * client's only job is to renew when a request comes back 401.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Why nobody is signed in, which decides what the login screen says:
 * `visitor` never was, `expired` lost the session while using it, and
 * `signed-out` chose to leave.
 */
export type AnonymousReason = 'visitor' | 'expired' | 'signed-out';

export type SessionState =
  | { status: 'restoring' }
  | { status: 'restore-failed'; error: ApiError }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'anonymous'; reason: AnonymousReason };

const INITIAL_STATE: SessionState = { status: 'restoring' };

let accessToken: string | null = null;
let state: SessionState = INITIAL_STATE;
let refreshInFlight: Promise<string> | null = null;

const stateListeners = new Set<() => void>();
const endedListeners = new Set<() => void>();

function setState(next: SessionState): void {
  state = next;

  for (const listener of stateListeners) {
    listener();
  }
}

export function getSessionSnapshot(): SessionState {
  return state;
}

export function subscribeSession(listener: () => void): () => void {
  stateListeners.add(listener);

  return () => {
    stateListeners.delete(listener);
  };
}

/**
 * Runs when a signed-in session ends — expired, refused or chosen — and not
 * when a visitor is found to be one. The cache holds one person's data and has
 * to go with them, so whoever owns the query client listens here.
 */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);

  return () => {
    endedListeners.delete(listener);
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Records a session the API just opened or renewed. */
export function establishSession(response: AuthTokenResponseDto): void {
  accessToken = response.accessToken;

  setState({
    status: 'authenticated',
    user: { id: response.user.id, email: response.user.email, name: response.user.name },
  });
}

export function endSession(reason: AnonymousReason): void {
  // Already out: the first reason stands, so a late failure cannot turn "never
  // signed in" into "your session expired".
  if (state.status === 'anonymous') {
    return;
  }

  const wasSignedIn = state.status === 'authenticated';

  accessToken = null;
  setState({ status: 'anonymous', reason });

  if (wasSignedIn) {
    for (const listener of endedListeners) {
      listener();
    }
  }
}

/**
 * Asks the API for a new access token. **One call at a time, whoever asks.**
 *
 * The API rotates the refresh token on every use: the cookie a refresh consumed
 * is dead the moment it answers. Two refreshes in flight would send the same
 * cookie twice, the second would be refused as already used, and a perfectly
 * valid session would be torn down. Every caller that arrives while one is
 * running therefore waits for that one and takes its result.
 */
function renewAccessToken(whenRefused: AnonymousReason): Promise<string> {
  refreshInFlight ??= requestNewToken(whenRefused).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function requestNewToken(whenRefused: AnonymousReason): Promise<string> {
  try {
    const body = await request<unknown>('/auth/refresh', { method: 'POST', public: true });

    if (!isAuthTokenResponse(body)) {
      throw ApiError.unexpectedResponse(200);
    }

    establishSession(body);

    return body.accessToken;
  } catch (error) {
    // A refusal ends the session. Anything else — no network, a 5xx — says
    // nothing about the session, so it stays as it was and the caller sees the
    // failure.
    if (isApiError(error) && error.statusCode === 401) {
      endSession(whenRefused);
    }

    throw error;
  }
}

/**
 * Called by the HTTP client when a request came back 401.
 *
 * A request that left with the old token and was refused after another request
 * had already renewed the session needs no renewal of its own — the token in
 * memory is newer than the one it carried — and asking again would burn a
 * rotation for nothing.
 */
function refreshAfterRejection(rejectedToken: string | null): Promise<string> {
  if (accessToken !== null && accessToken !== rejectedToken) {
    return Promise.resolve(accessToken);
  }

  return renewAccessToken('expired');
}

/**
 * Finds out, on load, whether the browser still holds a session: a refresh with
 * nothing stored on the client. A 401 means a visitor who is not signed in —
 * an ordinary answer, not an error — and moves silently to `anonymous`.
 * Anything else leaves `restore-failed`, which the shell offers to retry.
 */
export async function restoreSession(): Promise<void> {
  if (state.status !== 'restoring' && state.status !== 'restore-failed') {
    return;
  }

  if (state.status === 'restore-failed') {
    setState(INITIAL_STATE);
  }

  try {
    await renewAccessToken('visitor');
  } catch (error) {
    if (!isApiError(error)) {
      throw error;
    }

    if (state.status === 'restoring') {
      setState({ status: 'restore-failed', error });
    }
  }
}

/** Back to the state of a page that was just opened. For tests; nothing else needs it. */
export function resetSession(): void {
  accessToken = null;
  refreshInFlight = null;
  state = INITIAL_STATE;
  stateListeners.clear();
  endedListeners.clear();
}

configureSession({
  getAccessToken,
  refreshAccessToken: refreshAfterRejection,
});
