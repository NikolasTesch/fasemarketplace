import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {provisionPreviewBusiness} from '../../../scripts/business-preview-operations.mjs';
test('provision uses isolated roles and schema on a disposable local PostgreSQL database',async()=>{
  const base=new URL(process.env.DATABASE_URL??'');
  if(base.hostname!=='postgres'||!/^\/fm_auth_test_/.test(base.pathname)||process.env.APP_ENV!=='local')throw new Error('Local recovery fixture required');
  const admin=new Pool({connectionString:base.href,max:1});const db='fm_business_test_preview_'+randomBytes(6).toString('hex');
  try{
    const existing=await admin.query("SELECT 1 FROM pg_roles WHERE rolname IN ('fm_business_runtime','fm_business_migrator')");
    if(existing.rowCount)throw new Error('Recovery fixture roles already exist; refusing to modify');
    await admin.query(`CREATE DATABASE "${db}"`);
    const owner=new URL(base);owner.pathname='/'+db;
    const runtime=new URL(owner);runtime.username='fm_business_runtime';runtime.password='synthetic_runtime_password';
    const migration=new URL(owner);migration.username='fm_business_migrator';migration.password='synthetic_migration_password';
    const config={database:db,ownerUrl:owner.href,runtimeUrl:runtime.href,migrationUrl:migration.href};
    assert.equal((await provisionPreviewBusiness(config)).operation,'provision');
    assert.equal((await provisionPreviewBusiness(config)).operation,'provision');
    const limited=new Pool({connectionString:runtime.href});try{
      const result=await limited.query("SELECT has_schema_privilege(current_user,'business','USAGE') AS usage,has_schema_privilege(current_user,'business','CREATE') AS create");
      assert.deepEqual(result.rows[0],{usage:true,create:false});
    }finally{await limited.end();}
  }finally{await admin.end();}
});
