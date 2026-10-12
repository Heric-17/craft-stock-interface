import { parseEnv, type Env } from './env.schema';

/**
 * The validated configuration, read once at module load.
 *
 * Reading it here rather than scattering `import.meta.env` through the code
 * means a build pointed at nothing fails on the first screen with a sentence
 * that says which variable is missing, instead of on the first request with a
 * network error that says nothing.
 */
export const env: Env = parseEnv({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_COMPANY_NAME: import.meta.env.VITE_COMPANY_NAME,
});

export { MissingEnvironmentError } from './env.schema';
export type { Env } from './env.schema';
