const { test } = require('node:test');
const assert = require('node:assert/strict');
test('exclusive pins transaction for pooler-safe lock, releases on success and errors', async () => {
  const { LocalAccessService } = await import('../dist/access/service.js');
  for (const failure of [false, true]) {
    const calls = [];
    let released;
    const client = { query: async (sql) => { calls.push(sql); }, release: (destroy) => { released = destroy; } };
    const service = { lockPool: { connect: async () => client } };
    const work = async () => { calls.push('WORK'); if (failure) throw new Error('Synthetic'); return 42; };
    if (failure) await assert.rejects(LocalAccessService.prototype.exclusive.call(service, work), /Synthetic/);
    else assert.equal(await LocalAccessService.prototype.exclusive.call(service, work), 42);
    assert.equal(calls[0], 'BEGIN');
    assert.ok(calls.some(sql => sql.includes('pg_advisory_xact_lock(734007)')));
    assert.ok(!calls.some(sql => /pg_advisory_(lock|unlock)\(/.test(sql)));
    assert.equal(calls.at(-1), failure ? 'ROLLBACK' : 'COMMIT');
    assert.equal(released, false);
  }
  let destroyed;
  const client = { query: async (sql) => { if (sql === 'ROLLBACK') throw new Error('Disconnected'); }, release: (value) => { destroyed = value; } };
  await assert.rejects(LocalAccessService.prototype.exclusive.call({ lockPool: { connect: async () => client } }, async () => { throw new Error('Synthetic'); }));
  assert.equal(destroyed, true);
});
