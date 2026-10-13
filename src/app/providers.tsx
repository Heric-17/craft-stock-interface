import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { SessionProvider } from '@/features/auth';
import { createQueryClient } from '@/shared/api/query-client';
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
