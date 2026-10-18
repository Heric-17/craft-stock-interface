/**
 * Starts the CraftStock API for the end-to-end run, against a database of its own.
 *
 * The API lives in another repository, so where it is comes from the environment:
 *
 *   E2E_BACKEND_PATH   folder of the API, already built (`npm run build` there).
 *                      Default: ../craft-stock-api, next to this repository.
 *   E2E_DATABASE_URL   connection URL of a database made for the tests.
 *                      Default: the local compose database `craftstock_e2e`.
 *   E2E_API_PORT       port the API listens on. Default: 3100.
 *   E2E_WEB_ORIGIN     origin the interface is served from, for CORS.
 *
 * The database name must end in `_e2e`. The run applies migrations and the seed
 * (both idempotent) and never resets anything, but the guard keeps a mistyped
 * URL from pointing the tests at the development database.
 *
 * Storage, mail and alerts are forced to local, harmless values: a run never writes to a bucket
 * or sends a message, whatever the API's own environment file is set to.
 *
 * The access token lives for a few seconds here instead of the 900 of production,
 * so the silent renewal is exercised by ordinary waiting, with no test double.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const backendPath = resolve(process.env.E2E_BACKEND_PATH ?? '../craft-stock-api');
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  'postgresql://craftstock:craftstock@localhost:5432/craftstock_e2e?schema=public';
const apiPort = process.env.E2E_API_PORT ?? '3100';
const webOrigin = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:5174';
const accessTokenSeconds = process.env.E2E_ACCESS_TOKEN_SECONDS ?? '6';

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');

if (!databaseName.endsWith('_e2e')) {
  console.error(
    `Refusing to run the end-to-end suite against "${databaseName}": the name must end in "_e2e".`,
  );
  process.exit(1);
}

if (!existsSync(resolve(backendPath, 'dist', 'main.js'))) {
  console.error(
    `The API at ${backendPath} is not built. Run "npm run build" there, or point E2E_BACKEND_PATH at it.`,
  );
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: apiPort,
  DATABASE_URL: databaseUrl,
  CORS_ORIGINS: webOrigin,
  JWT_EXPIRES_IN_SECONDS: accessTokenSeconds,
  AUTH_COOKIE_SECURE: 'false',
  LOG_LEVEL: 'warn',
  // Whatever the API's own .env says, a test run touches nothing outside this machine: images
  // go to a temporary folder, not to a bucket; mail and alerts go to the log; and no note
  // portal is called by the extraction canary.
  STORAGE_PROVIDER: 'LOCAL_DISK',
  UPLOADS_DIR: join(tmpdir(), 'craft-stock-e2e-uploads'),
  PUBLIC_BASE_URL: `http://localhost:${apiPort}`,
  EMAIL_SENDER: 'CONSOLE',
  NOTIFICATION_SENDER: 'CONSOLE',
  NFCE_CANARY_URLS: '',
};

function runPrisma(args) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: backendPath,
    env,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runPrisma(['migrate', 'deploy']);
runPrisma(['db', 'seed']);

const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: backendPath,
  env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => api.kill());
}

api.on('exit', (code) => process.exit(code ?? 0));
