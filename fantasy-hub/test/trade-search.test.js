import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/analytics-math.js';
const M=globalThis.FantasyMath;
const player=(id,pos,points,eligibleSlots)=>({id,pos,projections:{7:points},eligibleSlots});
test('ESPN counts and player eligibility define custom starting lineups, excluding bench and IR',()=>{
 const config=M.leagueLineup({source:'espn',settings:{rosterSettings:{lineupSlotCounts:{0:2,2:2,4:3,6:1,7:1,16:1,17:1,23:2,11:1,20:7,21:2}}}});
 assert.equal(config.slots.length,14);assert.equal(config.source,'ESPN league settings');
 assert.ok(config.slots.every(s=>![20,21].includes(s.id)));
 const roster=config.slots.map((slot,i)=>player('p'+i,'UNKNOWN',i+1,[slot.id,20]));
 const lineup=M.bestLineup(roster,config.slots,7,'projection');
 assert.equal(lineup.players.length,14);assert.equal(lineup.total,105);
 assert.equal(M.bestLineup([player('qb','QB',20,[20])],[{id:0,label:'QB',positions:['QB']}],7,'projection'),null);
 assert.deepEqual(M.leagueLineup({source:'espn',teams:[]}).slots,[]);
});
test('Sleeper lineup settings and recorded ESPN starters retain their actual slots',()=>{
 assert.deepEqual(M.leagueLineup({rosterPositions:['QB','WR','SUPER_FLEX','BN','IR']}).slots,['QB','WR','SUPERFLEX']);
 const c=M.leagueLineup({teams:[{currentLineup:[{slot:0,starter:true},{slot:7,starter:true},{slot:20,starter:false}]}]});
 assert.deepEqual(c.slots.map(s=>s.id),[0,7]);
});
const own=[player('a1','RB',25),player('a2','RB',22),player('a3','WR',8),player('a4','WR',2)];
const their=[player('b1','WR',25),player('b2','WR',22),player('b3','RB',8),player('b4','RB',2)];
test('automatic trade search finds every feasible one- and two-player improvement for both teams',()=>{
 const originals=JSON.stringify([own,their]),slots=['RB','WR'],found=M.searchTrades(own,their,slots,7,'projection');
 assert.equal(found.checked,100);assert.equal(found.total,100);assert.equal(found.limited,false);
 assert.ok(found.results.some(r=>r.give.length!==r.get.length));
 const key=(give,get)=>give.join(',')+'|'+get.join(',');
 const expected=new Set(),packages=roster=>roster.flatMap((p,i)=>[[p.id],...roster.slice(i+1).map(q=>[p.id,q.id])]);
 // An independent exhaustive drop search checks the recommendations, including unequal packages.
 for(const give of packages(own))for(const get of packages(their)){
  const dropsA=get.length>give.length?own.filter(p=>!give.includes(p.id)).map(p=>[p.id]):[[]];
  const dropsB=give.length>get.length?their.filter(p=>!get.includes(p.id)).map(p=>[p.id]):[[]];
  for(const a of dropsA)for(const b of dropsB){const t=M.tradeAnalysis(own,their,give,get,slots,7,'projection',{give:a,get:b});if(t.impact>=.05&&t.theirImpact>=.05)expected.add(key(give,get));}
 }
 assert.deepEqual(new Set(found.results.map(r=>key(r.give,r.get))),expected);
 for(const r of found.results){
  const a=M.tradeAnalysis(own,their,r.give,r.get,slots,7,'projection',r.drops);
  assert.equal(a.impact,r.impact);assert.equal(a.theirImpact,r.theirImpact);
  assert.ok(a.afterOwn.length<=own.length&&a.afterTheir.length<=their.length);
  assert.ok(r.drops.give.every(id=>!r.give.includes(id)&&own.some(p=>p.id===id)));
  assert.ok(r.drops.get.every(id=>!r.get.includes(id)&&their.some(p=>p.id===id)));
 }
 assert.equal(JSON.stringify([own,their]),originals);
});
test('unavailable scores do not produce recommendations and searches report partial scope honestly',()=>{
 assert.equal(M.searchTrades(own,their,['QB'],7).unavailable,true);
 const partial=M.searchTrades(own,their,['RB','WR'],7,'projection',{limit:20});
 assert.equal(partial.checked,20);assert.equal(partial.limited,true);assert.match(partial.scope,/1-for-1/);
 assert.ok(partial.results.every(r=>r.give.length===1||r.get.length===1));
});
test('a full 17-player roster pair searches all 23,409 small-package combinations',()=>{
 const positions=['QB','RB','RB','WR','WR','TE','RB','K','DEF','QB','RB','WR','TE','WR','RB','WR','TE'];
 const roster=prefix=>positions.map((pos,i)=>player(prefix+i,pos,8+((i*7+(prefix==='a'?3:1))%22)));
 const r=M.searchTrades(roster('a'),roster('b'),['QB','RB','RB','WR','WR','TE','FLEX','K','DEF'],7,'projection');
 assert.equal(r.checked,23409);assert.equal(r.total,23409);assert.equal(r.limited,false);
});
