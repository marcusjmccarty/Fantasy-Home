// Hand-solved fictional rosters. Every expected number below was worked out on
// paper from the lineup rules (QB, RB, RB, WR, WR, TE, FLEX) before running.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/analytics-math.js';
const M=globalThis.FantasyMath,W=7;
const SLOTS=['QB','RB','RB','WR','WR','TE','FLEX'];
const pl=(id,pos,points,extra={})=>({id,pos,projections:{[W]:points},...extra});
const near=(a,b)=>Math.abs(a-b)<1e-9;
const key=r=>r.give.join('+')+' for '+r.get.join('+');

// Team A: RB-rich, weak WR2. Team B: WR-rich, weak RB2.
// A before: QB20 RB 18+16 WR 14+6 TE8 FLEX RB15 = 97 (bench RB a6=12).
// B before: QB20 RB 17+5  WR 16+15 TE8 FLEX WR14 = 95 (bench WR b6=11).
const A=[pl('a1','QB',20),pl('a2','RB',18),pl('a3','RB',16),pl('a4','RB',15),pl('a6','RB',12),pl('a7','WR',14),pl('a8','WR',6),pl('a9','TE',8)];
const B=[pl('b1','QB',20),pl('b2','RB',17),pl('b3','RB',5),pl('b4','WR',16),pl('b5','WR',15),pl('b7','WR',14),pl('b6','WR',11),pl('b8','TE',8)];

