import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite: the production build of the interface in front of the real API and a
 * database made for the tests (see e2e/support/start-backend.mjs). Nothing is intercepted.
 * The page is served with the production security headers and reaches the API through
 * `/api` on its own origin, which is the topology of the deployment.
 *
 * One worker, in file order: the specs share one database, and a few of them read what an
 * earlier one left behind.
 */
const API_PORT = process.env.E2E_API_PORT ?? '3100';
const WEB_PORT = process.env.E2E_WEB_PORT ?? '5174';

const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/support/start-backend.mjs',
      // The liveness probe is the one route outside the /api prefix.
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { E2E_API_PORT: API_PORT, E2E_WEB_ORIGIN: WEB_URL },
    },
    {
      // The build the user would deploy, served the way a static host serves it.
      command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // The page reaches the API the way it does in production: through /api on its own
      // origin. The preview server forwards that to the API, as the host's rewrite does.
      env: {
        VITE_API_URL: `${WEB_URL}/api`,
        VITE_COMPANY_NAME: 'Ateliê E2E',
        API_PROXY_TARGET: API_URL,
      },
    },
  ],
});
