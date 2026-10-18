import { expect, test } from '@playwright/test';

import { signIn } from './support/session';

/**
 * The access token lives a few seconds in this run (see support/start-backend.mjs), so
 * every wait below is real time against the real API: the renewal is not simulated.
 */
const TOKEN_LIFETIME_MS = 6_000;

test.describe('session', () => {
  test('refuses a wrong password and keeps the person on the login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('admin@craftstock.dev');
    await page.getByLabel('Senha').fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in, lands on the redirect target and signs out', async ({ page }) => {
    await signIn(page, '/insumos');

    await expect(page).toHaveURL(/\/insumos$/);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('sends a visitor who is not signed in to the login, remembering where they were going', async ({
    page,
  }) => {
    await page.goto('/vendas');

    await expect(page).toHaveURL(/\/login\?redirect=%2Fvendas/);
  });

  test('renews an expired access token silently, without showing the login', async ({ page }) => {
    await signIn(page, '/insumos');

    const refreshes: number[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/api/auth/refresh') {
        refreshes.push(response.status());
      }
    });

    // Longer than the token lives: the next call is sent with an expired token.
    await page.waitForTimeout(TOKEN_LIFETIME_MS + 2_000);

    const unauthorized = page.waitForResponse(
      (response) =>
        response.status() === 401 && !new URL(response.url()).pathname.startsWith('/api/auth/'),
    );
    // A reload would restore the session by itself; navigating inside the app is what
    // sends a business call with the stale in-memory token.
    await page.getByRole('link', { name: 'Fichas técnicas' }).click();
    await unauthorized;

    await expect(page).toHaveURL(/\/fichas-tecnicas$/);
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(page.getByLabel('Senha')).toHaveCount(0);
    expect(refreshes).toContain(200);
  });

  test('survives a reload by restoring the session from the cookie', async ({ page }) => {
    await signIn(page, '/vendas');

    await page.reload();

    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(page).toHaveURL(/\/vendas$/);
  });

  test('opens a deep link signed in, without a 404', async ({ page }) => {
    await signIn(page, '/vendas');

    await page.goto('/fichas-tecnicas/nova');

    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    await expect(page.getByText('Esta página não existe')).toHaveCount(0);
  });
});
