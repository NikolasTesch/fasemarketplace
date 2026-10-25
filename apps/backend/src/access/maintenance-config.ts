import { readAccessConfig } from './config.js';

// Dedicated maintenance entrypoint; never imported by API/worker startup.
export function readPreviewMaintenanceConfig(env: NodeJS.ProcessEnv = process.env) {
  try {
    const config = readAccessConfig(env);
    if (!config || config.context !== 'preview') throw new Error();
    const runtime = new URL(config.databaseUrl);
    const owner = new URL(env.PREVIEW_AUTH_OWNER_DATABASE_URL ?? '');
    if (owner.protocol !== 'postgresql:' || owner.hostname !== runtime.hostname.replace('-pooler.', '.') ||
        (owner.port && owner.port !== '5432') || owner.pathname !== runtime.pathname ||
        !/^[a-z_][a-z0-9_]*$/.test(owner.username) || owner.username === runtime.username ||
        !owner.password || decodeURIComponent(owner.password) === decodeURIComponent(runtime.password) ||
        owner.hash || owner.searchParams.toString() !== 'sslmode=verify-full') throw new Error();
    return { ...config, ownerUrl: env.PREVIEW_AUTH_OWNER_DATABASE_URL! };
  } catch {
    throw new Error('Preview maintenance requires verified development runtime and separate direct owner connection');
  }
}
