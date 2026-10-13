import type { ReactNode } from 'react';
import { useSessionLifecycle } from '../api/use-session';
export function SessionProvider({ children }: { children: ReactNode }) {
  useSessionLifecycle();
  return children;
}
