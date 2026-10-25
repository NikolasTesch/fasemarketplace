import {createAccessProxy} from './access-bridge.mjs';
const {URL,Request}=globalThis;
export function createAccessFunction(options) {
  const proxy=createAccessProxy(options);
  return request=>{
    const url=new URL(request.url);
    const params=url.searchParams.getAll('path');
    // Vercel's catch-all router injects the matched suffix into `path`.
    // Only consume an exact single copy of the actual URL suffix; this cannot
    // select another route. Every other query still goes through the allowlist.
    if(params.length===1 && url.pathname.startsWith('/api/access/') && params[0]===url.pathname.slice('/api/access/'.length)) {
      url.searchParams.delete('path');
      request=new Request(url,request);
    }
    return proxy(request);
  };
}
