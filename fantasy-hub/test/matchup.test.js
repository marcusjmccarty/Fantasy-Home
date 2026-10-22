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
