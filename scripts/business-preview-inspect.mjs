import {Pool} from 'pg';
import {readPreviewMaintenanceConfig} from '../apps/backend/dist/access/maintenance-config.js';
try{
  const config=readPreviewMaintenanceConfig(),url=new URL(config.ownerUrl);
  if(url.hostname!=='ep-soft-bird-b61xykn1.c-2.sa-east-1.aws.neon.tech'||url.pathname!=='/neondb')throw new Error('Target refused');
  const pool=new Pool({connectionString:url.href,max:1,connectionTimeoutMillis:10000});pool.on('error',()=>{});
  try{
    const result=await pool.query(`SELECT current_database()='neondb' AS database_matches,
      current_setting('server_version_num')::int/10000 AS server_major,
      r.rolcreaterole AS can_create_roles,has_database_privilege(current_user,current_database(),'CREATE') AS can_create_schema,
      EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='business') AS business_schema_exists,
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fm_business_runtime') AS runtime_role_exists,
      EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fm_business_migrator') AS migrator_role_exists
      FROM pg_roles r WHERE r.rolname=current_user`);
    console.log(JSON.stringify(result.rows[0]));
  }finally{await pool.end();}
}catch{console.error('Preview business read-only inspection failed');process.exitCode=1;}
