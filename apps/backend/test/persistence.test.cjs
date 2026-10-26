const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../dist/persistence/config.js');
const valid = { BUSINESS_ENABLED: 'true', APP_ENV: 'local', DATABASE_PROVIDER: 'local',
  BUSINESS_LOCAL_DATABASE: 'fm_business_test_config',
  BUSINESS_DATABASE_URL: 'postgresql://fm_business_runtime:runtime-only@postgres:5432/fm_business_test_config?schema=business',
  BUSINESS_MIGRATION_DATABASE_URL: 'postgresql://fm_business_migrator:migration-only@postgres:5432/fm_business_test_config?schema=business',
  BUSINESS_SHADOW_DATABASE_URL: 'postgresql://fm_business_migrator:migration-only@postgres:5432/fm_business_shadow_config?schema=business' };

test('business persistence is opt-in and limited to explicit Docker-local target', async () => {
  const { readBusinessConfig } = await load();
  assert.equal(readBusinessConfig({}), null);
  assert.equal(readBusinessConfig(valid).database, 'fm_business_test_config');
  for (const change of [{ BUSINESS_ENABLED: 'yes' }, { APP_ENV: 'production' }, { APP_ENV: 'preview' },
    { DATABASE_PROVIDER: 'neon' }, { BUSINESS_LOCAL_DATABASE: 'neondb' },
    { BUSINESS_DATABASE_URL: valid.BUSINESS_DATABASE_URL.replace('@postgres', '@localhost') },
    { BUSINESS_DATABASE_URL: valid.BUSINESS_DATABASE_URL.replace('fm_business_runtime', 'owner') },
    { BUSINESS_DATABASE_URL: valid.BUSINESS_DATABASE_URL + '&schema=business' },
    { BUSINESS_DATABASE_URL: valid.BUSINESS_DATABASE_URL + '&sslmode=disable' },
    { BUSINESS_DATABASE_URL: valid.BUSINESS_DATABASE_URL.replace('schema=business', 'schema=public') },
    { BUSINESS_DATABASE_URL: valid.BUSINESS_DATABASE_URL.replace('/fm_business_test_config', '/other') }])
    assert.throws(() => readBusinessConfig({ ...valid, ...change }), /Docker-local/);
});

test('maintenance separates credentials and disposable shadow before connecting', async () => {
  const { readBusinessMaintenanceConfig } = await load();
  assert.equal(readBusinessMaintenanceConfig(valid).shadowDatabase, 'fm_business_shadow_config');
  for (const change of [{ BUSINESS_MIGRATION_DATABASE_URL: valid.BUSINESS_DATABASE_URL },
    { BUSINESS_MIGRATION_DATABASE_URL: valid.BUSINESS_MIGRATION_DATABASE_URL.replace('migration-only', 'runtime-only') },
    { BUSINESS_SHADOW_DATABASE_URL: valid.BUSINESS_MIGRATION_DATABASE_URL },
    { BUSINESS_SHADOW_DATABASE_URL: valid.BUSINESS_SHADOW_DATABASE_URL.replace('@postgres', '@remote.example') },
    { BUSINESS_SHADOW_DATABASE_URL: valid.BUSINESS_SHADOW_DATABASE_URL.replace('migration-only', 'other-password') },
    { BUSINESS_ENABLED: 'false' }])
    assert.throws(() => readBusinessMaintenanceConfig({ ...valid, ...change }), /Docker-local/);
});
