const { test } = require('node:test');
const assert = require('node:assert/strict');

let validateTicketInput;
let parseTicketOffset;
let parseTicketId;
test.before(async () => {
  ({ validateTicketInput, parseTicketOffset, parseTicketId } = await import('../dist/tickets/validation.js'));
});

const valid = {
  type: 'bug',
  screen: 'stock',
  title: '  Saldo incorreto  ',
  description: '  O saldo não atualiza após a entrada.  ',
};

test('trims required ticket fields and defaults to no image', () => {
  assert.deepEqual(validateTicketInput(valid), {
    type: 'bug',
    screen: 'stock',
    title: 'Saldo incorreto',
    description: 'O saldo não atualiza após a entrada.',
    imageBytes: null,
    imageMime: null,
  });
});

test('rejects unknown fields, missing text, invalid type, and invalid screen', () => {
  for (const input of [
    { ...valid, title: '  ' },
    { ...valid, description: '' },
    { ...valid, type: 'request' },
    { ...valid, screen: 'tickets' },
    { ...valid, unexpected: 'value' },
  ]) assert.throws(() => validateTicketInput(input), (error) => error.getStatus() === 400);
});

test('rejects titles and descriptions beyond their documented limits', () => {
  assert.throws(() => validateTicketInput({ ...valid, title: 'x'.repeat(161) }), (error) => error.getStatus() === 400);
  assert.throws(() => validateTicketInput({ ...valid, description: 'x'.repeat(4001) }), (error) => error.getStatus() === 400);
});

test('accepts supported image signatures only when the declared MIME matches', () => {
  const images = [
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['image/jpeg', Buffer.from([255, 216, 255, 0])],
    ['image/webp', Buffer.from('RIFFxxxxWEBP', 'ascii')],
  ];
  for (const [mime, buffer] of images) {
    const result = validateTicketInput(valid, { mimetype: mime, buffer });
    assert.equal(result.imageMime, mime);
    assert.equal(result.imageBytes, buffer);
  }
  assert.throws(
    () => validateTicketInput(valid, { mimetype: 'image/png', buffer: Buffer.from([255, 216, 255]) }),
    (error) => error.getStatus() === 400,
  );
});

test('rejects empty and over-five-MiB image attachments', () => {
  for (const buffer of [Buffer.alloc(0), Buffer.alloc(5 * 1024 * 1024 + 1)]) {
    assert.throws(
      () => validateTicketInput(valid, { mimetype: 'image/png', buffer }),
      (error) => error.getStatus() === 400,
    );
  }
});

test('accepts only bounded non-negative integer offsets', () => {
  assert.equal(parseTicketOffset(undefined), 0);
  assert.equal(parseTicketOffset('0'), 0);
  assert.equal(parseTicketOffset('120'), 120);
  for (const value of ['', '-1', '1.5', 'abc', '1000001'])
    assert.throws(() => parseTicketOffset(value), (error) => error.getStatus() === 400);
});

test('accepts canonical ticket UUIDs and rejects malformed path values', () => {
  assert.equal(parseTicketId('f44d38d9-c7e5-4f83-8e6e-4215a6a76463'), 'f44d38d9-c7e5-4f83-8e6e-4215a6a76463');
  for (const value of ['../../users', 'not-a-uuid', 'f44d38d9-c7e5-4f83-8e6e-4215a6a7646'])
    assert.throws(() => parseTicketId(value), (error) => error.getStatus() === 400);
});
