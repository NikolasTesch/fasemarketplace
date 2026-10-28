const {test}=require('node:test');
const assert=require('node:assert/strict');
const host='ep-soft-bird-b61xykn1-pooler.c-2.sa-east-1.aws.neon.tech';
const auth=`postgresql://fm_auth_preview_runtime:auth-example@${host}/neondb?sslmode=verify-full`;
const preview={APP_ENV:'local',MARKETPLACE_MODE:'mock',DATABASE_PROVIDER:'neon',NEON_BRANCH:'development',NEON_DEVELOPMENT_HOST:host,
  DATABASE_URL:auth,AUTH_DATABASE_URL:auth,AUTH_ENABLED:'true',AUTH_CONTEXT:'preview',AUTH_ORIGIN:'https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app',
  AUTH_COOKIE_PREFIX:'fm_preview_access',AUTH_SECRET:'s'.repeat(64),AUTH_API_KEY:'a'.repeat(64),REDIS_URL:'redis://redis:6379',
  BUSINESS_ENABLED:'true',BUSINESS_DATABASE_URL:`postgresql://fm_business_runtime:business-example@${host}/neondb?sslmode=verify-full`,CATALOG_ENABLED:'true'};
test('business Preview accepts only the same confirmed development endpoint and isolated runtime role',async()=>{
  const {readBusinessConfig}=await import('../dist/persistence/config.js');
  const {readCatalogConfig}=await import('../dist/catalog/config.js');
  assert.equal(readBusinessConfig(preview).database,'neondb'); assert.equal(readCatalogConfig(preview),true);
  for(const change of [{NEON_BRANCH:'production'},{APP_ENV:'production'},{BUSINESS_DATABASE_URL:preview.BUSINESS_DATABASE_URL.replace(host,'ep-other-pooler.c-2.sa-east-1.aws.neon.tech')},
    {BUSINESS_DATABASE_URL:preview.BUSINESS_DATABASE_URL.replace('fm_business_runtime','owner')},{BUSINESS_DATABASE_URL:preview.BUSINESS_DATABASE_URL.replace('verify-full','require')},
    {BUSINESS_DATABASE_URL:preview.BUSINESS_DATABASE_URL.replace('/neondb','/other')}]) assert.throws(()=>readBusinessConfig({...preview,...change}));
});
test('pooled Neon connections do not send unsupported startup options',async()=>{
  const {businessPoolSettings}=await import('../dist/persistence/client.js');
  assert.equal(businessPoolSettings(preview.BUSINESS_DATABASE_URL).options,undefined);
  assert.equal(typeof businessPoolSettings('postgresql://fm_business_runtime:secret@postgres/fasemarketplace?schema=business').options,'string');
});
