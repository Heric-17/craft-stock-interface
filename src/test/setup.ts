import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetSession } from '@/shared/api/session';

import { server } from './msw/server';

beforeAll(() => {
  // A request nobody wrote a handler for is a mistake, not a default: it fails
  // the test instead of hanging or quietly reaching the network.
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  // The session is module state: one test's sign-in must not be the next one's.
  resetSession();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
