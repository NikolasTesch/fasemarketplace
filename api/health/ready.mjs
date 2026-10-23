import process from 'node:process';
import { createPreviewProxy } from '../../server/preview-proxy.mjs';

export default {
  fetch(request) {
    return createPreviewProxy({ env: process.env })(request);
  },
};
