import process from 'node:process';
import { createPreviewProxy } from '../../server/preview-proxy.mjs';
import { createProductionProxy } from '../../server/production-proxy.mjs';

export default {
  fetch(request) {
    const factory = process.env.VERCEL_ENV === 'production' ? createProductionProxy : createPreviewProxy;
    return factory({ env: process.env })(request);
  },
};
