import { readBusinessMaintenanceConfig } from '../apps/backend/dist/persistence/config.js';
import { validateBusinessAdminUrl } from './business-operations.mjs';
import { readBackupKey } from './auth-backup-format.mjs';
import { createAccessBackup } from './auth-backup-operations.mjs';

try {
  if (process.argv.length !== 3 || !process.argv[2]?.endsWith('.fmbackup')) throw new Error();
  const config = readBusinessMaintenanceConfig();
  const source = validateBusinessAdminUrl(config, process.env.BUSINESS_ADMIN_DATABASE_URL);
  const result = await createAccessBackup({ sourceUrl: source.href, context: 'local', file: process.argv[2], key: readBackupKey() });
  console.log(JSON.stringify(result));
} catch {
  console.error('Business backup refused or failed; verify local target, independent key and matching PostgreSQL tooling.');
  process.exitCode = 1;
}
