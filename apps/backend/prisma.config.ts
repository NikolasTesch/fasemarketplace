import { defineConfig } from 'prisma/config';
import { readBusinessMaintenanceConfig } from './src/persistence/config.js';

const config = readBusinessMaintenanceConfig();
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: config.migrationUrl, shadowDatabaseUrl: config.shadowUrl },
});
