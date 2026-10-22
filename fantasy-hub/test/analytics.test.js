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
