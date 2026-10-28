import { Pool } from 'pg';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readBusinessMaintenanceConfig } from '../apps/backend/dist/persistence/config.js';

const quote = value => '"' + value.replaceAll('"', '""') + '"';
const roleNames = ['fm_business_runtime', 'fm_business_migrator'];
const migrationsDirectory = resolve('apps/backend/prisma/migrations');
function pool(url) {
  const value = new URL(url); value.search = '';
  const result = new Pool({ connectionString: value.href, max: 1, connectionTimeoutMillis: 5000, query_timeout: 30000 });
  result.on('error', () => {}); return result;
}

function checked(config) {
  return readBusinessMaintenanceConfig({ BUSINESS_ENABLED: 'true', APP_ENV: 'local', DATABASE_PROVIDER: 'local',
    BUSINESS_LOCAL_DATABASE: config.database, BUSINESS_DATABASE_URL: config.runtimeUrl,
    BUSINESS_MIGRATION_DATABASE_URL: config.migrationUrl, BUSINESS_SHADOW_DATABASE_URL: config.shadowUrl });
}

export async function assertRole(client, name) {
  const roles = await client.query(`SELECT rolcanlogin AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit) AS safe
    FROM pg_roles WHERE rolname=$1`, [name]);
  const memberships = await client.query('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)', [name]);
  const owner = await client.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE (n.nspname='public' OR $1='fm_business_runtime') AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=$1)
    UNION ALL SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=$1)
      AND (nspname <> 'business' OR $1='fm_business_runtime')
    UNION ALL SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=$1)`, [name]);
  const access = await client.query(`SELECT has_schema_privilege($1,'public','CREATE')
    OR has_database_privilege($1,current_database(),'CREATE')
    OR ($1='fm_business_runtime' AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='business' AND has_schema_privilege($1,oid,'CREATE')))
    OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','f') AND (
      (n.nspname='public' AND has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
      OR ($1='fm_business_runtime' AND n.nspname='business' AND (has_table_privilege($1,c.oid,'TRUNCATE')
        OR (c.relname='_prisma_migrations' AND has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE')))))) AS unsafe`, [name]);
  if (!roles.rows[0]?.safe || memberships.rowCount || owner.rowCount || access.rows[0].unsafe) throw new Error('Business role privileges refused');
}

export function validateBusinessAdminUrl(config, adminUrl) {
  config = checked(config);
  const url = new URL(adminUrl ?? '');
  if (url.protocol !== 'postgresql:' || url.hostname !== 'postgres' || (url.port && url.port !== '5432') ||
      url.pathname !== '/' + config.database || !url.password || !url.username || roleNames.includes(url.username) || url.search || url.hash ||
      [config.runtimeUrl, config.migrationUrl].some(value => decodeURIComponent(new URL(value).password) === decodeURIComponent(url.password)))
    throw new Error('Separate Docker-local provisioner required');
  return url;
}

async function provision(config, adminUrl) {
  const url = validateBusinessAdminUrl(config, adminUrl);
  const admin = pool(url.href);
  const shadowUrl = new URL(url); shadowUrl.pathname = '/' + config.shadowDatabase;
  const shadow = pool(shadowUrl.href);
  try {
    await admin.query('SELECT pg_advisory_lock(734010)');
    for (const value of [config.runtimeUrl, config.migrationUrl]) {
      const role = new URL(value);
      if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role.username])).rowCount) {
        const sql = await admin.query("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text,$2::text) AS sql", [role.username, decodeURIComponent(role.password)]);
        await admin.query(sql.rows[0].sql);
      }
      await assertRole(admin, role.username);
    }
    for (const client of [admin, shadow]) {
      const existing = await client.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='business'");
      if (existing.rowCount && existing.rows[0].owner !== 'fm_business_migrator') throw new Error('Business schema ownership refused');
      await client.query('CREATE SCHEMA IF NOT EXISTS business AUTHORIZATION fm_business_migrator');
      await client.query('REVOKE ALL ON SCHEMA business FROM PUBLIC');
      await client.query('GRANT USAGE ON SCHEMA business TO fm_business_runtime');
    }
    await shadow.query(`GRANT CREATE ON DATABASE ${quote(config.shadowDatabase)} TO fm_business_migrator`);
    // Verify existing role passwords by authenticating; never silently rotate them.
    for (const value of [config.runtimeUrl, config.migrationUrl, config.shadowUrl]) {
      const rolePool = pool(value);
      try { await rolePool.query('SELECT 1'); } finally { await rolePool.end(); }
    }
    return { operation: 'provision', database: config.database };
  } finally {
    await admin.query('SELECT pg_advisory_unlock(734010)').catch(() => {});
    await Promise.all([admin.end(), shadow.end()]);
  }
}

