import {readAccessConfig} from '../access/config.js';
import {readBusinessConfig} from '../persistence/config.js';

export function readCatalogConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.CATALOG_ENABLED || env.CATALOG_ENABLED === 'false') return false;
  try {
    const access = readAccessConfig(env), business = readBusinessConfig(env);
    if (env.CATALOG_ENABLED !== 'true' || !access || access.context !== 'local' || !business ||
        new URL(access.databaseUrl).pathname !== '/' + business.database) throw new Error();
    return true;
  } catch { throw new Error('Catalog requires local auth and business on the same Docker database'); }
}
