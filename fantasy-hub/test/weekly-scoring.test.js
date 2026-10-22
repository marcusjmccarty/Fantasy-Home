import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/script.js',import.meta.url),'utf8');
const explorer=readFileSync(new URL('../public/explorer.js',import.meta.url),'utf8');
const slice=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
function setup(){
 const c=vm.createContext({model:{currentWeek:7,liveWeek:7},currentWeek:7,number:v=>v!=null&&Number.isFinite(Number(v))?Number(v):null});
 vm.runInContext(slice(source,'function matchupPlayerScore(','function homeMatchupRoster('),c);
 vm.runInContext(slice(source,'const espnN =','function importESPN('),c);
 return {c,run:s=>vm.runInContext(s,c)};
}
test('current matchup switches each starter from projection to actual using their game state, preserving zero and negative finals',()=>{
 const h=setup();h.c.e={points:0,projected:18,p:{scores:{6:99,7:0},espnProj:18}};
 assert.equal(h.run("matchupPlayerScore(e,7,'pre').points"),18);
 assert.equal(h.run("matchupPlayerScore(e,7,null).points"),18);
 assert.equal(h.run("matchupPlayerScore(e,7,'post').points"),0);
 assert.equal(h.run("matchupPlayerScore(e,7,'in').points"),0);
 h.c.e.points=-2;assert.equal(h.run("matchupPlayerScore(e,7,'post').points"),-2);
 h.c.e.points=12;assert.equal(h.run("matchupPlayerScore(e,7,'in').points"),12);
 h.c.e={p:{scores:{6:99},projections:{7:21}}};assert.equal(h.run("matchupPlayerScore(e,7,'pre').points"),21);
 assert.equal(h.run("matchupPlayerScore(e,7,'post').points"),null);
 assert.equal(h.run("matchupPlayerScore(e,6).points"),99);
 assert.equal(h.run("matchupPlayerScore(e,8,'pre').points"),null);
});
test('weekly roster totals reject an unscoped or wrong-week fallback and prioritize ESPN statSourceId',()=>{
 const h=setup();h.c.e={playerPoolEntry:{appliedStatTotal:99,player:{stats:[{scoringPeriodId:6,statSourceId:0,appliedTotal:99},{scoringPeriodId:7,statSourceId:1,statTypeId:0,appliedTotal:19}]}}};
 assert.equal(h.run('rosterStatsFromEntry(e,7,7).actual'),null);assert.equal(h.run('rosterStatsFromEntry(e,7,7).projected'),19);
 h.c.e.playerPoolEntry.player.stats=[];assert.equal(h.run('rosterStatsFromEntry(e,7).actual'),null);
 assert.equal(h.run('rosterStatsFromEntry(e,7,7).actual'),99);
});
test('a not-yet-started ESPN matchup retains this week, roster and weekly projections without a historical score',()=>{
 const h=setup();const entry={playerId:1,lineupSlotId:0,playerPoolEntry:{player:{id:1,fullName:'Test QB',defaultPositionId:1,proTeamId:2,stats:[{scoringPeriodId:6,statSourceId:0,appliedTotal:44},{scoringPeriodId:7,statSourceId:1,appliedTotal:23}]}}};
 h.c.input={base:{scoringPeriodId:7,teams:[{id:1,roster:{entries:[entry]}},{id:2}],schedule:[{matchupPeriodId:7,home:{teamId:1,totalPoints:0},away:{teamId:2,totalPoints:0}}]}};
 const m=h.run("normalizeESPN(input,'1',2026)");assert.equal(m.currentWeek,7);assert.equal(m.teams[0].currentMatchup.week,7);assert.equal(m.teams[0].history.length,0);assert.equal(m.players['1'].projections[7],23);assert.equal(m.teams[0].currentLineup[0].points,null);
});
test('shared lineup total mixes completed, live and upcoming players and never counts the bench',()=>{
 const h=setup(),{c}=h;c.labNum=c.number;c.labSum=a=>a.reduce((s,v)=>s+v,0);c.whatIfFor=()=>({swaps:{}});c.nflGameState=(w,p)=>p.state;
 c.model.players={a:{id:'a',pos:'QB',state:'post'},b:{id:'b',pos:'RB',state:'pre'},c:{id:'c',pos:'WR',state:'in'},d:{id:'d',pos:'WR',state:'post'}};
 c.team={id:'1',playerIds:['a','b','c','d'],history:[],currentMatchup:{week:7,points:18},currentLineup:[{id:'a',starter:true,slot:0,points:0,projected:20},{id:'b',starter:true,slot:2,points:0,projected:15},{id:'c',starter:true,slot:4,points:18,projected:12},{id:'d',starter:false,slot:20,points:90,projected:40}]};
 vm.runInContext(slice(explorer,'function sideLineup(','function matchupLines('),c);
 vm.runInContext(slice(explorer,'function weeklyLineupData(','function lineupPickerButton('),c);
 assert.equal(h.run('weeklyLineupData(team,7).matchupTotal'),33);assert.equal(h.run('weeklyLineupData(team,7).officialDisplay'),18);
 c.team.currentLineup[1].projected=null;assert.equal(h.run('weeklyLineupData(team,7).matchupTotal'),null);
});
