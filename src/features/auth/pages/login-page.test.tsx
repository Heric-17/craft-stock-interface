import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/shared/theme';
import { refreshRefused } from '@/test/auth';
import { server } from '@/test/msw/server';

import { SessionProvider } from '../components/session-provider';

import { LoginPage } from './login-page';

const PHONE_WIDTH = 360;

/**
 * The login on a phone.
 *
 * jsdom does no layout, so it cannot measure a width or detect a horizontal
 * scrollbar: those are checked in a real browser at 360, 768 and 1280px (see
 * the closing verification). What jsdom can pin is the contract that makes the
 * screen work at that width — the task is possible, every control is a thumb
 * wide, nothing is given a fixed width, and the layout is one column below `md`
 * — so a later edit that breaks it fails here instead of on a phone at the bench.
 */
describe('the login at 360px', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = PHONE_WIDTH;
    server.use(refreshRefused());
  });

  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  async function renderLogin() {
    const view = render(
      <ThemeProvider>
        <QueryClientProvider client={new QueryClient()}>
          <SessionProvider>
            <MemoryRouter initialEntries={['/login']}>
              <LoginPage />
            </MemoryRouter>
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );

    await screen.findByRole('heading', { name: 'Entrar' });

    return view;
  }

  it('lets the whole task be done: both fields and the button are on screen and enabled', async () => {
    await renderLogin();

    expect(screen.getByLabelText('E-mail')).toBeEnabled();
    expect(screen.getByLabelText('Senha')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('asks the phone for the right keyboard and lets the browser fill the fields in', async () => {
    await renderLogin();

    const email = screen.getByLabelText('E-mail');

    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('makes every control at least 44px tall, the floor for a thumb', async () => {
    await renderLogin();

    // Tailwind's h-11 is 2.75rem = 44px; h-12 is 48px.
    for (const control of [
      screen.getByLabelText('E-mail'),
      screen.getByLabelText('Senha'),
      screen.getByRole('button', { name: 'Entrar' }),
    ]) {
      expect(control.className).toMatch(/\bh-(11|12)\b/);
    }
  });

  it('writes the fields at 16px on a phone, so iOS does not zoom the page on focus', async () => {
    await renderLogin();

    for (const field of [screen.getByLabelText('E-mail'), screen.getByLabelText('Senha')]) {
      expect(field.className).toMatch(/\btext-base\b/);
      expect(field.className).not.toMatch(/(^|\s)text-(xs|sm)\b/);
    }
  });

  it('gives nothing a fixed width that could push the page sideways', async () => {
    const { container } = await renderLogin();

    const fixedWidths = [...container.querySelectorAll('[class]')]
      .map((element) => element.getAttribute('class') ?? '')
      .filter((classes) => /(^|\s)(min-w|w)-\[[^\]]*(px|rem)\]/.test(classes));

    expect(fixedWidths).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Entrar' }).parentElement?.className).toContain(
      'w-full',
    );
  });

  it('stacks the brand above the form below md, and puts them side by side only from md up', async () => {
    const { container } = await renderLogin();

    const layout = container.firstElementChild;

    expect(layout?.className).toContain('flex-col');
    expect(layout?.className).toContain('md:flex-row');
  });

  it('keeps the button inside the safe area and uses the dynamic viewport height', async () => {
    const { container } = await renderLogin();

    expect(container.firstElementChild?.className).toContain('min-h-dvh');
    expect(container.querySelector('main')?.className).toContain('safe-area-inset-bottom');
  });
});
