// Synthetic integration runner; never changes an existing application database.
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readBusinessMaintenanceConfig } from '../apps/backend/dist/persistence/config.js';
import { runBusinessMaintenance } from './business-operations.mjs';

try {
  const base = new URL(process.env.DATABASE_URL ?? '');
  if (process.env.APP_ENV !== 'local' || base.protocol !== 'postgresql:' || base.hostname !== 'postgres' ||
      (base.port && base.port !== '5432') || base.pathname !== '/fm_auth_test_business' || base.search || base.hash ||
      !process.env.BUSINESS_TEST_RUNTIME_PASSWORD || !process.env.BUSINESS_TEST_MIGRATION_PASSWORD) throw new Error();
  const database = 'fm_auth_test_business_access_' + randomBytes(6).toString('hex');
  const shadowDatabase = 'fm_business_shadow_access_' + randomBytes(6).toString('hex');
  const setup = new Pool({ connectionString: base.href });
  try {
    await setup.query(`CREATE DATABASE "${database}"`);
    await setup.query(`CREATE DATABASE "${shadowDatabase}"`);
  } finally { await setup.end(); }
  const owner = new URL(base); owner.pathname = '/' + database;
  const runtime = new URL(owner); runtime.username = 'fm_business_runtime'; runtime.password = process.env.BUSINESS_TEST_RUNTIME_PASSWORD; runtime.search = '?schema=business';
  const migration = new URL(owner); migration.username = 'fm_business_migrator'; migration.password = process.env.BUSINESS_TEST_MIGRATION_PASSWORD; migration.search = '?schema=business';
  const shadow = new URL(migration); shadow.pathname = '/' + shadowDatabase;
  const auth = new URL(owner); auth.username = 'fm_auth_runtime'; auth.password = process.env.BUSINESS_TEST_RUNTIME_PASSWORD;
  const env = { ...process.env, DATABASE_URL: owner.href, AUTH_DATABASE_URL: auth.href,
    AUTH_ENABLED: 'true', BUSINESS_ENABLED: 'true', BUSINESS_LOCAL_DATABASE: database,
    BUSINESS_DATABASE_URL: runtime.href, BUSINESS_MIGRATION_DATABASE_URL: migration.href, BUSINESS_SHADOW_DATABASE_URL: shadow.href };
  const run = args => {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', timeout: 120000 });
    if (result.status !== 0) throw new Error();
  };
  run(['scripts/auth-local.mjs', 'migrate']);
  const config = readBusinessMaintenanceConfig(env);
  await runBusinessMaintenance({ action: 'provision', config, adminUrl: owner.href });
  await runBusinessMaintenance({ action: 'migrate', config });
  run(['--test', 'apps/backend/test/access.integration.mjs']);
  console.log('Combined auth/business access rehearsal passed (new local synthetic database)');
} catch {
  console.error('Combined access rehearsal refused or failed; fixture database retained without promotion');
  process.exitCode = 1;
}
