import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { readBusinessConfig } from './config.js';

export function businessPoolSettings(runtimeUrl: string) {
  const url = new URL(runtimeUrl), local = url.hostname === 'postgres';
  if (local) url.search = '';
  return { connectionString: url.href, max: 3, connectionTimeoutMillis: 5000, query_timeout: 10000,
    ...(local ? { options: '-c search_path=business -c statement_timeout=10000 -c lock_timeout=5000' } : {}) };
}

export function createBusinessClient(env: NodeJS.ProcessEnv = process.env) {
  const config = readBusinessConfig(env);
  if (!config) return null;
  return new PrismaClient({
    adapter: new PrismaPg(businessPoolSettings(config.runtimeUrl),
    { schema: 'business', onPoolError: () => {}, onConnectionError: () => {} }),
    log: [], errorFormat: 'minimal',
  });
}

export async function assertBusinessRuntime(client: PrismaClient) {
  const rows = await client.$queryRaw<Array<{ safe: boolean }>>`
    SELECT current_user = 'fm_business_runtime'
      AND NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR r.rolinherit)
      AND NOT has_database_privilege(current_user,current_database(),'CREATE')
      AND NOT has_schema_privilege(current_user,'public','CREATE')
      AND NOT has_schema_privilege(current_user,'business','CREATE')
      AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner=r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relowner=r.oid)
      AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datdba=r.oid)
      AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind IN ('r','p','v','m','f') AND (
          (n.nspname='public' AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
          OR (n.nspname='business' AND (has_table_privilege(current_user,c.oid,'TRUNCATE')
            OR (c.relname='_prisma_migrations' AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')))))) AS safe
    FROM pg_roles r WHERE r.rolname=current_user`;
  if (!rows[0]?.safe) throw new Error('Business runtime privileges refused');
}
