import { Buffer } from 'node:buffer';
const { Response, AbortSignal } = globalThis;

export function validKey(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(key);
}

export function jsonResponse(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export async function fetchReadiness(url, key, fetchImpl) {
  try {
    const headers = { accept: 'application/json' };
    if (key) headers.authorization = `Bearer ${key}`;
    const upstream = await fetchImpl(url, { method: 'GET', headers,
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (upstream.status !== 200 || !upstream.body) throw new Error('unavailable');
    const reader = upstream.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) throw new Error('oversized');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data.status !== 'ready' || data.dependencies?.postgres !== true ||
        data.dependencies?.redis !== true || data.marketplaceMode !== 'mock') throw new Error('unavailable');
    return jsonResponse({ status: 'ready', dependencies: { postgres: true, redis: true }, marketplaceMode: 'mock' });
  } catch {
    return jsonResponse({ status: 'unavailable' }, 503);
  }
}
