import type { ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { LoginPage, RequireAuth } from '@/features/auth';
import { AppShell } from './app-shell';
import {
  ActivityPage,
  CompositeProductEditorPage,
  CompositeProductsPage,
  ImportedInvoicesPage,
  InvoiceClassificationPage,
  InvoiceImportPage,
  MaterialLossesPage,
  MaterialsPage,
  NewSalePage,
  SaleDetailPage,
  SalesPage,
  SettingsPage,
  ShortagesPage,
  SpendingPage,
} from './lazy-pages';
import {
  COMPOSITE_PRODUCT_ROUTES,
  classificationPath,
  HOME_PATH,
  IMPORTED_INVOICES_PATH,
  INVOICE_ROUTES,
  MATERIAL_ROUTES,
  NAV,
  SALE_ROUTES,
  type NavEntry,
} from './navigation';
import { NotFoundPage } from './pages/not-found-page';
import { RouteErrorBoundary } from './route-error-boundary';
import type { RouteHandle } from './route-handle';
function screen(entry: NavEntry, Page: ComponentType): RouteObject {
  const handle: RouteHandle = { crumb: entry.label };
  return {
    path: entry.path,
    element: <Page />,
    handle,
    errorElement: <RouteErrorBoundary />,
  };
}
/**
 * The list of products and the editor under it. The list is the index of its
 * own path, and the editor is a sibling screen of it, so a link between them
 * can be relative and never spells an address.
 */
function compositeProductRoutes(): RouteObject {
  const handle: RouteHandle = { crumb: NAV.compositeProducts.label };

  return {
    path: NAV.compositeProducts.path,
    handle,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <CompositeProductsPage newProductPath={COMPOSITE_PRODUCT_ROUTES.new} />,
      },
      {
        path: COMPOSITE_PRODUCT_ROUTES.new,
        element: <CompositeProductEditorPage />,
        handle: { crumb: 'Nova ficha técnica' } satisfies RouteHandle,
      },
      {
        path: COMPOSITE_PRODUCT_ROUTES.detail,
        element: <CompositeProductEditorPage />,
        handle: { crumb: 'Editar ficha técnica' } satisfies RouteHandle,
      },
    ],
  };
}

/**
 * The capture screen and the second step under it. The capture screen is the
 * index of its own path and the classification a sibling of it, so the links
 * between them are relative and never spell an address.
 */
function invoiceRoutes(): RouteObject {
  const handle: RouteHandle = { crumb: NAV.invoices.label };

  return {
    path: NAV.invoices.path,
    handle,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <InvoiceImportPage
            classificationPath={classificationPath}
            historyPath={IMPORTED_INVOICES_PATH}
          />
        ),
      },
      {
        path: INVOICE_ROUTES.imported,
        element: (
          <ImportedInvoicesPage
            classificationPath={classificationPath}
            importPath={NAV.invoices.path}
          />
        ),
        handle: { crumb: 'Notas importadas' } satisfies RouteHandle,
      },
      {
        path: INVOICE_ROUTES.classify,
        element: <InvoiceClassificationPage historyPath={IMPORTED_INVOICES_PATH} />,
        handle: { crumb: 'Classificar nota' } satisfies RouteHandle,
      },
    ],
  };
}

/**
 * The list of materials and the loss history under it, the same way as the
 * products: the list is the index of its own path and the history a sibling
 * screen, so the links between them are relative.
 */
function materialRoutes(): RouteObject {
  const handle: RouteHandle = { crumb: NAV.materials.label };

  return {
    path: NAV.materials.path,
    handle,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <MaterialsPage lossesPath={MATERIAL_ROUTES.losses} /> },
      {
        path: MATERIAL_ROUTES.losses,
        element: <MaterialLossesPage />,
        handle: { crumb: 'Perdas' } satisfies RouteHandle,
      },
    ],
  };
}

/**
 * The sales history, the screen to register one and the detail of one. The
 * history is the index of its own path and the other two are siblings of it,
 * so the links between them are relative and never spell an address. The detail
 * links to the products by their address, which only this table knows.
 */
function saleRoutes(): RouteObject {
  const handle: RouteHandle = { crumb: NAV.sales.label };

  return {
    path: NAV.sales.path,
    handle,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <SalesPage newSalePath={SALE_ROUTES.new} /> },
      {
        path: SALE_ROUTES.new,
        element: <NewSalePage />,
        handle: { crumb: 'Nova venda' } satisfies RouteHandle,
      },
      {
        path: SALE_ROUTES.detail,
        element: <SaleDetailPage productPath={NAV.compositeProducts.path} />,
        handle: { crumb: 'Detalhe da venda' } satisfies RouteHandle,
      },
    ],
  };
}

/**
 * What is missing for the open sales. A screen of its own, but it links to the
 * sales for the day there is nothing to count, by their address, which only this
 * table knows.
 */
function shortageRoute(): RouteObject {
  const handle: RouteHandle = { crumb: NAV.shortages.label };

  return {
    path: NAV.shortages.path,
    element: <ShortagesPage salesPath={NAV.sales.path} />,
    handle,
    errorElement: <RouteErrorBoundary />,
  };
}

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to={HOME_PATH} replace /> },
          invoiceRoutes(),
          materialRoutes(),
          compositeProductRoutes(),
          saleRoutes(),
          shortageRoute(),
          screen(NAV.spending, SpendingPage),
          screen(NAV.activity, ActivityPage),
          screen(NAV.settings, SettingsPage),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
