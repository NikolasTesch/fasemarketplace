import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGateway } from '../preview-gateway.mjs';
import { createPreviewProxy } from '../preview-proxy.mjs';

const key = 'a'.repeat(43);
const ready = { status: 'ready', dependencies: { postgres: true, redis: true }, marketplaceMode: 'mock' };
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

test('gateway authenticates before reaching API and restricts routes/methods', async () => {
  let calls = 0;
  const gateway = createGateway({ key, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'http://api:3001/health/ready');
    assert.equal(options.headers.authorization, undefined);
    return Response.json({ ...ready, private: 'discard-me' });
  } });
  const origin = await listen(gateway);
  try {
    for (const auth of ['', 'Bearer wrong', `Bearer ${key}x`]) {
      const result = await fetch(`${origin}/health/ready`, { headers: { authorization: auth } });
      assert.equal(result.status, 401);
    }
    assert.equal(calls, 0);
    const headers = { authorization: `Bearer ${key}` };
    for (const route of ['/other', '/health/ready?url=http://other', '/health/ready/']) {
      assert.equal((await fetch(origin + route, { headers })).status, 404);
    }
    assert.equal((await fetch(`${origin}/health/ready`, { method: 'POST', headers })).status, 405);
    assert.equal(calls, 0);
    const response = await fetch(`${origin}/health/ready`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), ready);
    assert.equal(calls, 1);
  } finally { await close(gateway); }
});

test('gateway refuses missing or weak key at startup', () => {
  for (const value of ['', 'short', 'with spaces'.repeat(8)]) assert.throws(() => createGateway({ key: value }));
});

test('proxy disabled or invalid configuration never sends traffic', async () => {
  let calls = 0;
  const valid = { PREVIEW_BRIDGE_ENABLED: 'true', VERCEL_ENV: 'preview', PREVIEW_BRIDGE_KEY: key,
    PREVIEW_BRIDGE_ORIGIN: 'https://synthetic-test.trycloudflare.com' };
  for (const overrides of [
    { PREVIEW_BRIDGE_ENABLED: 'false' }, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'development' },
    { PREVIEW_BRIDGE_KEY: '' }, { PREVIEW_BRIDGE_ORIGIN: 'http://localhost' },
    { PREVIEW_BRIDGE_ORIGIN: 'https://synthetic-test.trycloudflare.com/other' },
    { PREVIEW_BRIDGE_ORIGIN: 'https://synthetic-test.trycloudflare.com.evil.example' },
  ]) {
    const handler = createPreviewProxy({ env: { ...valid, ...overrides }, fetchImpl: async () => { calls++; } });
    assert.equal((await handler(new Request('https://web.vercel.app/api/health/ready'))).status, 503);
  }
  assert.equal(calls, 0);
});

test('proxy sends only server credentials to a fixed path and filters result', async () => {
  const handler = createPreviewProxy({ env: { PREVIEW_BRIDGE_ENABLED: 'true', VERCEL_ENV: 'preview',
    PREVIEW_BRIDGE_KEY: key, PREVIEW_BRIDGE_ORIGIN: 'https://synthetic-test.trycloudflare.com' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://synthetic-test.trycloudflare.com/health/ready');
      assert.deepEqual(options.headers, { authorization: `Bearer ${key}`, accept: 'application/json' });
      assert.equal(options.redirect, 'error');
      return Response.json({ ...ready, leaked_token: key }, { headers: { 'set-cookie': 'secret', location: 'https://other' } });
    } });
  const response = await handler(new Request('https://web.vercel.app/api/health/ready', {
    headers: { authorization: 'browser-secret', cookie: 'user-session', 'x-forwarded-for': 'private' } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), ready);
});

test('proxy rejects method/path/query changes without fetching', async () => {
  let calls = 0;
  const handler = createPreviewProxy({ env: { PREVIEW_BRIDGE_ENABLED: 'true', VERCEL_ENV: 'preview',
    PREVIEW_BRIDGE_KEY: key, PREVIEW_BRIDGE_ORIGIN: 'https://synthetic-test.trycloudflare.com' },
    fetchImpl: async () => { calls++; return Response.json(ready); } });
  assert.equal((await handler(new Request('https://web.vercel.app/api/health/ready', { method: 'POST' }))).status, 405);
  assert.equal((await handler(new Request('https://web.vercel.app/api/health/ready?url=https://other'))).status, 404);
  assert.equal((await handler(new Request('https://web.vercel.app/api/other'))).status, 404);
  assert.equal(calls, 0);
});

test('gateway bounds concurrent authenticated requests and recovers capacity', async () => {
  const release = [];
  const server = createGateway({ key, fetchImpl: () => new Promise(resolve => release.push(() => resolve(Response.json(ready)))) });
  const origin = await listen(server);
  const headers = { authorization: `Bearer ${key}` };
  const pending = [];
  try {
    pending.push(fetch(`${origin}/health/ready`, { headers }));
    pending.push(fetch(`${origin}/health/ready`, { headers }));
    const deadline = Date.now() + 3000;
    while (release.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(release.length, 2);
    assert.equal((await fetch(`${origin}/health/ready`, { headers })).status, 503);
    release.forEach(done => done());
    for (const response of await Promise.all(pending)) assert.equal(response.status, 200);
  } finally {
    release.forEach(done => done());
    await close(server);
  }
});

test('transport failures, malformed payloads and redirects return generic unavailable', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('private network error'); },
    async () => new Response('invalid JSON'),
    async () => new Response('x'.repeat(17000)),
    async () => Response.json(ready, { status: 302 }),
    async () => Response.json({ ...ready, marketplaceMode: 'real' }),
  ]) {
    const server = createGateway({ key, fetchImpl });
    const origin = await listen(server);
    try {
      const response = await fetch(`${origin}/health/ready`, { headers: { authorization: `Bearer ${key}` } });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: 'unavailable' });
    } finally { await close(server); }
  }
});
