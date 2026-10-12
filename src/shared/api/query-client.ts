import { QueryClient } from '@tanstack/react-query';

import { isApiError } from './api-error';

/** Three attempts on a failure worth retrying, and none on one that is not. */
const MAX_RETRIES = 2;

/**
 * The cache every piece of server data lives in. There is no second store:
 * nothing about a Material, a Sale or a Purchase is copied into React state.
 *
 * Retrying is deliberately narrow. A 422 means the request was understood and
 * refused — repeating it changes nothing and only delays the message the user
 * needs to see. A 401 is for the session layer to resolve, not for a retry.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (failureCount >= MAX_RETRIES) {
            return false;
          }

          if (!isApiError(error)) {
            return false;
          }

          return error.statusCode === 0 || error.statusCode >= 500;
        },
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Values, stock and sale state are the server's to decide. A mutation
        // that failed is a mutation that did not happen, and repeating it
        // automatically is how a stock entry gets recorded twice.
        retry: false,
      },
    },
  });
}
