import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';

export function assertTicketMigrationConfig(env) {
  try {
    if (
      env.APP_ENV !== 'local' ||
      env.MARKETPLACE_MODE !== 'mock' ||
      (env.DATABASE_PROVIDER ?? 'local') !== 'local' ||
      env.AUTH_ENABLED !== 'true' ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(env.AUTH_SECRET ?? '') ||
      env.REDIS_URL !== 'redis://redis:6379'
    ) throw new Error();

    const database = new URL(env.DATABASE_URL ?? '');
    const authDatabase = new URL(env.AUTH_DATABASE_URL ?? '');
    const databaseName = decodeURIComponent(database.pathname.slice(1));
    const origin = new URL(env.AUTH_ORIGIN ?? '');
    const cookiePrefix = env.AUTH_COOKIE_PREFIX ?? 'fm_local_access';

    if (
      database.protocol !== 'postgresql:' ||
      database.hostname !== 'postgres' ||
      (database.port && database.port !== '5432') ||
      database.username === 'fm_auth_runtime' ||
      !database.username || !database.password ||
      database.search || database.hash ||
      !/^fasemarketplace$|^fm_auth_test_[0-9a-f]{16,64}$/i.test(databaseName) ||
      authDatabase.protocol !== 'postgresql:' ||
      authDatabase.hostname !== 'postgres' ||
      (authDatabase.port && authDatabase.port !== '5432') ||
      authDatabase.username !== 'fm_auth_runtime' || !authDatabase.password ||
      authDatabase.pathname !== database.pathname ||
      authDatabase.search || authDatabase.hash ||
      origin.origin !== env.AUTH_ORIGIN || origin.protocol !== 'http:' ||
      origin.hostname !== '127.0.0.1' || !origin.port ||
      !/^[a-z][a-z0-9_]{7,59}$/.test(cookiePrefix)
    ) throw new Error();

    return { databaseUrl: database.href, databaseName };
  } catch {
    throw new Error('Ticket migration requires explicit local Docker auth and a permitted local database');
  }
}

export function assertTicketMigrationChecksum(applied, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected))
    throw new Error('Invalid ticket migration checksum');
  if (applied === undefined || applied === null) return true;
  if (applied !== expected) throw new Error('Ticket migration checksum mismatch');
  return false;
}

async function migrate() {
  if (process.argv[2] !== 'migrate') throw new Error('Use the explicit migrate action');
  const { databaseUrl } = assertTicketMigrationConfig(process.env);
  const migrations = await Promise.all([
    { version: '002', file: 'apps/backend/migrations/002_tickets.sql' },
    { version: '003', file: 'apps/backend/migrations/003_revoke_ticket_image_delete.sql' },
    { version: '004', file: 'apps/backend/migrations/004_ticket_screen_options.sql' },
  ].map(async (migration) => {
    const sql = await readFile(migration.file, 'utf8');
    return { ...migration, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
  const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 2000 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(734007)');
      const runtime = await client.query("SELECT 1 FROM pg_roles WHERE rolname='fm_auth_runtime'");
      if (!runtime.rowCount) throw new Error('Local auth runtime role is missing');
      await client.query(`
        CREATE TABLE IF NOT EXISTS support_ticket_migration (
          version text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      let appliedAny = false;
      for (const migration of migrations) {
        const existing = await client.query(
          'SELECT checksum FROM support_ticket_migration WHERE version=$1',
          [migration.version],
        );
        const shouldApply = assertTicketMigrationChecksum(existing.rows[0]?.checksum, migration.checksum);
        if (!shouldApply) continue;
        await client.query(migration.sql);
        if (migration.version === '002') {
          await client.query('GRANT SELECT, INSERT ON TABLE support_ticket TO fm_auth_runtime');
          await client.query('GRANT SELECT, INSERT, DELETE ON TABLE support_ticket_image TO fm_auth_runtime');
        }
        await client.query(
          'INSERT INTO support_ticket_migration(version,checksum) VALUES($1,$2)',
          [migration.version, migration.checksum],
        );
        appliedAny = true;
      }
      await client.query('COMMIT');
      console.log(appliedAny ? 'Ticket migrations applied to local PostgreSQL.' : 'Ticket migrations already applied; checksums verified.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().catch(() => {
    console.error('Local ticket migration refused or failed; check auth, database target, and migration state.');
    process.exitCode = 1;
  });
}
