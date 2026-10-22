import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/analytics-math.js';
const M=globalThis.FantasyMath;
const player=(id,pos,points)=>({id,pos,scores:{1:points,2:points,3:points,4:points},projections:{5:points}});
test('outlook excludes current/future weeks, preserves zeros, anchors to provider',()=>{
 const o=M.outlook({scores:{1:0,2:10,3:20,4:30,5:1000,6:999},projections:{5:25}},5);
 assert.equal(o.sample,4);assert.equal(o.mean,15);assert.equal(o.center,25);assert.equal(o.floor,16);assert.equal(o.ceiling,34);
});
test('floor and ceiling require four scores and never invent missing values',()=>{
 const o=M.outlook({scores:{1:null,2:'',3:0},espnProj:0},5);assert.equal(o.sample,1);assert.equal(o.center,0);assert.equal(o.floor,null);assert.equal(o.ceiling,null);
 assert.equal(M.outlook({},5).center,null);assert.equal(M.packageValue([{}],5,'projection').total,null);
});
test('negative fantasy points and all-zero histories remain valid',()=>{
 const o=M.outlook({scores:{1:-4,2:-2,3:0,4:2}},5);assert.equal(o.mean,-1);assert.ok(o.floor<0);assert.ok(o.ceiling>0);
 assert.equal(M.outlook(player('a','QB',0),5).floor,0);
});
test('history and balanced modes use only prior games; projection-only is strict',()=>{
 const p={scores:{1:10,2:10,3:10,4:10,5:100},projections:{5:20}};
 assert.equal(M.value(p,5,'history'),10);assert.equal(M.value(p,5,'balanced'),16);assert.equal(M.value(p,5,'projection'),20);assert.equal(M.value({scores:{1:10}},5,'projection'),null);
});
test('lineup optimization reserves positional players and never duplicates in FLEX',()=>{
 const players=[player('rb1','RB',20),player('rb2','RB',19),player('wr1','WR',18),player('wr2','WR',17),player('te','TE',9)];
 const lineup=M.bestLineup(players,['RB','WR','TE','FLEX'],5,'projection');
 assert.equal(lineup.total,66);assert.equal(new Set(lineup.players.map(p=>p.player)).size,4);
 assert.equal(M.bestLineup(players,['QB','FLEX'],5,'projection'),null);
});
test('superflex, duplicate IDs, negative points and missing estimates are handled',()=>{
 const q=player('q','QB',20),r=player('r','RB',10),d=player('d','DEF',-2);
 assert.equal(M.bestLineup([q,q,r],['QB','SUPERFLEX'],5,'projection').total,30);
 assert.equal(M.bestLineup([d],['DEF'],5,'projection').total,-2);
 assert.equal(M.bestLineup([{id:'a',pos:'QB'}],['QB'],5,'projection'),null);
});
test('empty packages have zero value but partial packages remain unavailable',()=>{
 assert.equal(M.packageValue([],5,'projection').total,0);assert.equal(M.packageValue([player('q','QB',20),{id:'x'}],5,'projection').missing,1);
});
test('historical ranges never borrow current projections or their own outcomes',()=>{
 const p={espnProj:999,scores:{1:0,2:10,3:20,4:30,5:100,6:900},projections:{5:25}};
 const rows=M.scoringHistory(p,6),week5=rows.find(r=>r.week===5),week4=rows.find(r=>r.week===4);
 assert.equal(rows.length,5);assert.equal(week5.floor,16);assert.equal(week5.ceiling,34);assert.equal(week5.projection,25);assert.equal(week5.actual,100);
 assert.equal(week4.center,10);assert.equal(week4.projection,null);assert.equal(week4.floor,null);
 assert.equal(M.scoringHistory({...p,scores:{...p.scores,5:9999,6:99999}},6).find(r=>r.week===5).ceiling,34);
});

test('projection position preserves asymmetric scoring history rather than forcing midpoint',()=>{
 const o=M.outlook({scores:{1:3,2:4,3:5,4:6,5:14,6:30},projections:{7:17}},7);
 assert.notEqual(o.center,(o.floor+o.ceiling)/2);
 const fraction=(o.center-o.floor)/(o.ceiling-o.floor);assert.ok(fraction>.5);
 assert.deepEqual(M.scoringHistory({scores:{3:3,1:1,2:2}},4).map(r=>r.week),[1,2,3]);
});
test('TD model ignores future games, shrinks noisy frequency and requires coverage',()=>{
 const row=(id,td)=>({gsis_id:id,position:'RB',weeks:Object.fromEntries([1,2,3,4].map(w=>[w,{carries:10,targets:2,receptions:1,rushing_tds:td,receiving_tds:0,redzone_carries:2}]))});
 const a=row('a',1),b=row('b',.5),data={td_schema:1,players:[a,b]};
 const o=M.touchdownEstimate(a,data,5);assert.equal(o.lambda,.75);assert.ok(Math.abs(o.chance-52.7633)<.001);
 a.weeks[5]={carries:100,rushing_tds:99};assert.equal(M.touchdownEstimate(a,data,5).chance,o.chance);
 assert.equal(M.touchdownEstimate(a,{players:[a,b]},5),null);assert.equal(M.touchdownEstimate(a,data,4),null);
 assert.equal(M.touchdownEstimate(row('zero',0),{td_schema:1,players:[row('zero',0),row('peer',0)]},5).chance,0);
});
test('weekly share chart uses the matching team denominator and chronological weeks',()=>{
 const rows=M.weeklyShares({weeks:{2:{carries:5,targets:5,team_totals:{carries:20,targets:30}},1:{carries:0,targets:0,team_totals:{carries:0,targets:0}},3:{carries:99}}},3);
 assert.deepEqual(rows,[{week:1,share:null},{week:2,share:20}]);
});
test('trade analysis exposes consolidation benefit, both teams and optional drops',()=>{
 const own=[player('r1','RB',20),player('r2','RB',15),player('r3','RB',8)],their=[player('q1','RB',25),player('q2','RB',5)];
 const a=M.tradeAnalysis(own,their,['r2','r3'],['q1'],['RB','FLEX'],5,'projection');
 assert.equal(a.delta,2);assert.equal(a.impact,10);assert.equal(a.theirImpact,-7);assert.equal(a.afterOwn.length,2);
 assert.equal(M.tradeAnalysis(own,their,['r2','r3'],['q1'],['RB','FLEX'],5,'projection',{give:['r1'],get:[]}).after,null);
 assert.equal(M.tradeAnalysis(own,their,[],[],['RB'],5).ready,false);
});

