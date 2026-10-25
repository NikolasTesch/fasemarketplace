import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { validKey } from './preview-contract.mjs';

const { Request, Response, Headers, URL, AbortSignal } = globalThis;
export const PREVIEW_ORIGIN = 'https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app';
const cookieName = /^__Secure-fm_preview_access\.(session_token|dont_remember)$/;
class Refusal extends Error { constructor(status) { super('Access refused'); this.status = status; } }
function json(body, status = 200, headers = new Headers()) {
  headers.set('content-type', 'application/json');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  if (status === 429) headers.set('retry-after', '900');
  return new Response(JSON.stringify(body), { status, headers });
}
function fail(status) { return json({ statusCode: status, message: status === 503 ? 'Acesso temporariamente indisponível' : 'Solicitação de acesso recusada' }, status); }
function sameKey(received, expected) {
  const a = Buffer.from(received ?? ''), b = Buffer.from('Bearer ' + expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function normalizeClientIP(value) {
  if (typeof value !== 'string' || value.length > 64 || !isIP(value)) throw new Refusal(403);
  if (isIP(value) === 4) return value;
  return new URL('http://[' + value + ']').hostname.slice(1, -1).toLowerCase();
}
function settings(env, gateway) {
  if (env.PREVIEW_ACCESS_ENABLED !== 'true') return null;
  if (env.PREVIEW_ACCESS_ORIGIN !== PREVIEW_ORIGIN || !validKey(env.PREVIEW_ACCESS_BRIDGE_KEY)) throw new Error('Invalid access bridge configuration');
  if (env.PREVIEW_ACCESS_BRIDGE_KEY === env.PREVIEW_BRIDGE_KEY) throw new Error('Access bridge requires separate credentials');
  if (gateway) {
    if (env.APP_ENV !== 'local' || !validKey(env.PREVIEW_ACCESS_API_KEY) ||
        env.PREVIEW_ACCESS_API_KEY === env.PREVIEW_ACCESS_BRIDGE_KEY || env.PREVIEW_ACCESS_API_KEY === env.PREVIEW_BRIDGE_KEY) throw new Error('Invalid API hop credential');
  } else if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== 'development' ||
      !/^https:\/\/[a-z0-9-]{1,63}\.trycloudflare\.com$/.test(env.PREVIEW_ACCESS_BRIDGE_ORIGIN ?? '')) throw new Error('Invalid Preview target');
  return { origin: PREVIEW_ORIGIN, key: env.PREVIEW_ACCESS_BRIDGE_KEY,
    apiKey: env.PREVIEW_ACCESS_API_KEY, upstream: gateway ? 'http://api:3001' : env.PREVIEW_ACCESS_BRIDGE_ORIGIN };
}
function route(request, gateway) {
  const url = new URL(request.url);
  if (!gateway && url.origin !== PREVIEW_ORIGIN) throw new Refusal(403);
  const path = url.pathname.replace(gateway ? /^\/access/ : /^\/api\/access/, '');
  if (!url.pathname.startsWith(gateway ? '/access/' : '/api/access/')) throw new Refusal(404);
  const methods = { '/login': ['POST'], '/session': ['GET'], '/logout': ['POST'], '/password': ['POST'], '/users': ['GET', 'POST'] };
  const allowed = methods[path] ?? (/^\/users\/[a-zA-Z0-9_-]{1,128}\/(block|password)$/.test(path) ? ['POST'] : null);
  if (!allowed) throw new Refusal(404);
  if (!allowed.includes(request.method)) throw new Refusal(405);
  if (url.search) {
    const entries = [...url.searchParams];
    if (path !== '/users' || request.method !== 'GET' || entries.length !== 1 || entries[0][0] !== 'offset' ||
        !/^(0|[1-9][0-9]{0,5})$/.test(entries[0][1]) || Number(entries[0][1]) > 100000) throw new Refusal(400);
  }
  return { path, search: url.search };
}
async function bounded(body, limit) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Refusal(limit === 8192 ? 413 : 503);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
function filteredCookies(value) {
  if (value.length > 4096) throw new Refusal(400);
  const output = [], seen = new Set();
  for (const field of value.split(';')) {
    const equals = field.indexOf('=');
    if (equals < 0) continue;
    const name = field.slice(0, equals).trim(), content = field.slice(equals + 1).trim();
    if (!cookieName.test(name)) continue;
    if (seen.has(name) || !/^[a-zA-Z0-9._~%+=/-]*$/.test(content)) throw new Refusal(400);
    seen.add(name); output.push(name + '=' + content);
  }
  return output.join('; ');
}
async function outgoing(request, config, gateway) {
  const { path, search } = route(request, gateway);
  const origin = request.headers.get('origin');
  if ((origin !== null && origin !== config.origin) || request.headers.get('sec-fetch-site') === 'cross-site' ||
      (request.method === 'POST' && origin !== config.origin)) throw new Refusal(403);
  const ip = normalizeClientIP(request.headers.get(gateway ? 'x-fm-client-ip' : 'x-vercel-forwarded-for'));
  const headers = new Headers({ accept: 'application/json', authorization: 'Bearer ' + (gateway ? config.apiKey : config.key), 'x-fm-client-ip': ip });
  const cookies = filteredCookies(request.headers.get('cookie') ?? '');
  if (cookies) headers.set('cookie', cookies);
  if (origin) headers.set('origin', origin);
  const site = request.headers.get('sec-fetch-site');
  if (site) headers.set('sec-fetch-site', site);
  let body;
  if (request.method === 'POST') {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')) throw new Refusal(415);
    body = await bounded(request.body, 8192);
    try { const parsed = JSON.parse(body.toString('utf8')); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); }
    catch { throw new Refusal(400); }
    headers.set('content-type', 'application/json');
  }
  return { path, url: config.upstream + '/access' + path + search,
    options: { method: request.method, headers, body, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000) } };
}
function userDTO(user) {
  if (!user || typeof user.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(user.id) ||
      typeof user.name !== 'string' || user.name.length > 100 || typeof user.email !== 'string' || user.email.length > 254 ||
      !['admin', 'user'].includes(user.role) || typeof user.mustChangePassword !== 'boolean' || typeof user.banned !== 'boolean') throw new Refusal(503);
  return { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword, banned: user.banned };
}
function dto(data, path, method) {
  if (['/login', '/session'].includes(path) || (path === '/users' && method === 'POST')) {
    const result = { user: userDTO(data.user) };
    if (path === '/session') {
      if (typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt))) throw new Refusal(503);
      result.expiresAt = data.expiresAt;
    }
    return result;
  }
  if (path === '/users') {
    if (!Array.isArray(data.users) || data.users.length > 20 || !Number.isSafeInteger(data.total) || data.total < 0 ||
        !Number.isInteger(data.offset) || data.offset < 0 || data.offset > 100000 || data.limit !== 20) throw new Refusal(503);
    return { users: data.users.map(userDTO), total: data.total, offset: data.offset, limit: 20 };
  }
  if (data.success !== true) throw new Refusal(503);
  return { success: true };
}
function secureCookie(value) {
  const parts = value.split(';').map(part => part.trim());
  const name = parts[0].slice(0, parts[0].indexOf('='));
  if (!cookieName.test(name)) return null;
  const attrs = parts.slice(1).map(part => part.toLowerCase());
  const names = attrs.map(part => part.split('=')[0]);
  if (new Set(names).size !== names.length || names.some(name => !['secure', 'httponly', 'samesite', 'path', 'max-age', 'expires'].includes(name))) throw new Refusal(503);
  if (value.length > 4096 || !attrs.includes('secure') || !attrs.includes('httponly') ||
      !attrs.includes('samesite=lax') || !attrs.includes('path=/') || attrs.some(part => part.startsWith('domain='))) throw new Refusal(503);
  return value;
}
async function responseFrom(upstream, path, method) {
  if (![200, 201].includes(upstream.status)) {
    await upstream.body?.cancel().catch(() => {});
    return fail([400, 401, 403, 404, 405, 413, 415, 429].includes(upstream.status) ? upstream.status : 503);
  }
  if (!upstream.headers.get('content-type')?.startsWith('application/json')) throw new Refusal(503);
  const raw = await bounded(upstream.body, 65536);
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch { throw new Refusal(503); }
  const output = dto(data, path, method), headers = new Headers();
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length > 8) throw new Refusal(503);
  for (const value of cookies) { const safe = secureCookie(value); if (safe) headers.append('set-cookie', safe); }
  return json(output, upstream.status, headers);
}
function handler(config, gateway, fetchImpl) {
  return async (request) => {
    if (!config) return fail(503);
    try {
      if (gateway && !sameKey(request.headers.get('authorization'), config.key)) return fail(401);
      const next = await outgoing(request, config, gateway);
      const upstream = await fetchImpl(next.url, next.options);
      return await responseFrom(upstream, next.path, request.method);
    } catch (error) { return fail(error instanceof Refusal ? error.status : 503); }
  };
}
export function createAccessProxy({ env, fetchImpl = globalThis.fetch }) {
  let config;
  try { config = settings(env, false); } catch { return async () => fail(503); }
  return handler(config, false, fetchImpl);
}
export function createAccessGatewayHandler({ env, fetchImpl = globalThis.fetch }) {
  return handler(settings(env, true), true, fetchImpl);
}
// Used by the Node gateway adapter; never reconstruct an external destination.
export async function nodeAccessRequest(request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(key, value);
  const options = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    options.body = request; options.duplex = 'half';
  }
  return new Request('http://gateway' + request.url, options);
}
