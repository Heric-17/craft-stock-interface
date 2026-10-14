import type { ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { LoginPage, RequireAuth } from '@/features/auth';
import { AppShell } from './app-shell';
import {
  ActivityPage,
  CompositeProductEditorPage,
  CompositeProductsPage,
  InvoiceImportPage,
  MaterialsPage,
  SalesPage,
  SettingsPage,
  ShortagesPage,
  SpendingPage,
} from './lazy-pages';
import { COMPOSITE_PRODUCT_ROUTES, HOME_PATH, NAV, type NavEntry } from './navigation';
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
          screen(NAV.invoices, InvoiceImportPage),
          screen(NAV.materials, MaterialsPage),
          compositeProductRoutes(),
          screen(NAV.sales, SalesPage),
          screen(NAV.shortages, ShortagesPage),
          screen(NAV.spending, SpendingPage),
          screen(NAV.activity, ActivityPage),
          screen(NAV.settings, SettingsPage),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
