import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTicketMigrationConfig, assertTicketMigrationChecksum } from './tickets-local.mjs';

const localEnv = {
  APP_ENV: 'local',
  MARKETPLACE_MODE: 'mock',
  DATABASE_PROVIDER: 'local',
  DATABASE_URL: 'postgresql://owner:local-secret@postgres:5432/fasemarketplace',
  AUTH_ENABLED: 'true',
  AUTH_DATABASE_URL: 'postgresql://fm_auth_runtime:runtime-secret@postgres:5432/fasemarketplace',
  AUTH_ORIGIN: 'http://127.0.0.1:4173',
  AUTH_SECRET: 'a'.repeat(64),
  REDIS_URL: 'redis://redis:6379',
};

test('accepts only the explicit local application database or an isolated auth test database', () => {
  assert.equal(assertTicketMigrationConfig(localEnv).databaseName, 'fasemarketplace');
  const testDatabase = {
    ...localEnv,
    DATABASE_URL: 'postgresql://owner:local-secret@postgres:5432/fm_auth_test_0123456789abcdef',
    AUTH_DATABASE_URL: 'postgresql://fm_auth_runtime:runtime-secret@postgres:5432/fm_auth_test_0123456789abcdef',
  };
  assert.equal(assertTicketMigrationConfig(testDatabase).databaseName, 'fm_auth_test_0123456789abcdef');
});

test('rejects external, Neon, production, missing auth, and unrecognized database targets', () => {
  for (const change of [
    { APP_ENV: 'production' },
    { DATABASE_PROVIDER: 'neon' },
    { DATABASE_URL: 'postgresql://owner:secret@remote.example:5432/fasemarketplace' },
    { DATABASE_URL: 'postgresql://fm_auth_runtime:secret@postgres:5432/fasemarketplace' },
    { AUTH_ENABLED: 'false' },
    { DATABASE_URL: 'postgresql://owner:secret@postgres:5432/other_database' },
  ]) {
    assert.throws(() => assertTicketMigrationConfig({ ...localEnv, ...change }));
  }
});

test('allows an unapplied or matching migration checksum and rejects a changed migration', () => {
  assert.equal(assertTicketMigrationChecksum(undefined, 'a'.repeat(64)), true);
  assert.equal(assertTicketMigrationChecksum('a'.repeat(64), 'a'.repeat(64)), false);
  assert.throws(() => assertTicketMigrationChecksum('b'.repeat(64), 'a'.repeat(64)));
});
