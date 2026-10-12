/// <reference types="vite/client" />

/**
 * Deliberately not narrowed to the variables the application needs: what the
 * application needs is decided by the Zod schema in `shared/config`, at
 * startup, with a message someone can act on. A type here would only move a
 * missing variable from a loud failure to a silent `undefined`.
 */
