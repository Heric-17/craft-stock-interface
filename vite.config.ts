/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
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

export default defineConfig(({ mode }) => ({
  plugins: [validateEnvironment(mode), react(), tailwindcss()],
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
