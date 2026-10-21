const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {Miniflare,convertV4MiniflareOptions,Response}=require('miniflare');

test('Cloudflare runtime can import a cookie-authenticated league without following redirects',async()=>{
  const calls=[];
  let redirect=false;
  const mf=new Miniflare(convertV4MiniflareOptions({
    modules:true,
    scriptPath:path.resolve(__dirname,'../src/worker.js'),
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
