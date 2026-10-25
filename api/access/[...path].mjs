import process from 'node:process';
import { createAccessFunction } from '../../server/access-function.mjs';
const {URL,console}=globalThis;

export default {
  fetch(request) {
    if (process.env.VERCEL_ENV === 'preview' && process.env.PREVIEW_ACCESS_ENABLED === 'true') {
      const url = new URL(request.url);
      const suffix = url.pathname.slice('/api/access/'.length);
      console.info(JSON.stringify({ event: 'preview_access_route_shape',
        query: [...url.searchParams].map(([key, value]) => ({
          kind: ['path', '...path', 'offset'].includes(key) ? key : 'other',
          matchesSuffix: value === suffix,
        })),
      }));
    }
    return createAccessFunction({ env: process.env })(request);
  },
};
