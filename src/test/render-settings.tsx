import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { SettingsPage } from '@/features/settings';
import { establishSession } from '@/shared/api/session';

import { authResponse } from './auth';

/** The settings as they run, for the person who is signed in. The API is whatever MSW answers. */
export function renderSettings() {
  establishSession(authResponse());

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter([{ path: '/configuracoes', element: <SettingsPage /> }], {
    initialEntries: ['/configuracoes'],
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );

  return { ...view, queryClient, router };
}
