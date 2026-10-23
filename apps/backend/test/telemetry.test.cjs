const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PostHog } = require('posthog-node');
const { gunzipSync } = require('node:zlib');
const { TelemetryService } = require('../dist/telemetry.js');

const enabled = {
  APP_ENV: 'local', TELEMETRY_MODE: 'posthog', TELEMETRY_ENVIRONMENT: 'local',
  POSTHOG_PROJECT_TOKEN: 'phc_local_test123456', POSTHOG_HOST: 'https://us.i.posthog.com',
};

test('disabled, invalid or production-labelled local telemetry never initializes a client', async () => {
  for (const env of [{}, { ...enabled, POSTHOG_HOST: 'https://arbitrary.example' },
    { ...enabled, TELEMETRY_ENVIRONMENT: 'production' }]) {
    const telemetry = new TelemetryService('api', env, () => assert.fail('Unexpected client'));
    telemetry.exception(new Error('secret'), 'HTTP_UNEXPECTED_ERROR');
    await telemetry.onModuleDestroy();
  }
});

test('Node SDK sends only sanitized exceptions to an intercepted transport', async () => {
  const requests = [];
  const telemetry = new TelemetryService('api', enabled, (token, options) => new PostHog(token, {
    ...options, flushAt: 1, flushInterval: 0,
    fetch: async (url, options) => {
      const buffer = Buffer.from(options.body);
      const text = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer).toString() : buffer.toString();
      requests.push({ url, body: JSON.parse(text) });
      return { status: 200, text: async () => '', json: async () => ({ status: 1 }) };
    },
  }));
  const raw = new TypeError('buyer=private@example.com password=private-secret');
  raw.stack = 'TypeError: buyer=private@example.com\n at handler (C:/Users/PrivateName/apps/backend/src/main.ts:22:5)';
  telemetry.exception(raw, 'HTTP_UNEXPECTED_ERROR');
  await telemetry.onModuleDestroy();
  assert.ok(requests.length > 0, 'Exception must reach the SDK transport');
  assert.ok(requests.every((request) => request.url.startsWith(enabled.POSTHOG_HOST)));
  const text = JSON.stringify(requests);
  assert.match(text, /\$exception/);
  assert.match(text, /HTTP_UNEXPECTED_ERROR/);
  assert.doesNotMatch(text, /private@example|private-secret|PrivateName|Users\//);
});

test('initialization, capture and async transport failures cannot escape into application code', async () => {
  const brokenInit = new TelemetryService('api', enabled, () => { throw new Error('transport'); });
  assert.doesNotThrow(() => brokenInit.exception(new Error('secret'), 'HTTP_UNEXPECTED_ERROR'));
  await brokenInit.onModuleDestroy();
  const broken = new TelemetryService('api', enabled, () => ({
    on: () => {}, capture: () => { throw new Error('transport'); },
    captureException: () => { throw new Error('transport'); },
    shutdown: async () => { throw new Error('transport'); },
  }));
  assert.doesNotThrow(() => broken.exception(new Error('secret'), 'HTTP_UNEXPECTED_ERROR'));
  await broken.onModuleDestroy();
});
