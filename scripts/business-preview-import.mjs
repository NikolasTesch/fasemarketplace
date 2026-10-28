import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {readPreviewMaintenanceConfig} from '../apps/backend/dist/access/maintenance-config.js';
import {validatePreviewBusinessTargets} from './business-preview-config.mjs';
const columns={
  catalog_product:['id','name','description','active','version','created_at','updated_at','created_by','updated_by','sale_price','cost','icon_name'],
  catalog_variant:['id','product_id','name','sku','active','version','created_at','updated_at','created_by','updated_by'],
  variant_stock_policy:['variant_id','minimum_quantity','version','updated_at','updated_by'],
  stock_movement:['id','variant_id','movement_type','source_bucket','destination_bucket','quantity','reason','idempotency_key','created_by','created_at'],
};
export function validateSyntheticImport(data){
  if(!data||Object.keys(data).sort().join(',')!==Object.keys(columns).sort().join(','))throw new Error('Invalid import');
  if(data.catalog_product.length!==10||data.catalog_variant.length!==23||data.variant_stock_policy.length!==23||data.stock_movement.length!==23)throw new Error('Unexpected catalog size');
  if(data.stock_movement.some(x=>x.movement_type!=='OPENING'||x.created_by!=='system:local-seed')||data.stock_movement.reduce((sum,x)=>sum+x.quantity,0)!==500)throw new Error('Unexpected inventory provenance');
  for(const [table,fields] of Object.entries(columns))for(const row of data[table])if(!row||Object.keys(row).sort().join(',')!==fields.slice().sort().join(','))throw new Error('Unexpected columns');
  return data;
}
export async function importSynthetic(config,data){
  validateSyntheticImport(data);const pool=new Pool({connectionString:config.runtimeUrl,max:1,connectionTimeoutMillis:10000});pool.on('error',()=>{});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(734011)');
    for(const table of Object.keys(columns)){const result=await client.query(`SELECT count(*)::int AS count FROM business.${table}`);if(result.rows[0].count!==0)throw new Error('Target is not empty');}
    for(const [table,fields] of Object.entries(columns)){
      const query=`INSERT INTO business.${table} (${fields.map(name=>'"'+name+'"').join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')})`;
      for(const row of data[table])await client.query(query,fields.map(field=>row[field]));
    }
    await client.query('COMMIT');return {products:10,variants:23,movements:23,units:500};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();await pool.end();}
}
if(process.argv[1]?.endsWith('business-preview-import.mjs')){
  try{
    if(process.argv.length!==3||!process.argv[2].startsWith('backups/preview-import/'))throw new Error('Import path refused');
    const config=validatePreviewBusinessTargets(readPreviewMaintenanceConfig(),process.env),data=JSON.parse(await readFile(process.argv[2],'utf8'));
    console.log(JSON.stringify(await importSynthetic(config,data)));
  }catch{console.error('Preview synthetic import refused or failed; target preserved if transaction failed');process.exitCode=1;}
}
