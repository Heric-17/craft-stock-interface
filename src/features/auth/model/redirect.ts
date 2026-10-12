const DEFAULT_DESTINATION = '/';
const LOGIN_PATH = '/login';

/**
 * Only the path matters, and only if it is this application's. The URL parser
 * is the judge rather than a prefix check: it reads `//evil.example` and
 * `/\evil.example` as another host, which a `startsWith('/')` would wave
 * through into an open redirect.
 */
const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid';

/**
 * Where to go after signing in: the page the person was on, if `redirect` names
 * one inside the application, and the start otherwise.
 *
 * The login page itself is not a destination — landing there again after
 * signing in would look like the sign-in had done nothing.
 */
export function safeDestination(redirect: string | null): string {
  if (redirect === null || redirect === '') {
    return DEFAULT_DESTINATION;
  }

  let url: URL;

  try {
    url = new URL(redirect, PLACEHOLDER_ORIGIN);
  } catch {
    return DEFAULT_DESTINATION;
  }

  if (url.origin !== PLACEHOLDER_ORIGIN || url.pathname === LOGIN_PATH) {
    return DEFAULT_DESTINATION;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in address that brings the person back to `destination` afterwards. */
export function loginPath(destination: string): string {
  const safe = safeDestination(destination);

  return safe === DEFAULT_DESTINATION
    ? LOGIN_PATH
    : `${LOGIN_PATH}?redirect=${encodeURIComponent(safe)}`;
}
