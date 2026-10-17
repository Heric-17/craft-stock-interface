import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { InvoiceClassificationPage } from '@/features/invoices';

/**
 * The second step as it runs: the classification route under the capture
 * screen's path, with a stand-in where the list of notes is, so a test can see
 * where a concluded note goes. The API is whatever MSW answers.
 */
export function renderClassification(purchaseId = 'compra-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/importar-nota',
        children: [
          { index: true, element: <p>Tela de importar nota</p> },
          {
            path: 'classificar/:purchaseId',
            element: <InvoiceClassificationPage historyPath="/compras" />,
          },
        ],
      },
      { path: '/compras', element: <p>Tela das compras</p> },
    ],
    { initialEntries: [`/importar-nota/classificar/${purchaseId}`] },
  );

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );

  return { ...view, queryClient, router };
}
