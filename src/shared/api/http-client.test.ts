import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '@/shared/config/env';
import { server } from '@/test/msw/server';

import { ApiError } from './api-error';
import { messageForError } from './error-messages';
import { request, setAuthorization } from './http-client';

const API = env.VITE_API_URL;

describe('http-client', () => {
  it('reads a successful response', async () => {
    const body = await request<{ status: string }>('/health');

    expect(body.status).toBe('ok');
  });

  it('sends the access token as a bearer header', async () => {
    let authorization: string | null = null;

    server.use(
      http.get(`${API}/users/me`, ({ request: received }) => {
        authorization = received.headers.get('Authorization');
        return HttpResponse.json({ id: 'u1', email: 'marina@exemplo.com.br', name: 'Marina' });
      }),
    );

    setAuthorization(() => 'token-de-acesso');

    try {
      await request('/users/me');
    } finally {
      setAuthorization(() => null);
    }

    expect(authorization).toBe('Bearer token-de-acesso');
  });

  it('sends credentials on every request, so the session cookie travels', async () => {
    let credentials: RequestCredentials | undefined;

    server.use(
      http.post(`${API}/auth/refresh`, ({ request: received }) => {
        credentials = received.credentials;
        return HttpResponse.json({
          accessToken: 'novo',
          tokenType: 'Bearer',
          expiresInSeconds: 900,
          user: { id: 'u1', email: 'marina@exemplo.com.br', name: 'Marina' },
        });
      }),
    );

    await request('/auth/refresh', { method: 'POST' });

    expect(credentials).toBe('include');
  });

  it('turns the API error body into an ApiError, keyed by the stable code', async () => {
    server.use(
      http.delete(`${API}/materials/m1`, () =>
        HttpResponse.json(
          {
            statusCode: 422,
            code: 'ENTITY_IN_USE',
            error: 'EntityInUseError',
            message: 'Material m1 cannot be deleted: it is referenced by 3 other record(s).',
            details: {
              entityName: 'Material',
              entityId: 'm1',
              saleItems: 3,
              bomItems: 0,
              purchaseItems: 0,
              stockMovements: 0,
              total: 3,
            },
            path: '/materials/m1',
            timestamp: '2026-10-05T12:00:00.000Z',
            correlationId: 'c-1',
          },
          { status: 422 },
        ),
      ),
    );

    const error = await request('/materials/m1', { method: 'DELETE' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('ENTITY_IN_USE');
    expect((error as ApiError).statusCode).toBe(422);
    expect((error as ApiError).isUnexpected).toBe(false);
    expect(messageForError(error as ApiError)).toContain('Descontinue');
  });

  it('keeps the errorId of an unexpected failure, which is what the user reports', async () => {
    server.use(
      http.get(`${API}/materials`, () =>
        HttpResponse.json(
          {
            statusCode: 500,
            code: 'INTERNAL_ERROR',
            error: 'InternalServerError',
            message: 'Internal server error',
            path: '/materials',
            timestamp: '2026-10-05T12:00:00.000Z',
            correlationId: 'abc-123',
            errorId: 'abc-123',
          },
          { status: 500 },
        ),
      ),
    );

    const error = (await request('/materials').catch((caught: unknown) => caught)) as ApiError;

    expect(error.errorId).toBe('abc-123');
    expect(error.supportId).toBe('abc-123');
    expect(error.isUnexpected).toBe(true);
    expect(messageForError(error)).not.toContain('Internal server error');
  });

  it('falls back to the X-Correlation-Id header when the body carries nothing', async () => {
    server.use(
      http.get(
        `${API}/materials`,
        () =>
          new HttpResponse(null, {
            status: 500,
            headers: { 'X-Correlation-Id': 'header-only-42' },
          }),
      ),
    );

    const error = (await request('/materials').catch((caught: unknown) => caught)) as ApiError;

    // Nothing was readable in the body: without the header there would be no
    // code at all to hand to support.
    expect(error.errorId).toBe('header-only-42');
    expect(error.supportId).toBe('header-only-42');
    expect(error.correlationId).toBe('header-only-42');
  });

  it('turns a request that never reached the API into an ApiError with no errorId', async () => {
    server.use(http.get(`${API}/materials`, () => HttpResponse.error()));

    const error = (await request('/materials').catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(0);
    expect(error.errorId).toBeUndefined();
    expect(error.supportId).toBeUndefined();
    expect(messageForError(error)).toContain('conexão');
  });

  it('answers nothing for a 204, which is what logout and the delete routes return', async () => {
    server.use(http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })));

    await expect(request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('appends only the query parameters that were given', async () => {
    let url = '';

    server.use(
      http.get(`${API}/materials`, ({ request: received }) => {
        url = received.url;
        return HttpResponse.json([]);
      }),
    );

    await request('/materials', { query: { includeDiscontinued: true, name: undefined } });

    expect(url).toContain('includeDiscontinued=true');
    expect(url).not.toContain('name=');
  });
});
