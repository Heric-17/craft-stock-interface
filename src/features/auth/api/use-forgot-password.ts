import { useMutation } from '@tanstack/react-query';

import { request } from '@/shared/api/http-client';

import type { ForgotPasswordRequestDto } from './auth.dto';

/**
 * Asks for a link to choose a new password, sent to the e-mail. The API answers
 * the same whether or not the address has an account, so this tells the screen
 * nothing about who is registered, and neither does the screen.
 *
 * Invalidates nothing: a visitor has no cache, and nothing the screens read
 * changes. `public` because there is no session to send, and a 401 would only
 * send the client off to renew one that does not exist.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: ForgotPasswordRequestDto) =>
      request<void>('/auth/forgot-password', { method: 'POST', body, public: true }),
  });
}
