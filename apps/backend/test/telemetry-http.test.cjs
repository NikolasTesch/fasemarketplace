require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller, Get, Module, HttpException } = require('@nestjs/common');
const { HttpAdapterHost, NestFactory } = require('@nestjs/core');
const { TelemetryExceptionFilter } = require('../dist/api-exception-filter.js');

test('exception reporting preserves HTTP behavior and excludes expected failures and health polling', async () => {
  class Routes {
    crash() { throw new Error('private data'); }
    conflict() { throw new HttpException('Conflict', 409); }
    ready() { throw new HttpException('Not ready', 503); }
  }
  Controller()(Routes);
  for (const [name, path] of [['crash', 'crash'], ['conflict', 'conflict'], ['ready', 'health/ready']]) {
    Get(path)(Routes.prototype, name, Object.getOwnPropertyDescriptor(Routes.prototype, name));
  }
  class TestModule {}
  Module({ controllers: [Routes] })(TestModule);
  const reported = [];
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalFilters(new TelemetryExceptionFilter(app.get(HttpAdapterHost), {
    exception: (_error, code) => reported.push(code),
  }));
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    const crash = await fetch(`${url}/crash`);
    assert.equal(crash.status, 500);
    assert.equal((await crash.json()).message, 'Internal server error');
    assert.equal((await fetch(`${url}/conflict`)).status, 409);
    assert.equal((await fetch(`${url}/health/ready`)).status, 503);
    assert.deepEqual(reported, ['HTTP_UNEXPECTED_ERROR']);
  } finally { await app.close(); }
});
