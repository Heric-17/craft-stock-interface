import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { ImportedInvoicesPage, InvoiceImportPage } from '@/features/invoices';

import { ClassificationStandIn } from './classification-stand-in';

/**
 * The capture screen as it runs: the index of its path, with the second step as
 * a sibling — the shape the route table gives them, so the relative links
 * between the two resolve exactly as they do there. A stand-in for the second
 * step lets a test see where a link lands. The API is whatever MSW answers.
 */
export function renderInvoices(route = '/importar-nota') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/importar-nota',
        children: [
          {
            index: true,
            element: (
              <InvoiceImportPage
                classificationPath={(purchaseId) => `/importar-nota/classificar/${purchaseId}`}
                historyPath="/importar-nota/notas"
              />
            ),
          },
          {
            path: 'notas',
            element: (
              <ImportedInvoicesPage
                importPath="/importar-nota"
                classificationPath={(purchaseId) => `/importar-nota/classificar/${purchaseId}`}
              />
            ),
          },
          { path: 'classificar/:purchaseId', element: <ClassificationStandIn /> },
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
