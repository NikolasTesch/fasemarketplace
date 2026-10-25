import { readLocalConfig } from '../local-config.js';

// CLI maintenance remains local-only even when the runtime learns Preview.
export function readLocalAccessOperationConfig(env: NodeJS.ProcessEnv = process.env) {
  const config = readAccessConfig(env);
  if (!config || config.context !== 'local') throw new Error('Auth maintenance requires explicit Docker-local configuration');
  return config;
}

export function readAccessConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.AUTH_ENABLED === undefined || env.AUTH_ENABLED === 'false')
    return undefined;
  try {
    const context = env.AUTH_CONTEXT ?? 'local';
    if (env.AUTH_ENABLED !== 'true' || env.APP_ENV !== 'local' || (context !== 'local' && context !== 'preview'))
      throw new Error();
    const origin = new URL(env.AUTH_ORIGIN ?? '');
    if (
      origin.origin !== env.AUTH_ORIGIN ||
      (context === 'local' ? (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || !origin.port)
        : origin.origin !== 'https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app')
    )
      throw new Error();
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(env.AUTH_SECRET ?? ''))
      throw new Error();
    const cookiePrefix = env.AUTH_COOKIE_PREFIX ?? 'fm_local_access';
    if (!/^[a-z][a-z0-9_]{7,59}$/.test(cookiePrefix)) throw new Error();
    const database = new URL(env.AUTH_DATABASE_URL ?? '');
    const main = new URL(env.DATABASE_URL ?? '');
    if (context === 'preview') {
      const infrastructure = readLocalConfig(env);
      if (infrastructure.databaseProvider !== 'neon' || env.NEON_BRANCH !== 'development' ||
          database.hostname !== main.hostname || database.username !== 'fm_auth_preview_runtime' ||
          main.username !== 'fm_auth_preview_runtime' || env.DATABASE_URL !== env.AUTH_DATABASE_URL ||
          database.searchParams.toString() !== 'sslmode=verify-full' || cookiePrefix !== 'fm_preview_access' ||
          !/^[A-Za-z0-9_-]{43,128}$/.test(env.AUTH_API_KEY ?? '') || env.AUTH_API_KEY === env.AUTH_SECRET) throw new Error();
    } else if ((env.DATABASE_PROVIDER ?? 'local') !== 'local' || database.hostname !== 'postgres' ||
        database.username !== 'fm_auth_runtime' || database.search || main.hostname !== 'postgres' || env.AUTH_API_KEY) throw new Error();
    if (
      database.protocol !== 'postgresql:' ||
      (database.port && database.port !== '5432') ||
      !database.password ||
      database.pathname !== main.pathname ||
      database.hash ||
      env.REDIS_URL !== 'redis://redis:6379'
    )
      throw new Error();
    return {
      context,
      apiKey: context === 'preview' ? env.AUTH_API_KEY : undefined,
      connectionTimeoutMs: context === 'preview' ? 10000 : 2000,
      origin: origin.origin,
      secret: env.AUTH_SECRET!,
      databaseUrl: env.AUTH_DATABASE_URL!,
      redisUrl: env.REDIS_URL,
      cookiePrefix,
    };
  } catch {
    throw new Error(
      'Auth requires explicit local or Preview development configuration with isolated credentials and verified targets',
    );
  }
}
