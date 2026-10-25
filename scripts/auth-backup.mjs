import { readBackupKey } from './auth-backup-format.mjs';
import { createAccessBackup, restoreAccessBackup, validateRestoreBase } from './auth-backup-operations.mjs';
import { readPreviewMaintenanceConfig } from '../apps/backend/dist/access/maintenance-config.js';
import { readLocalAccessOperationConfig } from '../apps/backend/dist/access/config.js';

try {
  const [, , action, file] = process.argv;
  if (process.argv.length !== 4 || !['preview', 'local-test', 'restore-local'].includes(action) || !file?.endsWith('.fmbackup'))
    throw new Error('Use preview|local-test|restore-local and a .fmbackup path');
  const key = readBackupKey();
  let result;
  if (action === 'preview') {
    const config = readPreviewMaintenanceConfig();
    result = await createAccessBackup({ sourceUrl: config.ownerUrl, context: 'preview', file, key });
  } else {
    readLocalAccessOperationConfig();
    const baseUrl = validateRestoreBase(process.env.DATABASE_URL).href;
    result = action === 'restore-local'
      ? await restoreAccessBackup({ baseUrl, file, key })
      : await createAccessBackup({ sourceUrl: baseUrl, context: 'local-test', file, key });
  }
  console.log(JSON.stringify(result));
} catch {
  console.error('Backup/restore refused or failed. Check private key, validated target, archive integrity, file permissions and matching PostgreSQL 17/18 tooling. No credential or client diagnostic was logged.');
  process.exitCode = 1;
}
