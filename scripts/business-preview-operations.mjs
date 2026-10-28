import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {assertRole,verifyBusinessHistory} from './business-operations.mjs';
function pool(url){const p=new Pool({connectionString:url,max:1,connectionTimeoutMillis:10000,query_timeout:30000});p.on('error',()=>{});return p;}
export async function provisionPreviewBusiness(config){
  const admin=pool(config.ownerUrl);
  try{
    await admin.query('SELECT pg_advisory_lock(734010)');
    await admin.query('BEGIN');
    try{
      for(const value of [config.runtimeUrl,config.migrationUrl]){
        const role=new URL(value),existing=await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role.username]);
        if(!existing.rowCount){const sql=await admin.query("SELECT format('CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',$1::text,$2::text) AS sql",[role.username,decodeURIComponent(role.password)]);await admin.query(sql.rows[0].sql);}
        await assertRole(admin,role.username);
      }
      const schema=await admin.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='business'");
      if(schema.rowCount&&schema.rows[0].owner!=='fm_business_migrator')throw new Error('Business schema ownership refused');
      if(!schema.rowCount){
        const role=await admin.query('SELECT current_user AS name');
        const grant=await admin.query("SELECT format('GRANT fm_business_migrator TO %I', $1::text) AS sql",[role.rows[0].name]);
        await admin.query(grant.rows[0].sql);
        await admin.query('CREATE SCHEMA business AUTHORIZATION fm_business_migrator');
      }
      await admin.query('REVOKE ALL ON SCHEMA business FROM PUBLIC');
      await admin.query('GRANT USAGE ON SCHEMA business TO fm_business_runtime');
      await admin.query('COMMIT');
    }catch(error){await admin.query('ROLLBACK');throw error;}
    for(const url of [config.runtimeUrl,config.migrationUrl]){const p=pool(url);try{await p.query('SELECT 1');}finally{await p.end();}}
    return {operation:'provision',database:config.database};
  }finally{await admin.query('SELECT pg_advisory_unlock(734010)').catch(()=>{});await admin.end();}
}
function prisma(){return new Promise((resolveResult,reject)=>{
  const child=spawn(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--config','prisma.preview.config.ts'],{cwd:resolve('apps/backend'),env:{...process.env,CHECKPOINT_DISABLE:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1'},stdio:['ignore','ignore','pipe'],timeout:120000});
  child.stderr.resume();child.on('error',()=>reject(new Error('Preview migration failed')));child.on('close',code=>code===0?resolveResult():reject(new Error('Preview migration failed')));
});}
export async function migratePreviewBusiness(config,apply){
  const migration=pool(config.migrationUrl);
  try{
    await migration.query('SELECT pg_advisory_lock(734010)');
    for(const name of ['fm_business_runtime','fm_business_migrator'])await assertRole(migration,name);
    const schema=await migration.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='business'");
    if(schema.rows[0]?.owner!=='fm_business_migrator')throw new Error('Business schema ownership refused');
    const before=await verifyBusinessHistory(migration);
    if(apply)await prisma();
    return {operation:apply?'migrate':'check',...(apply?await verifyBusinessHistory(migration):before)};
  }finally{await migration.query('SELECT pg_advisory_unlock(734010)').catch(()=>{});await migration.end();}
}
