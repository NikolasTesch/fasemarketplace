import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProductionProxy } from '../production-proxy.mjs';

const key = 'b'.repeat(43);
const env = { VERCEL_ENV: 'production', PRODUCTION_BRIDGE_ENABLED: 'true',
  PRODUCTION_BRIDGE_KEY: key, PRODUCTION_BRIDGE_ORIGIN: 'https://production-test.trycloudflare.com',
  PREVIEW_BRIDGE_ENABLED: 'true', PREVIEW_BRIDGE_KEY: 'a'.repeat(43),
  PREVIEW_BRIDGE_ORIGIN: 'https://preview-test.trycloudflare.com' };
const request = () => new Request('https://app.vercel.app/api/health/ready');

test('production bridge selects only production origin and credential and sanitizes output', async () => {
  const handler = createProductionProxy({ env, fetchImpl: async (url, options) => {
    assert.equal(url, env.PRODUCTION_BRIDGE_ORIGIN + '/health/ready');
    assert.equal(options.headers.authorization, `Bearer ${key}`);
    return Response.json({ status: 'ready', dependencies: { postgres: true, redis: true },
      marketplaceMode: 'mock', secret: key });
  } });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.text()).includes(key), false);
});

test('production bridge fails closed and never falls back to preview', async () => {
  let calls = 0;
  for (const override of [
    { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, { VERCEL_ENV: undefined },
    { PRODUCTION_BRIDGE_ENABLED: 'false' }, { PRODUCTION_BRIDGE_KEY: undefined },
    { PRODUCTION_BRIDGE_KEY: 'short' }, { PRODUCTION_BRIDGE_ORIGIN: undefined },
    { PRODUCTION_BRIDGE_ORIGIN: 'https://evil.example' },
    { PRODUCTION_BRIDGE_ORIGIN: env.PRODUCTION_BRIDGE_ORIGIN + '?host=evil' },
  ]) {
    const handler = createProductionProxy({ env: { ...env, ...override }, fetchImpl: async () => { calls++; } });
    assert.equal((await handler(request())).status, 503);
  }
  assert.equal(calls, 0);
});
