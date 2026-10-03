import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { ORIGIN, UPSTREAM } from './worker.mjs';
const url = 'https://proxy.example/v1/chat/completions';
test('models GET forwards only to fixed models endpoint and preserves provider errors', async (t) => {
 t.mock.method(globalThis,'fetch',async (destination,options)=>{
  assert.equal(destination,UPSTREAM.replace('/chat/completions','/models')); assert.equal(options.method,'GET'); assert.equal(options.body,undefined);
  return new Response('{"error":"invalid key"}',{status:401,headers:{'Content-Type':'application/json'}});
 });
 const r=await worker.fetch(new Request('https://proxy.example/v1/models',{headers:{Origin:ORIGIN,Authorization:'Bearer test'}}));
 assert.equal(r.status,401); assert.equal(r.headers.get('Access-Control-Allow-Origin'),ORIGIN);
});
test('preflight permits only our origin; no auth required for OPTIONS', async () => {
 const r = await worker.fetch(new Request(url, {method:'OPTIONS',headers:{Origin:ORIGIN}}));
 assert.equal(r.status,204); assert.equal(r.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.equal((await worker.fetch(new Request(url,{method:'OPTIONS',headers:{Origin:'https://other.example'}}))).status,403);
});
test('requires user key and streams fixed upstream without forwarding browser headers', async (t) => {
 assert.equal((await worker.fetch(new Request(url,{method:'POST',headers:{Origin:ORIGIN}}))).status,401);
 t.mock.method(globalThis,'fetch',async (destination,options)=>{
  assert.equal(destination,UPSTREAM); assert.equal(options.redirect,'manual'); assert.equal(options.headers.Authorization,'Bearer test-key'); assert(!options.headers.Origin);
  return new Response('data: hello\n\n',{headers:{'Content-Type':'text/event-stream'}});
 });
 const r=await worker.fetch(new Request(url,{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer test-key','Content-Type':'application/json'},body:JSON.stringify({model:'test',messages:[]})}));
 assert.equal(await r.text(),'data: hello\n\n'); assert.equal(r.headers.get('Cache-Control'),'no-store');
});
