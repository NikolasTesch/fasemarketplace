import {readPreviewMaintenanceConfig} from '../apps/backend/dist/access/maintenance-config.js';
import {validatePreviewBusinessTargets} from './business-preview-config.mjs';
import {provisionPreviewBusiness,migratePreviewBusiness} from './business-preview-operations.mjs';
try{
  const action=process.argv[2];if(process.argv.length!==3||!['provision','check','migrate'].includes(action))throw new Error();
  const config=validatePreviewBusinessTargets(readPreviewMaintenanceConfig(),process.env);
  console.log(JSON.stringify(action==='provision'?await provisionPreviewBusiness(config):await migratePreviewBusiness(config,action==='migrate')));
}catch{console.error('Preview business operation refused or failed; inspect target, privileges and migration history');process.exitCode=1;}
