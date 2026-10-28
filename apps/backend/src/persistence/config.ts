import { readAccessConfig } from '../access/config.js';
const refused = () => new Error('Business persistence requires separate credentials and an explicit Docker-local or Preview target');

function connection(value: string | undefined, database: string, role: string) {
  const url = new URL(value ?? '');
  if (url.protocol !== 'postgresql:' || url.hostname !== 'postgres' || (url.port && url.port !== '5432') ||
      url.pathname !== '/' + database || url.username !== role || !url.password || url.hash ||
      url.search !== '?schema=business') throw refused();
  return url;
}

export function readBusinessConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.BUSINESS_ENABLED || env.BUSINESS_ENABLED === 'false') return null;
  try {
    if (env.AUTH_CONTEXT === 'preview') {
      const access = readAccessConfig(env);
      const url = new URL(env.BUSINESS_DATABASE_URL ?? '');
      const auth = new URL(access?.databaseUrl ?? '');
      if (env.BUSINESS_ENABLED !== 'true' || access?.context !== 'preview' || url.protocol !== 'postgresql:' ||
          url.hostname !== 'ep-soft-bird-b61xykn1-pooler.c-2.sa-east-1.aws.neon.tech' ||
          url.hostname !== auth.hostname || url.pathname !== '/neondb' || url.pathname !== auth.pathname || url.username !== 'fm_business_runtime' ||
          !url.password || url.password === auth.password || (url.port && url.port !== '5432') || url.hash ||
          url.searchParams.toString() !== 'sslmode=verify-full') throw refused();
      return { database: url.pathname.slice(1), runtimeUrl: url.href };
    }
    const database = env.BUSINESS_LOCAL_DATABASE ?? '';
    if (env.BUSINESS_ENABLED !== 'true' || env.APP_ENV !== 'local' ||
        (env.DATABASE_PROVIDER && env.DATABASE_PROVIDER !== 'local') ||
        !/^(fasemarketplace|fm_business_test_[a-z0-9_]{1,64}|fm_auth_test_business_[a-z0-9_]{1,48})$/.test(database)) throw refused();
    const runtime = connection(env.BUSINESS_DATABASE_URL, database, 'fm_business_runtime');
    return { database, runtimeUrl: runtime.href };
  } catch { throw refused(); }
}

export function readBusinessMaintenanceConfig(env: NodeJS.ProcessEnv = process.env) {
  try {
    const runtime = readBusinessConfig(env);
    if (!runtime) throw refused();
    const migration = connection(env.BUSINESS_MIGRATION_DATABASE_URL, runtime.database, 'fm_business_migrator');
    const shadowDatabase = new URL(env.BUSINESS_SHADOW_DATABASE_URL ?? '').pathname.slice(1);
    if (!/^fm_business_shadow_[a-z0-9_]{1,64}$/.test(shadowDatabase) || shadowDatabase === runtime.database) throw refused();
    const shadow = connection(env.BUSINESS_SHADOW_DATABASE_URL, shadowDatabase, 'fm_business_migrator');
    if (decodeURIComponent(migration.password) === decodeURIComponent(new URL(runtime.runtimeUrl).password) ||
        decodeURIComponent(shadow.password) !== decodeURIComponent(migration.password)) throw refused();
    return { ...runtime, migrationUrl: migration.href, shadowUrl: shadow.href, shadowDatabase };
  } catch { throw refused(); }
}
