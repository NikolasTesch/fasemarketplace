import process from 'node:process';
import { createAccessProxy } from '../../server/access-bridge.mjs';

export default {
  fetch(request) { return createAccessProxy({ env: process.env })(request); },
};