export async function verifyBusinessHistory(client, directory = migrationsDirectory) {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!/^[a-zA-Z0-9_-]+$/.test(entry.name)) throw new Error('Business migration history invalid');
    const sql = await readFile(resolve(directory, entry.name, 'migration.sql'));
    files.set(entry.name, createHash('sha256').update(sql).digest('hex'));
  }
  const exists = (await client.query("SELECT to_regclass('business._prisma_migrations') AS name")).rows[0].name;
  const rows = exists ? (await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM business._prisma_migrations')).rows : [];
  for (const row of rows) {
    if (row.rolled_back_at || !row.finished_at || files.get(row.migration_name) !== row.checksum)
      throw new Error('Business migration history diverged or incomplete');
  }
  return { applied: rows.length, files: files.size };
}

function prisma(config, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [resolve('node_modules/prisma/build/index.js'), ...args, '--config', 'prisma.config.ts'], {
      cwd: resolve('apps/backend'), shell: false, stdio: ['ignore', 'ignore', 'pipe'], timeout: 90000,
      env: { PATH: process.env.PATH, HOME: '/tmp', TMPDIR: '/tmp', APP_ENV: 'local', DATABASE_PROVIDER: 'local',
        BUSINESS_ENABLED: 'true', BUSINESS_LOCAL_DATABASE: config.database, BUSINESS_DATABASE_URL: config.runtimeUrl,
        BUSINESS_MIGRATION_DATABASE_URL: config.migrationUrl, BUSINESS_SHADOW_DATABASE_URL: config.shadowUrl,
        CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    });
    child.stderr.resume();
    child.on('error', () => reject(new Error('Business Prisma operation failed')));
    child.on('close', code => code === 0 ? resolveResult() : reject(new Error('Business Prisma operation failed')));
  });
}

export async function runBusinessMaintenance({ action, config: supplied, adminUrl, migrationsPath = migrationsDirectory }) {
  const config = checked(supplied);
  if (action === 'provision') return provision(config, adminUrl);
  if (!['check', 'migrate', 'plan'].includes(action)) throw new Error('Business action refused');
  const migration = pool(config.migrationUrl);
  try {
    // Direct Docker connection; hold one session across preflight and Prisma execution.
    await migration.query('SELECT pg_advisory_lock(734010)');
    for (const role of roleNames) await assertRole(migration, role);
    const schema = (await migration.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='business'")).rows[0];
    if (schema?.owner !== 'fm_business_migrator') throw new Error('Business schema ownership refused');
    const history = await verifyBusinessHistory(migration, migrationsPath);
    if (action === 'plan') {
      if (!/^fm_business_test_generate_[a-z0-9_]+$/.test(config.database) || resolve(migrationsPath) !== migrationsDirectory)
        throw new Error('Migration generation requires an empty disposable generation target');
      const objects = await migration.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','business') AND c.relkind IN ('r','p','v','m','f','S') LIMIT 1");
      if (objects.rowCount) throw new Error('Migration generation requires an empty disposable generation target');
      const shadow = pool(config.shadowUrl);
      try {
        const occupied = await shadow.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' LIMIT 1");
        if (occupied.rowCount) throw new Error('Migration generation requires an empty disposable shadow');
      } finally { await shadow.end(); }
      await prisma(config, ['migrate', 'dev', '--create-only', '--name', 'business_change']);
      return { operation: 'plan', database: config.database };
    }
    if (action === 'migrate') {
      // Overrides exist for refusal tests only; applying always uses the committed directory.
      if (resolve(migrationsPath) !== migrationsDirectory) throw new Error('Business migration history path refused');
      await prisma(config, ['migrate', 'deploy']);
      return { operation: 'migrate', ...await verifyBusinessHistory(migration) };
    }
    return { operation: 'check', ...history };
  } finally {
    await migration.query('SELECT pg_advisory_unlock(734010)').catch(() => {});
    await migration.end();
  }
}
