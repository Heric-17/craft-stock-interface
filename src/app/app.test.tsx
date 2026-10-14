import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from '@/features/auth';
import { ApiError } from '@/shared/api/api-error';
import { refreshSucceeds } from '@/test/auth';
import { materialsHandlers } from '@/test/fixtures/materials';
import { server } from '@/test/msw/server';
import { PHONE_WIDTH, setViewportWidth } from '@/test/viewport';

import { AppShell } from './app-shell';
import { Providers } from './providers';
import { RouteErrorBoundary } from './route-error-boundary';
import { routes } from './router';

/**
 * Mounts the real application: the same route table, the same providers, the
 * same shell. Only the history is in memory. The session is restored over the
 * network, answered by MSW.
 */
function renderApp(initialPath = '/', routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [initialPath] });

  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );

  return router;
}

/** The sidebar of a desktop, or the open drawer of a phone: either way, the menu. */
function menu() {
  return screen.getByRole('navigation', { name: 'Seções' });
}

function breadcrumb() {
  return screen.getByRole('navigation', { name: 'Você está em' });
}

/**
 * Every entry of the menu, with the screen it opens. `built` marks the screens
 * that are no longer a placeholder: they are checked by their own tests, and
 * the "em construção" notice is only expected of the ones still waiting.
 */
const SCREENS: readonly {
  link: string;
  heading: string;
  path: string;
  built?: boolean;
}[] = [
  { link: 'Importar nota', heading: 'Importar nota fiscal', path: '/importar-nota' },
  { link: 'Insumos', heading: 'Insumos', path: '/insumos', built: true },
  { link: 'Fichas técnicas', heading: 'Fichas técnicas', path: '/fichas-tecnicas' },
  { link: 'Vendas', heading: 'Vendas', path: '/vendas' },
  { link: 'Insumos faltantes', heading: 'Insumos faltantes', path: '/insumos-faltantes' },
  { link: 'Gastos da empresa', heading: 'Gastos da empresa', path: '/gastos' },
  { link: 'Minhas atividades', heading: 'Minhas atividades', path: '/atividades' },
  { link: 'Configurações', heading: 'Configurações', path: '/configuracoes' },
];

