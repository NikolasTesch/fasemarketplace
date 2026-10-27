const {test} = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../dist/inventory/validation.js');
const variantId = 'b21924a9-8a12-4ad6-a03e-05855b453683';
const key = 'inventory-request-20261027-001';

test('inventory settings and minimum contracts reject invalid values and mass assignment', async () => {
  const {inventoryModeInput, stockPolicyInput,inventoryQuery} = await load();
  assert.deepEqual(inventoryQuery({offset:'0',search:''}),{offset:0,search:'',variantId:undefined});
  assert.deepEqual(inventoryModeInput({mode:'SHARED',version:2}), {mode:'SHARED',version:2});
  assert.deepEqual(stockPolicyInput({minimumQuantity:5,version:1}), {minimumQuantity:5,version:1});
  for (const body of [{mode:'OTHER',version:1},{mode:'SEPARATE',version:0},{mode:'SHARED',version:1,updatedBy:'spoof'}])
    assert.throws(()=>inventoryModeInput(body), error=>error.getStatus()===400);
  for (const body of [{minimumQuantity:-1,version:1},{minimumQuantity:1.2,version:1},
    {minimumQuantity:1,version:1,variantId},{minimumQuantity:1,version:0}])
    assert.throws(()=>stockPolicyInput(body), error=>error.getStatus()===400);
});

test('inventory movement contracts enforce bucket, mode, quantity, reason and idempotency rules', async () => {
  const {inventoryMovementInput} = await load();
  const transfer = {variantId,type:'TRANSFER',sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHOPEE',quantity:4,reason:'Reserva para canal',idempotencyKey:key};
  assert.deepEqual(inventoryMovementInput(transfer,'SEPARATE'), {variantId,movementType:'TRANSFER',sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHOPEE',quantity:4,reason:'Reserva para canal',idempotencyKey:key});
  const betweenChannels = {...transfer,sourceBucket:'SHOPEE',destinationBucket:'MERCADO_LIVRE'};
  assert.deepEqual(inventoryMovementInput(betweenChannels,'SEPARATE'), {variantId,movementType:'TRANSFER',sourceBucket:'SHOPEE',destinationBucket:'MERCADO_LIVRE',quantity:4,reason:'Reserva para canal',idempotencyKey:key});
  const shared = {...transfer,destinationBucket:'SHARED_CHANNEL'};
  assert.deepEqual(inventoryMovementInput(shared,'SHARED'), {variantId,movementType:'TRANSFER',sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHARED_CHANNEL',quantity:4,reason:'Reserva para canal',idempotencyKey:key});
  for (const [body,mode] of [
    [{...transfer,type:'OPENING'},'SEPARATE'],
    [{...transfer,destinationBucket:'SHARED_CHANNEL'},'SEPARATE'],
    [{...transfer,destinationBucket:'MERCADO_LIVRE'},'SHARED'],
    [{...transfer,quantity:0},'SEPARATE'],
    [{...transfer,quantity:1.5},'SEPARATE'],
    [{...transfer,sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHARED_CHANNEL'},'SEPARATE'],
    [{...transfer,type:'OUTBOUND',destinationBucket:undefined,reason:''},'SEPARATE'],
    [{...transfer,type:'INBOUND',sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHOPEE'},'SEPARATE'],
    [{...transfer,type:'ADJUSTMENT',destinationBucket:undefined,reason:''},'SEPARATE'],
    [{...transfer,idempotencyKey:''},'SEPARATE'],
    [{...transfer,actor:'spoof'},'SEPARATE'],
  ]) assert.throws(()=>inventoryMovementInput(body,mode), error=>error.getStatus()===400);
});

test('inventory balances conserve units and shared channel stock is counted once', async () => {
  const {bucketBalances, projectStockBuckets, isBelowMinimum} = await load();
  const movements = [
    {sourceBucket:null,destinationBucket:'PHYSICAL_RESERVE',quantity:100},
    {sourceBucket:'PHYSICAL_RESERVE',destinationBucket:'SHOPEE',quantity:20},
    {sourceBucket:'SHOPEE',destinationBucket:null,quantity:3},
  ];
  const separate = projectStockBuckets(bucketBalances(movements),'SEPARATE');
  assert.deepEqual(separate,{physicalReserve:80,sharedChannel:null,shopee:17,mercadoLivre:0,total:97});
  const shared = projectStockBuckets({PHYSICAL_RESERVE:50,SHARED_CHANNEL:40,SHOPEE:0,MERCADO_LIVRE:0},'SHARED');
  assert.deepEqual(shared,{physicalReserve:50,sharedChannel:40,shopee:null,mercadoLivre:null,total:90});
  assert.equal(isBelowMinimum(5,5),true);
  assert.equal(isBelowMinimum(6,5),false);
  assert.equal(isBelowMinimum(0,null),null);
});

test('inventory configuration is disabled by default and refuses non-local enablement', async () => {
  const {readInventoryConfig} = await import('../dist/inventory/config.js');
  const {inventorySeedConfig}=await import('../../../scripts/inventory-seed-local.mjs');
  assert.equal(readInventoryConfig({}),false);
  assert.throws(()=>readInventoryConfig({INVENTORY_ENABLED:'true'}),/local catalog, auth and business/);
  assert.throws(()=>readInventoryConfig({INVENTORY_ENABLED:'yes'}),/local catalog, auth and business/);
  assert.throws(()=>inventorySeedConfig({}),/refused/);
  assert.throws(()=>inventorySeedConfig({APP_ENV:'local',DATABASE_PROVIDER:'local',MARKETPLACE_MODE:'mock',COMPOSE_PROJECT_NAME:'fasemarketplace-catalog-local',AUTH_ENABLED:'true',BUSINESS_ENABLED:'true',CATALOG_ENABLED:'true',INVENTORY_ENABLED:'true',BUSINESS_LOCAL_DATABASE:'fasemarketplace'}));
});
