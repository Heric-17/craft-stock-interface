/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

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

/** The mode `npm run dev:https` runs in. */
const HTTPS_MODE = 'https';

/** Where the dev server forwards `/api` to in that mode: the API running on this computer. */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

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
      proxy: {
        '/api': {
          target: API_PROXY_TARGET,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
          cookiePathRewrite: { '/auth': '/api/auth' },
        },
      },
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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
    },
  },
}));