test('optimized lineups match exhaustive slot assignments across mixed and incomplete rosters',()=>{
 const allows={QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],FLEX:['RB','WR','TE'],SUPERFLEX:['QB','RB','WR','TE'],K:['K'],DEF:['DEF','D/ST']};
 const exhaustive=(roster,slots,mode)=>{
  const unique=[...new Map(roster.map(p=>[String(p.id),p])).values()];let best=-Infinity;
  const visit=(slot,used,total)=>{if(slot===slots.length){best=Math.max(best,total);return;}for(let i=0;i<unique.length;i++){const p=unique[i],score=M.value(p,5,mode);if(!used.has(i)&&score!==null&&allows[slots[slot]].includes(p.pos))visit(slot+1,new Set([...used,i]),total+score);}};
  visit(0,new Set(),0);return best===-Infinity?null:best;
 };
 let seed=29;const next=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const formats=[['RB','RB','WR','FLEX'],['QB','SUPERFLEX','FLEX','TE'],['WR','WR','WR','FLEX'],['K','DEF','FLEX']];
 for(let n=0;n<80;n++){
  const roster=Array.from({length:8},(_,i)=>{const p=player(String(i),['QB','RB','WR','TE','K','D/ST'][next(6)],next(31)-10);if(next(7)===0){p.scores={};p.projections={};}return p;});
  roster.push({...roster[0],projections:{5:next(20)}});
  const slots=formats[n%formats.length],mode=['balanced','projection','history','floor','ceiling'][n%5],expected=exhaustive(roster,slots,mode),actual=M.bestLineup(roster,slots,5,mode);
  if(expected===null){assert.equal(actual,null);continue;}
  assert.ok(Math.abs(actual.total-expected)<1e-9,`case ${n}`);
  assert.equal(new Set(actual.players.map(p=>p.player)).size,slots.length);
  assert.equal(new Set(actual.players.map(p=>p.index)).size,slots.length);
  for(const chosen of actual.players){const p=roster.findLast(p=>p.id===chosen.player);assert.ok(allows[slots[chosen.index]].includes(p.pos));assert.equal(chosen.points,M.value(p,5,mode));}
  assert.ok(Math.abs(actual.players.reduce((sum,p)=>sum+p.points,0)-actual.total)<1e-9);
 }
});
test('trade batches reuse baseline work and fresh batches pick up changed scores, mode and week',()=>{
 const own=[player('a','RB',10),player('b','RB',5)],their=[player('c','RB',15),player('d','RB',8)];
 let reads=0;own[0].projections=new Proxy({5:10,6:30},{get:(target,key)=>{reads++;return target[key];}});
 const evaluate=M.createTradeEvaluator(own,their,['RB'],5,'projection'),initialReads=reads;
 assert.equal(evaluate(['b'],['c']).impact,5);assert.equal(evaluate(['a'],['d']).impact,-2);assert.equal(reads,initialReads);
 assert.equal(evaluate(['b'],['c'],{give:['a']}).afterOwn.length,1);
 own[0].projections[5]=20;
 assert.equal(M.createTradeEvaluator(own,their,['RB'],5,'projection')(['b'],['c']).before.total,20);
 assert.equal(M.createTradeEvaluator(own,their,['RB'],6,'projection')(['b'],['c']).before.total,30);
 assert.equal(M.createTradeEvaluator(own,their,['RB'],5,'history')(['b'],['c']).before.total,10);
});

test('trade percentages distinguish exchanged value from actual lineup improvement',()=>{
 const a={ready:true,sent:{total:20},received:{total:30},before:{total:100},theirBefore:{total:80},impact:5,theirImpact:-4};
 assert.deepEqual(M.tradeSignals(a),{yourShare:60,theirShare:40,yourChange:5,theirChange:-5});
 assert.equal(M.tradeSignals({...a,sent:{total:-2}}).yourShare,null);
 assert.equal(M.tradeSignals({...a,before:{total:0}}).yourChange,null);
 assert.equal(M.tradeSignals({...a,ready:false}).theirChange,null);
 assert.equal(M.tradeSignals({...a,impact:null}).yourChange,null);
});
