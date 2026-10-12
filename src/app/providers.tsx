import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

import { SessionProvider } from '@/features/auth';
import { createQueryClient } from '@/shared/api/query-client';

/**
 * Everything the tree needs, in one place.
 *
 * The client is built inside `useState` rather than at module scope so each
 * test gets a cache of its own — a cache shared between tests is a test that
 * passes because of the one before it. A test that needs to look inside the
 * cache hands its own in.
 */
export function Providers({
  children,
  queryClient: provided,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}) {
  const [created] = useState(createQueryClient);
  const queryClient = provided ?? created;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
