import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {readPreviewMaintenanceConfig} from '../apps/backend/dist/access/maintenance-config.js';
import {validatePreviewBusinessTargets} from './business-preview-config.mjs';
try{
  const config=readPreviewMaintenanceConfig(),runtime=new URL(config.databaseUrl),migration=new URL(config.ownerUrl);
  runtime.username='fm_business_runtime';runtime.password=randomBytes(32).toString('base64url');
  migration.username='fm_business_migrator';migration.password=randomBytes(32).toString('base64url');
  const env={PREVIEW_BUSINESS_DATABASE_URL:runtime.href,PREVIEW_BUSINESS_MIGRATION_URL:migration.href};
  validatePreviewBusinessTargets(config,env);
  await writeFile('.env.preview-business',Object.entries(env).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{flag:'wx',mode:0o600});
  console.log('Private Preview business configuration created');
}catch{console.error('Preview business credentials were not created');process.exitCode=1;}
