import process from 'node:process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('ticket module configuration is local-only, including when Preview auth is valid', async () => {
  const { readLocalTicketsConfig } = await import('../dist/access/config.js');
  const base = {APP_ENV:'local',MARKETPLACE_MODE:'mock',AUTH_ENABLED:'true',AUTH_SECRET:'s'.repeat(64),REDIS_URL:'redis://redis:6379'};
  const local = {...base,AUTH_CONTEXT:'local',AUTH_ORIGIN:'http://127.0.0.1:4173',DATABASE_PROVIDER:'local',DATABASE_URL:'postgresql://local:pass@postgres:5432/fasemarketplace',AUTH_DATABASE_URL:'postgresql://fm_auth_runtime:pass@postgres:5432/fasemarketplace'};
  assert.equal(readLocalTicketsConfig(local)?.context,'local');
  const host='ep-synthetic-123-pooler.sa-east-1.aws.neon.tech';
  const url=`postgresql://fm_auth_preview_runtime:pass@${host}/fasemarketplace?sslmode=verify-full`;
  const preview={...base,AUTH_CONTEXT:'preview',AUTH_ORIGIN:'https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app',AUTH_COOKIE_PREFIX:'fm_preview_access',AUTH_API_KEY:'k'.repeat(64),DATABASE_PROVIDER:'neon',NEON_BRANCH:'development',NEON_DEVELOPMENT_HOST:host,DATABASE_URL:url,AUTH_DATABASE_URL:url};
  assert.equal(readLocalTicketsConfig(preview),undefined);
});

process.env.APP_ENV = 'local';
process.env.MARKETPLACE_MODE = 'mock';
process.env.DATABASE_URL = 'postgresql://local:local@postgres:5432/fasemarketplace';
process.env.REDIS_URL = 'redis://redis:6379';
process.env.AUTH_ENABLED = 'false';
process.env.AUTH_SECRET = '';
process.env.AUTH_DATABASE_URL = '';

test('ticket routes are not mounted when local authentication is disabled', async () => {
  const [{ NestFactory }, { AppModule }] = await Promise.all([
    import('@nestjs/core'),
    import('../dist/app.module.js'),
  ]);
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.listen(0, '127.0.0.1');
    const root = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    assert.equal((await globalThis.fetch(`${root}/tickets`)).status, 404);
    assert.equal((await globalThis.fetch(`${root}/tickets`, { method: 'POST' })).status, 404);
    assert.equal((await globalThis.fetch(`${root}/tickets/00000000-0000-0000-0000-000000000000/image`)).status, 404);
  } finally {
    await app.close();
  }
});
