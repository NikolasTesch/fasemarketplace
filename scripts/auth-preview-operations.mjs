import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { betterAuth } from 'better-auth';
import { authOptions, createAccessAuth } from '../apps/backend/dist/access/auth.js';

const role = 'fm_auth_preview_runtime';
const tables = 'public.auth_user,public.auth_session,public.auth_account,public.auth_verification';
const migration = new URL('../apps/backend/migrations/001_auth.sql', import.meta.url);

function fields(input, bootstrap) {
  if (!input || typeof input.email !== 'string' || input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
      typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128 ||
      (bootstrap && (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100)))
    throw new Error('Invalid private maintenance input');
  return { ...input, email: input.email.trim().toLowerCase() };
}

// Pools are supplied by the validated CLI. Tests supply isolated local pools;
// there is deliberately no env flag that bypasses Preview target validation.
export async function runPreviewMaintenance({ action, ownerPool, runtimePool, config, input }) {
  if (!['migrate', 'bootstrap', 'recover'].includes(action)) throw new Error('Invalid operation');
  const data = action === 'migrate' ? undefined : fields(input, action === 'bootstrap');
  const client = await ownerPool.connect();
  try {
    await client.query("SET statement_timeout='30s'");
    await client.query("SET lock_timeout='10s'");
    await client.query('SELECT pg_advisory_lock(734007)');
    if (action === 'migrate') {
      const sql = await readFile(migration, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      await client.query('BEGIN');
      try {
        const existing = await client.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1', [role]);
        if (!existing.rowCount) {
          const statement = await client.query("SELECT format('CREATE ROLE fm_auth_preview_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT', $1::text) AS sql", [decodeURIComponent(new URL(config.databaseUrl).password)]);
          await client.query(statement.rows[0].sql);
        } else if (Object.values(existing.rows[0]).some(Boolean)) throw new Error('Runtime role has privileged flags');
        const membership = await client.query('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)', [role]);
        if (membership.rowCount) throw new Error('Runtime role has memberships');
        const schema = await client.query("SELECT has_schema_privilege($1,'public','CREATE') AS unsafe", [role]);
        if (schema.rows[0].unsafe) throw new Error('Runtime role can create objects');
        await client.query('CREATE TABLE IF NOT EXISTS public.auth_migration(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
        const prior = (await client.query("SELECT checksum FROM public.auth_migration WHERE version='001'")).rows[0];
        if (prior && prior.checksum !== checksum) throw new Error('Migration checksum mismatch');
        if (!prior) {
          await client.query(sql);
          await client.query("INSERT INTO public.auth_migration(version,checksum) VALUES('001',$1)", [checksum]);
        }
        const owned = await client.query("SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=$1)", [role]);
        if (owned.rowCount) throw new Error('Runtime must not own schema objects');
        await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
        await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${tables} TO ${role}`);
        const dangerous = await client.query("SELECT has_table_privilege($1,'public.auth_migration','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR EXISTS (SELECT 1 FROM unnest(ARRAY['auth_user','auth_session','auth_account','auth_verification']) AS t WHERE has_table_privilege($1,'public.'||t,'TRUNCATE,REFERENCES,TRIGGER')) AS unsafe", [role]);
        if (dangerous.rows[0].unsafe) throw new Error('Runtime has extra auth privileges');
        await client.query('COMMIT');
        // Confirm configured password and effective login, without rotating existing roles.
        await runtimePool.query('SELECT 1 FROM public.auth_user LIMIT 0');
        return { operation: action, alreadyApplied: Boolean(prior) };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    // Recheck on every private operation, including permission drift after migrate.
    const privileges = await client.query(`SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit OR NOT rolcanlogin
      OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid)
      OR has_schema_privilege(r.oid,'public','CREATE')
      OR EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=r.oid)
      OR has_table_privilege(r.oid,'public.auth_migration','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR EXISTS (SELECT 1 FROM unnest(ARRAY['auth_user','auth_session','auth_account','auth_verification']) AS t WHERE has_table_privilege(r.oid,'public.'||t,'TRUNCATE,REFERENCES,TRIGGER')) AS unsafe
      FROM pg_roles r WHERE rolname=$1`, [role]);
    if (!privileges.rowCount || privileges.rows[0].unsafe) throw new Error('Runtime privileges changed');
    const checksum = createHash('sha256').update(await readFile(migration, 'utf8')).digest('hex');
    if ((await client.query("SELECT checksum FROM public.auth_migration WHERE version='001'")).rows[0]?.checksum !== checksum)
      throw new Error('Migration checksum mismatch');
    if (action === 'bootstrap') {
      if ((await runtimePool.query("SELECT 1 FROM public.auth_user WHERE role='admin' LIMIT 1")).rowCount)
        throw new Error('Administrator already exists');
      await createAccessAuth(runtimePool, config).api.createUser({ body: {
        name: data.name.trim(), email: data.email, password: data.password, role: 'admin', data: { mustChangePassword: true },
      } });
      return { operation: action };
    }
    const user = (await runtimePool.query("SELECT id FROM public.auth_user WHERE email=$1 AND role='admin'", [data.email])).rows[0];
    if (!user) throw new Error('Existing administrator required');
    // Durable revocation/pending first: a failed reset cannot restore access.
    await runtimePool.query('UPDATE public.auth_user SET "mustChangePassword"=true WHERE id=$1', [user.id]);
    await runtimePool.query('DELETE FROM public.auth_session WHERE "userId"=$1', [user.id]);
    let token;
    const options = authOptions(runtimePool, config);
    const auth = betterAuth({ ...options, emailAndPassword: { ...options.emailAndPassword,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async (reset) => { if (reset.user.id !== user.id) throw new Error('Recovery identity mismatch'); token = reset.token; },
    } });
    try {
      await auth.api.requestPasswordReset({ body: { email: data.email } });
      if (!token) throw new Error('Recovery token unavailable');
      await auth.api.resetPassword({ body: { token, newPassword: data.password } });
    } finally {
      if (token) await runtimePool.query('DELETE FROM public.auth_verification WHERE identifier=$1', [`reset-password:${token}`]);
      token = undefined;
      await runtimePool.query('DELETE FROM public.auth_session WHERE "userId"=$1', [user.id]);
    }
    return { operation: action };
  } finally {
    await client.query('SELECT pg_advisory_unlock(734007)').catch(() => {});
    client.release();
  }
}
