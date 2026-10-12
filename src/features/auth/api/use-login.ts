import { useMutation } from '@tanstack/react-query';

import { ApiError } from '@/shared/api/api-error';
import { isAuthTokenResponse } from '@/shared/api/auth-response.dto';
import { request } from '@/shared/api/http-client';
import { establishSession } from '@/shared/api/session';

import type { LoginRequestDto } from './auth.dto';

/**
 * Signs in. The access token goes to memory and the user to the session; the
 * refresh token is a cookie the browser keeps on its own and this code never
 * sees.
 *
 * Invalidates nothing: a session opens on an empty cache, because the cache was
 * cleared when the previous one ended. `public` keeps a wrong password what it
 * is — `INVALID_CREDENTIALS`, for the form — instead of a 401 that would send
 * the client off to renew a session that does not exist.
 */
export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: LoginRequestDto) => {
      const body = await request<unknown>('/auth/login', {
        method: 'POST',
        body: credentials,
        public: true,
      });

      if (!isAuthTokenResponse(body)) {
        throw ApiError.unexpectedResponse(200);
      }

      return body;
    },
    onSuccess: (response) => {
      establishSession(response);
    },
  });
}
