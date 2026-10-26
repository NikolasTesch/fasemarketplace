// Offline-only schema validation/client generation with fictitious local configuration.
// This script never reads application database credentials.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const action = process.argv[2];
if (!['validate', 'generate'].includes(action) || process.argv.length !== 3) {
  console.error('Business artifact action refused'); process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), action, '--config', 'prisma.config.ts'], {
    cwd: resolve('apps/backend'), encoding: 'utf8', timeout: 60000,
    env: { PATH: process.env.PATH, HOME: '/tmp', APP_ENV: 'local', DATABASE_PROVIDER: 'local', BUSINESS_ENABLED: 'true',
      BUSINESS_LOCAL_DATABASE: 'fm_business_test_offline',
      BUSINESS_DATABASE_URL: 'postgresql://fm_business_runtime:example-runtime@postgres/fm_business_test_offline?schema=business',
      BUSINESS_MIGRATION_DATABASE_URL: 'postgresql://fm_business_migrator:example-migration@postgres/fm_business_test_offline?schema=business',
      BUSINESS_SHADOW_DATABASE_URL: 'postgresql://fm_business_migrator:example-migration@postgres/fm_business_shadow_offline?schema=business',
      CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
  if (result.status !== 0) { console.error('Business artifact operation failed'); process.exitCode = 1; }
  else console.log('Business ' + action + ' complete (offline configuration)');
}
