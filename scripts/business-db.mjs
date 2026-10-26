import { readBusinessMaintenanceConfig } from '../apps/backend/dist/persistence/config.js';
import { runBusinessMaintenance } from './business-operations.mjs';

try {
  const action = process.argv[2];
  if (process.argv.length !== 3 || !['check', 'provision', 'migrate', 'plan'].includes(action)) throw new Error();
  const config = readBusinessMaintenanceConfig();
  console.log(JSON.stringify(await runBusinessMaintenance({ action, config, adminUrl: process.env.BUSINESS_ADMIN_DATABASE_URL })));
} catch {
  console.error('Business maintenance refused or failed; verify local configuration, privileges and migration history.');
  process.exitCode = 1;
}
