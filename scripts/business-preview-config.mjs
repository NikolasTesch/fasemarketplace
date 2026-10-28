const HOST='ep-soft-bird-b61xykn1-pooler.c-2.sa-east-1.aws.neon.tech';
export function validatePreviewBusinessTargets(config,env){
  try{
    const auth=new URL(config.databaseUrl),owner=new URL(config.ownerUrl),runtime=new URL(env.PREVIEW_BUSINESS_DATABASE_URL),migration=new URL(env.PREVIEW_BUSINESS_MIGRATION_URL);
    const valid=(url,host,role)=>url.protocol==='postgresql:'&&url.hostname===host&&(!url.port||url.port==='5432')&&url.pathname==='/neondb'&&url.username===role&&!!url.password&&!url.hash&&url.searchParams.toString()==='sslmode=verify-full';
    if(config.context!=='preview'||!valid(auth,HOST,'fm_auth_preview_runtime')||!valid(owner,HOST.replace('-pooler.','.'),owner.username)||
      !valid(runtime,HOST,'fm_business_runtime')||!valid(migration,HOST.replace('-pooler.','.'),'fm_business_migrator')||
      new Set([auth.password,owner.password,runtime.password,migration.password]).size!==4)throw new Error();
    return {database:'neondb',runtimeUrl:runtime.href,migrationUrl:migration.href,ownerUrl:owner.href};
  }catch{throw new Error('Preview business requires the confirmed development database and separate credentials');}
}
