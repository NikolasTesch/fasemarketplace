const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../dist/access/config.js');
const valid = { AUTH_ENABLED: 'true', APP_ENV: 'local', DATABASE_PROVIDER: 'local',
  DATABASE_URL: 'postgresql://owner:synthetic@postgres:5432/local',
  AUTH_DATABASE_URL: 'postgresql://fm_auth_runtime:synthetic@postgres:5432/local',
  AUTH_SECRET: 's'.repeat(64), AUTH_ORIGIN: 'http://127.0.0.1:4173', REDIS_URL: 'redis://redis:6379' };
test('auth is disabled by default and explicit opt-in is restricted to Docker local', async () => {
  const { readAccessConfig } = await load();
  assert.equal(readAccessConfig({}), undefined);
  assert.equal(readAccessConfig(valid).origin, valid.AUTH_ORIGIN);
  for (const change of [{APP_ENV:'production'},{DATABASE_PROVIDER:'neon'},{AUTH_SECRET:'short'},
    {AUTH_ORIGIN:'https://example.vercel.app'},{AUTH_ORIGIN:'http://0.0.0.0:4173'},
    {AUTH_ORIGIN:'http://127.0.0.1:4173/path'},{AUTH_DATABASE_URL:valid.DATABASE_URL},
    {AUTH_DATABASE_URL:valid.AUTH_DATABASE_URL+'?sslmode=disable'},
    {AUTH_DATABASE_URL:valid.AUTH_DATABASE_URL.replace('/local','/other')},
    {AUTH_DATABASE_URL:valid.AUTH_DATABASE_URL.replace('@postgres','@remote.example')},
    {REDIS_URL:'redis://remote.example:6379'},{AUTH_ENABLED:'yes'}]) {
    assert.throws(()=>readAccessConfig({...valid,...change}));
  }
});
