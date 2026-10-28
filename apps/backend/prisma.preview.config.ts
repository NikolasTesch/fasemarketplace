import {defineConfig} from 'prisma/config';
import {readPreviewMaintenanceConfig} from './src/access/maintenance-config.js';
import {validatePreviewBusinessTargets} from '../../scripts/business-preview-config.mjs';
const config=validatePreviewBusinessTargets(readPreviewMaintenanceConfig(),process.env);
const migration=new URL(config.migrationUrl);migration.searchParams.set('schema','business');
export default defineConfig({schema:'prisma/schema.prisma',migrations:{path:'prisma/migrations'},datasource:{url:migration.href}});
