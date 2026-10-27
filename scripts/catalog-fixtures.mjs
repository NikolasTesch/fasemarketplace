// Explicit synthetic accounts only; not application startup or a remote seed.
import {Pool} from 'pg';
import {readLocalAccessOperationConfig} from '../apps/backend/dist/access/config.js';

let owner,runtime;
try {
  const action=process.argv[2];
  if(process.argv.length!==4 || process.argv[3]!=='--stdin' || !['prepare','cleanup'].includes(action) ||
    process.env.APP_ENV!=='local' || process.env.COMPOSE_PROJECT_NAME!=='fasemarketplace-catalog-local' ||
    process.env.CATALOG_ALLOW_TEST_FIXTURES!=='true') throw new Error();
  const config=readLocalAccessOperationConfig(),url=new URL(process.env.DATABASE_URL);
  if(url.hostname!=='postgres'||url.pathname!=='/fasemarketplace'||url.username!=='fm_catalog_owner'||config.cookiePrefix!=='fm_catalog_access')throw new Error();
  let raw='';for await(const chunk of process.stdin){raw+=chunk.toString();if(raw.length>4096)throw new Error();}
  const input=JSON.parse(raw);
  if(Object.keys(input).sort().join(',')!=='admin,user')throw new Error();
  for(const role of ['admin','user'])if(input[role]?.email!==`catalog-test-${role}@example.test`||typeof input[role].password!=='string'||input[role].password.length<16||input[role].password.length>128)throw new Error();
  owner=new Pool({connectionString:url.href,max:1,connectionTimeoutMillis:5000});runtime=new Pool({connectionString:config.databaseUrl,max:3,connectionTimeoutMillis:5000});
  owner.on('error',()=>{});runtime.on('error',()=>{});
  const actual=(await owner.query('SELECT current_user AS name,current_database() AS db')).rows[0];
  if(actual.name!=='fm_catalog_owner'||actual.db!=='fasemarketplace')throw new Error();
  await owner.query('SELECT pg_advisory_lock(734007)');
  const emails=[input.admin.email,input.user.email];
  if(action==='prepare'){
    if((await owner.query('SELECT 1 FROM auth_user WHERE email=ANY($1)',[emails])).rowCount)throw new Error();
    const {createAccessAuth}=await import('../apps/backend/dist/access/auth.js');
    const auth=createAccessAuth(runtime,config);
    for(const role of ['admin','user'])await auth.api.createUser({body:{name:'Homologação catálogo',email:input[role].email,password:input[role].password,role,data:{mustChangePassword:false}}});
  }else{
    await owner.query('BEGIN');
    try{
      await owner.query('UPDATE auth_user SET banned=true,"mustChangePassword"=true WHERE email=ANY($1)',[emails]);
      await owner.query('DELETE FROM auth_session WHERE "userId" IN (SELECT id FROM auth_user WHERE email=ANY($1))',[emails]);
      await owner.query('COMMIT');
    }catch(error){await owner.query('ROLLBACK');throw error;}
  }
  console.log(JSON.stringify({fixtures:action,syntheticOnly:true}));
}catch{
  console.error('Catalog fixtures refused or failed; only explicit synthetic accounts in the isolated local catalog stack are allowed');process.exitCode=1;
}finally{
  if(owner)await owner.query('SELECT pg_advisory_unlock(734007)').catch(()=>{});
  await Promise.allSettled([owner?.end(),runtime?.end()]);
}
