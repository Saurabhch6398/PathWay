#!/usr/bin/env node
/**
 * Post-deploy smoke test.
 *
 *   node scripts/smoke.mjs https://your-app.onrender.com            read-only checks
 *   node scripts/smoke.mjs https://your-app.onrender.com --register also creates a throwaway student
 *                                                                   and checks login, refresh and logout
 *   SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke.mjs <url> checks an existing account instead
 */
const base = (process.argv[2] ?? process.env.BASE_URL ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Usage: node scripts/smoke.mjs <base-url> [--register]');
  process.exit(2);
}

let failed = 0;
async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  ✓ ${name}${detail ? ` (${detail})` : ''}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const cookieFrom = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('pw_refresh='));
const json = (res) => res.json().catch(() => ({}));

console.log(`Smoke test: ${base}\n`);

console.log('Service');
await check('API is up and connected to the database', async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await json(res);
  expect(res.status === 200, `status ${res.status} (${body.database ?? 'no body'})`);
  expect(body.database === 'connected', `database is ${body.database}`);
  return `uptime ${body.uptime}s`;
});
await check('website is served', async () => {
  const res = await fetch(`${base}/`);
  const html = await res.text();
  expect(res.status === 200 && html.includes('id="root"'), `status ${res.status}, no app shell`);
});
await check('client-side routes load the app (SPA fallback)', async () => {
  const res = await fetch(`${base}/student/opportunities`);
  expect(res.status === 200 && (await res.text()).includes('id="root"'), `status ${res.status}`);
});
await check('unknown API routes return JSON 404', async () => {
  const res = await fetch(`${base}/api/does-not-exist`);
  expect(
    res.status === 404 && res.headers.get('content-type')?.includes('json'),
    `status ${res.status}`,
  );
});
await check('protected routes reject anonymous requests', async () => {
  const res = await fetch(`${base}/api/opportunities`);
  expect(res.status === 401, `status ${res.status}`);
});
await check('security headers are present', async () => {
  const res = await fetch(`${base}/api/health`);
  expect(res.headers.get('x-content-type-options') === 'nosniff', 'missing x-content-type-options');
  expect(res.headers.get('cache-control') === 'no-store', 'API responses are cacheable');
  expect(!res.headers.get('x-powered-by'), 'x-powered-by is exposed');
});

const wantsAccount = process.argv.includes('--register') || process.env.SMOKE_EMAIL;
if (wantsAccount) {
  console.log('\nAccount');
  const email = process.env.SMOKE_EMAIL ?? `smoke-${Date.now()}@example.com`;
  const password = process.env.SMOKE_PASSWORD ?? `Smoke${Date.now()}x`;
  const post = (path, body, cookie) =>
    fetch(`${base}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body ?? {}),
    });

  let token;
  let cookie;
  if (process.env.SMOKE_EMAIL) {
    await check(`log in as ${email}`, async () => {
      const res = await post('/auth/login', { email, password });
      expect(res.status === 200, `status ${res.status}`);
      ({ accessToken: token } = await json(res));
      cookie = cookieFrom(res);
    });
  } else {
    await check(`register ${email}`, async () => {
      const res = await post('/auth/register', {
        name: 'Smoke Test',
        email,
        password,
        role: 'student',
      });
      expect(res.status === 201, `status ${res.status}`);
      ({ accessToken: token } = await json(res));
      cookie = cookieFrom(res);
      expect(cookie, 'no refresh cookie set');
    });
  }
  await check('refresh cookie is HttpOnly', async () => {
    const res = await post('/auth/login', { email, password });
    const raw = res.headers.getSetCookie().find((c) => c.startsWith('pw_refresh='));
    expect(/httponly/i.test(raw ?? ''), 'cookie is readable by scripts');
    if (new URL(base).protocol === 'https:')
      expect(/secure/i.test(raw ?? ''), 'cookie is missing the Secure flag');
    cookie = cookieFrom(res) ?? cookie;
  });
  await check('/auth/me works with the access token', async () => {
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status === 200, `status ${res.status}`);
  });
  await check('opportunities list loads', async () => {
    const res = await fetch(`${base}/api/opportunities`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await json(res);
    expect(res.status === 200, `status ${res.status}`);
    return `${body.total} open`;
  });
  await check('refresh rotates the token and rejects the old one', async () => {
    const first = await post('/auth/refresh', null, cookie);
    expect(first.status === 200, `refresh status ${first.status}`);
    const replay = await post('/auth/refresh', null, cookie);
    expect(replay.status === 401, `replayed token was accepted (${replay.status})`);
    cookie = cookieFrom(first);
  });
  await check('logout revokes the session', async () => {
    expect((await post('/auth/logout', null, cookie)).status === 204, 'logout failed');
    expect(
      (await post('/auth/refresh', null, cookie)).status === 401,
      'session still valid after logout',
    );
  });
} else {
  console.log('\n(Skipped account checks. Add --register or set SMOKE_EMAIL/SMOKE_PASSWORD.)');
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
