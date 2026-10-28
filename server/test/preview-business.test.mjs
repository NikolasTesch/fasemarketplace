import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessProxy,createBusinessGateway} from '../business-bridge.mjs';
import {PREVIEW_ORIGIN} from '../access-bridge.mjs';
import {createBusinessFunction} from '../business-function.mjs';
const env={APP_ENV:'local',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'development',PREVIEW_ACCESS_ENABLED:'true',PREVIEW_ACCESS_ORIGIN:PREVIEW_ORIGIN,PREVIEW_ACCESS_BRIDGE_ORIGIN:'https://synthetic.trycloudflare.com',PREVIEW_ACCESS_BRIDGE_KEY:'b'.repeat(64),PREVIEW_ACCESS_API_KEY:'c'.repeat(64)};
test('business proxy limits routing, origin, method, query and authenticated hop',async()=>{
  let calls=0;
  const proxy=createBusinessProxy({env,fetchImpl:async(url,options)=>{calls++;assert.equal(url,env.PREVIEW_ACCESS_BRIDGE_ORIGIN+'/catalog/products?offset=0');assert.equal(options.headers.get('authorization'),'Bearer '+env.PREVIEW_ACCESS_BRIDGE_KEY);return Response.json({items:[],total:0,offset:0,limit:20});}});
  const request=path=>new Request(PREVIEW_ORIGIN+path,{headers:{'x-vercel-forwarded-for':'203.0.113.5'}});
  assert.equal((await proxy(request('/api/catalog/products?offset=0'))).status,200);
  assert.equal((await proxy(request('/api/catalog/products?admin=true'))).status,400);
  assert.equal((await proxy(request('/api/catalog/unknown'))).status,404);
  assert.equal((await proxy(request('/api/inventory/stock?offset=0&offset=20'))).status,400);
  assert.equal(calls,1);
  const gateway=createBusinessGateway({env,fetchImpl:async()=>{throw new Error();}});
  assert.equal((await gateway(new Request('http://gateway/catalog/products',{headers:{authorization:'Bearer wrong','x-fm-client-ip':'203.0.113.5'}}))).status,401);
});
test('explicit dynamic function removes only matching platform metadata and preserves POST body',async()=>{
  const id='a1234567-1234-1234-1234-123456789abc';let calls=0;
  const handler=createBusinessFunction({env,fetchImpl:async(url,options)=>{calls++;assert.equal(url,env.PREVIEW_ACCESS_BRIDGE_ORIGIN+'/catalog/products/'+id);assert.equal(JSON.parse(options.body.toString()).name,'Bola');return Response.json({id});}});
  const make=q=>new Request(PREVIEW_ORIGIN+'/api/catalog/products/'+id+q,{method:'POST',headers:{origin:PREVIEW_ORIGIN,'content-type':'application/json','x-vercel-forwarded-for':'203.0.113.5'},body:'{"name":"Bola"}'});
  assert.equal((await handler(make('?id='+id))).status,200);
  assert.equal((await handler(make('?id=bad'))).status,400);
  assert.equal((await handler(make('?id='+id+'&id='+id))).status,400);assert.equal(calls,1);
});
test('rewrite resolves one bounded business path without allowing duplicates or arbitrary routes',async()=>{
  let calls=0;const handler=createBusinessFunction({env,fetchImpl:async(url)=>{calls++;assert.equal(url,env.PREVIEW_ACCESS_BRIDGE_ORIGIN+'/catalog/products?offset=0');return Response.json({items:[]});}});
  const make=q=>new Request(PREVIEW_ORIGIN+'/api/business?'+q,{headers:{'x-vercel-forwarded-for':'203.0.113.5'}});
  assert.equal((await handler(make('fm_path=catalog%2Fproducts&offset=0'))).status,200);
  assert.equal((await handler(make('fm_path=catalog%2Fproducts&path=products&offset=0'))).status,200);
  assert.equal((await handler(make('fm_path=access%2Fusers'))).status,404);
  assert.equal((await handler(make('fm_path=catalog%2Fproducts&fm_path=inventory%2Fstock'))).status,400);
  assert.equal((await handler(make('fm_path=catalog%2Fproducts&path=other&offset=0'))).status,400);
  assert.equal(calls,2);
});
test('business bridge rejects oversized bodies and invalid credentials before forwarding',async()=>{
  let calls=0;const proxy=createBusinessProxy({env,fetchImpl:async()=>{calls++;}});
  const request=new Request(PREVIEW_ORIGIN+'/api/catalog/products',{method:'POST',headers:{origin:PREVIEW_ORIGIN,'content-type':'application/json','x-vercel-forwarded-for':'203.0.113.5'},body:'x'.repeat(32769)});
  assert.equal((await proxy(request)).status,413);assert.equal(calls,0);
  assert.equal((await createBusinessProxy({env:{...env,VERCEL_GIT_COMMIT_REF:'main'},fetchImpl:async()=>{calls++;}})(new Request(PREVIEW_ORIGIN+'/api/catalog/products'))).status,503);
  assert.equal(calls,0);
});
