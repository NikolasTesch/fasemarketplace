import { Buffer } from 'node:buffer';
import { before, test } from 'node:test';
import assert from 'node:assert/strict';

let PostgresTicketImageStorage;
before(async () => {
  ({ PostgresTicketImageStorage } = await import('../dist/tickets/image-storage.js'));
});

test('PostgreSQL image storage writes and reads by opaque key', async () => {
  const calls = [];
  const transactionCalls = [];
  const bytes = Buffer.from([1, 2, 3]);
  const access = {
    pool: {
      async query(sql, values) {
        calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
        if (sql.includes('SELECT image_bytes')) return { rows: [{ bytes }] };
        if (sql.includes('INSERT INTO support_ticket_image')) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
    },
  };
  const storage = new PostgresTicketImageStorage(access);
  const transaction = {
    async query(sql, values) {
      transactionCalls.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      return { rows: [], rowCount: 1 };
    },
  };
  await storage.write('support-ticket/test-key', bytes, 'image/png', transaction);
  assert.deepEqual(await storage.read('support-ticket/test-key'), bytes);
  assert.equal(typeof storage.discard, 'function');
  await storage.discard('support-ticket/test-key');
  assert.equal(storage.provider, 'postgres');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].values, ['support-ticket/test-key']);
  assert.equal(transactionCalls.length, 1);
  assert.deepEqual(transactionCalls[0].values, ['support-ticket/test-key', bytes]);
  assert.match(transactionCalls[0].sql, /INSERT INTO support_ticket_image/);
});

test('PostgreSQL image storage returns null when the object key is missing', async () => {
  const storage = new PostgresTicketImageStorage({
    pool: { query: async () => ({ rows: [] }) },
  });
  assert.equal(await storage.read('missing'), null);
});
