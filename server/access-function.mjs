import {createAccessProxy} from './access-bridge.mjs';
const {URL,Request}=globalThis;
export function createAccessFunction(options) {
  const proxy=createAccessProxy(options);
  return request=>{
    const url=new URL(request.url);
    const params=url.searchParams.getAll('id');
    const userRoute=url.pathname.match(/^\/api\/access\/users\/([a-zA-Z0-9_-]{1,128})\/(?:block|password)$/);
    // Only the two explicit [id] routes receive platform metadata. Never use
    // query values to select a route, and leave every other query for refusal.
    if(params.length===1 && userRoute && params[0]===userRoute[1]) {
      url.searchParams.delete('id');
      request=new Request(url,request);
    }
    return proxy(request);
  };
}
