import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTelemetryConfig, buildEvent, safeException, filterEvent, createReporter } from '../index.js';

const config = { mode: 'console', environment: 'local', release: 'development' };

test('collection is off unless explicitly selected; invalid configuration fails closed', () => {
  assert.equal(resolveTelemetryConfig({}).mode, 'off');
  assert.equal(resolveTelemetryConfig({ mode: 'posthog' }).mode, 'off');
  assert.equal(resolveTelemetryConfig({ mode: 'posthog', token: 'phc_example123', host: 'https://arbitrary.example' }).mode, 'off');
  assert.equal(resolveTelemetryConfig({ mode: 'console', environment: 'customer@example.com' }).mode, 'off');
  assert.equal(resolveTelemetryConfig({ mode: 'posthog', token: 'phx_admin_key', host: 'https://us.i.posthog.com' }).mode, 'off');
  assert.equal(resolveTelemetryConfig({ mode: 'posthog', token: 'phc_example123', host: 'https://eu.i.posthog.com' }).mode, 'posthog');
});

test('event contract drops unknown events and sensitive properties', () => {
  assert.equal(buildEvent('buyer email', { email: 'private@example.com' }, config, 'web'), null);
  const event = buildEvent('screen viewed', {
    screen: 'bootstrap', email: 'private@example.com', authorization: 'Bearer secret',
    url: 'https://local/callback?code=secret', order: { name: 'Private Buyer' },
  }, config, 'web');
  assert.deepEqual(event, { event: 'screen viewed', properties: {
    environment: 'local', service: 'web', release: 'development', schema_version: 1, screen: 'bootstrap',
  } });
  assert.equal(buildEvent('screen viewed', { screen: 'private@example.com' }, config, 'web'), null);
});

test('exception messages and absolute paths are not exported', () => {
  const original = new TypeError('Password=private-token; Buyer=private@example.com');
  original.stack = 'TypeError: Password=private-token\n at check (C:/Users/PrivatePerson/project/apps/web/src/App.tsx:42:7)';
  const safe = safeException(original, 'UNHANDLED_ERROR');
  assert.equal(safe.name, 'TypeError');
  assert.equal(safe.message, 'UNHANDLED_ERROR');
  assert.match(safe.stack, /App.tsx:42:7/);
  assert.doesNotMatch(safe.stack, /private|Password|Users|PrivatePerson/i);
});

test('SDK before_send discards URLs, user traits, arbitrary exception metadata and unknown events', () => {
  assert.equal(filterEvent({ event: '$identify', properties: { email: 'private@example.com' } }, config, 'web'), null);
  const filtered = filterEvent({ event: '$exception', properties: {
    distinct_id: 'anonymous_123456', code: 'UNHANDLED_ERROR',
    '$current_url': 'https://local/?token=secret', '$referrer': 'https://private.example',
    '$set': { email: 'private@example.com' }, token: 'unsafe-token',
    '$exception_list': [{ type: 'TypeError', value: 'private@example.com', stacktrace: { frames: [{ filename: 'C:/Users/PrivatePerson/App.tsx', lineno: 42, colno: 7, vars: { secret: 'private-token' } }] } }],
  } }, config, 'web');
  const text = JSON.stringify(filtered);
  assert.doesNotMatch(text, /private|secret|unsafe-token|current_url|referrer|vars|\$set/i);
  assert.match(text, /UNHANDLED_ERROR/);
});

test('non-finite timings are removed and oversized durations are bounded', () => {
  const event = buildEvent('api readiness checked', { status: 'ready', duration_ms: Infinity }, config, 'web');
  assert.equal(event.properties.duration_ms, undefined);
  assert.equal(buildEvent('api readiness checked', { status: 'ready', duration_ms: 90000 }, config, 'web').properties.duration_ms, 60000);
});

test('disabled telemetry never invokes transport; thrown and rejected failures are isolated', async () => {
  const sink = { capture: () => { throw new Error('transport unavailable'); }, exception: () => Promise.reject(new Error('transport unavailable')) };
  const off = createReporter({ ...config, mode: 'off' }, 'web', {
    capture: () => assert.fail('off transport invoked'), exception: () => assert.fail('off transport invoked'),
  });
  off.capture('screen viewed', { screen: 'bootstrap' });
  off.exception(new Error('private'), 'UNHANDLED_ERROR');
  const reporter = createReporter(config, 'web', sink);
  assert.doesNotThrow(() => reporter.capture('screen viewed', { screen: 'bootstrap' }));
  assert.doesNotThrow(() => reporter.exception(new Error('private'), 'UNHANDLED_ERROR'));
  await new Promise((resolve) => setImmediate(resolve));
});

test('error storms are deduplicated and event volume is bounded', () => {
  let count = 0;
  const reporter = createReporter(config, 'web', { capture: () => count++, exception: () => count++ });
  for (let i = 0; i < 1000; i++) reporter.exception(new Error('private'), 'UNHANDLED_ERROR');
  assert.equal(count, 1);
  const events = createReporter(config, 'web', { capture: () => count++, exception: () => count++ });
  for (let i = 0; i < 1000; i++) events.capture('screen viewed', { screen: 'bootstrap' });
  assert.equal(count, 121);
});

test('browser budget stays bounded across minute windows even when offline SDK retries do not report errors', () => {
  const originalNow = Date.now;
  let time = originalNow();
  Date.now = () => time;
  let count = 0;
  try {
    const reporter = createReporter(config, 'web', { capture: () => count++, exception: () => count++ });
    for (let minute = 0; minute < 20; minute++) {
      for (let event = 0; event < 100; event++) reporter.capture('screen viewed', { screen: 'bootstrap' });
      time += 60001;
    }
    assert.equal(count, 500);
  } finally { Date.now = originalNow; }
});
