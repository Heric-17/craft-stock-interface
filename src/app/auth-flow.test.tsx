import type { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/shared/api/query-client';
import { env } from '@/shared/config/env';
import {
  authResponse,
  invalidRefreshTokenBody,
  marina,
  refreshRefused,
  refreshSucceeds,
} from '@/test/auth';
import { server } from '@/test/msw/server';
import { probeRequest } from '@/test/probe-request';

import { Providers } from './providers';
import { routes } from './router';

const API = env.VITE_API_URL;

function renderApp(initialPath: string, queryClient: QueryClient = createQueryClient()) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const visited: string[] = [];

  router.subscribe((state) => {
    visited.push(`${state.location.pathname}${state.location.search}`);
  });

  render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );

  return { router, queryClient, visited };
}

function locationOf(router: ReturnType<typeof renderApp>['router']): string {
  return `${router.state.location.pathname}${router.state.location.search}`;
}

function loginAnswers(
  status: number,
  body: Record<string, unknown> | ReturnType<typeof authResponse>,
) {
  const received: unknown[] = [];

  server.use(
    http.post(`${API}/auth/login`, async ({ request }) => {
      received.push(await request.json());
      return HttpResponse.json(body, { status });
    }),
  );

  return received;
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, password = 'senha-correta') {
  await user.type(screen.getByLabelText('E-mail'), 'marina@exemplo.com.br');
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

const noToastOnScreen = () => document.querySelector('[data-sonner-toast]');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('opening the application', () => {
  it('restores a valid session without ever showing the login', async () => {
    server.use(refreshSucceeds());
    const { visited } = renderApp('/');

    // The few moments before the answer: neutral, not the login.
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'CraftStock' })).toBeInTheDocument();
    expect(screen.getByText(marina.email)).toBeInTheDocument();
    expect(visited.some((entry) => entry.startsWith('/login'))).toBe(false);
  });

  it('goes to the login, quietly, when there is no session', async () => {
    server.use(refreshRefused());
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();

    expect(locationOf(router)).toBe('/login');
    // A visitor is not a failure: no alert, no toast, no support code.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(noToastOnScreen()).toBeNull();
    expect(document.body.textContent).not.toContain('Envie este código');
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
  });

  it('remembers the page the visitor asked for, and returns there after signing in', async () => {
    server.use(refreshRefused());
    loginAnswers(200, authResponse('login-token'));
    const user = userEvent.setup();
    const { router } = renderApp('/uma-pagina?aba=2');

    await screen.findByRole('heading', { name: 'Entrar' });
    expect(locationOf(router)).toBe('/login?redirect=%2Fuma-pagina%3Faba%3D2');

    await fillAndSubmit(user);

    expect(
      await screen.findByRole('heading', { name: 'Esta página não existe' }),
    ).toBeInTheDocument();
    expect(locationOf(router)).toBe('/uma-pagina?aba=2');
  });

  it('does not follow a redirect to another site', async () => {
    server.use(refreshRefused());
    loginAnswers(200, authResponse('login-token'));
    const user = userEvent.setup();
    const { router } = renderApp('/login?redirect=https%3A%2F%2Fevil.example%2Fphish');

    await screen.findByRole('heading', { name: 'Entrar' });
    await fillAndSubmit(user);

    await screen.findByRole('heading', { name: 'CraftStock' });
    expect(locationOf(router)).toBe('/');
  });

  it('takes someone who is already signed in past the login', async () => {
    server.use(refreshSucceeds());
    const { router } = renderApp('/login?redirect=%2Fonde-eu-estava');

    expect(
      await screen.findByRole('heading', { name: 'Esta página não existe' }),
    ).toBeInTheDocument();
    expect(locationOf(router)).toBe('/onde-eu-estava');
  });

  it('does not take a failed check for a visitor: it says so, and tries again on request', async () => {
    let attempts = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.error() : HttpResponse.json(authResponse());
      }),
    );
    const user = userEvent.setup();
    const { visited } = renderApp('/');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Verifique a conexão');
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'CraftStock' })).toBeInTheDocument();
    expect(visited.some((entry) => entry.startsWith('/login'))).toBe(false);
  });
});

