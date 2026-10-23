export function readBrowserOrigins(env: NodeJS.ProcessEnv = process.env) {
  if (!env.WEB_ALLOWED_ORIGINS?.trim()) return [];
  return env.WEB_ALLOWED_ORIGINS.split(',').map((value) => {
    const origin = value.trim();
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error('invalid');
      return origin;
    } catch {
      throw new Error('WEB_ALLOWED_ORIGINS must contain exact HTTPS origins, separated by commas');
    }
  });
}

export function readLocalConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.APP_ENV === 'production';
  const productionHost = 'ep-round-cell-b66do3rp-pooler.c-2.sa-east-1.aws.neon.tech';
  if ((!production && env.APP_ENV !== 'local') || env.MARKETPLACE_MODE !== 'mock') {
    throw new Error('Bootstrap requires an explicit environment and MARKETPLACE_MODE=mock');
  }

  function localUrl(key: string, protocol: string, host: string, port: string) {
    const value = env[key];
    try {
      const parsed = new URL(value ?? '');
      if (parsed.protocol !== protocol || parsed.hostname !== host ||
          (parsed.port && parsed.port !== port) || parsed.search || parsed.hash) {
        throw new Error('invalid');
      }
    } catch {
      throw new Error(`${key} must point only to the local Docker service ${host}:${port}`);
    }
    return value!;
  }

  const provider = env.DATABASE_PROVIDER ?? 'local';
  if (production && provider !== 'neon') throw new Error('Production requires the approved Neon endpoint');
  let databaseUrl: string;
  if (provider === 'local') {
    databaseUrl = localUrl('DATABASE_URL', 'postgresql:', 'postgres', '5432');
  } else if (provider === 'neon') {
    try {
      const url = new URL(env.DATABASE_URL ?? '');
      const host = (production ? env.NEON_PRODUCTION_HOST : env.NEON_DEVELOPMENT_HOST) ?? '';
      if (env.NEON_BRANCH !== (production ? 'production' : 'development') ||
          (production ? host !== productionHost : host === productionHost) ||
          !/^ep-[a-z0-9-]+-pooler\.(?:c-[0-9]+\.)?[a-z0-9-]+\.(aws|azure)\.neon\.tech$/.test(host) ||
          url.protocol !== 'postgresql:' || url.hostname !== host ||
          (url.port && url.port !== '5432') || !url.username || !url.password ||
          !/^\/[^/]+$/.test(url.pathname) || url.hash ||
          (production && (url.username !== 'fasemarketplace_production_app' || url.pathname !== '/neondb')) ||
          url.searchParams.toString() !== 'sslmode=verify-full') throw new Error('invalid');
      databaseUrl = env.DATABASE_URL!;
    } catch {
      throw new Error('Neon requires the confirmed pooled endpoint for this environment and sslmode=verify-full');
    }
  } else {
    throw new Error('DATABASE_PROVIDER must be local or neon');
  }

  return {
    databaseUrl,
    databaseProvider: provider,
    workerCheckIntervalMs: provider === 'neon' ? 600000 : 5000,
    connectionTimeoutMs: provider === 'neon' ? 10000 : 2000,
    redisUrl: localUrl('REDIS_URL', 'redis:', 'redis', '6379'),
  };
}
