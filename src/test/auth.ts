import { http, HttpResponse } from 'msw';

import type { AuthTokenResponseDto, AuthUserDto } from '@/shared/api/auth-response.dto';
import { env } from '@/shared/config/env';

const API = env.VITE_API_URL;

export const marina: AuthUserDto = {
  id: 'f5a8f3a2-7a53-4a5e-9e61-0c8f9a0f3b11',
  email: 'marina@exemplo.com.br',
  name: 'Marina',
};

/** The body of `/auth/login` and `/auth/refresh`: no refresh token, it is a cookie. */
export function authResponse(accessToken = 'access-token-1', user = marina): AuthTokenResponseDto {
  return { accessToken, tokenType: 'Bearer', expiresInSeconds: 900, user };
}

export function invalidRefreshTokenBody() {
  return {
    statusCode: 401,
    code: 'INVALID_REFRESH_TOKEN',
    error: 'InvalidRefreshTokenError',
    message: 'Refresh token is invalid, expired, or already used.',
    path: '/auth/refresh',
    timestamp: '2026-10-12T12:00:00.000Z',
    correlationId: 'corr-refresh',
  };
}

/** The browser still holds a valid refresh cookie. */
export function refreshSucceeds(accessToken = 'access-token-1') {
  return http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse(accessToken)));
}

/** No cookie, or one the API no longer accepts: a visitor. */
export function refreshRefused() {
  return http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json(invalidRefreshTokenBody(), { status: 401 }),
  );
}
