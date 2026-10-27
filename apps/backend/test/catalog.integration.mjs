import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {NestFactory, HttpAdapterHost} from '@nestjs/core';
import {readBusinessMaintenanceConfig} from '../dist/persistence/config.js';
import {runBusinessMaintenance} from '../../../scripts/business-operations.mjs';
import {createAccessBackup,restoreAccessBackup} from '../../../scripts/auth-backup-operations.mjs';
import {readBackupKey} from '../../../scripts/auth-backup-format.mjs';

test('catalog HTTP with real auth and PostgreSQL, only a new synthetic database',async t=>{
  const base=new URL(process.env.DATABASE_URL);
  assert.equal(base.hostname,'postgres'); assert.equal(base.pathname,'/fm_auth_test_business');
  const suffix=randomBytes(6).toString('hex'), database='fm_auth_test_business_catalog_'+suffix, shadow='fm_business_shadow_catalog_'+suffix;
  const setup=new Pool({connectionString:base.href});
  await setup.query(`CREATE DATABASE "${database}"`); await setup.query(`CREATE DATABASE "${shadow}"`);
  const url=(db,user,password,business=false)=>{const u=new URL(base);u.pathname='/'+db;u.username=user;u.password=password;u.search=business?'?schema=business':'';return u.href;};
  const ownerUrl=url(database,base.username,decodeURIComponent(base.password));
  const env={...process.env,DATABASE_URL:ownerUrl,AUTH_ENABLED:'true',CATALOG_ENABLED:'true',BUSINESS_ENABLED:'true',
    AUTH_DATABASE_URL:url(database,'fm_auth_runtime',process.env.BUSINESS_TEST_RUNTIME_PASSWORD),
    BUSINESS_LOCAL_DATABASE:database,BUSINESS_DATABASE_URL:url(database,'fm_business_runtime',process.env.BUSINESS_TEST_RUNTIME_PASSWORD,true),
    BUSINESS_MIGRATION_DATABASE_URL:url(database,'fm_business_migrator',process.env.BUSINESS_TEST_MIGRATION_PASSWORD,true),
    BUSINESS_SHADOW_DATABASE_URL:url(shadow,'fm_business_migrator',process.env.BUSINESS_TEST_MIGRATION_PASSWORD,true)};
  const migrated=spawnSync(process.execPath,['scripts/auth-local.mjs','migrate'],{env,encoding:'utf8',timeout:60000});
  assert.equal(migrated.status,0,'Synthetic auth migration failed');
  const config=readBusinessMaintenanceConfig(env);
  await runBusinessMaintenance({action:'provision',config,adminUrl:ownerUrl});
  await runBusinessMaintenance({action:'migrate',config});
  Object.assign(process.env,env);
  const {AppModule}=await import('../dist/app.module.js');
  const {LocalAccessService}=await import('../dist/access/service.js');
  const {TelemetryExceptionFilter}=await import('../dist/api-exception-filter.js');
  const app=await NestFactory.create(AppModule,{logger:false,bodyParser:false});
  app.useBodyParser('json',{limit:'8kb'});app.useGlobalFilters(new TelemetryExceptionFilter(app.get(HttpAdapterHost),{exception(){}}));
  const owner=new Pool({connectionString:ownerUrl}), runtime=new Pool({connectionString:config.runtimeUrl});
  let restored;
  try{
    await app.listen(0,'0.0.0.0');const root='http://127.0.0.1:'+app.getHttpServer().address().port;
    const get=(query='',cookie='')=>fetch(root+'/catalog/products'+query,{headers:{cookie}});
    const post=(path,body,cookie='',origin=env.AUTH_ORIGIN)=>fetch(root+path,{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await get()).status,401,'Catalog must not expose anonymous data');
    const access=app.get(LocalAccessService),password='Synthetic-Catalog-Access-2026!';
    const add=async(email,role,pending=false)=>(await access.auth.api.createUser({body:{name:'Catalog fixture',email,password,role,data:{mustChangePassword:pending}}})).user;
    const admin=await add('catalog-admin@example.test','admin'),user=await add('catalog-user@example.test','user');await add('catalog-pending@example.test','user',true);
    const login=async email=>{const r=await post('/access/login',{email,password});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');};
    const adminCookie=await login('catalog-admin@example.test'),userCookie=await login('catalog-user@example.test'),pendingCookie=await login('catalog-pending@example.test');
    let product;
    const fresh=async()=>{const r=await get('',adminCookie);assert.equal(r.status,200);return (await r.json()).items.find(p=>p.id===product.id);};
    await t.test('auth/pending/origin and read-only profile are enforced server-side',async()=>{
      assert.equal((await get('',pendingCookie)).status,403);
      assert.equal((await get('',userCookie)).status,200);
      assert.equal((await get('',adminCookie)).headers.get('cache-control'),'no-store');
      assert.equal((await post('/catalog/products',{name:'X',variants:[{name:'Padrão',sku:'X'}]},userCookie)).status,403);
      assert.equal((await post('/catalog/products',{},adminCookie,'https://foreign.example')).status,403);
    });
    await t.test('atomic product/variants creation returns normalized SKUs and persists actor',async()=>{
      const r=await post('/catalog/products',{name:' Camiseta ',description:'Treino',variants:[{name:'Preta / M',sku:' tee-m '},{name:'Preta / G',sku:'tee-g'}]},adminCookie);
      assert.equal(r.status,201);product=await r.json();assert.equal(product.variants.length,2);assert.equal(product.variants[0].sku.startsWith('TEE-'),true);
      assert.equal(product.createdBy,undefined);assert.equal((await owner.query('SELECT created_by FROM business.catalog_product WHERE id=$1',[product.id])).rows[0].created_by,admin.id);
      assert.equal((await fresh()).name,'Camiseta');
    });
    await t.test('duplicates including concurrent requests and partial failure never duplicate or orphan',async()=>{
      const before=(await owner.query('SELECT count(*) FROM business.catalog_product')).rows[0].count;
      assert.equal((await post('/catalog/products',{name:'Rollback',variants:[{name:'A',sku:'ROLLBACK-A'},{name:'B',sku:'tee-m'}]},adminCookie)).status,409);
      assert.equal((await owner.query('SELECT count(*) FROM business.catalog_product')).rows[0].count,before);
      assert.equal((await owner.query("SELECT count(*) FROM business.catalog_variant WHERE sku='ROLLBACK-A'")).rows[0].count,'0');
      const body={name:'Concorrente',variants:[{name:'Padrão',sku:'CONCURRENT'}]};
      const codes=await Promise.all([post('/catalog/products',body,adminCookie),post('/catalog/products',body,adminCookie)]);
      assert.deepEqual(codes.map(r=>r.status).sort(),[201,409]);
    });
    await t.test('strict body/query contracts, immutable SKU and optimistic version conflicts',async()=>{
      assert.equal((await post('/catalog/products',{name:'X',variants:[{name:'X',sku:'X'}],createdBy:'spoof'},adminCookie)).status,400);
      assert.equal((await get('?offset=0&offset=20',adminCookie)).status,400);assert.equal((await get('?limit=99999',adminCookie)).status,400);
      const p=await fresh(),body={name:'Camiseta editada',description:'Nova',active:true,version:p.version};
      const edits=await Promise.all([post('/catalog/products/'+p.id,body,adminCookie),post('/catalog/products/'+p.id,body,adminCookie)]);
      assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
      assert.equal((await post('/catalog/variants/'+p.variants[0].id,{name:'X',active:true,version:1,sku:'CHANGED'},adminCookie)).status,400);
      assert.equal((await post('/catalog/products/'+p.id,body,userCookie)).status,403);
    });
    await t.test('variant addition and effective activation preserve individually inactive variants',async()=>{
      let p=await fresh();assert.equal((await post('/catalog/products/'+p.id+'/variants',{name:'Azul / M',sku:'TEE-AZ-M',version:p.version},adminCookie)).status,201);
      p=await fresh();const v=p.variants[0];assert.equal((await post('/catalog/variants/'+v.id,{name:v.name,active:false,version:v.version},adminCookie)).status,200);
      p=await fresh();assert.equal((await post('/catalog/products/'+p.id,{name:p.name,description:p.description,active:false,version:p.version},adminCookie)).status,200);
      p=await fresh();assert.equal(p.variants.every(v=>v.effectiveActive===false),true);
      assert.equal((await post('/catalog/products',{name:'Cannot reuse',variants:[{name:'X',sku:v.sku}]},adminCookie)).status,409);
      assert.equal((await post('/catalog/products/'+p.id,{name:p.name,description:p.description,active:true,version:p.version},adminCookie)).status,200);
      assert.equal((await fresh()).variants.find(x=>x.id===v.id).active,false);
    });
    await t.test('runtime cannot change identities/SKU or delete facts; SQL uniqueness also enforced',async()=>{
      const p=await fresh(),v=p.variants[0];
      for(const sql of ['UPDATE business.catalog_variant SET sku=sku WHERE id=$1','UPDATE business.catalog_variant SET product_id=product_id WHERE id=$1',
        'UPDATE business.catalog_variant SET created_by=created_by WHERE id=$1','DELETE FROM business.catalog_variant WHERE id=$1'])
        await assert.rejects(runtime.query(sql,[v.id]),e=>e.code==='42501');
      await assert.rejects(runtime.query('SELECT * FROM public.auth_user'),e=>e.code==='42501');
    });
    await t.test('limit is transactional; pagination/search are bounded and literal',async()=>{
      const response=await post('/catalog/products',{name:'100% algodão',variants:[{name:'Padrão',sku:'LIMIT-0'}]},adminCookie),p=await response.json();assert.equal(response.status,201);
      await owner.query(`INSERT INTO business.catalog_variant(id,product_id,name,sku,updated_at,created_by,updated_by)
        SELECT gen_random_uuid(),$1,'Fixture','LIMIT-'||i,now(),$2,$2 FROM generate_series(1,49) i`,[p.id,admin.id]);
      assert.equal((await post('/catalog/products/'+p.id+'/variants',{name:'Too many',sku:'LIMIT-50',version:p.version},adminCookie)).status,400);
      assert.equal((await owner.query('SELECT version FROM business.catalog_product WHERE id=$1',[p.id])).rows[0].version,p.version);
      const found=await (await get('?search=%25',adminCookie)).json();assert.equal(found.items.length,1);assert.equal(found.items[0].id,p.id);
      assert.deepEqual((await (await get('?offset=100000',adminCookie)).json()).items,[]);
    });
    await t.test('blocked and revoked accounts cannot read or write existing data',async()=>{
      await owner.query('UPDATE auth_user SET banned=true WHERE id=$1',[user.id]);assert.equal((await get('',userCookie)).status,401);
      await owner.query('DELETE FROM auth_session WHERE "userId"=$1',[admin.id]);assert.equal((await get('',adminCookie)).status,401);
      assert.equal((await post('/catalog/products',{},adminCookie)).status,401);
    });
    await t.test('encrypted backup/restore retains catalog and constraints without restoring sessions',async()=>{
      const dir='/tmp/catalog-backup-'+suffix;await mkdir(dir);const file=dir+'/catalog.fmbackup',key=readBackupKey();
      const created=await createAccessBackup({sourceUrl:ownerUrl,context:'local-test',file,key});assert.equal(created.tables,8);
      const copy=await restoreAccessBackup({baseUrl:base.href,file,key});const copyUrl=new URL(base);copyUrl.pathname='/'+copy.database;restored=new Pool({connectionString:copyUrl.href});
      assert.equal((await restored.query('SELECT count(*) FROM business.catalog_variant')).rows[0].count,(await owner.query('SELECT count(*) FROM business.catalog_variant')).rows[0].count);
      assert.equal((await restored.query('SELECT count(*) FROM auth_session')).rows[0].count,'0');
      assert.equal((await restored.query("SELECT count(*) FROM pg_constraint WHERE conname='catalog_variant_product_id_fkey'")).rows[0].count,'1');
    });
  } finally {await Promise.all([owner.end(),runtime.end(),setup.end(),restored?.end()]);await app.close();}
});
