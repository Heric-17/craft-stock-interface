import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Toaster } from 'sonner';

import { MaterialsPage } from '@/features/materials';

/**
 * The materials screen as it runs: a query client that does not retry, a
 * router, and the toaster, since most of what the screen says after an action
 * is a toast. The API is whatever MSW answers — nothing here replaces `fetch`.
 */
export function renderMaterialsPage(route = '/insumos') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <MaterialsPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
}

/** The row of the list for a material, by the name on it. */
export function rowOf(name: string): HTMLElement {
  const link = screen.getByRole('link', { name: new RegExp(name) });

  return link.closest('tr') ?? link.closest('li') ?? link;
}

export function inRow(name: string) {
  return within(rowOf(name));
}
