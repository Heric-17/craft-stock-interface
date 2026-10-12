import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { createQueryClient } from './query-client';

function failure(statusCode: number): ApiError {
  return new ApiError({ statusCode, code: 'ANY', error: 'Any', message: 'any' });
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;

  if (typeof retry !== 'function') {
    throw new Error('The query client is expected to decide retries with a function.');
  }

  return retry(failureCount, error as Error);
}

describe('the query client retry policy', () => {
  it.each([400, 401, 403, 404, 409, 422])(
    'never retries a %i: it was understood and refused',
    (status) => {
      expect(shouldRetry(0, failure(status))).toBe(false);
    },
  );

  it.each([500, 502, 503, 504])('retries a %i, which may pass', (status) => {
    expect(shouldRetry(0, failure(status))).toBe(true);
  });

  it('retries a request that never reached the API', () => {
    expect(shouldRetry(0, ApiError.networkFailure(new Error('offline')))).toBe(true);
  });

  it('gives up after a limited number of attempts', () => {
    expect(shouldRetry(0, failure(503))).toBe(true);
    expect(shouldRetry(1, failure(503))).toBe(true);
    expect(shouldRetry(2, failure(503))).toBe(false);
  });

  it('does not retry an error that is not from the API', () => {
    expect(shouldRetry(0, new TypeError('render bug'))).toBe(false);
  });

  it('never retries a mutation, which would repeat a stock entry or a sale', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
