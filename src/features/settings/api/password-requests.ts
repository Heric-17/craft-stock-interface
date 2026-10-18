import { request } from '@/shared/api/http-client';

import type { ChangePasswordRequestDto } from './password.dto';

/**
 * The only place the path of the password change is written. It lives under
 * `/auth`, not `/users`, because the session cookie is only sent there and the
 * API needs it to tell which session to keep open.
 */
export function postChangePassword(body: ChangePasswordRequestDto): Promise<void> {
  return request<void>('/auth/change-password', { method: 'POST', body });
}
