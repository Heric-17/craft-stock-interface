import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { NewSalePage, SaleDetailPage, SalesPage } from '@/features/sales';

/**
 * The sales screens as they run: the history as the index of its path and the
 * registration and the detail as siblings of it, the same shape the
 * application's route table gives them, so the relative links between them
 * resolve exactly as they do there. A stand-in for the products' screen lets a
 * test see where a link to a product lands. The API is whatever MSW answers.
 */
export function renderSales(route = '/vendas') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/vendas',
        children: [
          { index: true, element: <SalesPage newSalePath="nova" /> },
          { path: 'nova', element: <NewSalePage /> },
          { path: ':id', element: <SaleDetailPage productPath="/fichas-tecnicas" /> },
        ],
      },
      { path: '/fichas-tecnicas/:id', element: <p>Tela da ficha técnica</p> },
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
