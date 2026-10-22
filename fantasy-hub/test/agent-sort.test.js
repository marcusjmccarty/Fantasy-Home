import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/explorer.js',import.meta.url),'utf8');
function fixture(){
 const c=vm.createContext({});
 vm.runInContext(source.slice(0,source.indexOf('function teamForPlayer('))+source.slice(source.indexOf('const NFL_SEARCH_TEAMS='),source.indexOf('function detailAgents(')),c);
 // Frozen pre-change behavior, used as an ordering oracle with real metric helpers.
 vm.runInContext(`function reference(){let list=XL.free;const a=XL.agent;
 if(a.pos!=='ALL')list=list.filter(p=>a.pos==='DEF'?['DEF','D/ST'].includes(p.pos):p.pos===a.pos);
 if(a.search){const query=a.search.trim().toLowerCase();const exactTeamCode=query.toUpperCase();list=list.filter(p=>Object.hasOwn(NFL_SEARCH_TEAMS,exactTeamCode)?String(p.nfl||'').toUpperCase()===exactTeamCode:(String(p.name||'')+' '+nflSearchText(p.nfl)).includes(query));}
 return [...list].sort((x,y)=>(metricValue(y,a.sort)??-Infinity)-(metricValue(x,a.sort)??-Infinity));}`,c);
 return {c,...vm.runInContext('({XL,list:agentList,reference,keys:METRICS.map(x=>x[0]),nameKey})',c)};
}
const positions=['QB','RB','WR','TE','K','DEF','D/ST'];
function players(n){return Array.from({length:n},(_,i)=>({id:String(i),name:['Jordan Vale','Avery Knight','Missing','ZERO','Duplicate'][i%5],pos:positions[i%7],nfl:['SEA','CHI','NYG','JAX','LAR','WAS','WSH',null][i%8],espnProj:[null,0,-5,'12.5',NaN,Infinity,12.5][i%7],owned:[undefined,0,12,100,'',-Infinity][i%6],scores:i%3?{1:0,2:i%11-4,3:i%7,4:null,19:999}:{},seasonTotal:i%4?null:'99',statlines:{1:{3:i%20,58:0},2:{3:2,58:i%5}}}))}
const ids=rows=>Array.from(rows,p=>p.id);
test('agent ordering matches prior implementation across sizes, all UI sorts, positions and searches',()=>{
 const f=fixture();let cases=0;
 for(const n of [0,1,14,60,300,1000]){
  f.XL.free=players(n);const original=[...f.XL.free];
  f.XL.advanced.set(f.nameKey('Avery Knight'),{projected:0,avg:77,owned:NaN,total:-3,recent:null});
  for(const sort of ['projected','avg','owned','total','recent'])for(const pos of ['ALL',...positions])for(const search of ['', 'a',' SEA ','Chicago','NYG','Jags','St Louis','Washington','not-a-player','   ']){
   Object.assign(f.XL.agent,{sort,pos,search});assert.deepEqual(ids(f.list()),ids(f.reference()),JSON.stringify({n,sort,pos,search}));cases++;
  }
  assert.deepEqual(f.XL.free,original);assert.ok(f.list().every(p=>original.includes(p)));
 }
 assert.equal(cases,2400);
});
test('all metric keys retain advanced overrides, null/NaN handling and stable ties',()=>{
 const f=fixture();f.XL.free=players(60);
 for(const key of f.keys){f.XL.agent.sort=key;f.XL.advanced.set('jordanvale',{[key]:'23.5'});assert.deepEqual(ids(f.list()),ids(f.reference()),key)}
 f.XL.advanced.clear();f.XL.agent.sort='projected';f.XL.free=Array.from({length:20},(_,i)=>({id:String(i),name:'Tie '+i,espnProj:i%2?NaN:null}));assert.deepEqual(ids(f.list()),ids(f.XL.free));
 f.XL.free.forEach(p=>p.espnProj=0);assert.deepEqual(ids(f.list()),ids(f.XL.free));
});
test('new data and advanced updates are reflected on every call without persistent cached values',()=>{
 const f=fixture();f.XL.free=players(60);
 for(const change of [()=>{f.XL.free[0].espnProj=999},()=>f.XL.advanced.set('jordanvale',{projected:-999}),()=>f.XL.advanced.clear(),()=>{f.XL.agent.sort='total';f.XL.free[0].scores={1:999}},()=>{f.XL.free=[...players(14)].reverse()},()=>{f.XL.agent.search='CHI';f.XL.free[0].nfl='CHI'}]){change();assert.deepEqual(ids(f.list()),ids(f.reference()))}
});
test('metric evaluation is bounded to once per filtered player per call',()=>{
 const f=fixture();f.XL.free=players(1000);f.XL.agent.pos='WR';
 vm.runInContext('var calls=0;const originalMetricValue=metricValue;metricValue=(...a)=>{calls++;return originalMetricValue(...a)}',f.c);
 const rows=f.list();assert.equal(f.c.calls,rows.length);f.list();assert.equal(f.c.calls,rows.length*2);
});
