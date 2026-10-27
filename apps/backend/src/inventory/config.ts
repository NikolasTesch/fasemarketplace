import {readCatalogConfig} from '../catalog/config.js';

export function readInventoryConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.INVENTORY_ENABLED || env.INVENTORY_ENABLED === 'false') return false;
  if (env.INVENTORY_ENABLED !== 'true' || !readCatalogConfig(env))
    throw new Error('Inventory requires local catalog, auth and business opt-in');
  return true;
}
