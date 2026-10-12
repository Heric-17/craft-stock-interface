import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { env } from '@/shared/config/env';
import { authResponse, marina, refreshRefused } from '@/test/auth';
import { server } from '@/test/msw/server';

import { isApiError, type ApiError } from './api-error';
import { request } from './http-client';
import {
  endSession,
  establishSession,
  getAccessToken,
  getSessionSnapshot,
  onSessionEnded,
  restoreSession,
} from './session';

const API = env.VITE_API_URL;

const BUSINESS_ROUTES = ['/materials', '/composite-products', '/sales'] as const;

/**
 * An API that accepts one access token and refuses every other, counting the
 * renewals. `refreshDelay` keeps the renewal in flight long enough for the other
 * requests to arrive while it is, which is the situation single-flight is for.
 */
function apiAcceptingOnly(validToken: string, options: { refreshDelay?: number } = {}) {
  const calls = { refresh: 0, business: 0 };

  server.use(
    http.post(`${API}/auth/refresh`, async () => {
      calls.refresh += 1;
      await delay(options.refreshDelay ?? 30);
      return HttpResponse.json(authResponse(validToken));
    }),
    ...BUSINESS_ROUTES.map((route) =>
      http.get(`${API}${route}`, ({ request: received }) => {
        calls.business += 1;

        if (received.headers.get('Authorization') !== `Bearer ${validToken}`) {
          return HttpResponse.json(
            {
              statusCode: 401,
              code: 'UNAUTHORIZED',
              error: 'UnauthorizedException',
              message: 'Unauthorized',
            },
            { status: 401 },
          );
        }

        return HttpResponse.json([{ route }]);
      }),
    ),
  );

  return calls;
}

describe('renewing the session', () => {
  it('fires exactly one refresh for three simultaneous 401s, and all three complete', async () => {
    const calls = apiAcceptingOnly('fresh-token');
    establishSession(authResponse('expired-token'));

    const results = await Promise.all(BUSINESS_ROUTES.map((route) => request<unknown[]>(route)));

    // One renewal, not three: the API rotates the refresh token on every use, so
    // a second refresh with the same cookie would be refused as already used.
    expect(calls.refresh).toBe(1);
    expect(results).toEqual([
      [{ route: '/materials' }],
      [{ route: '/composite-products' }],
      [{ route: '/sales' }],
    ]);
    // Each request went out twice: refused with the old token, accepted with the new.
    expect(calls.business).toBe(6);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('does not renew again for a request that was refused after the renewal had finished', async () => {
    let refreshCalls = 0;

    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        refreshCalls += 1;
        await delay(5);
        return HttpResponse.json(authResponse('fresh-token'));
      }),
      // Answers the old token with a 401 only after the renewal is long done.
      http.get(`${API}/slow`, async ({ request: received }) => {
        if (received.headers.get('Authorization') === 'Bearer fresh-token') {
          return HttpResponse.json({ ok: true });
        }

        await delay(80);
        return HttpResponse.json({ statusCode: 401, code: 'UNAUTHORIZED' }, { status: 401 });
      }),
      http.get(`${API}/fast`, ({ request: received }) =>
        received.headers.get('Authorization') === 'Bearer fresh-token'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ statusCode: 401, code: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    );
    establishSession(authResponse('expired-token'));

    const [slow, fast] = await Promise.all([request('/slow'), request('/fast')]);

    expect(slow).toEqual({ ok: true });
    expect(fast).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it('repeats a request once and never loops: a second 401 is the answer', async () => {
    let refreshCalls = 0;
    let businessCalls = 0;

    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(authResponse('fresh-token'));
      }),
      http.get(`${API}/materials`, () => {
        businessCalls += 1;
        return HttpResponse.json(
          { statusCode: 401, code: 'UNAUTHORIZED', error: 'Unauthorized', message: 'no' },
          { status: 401 },
        );
      }),
    );
    establishSession(authResponse('expired-token'));

    const error = (await request('/materials').catch((caught: unknown) => caught)) as ApiError;

    expect(error.statusCode).toBe(401);
    expect(refreshCalls).toBe(1);
    expect(businessCalls).toBe(2);
  });

  it('sends the refresh with no body and no bearer: the cookie is the credential', async () => {
    let seen: { authorization: string | null; body: string; credentials: string } | undefined;

    server.use(
      http.post(`${API}/auth/refresh`, async ({ request: received }) => {
        seen = {
          authorization: received.headers.get('Authorization'),
          body: await received.text(),
          credentials: received.credentials,
        };
        return HttpResponse.json(authResponse('fresh-token'));
      }),
      http.get(`${API}/materials`, ({ request: received }) =>
        received.headers.get('Authorization') === 'Bearer fresh-token'
          ? HttpResponse.json([])
          : HttpResponse.json({ statusCode: 401, code: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    );
    establishSession(authResponse('expired-token'));

    await request('/materials');

    expect(seen).toEqual({ authorization: null, body: '', credentials: 'include' });
  });

  it('ends the session when the refresh is refused, and tells whoever listens', async () => {
    const ended = vi.fn();
    onSessionEnded(ended);

    server.use(
      refreshRefused(),
      http.get(`${API}/materials`, () =>
        HttpResponse.json({ statusCode: 401, code: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    );
    establishSession(authResponse('expired-token'));

    const error = (await request('/materials').catch((caught: unknown) => caught)) as ApiError;

    expect(isApiError(error) && error.isSessionOver).toBe(true);
    expect(getSessionSnapshot()).toEqual({ status: 'anonymous', reason: 'expired' });
    expect(getAccessToken()).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the renewal fails for a reason that says nothing about it', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.error()),
      http.get(`${API}/materials`, () =>
        HttpResponse.json({ statusCode: 401, code: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    );
    establishSession(authResponse('still-valid-token'));

    const error = (await request('/materials').catch((caught: unknown) => caught)) as ApiError;

    expect(error.statusCode).toBe(0);
    expect(getSessionSnapshot().status).toBe('authenticated');
  });

  it('treats a 401 on a public route as the answer, without renewing anything', async () => {
    let refreshCalls = 0;

    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(authResponse());
      }),
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 401, code: 'INVALID_CREDENTIALS', error: 'InvalidCredentialsError' },
          { status: 401 },
        ),
      ),
    );

    const error = (await request('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.c', password: 'x' },
      public: true,
    }).catch((caught: unknown) => caught)) as ApiError;

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(refreshCalls).toBe(0);
  });

  it('keeps the first reason when a session that is already over fails again', () => {
    establishSession(authResponse());

    endSession('signed-out');
    endSession('expired');

    expect(getSessionSnapshot()).toEqual({ status: 'anonymous', reason: 'signed-out' });
  });
});

