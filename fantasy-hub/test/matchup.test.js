import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeUnits} from '../src/matchup-context.js';
test('matchup units use only previous weeks and preserve unknown denominators',()=>{
 const row={game_ids:['g1'],plays:2,yards:10,yard_plays:2,pass_plays:1,pass_yards:-5,pass_yard_plays:1,rush_yards:15,rush_yard_plays:1,sacks:1,turnovers:0,explosives:1,epa:0,epa_plays:0};
 const data={units:{CHI:{1:{defense:row},2:{defense:{...row,game_ids:['g2'],yards:999}}}}};
 const result=summarizeUnits(data,2).CHI.defense;
 assert.equal(result.games,1);assert.equal(result.yardsPerPlay,5);assert.equal(result.netPassYardsPerPlay,-5);assert.equal(result.sackRate,100);assert.equal(result.turnoversPerGame,0);assert.equal(result.epaPerPlay,null);assert.equal(result.successRate,null);assert.equal(result.explosiveRate,50);
 assert.deepEqual(summarizeUnits({},7),{});
});
test('AI workload matches one player and excludes the requested and future weeks',async()=>{
 const {playerWorkload}=await import('../src/matchup-context.js');
 const data={players:[{name:'Test Runner',espn_id:'10',weeks:{1:{carries:10,receptions:2,targets:3,redzone_carries:2,inside5_carries:1},2:{carries:999}}}]};
 const result=playerWorkload(data,{id:'10',name:'Test Runner'},2);
 assert.equal(result.touches,12);assert.equal(result.opportunities,13);assert.equal(result.recordedWeeks,1);assert.equal(result.inside5Carries,1);
 assert.equal(playerWorkload(data,{id:'20',name:'Missing'},2),null);
});

test('AI comparisons distinguish opponent strengths from league unit averages without inventing missing rates',async()=>{
 const {unitComparisons}=await import('../src/matchup-context.js');
 const units={A:{defense:{yardsPerPlay:4,sackRate:10}},B:{defense:{yardsPerPlay:6,sackRate:4}}};
 const c=unitComparisons(units,'A','defense');assert.equal(c.yardsPerPlay.leagueUnitMean,5);assert.equal(c.yardsPerPlay.differenceFromMean,-1);assert.equal(c.sackRate.differenceFromMean,3);assert.equal(c.epaPerPlay,null);assert.equal(unitComparisons(units,'X','offense'),null);
});
