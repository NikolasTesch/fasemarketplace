import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGateway } from '../preview-gateway.mjs';
import { createAccessProxy, createAccessGatewayHandler, PREVIEW_ORIGIN } from '../access-bridge.mjs';

const env = { APP_ENV: 'local', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'development',
  PREVIEW_ACCESS_ENABLED: 'true', PREVIEW_ACCESS_ORIGIN: PREVIEW_ORIGIN,
  PREVIEW_ACCESS_BRIDGE_ORIGIN: 'https://synthetic-access.trycloudflare.com',
  PREVIEW_ACCESS_BRIDGE_KEY: 'b'.repeat(64), PREVIEW_ACCESS_API_KEY: 'c'.repeat(64) };
const user = { id: 'synthetic123', name: 'Synthetic', email: 'user@example.test', role: 'user', mustChangePassword: false, banned: false };
const req = (path = '/login', options = {}) => new Request(PREVIEW_ORIGIN + '/api/access' + path, {
  method: 'POST', body: JSON.stringify({ email: user.email, password: 'Synthetic-Password-2026!' }), ...options,
  headers: { origin: PREVIEW_ORIGIN, 'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.5', ...options.headers },
});
test('access proxy disabled, wrong environment/branch/origin never sends traffic', async () => {
  let calls = 0;
  for (const change of [{ PREVIEW_ACCESS_ENABLED: 'false' }, { VERCEL_ENV: 'production' },
    { VERCEL_GIT_COMMIT_REF: 'main' }, { PREVIEW_ACCESS_BRIDGE_KEY: 'weak' },
    { PREVIEW_ACCESS_ORIGIN: 'https://fasemarketplace.vercel.app' }, { PREVIEW_ACCESS_BRIDGE_ORIGIN: 'http://localhost' }]) {
    const handler = createAccessProxy({ env: { ...env, ...change }, fetchImpl: () => { calls++; } });
    assert.equal((await handler(req())).status, 503);
  }
  assert.equal(calls, 0);
});
test('proxy enforces exact host, route/method/query, Origin, IP, body and content type', async () => {
  let calls = 0;
  const handler = createAccessProxy({ env, fetchImpl: () => { calls++; } });
  const cases = [
    [new Request('https://other.vercel.app/api/access/session'), 403],
    [req('/sign-up'), 404], [req('/users/a%2Fb/block'), 404],
    [new Request(PREVIEW_ORIGIN + '/api/access/users?offset=0&offset=20'), 400],
    [new Request(PREVIEW_ORIGIN + '/api/access/session?url=https://evil.example'), 400],
    [req('/session'), 405],
    [req('/login', { headers: { origin: 'https://evil.example', 'content-type': 'application/json' } }), 403],
    [req('/login', { headers: { origin: PREVIEW_ORIGIN, 'content-type': 'text/plain' } }), 415],
    [req('/login', { headers: { origin: PREVIEW_ORIGIN, 'content-type': 'application/json', 'x-vercel-forwarded-for': 'invalid', 'x-forwarded-for': '203.0.113.5' } }), 403],
    [req('/login', { body: 'x'.repeat(8193) }), 413], [req('/login', { body: '{' }), 400],
  ];
  for (const [request, status] of cases) assert.equal((await handler(request)).status, status);
  assert.equal(calls, 0);
});
test('proxy strips browser credentials/metadata and filters DTO + individual secure cookies', async () => {
  const seen = [];
  const handler = createAccessProxy({ env, fetchImpl: async (url, options) => {
    seen.push({ url, options });
    const headers = new Headers({ 'content-type': 'application/json', location: 'https://evil.example' });
    headers.append('set-cookie', '__Secure-fm_preview_access.session_token=secret; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', '__Secure-fm_preview_access.dont_remember=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
    headers.append('set-cookie', '_vercel_jwt=private; Path=/; HttpOnly; Secure; SameSite=Lax');
    return new Response(JSON.stringify({ user: { ...user, password: 'private' }, token: 'private' }), { headers });
  } });
  const request = req('/login', { headers: { origin: PREVIEW_ORIGIN, 'content-type': 'application/json',
    'x-vercel-forwarded-for': '203.0.113.5', 'x-fm-client-ip': '198.51.100.5', authorization: 'Bearer attacker',
    cookie: '_vercel_jwt=private; __Secure-fm_preview_access.session_token=opaque; unrelated=private' } });
  const response = await handler(request);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user });
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(seen[0].url, env.PREVIEW_ACCESS_BRIDGE_ORIGIN + '/access/login');
  assert.equal(seen[0].options.redirect, 'error');
  const headers = new Headers(seen[0].options.headers);
  assert.equal(headers.get('authorization'), 'Bearer ' + env.PREVIEW_ACCESS_BRIDGE_KEY);
  assert.equal(headers.get('x-fm-client-ip'), '203.0.113.5');
  assert.equal(headers.get('x-forwarded-for'), null);
  assert.equal(headers.get('cookie'), '__Secure-fm_preview_access.session_token=opaque');
});
test('gateway authenticates its hop before API and replaces the credential', async () => {
  let calls = 0;
  const handler = createAccessGatewayHandler({ env, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'http://api:3001/access/session');
    const headers = new Headers(options.headers);
    assert.equal(headers.get('authorization'), 'Bearer ' + env.PREVIEW_ACCESS_API_KEY);
    assert.equal(headers.get('x-fm-client-ip'), '203.0.113.5');
    return Response.json({ user, expiresAt: new Date(Date.now() + 10000).toISOString() });
  } });
  const request = (key) => new Request('http://gateway/access/session', { headers: { authorization: 'Bearer ' + key, 'x-fm-client-ip': '203.0.113.5' } });
  assert.equal((await handler(request('wrong'))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await handler(request(env.PREVIEW_ACCESS_BRIDGE_KEY))).status, 200);
  assert.equal(calls, 1);
  const disabled = createAccessGatewayHandler({ env: { ...env, PREVIEW_ACCESS_ENABLED: 'false' } });
  assert.equal((await disabled(request(env.PREVIEW_ACCESS_BRIDGE_KEY))).status, 503);
  assert.throws(() => createAccessGatewayHandler({ env: { ...env, PREVIEW_ACCESS_API_KEY: env.PREVIEW_ACCESS_BRIDGE_KEY } }));
});
test('upstream failures, non-JSON/oversized/malformed data and unsafe cookies fail closed', async () => {
  const responses = [
    () => { throw new Error('private-host-key'); },
    () => new Response('private', { status: 302, headers: { location: 'https://evil.example' } }),
    () => new Response('private', { status: 500 }),
    () => new Response('x'.repeat(65537), { headers: { 'content-type': 'application/json' } }),
    () => Response.json({ user: { ...user, role: 'superadmin' } }),
    () => Response.json({ user }, { headers: { 'set-cookie': '__Secure-fm_preview_access.session_token=secret; Domain=.vercel.app; Path=/; HttpOnly; Secure; SameSite=Lax' } }),
    () => Response.json({ user }, { headers: { 'set-cookie': '__Secure-fm_preview_access.session_token=secret; Path=/; HttpOnly; Secure; SameSite=Lax; SameSite=None' } }),
  ];
  for (const fetchImpl of responses) {
    const response = await createAccessProxy({ env, fetchImpl })(req());
    assert.equal(response.status, 503);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal((await response.text()).includes('private'), false);
  }
});
test('real HTTP gateway keeps separate Set-Cookie headers and bounds request bodies', async () => {
  const server = createGateway({ key: 'd'.repeat(64), accessEnv: env, fetchImpl: async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    for (const suffix of ['session_token=opaque', 'dont_remember=']) headers.append('set-cookie', '__Secure-fm_preview_access.' + suffix + '; Path=/; HttpOnly; Secure; SameSite=Lax');
    return new Response(JSON.stringify({ user }), { headers });
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/access/login`;
  const headers = { authorization: 'Bearer ' + env.PREVIEW_ACCESS_BRIDGE_KEY, 'x-fm-client-ip': '203.0.113.5', origin: PREVIEW_ORIGIN, 'content-type': 'application/json' };
  try {
    const response = await fetch(url, { method: 'POST', headers, body: '{}' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.getSetCookie().length, 2);
    assert.equal((await fetch(url, { method: 'POST', headers, body: 'x'.repeat(8193) })).status, 413);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
