import { http, HttpResponse } from 'msw';

import { env } from '@/shared/config/env';

/**
 * The default handlers: what the API answers when a test does not care.
 *
 * Fixtures mirror real responses from the backend and are typed by the DTOs of
 * the feature they belong to, so a change in the contract breaks a test
 * instead of being discovered in production. A test that needs a different
 * answer overrides it with `server.use(...)` rather than editing this file.
 */
export const handlers = [
  http.get(`${env.VITE_API_URL}/health`, () =>
    HttpResponse.json({
      status: 'ok',
      uptimeSeconds: 12,
      timestamp: '2026-10-05T12:00:00.000Z',
    }),
  ),
];
