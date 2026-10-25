import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { validKey, jsonResponse, fetchReadiness } from './preview-contract.mjs';
import { createAccessGatewayHandler, nodeAccessRequest } from './access-bridge.mjs';

export function createGateway({ key, fetchImpl = globalThis.fetch, accessEnv }) {
  if (!validKey(key)) throw new Error('A valid private diagnostic bridge key is required');
  const expected = Buffer.from(`Bearer ${key}`);
  let active = 0;
  let activeAccess = 0;
  const access = accessEnv ? createAccessGatewayHandler({ env: accessEnv, fetchImpl }) : null;
  const server = createServer(async (request, response) => {
    if (access && request.url?.startsWith('/access/')) {
      if (activeAccess >= 4) {
        response.writeHead(503, { 'cache-control': 'no-store' }); response.end(); return;
      }
      activeAccess++;
      try {
        const result = await access(await nodeAccessRequest(request));
        const headers = Object.fromEntries(result.headers);
        const cookies = result.headers.getSetCookie();
        delete headers['set-cookie'];
        if (cookies.length) headers['set-cookie'] = cookies;
        response.writeHead(result.status, headers);
        response.end(await result.text());
      } catch {
        if (!response.headersSent) response.writeHead(503, { 'cache-control': 'no-store' });
        response.end();
      } finally { activeAccess--; }
      return;
    }
    let result;
    const received = Buffer.from(request.headers.authorization ?? '');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      result = jsonResponse({ status: 'unauthorized' }, 401);
    } else if (request.url !== '/health/ready') {
      result = jsonResponse({ status: 'not found' }, 404);
    } else if (request.method !== 'GET') {
      result = jsonResponse({ status: 'method not allowed' }, 405);
    } else if (active >= 2) {
      result = jsonResponse({ status: 'unavailable' }, 503);
    } else {
      active++;
      try { result = await fetchReadiness('http://api:3001/health/ready', undefined, fetchImpl); }
      finally { active--; }
    }
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxConnections = 64;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const key = process.env.APP_ENV === 'production' ? process.env.PRODUCTION_BRIDGE_KEY : process.env.PREVIEW_BRIDGE_KEY;
    const server = createGateway({ key, accessEnv: process.env.PREVIEW_ACCESS_ENABLED === 'true' ? process.env : undefined });
    server.on('error', () => { console.error('Diagnostic gateway unavailable'); process.exitCode = 1; });
    server.listen(3002, '0.0.0.0');
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
  } catch { console.error('Diagnostic gateway configuration invalid'); process.exitCode = 1; }
}
