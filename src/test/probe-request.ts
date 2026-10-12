import { request, type RequestOptions } from '@/shared/api/http-client';

/**
 * Test support: a request through the real client, for tests that need server
 * data without belonging to a feature that has any yet.
 *
 * Application code never does this — it goes through the hooks in
 * `features/<feature>/api`. This stands in for such a hook so the client, the
 * session and the error states can be exercised together over the network.
 */
export function probeRequest(path = '/probe', options?: RequestOptions): Promise<unknown> {
  return request<unknown>(path, options);
}
