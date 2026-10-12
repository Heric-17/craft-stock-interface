import type { RouteObject } from 'react-router';

import { AppShell } from './app-shell';
import { HomePage } from './pages/home-page';
import { NotFoundPage } from './pages/not-found-page';
import { RouteErrorBoundary } from './route-error-boundary';

/**
 * The route table, exported as data so the application and the tests mount the
 * same thing — one through the browser's history, the other through an
 * in-memory one.
 *
 * Feature routes are loaded on demand as they are built (`lazy`), so a screen
 * nobody opened is a bundle nobody downloaded.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
