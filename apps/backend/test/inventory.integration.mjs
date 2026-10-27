import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {NestFactory,HttpAdapterHost} from '@nestjs/core';
import {readBusinessMaintenanceConfig} from '../dist/persistence/config.js';
import {runBusinessMaintenance} from '../../../scripts/business-operations.mjs';
import {seedOpeningInventory} from '../../../scripts/inventory-seed-local.mjs';
import {BusinessPersistence} from '../dist/persistence/module.js';

test('inventory API enforces auth, ledger invariants and atomic balances in a synthetic database',async t=>{
  const base=new URL(process.env.DATABASE_URL);
  assert.equal(base.hostname,'postgres'); assert.equal(base.pathname,'/fm_auth_test_business');
  const suffix=randomBytes(6).toString('hex'),database='fm_auth_test_business_inventory_'+suffix,shadow='fm_business_shadow_inventory_'+suffix;
  const setup=new Pool({connectionString:base.href});await setup.query(`CREATE DATABASE "${database}"`);await setup.query(`CREATE DATABASE "${shadow}"`);
  const url=(db,user,password,business=false)=>{const u=new URL(base);u.pathname='/'+db;u.username=user;u.password=password;u.search=business?'?schema=business':'';return u.href;};
  const ownerUrl=url(database,base.username,decodeURIComponent(base.password));
  const env={...process.env,DATABASE_URL:ownerUrl,AUTH_ENABLED:'true',CATALOG_ENABLED:'true',INVENTORY_ENABLED:'true',BUSINESS_ENABLED:'true',
    AUTH_DATABASE_URL:url(database,'fm_auth_runtime',process.env.BUSINESS_TEST_RUNTIME_PASSWORD),
    BUSINESS_LOCAL_DATABASE:database,BUSINESS_DATABASE_URL:url(database,'fm_business_runtime',process.env.BUSINESS_TEST_RUNTIME_PASSWORD,true),
    BUSINESS_MIGRATION_DATABASE_URL:url(database,'fm_business_migrator',process.env.BUSINESS_TEST_MIGRATION_PASSWORD,true),
    BUSINESS_SHADOW_DATABASE_URL:url(shadow,'fm_business_migrator',process.env.BUSINESS_TEST_MIGRATION_PASSWORD,true)};
  const migrated=spawnSync(process.execPath,['scripts/auth-local.mjs','migrate'],{env,encoding:'utf8',timeout:60000});assert.equal(migrated.status,0,'Synthetic auth migration failed');
  const config=readBusinessMaintenanceConfig(env);await runBusinessMaintenance({action:'provision',config,adminUrl:ownerUrl});await runBusinessMaintenance({action:'migrate',config});
  Object.assign(process.env,env);
  const {AppModule}=await import('../dist/app.module.js');const {LocalAccessService}=await import('../dist/access/service.js');const {TelemetryExceptionFilter}=await import('../dist/api-exception-filter.js');
  const app=await NestFactory.create(AppModule,{logger:false,bodyParser:false});app.useBodyParser('json',{limit:'8kb'});app.useGlobalFilters(new TelemetryExceptionFilter(app.get(HttpAdapterHost),{exception(){}}));
  const owner=new Pool({connectionString:ownerUrl});
  try {
    await app.listen(0,'0.0.0.0');const root='http://127.0.0.1:'+app.getHttpServer().address().port;
    const get=(path,cookie='')=>fetch(root+path,{headers:{cookie}});
    const post=(path,body,cookie='',origin=env.AUTH_ORIGIN)=>fetch(root+path,{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify(body)});
    const access=app.get(LocalAccessService),password='Synthetic-Inventory-Access-2026!';
    const add=async(email,role,pending=false)=>(await access.auth.api.createUser({body:{name:'Inventory fixture',email,password,role,data:{mustChangePassword:pending}}})).user;
    await add('inventory-admin@example.test','admin');const user=await add('inventory-user@example.test','user');await add('inventory-pending@example.test','user',true);
    const login=async email=>{const r=await post('/access/login',{email,password});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');};
    const adminCookie=await login('inventory-admin@example.test'),userCookie=await login('inventory-user@example.test'),pendingCookie=await login('inventory-pending@example.test');
    let variantId;
    await t.test('reads are authenticated, uncached, paginated and free of anonymous writes',async()=>{
      assert.equal((await get('/inventory/stock')).status,401);assert.equal((await get('/inventory/stock',pendingCookie)).status,403);
      const response=await get('/inventory/stock',userCookie);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      assert.deepEqual((await response.json()).items,[]);
      assert.equal((await get('/inventory/stock?offset=0&offset=20',adminCookie)).status,400);
    });
    await t.test('movement actors are bound to session and writes require same-origin',async()=>{
      const created=await post('/catalog/products',{name:'Inventory fixture product',variants:[{name:'Default',sku:'INVENTORY-TEST-1'}]},adminCookie);assert.equal(created.status,201);variantId=(await created.json()).variants[0].id;
      const movement={variantId,type:'INBOUND',destinationBucket:'PHYSICAL_RESERVE',quantity:10,idempotencyKey:'inventory-inbound-'+suffix,actor:'spoof'};
      assert.equal((await post('/inventory/movements',movement,adminCookie)).status,400);
      delete movement.actor;assert.equal((await post('/inventory/movements',movement,userCookie,'https://foreign.example')).status,403);
      assert.equal((await post('/inventory/movements',movement,userCookie)).status,201);
      assert.equal((await owner.query('SELECT created_by FROM business.stock_movement WHERE idempotency_key=$1',[movement.idempotencyKey])).rows[0].created_by,user.id);
    });
    await t.test('inbound, transfer and outbound persist with idempotency and prohibit negative balance',async()=>{
      const key='inventory-transfer-'+suffix,transfer={variantId,type:'TRANSFER',sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHOPEE',quantity:4,idempotencyKey:key};
      assert.equal((await post('/inventory/movements',transfer,userCookie)).status,201);
      assert.equal((await post('/inventory/movements',transfer,userCookie)).status,409);
      const balances=await (await get('/inventory/stock',userCookie)).json();const row=balances.items.find(x=>x.variantId===variantId);
      assert.equal(row.physicalReserve,6);assert.equal(row.shopee,4);assert.equal(row.total,10);
      assert.equal((await post('/inventory/movements',{variantId,type:'ADJUSTMENT',destinationBucket:'PHYSICAL_RESERVE',quantity:2,reason:'Contagem física',idempotencyKey:'inventory-adjust-in-'+suffix},userCookie)).status,201);
      assert.equal((await post('/inventory/movements',{variantId,type:'ADJUSTMENT',sourceBucket:'PHYSICAL_RESERVE',quantity:2,reason:'Correção de contagem',idempotencyKey:'inventory-adjust-out-'+suffix},userCookie)).status,201);
      assert.equal((await post('/inventory/movements',{...transfer,idempotencyKey:'inventory-negative-'+suffix,quantity:7},userCookie)).status,409);
      assert.equal((await get('/inventory/movements?variantId='+variantId,userCookie)).status,200);
    });
    await t.test('minimum and mode are admin-only; incompatible stock blocks mode changes atomically',async()=>{
      assert.equal((await (await get('/inventory/settings',adminCookie)).json()).mode,'SEPARATE');
      assert.equal((await post('/inventory/variants/'+variantId+'/minimum',{minimumQuantity:5},userCookie)).status,403);
      assert.equal((await post('/inventory/settings/mode',{mode:'SHARED',version:1},userCookie)).status,403);
      assert.equal((await owner.query("SELECT sum(quantity) FROM business.stock_movement WHERE destination_bucket='SHOPEE'")).rows[0].sum,'4');
      const before=(await owner.query('SELECT count(*) FROM business.stock_movement')).rows[0].count;
      const beforeBalances=await owner.query("SELECT bucket, SUM(quantity)::int quantity FROM (SELECT destination_bucket bucket,quantity FROM business.stock_movement WHERE destination_bucket IS NOT NULL UNION ALL SELECT source_bucket bucket,-quantity FROM business.stock_movement WHERE source_bucket IS NOT NULL) x GROUP BY bucket");assert.equal(beforeBalances.rows.find(x=>x.bucket==='SHOPEE')?.quantity,4);
      const blocked=await post('/inventory/settings/mode',{mode:'SHARED',version:1},adminCookie);assert.equal(blocked.status,409,await blocked.text());
      assert.equal((await owner.query('SELECT count(*) FROM business.stock_movement')).rows[0].count,before);
      const min=await post('/inventory/variants/'+variantId+'/minimum',{minimumQuantity:5},adminCookie);assert.equal(min.status,200);
      assert.equal((await post('/inventory/variants/'+variantId+'/minimum',{minimumQuantity:4,version:1},adminCookie)).status,200);
      assert.equal((await post('/inventory/variants/'+variantId+'/minimum',{minimumQuantity:3,version:1},adminCookie)).status,409);
      assert.equal((await post('/inventory/movements',{variantId,type:'TRANSFER',sourceBucket:'SHOPEE',destinationBucket:'PHYSICAL_RESERVE',quantity:4,idempotencyKey:'inventory-return-'+suffix},adminCookie)).status,201);
      assert.equal((await post('/inventory/settings/mode',{mode:'SHARED',version:1},adminCookie)).status,200);
      assert.equal((await post('/inventory/movements',{variantId,type:'TRANSFER',sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHARED_CHANNEL',quantity:2,idempotencyKey:'inventory-shared-'+suffix},adminCookie)).status,201);
      const common=(await (await get('/inventory/stock?variantId='+variantId,adminCookie)).json()).items[0];assert.equal(common.sharedChannel,2);assert.equal(common.shopee,null);assert.equal(common.mercadoLivre,null);assert.equal(common.total,10);
      assert.equal((await post('/inventory/movements',{variantId,type:'TRANSFER',sourceBucket:'SHARED_CHANNEL',destinationBucket:'PHYSICAL_RESERVE',quantity:2,idempotencyKey:'inventory-shared-return-'+suffix},adminCookie)).status,201);
      assert.equal((await get('/inventory/settings',userCookie)).status,200);
    });
    await t.test('concurrent debits serialize and inactive variants reject new movements',async()=>{
      const addStock=await post('/inventory/movements',{variantId,type:'INBOUND',destinationBucket:'PHYSICAL_RESERVE',quantity:10,idempotencyKey:'inventory-inbound2-'+suffix},adminCookie);assert.equal(addStock.status,201);
      const body={variantId,type:'OUTBOUND',sourceBucket:'PHYSICAL_RESERVE',quantity:11,reason:'race test',idempotencyKey:'inventory-race-'+suffix};
      const races=await Promise.all([post('/inventory/movements',body,userCookie),post('/inventory/movements',{...body,idempotencyKey:body.idempotencyKey+'-2'},userCookie)]);
      assert.deepEqual(races.map(r=>r.status).sort(),[201,409]);
      const result=await (await get('/inventory/stock',adminCookie)).json(),row=result.items.find(x=>x.variantId===variantId);assert.equal(row.total,9);
      const product=(await (await get('/catalog/products',adminCookie)).json()).items.find(p=>p.variants.some(v=>v.id===variantId));
      assert.equal((await post('/catalog/variants/'+variantId,{name:'Default',active:false,version:1},adminCookie)).status,200);
      assert.equal((await post('/inventory/movements',{variantId,type:'INBOUND',destinationBucket:'PHYSICAL_RESERVE',quantity:1,idempotencyKey:'inventory-inactive-'+suffix},adminCookie)).status,409);
      assert.ok(product);
    });
    await t.test('opening seed is sorted, varied, minimum-aware and refuses a second batch',async()=>{
      const created=await post('/catalog/products',{name:'Seed fixture product',variants:[{name:'B',sku:'INV-SEED-B'},{name:'A',sku:'INV-SEED-A'}]},adminCookie);assert.equal(created.status,201);
      const persistence=app.get(BusinessPersistence),result=await seedOpeningInventory(persistence.client);
      assert.deepEqual(result,{seededVariants:2,totalOpeningUnits:57,minimums:[5,7]});
      const records=(await owner.query(`SELECT v.sku,m.id,m.quantity,p.minimum_quantity,m.created_by FROM business.catalog_variant v
        JOIN business.stock_movement m ON m.variant_id=v.id JOIN business.variant_stock_policy p ON p.variant_id=v.id
        WHERE v.sku LIKE 'INV-SEED-%' ORDER BY v.sku`)).rows;
      assert.deepEqual(records.map(row=>[row.sku,row.quantity,row.minimum_quantity,row.created_by]),[['INV-SEED-A',25,5,'system:local-seed'],['INV-SEED-B',32,7,'system:local-seed']]);
      assert.equal(new Set(records.map(row=>row.id)).size,2);
      await assert.rejects(seedOpeningInventory(persistence.client),/already exists/);
      assert.equal((await owner.query("SELECT count(*) FROM business.stock_movement WHERE created_by='system:local-seed'")).rows[0].count,'2');
    });
    await t.test('user cannot alter mode/minimum and runtime cannot mutate ledger',async()=>{
      const runtime=new Pool({connectionString:config.runtimeUrl});try {
        await assert.rejects(runtime.query('UPDATE business.stock_movement SET reason=reason'),e=>e.code==='42501');
        await assert.rejects(runtime.query('DELETE FROM business.stock_movement'),e=>e.code==='42501');
        await assert.rejects(runtime.query('SELECT * FROM public.auth_user'),e=>e.code==='42501');
      } finally {await runtime.end();}
      await owner.query('UPDATE auth_user SET banned=true WHERE email=$1',['inventory-user@example.test']);assert.equal((await get('/inventory/stock',userCookie)).status,401);
    });
  } finally {await owner.end();await app.close();await setup.end();}
});