test('baseline lineups use starters first and FLEX takes the best leftover RB/WR/TE',()=>{
 assert.equal(M.bestLineup(A,SLOTS,W,'projection').total,97);
 assert.equal(M.bestLineup(B,SLOTS,W,'projection').total,95);
});
test('surplus RB for surplus WR improves both lineups by the hand-computed amounts',()=>{
 // A gives RB a4 (15), gets WR b7 (14): A = QB20 RB18+16 WR14+14 TE8 FLEX a6 12 = 102 (+5).
 // B gets a4: RB 17+15, WR 16+15, FLEX b6 11 = 102 (+7).
 const a=M.tradeAnalysis(A,B,['a4'],['b7'],SLOTS,W);
 assert.equal(a.impact,5);assert.equal(a.theirImpact,7);
 const r=M.searchTrades(A,B,SLOTS,W);
 assert.ok(r.results.length>0,'mutual trades exist');
 assert.ok(r.results.every(x=>x.impact>=M.MIN_GAIN&&x.theirImpact>=M.MIN_GAIN));
 // Best shared gain is +6 / +6, reached two ways:
 // a4 (15) for b5 (15): A RB18+16 WR15+14 FLEX a6 12 = 103; B RB17+15 WR16+14 FLEX b6 11 = 101.
 // a3 (16) for b4 (16): A RB18+15 WR16+14 FLEX a6 12 = 103; B RB17+16 WR15+14 FLEX b6 11 = 101.
 // a4 for b4 gives +7 / +5, so it ranks below them (smaller gain 5).
 assert.deepEqual(new Set(r.results.slice(0,2).map(key)),new Set(['a4 for b5','a3 for b4']));
 for(const x of r.results.slice(0,2))assert.ok(near(x.impact,6)&&near(x.theirImpact,6));
 const third=r.results.find(x=>key(x)==='a4 for b4');assert.ok(near(third.impact,7)&&near(third.theirImpact,5));
 // Ranking is by the smaller of the two gains, never increasing down the list.
 for(let i=1;i<r.results.length;i++)assert.ok(Math.min(r.results[i].impact,r.results[i].theirImpact)<=Math.min(r.results[i-1].impact,r.results[i-1].theirImpact)+1e-9);
});
test('2-for-1 consolidation names the drop and still helps both lineups',()=>{
 // A gives a4+a6 (RB 15, 12) for b4 (WR 16). A: WR16+14, FLEX? RBs 18,16 used, no extra
 // RB/WR/TE left except a8 WR6 → FLEX 6. Total 20+34+30+8+6 = 98 (+1).
 // B receives two RBs and must drop one: best drop is bench b3 (5).
 // B: RB17+15 WR15+14 TE8 FLEX a6 12 ... 20+32+29+8+12 = 101 (+6).
 const r=M.searchTrades(A,B,SLOTS,W,'projection',{collapse:false});
 const deal=r.results.find(x=>key(x)==='a4+a6 for b4');
 assert.ok(deal,'2-for-1 found');assert.deepEqual(deal.drops,{give:[],get:['b3']});
 assert.ok(near(deal.impact,1)&&near(deal.theirImpact,6));
});
test('no surplus on either bench: correctly empty, explained, with near-even options',()=>{
 // C and D each hold exactly one useful player per slot plus a worthless bench.
 const C=[pl('c1','QB',20),pl('c2','RB',16),pl('c3','RB',14),pl('c4','WR',15),pl('c5','WR',13),pl('c6','TE',8),pl('c7','WR',12),pl('c8','K',1)];
 const D=[pl('d1','QB',19),pl('d2','RB',15),pl('d3','RB',13),pl('d4','WR',16),pl('d5','WR',14),pl('d6','TE',9),pl('d7','RB',11),pl('d8','K',1)];
 // Every player C could send would leave a hole worth more than what comes back.
 const r=M.searchTrades(C,D,SLOTS,W);
 assert.equal(r.results.length,0);
 assert.equal(r.diagnosis.reason,'no-surplus');
 assert.deepEqual(r.diagnosis.ownSurplus,[]);assert.deepEqual(r.diagnosis.theirSurplus,[]);
 assert.ok(r.near.length>0,'closest options are offered');
 for(const x of r.near)assert.ok(Math.max(x.impact,x.theirImpact)>=.5&&Math.min(x.impact,x.theirImpact)<M.MIN_GAIN);
});
test('a missing kicker is an empty slot worth zero, not an unsearchable roster',()=>{
 // E has two QBs and no K; F has two Ks and one QB. QB+K league.
 // E before: QB20 + empty K = 20. F before: QB10 + K8 = 18.
 // E gives QB15 for K7: E = 20+7 = 27 (+7); F = QB15 + K8 = 23 (+5).
 const E=[pl('e1','QB',20),pl('e2','QB',15)],F=[pl('f1','QB',10),pl('f2','K',8),pl('f3','K',7)];
 const r=M.searchTrades(E,F,['QB','K'],W);
 assert.equal(r.unavailable,undefined);
 assert.equal(key(r.results[0]),'e2 for f3');assert.equal(r.results[0].impact,7);assert.equal(r.results[0].theirImpact,5);
 const lineup=M.tradeAnalysis(E,F,[],[], ['QB','K'],W).before;
 assert.equal(lineup.total,20);assert.equal(lineup.empty,1);
});
test('bye and injury: projection mode zeroes the week; rest-of-season mode does not',()=>{
 // G's WR g3 is on bye (value 0 this week) but averages 18. H needs a WR.
 const G=[pl('g1','QB',20),pl('g2','WR',15),pl('g3','WR',18,{tradeUnavailable:true,scores:{1:18,2:18,3:18,4:18}}),pl('g4','WR',9,{scores:{1:9,2:9,3:9,4:9}}),pl('g5','RB',14),pl('g6','RB',12)];
 for(const p of G)p.scores??={1:p.projections[W],2:p.projections[W]};
 assert.equal(M.tradeValue(G[2],W,'projection'),0);
 assert.equal(M.tradeValue(G[2],W,'season'),18);
 // A season-long absence (IR) stays at zero in every mode.
 assert.equal(M.tradeValue({...G[2],seasonUnavailable:true},W,'season'),0);
 // Rest of season blends projection and prior average equally.
 assert.equal(M.seasonValue(pl('s','RB',20,{scores:{1:10,2:14}}),W),16);
 assert.equal(M.seasonValue(pl('s','RB',null,{scores:{1:10,2:14}}),W),12);
 assert.equal(M.seasonValue(pl('s','RB',20,{status:'OUT',scores:{1:10,2:14}}),W),12);
});
test('status classes cover ESPN and Sleeper spellings',()=>{
 for(const s of ['IR','INJURY_RESERVE','INJURED_RESERVE','Sus','SUSPENSION','PUP','Injured Reserve'])assert.equal(M.unavailability(s),'season',s);
 for(const s of ['OUT','O'])assert.equal(M.unavailability(s),'week',s);
 for(const s of ['ACTIVE','QUESTIONABLE','DOUBTFUL','',null])assert.equal(M.unavailability(s),null,String(s));
});
test('every reported mutual trade is confirmed by an independent brute-force check',()=>{
 // Independent solver for this slot set: fill fixed slots greedily per position,
 // then FLEX with the best leftover — exact when FLEX is the only shared slot.
 const v=p=>p.projections[W];
 const best=r=>{let t=0;const left=[];for(const [pos,n] of [['QB',1],['RB',2],['WR',2],['TE',1]]){const l=r.filter(p=>p.pos===pos).sort((a,b)=>v(b)-v(a));t+=l.slice(0,n).reduce((s,p)=>s+v(p),0);left.push(...l.slice(n).filter(p=>pos!=='QB'));}left.sort((a,b)=>v(b)-v(a));return t+(left[0]?v(left[0]):0);};
 const pk=r=>r.flatMap((p,i)=>[[p],...r.slice(i+1).map(q=>[p,q])]),combos=(a,k)=>k?a.flatMap((x,i)=>combos(a.slice(i+1),k-1).map(r=>[x,...r])):[[]];
 const expected=new Set(),a0=best(A),b0=best(B);
 for(const g of pk(A))for(const r of pk(B)){
  const ra=A.filter(p=>!g.includes(p)),rb=B.filter(p=>!r.includes(p));
  let ok=false;for(const da of combos(ra,Math.max(0,r.length-g.length)))for(const db of combos(rb,Math.max(0,g.length-r.length)))
   if(best([...ra.filter(p=>!da.includes(p)),...r])-a0>=.05&&best([...rb.filter(p=>!db.includes(p)),...g])-b0>=.05)ok=true;
  if(ok)expected.add(g.map(p=>p.id).join('+')+' for '+r.map(p=>p.id).join('+'));
 }
 const found=M.searchTrades(A,B,SLOTS,W,'projection',{collapse:false});
 assert.deepEqual(new Set(found.results.map(key)),expected);
 // The default view hides only packages that add a throw-in to a listed deal.
 const shown=M.searchTrades(A,B,SLOTS,W);
 assert.equal(shown.results.length+shown.hidden,found.results.length);
});
test('team share uses numeric team totals even when they arrive as strings',()=>{
 assert.deepEqual(M.weeklyShares({weeks:{1:{carries:5,targets:5,team_totals:{carries:'20',targets:'30'}}}},3),[{week:1,share:20}]);
});
