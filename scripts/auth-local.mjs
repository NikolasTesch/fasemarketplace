import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Pool } from 'pg';
import { createAccessAuth } from '../apps/backend/dist/access/auth.js';
import { readLocalAccessOperationConfig } from '../apps/backend/dist/access/config.js';

const config = readLocalAccessOperationConfig();
const action = process.argv[2];
if (!['migrate', 'bootstrap'].includes(action))
  throw new Error('Use migrate or bootstrap');
const pool = new Pool({
  connectionString:
    action === 'migrate' ? process.env.DATABASE_URL : config.databaseUrl,
  max: 4,
});
pool.on('error', () => {});
async function hiddenPassword() {
  if (!process.stdin.isTTY)
    throw new Error('Use private JSON stdin only with --stdin');
  process.stdout.write('Senha (não exibida): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let password = '';
    const receive = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\r' || char === '\n') {
          finish();
          resolve(password);
          return;
        }
        if (char === '\u0003') {
          finish();
          reject(new Error('Canceled'));
          return;
        }
        if (char === '\u007f' || char === '\b')
          password = password.slice(0, -1);
        else password += char;
      }
    };
    function finish() {
      process.stdin.off('data', receive);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    }
    process.stdin.on('data', receive);
  });
}
try {
  if (action === 'migrate') {
    const sql = await readFile('apps/backend/migrations/001_auth.sql', 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(734007)');
      const runtime = await client.query(
        "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='fm_auth_runtime'",
      );
      if (!runtime.rowCount) {
        const password = decodeURIComponent(
          new URL(config.databaseUrl).password,
        );
        const statement = await client.query(
          "SELECT format('CREATE ROLE fm_auth_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text) AS sql",
          [password],
        );
        await client.query(statement.rows[0].sql);
      } else if (Object.values(runtime.rows[0]).some(Boolean)) {
        throw new Error('Runtime role must have restricted privileges');
      }
      await client.query(
        'CREATE TABLE IF NOT EXISTS auth_migration(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())',
      );
      const prior = (
        await client.query(
          "SELECT checksum FROM auth_migration WHERE version='001'",
        )
      ).rows[0];
      if (prior && prior.checksum !== checksum)
        throw new Error('Migration checksum mismatch');
      if (!prior) {
        await client.query(sql);
        await client.query(
          "INSERT INTO auth_migration(version,checksum) VALUES('001',$1)",
          [checksum],
        );
      }
      await client.query(
        'GRANT SELECT,INSERT,UPDATE,DELETE ON auth_user,auth_session,auth_account,auth_verification TO fm_auth_runtime',
      );
      await client.query('COMMIT');
      console.log(
        prior
          ? 'Auth migration already applied; checksum verified.'
          : 'Auth migration applied to local PostgreSQL.',
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else {
    let input;
    if (process.argv.includes('--stdin')) {
      let raw = '';
      for await (const chunk of process.stdin) {
        raw += chunk.toString();
        if (raw.length > 8192) throw new Error('Input too large');
      }
      input = JSON.parse(raw);
    } else {
      const terminal = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const name = await terminal.question('Nome: ');
      const email = await terminal.question('E-mail: ');
      terminal.close();
      const password = await hiddenPassword();
      input = { name, email, password };
    }
    if (
      !input ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.length > 100 ||
      typeof input.email !== 'string' ||
      input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
      typeof input.password !== 'string' ||
      input.password.length < 12 ||
      input.password.length > 128
    )
      throw new Error('Invalid bootstrap fields');
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(734007)');
      if (
        Number(
          (
            await pool.query(
              "SELECT count(*) FROM auth_user WHERE role='admin'",
            )
          ).rows[0].count,
        )
      )
        throw new Error('Administrator already exists');
      const auth = createAccessAuth(pool, config);
      await auth.api.createUser({
        body: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          password: input.password,
          role: 'admin',
          data: { mustChangePassword: false },
        },
      });
      console.log(
        'First local administrator created. No credential was logged.',
      );
    } finally {
      await client.query('SELECT pg_advisory_unlock(734007)').catch(() => {});
      client.release();
    }
  }
} catch (error) {
  if (process.env.AUTH_DIAGNOSTICS === 'true')
    console.error(
      JSON.stringify({
        operation: action,
        code: error?.code ?? error?.name,
        frames: error?.stack?.split('\n').slice(1, 3),
      }),
    );
  console.error(
    'Local auth operation refused or failed; check configuration, migration state and whether an administrator already exists.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
