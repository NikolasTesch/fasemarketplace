import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { LocalAccessService } from '../dist/access/service.js';
import { createAccessAuth } from '../dist/access/auth.js';
import { TelemetryExceptionFilter } from '../dist/api-exception-filter.js';
import { createGateway } from '../../../server/preview-gateway.mjs';
import { createAccessProxy, PREVIEW_ORIGIN } from '../../../server/access-bridge.mjs';
const { Request } = globalThis;

test('Preview transport chain against real disposable PostgreSQL/Redis, no Neon connection', async (t) => {
  assert.match(new URL(process.env.AUTH_DATABASE_URL).pathname, /^\/fm_auth_test_[a-z0-9_]+$/);
  assert.equal(process.env.AUTH_CONTEXT ?? 'local', 'local');
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  app.useBodyParser('json', { limit: '8kb' });
  app.useGlobalFilters(new TelemetryExceptionFilter(app.get(HttpAdapterHost), { exception: () => {} }));
  let gateway;
  try {
    const access = app.get(LocalAccessService);
    // Test-only dependency injection after normal local configuration is validated.
    // Production code has no test-mode bypass for the Neon endpoint/TLS contract.
    const apiKey = 'c'.repeat(64), bridgeKey = 'b'.repeat(64);
    Object.assign(access.config, { context: 'preview', origin: PREVIEW_ORIGIN, apiKey,
      cookiePrefix: 'fm_preview_access', secret: randomBytes(32).toString('hex') });
    access.auth = createAccessAuth(access.pool, access.config);
    await app.listen(0, '127.0.0.1');
    const apiOrigin = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const env = { APP_ENV: 'local', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'development',
      PREVIEW_ACCESS_ENABLED: 'true', PREVIEW_ACCESS_ORIGIN: PREVIEW_ORIGIN,
      PREVIEW_ACCESS_BRIDGE_ORIGIN: 'https://synthetic-preview.trycloudflare.com',
      PREVIEW_ACCESS_BRIDGE_KEY: bridgeKey, PREVIEW_ACCESS_API_KEY: apiKey };
    gateway = createGateway({ key: 'd'.repeat(64), accessEnv: env, fetchImpl: (url, options) => {
      assert.ok(url.startsWith('http://api:3001/access/'));
      return fetch(apiOrigin + url.slice('http://api:3001'.length), options);
    } });
    gateway.listen(0, '127.0.0.1');
    await once(gateway, 'listening');
    const gatewayOrigin = `http://127.0.0.1:${gateway.address().port}`;
    const proxy = createAccessProxy({ env, fetchImpl: (url, options) => {
      assert.ok(url.startsWith(env.PREVIEW_ACCESS_BRIDGE_ORIGIN + '/access/'));
      return fetch(gatewayOrigin + url.slice(env.PREVIEW_ACCESS_BRIDGE_ORIGIN.length), options);
    } });
    const email = `preview${Date.now()}@example.test`, password = 'Synthetic-Preview-Admin-2026!';
    const admin = await access.auth.api.createUser({ body: { name: 'Synthetic Preview Admin', email, password, role: 'admin', data: { mustChangePassword: false } } });
    const request = (path, { method = 'GET', body, cookie = '', ip = '203.0.113.8', origin = PREVIEW_ORIGIN } = {}) =>
      proxy(new Request(PREVIEW_ORIGIN + '/api/access' + path, { method,
        headers: { origin, 'content-type': 'application/json', 'x-vercel-forwarded-for': ip, cookie },
        body: body === undefined ? undefined : JSON.stringify(body) }));
    let cookie;
    const cookieOf = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    await t.test('direct API and forged client metadata are refused before session lookup', async () => {
      for (const headers of [{}, { authorization: 'Bearer wrong', 'x-fm-client-ip': '203.0.113.8' },
        { authorization: 'Bearer ' + apiKey, 'x-forwarded-for': '203.0.113.8' }]) {
        assert.equal((await fetch(apiOrigin + '/access/session', { headers })).status, 403);
      }
    });
    await t.test('login through both hops issues only Secure HttpOnly host cookies and sanitized user', async () => {
      const response = await request('/login', { method: 'POST', body: { email, password } });
      assert.equal(response.status, 200);
      const cookies = response.headers.getSetCookie();
      assert.ok(cookies.some(value => value.startsWith('__Secure-fm_preview_access.session_token=') && /Secure/.test(value) && /HttpOnly/.test(value) && /SameSite=Lax/.test(value)));
      cookie = cookieOf(response);
      const data = await response.json();
      assert.equal(data.user.role, 'admin');
      assert.equal(JSON.stringify(data).includes('token'), false);
      assert.equal(JSON.stringify(data).includes(password), false);
      assert.equal((await request('/session', { cookie })).status, 200);
    });
    await t.test('session renewal retains secure cookie through both hops', async () => {
      await access.pool.query('UPDATE auth_session SET "expiresAt"=now()+interval \'6 hours\', "updatedAt"=now()-interval \'2 hours\' WHERE "userId"=$1', [admin.user.id]);
      const renewed = await request('/session', { cookie });
      assert.equal(renewed.status, 200);
      assert.ok(renewed.headers.getSetCookie().some(value => /Secure/.test(value) && /HttpOnly/.test(value)));
      cookie = cookieOf(renewed) || cookie;
    });
    await t.test('role and mandatory password gates remain enforced through the proxy', async () => {
      const userEmail = `operator${Date.now()}@example.test`;
      const created = await request('/users', { method: 'POST', cookie, body: { email: userEmail, name: 'Synthetic Operator', password, role: 'user' } });
      assert.equal(created.status, 201);
      const login = await request('/login', { method: 'POST', body: { email: userEmail, password } });
      assert.equal(login.status, 200);
      const userCookie = cookieOf(login);
      assert.equal((await login.json()).user.mustChangePassword, true);
      assert.equal((await request('/users', { cookie: userCookie })).status, 403);
      const changed = await request('/password', { method: 'POST', cookie: userCookie, body: { currentPassword: password, newPassword: password + 'new' } });
      assert.equal(changed.status, 200);
      const current = cookieOf(changed) || userCookie;
      assert.equal((await request('/users', { cookie: current })).status, 403);
      assert.equal((await (await request('/session', { cookie: current })).json()).user.mustChangePassword, false);
    });
    await t.test('foreign Origin and local cookie namespace cannot grant Preview access', async () => {
      assert.equal((await request('/logout', { method: 'POST', cookie, body: {}, origin: 'https://evil.example' })).status, 403);
      const crossed = cookie.replaceAll('__Secure-fm_preview_access', 'fm_local_access');
      assert.equal((await request('/session', { cookie: crossed })).status, 401);
    });
    await t.test('rate limit uses verified individual client IP, not gateway socket or forged XFF', async () => {
      for (let i = 0; i < 5; i++) assert.equal((await request('/login', { method: 'POST', ip: '203.0.113.40', body: { email: 'missing@example.test', password } })).status, 401);
      assert.equal((await request('/login', { method: 'POST', ip: '203.0.113.40', body: { email: 'missing@example.test', password } })).status, 429);
      assert.equal((await request('/login', { method: 'POST', ip: '203.0.113.41', body: { email: 'missing@example.test', password } })).status, 401);
    });
    await t.test('logout forwards deletion cookie and invalidates the old session', async () => {
      const result = await request('/logout', { method: 'POST', cookie, body: {} });
      assert.equal(result.status, 200);
      assert.ok(result.headers.getSetCookie().some(value => value.includes('Max-Age=0')));
      assert.equal((await request('/session', { cookie })).status, 401);
    });
  } finally {
    if (gateway) { gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve)); }
    await app.close();
  }
});
