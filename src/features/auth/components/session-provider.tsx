import type { ReactNode } from 'react';

import { useSessionLifecycle } from '../api/use-session';

/**
 * Mounts the session's lifecycle at the root: restoring it on load and
 * emptying the cache when it ends. Renders nothing of its own.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  useSessionLifecycle();

  return children;
}
