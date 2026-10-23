import { createBridgeProxy } from './preview-proxy.mjs';

export function createProductionProxy({ env, fetchImpl = globalThis.fetch }) {
  return createBridgeProxy({ env, fetchImpl, environment: 'production', prefix: 'PRODUCTION' });
}
