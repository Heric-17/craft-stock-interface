import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { PurchaseDetailPage, PurchasesPage, SpendingPage } from '@/features/spending';

import { ClassificationStandIn } from './classification-stand-in';

const purchasePath = (purchaseId: string) => `/compras/${purchaseId}`;
const classificationPath = (purchaseId: string) => `/importar-nota/classificar/${purchaseId}`;

/**
 * The spending screens as they run: the panel, and the list of purchases with its
 * detail as siblings under their own path, the shape the route table gives them.
 * Stand-ins for the capture screen and the classification let a test see where a
 * link lands. The API is whatever MSW answers.
 */
export function renderSpending(route = '/gastos') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/gastos',
        element: (
          <SpendingPage
            purchasesPath="/compras"
            purchasePath={purchasePath}
            importPath="/importar-nota"
          />
        ),
      },
      {
        path: '/compras',
        children: [
          {
            index: true,
            element: (
              <PurchasesPage
                purchasePath={purchasePath}
                classificationPath={classificationPath}
                spendingPath="/gastos"
                importPath="/importar-nota"
              />
            ),
          },
          {
            path: ':id',
            element: (
              <PurchaseDetailPage
                purchasesPath="/compras"
                classificationPath={classificationPath}
              />
            ),
          },
        ],
      },
      { path: '/importar-nota', element: <p>Tela da importação</p> },
      { path: '/importar-nota/classificar/:purchaseId', element: <ClassificationStandIn /> },
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
