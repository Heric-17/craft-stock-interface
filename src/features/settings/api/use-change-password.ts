import { useMutation } from '@tanstack/react-query';

import { postChangePassword } from './password-requests';
import type { ChangePasswordRequestDto } from './password.dto';

/**
 * Changes the password of the person who is signed in. This session stays open;
 * the API closes every other one, on other devices.
 *
 * Invalidates nothing. The password is not part of anything the screens read,
 * and the session in use is not touched, so there is no cached answer that this
 * makes wrong. Not optimistic either: the API decides whether the current
 * password was right.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequestDto) => postChangePassword(body),
  });
}
