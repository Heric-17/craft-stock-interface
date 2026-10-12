import type { RouteObject } from 'react-router';

import { LoginPage, RequireAuth } from '@/features/auth';

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
 * nobody opened is a bundle nobody downloaded. Authentication is the exception:
 * the guard and the login are needed on the first paint of every visit.
 *
 * `/login` is the only route outside the guard.
 */
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
          { index: true, element: <HomePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
