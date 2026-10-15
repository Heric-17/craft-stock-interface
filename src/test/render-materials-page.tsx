import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { MaterialLossesPage, MaterialsPage } from '@/features/materials';

/**
 * The materials screens as they run: a query client that does not retry, a
 * router with the list as the index of its path and the loss history as a
 * sibling — the shape the application's route table gives them, so the
 * relative links between the two resolve as they do there — and the toaster,
 * since most of what the screen says after an action is a toast. The API is
 * whatever MSW answers — nothing here replaces `fetch`.
 */
export function renderMaterialsPage(route = '/insumos') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/insumos',
        children: [
          { index: true, element: <MaterialsPage lossesPath="perdas" /> },
          { path: 'perdas', element: <MaterialLossesPage /> },
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

/** The row of the list for a material, by the name on it. */
export function rowOf(name: string): HTMLElement {
  const link = screen.getByRole('link', { name: new RegExp(name) });

  return link.closest('tr') ?? link.closest('li') ?? link;
}

export function inRow(name: string) {
  return within(rowOf(name));
}
