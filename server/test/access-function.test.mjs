import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccessFunction} from '../access-function.mjs';
const {Request,Response}=globalThis;
const origin='https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'development',PREVIEW_ACCESS_ENABLED:'true',PREVIEW_ACCESS_ORIGIN:origin,
  PREVIEW_ACCESS_BRIDGE_ORIGIN:'https://synthetic.trycloudflare.com',PREVIEW_ACCESS_BRIDGE_KEY:'a'.repeat(64)};
const headers={'x-vercel-forwarded-for':'203.0.113.50',origin,'content-type':'application/json'};
test('Function consumes only exact catch-all route metadata and preserves POST body',async()=>{
  let called=0;
  const handler=createAccessFunction({env,fetchImpl:async(url,options)=>{
    called++;assert.equal(new URL(url).search,'');
    if(options.method==='POST')assert.deepEqual(JSON.parse(options.body.toString()),{email:'synthetic@example.test',password:'synthetic-password'});
    return new Response('{}',{status:401});
  }});
  assert.equal((await handler(new Request(origin+'/api/access/session?path=session',{headers}))).status,401);
  assert.equal((await handler(new Request(origin+'/api/access/login?path=login',{method:'POST',headers,body:JSON.stringify({email:'synthetic@example.test',password:'synthetic-password'})}))).status,401);
  assert.equal(called,2);
});
test('Function refuses mismatching/duplicate route metadata and arbitrary queries without traffic',async()=>{
  let called=0;const handler=createAccessFunction({env,fetchImpl:async()=>{called++;return new Response('{}',{status:401});}});
  for(const query of ['path=users','path=session&path=session','path=session&anything=1','offset=0&path=session'])
    assert.equal((await handler(new Request(origin+'/api/access/session?'+query,{headers}))).status,400);
  assert.equal(called,0);
});