describe('signing in', () => {
  it('shows a wrong password on the form, in Portuguese, and stays on the login', async () => {
    server.use(refreshRefused());
    let refreshCalls = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(invalidRefreshTokenBody(), { status: 401 });
      }),
    );
    loginAnswers(401, {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      error: 'InvalidCredentialsError',
      message: 'Invalid email or password.',
      correlationId: 'corr-login',
    });
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await screen.findByRole('heading', { name: 'Entrar' });
    await fillAndSubmit(user, 'senha-errada');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(locationOf(router)).toBe('/login');
    expect(screen.getByLabelText('E-mail')).toHaveValue('marina@exemplo.com.br');
    expect(screen.queryByText(/Invalid email/)).not.toBeInTheDocument();
    // A 401 on the login is its answer, not a cue to renew a session that does not exist.
    expect(refreshCalls).toBe(1);
  });

  it('asks for what is missing without sending anything', async () => {
    server.use(refreshRefused());
    const received = loginAnswers(200, authResponse());
    const user = userEvent.setup();
    renderApp('/');

    await screen.findByRole('heading', { name: 'Entrar' });
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    expect(received).toHaveLength(0);
  });

  it('marks the field the API refused, by the path it reports', async () => {
    server.use(refreshRefused());
    loginAnswers(400, {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      error: 'ValidationFailedError',
      message: 'Validation failed',
      details: [{ path: 'email', constraints: ['email must be an email'] }],
    });
    const user = userEvent.setup();
    renderApp('/');

    await screen.findByRole('heading', { name: 'Entrar' });
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Confira os campos destacados');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Senha')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/must be an email/)).not.toBeInTheDocument();
  });

  it('reports a failure of ours as a toast with the support code, not on the form', async () => {
    server.use(refreshRefused());
    loginAnswers(500, {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      error: 'InternalServerError',
      message: 'Internal server error',
      errorId: 'err-login-500',
    });
    const user = userEvent.setup();
    renderApp('/');

    await screen.findByRole('heading', { name: 'Entrar' });
    await fillAndSubmit(user);

    expect(await screen.findByText(/err-login-500/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('marina@exemplo.com.br');
  });

  it('blocks a second submit while the first is in flight', async () => {
    server.use(refreshRefused());
    let received = 0;
    server.use(
      http.post(`${API}/auth/login`, async () => {
        received += 1;
        await delay(80);
        return HttpResponse.json(authResponse());
      }),
    );
    const user = userEvent.setup();
    renderApp('/');

    await screen.findByRole('heading', { name: 'Entrar' });
    await fillAndSubmit(user);

    const pending = await screen.findByRole('button', { name: 'Entrando…' });
    expect(pending).toBeDisabled();
    await user.click(pending);

    await screen.findByRole('heading', { name: 'CraftStock' });
    expect(received).toBe(1);
  });

  it('keeps the token in memory only: nothing in browser storage, nothing in the console', async () => {
    server.use(refreshRefused());
    loginAnswers(200, authResponse('secret-access-token'));
    const storageWrites = vi.spyOn(Storage.prototype, 'setItem');
    const consoleCalls = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const user = userEvent.setup();
    renderApp('/');

    await screen.findByRole('heading', { name: 'Entrar' });
    await fillAndSubmit(user, 'senha-secreta');
    await screen.findByRole('heading', { name: 'CraftStock' });

    expect(storageWrites).not.toHaveBeenCalled();

    const everythingLogged = JSON.stringify(consoleCalls.flatMap((spy) => spy.mock.calls));
    expect(everythingLogged).not.toContain('secret-access-token');
    expect(everythingLogged).not.toContain('senha-secreta');
  });
});

describe('a session that ends', () => {
  it('goes to the login with the page it was on, clears the cache, and says the session expired', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;

        return refreshCalls === 1
          ? HttpResponse.json(authResponse('first-token'))
          : HttpResponse.json(invalidRefreshTokenBody(), { status: 401 });
      }),
      http.get(`${API}/probe`, () =>
        HttpResponse.json(
          { statusCode: 401, code: 'UNAUTHORIZED', error: 'UnauthorizedException', message: 'no' },
          { status: 401 },
        ),
      ),
    );
    const queryClient = createQueryClient();
    queryClient.setQueryData(['materials'], [{ id: 'm1' }]);
    const { router } = renderApp('/onde-eu-estava', queryClient);

    await screen.findByRole('heading', { name: 'Esta página não existe' });
    expect(queryClient.getQueryData(['materials'])).toBeDefined();

    await act(async () => {
      await queryClient
        .fetchQuery({ queryKey: ['probe'], queryFn: () => probeRequest('/probe'), retry: false })
        .catch(() => undefined);
    });

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(locationOf(router)).toBe('/login?redirect=%2Fonde-eu-estava');
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou');
    expect(queryClient.getQueryData(['materials'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(refreshCalls).toBe(2);
  });

  it('signs out through the API, clears the cache, and lands on the bare login', async () => {
    server.use(refreshSucceeds());
    let logoutCalls = 0;
    server.use(
      http.post(`${API}/auth/logout`, () => {
        logoutCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const queryClient = createQueryClient();
    queryClient.setQueryData(['materials'], [{ id: 'm1' }]);
    const user = userEvent.setup();
    const { router } = renderApp('/onde-eu-estava', queryClient);

    await screen.findByRole('heading', { name: 'Esta página não existe' });
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(logoutCalls).toBe(1);
    // Choosing to leave is not an expiry, and the page just left is not a destination.
    expect(locationOf(router)).toBe('/login');
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('stays signed in, and says why, when the API could not be told to sign out', async () => {
    server.use(
      refreshSucceeds(),
      http.post(`${API}/auth/logout`, () =>
        HttpResponse.json(
          {
            statusCode: 500,
            code: 'INTERNAL_ERROR',
            error: 'InternalServerError',
            message: 'Internal server error',
            errorId: 'err-logout-500',
          },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await screen.findByRole('heading', { name: 'CraftStock' });
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByText(/err-logout-500/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled());
    expect(locationOf(router)).toBe('/');
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
