import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReadCoalescer} from '../src/public-read-coalescer.js';
let instance=0;
const fresh=async()=> (await import(`../src/worker.js?public-read-test=${++instance}`)).default;
const req=(path,headers={})=>new Request('https://hub.example'+path,{headers});
const path='/api/nfl/game-status?season=2031&week=7';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};

test('public cold reads coalesce across callers without forwarding client credentials',async()=>{
 const worker=await fresh(),original=globalThis.fetch,gate=deferred();let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(new Headers(options.headers).has('Cookie'),false);assert.equal(new Headers(options.headers).has('Authorization'),false);await gate.promise;return Response.json({events:[]})};
 try{
  const pending=Array.from({length:20},(_,i)=>worker.fetch(req(path,{Cookie:`gridiron_session=${String(i).padStart(64,'a')}`,Authorization:'Bearer fixture-'+i}),{}));
  await new Promise(r=>setImmediate(r));assert.equal(calls,1);gate.resolve();
  const responses=await Promise.all(pending);assert.ok(responses.every(r=>r.status===200));
  const bodies=await Promise.all(responses.map(r=>r.json()));assert.ok(bodies.every(b=>b.season===2031&&b.week===7));
  bodies[0].opponents.injected='caller-only';assert.equal(bodies[1].opponents.injected,undefined);
  assert.equal((await (await worker.fetch(req(path),{})).json()).opponents.injected,undefined);assert.equal(calls,1);
 }finally{gate.resolve();globalThis.fetch=original}
});
test('failed shared requests are not cached and the next attempt can succeed',async()=>{
 const worker=await fresh(),original=globalThis.fetch;let calls=0,fail=true;
 globalThis.fetch=async()=>{calls++;await new Promise(r=>setImmediate(r));return fail?new Response('fixture error',{status:500}):Response.json({events:[]})};
 try{
  const failed=await Promise.all(Array.from({length:8},()=>worker.fetch(req(path),{})));assert.ok(failed.every(r=>r.status===502));assert.equal(calls,1);
  fail=false;const retry=await worker.fetch(req(path),{});assert.equal(retry.status,200);assert.equal(calls,2);
 }finally{globalThis.fetch=original}
});
test('public keys remain separate and expired cached values reload without stale delivery',async()=>{
 const worker=await fresh(),original=globalThis.fetch,now=Date.now;let time=now(),calls=0;
 let state='pre';Date.now=()=>time;globalThis.fetch=async()=>{calls++;return Response.json({events:[{status:{type:{state}},competitions:[{competitors:[{team:{abbreviation:'CHI'}},{team:{abbreviation:'DET'}}]}]}]})};
 try{
  await Promise.all([worker.fetch(req(path),{}),worker.fetch(req(path.replace('week=7','week=8')),{})]);assert.equal(calls,2);
  state='post';time+=74999;assert.equal((await (await worker.fetch(req(path),{})).json()).teams.CHI,'pre');assert.equal(calls,2);
  time+=2;const refreshed=await Promise.all(Array.from({length:5},()=>worker.fetch(req(path),{})));assert.equal(calls,3);
  assert.ok((await Promise.all(refreshed.map(r=>r.json()))).every(b=>b.teams.CHI==='post'));
 }finally{Date.now=now;globalThis.fetch=original}
});
test('bounded coalescer releases success, rejection and synchronous throws',async()=>{
 const read=createReadCoalescer(1),gate=deferred();let a=0,b=0;
 const first=read('a',()=>{a++;return gate.promise});const shared=read('a',()=>{a++;return 99});assert.equal(first,shared);
 await Promise.all([read('b',()=>{b++;return 1}),read('b',()=>{b++;return 2})]);assert.equal(b,2);
 gate.resolve(3);assert.equal(await first,3);assert.equal(a,1);
 assert.equal(await read('a',()=>4),4);
 await assert.rejects(read('bad',()=>{throw Error('fixture')}),/fixture/);
 assert.equal(await read('bad',()=>5),5);
 await assert.rejects(read('bad',()=>Promise.reject(Error('async fixture'))),/async fixture/);
 assert.equal(await read('bad',()=>6),6);
});
test('private session/free-agent requests still route independently to their own objects',async()=>{
 const worker=await fresh(),calls=[],a='a'.repeat(64),b='b'.repeat(64);
 const env={ESPN_SESSIONS:{idFromName:id=>id,get:id=>({fetch:async request=>{calls.push({id,path:new URL(request.url).pathname});return Response.json({owner:id})}})}};
 const responses=await Promise.all([a,b,a,b].map(id=>worker.fetch(req('/api/espn/free-agents',{Cookie:`gridiron_session=${id}`}),env)));
 assert.deepEqual(await Promise.all(responses.map(r=>r.json())),[a,b,a,b].map(owner=>({owner})));
 assert.equal(calls.length,4);assert.deepEqual(calls.map(c=>c.id),[a,b,a,b]);
 const sessions=await Promise.all([a,b].map(id=>worker.fetch(req('/api/espn/session',{Cookie:`gridiron_session=${id}`}),env)));
 assert.deepEqual(await Promise.all(sessions.map(r=>r.json())),[a,b].map(owner=>({owner})));
});
test('method and cross-origin checks reject requests before public loading',async()=>{
 const worker=await fresh(),original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected')};
 try{
  assert.equal((await worker.fetch(req(path,{Origin:'https://other.example'}),{})).status,403);
  assert.equal((await worker.fetch(new Request('https://hub.example'+path,{method:'POST'}),{})).status,405);
  assert.equal(calls,0);
 }finally{globalThis.fetch=original}
});
test('public overview keys distinguish both player ID and caller-supplied display name',async()=>{
 const worker=await fresh(),original=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{
  calls++;await new Promise(r=>setImmediate(r));const id=String(url).match(/athletes\/(\d+)/)[1];
  return Response.json({athlete:{id},news:[{headline:'Fixture article '+id,athleteId:id,links:{web:{href:'https://espn.com/story/'+id}}}]});
 };
 try{
  const pairs=[['1','First Name'],['1','First Name'],['1','Other Name'],['2','First Name']];
  const responses=await Promise.all(pairs.map(([id,name])=>worker.fetch(req('/api/espn/player-overview?'+new URLSearchParams({playerId:id,playerName:name})),{})));
  const bodies=await Promise.all(responses.map(r=>r.json()));assert.equal(calls,3);
  assert.deepEqual(bodies.map(b=>[b.playerId,b.playerName]),pairs);
 }finally{globalThis.fetch=original}
});
