import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { SessionProvider } from '@/features/auth';
import { createQueryClient } from '@/shared/api/query-client';
import { ThemeProvider, useTheme } from '@/shared/theme';

/**
 * The toaster draws its own surface, so it is told which theme is on screen:
 * one of the few places that has to know, because the library keeps its colours
 * to itself instead of reading the tokens.
 */
function ThemedToaster() {
  const { theme } = useTheme();

  return <Toaster position="top-right" richColors closeButton theme={theme} />;
}

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
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
