import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { ForgotPasswordPage, ResetPasswordPage } from '@/features/auth';
import { ThemeProvider } from '@/shared/theme';

const LOGIN = '/login';
const FORGOT = '/esqueci-senha';
const RESET = '/redefinir-senha';

/**
 * The two public screens of the password recovery, as they run for a visitor:
 * no session, and a sign-in to land on. The sign-in is a stand-in that only says
 * where it is — what it does is tested with the real one.
 */
function renderRecovery(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      { path: LOGIN, element: <p>Você está na tela de login.</p> },
      { path: FORGOT, element: <ForgotPasswordPage loginPath={LOGIN} /> },
      {
        path: RESET,
        element: <ResetPasswordPage loginPath={LOGIN} forgotPasswordPath={FORGOT} />,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  const view = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>,
  );

  return { ...view, queryClient, router };
}

export function renderForgotPassword() {
  return renderRecovery(FORGOT);
}

/** The link of the e-mail, opened: the code is in the fragment of the address. */
export function renderResetPassword(hash = '') {
  return renderRecovery(`${RESET}${hash}`);
}
