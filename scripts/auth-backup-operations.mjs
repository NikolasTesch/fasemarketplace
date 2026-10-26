import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
import { Pool } from 'pg';
import { clearTimeout, setTimeout } from 'node:timers';
import { MAX_DUMP_BYTES, MAX_ENVELOPE_BYTES, sealBackup, openBackup } from './auth-backup-format.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const quote = value => '"' + value.replaceAll('"', '""') + '"';

function pgEnvironment(connectionString) {
  const url = new URL(connectionString);
  const remote = url.hostname !== 'postgres';
  return { PATH: process.env.PATH, LANG: 'C.UTF-8', PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '10', PGAPPNAME: 'fm-access-backup',
    PGSSLMODE: remote ? 'verify-full' : 'disable', ...(remote ? { PGSSLROOTCERT: 'system' } : {}),
    PGOPTIONS: '-c statement_timeout=60000 -c lock_timeout=10000' };
}

function runPg(command, args, connectionString, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: pgEnvironment(connectionString), stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    const chunks = [];
    let length = 0, failed = false;
    const timer = setTimeout(() => { failed = true; child.kill('SIGKILL'); }, 90000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('PostgreSQL client unavailable')); });
    child.stdout.on('data', chunk => {
      length += chunk.length;
      if (length > MAX_DUMP_BYTES) { failed = true; child.kill('SIGKILL'); }
      else chunks.push(chunk);
    });
    // Client diagnostics may contain connection details; drain without logging or retaining.
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('close', code => {
      clearTimeout(timer);
      if (failed || code !== 0) reject(new Error('PostgreSQL client failed or exceeded limits'));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(input);
  });
}

export function assertMatchingPostgresMajors(source, server, client) {
  if (![17, 18].includes(source) || source !== server || source !== client)
    throw new Error('PostgreSQL source, server and client major must match (17 or 18)');
}

async function serverMajor(client) {
  const major = Math.floor(Number((await client.query('SHOW server_version_num')).rows[0].server_version_num) / 10000);
  if (![17, 18].includes(major)) throw new Error('Unsupported PostgreSQL server major');
  return major;
}

async function clientMajor(command, url) {
  const version = await runPg(command, ['--version'], url);
  return Number(version.toString().match(/^pg_(?:dump|restore) \(PostgreSQL\) (\d+)\./)?.[1]);
}

async function fingerprints(client, schemas = ['public'], legacy = false) {
  const unsupported = await client.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND c.relkind NOT IN ('r','i','S') LIMIT 1", [schemas]);
  if (unsupported.rowCount) throw new Error('Schema contains unsupported relations');
  const names = (await client.query('SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND c.relkind=\'r\' ORDER BY n.nspname COLLATE "C", c.relname COLLATE "C"', [schemas])).rows;
  if (names.length > 100) throw new Error('Too many tables for this backup scope');
  const result = [];
  let total = 0;
  for (const {schema, name} of names) {
    const table = quote(schema) + '.' + quote(name);
    const length = Number((await client.query(`SELECT coalesce(sum(octet_length(row_to_json(t)::text)),0)::text AS bytes FROM ${table} t`)).rows[0].bytes);
    total += length;
    if (total > MAX_DUMP_BYTES) throw new Error('Data exceeds memory limit');
    const rows = (await client.query(`SELECT row_to_json(t)::text AS value FROM ${table} t ORDER BY (row_to_json(t)::text) COLLATE "C"`)).rows;
    const digest = createHash('sha256');
    for (const row of rows) digest.update(row.value).update('\n');
    result.push({ ...(legacy ? {} : { schema }), name, count: rows.length, sha256: digest.digest('hex') });
  }
  return result;
}

function makePool(url) {
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000, query_timeout: 65000,
    options: '-c timezone=UTC -c DateStyle=ISO -c statement_timeout=60000 -c lock_timeout=10000' });
  pool.on('error', () => {});
  return pool;
}

export async function createAccessBackup({ sourceUrl, context, file, key }) {
  if (!['local', 'local-test', 'preview'].includes(context)) throw new Error('Invalid backup context');
  // Exclusive create BEFORE connecting. Existing artifacts are never overwritten.
  const destination = await open(file, 'wx', 0o600);
  const pool = makePool(sourceUrl);
  let client;
  try {
    client = await pool.connect();
    const major = await serverMajor(client);
    assertMatchingPostgresMajors(major, major, await clientMajor('pg_dump', sourceUrl));
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const schemas = (await client.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('public','business') ORDER BY nspname COLLATE \"C\"")).rows.map(row => row.nspname);
    const tables = await fingerprints(client, schemas);
    const dump = await runPg('pg_dump', ['--format=custom', ...schemas.map(schema => '--schema=' + schema), '--no-owner', '--no-privileges', '--no-comments', '--no-publications', '--no-subscriptions', '--lock-wait-timeout=10000', '--snapshot=' + snapshot], sourceUrl);
    await client.query('COMMIT');
    const url = new URL(sourceUrl);
    const encrypted = sealBackup({ version: 2, schemas, createdAt: new Date().toISOString(), source: { context, host: url.hostname, database: url.pathname.slice(1), serverMajor: major },
      tables, dumpSha256: hash(dump), dump: dump.toString('base64') }, key);
    await destination.writeFile(encrypted);
    await destination.sync();
    return { operation: 'backup', serverMajor: major, tables: tables.length, bytes: encrypted.length, sha256: hash(encrypted) };
  } finally {
    if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
    await pool.end();
    await destination.close();
  }
}