describe('application shell', () => {
  // The shell is behind the guard: a session the browser still holds opens it.
  // `/insumos` is a real screen now, so the API it reads answers too.
  beforeEach(() => {
    server.use(refreshSucceeds(), ...materialsHandlers());
  });

  it('opens on the invoice import screen, with the installation name in the sidebar', async () => {
    const router = renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Importar nota fiscal', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/importar-nota');
    expect(screen.getAllByText('Ateliê de Teste').length).toBeGreaterThan(0);
  });

  it('groups the menu as the mockups do', async () => {
    renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    const groups = within(menu())
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(groups).toEqual([
      'Importar nota',
      'Insumos',
      'Fichas técnicas',
      'Vendas',
      'Insumos faltantes',
      'Gastos da empresa',
    ]);
    for (const label of ['Operação', 'Estoque', 'Comercial', 'Financeiro']) {
      expect(within(menu()).getByText(label)).toBeInTheDocument();
    }
    // Below the groups, outside the nav list: activity and settings.
    expect(screen.getByRole('link', { name: 'Minhas atividades' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurações' })).toBeInTheDocument();
  });

  it('shows the signed-in person’s name and e-mail, and a way to sign out', async () => {
    renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    expect(screen.getByText('Marina')).toBeInTheDocument();
    expect(screen.getByText('marina@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('shows no company switcher, plan, role or notification bell', async () => {
    renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    expect(screen.queryByText(/plano/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/administradora/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifica/i })).not.toBeInTheDocument();
    // The company name is plain text, not a dropdown: nothing in the shell is
    // a select. (The screen below it may have its own, like the stock filter.)
    expect(within(menu()).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(breadcrumb().closest('header')!).queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ateliê/i })).not.toBeInTheDocument();
  });

  it('navigates between every signed-in screen from the menu', async () => {
    const user = userEvent.setup();
    const router = renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    for (const target of SCREENS) {
      await user.click(screen.getByRole('link', { name: target.link }));

      expect(await screen.findByRole('heading', { name: target.heading, level: 1 })).toBeVisible();
      expect(router.state.location.pathname).toBe(target.path);
      // A screen that is not built yet says so instead of showing a blank area.
      if (target.built !== true) {
        expect(screen.getByText('Esta tela está em construção')).toBeInTheDocument();
      }
      // The menu marks where you are, and the breadcrumb says it too.
      expect(screen.getByRole('link', { name: target.link })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(breadcrumb()).getByText(target.link)).toHaveAttribute('aria-current', 'page');
    }
  });

  it('shows the breadcrumb as CraftStock, then the current screen', async () => {
    renderApp('/vendas');
    await screen.findByRole('heading', { name: 'Vendas', level: 1 });

    const crumbs = within(breadcrumb()).getAllByRole('listitem');

    expect(crumbs.map((crumb) => crumb.textContent)).toEqual(['CraftStock', 'Vendas']);
    expect(within(breadcrumb()).getByRole('link', { name: 'CraftStock' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('answers an unknown address with a page that says so', async () => {
    renderApp('/rota-que-nao-existe');

    expect(
      await screen.findByRole('heading', { name: 'Esta página não existe' }),
    ).toBeInTheDocument();
    // Inside the frame: the menu is still there to leave by.
    expect(menu()).toBeInTheDocument();
  });

  it('keeps the skip link to the content first in the document', async () => {
    renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    expect(screen.getAllByRole('link')[0]).toHaveAccessibleName('Pular para o conteúdo');
  });
});

describe('application shell on a phone', () => {
  beforeEach(() => {
    server.use(refreshSucceeds(), ...materialsHandlers());
    setViewportWidth(PHONE_WIDTH);
  });

  it('has no sidebar: the menu is a drawer a button opens', async () => {
    renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    expect(screen.queryByRole('navigation', { name: 'Seções' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument();
  });

  it('opens the drawer, navigates from it, and closes it behind the choice', async () => {
    const user = userEvent.setup();
    const router = renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Menu de navegação' });
    expect(within(drawer).getByRole('navigation', { name: 'Seções' })).toBeInTheDocument();
    expect(within(drawer).getByText('marina@exemplo.com.br')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('link', { name: 'Vendas' }));

    expect(await screen.findByRole('heading', { name: 'Vendas', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/vendas');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer with Escape and gives the focus back to the button', async () => {
    const user = userEvent.setup();
    renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    const opener = screen.getByRole('button', { name: 'Abrir menu' });
    await user.click(opener);
    await screen.findByRole('dialog', { name: 'Menu de navegação' });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('puts the sidebar back when the window grows past the breakpoint', async () => {
    renderApp('/insumos');
    await screen.findByRole('heading', { name: 'Insumos', level: 1 });

    setViewportWidth(1280);

    expect(await screen.findByRole('navigation', { name: 'Seções' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument();
  });
});

describe('a screen that fails', () => {
  beforeEach(() => {
    server.use(refreshSucceeds());
  });

  function Broken(): never {
    throw new ApiError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      error: 'InternalServerError',
      message: 'Internal server error',
      path: '/materials',
      timestamp: '2026-10-12T12:00:00.000Z',
      correlationId: 'corr-route-1',
      errorId: 'err-route-500',
    });
  }

  const brokenRoutes: RouteObject[] = [
    {
      element: <RequireAuth />,
      children: [
        {
          path: '/',
          element: <AppShell />,
          children: [
            {
              path: '/quebrada',
              element: <Broken />,
              handle: { crumb: 'Quebrada' },
              errorElement: <RouteErrorBoundary />,
            },
            { path: '/insumos', element: <h1>Insumos</h1>, handle: { crumb: 'Insumos' } },
          ],
        },
      ],
    },
  ];

  it('shows the support code inside the frame, with the menu still working', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderApp('/quebrada', brokenRoutes);

    expect(await screen.findByText('err-route-500')).toBeInTheDocument();
    expect(screen.getByText('Envie este código para o suporte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    // Nothing technical leaks.
    expect(document.body.textContent).not.toContain('INTERNAL_ERROR');
    expect(document.body.textContent).not.toContain('Internal server error');

    // The failure is the screen's, not the application's: the way out is intact.
    await user.click(screen.getByRole('link', { name: 'Insumos' }));
    expect(await screen.findByRole('heading', { name: 'Insumos' })).toBeInTheDocument();
    expect(screen.queryByText('err-route-500')).not.toBeInTheDocument();
  });
});
