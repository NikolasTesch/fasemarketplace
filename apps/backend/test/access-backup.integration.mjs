import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { setInterval, clearInterval } from 'node:timers';
import { readLocalAccessOperationConfig } from '../dist/access/config.js';
import { runPreviewMaintenance } from '../../../scripts/auth-preview-operations.mjs';
import { createAccessAuth } from '../dist/access/auth.js';
import { createAccessBackup, restoreAccessBackup, validateRestoreBase } from '../../../scripts/auth-backup-operations.mjs';
import { readBackupKey, sealBackup, openBackup } from '../../../scripts/auth-backup-format.mjs';

test('real encrypted backup and isolated restore with content verification, never Neon', async (t) => {
  const local = readLocalAccessOperationConfig();
  const base = validateRestoreBase(process.env.DATABASE_URL);
  const setup = new Pool({ connectionString: base.href });
  const database = 'fm_auth_test_backup_' + randomBytes(8).toString('hex');
  await setup.query(`CREATE DATABASE ${database}`);
  base.pathname = '/' + database;
  const ownerPool = new Pool({ connectionString: base.href, max: 1 });
  const runtime = new URL(base);
  runtime.username = 'fm_auth_preview_runtime';
  runtime.password = 'Synthetic-Preview-Maintenance-2026!';
  const runtimePool = new Pool({ connectionString: runtime.href, max: 4 });
  const config = { ...local, databaseUrl: runtime.href };
  const directory = resolve(process.env.ACCESS_BACKUP_TEST_DIRECTORY ?? '/tmp/fm-backup-test');
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, database + '.fmbackup');
  const key = readBackupKey();
  let restoredPool;
  try {
    await runPreviewMaintenance({ action: 'migrate', ownerPool, runtimePool, config });
    const auth = createAccessAuth(runtimePool, config);
    const password = 'Synthetic-Backup-Admin-2026!';
    const admin = await auth.api.createUser({ body: { name: 'Backup Admin', email: 'backup@example.test', password, role: 'admin', data: { mustChangePassword: true } } });
    await auth.api.createUser({ body: { name: 'Blocked Operator', email: 'blocked@example.test', password, role: 'user' } });
    await runtimePool.query("UPDATE auth_user SET banned=true,\"banReason\"='synthetic backup block' WHERE email='blocked@example.test'");
    await auth.api.signInEmail({ body: { email: 'backup@example.test', password } });
    await runtimePool.query('INSERT INTO auth_verification(id,identifier,value,"expiresAt","createdAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now(),now())', ['backup-verification', 'synthetic-token', admin.user.id]);
    await ownerPool.query('CREATE TABLE public.backup_probe(id integer PRIMARY KEY,revision integer NOT NULL)');
    await ownerPool.query('INSERT INTO public.backup_probe VALUES(1,0)');
    const before = (await ownerPool.query('SELECT id,email,role,banned,"banReason","mustChangePassword" FROM auth_user ORDER BY id')).rows;
    const accountBefore = (await ownerPool.query('SELECT id,password FROM auth_account ORDER BY id')).rows;
    let artifact;
    await t.test('dump/metadata encrypted; consistent backup never overwrites artifact', async () => {
      // Writes continue while snapshot fingerprints and pg_dump are collected.
      const writes = [];
      const timer = setInterval(() => { writes.push(ownerPool.query('UPDATE public.backup_probe SET revision=revision+1')); }, 5);
      try {
        artifact = await createAccessBackup({ sourceUrl: base.href, context: 'local-test', file, key });
      } finally { clearInterval(timer); await Promise.all(writes); }
      assert.ok(writes.length > 0);
      assert.equal(artifact.tables, 6);
      const encrypted = await readFile(file);
      assert.equal(encrypted.includes(Buffer.from('backup@example.test')), false);
      assert.equal(encrypted.includes(Buffer.from('PGDMP')), false);
      assert.equal(createHash('sha256').update(encrypted).digest('hex'), artifact.sha256);
      await assert.rejects(createAccessBackup({ sourceUrl: base.href, context: 'local-test', file, key }), error => error.code === 'EEXIST');
      assert.deepEqual(await readFile(file), encrypted);
    });
    await t.test('tamper and wrong key refuse before creating any destination', async () => {
      const count = async () => (await setup.query("SELECT count(*) FROM pg_database WHERE datname LIKE 'fm_auth_restore_%'")).rows[0].count;
      const oldCount = await count();
      await assert.rejects(restoreAccessBackup({ baseUrl: process.env.DATABASE_URL, file, key: randomBytes(32) }));
      const altered = await readFile(file); altered[altered.length - 1] ^= 1;
      const corrupted = file.replace('.fmbackup', '-corrupt.fmbackup');
      await writeFile(corrupted, altered, { flag: 'wx', mode: 0o600 });
      await assert.rejects(restoreAccessBackup({ baseUrl: process.env.DATABASE_URL, file: corrupted, key }));
      const unknown = file.replace('.fmbackup', '-unknown.fmbackup');
      await writeFile(unknown, sealBackup({ version: 99 }, key), { flag: 'wx', mode: 0o600 });
      await assert.rejects(restoreAccessBackup({ baseUrl: process.env.DATABASE_URL, file: unknown, key }));
      assert.equal(await count(), oldCount);
    });
    await t.test('cross-major metadata refuses restore before creating a destination', async () => {
      const count = async () => (await setup.query("SELECT count(*) FROM pg_database WHERE datname LIKE 'fm_auth_restore_%'")).rows[0].count;
      const before = await count();
      const payload = openBackup(await readFile(file), key);
      payload.source.serverMajor = payload.source.serverMajor === 17 ? 18 : 17;
      const crossed = file.replace('.fmbackup', '-cross-major.fmbackup');
      await writeFile(crossed, sealBackup(payload, key), { flag: 'wx', mode: 0o600 });
      await assert.rejects(restoreAccessBackup({ baseUrl: process.env.DATABASE_URL, file: crossed, key }), /major/);
      assert.equal(await count(), before);
    });
    await t.test('restore matches identities/password hashes then revokes sessions and reset tokens', async () => {
      const result = await restoreAccessBackup({ baseUrl: process.env.DATABASE_URL, file, key });
      assert.match(result.database, /^fm_auth_restore_[a-f0-9]{24}$/);
      assert.equal(result.contentVerified, true);
      const restoredUrl = new URL(base); restoredUrl.pathname = '/' + result.database;
      restoredPool = new Pool({ connectionString: restoredUrl.href });
      assert.deepEqual((await restoredPool.query('SELECT id,email,role,banned,"banReason","mustChangePassword" FROM auth_user ORDER BY id')).rows, before);
      assert.deepEqual((await restoredPool.query('SELECT id,password FROM auth_account ORDER BY id')).rows, accountBefore);
      assert.equal((await restoredPool.query('SELECT count(*) FROM auth_session')).rows[0].count, '0');
      assert.equal((await restoredPool.query('SELECT count(*) FROM auth_verification')).rows[0].count, '0');
      // Source remains unchanged; quarantine cleanup applies only to restored DB.
      assert.equal((await ownerPool.query('SELECT count(*) FROM auth_session')).rows[0].count, '1');
      assert.equal((await ownerPool.query('SELECT count(*) FROM auth_verification')).rows[0].count, '1');
    });
    await t.test('empty pre-auth database can be backed up and restored', async () => {
      const emptyName = 'fm_auth_test_empty_' + randomBytes(8).toString('hex');
      await setup.query(`CREATE DATABASE ${emptyName}`);
      const emptyUrl = new URL(base); emptyUrl.pathname = '/' + emptyName;
      const emptyFile = resolve(directory, emptyName + '.fmbackup');
      await createAccessBackup({ sourceUrl: emptyUrl.href, context: 'local-test', file: emptyFile, key });
      const result = await restoreAccessBackup({ baseUrl: process.env.DATABASE_URL, file: emptyFile, key });
      assert.equal(result.tables, 0);
      assert.equal(result.contentVerified, true);
    });
    await t.test('unsupported relation refuses backup rather than silently omitting state', async () => {
      await ownerPool.query('CREATE SEQUENCE public.unsupported_counter');
      await assert.rejects(createAccessBackup({ sourceUrl: base.href, context: 'local-test', file: file.replace('.fmbackup', '-unsupported.fmbackup'), key }), /unsupported relations/);
    });
    console.log(JSON.stringify({ backupRehearsal: 'local-only', source: database, encryptedBytes: artifact.bytes }));
  } finally {
    await Promise.allSettled([setup.end(), ownerPool.end(), runtimePool.end(), restoredPool?.end()]);
    // Synthetic databases and encrypted artifacts are retained; key is never logged.
  }
});
