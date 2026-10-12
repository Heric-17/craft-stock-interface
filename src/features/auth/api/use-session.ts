import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import {
  getSessionSnapshot,
  onSessionEnded,
  restoreSession,
  subscribeSession,
  type SessionState,
} from '@/shared/api/session';

/** Who is signed in, or why nobody is. Re-renders when that changes. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
}

/**
 * Wires the session to the rest of the application, once, at the root.
 *
 * - Finds out on load whether the browser still holds a session. Under
 *   StrictMode this runs twice; the second call joins the first one's request.
 * - Empties the query cache whenever a signed-in session ends, by expiry or by
 *   choice: it holds one person's data and must not outlive them.
 */
export function useSessionLifecycle(): void {
  const queryClient = useQueryClient();

  useEffect(() => onSessionEnded(() => queryClient.clear()), [queryClient]);

  useEffect(() => {
    void restoreSession();
  }, []);
}

/** Tries again after `restore-failed`: the network was down when the page opened. */
export function retryRestoreSession(): void {
  void restoreSession();
}
