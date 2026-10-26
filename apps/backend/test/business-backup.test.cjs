const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {resolve} = require('node:path');
test('business backup refuses remote context before connection and never prints credentials', () => {
  const secret = 'synthetic-private-backup-credential';
  const result = spawnSync(process.execPath, [resolve(__dirname, '../../../scripts/business-backup.mjs'), '/tmp/refused.fmbackup'], {
    encoding: 'utf8', timeout: 5000, env: {...process.env, APP_ENV:'production', BUSINESS_ENABLED:'true',
      BUSINESS_ADMIN_DATABASE_URL:`postgresql://owner:${secret}@remote.example/neondb`},
  });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.match(result.stderr, /Business backup refused/); assert.equal(result.stderr.includes(secret), false);
});
