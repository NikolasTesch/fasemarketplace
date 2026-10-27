import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTicketDraftError } from '../src/tickets/form.ts';

const valid = {
  type: 'bug',
  screen: 'stock',
  title: 'Saldo incorreto',
  description: 'O saldo não foi atualizado após a entrada.',
};

test('accepts a complete ticket without an image', () => {
  assert.equal(getTicketDraftError(valid), null);
});

test('requires a supported type, affected screen, title, and description', () => {
  for (const input of [
    { ...valid, type: '' },
    { ...valid, screen: '' },
    { ...valid, title: '  ' },
    { ...valid, description: '' },
  ]) assert.notEqual(getTicketDraftError(input), null);
});

test('enforces the title and description limits before submission', () => {
  assert.equal(getTicketDraftError({ ...valid, title: '🧵'.repeat(160) }), null);
  assert.notEqual(getTicketDraftError({ ...valid, title: 'x'.repeat(161) }), null);
  assert.notEqual(getTicketDraftError({ ...valid, description: 'x'.repeat(4001) }), null);
});

test('accepts one supported image up to five MiB and rejects invalid or oversized images', () => {
  assert.equal(getTicketDraftError({ ...valid, image: { type: 'image/png', size: 5 * 1024 * 1024 } }), null);
  for (const image of [
    { type: 'image/svg+xml', size: 100 },
    { type: 'image/png', size: 0 },
    { type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 },
  ]) assert.notEqual(getTicketDraftError({ ...valid, image }), null);
});
