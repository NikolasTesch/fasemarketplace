require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { HealthController } = require('../dist/health.controller.js');
const { Infrastructure } = require('../dist/infrastructure.js');

test('HTTP readiness returns 503 on dependency failure while liveness remains available', async () => {
  let available = true;
  class TestModule {}
  Module({
    controllers: [HealthController],
    providers: [{ provide: Infrastructure, useValue: {
      readiness: async () => ({
        status: available ? 'ready' : 'unavailable',
        dependencies: { postgres: true, redis: available },
        marketplaceMode: 'mock',
      }),
    } }],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    assert.equal((await fetch(`${url}/health/ready`)).status, 200);
    available = false;
    const response = await fetch(`${url}/health/ready`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).dependencies.redis, false);
    assert.equal((await fetch(`${url}/health/live`)).status, 200);
    available = true;
    assert.equal((await fetch(`${url}/health/ready`)).status, 200);
  } finally {
    await app.close();
  }
});
