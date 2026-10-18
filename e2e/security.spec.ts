import { expect, test } from '@playwright/test';

import { createFixtures, type Fixtures } from './support/fixtures';
import { SCREENS, settle } from './support/screens';
import { signIn } from './support/session';

/**
 * The page is served under the production security headers (read from render.yaml by the
 * preview server), so a screen that breaks the Content-Security-Policy breaks here and not
 * on the first deploy. The API is on the page's own origin, as in production.
 */
let fixtures: Fixtures;

test.beforeAll(async ({ request }) => {
  fixtures = await createFixtures(request);
});

test('serves the security headers on the entry point and on a deep link', async ({ request }) => {
  for (const path of ['/', '/vendas/nova']) {
    const response = await request.get(path);
    const headers = response.headers();

    expect(headers['content-security-policy'], path).toContain("default-src 'self'");
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy'], path).toContain('camera=(self)');
  }
});

test('no screen breaks the content security policy, and no call leaves the origin', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);

  const violations: string[] = [];
  const foreignCalls: string[] = [];
  const origin = new URL(baseURL ?? '').origin;

  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) {
      violations.push(message.text());
    }
  });
  page.on('request', (request) => {
    const url = new URL(request.url());

    if (url.protocol.startsWith('http') && url.origin !== origin) {
      foreignCalls.push(request.url());
    }
  });

  await signIn(page);

  for (const screen of SCREENS) {
    await page.goto(screen.path(fixtures));
    await settle(page);
    await screen.prepare?.(page, fixtures);
  }

  expect(violations).toEqual([]);
  expect(foreignCalls).toEqual([]);
});

test('the refresh cookie is first-party: scoped to /api/auth, HttpOnly, SameSite=Lax', async ({
  page,
}) => {
  await signIn(page);

  const cookies = await page.context().cookies();
  const refresh = cookies.find((cookie) => cookie.name === 'craftstock_refresh_token');

  expect(refresh).toBeDefined();
  expect(refresh?.httpOnly).toBe(true);
  expect(refresh?.sameSite).toBe('Lax');
  expect(refresh?.path).toBe('/api/auth');
  expect(refresh?.domain).toBe('localhost');
});
