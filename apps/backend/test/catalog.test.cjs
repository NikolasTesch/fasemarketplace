const {test} = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../dist/catalog/validation.js');
const {spawnSync} = require('node:child_process');
const {resolve} = require('node:path');
const local = {CATALOG_ENABLED:'true',BUSINESS_ENABLED:'true',AUTH_ENABLED:'true',APP_ENV:'local',MARKETPLACE_MODE:'mock',DATABASE_PROVIDER:'local',
  DATABASE_URL:'postgresql://owner:owner-example@postgres:5432/fasemarketplace',
  AUTH_DATABASE_URL:'postgresql://fm_auth_runtime:auth-example@postgres:5432/fasemarketplace',
  AUTH_SECRET:'s'.repeat(64),AUTH_ORIGIN:'http://127.0.0.1:4873',REDIS_URL:'redis://redis:6379',
  BUSINESS_LOCAL_DATABASE:'fasemarketplace',BUSINESS_DATABASE_URL:'postgresql://fm_business_runtime:business-example@postgres:5432/fasemarketplace?schema=business'};
const priced = (body) => ({description:'Descrição',salePrice:'10.00',cost:'5.00',...body});

test('catalog is explicit local opt-in with auth and business in the same database', async () => {
  const {readCatalogConfig} = await import('../dist/catalog/config.js');
  assert.equal(readCatalogConfig({}), false); assert.equal(readCatalogConfig(local),true);
  for(const change of [{CATALOG_ENABLED:'yes'},{AUTH_ENABLED:'false'},{BUSINESS_ENABLED:'false'},
    {APP_ENV:'production'},{AUTH_CONTEXT:'preview'},{DATABASE_PROVIDER:'neon'},
    {BUSINESS_DATABASE_URL:local.BUSINESS_DATABASE_URL.replace('/fasemarketplace','/fm_business_test_other'),BUSINESS_LOCAL_DATABASE:'fm_business_test_other'}])
    assert.throws(()=>readCatalogConfig({...local,...change}), /local/);
});
test('product and variant contracts normalize names/SKUs, enforce bounds and reject mass assignment', async()=>{
  const {productInput,variantInput,productEdit,variantEdit} = await load();
  assert.deepEqual(productInput(priced({name:' Camiseta ',description:'Produto',variants:[{name:' Preta / M ',sku:' cam-preta-m '}]})),
    {name:'Camiseta',description:'Produto',iconName:'sports_soccer',salePrice:'10.00',cost:'5.00',variants:[{name:'Preta / M',sku:'CAM-PRETA-M'}]});
  assert.equal(productInput(priced({name:'Bola',iconName:'sports_tennis',variants:[{name:'Padrão',sku:'BOLA-1'}]})).iconName,'sports_tennis');
  assert.throws(()=>productInput(priced({name:'Bola',iconName:'javascript:alert(1)',variants:[{name:'Padrão',sku:'BOLA-2'}]})));
  for(const sku of ['', 'A B','Ç-01','_ABC','A\u200bB','x'.repeat(65)])assert.throws(()=>variantInput({name:'Padrão',sku}));
  for(const body of [priced({name:'',variants:[{name:'X',sku:'A'}]}), priced({name:'X',variants:[]}),
    priced({name:'X',variants:Array.from({length:21},(_,i)=>({name:'X',sku:'A'+i}))}),
    priced({name:'X',variants:[{name:'X',sku:'A'}],createdBy:'spoof'}),
    priced({name:'X',description:'x'.repeat(2001),variants:[{name:'X',sku:'A'}]})])assert.throws(()=>productInput(body));
  assert.throws(()=>productInput(priced({name:'X',variants:[{name:'A',sku:'abc'},{name:'B',sku:' ABC '}]})),e=>e.getStatus()===409);
  assert.throws(()=>productInput(priced({name:'Sem preço',salePrice:'1.005',variants:[{name:'Padrão',sku:'NO-PRICE'}]})));
  assert.throws(()=>productInput({name:'Sem descrição',salePrice:'1',cost:'0',variants:[{name:'Padrão',sku:'NO-DESC'}]}));
  assert.deepEqual(productEdit({name:'X',description:'Y',salePrice:'2',cost:'1.5',active:false,version:2}),{name:'X',description:'Y',salePrice:'2.00',cost:'1.50',active:false,version:2});
  assert.deepEqual(productEdit({name:'X',description:'Y',iconName:'apparel',salePrice:'2',cost:'1.5',active:false,version:2}),{name:'X',description:'Y',iconName:'apparel',salePrice:'2.00',cost:'1.50',active:false,version:2});
  assert.deepEqual(variantEdit({name:'M',active:true,version:1}),{name:'M',active:true,version:1});
  for(const body of [{name:'M',active:true,version:1,sku:'CHANGE'},{name:'M',active:'false',version:1},{name:'M',active:true,version:0},
    {name:'M',active:true,version:1,productId:'other'}])assert.throws(()=>variantEdit(body));
  assert.throws(()=>productEdit({name:'X',description:'',salePrice:'0',cost:'0',active:true,version:1.5}));
});
test('query and IDs are bounded without accepting extra query fields',async()=>{
  const {catalogQuery,catalogId}=await load();
  assert.deepEqual(catalogQuery({}),{offset:0,search:'',status:'all'});
  assert.deepEqual(catalogQuery({offset:'20',search:' SKU ',status:'inactive'}),{offset:20,search:'SKU',status:'inactive'});
  for(const q of [{offset:'-1'},{offset:'1.5'},{offset:'NaN'},{offset:['0','20']},{search:'x'.repeat(81)},{status:'unknown'},{limit:'100000'}])
    assert.throws(()=>catalogQuery(q));
  assert.equal(catalogId('b21924a9-8a12-4ad6-a03e-05855b453683'),'b21924a9-8a12-4ad6-a03e-05855b453683');
  assert.throws(()=>catalogId('../unsafe')); assert.throws(()=>catalogId('not-a-uuid'));
});
test('fixture tool refuses non-local context before reading credentials or connecting',()=>{
  const r=spawnSync(process.execPath,[resolve(__dirname,'../../../scripts/catalog-fixtures.mjs'),'prepare','--stdin'],
    {env:{...process.env,APP_ENV:'production'},input:'{}',encoding:'utf8',timeout:5000});
  assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/Catalog fixtures refused/);
});
