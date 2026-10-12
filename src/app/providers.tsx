import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

import { createQueryClient } from '@/shared/api/query-client';

/**
 * Everything the tree needs, in one place.
 *
 * The client is built inside `useState` rather than at module scope so each
 * test gets a cache of its own — a cache shared between tests is a test that
 * passes because of the one before it.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
