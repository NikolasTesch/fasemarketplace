const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
test('Preview maintenance validates a separate direct owner before any connection', async () => {
  const { readPreviewMaintenanceConfig } = await import('../dist/access/maintenance-config.js');
  const host = 'ep-synthetic-test-pooler.c-2.sa-east-1.aws.neon.tech';
  const runtime = `postgresql://fm_auth_preview_runtime:synthetic@${host}/neondb?sslmode=verify-full`;
  const env = { APP_ENV: 'local', MARKETPLACE_MODE: 'mock', DATABASE_PROVIDER: 'neon', NEON_BRANCH: 'development',
    NEON_DEVELOPMENT_HOST: host, DATABASE_URL: runtime, AUTH_DATABASE_URL: runtime, AUTH_ENABLED: 'true',
    AUTH_CONTEXT: 'preview', AUTH_ORIGIN: 'https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app',
    AUTH_SECRET: 's'.repeat(64), AUTH_API_KEY: 'k'.repeat(64), AUTH_COOKIE_PREFIX: 'fm_preview_access', REDIS_URL: 'redis://redis:6379',
    PREVIEW_AUTH_OWNER_DATABASE_URL: 'postgresql://neondb_owner:owner-synthetic@ep-synthetic-test.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=verify-full' };
  assert.equal(readPreviewMaintenanceConfig(env).ownerUrl, env.PREVIEW_AUTH_OWNER_DATABASE_URL);
  for (const patch of [{ AUTH_CONTEXT: 'local' }, { APP_ENV: 'production' }, { NEON_BRANCH: 'production' },
    { PREVIEW_AUTH_OWNER_DATABASE_URL: runtime }, { PREVIEW_AUTH_OWNER_DATABASE_URL: env.PREVIEW_AUTH_OWNER_DATABASE_URL.replace('/neondb?', '/other?') },
    { PREVIEW_AUTH_OWNER_DATABASE_URL: env.PREVIEW_AUTH_OWNER_DATABASE_URL.replace('verify-full', 'require') },
    { PREVIEW_AUTH_OWNER_DATABASE_URL: env.PREVIEW_AUTH_OWNER_DATABASE_URL.replace('neondb_owner', 'fm_auth_preview_runtime') },
    { PREVIEW_AUTH_OWNER_DATABASE_URL: env.PREVIEW_AUTH_OWNER_DATABASE_URL.replace('owner-synthetic', 'synthetic') },
    { PREVIEW_AUTH_OWNER_DATABASE_URL: env.PREVIEW_AUTH_OWNER_DATABASE_URL.replace('owner-synthetic', '%73ynthetic') },
    { PREVIEW_AUTH_OWNER_DATABASE_URL: undefined }, { AUTH_ENABLED: 'false' }]) {
    assert.throws(() => readPreviewMaintenanceConfig({ ...env, ...patch }));
  }
  const command = resolve(__dirname, '../../../scripts/auth-preview.mjs');
  const valid = spawnSync(process.execPath, [command, 'check'], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /No database connection or write performed/);
  const refused = spawnSync(process.execPath, [command, 'migrate'], { env: { ...process.env, ...env, APP_ENV: 'production' }, encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /refused or failed/);
  assert.ok(!refused.stderr.includes('synthetic'));
});
