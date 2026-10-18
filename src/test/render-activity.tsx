import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ActivityPage } from '@/features/activity';
import { establishSession } from '@/shared/api/session';

import { authResponse } from './auth';

/**
 * The activity screen as it runs, for the person who is signed in: the sentences
 * say "Você" for the entries made by that session's user. The API is whatever
 * MSW answers.
 */
export function renderActivity() {
  establishSession(authResponse());

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter([{ path: '/atividades', element: <ActivityPage /> }], {
    initialEntries: ['/atividades'],
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...view, queryClient, router };
}
