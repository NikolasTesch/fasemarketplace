import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Blob, Buffer } from 'node:buffer';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from '../dist/app.module.js';
import { TelemetryExceptionFilter } from '../dist/api-exception-filter.js';
import { LocalAccessService } from '../dist/access/service.js';

const authUrl = new URL(process.env.AUTH_DATABASE_URL ?? '');
const ownerUrl = new URL(process.env.DATABASE_URL ?? '');
assert.match(authUrl.pathname, /^\/fm_auth_test_[a-z0-9_]+$/);
assert.equal(authUrl.hostname, 'postgres');
assert.equal(ownerUrl.hostname, 'postgres');
assert.equal(ownerUrl.pathname, authUrl.pathname);
assert.equal(process.env.AUTH_ENABLED, 'true');

test('authenticated users can create and read shared tickets with optional images', async () => {
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  app.useBodyParser('json', { limit: '8kb' });
  app.useGlobalFilters(new TelemetryExceptionFilter(app.get(HttpAdapterHost), { exception: () => {} }));
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const emails = [
    `tickets-admin-${process.env.AUTH_COOKIE_PREFIX}@example.test`,
    `tickets-user-${process.env.AUTH_COOKIE_PREFIX}@example.test`,
    `tickets-pending-${process.env.AUTH_COOKIE_PREFIX}@example.test`,
  ];
  let userIds = [];
  try {
    await app.listen(0, '127.0.0.1');
    const root = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    const origin = process.env.AUTH_ORIGIN;
    const access = app.get(LocalAccessService);
    const grants = await owner.query(`
      SELECT has_table_privilege('fm_auth_runtime', 'support_ticket', 'SELECT') AS can_select,
        has_table_privilege('fm_auth_runtime', 'support_ticket', 'INSERT') AS can_insert,
        has_table_privilege('fm_auth_runtime', 'support_ticket', 'UPDATE') AS can_update,
        has_table_privilege('fm_auth_runtime', 'support_ticket', 'DELETE') AS can_delete,
        has_table_privilege('fm_auth_runtime', 'support_ticket_image', 'SELECT') AS image_can_select,
        has_table_privilege('fm_auth_runtime', 'support_ticket_image', 'INSERT') AS image_can_insert,
        has_table_privilege('fm_auth_runtime', 'support_ticket_image', 'UPDATE') AS image_can_update,
        has_table_privilege('fm_auth_runtime', 'support_ticket_image', 'DELETE') AS image_can_delete
    `);
    assert.deepEqual(grants.rows[0], {
      can_select: true,
      can_insert: true,
      can_update: false,
      can_delete: false,
      image_can_select: true,
      image_can_insert: true,
      image_can_update: false,
      image_can_delete: false,
    });

    const priorUsers = await owner.query('SELECT id FROM auth_user WHERE email = ANY($1::text[])', [emails]);
    userIds = priorUsers.rows.map((row) => row.id);
    if (userIds.length) {
      await owner.query('DELETE FROM support_ticket WHERE author_id = ANY($1::text[])', [userIds]);
      await owner.query('DELETE FROM auth_session WHERE "userId" = ANY($1::text[])', [userIds]);
      await owner.query('DELETE FROM auth_account WHERE "userId" = ANY($1::text[])', [userIds]);
      await owner.query('DELETE FROM auth_user WHERE id = ANY($1::text[])', [userIds]);
    }
    const password = 'Synthetic-Ticket-Access-2026!';
    const fixtures = [
      { name: 'Administrador de teste', email: emails[0], role: 'admin', pending: false },
      { name: 'Usuário de teste', email: emails[1], role: 'user', pending: false },
      { name: 'Usuário pendente', email: emails[2], role: 'user', pending: true },
    ];
    for (const fixture of fixtures) {
      const created = await access.auth.api.createUser({
        body: {
          name: fixture.name,
          email: fixture.email,
          password,
          role: fixture.role,
          data: { mustChangePassword: fixture.pending },
        },
      });
      userIds.push(created.user.id);
    }

    const cookieFor = async (email) => {
      const response = await fetch(root + '/access/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    };
    const adminCookie = await cookieFor(emails[0]);
    const userCookie = await cookieFor(emails[1]);
    const pendingCookie = await cookieFor(emails[2]);
    const getTickets = (cookie, path = '/tickets') => fetch(root + path, { headers: { cookie } });
    const form = ({ type, title, description, image }) => {
      const data = new FormData();
      data.set('type', type);
      data.set('screen', 'stock');
      data.set('title', title);
      data.set('description', description);
      if (image) data.set('image', image, 'evidence.png');
      return data;
    };
    const createTicket = (cookie, data, requestOrigin = origin) => fetch(root + '/tickets', {
      method: 'POST', headers: { cookie, origin: requestOrigin }, body: data,
    });

    assert.equal((await getTickets('')).status, 401);
    assert.equal((await createTicket('', form({
      type: 'bug', title: 'Sem sessão', description: 'Não deve abrir chamado sem autenticação.',
    }))).status, 401);
    assert.equal((await getTickets(pendingCookie)).status, 403);
    assert.equal((await createTicket(pendingCookie, form({
      type: 'bug', title: 'Senha pendente', description: 'Não deve abrir chamado antes da troca.',
    }))).status, 403);

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6tL9sAAAAASUVORK5CYII=', 'base64');
    const first = await createTicket(adminCookie, form({
      type: 'bug', title: 'Saldo não atualiza', description: 'A entrada não atualiza o saldo disponível.',
      image: new Blob([png], { type: 'image/png' }),
    }));
    assert.equal(first.status, 201);
    const firstTicket = await first.json();
    assert.equal(firstTicket.status, 'open');
    assert.equal(firstTicket.authorName, 'Administrador de teste');
    assert.equal(firstTicket.hasImage, true);

    const second = await createTicket(userCookie, form({
      type: 'improvement', title: 'Melhorar tabela', description: 'Exibir mais contexto na lista.',
    }));
    assert.equal(second.status, 201);
    const secondTicket = await second.json();
    assert.equal(secondTicket.status, 'open');
    assert.equal(secondTicket.hasImage, false);

    const shared = await getTickets(userCookie);
    assert.equal(shared.status, 200);
    const page = await shared.json();
    assert.equal(page.total, 2);
    assert.equal(page.limit, 20);
    assert.equal(page.tickets.length, 2);
    assert.ok(page.tickets.some((ticket) => ticket.authorName === 'Administrador de teste'));
    assert.ok(page.tickets.some((ticket) => ticket.authorName === 'Usuário de teste'));
    assert.ok(page.tickets.every((ticket) => !Object.hasOwn(ticket, 'imageBytes')));
    assert.equal((await getTickets(userCookie, '/tickets?offset=1')).status, 200);
    assert.equal((await getTickets(userCookie, '/tickets?offset=-1')).status, 400);

    const imageResponse = await fetch(root + `/tickets/${firstTicket.id}/image`, { headers: { cookie: userCookie } });
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get('content-type'), 'image/png');
    assert.equal(imageResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(imageResponse.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), png);
    assert.equal((await fetch(root + `/tickets/${firstTicket.id}/close`, {
      method: 'POST', headers: { cookie: adminCookie, origin },
    })).status, 404);
    assert.equal((await fetch(root + `/tickets/${firstTicket.id}/comments`, {
      method: 'POST', headers: { cookie: adminCookie, origin }, body: new FormData(),
    })).status, 404);

    assert.equal((await createTicket(userCookie, form({
      type: 'bug', title: 'Imagem adulterada', description: 'MIME não corresponde à assinatura.',
      image: new Blob([Buffer.from('not an image')], { type: 'image/png' }),
    }))).status, 400);
    assert.equal((await createTicket(userCookie, form({
      type: 'bug', title: 'Imagem grande', description: 'Ultrapassa o limite permitido.',
      image: new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }),
    }))).status, 413);
    assert.equal((await createTicket(userCookie, form({
      type: 'bug', title: 'Origem indevida', description: 'Origin externa deve ser recusada.',
    }), 'http://evil.example')).status, 403);
    const afterRejectedWrites = await (await getTickets(userCookie)).json();
    assert.equal(afterRejectedWrites.total, 2);

    await owner.query('UPDATE auth_user SET banned=true WHERE id=$1', [userIds[1]]);
    assert.equal((await getTickets(userCookie)).status, 401);
  } finally {
    if (userIds.length) {
      await owner.query('DELETE FROM support_ticket WHERE author_id = ANY($1::text[])', [userIds]).catch(() => {});
      await owner.query('DELETE FROM auth_session WHERE "userId" = ANY($1::text[])', [userIds]).catch(() => {});
      await owner.query('DELETE FROM auth_account WHERE "userId" = ANY($1::text[])', [userIds]).catch(() => {});
      await owner.query('DELETE FROM auth_user WHERE id = ANY($1::text[])', [userIds]).catch(() => {});
    }
    await owner.end();
    await app.close();
  }
});
