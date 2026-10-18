import { expect, type Page } from '@playwright/test';

/** The account the API's seed creates on a fresh database. */
export const SEED_USER = {
  email: 'admin@craftstock.dev',
  password: 'senha-forte-123',
} as const;

/** The API as the specs call it directly to set data up: every route sits under `/api`. */
export const API_URL = `http://localhost:${process.env.E2E_API_PORT ?? '3100'}/api`;

/** A name no other run has used, so a spec never depends on an empty database. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Signs in through the form, the way a person does, and waits for the signed-in area. */
export async function signIn(page: Page, destination = '/'): Promise<void> {
  await page.goto(`/login?redirect=${encodeURIComponent(destination)}`);
  await page.getByLabel('E-mail').fill(SEED_USER.email);
  await page.getByLabel('Senha').fill(SEED_USER.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  // On a phone "Sair" lives in the drawer, so the signed-in area is recognised by the
  // address leaving the login and the navigation landmark of the shell existing.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('navigation', { name: 'Você está em' })).toBeVisible();
}
