import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { validKey, jsonResponse, fetchReadiness } from './preview-contract.mjs';

export function createGateway({ key, fetchImpl = globalThis.fetch }) {
  if (!validKey(key)) throw new Error('A valid private preview bridge key is required');
  const expected = Buffer.from(`Bearer ${key}`);
  let active = 0;
  const server = createServer(async (request, response) => {
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
    const server = createGateway({ key: process.env.PREVIEW_BRIDGE_KEY });
    server.on('error', () => { console.error('Preview gateway unavailable'); process.exitCode = 1; });
    server.listen(3002, '0.0.0.0');
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
  } catch { console.error('Preview gateway configuration invalid'); process.exitCode = 1; }
}
