import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * The API, intercepted at the network.
 *
 * Nothing in this suite mocks `fetch` or the `http-client` module. A test that
 * needed to would be testing a shape the application does not have: the
 * request that goes out, the headers on it and the error body that comes back
 * are the thing under test.
 */
export const server = setupServer(...handlers);
