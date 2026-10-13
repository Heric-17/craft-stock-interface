import type { ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { LoginPage, RequireAuth } from '@/features/auth';
import { AppShell } from './app-shell';
import {
  ActivityPage,
  CompositeProductsPage,
  InvoiceImportPage,
  MaterialsPage,
  SalesPage,
  SettingsPage,
  ShortagesPage,
  SpendingPage,
} from './lazy-pages';
import { HOME_PATH, NAV, type NavEntry } from './navigation';
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
          screen(NAV.compositeProducts, CompositeProductsPage),
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
