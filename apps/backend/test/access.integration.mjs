import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { spawn } from 'node:child_process';
import { AppModule } from '../dist/app.module.js';
import { TelemetryExceptionFilter } from '../dist/api-exception-filter.js';
import { LocalAccessService } from '../dist/access/service.js';

test('local access against disposable PostgreSQL and Redis', async (t) => {
  assert.match(
    new URL(process.env.AUTH_DATABASE_URL).pathname,
    /^\/fm_auth_test_[a-z0-9_]+$/,
  );
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '8kb' });
  app.useGlobalFilters(
    new TelemetryExceptionFilter(app.get(HttpAdapterHost), {
      exception: () => {},
    }),
  );
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    await app.listen(0, '0.0.0.0');
    const port = app.getHttpServer().address().port;
    const root = `http://127.0.0.1:${port}`;
    const headers = (cookie = '') => ({
      'content-type': 'application/json',
      origin: process.env.AUTH_ORIGIN,
      cookie,
    });
    const post = (path, body, cookie = '') =>
      fetch(root + path, {
        method: 'POST',
        headers: headers(cookie),
        body: JSON.stringify(body),
      });
    const get = (path, cookie = '') =>
      fetch(root + path, { headers: { cookie } });
    const cookie = (response) =>
      response.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; ');
    const adminPassword = 'Synthetic-Admin-2026-only!';
    const provisional = 'Synthetic-Temporary-2026!';
    const permanent = 'Synthetic-Permanent-2026!';
    const email = 'operator@example.test';
    let adminCookie, adminId, userId, userCookie;
    await t.test(
      'anonymous and public/native routes remain closed',
      async () => {
        assert.equal((await get('/access/session')).status, 401);
        assert.equal(
          (
            await post('/auth/sign-up/email', {
              email,
              password: provisional,
              name: 'Public',
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await post('/api/auth/admin/create-user', {
              email,
              password: provisional,
              name: 'Public',
            })
          ).status,
          404,
        );
      },
    );
    // Only the uniquely named disposable DB is reset; the persistent local DB is untouched.
    await db.query(
      'DELETE FROM auth_session;DELETE FROM auth_account;DELETE FROM auth_user',
    );
    const access = app.get(LocalAccessService);
    // Only counters belonging to this disposable test's secret are removed.
    const { createHmac } = await import('node:crypto');
    const marker = createHmac('sha256', process.env.AUTH_SECRET)
      .update('127.0.0.1')
      .digest('hex');
    await access.redis.del(
      `fm:access:${process.env.AUTH_COOKIE_PREFIX}:ip:${marker}`,
    );
    const fixtureEmails = [
      email,
      'admin@example.test',
      'absent@example.test',
      'limited@example.test',
      ...Array.from({ length: 22 }, (_, i) => `attempt${i}@example.test`),
    ];
    for (const fixture of fixtureEmails) {
      const hash = createHmac('sha256', process.env.AUTH_SECRET)
        .update('127.0.0.1\0' + fixture)
        .digest('hex');
      await access.redis.del(
        `fm:access:${process.env.AUTH_COOKIE_PREFIX}:login:${hash}`,
      );
    }
    const bootstrap = () =>
      new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['scripts/auth-local.mjs', 'bootstrap', '--stdin'],
          { stdio: ['pipe', 'pipe', 'pipe'] },
        );
        let output = '';
        child.stdout.on('data', (data) => {
          output += data;
        });
        child.stderr.on('data', (data) => {
          output += data;
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, output }));
        child.stdin.end(
          JSON.stringify({
            name: 'Synthetic Admin',
            email: 'admin@example.test',
            password: adminPassword,
          }),
        );
      });
    await t.test(
      'concurrent CLI bootstrap creates exactly one administrator and refuses repeats',
      async () => {
        const results = await Promise.all([bootstrap(), bootstrap()]);
        assert.deepEqual(results.map((result) => result.code).sort(), [0, 1]);
        assert.ok(
          results.every((result) => !result.output.includes(adminPassword)),
        );
        assert.equal((await bootstrap()).code, 1);
        const admins = (
          await db.query(
            'SELECT id,"mustChangePassword" FROM auth_user WHERE role=\'admin\'',
          )
        ).rows;
        assert.equal(admins.length, 1);
        assert.equal(admins[0].mustChangePassword, false);
        adminId = admins[0].id;
      },
    );
    await t.test(
      'sign-in returns HttpOnly cookie and sanitized DTO, session survives reload',
      async () => {
        const response = await post('/access/login', {
          email: 'admin@example.test',
          password: adminPassword,
        });
        assert.equal(response.status, 200);
        assert.ok(
          response.headers
            .getSetCookie()
            .some((v) => /HttpOnly/i.test(v) && /SameSite=Lax/i.test(v)),
        );
        adminCookie = cookie(response);
        const data = await response.json();
        assert.equal(data.user.mustChangePassword, false);
        assert.equal(JSON.stringify(data).includes('token'), false);
        const session = await get('/access/session', adminCookie);
        assert.equal(session.status, 200);
        assert.equal((await session.json()).user.role, 'admin');
      },
    );
    await t.test(
      'CSRF, content type, size and malformed JSON fail without secret echo',
      async () => {
        const wrong = await fetch(root + '/access/login', {
          method: 'POST',
          headers: { ...headers(), origin: 'https://evil.example' },
          body: JSON.stringify({ email, password: provisional }),
        });
        assert.equal(wrong.status, 403);
        assert.equal(
          (
            await fetch(root + '/access/login', {
              method: 'POST',
              headers: {
                origin: process.env.AUTH_ORIGIN,
                'content-type': 'text/plain',
              },
              body: 'x',
            })
          ).status,
          415,
        );
        const excessive = await post('/access/login', {
          email,
          password: 'x'.repeat(9000),
        });
        assert.equal(excessive.status, 413);
        const marker = 'private-json-marker';
        const malformed = await fetch(root + '/access/login', {
          method: 'POST',
          headers: headers(),
          body: '{"password":"' + marker + '"',
        });
        assert.equal(malformed.status, 400);
        assert.equal((await malformed.text()).includes(marker), false);
      },
    );
    await t.test(
      'admin creates pending user; mass assignment and duplicates are refused',
      async () => {
        assert.equal(
          (
            await post(
              '/access/users',
              {
                name: 'Operator',
                email,
                password: provisional,
                role: 'user',
                mustChangePassword: false,
              },
              adminCookie,
            )
          ).status,
          400,
        );
        const created = await post(
          '/access/users',
          { name: 'Operator', email, password: provisional, role: 'user' },
          adminCookie,
        );
        assert.equal(created.status, 201);
        const data = await created.json();
        userId = data.user.id;
        assert.equal(data.user.mustChangePassword, true);
        assert.equal(
          (
            await post(
              '/access/users',
              {
                name: 'Duplicate',
                email: email.toUpperCase(),
                password: provisional,
                role: 'user',
              },
              adminCookie,
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      'provisional password is enforced server-side, not only by UI',
      async () => {
        const login = await post('/access/login', {
          email,
          password: provisional,
        });
        assert.equal(login.status, 200);
        userCookie = cookie(login);
        const parallel = cookie(
          await post('/access/login', { email, password: provisional }),
        );
        assert.equal((await get('/access/session', userCookie)).status, 200);
        assert.equal((await get('/access/users', userCookie)).status, 403);
        assert.equal(
          (
            await post(
              '/access/password',
              { currentPassword: provisional, newPassword: provisional },
              userCookie,
            )
          ).status,
          400,
        );
        const changed = await post(
          '/access/password',
          { currentPassword: provisional, newPassword: permanent },
          userCookie,
        );
        assert.equal(changed.status, 200);
        if (cookie(changed)) userCookie = cookie(changed);
        assert.equal((await get('/access/session', parallel)).status, 401);
        assert.equal(
          (await (await get('/access/session', userCookie)).json()).user
            .mustChangePassword,
          false,
        );
        assert.equal((await get('/access/users', userCookie)).status, 403);
      },
    );
    await t.test(
      'expired session and logout are rejected on subsequent use',
      async () => {
        const extra = await post('/access/login', {
          email,
          password: permanent,
        });
        const extraCookie = cookie(extra);
        const tokens = (
          await db.query('SELECT token FROM auth_session WHERE "userId"=$1', [
            userId,
          ])
        ).rows;
        assert.ok(tokens.length > 0);
        const expires = await db.query(
          'SELECT id FROM auth_session WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 1',
          [userId],
        );
        await db.query(
          'UPDATE auth_session SET "expiresAt"=now()-interval \'1 minute\' WHERE id=$1',
          [expires.rows[0].id],
        );
        assert.equal((await get('/access/session', extraCookie)).status, 401);
        const logged = await post('/access/login', {
          email,
          password: permanent,
        });
        userCookie = cookie(logged);
        assert.equal(
          (await post('/access/logout', {}, userCookie)).status,
          200,
        );
        assert.equal((await get('/access/session', userCookie)).status, 401);
      },
    );
    await t.test(
      'blocking revokes sessions and returns generic credential error',
      async () => {
        const login = await post('/access/login', {
          email,
          password: permanent,
        });
        userCookie = cookie(login);
        assert.equal(
          (
            await post(
              '/access/users/' + userId + '/block',
              { blocked: true },
              adminCookie,
            )
          ).status,
          200,
        );
        assert.equal((await get('/access/session', userCookie)).status, 401);
        const blocked = await post('/access/login', {
          email,
          password: permanent,
        });
        const unknown = await post('/access/login', {
          email: 'absent@example.test',
          password: permanent,
        });
        assert.equal(blocked.status, 401);
        assert.equal(unknown.status, 401);
        assert.deepEqual(await blocked.json(), await unknown.json());
        assert.equal(
          (
            await post(
              '/access/users/' + userId + '/block',
              { blocked: false },
              adminCookie,
            )
          ).status,
          200,
        );
        assert.equal((await get('/access/session', userCookie)).status, 401);
      },
    );
    await t.test(
      'reset revokes prior sessions and requires another password change',
      async () => {
        const login = await post('/access/login', {
          email,
          password: permanent,
        });
        userCookie = cookie(login);
        assert.equal(
          (
            await post(
              '/access/users/' + userId + '/password',
              { password: provisional },
              adminCookie,
            )
          ).status,
          200,
        );
        assert.equal((await get('/access/session', userCookie)).status, 401);
        const next = await post('/access/login', {
          email,
          password: provisional,
        });
        assert.equal(next.status, 200);
        userCookie = cookie(next);
        assert.equal((await next.json()).user.mustChangePassword, true);
        assert.equal(
          (
            await post(
              '/access/users/' + adminId + '/block',
              { blocked: true },
              adminCookie,
            )
          ).status,
          400,
        );
        assert.equal(
          (await get('/access/users?offset=-1', adminCookie)).status,
          400,
        );
      },
    );
    await t.test(
      'login concurrent with password reset cannot retain a session from the old password',
      async () => {
        const context = await access.auth.$context;
        const adapter = context.internalAdapter;
        const original = adapter.createSession;
        let entered, release;
        const paused = new Promise((resolve) => {
          entered = resolve;
        });
        const resume = new Promise((resolve) => {
          release = resolve;
        });
        adapter.createSession = async (...args) => {
          entered();
          await resume;
          return original.apply(adapter, args);
        };
        try {
          const login = post('/access/login', { email, password: provisional });
          await Promise.race([
            paused,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Login did not reach session creation')),
                5000,
              ),
            ),
          ]);
          const reset = post(
            '/access/users/' + userId + '/password',
            { password: permanent },
            adminCookie,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          release();
          const [signed, changed] = await Promise.all([login, reset]);
          assert.equal(signed.status, 200);
          assert.equal(changed.status, 200);
          assert.equal(
            (await get('/access/session', cookie(signed))).status,
            401,
          );
        } finally {
          release();
          adapter.createSession = original;
        }
      },
    );
    await t.test(
      'Redis failure refuses login and recovery does not restart shared Redis',
      async () => {
        access.redis.disconnect();
        assert.equal(
          (
            await post('/access/login', {
              email: 'admin@example.test',
              password: adminPassword,
            })
          ).status,
          503,
        );
        await access.redis.connect();
        await access.redis.ping();
        assert.equal(
          (
            await post('/access/login', {
              email: 'admin@example.test',
              password: adminPassword,
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      'five failed combinations and aggregate IP limit are persisted, identifiers are hashed',
      async () => {
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await post('/access/login', {
                email: 'limited@example.test',
                password: permanent,
              })
            ).status,
            401,
          );
        assert.equal(
          (
            await post('/access/login', {
              email: 'limited@example.test',
              password: permanent,
            })
          ).status,
          429,
        );
        const keys = await access.redis.keys('fm:access:*');
        assert.ok(keys.length > 0);
        assert.equal(
          keys.some((key) => key.includes('@')),
          false,
        );
        let blocked = false;
        for (let i = 0; i < 22; i++) {
          const r = await post('/access/login', {
            email: `attempt${i}@example.test`,
            password: permanent,
          });
          if (r.status === 429) {
            blocked = true;
            break;
          }
          assert.equal(r.status, 401);
        }
        assert.equal(blocked, true);
      },
    );
  } finally {
    await db.end();
    await app.close();
  }
});
