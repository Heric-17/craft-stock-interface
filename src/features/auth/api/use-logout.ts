import { useMutation } from '@tanstack/react-query';

import { request } from '@/shared/api/http-client';
import { endSession } from '@/shared/api/session';

/**
 * Signs out: asks the API to clear the refresh cookie, then drops the session
 * from memory. The cache goes with it, through the listener the provider holds.
 *
 * The state is dropped only after the API answered. The cookie is what keeps
 * the session alive across a reload, and only the server can clear it; forgetting
 * the session locally while the cookie stays would look signed out until the
 * next F5 signed the person back in. The route is idempotent and always 204, so
 * a failure here is the network or ours, and the person is told to try again.
 *
 * Invalidates nothing itself: ending the session clears the whole cache.
 */
export function useLogout() {
  return useMutation({
    mutationFn: () => request<void>('/auth/logout', { method: 'POST', public: true }),
    onSuccess: () => {
      endSession('signed-out');
    },
  });
}
