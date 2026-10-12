import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { refreshSucceeds } from '@/test/auth';
import { server } from '@/test/msw/server';

import { Providers } from './providers';
import { routes } from './router';

/**
 * Mounts the real application: the same route table, the same providers, the
 * same shell. Only the history is in memory. The session is restored over the
 * network, answered by MSW.
 */
function renderApp(initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });

  return render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
}

describe('application', () => {
  // The shell is behind the guard: a session the browser still holds opens it.
  beforeEach(() => {
    server.use(refreshSucceeds());
  });

  it('renders the shell with the installation name', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'CraftStock' })).toBeInTheDocument();
    expect(screen.getAllByText('Ateliê de Teste').length).toBeGreaterThan(0);
  });

  it('shows no company switcher, plan or role: there is one installation and no roles', async () => {
    renderApp();

    await screen.findByRole('heading', { name: 'CraftStock' });

    expect(screen.queryByText(/plano/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/administradora/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifica/i })).not.toBeInTheDocument();
  });

  it('answers an unknown address with a page that says so', async () => {
    renderApp('/rota-que-nao-existe');

    expect(
      await screen.findByRole('heading', { name: 'Esta página não existe' }),
    ).toBeInTheDocument();
  });

  it('opens and closes the navigation drawer on a narrow screen', async () => {
    const user = userEvent.setup();
    renderApp();

    const toggle = await screen.findByRole('button', { name: 'Abrir menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getAllByRole('button', { name: 'Fechar menu' })[0]!);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
