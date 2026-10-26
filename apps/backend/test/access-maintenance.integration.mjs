import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { readLocalAccessOperationConfig } from '../dist/access/config.js';
import { createAccessAuth } from '../dist/access/auth.js';
import { LocalAccessService } from '../dist/access/service.js';
import { runPreviewMaintenance } from '../../../scripts/auth-preview-operations.mjs';

test('Preview maintenance on a new disposable Docker database, never Neon', async (t) => {
  const local = readLocalAccessOperationConfig();
  const ownerUrl = new URL(process.env.DATABASE_URL);
  assert.equal(ownerUrl.hostname, 'postgres');
  assert.match(ownerUrl.pathname, /^\/fm_auth_test_[a-z0-9_]+$/);
  const database = `fm_auth_test_maintenance_${randomBytes(8).toString('hex')}`;
  const setup = new Pool({ connectionString: ownerUrl.href });
  await setup.query(`CREATE DATABASE ${database}`);
  ownerUrl.pathname = '/' + database;
  const runtimeUrl = new URL(ownerUrl);
  runtimeUrl.username = 'fm_auth_preview_runtime';
  runtimeUrl.password = 'Synthetic-Preview-Maintenance-2026!';
  const ownerPool = new Pool({ connectionString: ownerUrl.href, max: 1 });
  const runtimePool = new Pool({ connectionString: runtimeUrl.href, max: 4 });
  const config = { ...local, context: 'preview', databaseUrl: runtimeUrl.href, cookiePrefix: 'fm_preview_access', origin: 'https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app' };
  const run = (action, input) => runPreviewMaintenance({ action, input, ownerPool, runtimePool, config });
  const input = { name: 'Synthetic Admin', email: 'maintenance@example.test', password: 'Synthetic-Initial-2026!' };
  try {
    await t.test('migration is repeatable; runtime can use auth but cannot create/truncate/read migration', async () => {
      assert.equal((await run('migrate')).alreadyApplied, false);
      assert.equal((await run('migrate')).alreadyApplied, true);
      for (const sql of ['CREATE TABLE public.forbidden(id text)', 'TRUNCATE public.auth_user', 'SELECT * FROM public.auth_migration'])
        await assert.rejects(runtimePool.query(sql), (error) => error.code === '42501');
    });
    await t.test('checksum mismatch refuses maintenance without rewriting history', async () => {
      const original = (await ownerPool.query('SELECT checksum FROM auth_migration')).rows[0].checksum;
      await ownerPool.query("UPDATE auth_migration SET checksum='tampered'");
      await assert.rejects(run('migrate'), /checksum/);
      await ownerPool.query('UPDATE auth_migration SET checksum=$1', [original]);
    });
    await t.test('first admin gets pending password; duplicate bootstrap is refused', async () => {
      await run('bootstrap', input);
      await assert.rejects(run('bootstrap', { ...input, email: 'second@example.test' }), /already exists/);
      assert.equal((await runtimePool.query('SELECT "mustChangePassword" FROM auth_user')).rows[0].mustChangePassword, true);
    });
    await t.test('permission drift refuses recovery before altering any identity', async () => {
      await ownerPool.query('GRANT TRUNCATE ON public.auth_user TO fm_auth_preview_runtime');
      try {
        await assert.rejects(run('recover', { email: input.email, password: input.password + '-unsafe' }), /privileges changed/);
      } finally {
        await ownerPool.query('REVOKE TRUNCATE ON public.auth_user FROM fm_auth_preview_runtime');
      }
    });
    const auth = createAccessAuth(runtimePool, config);
    let cookie;
    await t.test('recovery revokes sessions, rejects old password and preserves identity/role', async () => {
      const response = await auth.api.signInEmail({ body: { email: input.email, password: input.password }, asResponse: true });
      assert.equal(response.status, 200);
      cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
      const before = (await runtimePool.query('SELECT id,email,role FROM auth_user')).rows[0];
      await run('recover', { email: input.email, password: input.password + '-new' });
      assert.deepEqual((await runtimePool.query('SELECT id,email,role FROM auth_user')).rows[0], before);
      assert.equal((await runtimePool.query('SELECT count(*) FROM auth_session')).rows[0].count, '0');
      assert.equal(await auth.api.getSession({ headers: new globalThis.Headers({ cookie }) }), null);
      await assert.rejects(auth.api.signInEmail({ body: { email: input.email, password: input.password } }));
      const renewed = await auth.api.signInEmail({ body: { email: input.email, password: input.password + '-new' } });
      assert.equal(renewed.user.mustChangePassword, true);
      assert.equal((await runtimePool.query('SELECT count(*) FROM auth_verification')).rows[0].count, '0');
    });
    await t.test('runtime transaction lock serializes with direct maintenance lock', async () => {
      let unblock, entered;
      const ready = new Promise(resolve => { entered = resolve; });
      const wait = new Promise(resolve => { unblock = resolve; });
      const lockPool = new Pool({ connectionString: runtimeUrl.href, max: 1 });
      const holding = LocalAccessService.prototype.exclusive.call({ lockPool }, async () => { entered(); await wait; });
      let recovering;
      try {
        await ready;
        recovering = run('recover', { email: input.email, password: input.password + '-serialized' });
        // Observe an actual waiting PostgreSQL lock, not elapsed-time guessing.
        let waiting = false;
        for (let attempt = 0; attempt < 80; attempt++) {
          const observed = await setup.query('SELECT 1 FROM pg_locks WHERE locktype=\'advisory\' AND objid=734007 AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=$1)', [database]);
          if (observed.rowCount) { waiting = true; break; }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.equal(waiting, true);
      } finally {
        unblock();
        await holding;
        if (recovering) await recovering;
        await lockPool.end();
      }
    });
    await t.test('missing/non-admin recovery rejected; banned admin stays banned', async () => {
      await assert.rejects(run('recover', { email: 'absent@example.test', password: input.password }), /Existing administrator/);
      await auth.api.createUser({ body: { name: 'Operator', email: 'operator@example.test', password: input.password, role: 'user' } });
      await assert.rejects(run('recover', { email: 'operator@example.test', password: input.password }), /Existing administrator/);
      await runtimePool.query("UPDATE auth_user SET banned=true,\"banReason\"='synthetic block' WHERE email=$1", [input.email]);
      await run('recover', { email: input.email, password: input.password + '-blocked' });
      const user = (await runtimePool.query('SELECT banned,"banReason" FROM auth_user WHERE email=$1', [input.email])).rows[0];
      assert.deepEqual(user, { banned: true, banReason: 'synthetic block' });
      await assert.rejects(auth.api.signInEmail({ body: { email: input.email, password: input.password + '-blocked' } }));
    });
  } finally {
    await Promise.allSettled([runtimePool.end(), ownerPool.end(), setup.end()]);
    // Retained for inspection. No DROP DATABASE/ROLE, reset or volume removal.
  }
});
