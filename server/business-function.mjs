import {createBusinessProxy} from './business-bridge.mjs';
const {URL,Request,Response}=globalThis;
export function createBusinessFunction(options){
  const proxy=createBusinessProxy(options);
  return request=>{
    const url=new URL(request.url),rewrite=url.searchParams.getAll('fm_path');
    if(rewrite.length){
      if(rewrite.length!==1)return new Response(null,{status:400});
      if(!/^(catalog|inventory)\/[a-zA-Z0-9/-]{1,180}$/.test(rewrite[0]))return new Response(null,{status:404});
      const path='/api/'+rewrite[0];
      if(url.pathname!=='/api/business'&&url.pathname!==path)return new Response(null,{status:400});
      url.pathname=path;url.searchParams.delete('fm_path');request=new Request(url,request);
    }
    const params=url.searchParams.getAll('id');
    const match=url.pathname.match(/^\/api\/(?:catalog\/(?:products|variants)|inventory\/variants)\/([0-9a-fA-F-]{36})(?:\/(?:variants|minimum))?$/);
    if(params.length===1&&match&&params[0]===match[1]){url.searchParams.delete('id');request=new Request(url,request);}
    return proxy(request);
  };
}
