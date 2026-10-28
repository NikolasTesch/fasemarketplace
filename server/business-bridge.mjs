import {timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {settings,normalizeClientIP,filteredCookies,secureCookie,bounded} from './access-bridge.mjs';
const {Response,URL,Headers,fetch,AbortSignal}=globalThis;
const uuid='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const routes=[[/^\/catalog\/products$/,['GET','POST']], [new RegExp(`^/catalog/products/${uuid}$`),['POST']],
  [new RegExp(`^/catalog/products/${uuid}/variants$`),['POST']],[new RegExp(`^/catalog/variants/${uuid}$`),['POST']],
  [/^\/inventory\/(stock|movements|settings)$/,['GET']], [/^\/inventory\/movements$/,['POST']],
  [new RegExp(`^/inventory/variants/${uuid}/minimum$`),['POST']], [/^\/inventory\/settings\/mode$/,['POST']]];
class Refusal extends Error {constructor(status){super('refused');this.status=status;}}
function failure(status){return Response.json({statusCode:status,message:status===503?'Serviço temporariamente indisponível':'Solicitação recusada'},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});}
function equalKey(received,key){const a=Buffer.from(received??''),b=Buffer.from('Bearer '+key);return a.length===b.length&&timingSafeEqual(a,b);}
function validate(request,gateway,config){
  const url=new URL(request.url);if(!gateway&&url.origin!==config.origin)throw new Refusal(403);
  const path=gateway?url.pathname:url.pathname.replace(/^\/api(?=\/)/,'');
  const matches=routes.filter(([pattern])=>pattern.test(path));
  if(!matches.length)throw new Refusal(404);
  if(!matches.some(([,methods])=>methods.includes(request.method)))throw new Refusal(405);
  const allowed=path==='/catalog/products'&&request.method==='GET'?['offset','search','status']:
    path==='/inventory/stock'?['offset','search']:path==='/inventory/movements'&&request.method==='GET'?['offset','variantId']:[];
  const seen=new Set();for(const [key,value] of url.searchParams){if(!allowed.includes(key)||seen.has(key)||value.length>128)throw new Refusal(400);seen.add(key);}
  const origin=request.headers.get('origin');if((origin&&origin!==config.origin)||request.headers.get('sec-fetch-site')==='cross-site'||(request.method==='POST'&&origin!==config.origin))throw new Refusal(403);
  return {path,search:url.search,origin};
}
function create(options,gateway){
  let config;try{config=settings(options.env,gateway);}catch{return async()=>failure(503);}
  return async request=>{
    if(!config)return failure(503);
    try{
      if(gateway&&!equalKey(request.headers.get('authorization'),config.key))throw new Refusal(401);
      const {path,search,origin}=validate(request,gateway,config);
      const ip=normalizeClientIP(request.headers.get(gateway?'x-fm-client-ip':'x-vercel-forwarded-for'));
      const headers=new Headers({accept:'application/json',authorization:'Bearer '+(gateway?config.apiKey:config.key),'x-fm-client-ip':ip});
      const cookie=filteredCookies(request.headers.get('cookie')??'');if(cookie)headers.set('cookie',cookie);
      if(origin)headers.set('origin',origin);const site=request.headers.get('sec-fetch-site');if(site)headers.set('sec-fetch-site',site);
      let body;if(request.method==='POST'){
        if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??''))throw new Refusal(415);
        try{body=await bounded(request.body,32768);}catch{throw new Refusal(413);}
        try{const parsed=JSON.parse(body.toString('utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();}catch{throw new Refusal(400);}
        headers.set('content-type','application/json');
      }
      const response=await (options.fetchImpl??fetch)(config.upstream+path+search,{method:request.method,headers,body,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(![200,201].includes(response.status)){await response.body?.cancel().catch(()=>{});return failure([400,401,403,404,405,409,413,415,429].includes(response.status)?response.status:503);}
      if(!response.headers.get('content-type')?.startsWith('application/json'))throw new Refusal(503);
      const raw=await bounded(response.body,262144);let data;try{data=JSON.parse(raw.toString('utf8'));}catch{throw new Refusal(503);}
      const output=new Headers({'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});
      const cookies=response.headers.getSetCookie();if(cookies.length>8)throw new Refusal(503);for(const item of cookies){const safe=secureCookie(item);if(safe)output.append('set-cookie',safe);}
      return new Response(JSON.stringify(data),{status:response.status,headers:output});
    }catch(error){return failure(error instanceof Refusal?error.status:(error?.status===403?403:503));}
  };
}
export const createBusinessProxy=options=>create(options,false);
export const createBusinessGateway=options=>create(options,true);
