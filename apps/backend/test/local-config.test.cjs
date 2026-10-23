const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readLocalConfig, readBrowserOrigins } = require('../dist/local-config.js');

const valid = {
  APP_ENV: 'local', MARKETPLACE_MODE: 'mock',
  DATABASE_URL: 'postgresql://local:example@postgres:5432/local',
  REDIS_URL: 'redis://redis:6379',
};

test('accepts only the local Docker services and mock mode', () => {
  assert.equal(readLocalConfig(valid).databaseUrl, valid.DATABASE_URL);
});

for (const [name, value] of [
  ['APP_ENV', 'production'], ['MARKETPLACE_MODE', 'real'],
  ['DATABASE_URL', 'postgresql://local:secret@remote.example:5432/local'],
  ['DATABASE_URL', 'https://postgres/local'],
  ['DATABASE_URL', 'postgresql://local:secret@postgres:5432/local?host=remote.example'],
  ['REDIS_URL', 'redis://remote.example:6379'],
  ['REDIS_URL', 'rediss://redis:6379'],
  ['REDIS_URL', 'redis://redis:1234'],
  ['DATABASE_URL', ''], ['APP_ENV', undefined],
]) {
  test(`refuses invalid or external configuration: ${name}=${value}`, () => {
    assert.throws(() => readLocalConfig({ ...valid, [name]: value }));
  });
}

test('configuration errors do not expose credentials', () => {
  assert.throws(
    () => readLocalConfig({ ...valid, DATABASE_URL: 'postgresql://x:private-secret@remote/db' }),
    (error) => !error.message.includes('private-secret'),
  );
});

const neon = {
  ...valid, DATABASE_PROVIDER: 'neon', NEON_BRANCH: 'development',
  NEON_DEVELOPMENT_HOST: 'ep-synthetic-123-pooler.sa-east-1.aws.neon.tech',
  DATABASE_URL: 'postgresql://dev:example@ep-synthetic-123-pooler.sa-east-1.aws.neon.tech/fasemarketplace?sslmode=verify-full',
};

test('CORS accepts only explicit HTTPS origins and defaults closed', () => {
  assert.deepEqual(readBrowserOrigins({}), []);
  assert.deepEqual(readBrowserOrigins({ WEB_ALLOWED_ORIGINS: 'https://example.vercel.app' }), ['https://example.vercel.app']);
  for (const value of ['*', 'http://example.com', 'https://example.com/path', 'https://user:secret@example.com', 'null']) {
    assert.throws(() => readBrowserOrigins({ WEB_ALLOWED_ORIGINS: value }));
  }
});

test('Neon requires explicit development opt-in and verified TLS', () => {
  const config = readLocalConfig(neon);
  assert.equal(config.databaseUrl, neon.DATABASE_URL);
  assert.equal(config.databaseProvider, 'neon');
  assert.equal(config.workerCheckIntervalMs, 600000);
  assert.equal(readLocalConfig(valid).workerCheckIntervalMs, 5000);
});

test('accepts Neon pooled endpoints with a proxy cluster label', () => {
  const host = 'ep-synthetic-123-pooler.c-2.sa-east-1.aws.neon.tech';
  const input = { ...neon, NEON_DEVELOPMENT_HOST: host,
    DATABASE_URL: neon.DATABASE_URL.replace(neon.NEON_DEVELOPMENT_HOST, host) };
  assert.equal(readLocalConfig(input).databaseUrl, input.DATABASE_URL);
});

for (const override of [
  { DATABASE_PROVIDER: 'unknown' }, { NEON_BRANCH: 'production' },
  { NEON_DEVELOPMENT_HOST: '' }, { APP_ENV: 'production' }, { MARKETPLACE_MODE: 'real' },
  { DATABASE_URL: neon.DATABASE_URL.replace('verify-full', 'require') },
  { DATABASE_URL: neon.DATABASE_URL + '&host=other.example' },
  { DATABASE_URL: neon.DATABASE_URL + '&sslmode=disable' },
  { DATABASE_URL: neon.DATABASE_URL + '#fragment' },
  { DATABASE_URL: neon.DATABASE_URL.replace('dev:example@', '') },
  { DATABASE_URL: neon.DATABASE_URL.replace('/fasemarketplace?', '/?') },
  { DATABASE_URL: neon.DATABASE_URL.replace('ep-synthetic-123-pooler.', 'ep-production-pooler.') },
  { NEON_DEVELOPMENT_HOST: 'ep-synthetic-123-pooler.sa-east-1.aws.neon.tech.evil.example' },
  { REDIS_URL: 'redis://remote.example:6379' },
]) {
  test(`rejects unsafe Neon configuration ${JSON.stringify(override)}`, () => {
    assert.throws(() => readLocalConfig({ ...neon, ...override }),
      (error) => !error.message.includes('example@'));
  });
}
