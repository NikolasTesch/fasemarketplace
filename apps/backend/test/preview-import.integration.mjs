import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Pool} from 'pg';
import {importSynthetic} from '../../../scripts/business-preview-import.mjs';
test('synthetic import is transactional and refuses to overwrite populated inventory',async()=>{
  const base=new URL(process.env.DATABASE_URL??''),db=process.env.PREVIEW_TEST_DATABASE??'';
  if(base.hostname!=='postgres'||!/^fm_business_test_preview_[a-f0-9]+$/.test(db)||process.env.APP_ENV!=='local')throw new Error('Disposable local fixture required');
  base.pathname='/'+db;base.username='fm_business_migrator';base.password='synthetic_migration_password';
  const pool=new Pool({connectionString:base.href,max:1}),client=await pool.connect();
  try{
    if((await client.query("SELECT to_regclass('business.catalog_product') AS name")).rows[0].name)throw new Error('Fixture already used');
    await client.query('SET search_path=business');
    const directory='apps/backend/prisma/migrations';
    for(const entry of (await readdir(directory,{withFileTypes:true})).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))await client.query(await readFile(`${directory}/${entry.name}/migration.sql`,'utf8'));
  }finally{client.release();await pool.end();}
  base.username='fm_business_runtime';base.password='synthetic_runtime_password';
  const data=JSON.parse(await readFile('/fixture/synthetic-local-20261028.json','utf8')),config={runtimeUrl:base.href};
  assert.deepEqual(await importSynthetic(config,data),{products:10,variants:23,movements:23,units:500});
  await assert.rejects(()=>importSynthetic(config,data),/Target is not empty/);
});