async function readArchive(file, key) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_ENVELOPE_BYTES) throw new Error('Invalid archive file');
    const payload = openBackup(await handle.readFile(), key);
    if (![1, 2].includes(payload?.version) || ![17, 18].includes(payload.source?.serverMajor) || !['local', 'local-test', 'preview'].includes(payload.source.context) ||
        !Array.isArray(payload.tables) || payload.tables.length > 100 || typeof payload.dump !== 'string' || payload.dump.length > Math.ceil(MAX_DUMP_BYTES / 3) * 4)
      throw new Error('Unsupported archive metadata');
    if (payload.version === 1 && payload.source.context === 'local') throw new Error('Unsupported legacy context');
    const schemas = payload.version === 1 ? ['public'] : payload.schemas;
    if (!Array.isArray(schemas) || !['["public"]', '["business","public"]'].includes(JSON.stringify(schemas)) ||
        (payload.version === 1 && payload.schemas !== undefined)) throw new Error('Unsupported archive schemas');
    const identities = new Set();
    for (const table of payload.tables) {
      const schema = payload.version === 1 ? 'public' : table.schema;
      if ((payload.version === 1 && table.schema !== undefined) || !schemas.includes(schema) || typeof table.name !== 'string' || !table.name.length || table.name.length > 63 || table.name.includes('\0') ||
          !Number.isSafeInteger(table.count) || table.count < 0 || !/^[a-f0-9]{64}$/.test(table.sha256)) throw new Error('Unsupported table metadata');
      const id = JSON.stringify([schema, table.name]);
      if (identities.has(id)) throw new Error('Duplicate archive table');
      identities.add(id);
    }
    const dump = Buffer.from(payload.dump, 'base64');
    if (dump.length > MAX_DUMP_BYTES || dump.toString('base64') !== payload.dump || hash(dump) !== payload.dumpSha256 || dump.subarray(0, 5).toString() !== 'PGDMP')
      throw new Error('Invalid authenticated dump');
    return { payload, dump, schemas };
  } finally { await handle.close(); }
}

export function validateRestoreBase(value) {
  const url = new URL(value);
  if (url.protocol !== 'postgresql:' || url.hostname !== 'postgres' || (url.port && url.port !== '5432') || url.search || url.hash ||
      !url.username || !url.password || !/^\/fm_auth_test_[a-z0-9_]+$/.test(url.pathname)) throw new Error('Restore requires disposable Docker-local base');
  return url;
}

export async function restoreAccessBackup({ baseUrl, file, key }) {
  const url = validateRestoreBase(baseUrl); // Before decrypting or connecting.
  const { payload, dump, schemas } = await readArchive(file, key); // Full GCM verification before any connection/write.
  const database = 'fm_auth_restore_' + randomBytes(12).toString('hex');
  const pool = makePool(url.href);
  let restoredPool;
  try {
    const major = await serverMajor(pool);
    assertMatchingPostgresMajors(payload.source.serverMajor, major, await clientMajor('pg_restore', url.href));
    await pool.query(`CREATE DATABASE ${quote(database)} TEMPLATE template0`);
    url.pathname = '/' + database;
    restoredPool = makePool(url.href);
    // Only this freshly allocated, random-name quarantine DB is touched.
    // No CASCADE: if template assumptions ever change, refuse rather than delete objects.
    await restoredPool.query('DROP SCHEMA public');
    // pg_restore --schema filters out SCHEMA TOC entries themselves.
    // Create only the authenticated allowlisted namespaces in this new quarantine DB.
    for (const schema of schemas) await restoredPool.query(`CREATE SCHEMA ${quote(schema)}`);
    await runPg('pg_restore', ['--dbname=' + database, ...schemas.map(schema => '--schema=' + schema), '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction'], url.href, dump);
    const before = await fingerprints(restoredPool, schemas, payload.version === 1);
    if (JSON.stringify(before) !== JSON.stringify(payload.tables)) throw new Error('Restored content mismatch');
    await restoredPool.query('BEGIN');
    try {
      for (const name of ['auth_session', 'auth_verification']) {
        if (before.some(table => (table.schema ?? 'public') === 'public' && table.name === name)) await restoredPool.query(`DELETE FROM public.${quote(name)}`);
      }
      const after = await fingerprints(restoredPool, schemas, payload.version === 1);
      const revoked = table => (table.schema ?? 'public') === 'public' && ['auth_session', 'auth_verification'].includes(table.name);
      const stable = tables => tables.filter(table => !revoked(table));
      if (JSON.stringify(stable(after)) !== JSON.stringify(stable(before)) || after.some(table => revoked(table) && table.count !== 0))
        throw new Error('Restore quarantine verification failed');
      await restoredPool.query('COMMIT');
    } catch (error) { await restoredPool.query('ROLLBACK'); throw error; }
    return { operation: 'restore-local', serverMajor: major, database, tables: before.length, contentVerified: true, sessionsRevoked: true, verificationsRevoked: true };
  } finally {
    await Promise.allSettled([pool.end(), restoredPool?.end()]);
    // On failure the newly allocated DB remains quarantined, never promoted or dropped.
  }
}
