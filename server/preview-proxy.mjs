import { URL } from 'node:url';
import { validKey, jsonResponse, fetchReadiness } from './preview-contract.mjs';

export function createPreviewProxy({ env, fetchImpl = globalThis.fetch }) {
  return async (request) => {
    const key = env.PREVIEW_BRIDGE_KEY;
    const origin = env.PREVIEW_BRIDGE_ORIGIN;
    // Opt-in Preview only. This does not verify platform Deployment Protection;
    // operators must check unauthenticated access before enabling the bridge.
    if (env.PREVIEW_BRIDGE_ENABLED !== 'true' || env.VERCEL_ENV !== 'preview' ||
        !validKey(key) || !/^https:\/\/[a-z0-9-]{1,63}\.trycloudflare\.com$/.test(origin ?? '')) {
      return jsonResponse({ status: 'unavailable' }, 503);
    }
    const url = new URL(request.url);
    if (url.pathname !== '/api/health/ready' || url.search) return jsonResponse({ status: 'not found' }, 404);
    if (request.method !== 'GET') return jsonResponse({ status: 'method not allowed' }, 405);
    return fetchReadiness(`${origin}/health/ready`, key, fetchImpl);
  };
}
