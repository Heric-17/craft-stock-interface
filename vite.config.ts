/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { parse } from 'yaml';
import { z } from 'zod';

import { parseEnv } from './src/shared/config/env.schema.ts';

/**
 * Stops `dev` and `build` when the installation is not configured.
 *
 * Without it a missing `VITE_API_URL` becomes an `undefined` inlined into the
 * bundle and a network error on the first screen, which says nothing about
 * what went wrong. The same schema runs again in the browser, for a bundle
 * that was already built.
 */
function validateEnvironment(mode: string): Plugin {
  return {
    name: 'craft-stock:validate-environment',
    config() {
      // Tests bring their own configuration; validating here would make every
      // run depend on a .env file that has nothing to do with the test.
      if (mode === 'test') {
        return;
      }

      parseEnv(loadEnv(mode, process.cwd(), 'VITE_'));
    },
  };
}

/**
 * The version in `package.json`, written into the bundle as `__APP_VERSION__`. Read
 * here, at build time, so the screen that shows it never carries a copy to forget.
 */
const APP_VERSION = (
  JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as {
    version: string;
  }
).version;

/** The mode `npm run dev:https` runs in. */
const HTTPS_MODE = 'https';

/** Where the dev server forwards `/api` to in that mode: the API running on this computer. */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

/**
 * `/api` on the page's own origin, forwarded to the API, which answers under that same prefix.
 * It is what the production host does with a rewrite rule, so the page and the API are one
 * origin: no CORS, no mixed content, and the refresh cookie (`Path=/api/auth`) is first-party.
 */
function apiProxy() {
  return { '/api': { target: API_PROXY_TARGET } };
}

/**
 * The response headers the production host sends on every page, read from the blueprint
 * that configures it, so the preview — and the end-to-end suite that runs on it — is served
 * under the same Content-Security-Policy as the real thing. A policy only tested in
 * production is a policy that breaks the application on the first deploy.
 */
const blueprintSchema = z.object({
  services: z.array(
    z.object({
      headers: z
        .array(z.object({ path: z.string(), name: z.string(), value: z.string() }))
        .optional(),
    }),
  ),
});

function productionHeaders(): Record<string, string> {
  const blueprint = blueprintSchema.parse(
    parse(readFileSync(fileURLToPath(new URL('./render.yaml', import.meta.url)), 'utf8')),
  );

  return Object.fromEntries(
    blueprint.services
      .flatMap((service) => service.headers ?? [])
      .filter((rule) => rule.path === '/*')
      .map((rule) => [rule.name, rule.value]),
  );
}

/**
 * The dev server for testing the camera on a phone over the local network.
 *
 * The camera only exists on a secure origin, so the page is served over HTTPS
 * with a self-signed certificate. That alone is not enough: a page on HTTPS may
 * not call an API on plain HTTP (mixed content), and `localhost` means the
 * phone itself. So the server also forwards `/api` to the API, which makes the
 * page and the API the same origin — no CORS, no mixed content — and moves the
 * refresh cookie's path along with the prefix, or the browser would never send
 * it back.
 */
function httpsDevServer(mode: string) {
  if (mode !== HTTPS_MODE) {
    return {};
  }

  return {
    server: {
      host: true,
      proxy: apiProxy(),
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    validateEnvironment(mode),
    react(),
    tailwindcss(),
    ...(mode === HTTPS_MODE ? [basicSsl()] : []),
  ],
  ...httpsDevServer(mode),
  preview: { headers: productionHeaders(), proxy: apiProxy() },
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // The configuration the suite runs against, pinned here because a variable already set in the
    // shell wins over `.env.test`: with `VITE_COMPANY_NAME` exported (as the CI job once did for
    // the build), the screens read one name and the assertions another.
    env: { VITE_API_URL: 'http://api.test', VITE_COMPANY_NAME: 'Ateliê de Teste' },
    // Same reason as the wait in the setup file: a loaded machine, not a slow test.
    testTimeout: 20_000,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
    },
  },
}));
