// Maintainer-only generator. Connect exclusively to a disposable local database.
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../apps/backend/dist/access/auth.js';
import { readLocalAccessOperationConfig } from '../apps/backend/dist/access/config.js';
const config = readLocalAccessOperationConfig();
if (
  !config ||
  !/^\/fm_auth_test_[a-z0-9_]+$/.test(new URL(config.databaseUrl).pathname)
)
  throw new Error('Generator requires disposable Docker test DB');
const pool = new Pool({ connectionString: config.databaseUrl });
try {
  const plan = await getMigrations(authOptions(pool, config));
  if (plan.unsafeChanges.length || plan.schemaProblems.length)
    throw new Error('Unsafe schema plan');
  await writeFile(
    'apps/backend/migrations/001_auth.sql',
    await plan.compileMigrations(),
  );
  console.log(
    'Versioned auth SQL generated from pinned library against disposable local DB.',
  );
} finally {
  await pool.end();
}
