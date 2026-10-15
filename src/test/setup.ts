import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { resetSession } from '@/shared/api/session';

import { server } from './msw/server';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

// jsdom has no pointer capture, and a toast's action button asks for it when it is
// pressed. Nothing on screen depends on it: the shim only keeps the call from throwing.
for (const method of ['setPointerCapture', 'releasePointerCapture'] as const) {
  Element.prototype[method] ??= () => undefined;
}
Element.prototype.hasPointerCapture ??= () => false;

beforeAll(() => {
  // A request nobody wrote a handler for is a mistake, not a default: it fails
  // the test instead of hanging or quietly reaching the network.
  server.listen({ onUnhandledRequest: 'error' });
});

// Every test starts on a desktop; a test that is about a phone says so.
beforeEach(() => {
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  cleanup();
  // The toast store belongs to the module, not to a rendered <Toaster />: one
  // test's "foi descontinuado" would otherwise be on screen in the next.
  toast.dismiss();
  // The session is module state: one test's sign-in must not be the next one's.
  resetSession();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
