import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { CompositeProductEditorPage, CompositeProductsPage } from '@/features/composite-products';

/**
 * The composite-products screens as they run: the list as the index of its
 * path and the editor as a sibling of it, the same shape the application's
 * route table gives them, so that the relative links between the two resolve
 * exactly as they do there. The API is whatever MSW answers.
 */
export function renderCompositeProducts(route = '/fichas-tecnicas') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/fichas-tecnicas',
        children: [
          { index: true, element: <CompositeProductsPage newProductPath="nova" /> },
          { path: 'nova', element: <CompositeProductEditorPage /> },
          { path: ':id', element: <CompositeProductEditorPage /> },
        ],
      },
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
