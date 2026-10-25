const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
test('backup envelope authenticates before returning any plaintext', async () => {
  const { sealBackup, openBackup, readBackupKey } = await import('../../../scripts/auth-backup-format.mjs');
  const key = randomBytes(32).toString('hex');
  const payload = { version: 1, source: 'synthetic-private', dump: 'synthetic-password' };
  const sealed = sealBackup(payload, readBackupKey({ ACCESS_BACKUP_KEY: key }));
  assert.deepEqual(openBackup(sealed, readBackupKey({ ACCESS_BACKUP_KEY: key })), payload);
  assert.equal(sealed.includes(Buffer.from('synthetic-private')), false);
  assert.notDeepEqual(sealed, sealBackup(payload, Buffer.from(key, 'hex')));
  for (const index of [0, 8, 21, sealed.length - 1]) {
    const altered = Buffer.from(sealed); altered[index] ^= 1;
    assert.throws(() => openBackup(altered, Buffer.from(key, 'hex')));
  }
  assert.throws(() => openBackup(sealed.subarray(0, 25), Buffer.from(key, 'hex')));
  assert.throws(() => openBackup(Buffer.alloc(64 * 1024 * 1024 + 1), Buffer.from(key, 'hex')));
  assert.throws(() => openBackup(sealed, randomBytes(32)));
  for (const value of ['', 'weak', 'a'.repeat(63)]) assert.throws(() => readBackupKey({ ACCESS_BACKUP_KEY: value }));
  assert.throws(() => readBackupKey({ ACCESS_BACKUP_KEY: key, AUTH_SECRET: key.toUpperCase() }));
  assert.throws(() => readBackupKey({ ACCESS_BACKUP_KEY: key, DATABASE_URL: `postgresql://owner:${key}@postgres/fm_auth_test_backup` }));
  assert.throws(() => sealBackup({ large: 'x'.repeat(65 * 1024 * 1024) }, Buffer.from(key, 'hex')));
});

test('backup CLI rejects Production before any client invocation and hides credentials', () => {
  const secret = randomBytes(32).toString('hex');
  const result = spawnSync(process.execPath, [resolve(__dirname, '../../../scripts/auth-backup.mjs'), 'preview', '/tmp/refused.fmbackup'], {
    env: { ...process.env, ACCESS_BACKUP_KEY: secret, APP_ENV: 'production' }, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Backup\/restore refused or failed/);
  assert.ok(!result.stderr.includes(secret));
  assert.equal(result.stdout, '');
});

test('restore base refuses Neon, Production, existing non-fixture and connection overrides', async () => {
  const { validateRestoreBase } = await import('../../../scripts/auth-backup-operations.mjs');
  assert.equal(validateRestoreBase('postgresql://owner:synthetic@postgres/fm_auth_test_backup').hostname, 'postgres');
  for (const value of ['postgresql://owner:synthetic@remote.example/fm_auth_test_backup',
    'postgresql://owner:synthetic@postgres/fasemarketplace', 'postgresql://owner:synthetic@postgres/fm_auth_restore_old',
    'postgresql://owner:synthetic@postgres/fm_auth_test_backup?host=remote.example', 'postgresql://owner@postgres/fm_auth_test_backup'])
    assert.throws(() => validateRestoreBase(value));
});

test('backup/restore requires equal supported source, server and client majors', async () => {
  const { assertMatchingPostgresMajors } = await import('../../../scripts/auth-backup-operations.mjs');
  for (const major of [17, 18]) assert.doesNotThrow(() => assertMatchingPostgresMajors(major, major, major));
  for (const versions of [[18,17,18], [18,18,17], [17,18,18], [17,17,18], [19,19,19], [18,18,NaN], ['18',18,18]])
    assert.throws(() => assertMatchingPostgresMajors(...versions), /major/);
});
