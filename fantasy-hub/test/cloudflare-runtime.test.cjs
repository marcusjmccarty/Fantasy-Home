const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {Miniflare,convertV4MiniflareOptions,Response}=require('miniflare');

test('Cloudflare runtime can import a cookie-authenticated league without following redirects',async()=>{
  const calls=[];
  let redirect=false;
  const mf=new Miniflare(convertV4MiniflareOptions({
    modules:[{type:'ESModule',path:path.resolve(__dirname,'../src/worker.js')},{type:'ESModule',path:path.resolve(__dirname,'../src/matchup-context.js')},{type:'ESModule',path:path.resolve(__dirname,'../src/public-read-coalescer.js')}],
    compatibilityDate:'2026-10-01',
    durableObjects:{ESPN_SESSIONS:{className:'EspnSession',useSQLite:true}},
    outboundService:async request=>{
      calls.push({url:request.url,cookie:request.headers.get('Cookie')});
      return redirect
        ? new Response('',{status:302,headers:{Location:'https://untrusted.example/collect'}})
        : new Response(JSON.stringify({teams:[{id:1}],scoringPeriodId:1}),{headers:{'Content-Type':'application/json'}});
    }
  }));
  const connect=()=>mf.dispatchFetch('https://hub.example/api/espn/league',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({leagueId:'1',season:2026,swid:'{fixture-owner}',s2:'fixture-only'})
  });
  try{
    const response=await connect();
    assert.equal(response.status,200,await response.text());
    assert.equal(calls.length,2);
    assert.ok(calls.every(c=>new URL(c.url).origin==='https://lm-api-reads.fantasy.espn.com'));
    assert.ok(calls.every(c=>c.cookie==='SWID={fixture-owner}; espn_s2=fixture-only'));
    redirect=true;
    calls.length=0;
    const refused=await connect();
    assert.equal(refused.status,502);
    assert.match(await refused.text(),/unexpected redirect/);
    assert.equal(calls.length,1);
    assert.ok(!calls.some(c=>c.url.includes('untrusted.example')));
  }finally{await mf.dispose();}
});

test('Cloudflare runtime shares public cold reads without forwarding caller cookies',async()=>{
  let calls=0,release,started;
  const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const mf=new Miniflare(convertV4MiniflareOptions({
    modules:[{type:'ESModule',path:path.resolve(__dirname,'../src/worker.js')},{type:'ESModule',path:path.resolve(__dirname,'../src/matchup-context.js')},{type:'ESModule',path:path.resolve(__dirname,'../src/public-read-coalescer.js')}],
    compatibilityDate:'2026-10-01',
    durableObjects:{ESPN_SESSIONS:{className:'EspnSession',useSQLite:true}},
    outboundService:async request=>{
      calls++;assert.equal(request.headers.get('Cookie'),null);assert.equal(request.headers.get('Authorization'),null);started();await gate;
      return new Response(JSON.stringify({events:[]}),{headers:{'Content-Type':'application/json'}});
    }
  }));
  try{
    const pending=Array.from({length:12},(_,i)=>mf.dispatchFetch('https://hub.example/api/nfl/game-status?season=2031&week=7',{headers:{Cookie:'fixture-user='+i,Authorization:'Bearer fixture-'+i}}));
    await ready;await new Promise(r=>setTimeout(r,30));assert.equal(calls,1);release();
    const results=await Promise.all(pending);assert.ok(results.every(r=>r.status===200));
    const bodies=await Promise.all(results.map(r=>r.json()));assert.ok(bodies.every(b=>b.season===2031&&b.week===7));
    assert.equal(calls,1);
  }finally{release();await mf.dispose();}
});
