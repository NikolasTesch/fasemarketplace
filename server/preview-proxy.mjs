import { URL } from 'node:url';
import { validKey, jsonResponse, fetchReadiness } from './preview-contract.mjs';

export function createPreviewProxy({ env, fetchImpl = globalThis.fetch }) {
  return createBridgeProxy({ env, fetchImpl, environment: 'preview', prefix: 'PREVIEW' });
}

export function createBridgeProxy({ env, fetchImpl = globalThis.fetch, environment, prefix }) {
  return async (request) => {
    const key = env[`${prefix}_BRIDGE_KEY`];
    const origin = env[`${prefix}_BRIDGE_ORIGIN`];
    // Opt-in and exact environment only. This does not verify Deployment Protection;
    // operators must check unauthenticated access before enabling the bridge.
    if (env[`${prefix}_BRIDGE_ENABLED`] !== 'true' || env.VERCEL_ENV !== environment ||
        !validKey(key) || !/^https:\/\/[a-z0-9-]{1,63}\.trycloudflare\.com$/.test(origin ?? '')) {
      return jsonResponse({ status: 'unavailable' }, 503);
    }
    const url = new URL(request.url);
    if (url.pathname !== '/api/health/ready' || url.search) return jsonResponse({ status: 'not found' }, 404);
    if (request.method !== 'GET') return jsonResponse({ status: 'method not allowed' }, 405);
    return fetchReadiness(`${origin}/health/ready`, key, fetchImpl);
  };
}
