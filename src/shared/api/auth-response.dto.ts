/**
 * What `POST /auth/login` and `POST /auth/refresh` answer with.
 *
 * There is no `refreshToken` here, and that is the contract rather than an
 * omission: it travels in an `HttpOnly` cookie the browser sends on its own and
 * no script can read. If a response ever carries one in the body, the defect is
 * on the API's side, and this type does not make room for it.
 */
export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
}

export interface AuthTokenResponseDto {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: AuthUserDto;
}

/**
 * Checks the fields the session reads. A body that is not this shape would
 * otherwise reach a render as `undefined.email`, which explains nothing.
 */
export function isAuthTokenResponse(value: unknown): value is AuthTokenResponseDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const body = value as Record<string, unknown>;
  const user = body.user;

  return (
    typeof body.accessToken === 'string' &&
    body.accessToken.length > 0 &&
    typeof user === 'object' &&
    user !== null &&
    typeof (user as Record<string, unknown>).id === 'string' &&
    typeof (user as Record<string, unknown>).email === 'string' &&
    typeof (user as Record<string, unknown>).name === 'string'
  );
}
