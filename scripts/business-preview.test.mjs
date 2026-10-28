import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePreviewBusinessTargets} from './business-preview-config.mjs';
const host='ep-soft-bird-b61xykn1-pooler.c-2.sa-east-1.aws.neon.tech',direct=host.replace('-pooler.','.');
const config={context:'preview',databaseUrl:`postgresql://fm_auth_preview_runtime:auth@${host}/neondb?sslmode=verify-full`,ownerUrl:`postgresql://owner:owner@${direct}/neondb?sslmode=verify-full`};
const env={PREVIEW_BUSINESS_DATABASE_URL:`postgresql://fm_business_runtime:runtime@${host}/neondb?sslmode=verify-full`,PREVIEW_BUSINESS_MIGRATION_URL:`postgresql://fm_business_migrator:migration@${direct}/neondb?sslmode=verify-full`};
test('business maintenance accepts only confirmed development database and separate credentials',()=>{
  assert.equal(validatePreviewBusinessTargets(config,env).database,'neondb');
  for(const change of [{PREVIEW_BUSINESS_DATABASE_URL:env.PREVIEW_BUSINESS_DATABASE_URL.replace(host,'evil.invalid')},
    {PREVIEW_BUSINESS_MIGRATION_URL:env.PREVIEW_BUSINESS_MIGRATION_URL.replace(direct,host)},
    {PREVIEW_BUSINESS_MIGRATION_URL:env.PREVIEW_BUSINESS_MIGRATION_URL.replace('/neondb','/other')},
    {PREVIEW_BUSINESS_MIGRATION_URL:env.PREVIEW_BUSINESS_MIGRATION_URL.replace(':migration@',':runtime@')}])
    assert.throws(()=>validatePreviewBusinessTargets(config,{...env,...change}));
});
