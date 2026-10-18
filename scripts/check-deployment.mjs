/**
 * Checks a published installation from the outside, the way a browser meets it.
 *
 *   node scripts/check-deployment.mjs https://app.exemplo.com.br
 *
 * With CHECK_EMAIL and CHECK_PASSWORD set it also signs in, which is the only way to see what
 * the /api rewrite does to the things a screen depends on: the query string, a request body
 * and the cookie. Without them it checks the page, its headers and the rewrite's path only.
 *
 * Nothing is written: it signs in, reads one list and signs out.
 */
const base = (process.argv[2] ?? '').replace(/\/+$/, '');

if (!/^https?:\/\/[^/\s]+$/.test(base)) {
  console.error('Usage: node scripts/check-deployment.mjs https://address-of-the-installation');
  process.exit(2);
}

const results = [];

function check(name, passed, detail = '') {
  results.push({ name, passed });
  console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}${detail === '' ? '' : `  (${detail})`}`);
}

async function get(path, init = {}) {
  return fetch(`${base}${path}`, { redirect: 'manual', ...init });
}

// --- The page ----------------------------------------------------------------------------

const home = await get('/');
const html = await home.text();

check('the entry point answers 200', home.status === 200, `status ${home.status}`);
check(
  'the entry point is always revalidated',
  /no-cache|max-age=0/.test(home.headers.get('cache-control') ?? ''),
  home.headers.get('cache-control') ?? 'no Cache-Control',
);

for (const [header, expected] of [
  ['content-security-policy', "default-src 'self'"],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['permissions-policy', 'camera=(self)'],
  ['strict-transport-security', 'max-age='],
]) {
  check(`header ${header}`, (home.headers.get(header) ?? '').includes(expected));
}

const deepLink = await get('/vendas/nova');

check(
  'a deep link opens the application, not a 404',
  deepLink.status === 200 && (await deepLink.text()).includes('<div id="root">'),
  `status ${deepLink.status}`,
);
check(
  'a deep link is revalidated too, not cached for long',
  !/max-age=[1-9]\d{3,}/.test(deepLink.headers.get('cache-control') ?? ''),
  deepLink.headers.get('cache-control') ?? 'no Cache-Control',
);

const asset = /\/assets\/[^"']+\.js/.exec(html)?.[0];

if (asset === undefined) {
  check('the entry point references a hashed script', false);
} else {
  const response = await get(asset);

  check(
    `a hashed asset is cached for a year (${asset})`,
    /max-age=31536000/.test(response.headers.get('cache-control') ?? '') &&
      /immutable/.test(response.headers.get('cache-control') ?? ''),
    response.headers.get('cache-control') ?? 'no Cache-Control',
  );
}

// --- The API behind /api --------------------------------------------------------------------

const unauthenticated = await get('/api/materials/inventory-summary');
const unauthenticatedBody = await unauthenticated.json().catch(() => null);

check(
  'GET /api/... reaches the API and keeps the /api path (answers 401 with a code)',
  unauthenticated.status === 401 && typeof unauthenticatedBody?.code === 'string',
  `status ${unauthenticated.status}`,
);

const email = process.env.CHECK_EMAIL;
const password = process.env.CHECK_PASSWORD;

if (email === undefined || password === undefined) {
  console.log('skip signed-in checks: set CHECK_EMAIL and CHECK_PASSWORD to run them');
} else {
  const login = await get('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await login.json().catch(() => null);

  check('POST with a body passes through the rewrite (login answers 200)', login.status === 200);

  const setCookie = login.headers
    .getSetCookie()
    .find((c) => c.startsWith('craftstock_refresh_token'));

  check(
    'the response carries the refresh cookie (Set-Cookie survives the rewrite)',
    setCookie !== undefined,
  );

  if (setCookie !== undefined) {
    check(
      'cookie Path is /api/auth',
      /;\s*Path=\/api\/auth(;|$)/i.test(setCookie),
      setCookie.replace(/=[^;]+/, '=…'),
    );
    check('cookie is HttpOnly', /;\s*HttpOnly/i.test(setCookie));
    check('cookie is Secure', /;\s*Secure/i.test(setCookie));
    check('cookie is SameSite=Lax', /;\s*SameSite=Lax/i.test(setCookie));
    check('cookie has no Domain attribute (stays on this host)', !/;\s*Domain=/i.test(setCookie));
  }

  const token = session?.accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  // The list echoes its own `limit` and `offset`, so what arrives is what was sent.
  const page = await get('/api/materials/losses?limit=3&offset=0', { headers: auth });
  const pageBody = await page.json().catch(() => null);

  check(
    'the query string is preserved by the rewrite (limit=3 comes back as 3)',
    page.status === 200 && pageBody?.limit === 3,
    `status ${page.status}, limit ${String(pageBody?.limit)}`,
  );

  const ranged = await get(
    '/api/materials/losses?from=2026-01-01T00%3A00%3A00-03%3A00&to=2026-02-01T00%3A00%3A00-03%3A00&limit=2',
    { headers: auth },
  );
  const rangedBody = await ranged.json().catch(() => null);

  check(
    'an encoded query (from=...&to=... with %3A) is preserved too',
    ranged.status === 200 && rangedBody?.limit === 2,
    `status ${ranged.status}`,
  );

  if (setCookie !== undefined) {
    const refresh = await get('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: setCookie.split(';')[0] ?? '' },
    });

    check(
      'the cookie is accepted by POST /api/auth/refresh',
      refresh.status === 200,
      `status ${refresh.status}`,
    );

    const rotated = refresh.headers
      .getSetCookie()
      .find((c) => c.startsWith('craftstock_refresh_token'));

    await get('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: (rotated ?? setCookie).split(';')[0] ?? '' },
    });
  }
}

const failed = results.filter((result) => !result.passed);

console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
