import { useMutation } from '@tanstack/react-query';

import { request } from '@/shared/api/http-client';

import type { ResetPasswordRequestDto } from './auth.dto';

/**
 * Chooses a new password with the token from the e-mail. It opens no session:
 * the person signs in with the new password, and every session the account had
 * was closed by the API.
 *
 * Invalidates nothing, for the same reason as the request for the link. Not
 * optimistic: the API decides whether the link still works.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: (body: ResetPasswordRequestDto) =>
      request<void>('/auth/reset-password', { method: 'POST', body, public: true }),
  });
}