describe('restoring the session on load', () => {
  it('opens the session from the cookie alone, with nothing stored on the client', async () => {
    let authorization: string | null = 'not-called';

    server.use(
      http.post(`${API}/auth/refresh`, ({ request: received }) => {
        authorization = received.headers.get('Authorization');
        return HttpResponse.json(authResponse('restored-token'));
      }),
    );

    expect(getSessionSnapshot()).toEqual({ status: 'restoring' });

    await restoreSession();

    expect(authorization).toBeNull();
    expect(getSessionSnapshot()).toEqual({ status: 'authenticated', user: marina });
    expect(getAccessToken()).toBe('restored-token');
  });

  it('reads a 401 as a visitor who is not signed in, and does not announce an ended session', async () => {
    const ended = vi.fn();
    onSessionEnded(ended);
    server.use(refreshRefused());

    await restoreSession();

    expect(getSessionSnapshot()).toEqual({ status: 'anonymous', reason: 'visitor' });
    expect(ended).not.toHaveBeenCalled();
  });

  it('asks the API once when called twice, as StrictMode does', async () => {
    let refreshCalls = 0;

    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        refreshCalls += 1;
        await delay(20);
        return HttpResponse.json(authResponse());
      }),
    );

    await Promise.all([restoreSession(), restoreSession()]);

    expect(refreshCalls).toBe(1);
    expect(getSessionSnapshot().status).toBe('authenticated');
  });

  it('does not take a failure of the network for a visitor, and can be tried again', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()));

    await restoreSession();

    const failed = getSessionSnapshot();
    expect(failed.status).toBe('restore-failed');

    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse())));

    await restoreSession();

    expect(getSessionSnapshot().status).toBe('authenticated');
  });

  it('keeps a body that is not a session out of the session', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json({ hello: 'world' })));

    await restoreSession();

    expect(getSessionSnapshot().status).toBe('restore-failed');
    expect(getAccessToken()).toBeNull();
  });
});
