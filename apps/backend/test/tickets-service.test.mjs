import { Buffer } from 'node:buffer';
import { before, test } from 'node:test';
import assert from 'node:assert/strict';

let TicketService;
before(async () => {
  ({ TicketService } = await import('../dist/tickets/service.js'));
});

test('ticket creation rolls back metadata and discards a staged image when insertion fails', async () => {
  const events = [];
  const client = {
    async query(sql) {
      const normalized = sql.trim();
      events.push(normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK'
        ? normalized
        : 'insert-ticket');
      if (normalized.startsWith('WITH inserted')) throw new Error('simulated ticket insert failure');
      return { rows: [] };
    },
    release() { events.push('release'); },
  };
  const access = { pool: { connect: async () => client } };
  const images = {
    provider: 'test-r2',
    async write(key, bytes, mime, transaction) {
      assert.equal(typeof transaction.query, 'function');
      events.push(`write-image:${key}:${bytes.length}:${mime}`);
    },
    async read() { return null; },
    async discard(key) { events.push(`discard-image:${key}`); },
  };
  const service = new TicketService(access, images);
  const ticket = {
    type: 'bug',
    screen: 'stock',
    title: 'Falha de gravação',
    description: 'A transação precisa desfazer os anexos preparados.',
    imageBytes: Buffer.from([1, 2, 3]),
    imageMime: 'image/png',
  };

  await assert.rejects(
    service.create({ id: 'user-1' }, ticket),
    /simulated ticket insert failure/,
  );
  assert.equal(events[0], 'BEGIN');
  assert.match(events[1], /^write-image:support-ticket\//);
  assert.equal(events[2], 'insert-ticket');
  assert.equal(events[3], 'ROLLBACK');
  assert.match(events[4], /^discard-image:support-ticket\//);
  assert.equal(events[5], 'release');
});
