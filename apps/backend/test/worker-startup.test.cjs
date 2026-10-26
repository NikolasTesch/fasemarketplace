const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('hybrid worker retries initial dependency races before switching to sparse checks', () => {
  const script = `
    require('reflect-metadata');
    const assert = require('node:assert/strict');
    const fs = require('node:fs/promises');
    fs.writeFile = async () => {};
    fs.rm = async () => {};
    require('node:module').syncBuiltinESMExports();
    const delays = [];
    global.setTimeout = (_, delay) => { delays.push(delay); return 0; };
    const { NestFactory } = require('@nestjs/core');
    NestFactory.createApplicationContext = async (module) => {
      const Worker = Reflect.getMetadata('providers', module).find(p => p.name === 'WorkerHeartbeat');
      let state = 'unavailable';
      const worker = new Worker({ readiness: async () => ({ status: state }) }, { exception() {} });
      await worker.onModuleInit();
      state = 'ready';
      await worker.onModuleInit();
      state = 'unavailable';
      await worker.onModuleInit();
      await worker.onModuleInit();
      await worker.onModuleInit();
      assert.deepEqual(delays, [5000, 600000, 5000, 5000, 600000]);
      return { enableShutdownHooks() {} };
    };
    require('./dist/worker.js');
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, APP_ENV: 'local', MARKETPLACE_MODE: 'mock',
      DATABASE_PROVIDER: 'neon', NEON_BRANCH: 'development', TELEMETRY_MODE: 'off',
      NEON_DEVELOPMENT_HOST: 'ep-synthetic-123-pooler.sa-east-1.aws.neon.tech',
      DATABASE_URL: 'postgresql://dev:example@ep-synthetic-123-pooler.sa-east-1.aws.neon.tech/test?sslmode=verify-full',
      REDIS_URL: 'redis://redis:6379' },
    // This deadline bounds process startup, not the worker's scheduling delays.
    // Concurrent suite imports can exceed 10s on a busy Docker Desktop host.
    encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.error, undefined, result.error?.code);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
