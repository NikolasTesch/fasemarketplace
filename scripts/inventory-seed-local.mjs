import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readBusinessConfig} from '../apps/backend/dist/persistence/config.js';
import {createBusinessClient} from '../apps/backend/dist/persistence/client.js';
import {readInventoryConfig} from '../apps/backend/dist/inventory/config.js';

export function inventorySeedConfig(env=process.env){
  const business=readBusinessConfig(env);
  if(!business||!readInventoryConfig(env)||env.APP_ENV!=='local'||env.DATABASE_PROVIDER!=='local'||env.MARKETPLACE_MODE!=='mock'||
    env.COMPOSE_PROJECT_NAME!=='fasemarketplace-catalog-local'||env.AUTH_ENABLED!=='true'||env.BUSINESS_LOCAL_DATABASE!=='fasemarketplace'||
    new URL(business.runtimeUrl).username!=='fm_business_runtime')throw new Error('Local inventory seed target refused');
  return {database:business.database};
}

function stableId(variantId){
  const bytes=createHash('sha256').update('fasemarketplace:inventory:opening:v1:'+variantId).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;
  const value=bytes.toString('hex');return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}

export async function seedOpeningInventory(client){
  return client.$transaction(async tx=>{
    const locked=await tx.$queryRaw`SELECT id FROM business.inventory_settings WHERE id=1 FOR UPDATE`;
    if(!locked.length)throw new Error('Inventory migration is missing');
    const prior=await tx.stockMovement.count({where:{createdBy:'system:local-seed'}});
    if(prior)throw new Error('Local opening inventory seed already exists');
    const variants=await tx.$queryRaw`SELECT v.id,v.sku FROM business.catalog_variant v JOIN business.catalog_product p ON p.id=v.product_id
      WHERE v.active=true AND p.active=true ORDER BY v.sku ASC,v.id ASC`;
    if(!variants.length)throw new Error('There are no active SKUs to seed');
    const openingReason='saldo inicial sintético para homologação';
    for(let index=0;index<variants.length;index++){
      const variant=variants[index],quantity=25+7*index,minimum=Math.ceil(quantity*0.2);
      await tx.stockMovement.create({data:{id:stableId(variant.id),variantId:variant.id,movementType:'OPENING',sourceBucket:null,destinationBucket:'PHYSICAL_RESERVE',quantity,reason:openingReason,idempotencyKey:'inventory-local-opening-v1:'+variant.id,createdBy:'system:local-seed'}});
      await tx.variantStockPolicy.create({data:{variantId:variant.id,minimumQuantity:minimum,updatedBy:'system:local-seed'}});
    }
    return {seededVariants:variants.length,totalOpeningUnits:variants.reduce((sum,_variant,index)=>sum+25+7*index,0),minimums:variants.map((_variant,index)=>Math.ceil((25+7*index)*0.2))};
  },{timeout:30000});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  let client;
  try{
    const target=inventorySeedConfig();
    if(target.database!=='fasemarketplace')throw new Error('Local inventory seed target refused');
    client=createBusinessClient();if(!client)throw new Error('Local inventory persistence is disabled');
    await client.$connect();
    const targetCheck=await client.$queryRaw`SELECT current_database() AS database,current_user AS role`;
    if(targetCheck[0]?.database!=='fasemarketplace'||targetCheck[0]?.role!=='fm_business_runtime')throw new Error('Connected inventory target refused');
    const result=await seedOpeningInventory(client);
    console.log(JSON.stringify({operation:'local-inventory-seed',database:target.database,...result}));
  }catch{
    console.error('Local inventory seed refused or failed; verify the Docker-local catalog target, migration and one-time seed state.');process.exitCode=1;
  }finally{await client?.$disconnect();}
}
