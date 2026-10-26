const { test } = require('node:test');
const assert = require('node:assert/strict');
const origin = 'https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app';
const valid = { AUTH_ENABLED: 'true', AUTH_CONTEXT: 'preview', APP_ENV: 'local', MARKETPLACE_MODE: 'mock',
  DATABASE_PROVIDER: 'neon', NEON_BRANCH: 'development', NEON_DEVELOPMENT_HOST: 'ep-synthetic-test-pooler.sa-east-1.aws.neon.tech',
  DATABASE_URL: 'postgresql://fm_auth_preview_runtime:synthetic@ep-synthetic-test-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=verify-full',
  AUTH_DATABASE_URL: 'postgresql://fm_auth_preview_runtime:synthetic@ep-synthetic-test-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=verify-full',
  AUTH_SECRET: 's'.repeat(64), AUTH_API_KEY: 'k'.repeat(64), AUTH_ORIGIN: origin,
  AUTH_COOKIE_PREFIX: 'fm_preview_access', REDIS_URL: 'redis://redis:6379' };
test('local migration/bootstrap/generator configuration refuses Preview before opening a connection', async () => {
  const { readLocalAccessOperationConfig } = await import('../dist/access/config.js');
  assert.equal(typeof readLocalAccessOperationConfig, 'function');
  assert.throws(() => readLocalAccessOperationConfig(valid));
  assert.throws(() => readLocalAccessOperationConfig({ AUTH_ENABLED: 'false' }));
});
test('Preview auth requires explicit context, development target/TLS and independent credentials', async () => {
  const { readAccessConfig } = await import('../dist/access/config.js');
  const config = readAccessConfig(valid);
  assert.equal(config.context, 'preview');
  for (const change of [{ AUTH_CONTEXT: 'production' }, { APP_ENV: 'production' }, { NEON_BRANCH: 'production' },
    { AUTH_ORIGIN: 'https://other.vercel.app' }, { AUTH_COOKIE_PREFIX: 'fm_local_access' },
    { AUTH_API_KEY: '' }, { AUTH_API_KEY: valid.AUTH_SECRET }, { DATABASE_PROVIDER: 'local' },
    { AUTH_DATABASE_URL: valid.AUTH_DATABASE_URL.replace('fm_auth_preview_runtime', 'owner') },
    { DATABASE_URL: valid.DATABASE_URL.replace('fm_auth_preview_runtime', 'owner') },
    { AUTH_DATABASE_URL: valid.AUTH_DATABASE_URL.replace('verify-full', 'require') },
    { AUTH_DATABASE_URL: valid.AUTH_DATABASE_URL.replace('/neondb?', '/other?') }]) {
    assert.throws(() => readAccessConfig({ ...valid, ...change }));
  }
});
test('API only trusts client metadata with its own hop credential; local ignores proxy headers', async () => {
  const { readAccessConfig } = await import('../dist/access/config.js');
  const { verifiedClientAddress } = await import('../dist/access/transport.js');
  const config = readAccessConfig(valid);
  const request = { headers: { authorization: 'Bearer ' + valid.AUTH_API_KEY, 'x-fm-client-ip': '203.0.113.8', 'x-forwarded-for': '198.51.100.1' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(verifiedClientAddress(config, request), '203.0.113.8');
  for (const headers of [{}, { ...request.headers, authorization: 'Bearer wrong' }, { ...request.headers, 'x-fm-client-ip': 'bad' }, { ...request.headers, 'x-fm-client-ip': ['203.0.113.8'] }]) {
    assert.throws(() => verifiedClientAddress(config, { ...request, headers }));
  }
  assert.equal(verifiedClientAddress({ ...config, context: 'local' }, request), '127.0.0.1');
});
test('Preview forces Secure cookies without changing loopback local cookies', async () => {
  const { authOptions } = await import('../dist/access/auth.js');
  const { readAccessConfig } = await import('../dist/access/config.js');
  const config = readAccessConfig(valid);
  assert.equal(authOptions({}, config).advanced.useSecureCookies, true);
  assert.equal(authOptions({}, { ...config, context: 'local' }).advanced.useSecureCookies, false);
});
