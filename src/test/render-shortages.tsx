import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { ShortagesPage } from '@/features/shortages';

/**
 * The shortages screen as it runs, with a stand-in for the sales so a test can
 * see where its link lands. The API is whatever MSW answers.
 */
export function renderShortages(route = '/insumos-faltantes') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      { path: '/insumos-faltantes', element: <ShortagesPage salesPath="/vendas" /> },
      { path: '/vendas', element: <p>Tela das vendas</p> },
    ],
    { initialEntries: [route] },
  );

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );

  return { ...view, queryClient, router };
}
