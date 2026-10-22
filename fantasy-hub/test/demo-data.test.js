import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
function demo(){
 const s=read('script.js'),c=vm.createContext({});
 vm.runInContext('const number=v=>typeof v==="number"&&Number.isFinite(v)?v:null;const sum=xs=>xs.reduce((a,b)=>a+(number(b)??0),0);'+s.slice(s.indexOf('function makeDemo()'),s.indexOf('function updateUI()'))+';var model=makeDemo();',c);
 return JSON.parse(JSON.stringify(c.model));
}
const round1=v=>Math.round(v*10)/10;

test('exhibition schedule, scores and records are internally consistent',()=>{
 const m=demo(),byId=new Map(m.teams.map(t=>[t.id,t]));
 for(const t of m.teams){
  let wins=0,losses=0,ties=0;
  assert.deepEqual(t.history.map(h=>h.week),m.weeks);
  for(const h of t.history){
   const opp=byId.get(h.opponentId),theirs=opp.history.find(x=>x.week===h.week);
   assert.notEqual(h.opponentId,t.id);
   assert.equal(theirs.opponentId,t.id,`W${h.week} ${t.name} schedule is reciprocal`);
   assert.equal(theirs.points,h.oppPoints,`W${h.week} ${t.name} opponent score comes from one source`);
   assert.equal(round1(Object.values(h.starters).reduce((a,b)=>a+b,0)),h.points,`W${h.week} ${t.name} starters sum to team total`);
   if(h.points>h.oppPoints)wins++;else if(h.points<h.oppPoints)losses++;else ties++;
  }
  assert.deepEqual([t.wins,t.losses,t.ties],[wins,losses,ties],`${t.name} record follows results`);
  assert.equal(new Set(t.history.map(h=>h.opponentId)).size,t.history.length,`${t.name} meets distinct opponents`);
 }
});

test('every exhibition franchise starts the same nine lineup slots with a bench',()=>{
 const m=demo(),labels={0:'QB',2:'RB',4:'WR',6:'TE',23:'FLEX',16:'D/ST',17:'K'},order=['QB','RB','RB','WR','WR','TE','FLEX','D/ST','K'];
 for(const t of m.teams)for(const h of t.history){
  const starters=h.lineup.filter(r=>r.starter);
  assert.deepEqual(starters.map(r=>labels[r.slot]).sort(),[...order].sort(),`${t.name} W${h.week}`);
  assert.deepEqual(Object.keys(h.starters).sort(),starters.map(r=>r.id).sort());
  if(t.id!=="1")assert.ok(h.lineup.some(r=>!r.starter),`${t.name} keeps a bench`);
 }
 const mine=m.teams[0].history.at(-1).starters;
 for(const id of ['cook','deebo','demo-flex'])assert.ok(id in mine,`${id} fills an open starting slot`);
});

test('exhibition player names are clean, unique and never duplicate a free agent',()=>{
 const m=demo(),names=Object.values(m.players).map(p=>p.name);
 assert.equal(new Set(names).size,names.length);
 for(const name of names)assert.doesNotMatch(name,/\s\d+$/);
 const agents=[...read('explorer.js').matchAll(/\{id:'fa\d+',name:'([^']+)'/g)].map(x=>x[1]);
 assert.ok(agents.length>5);
 for(const name of agents)assert.ok(!names.includes(name),`${name} is both rostered and a free agent`);
});
