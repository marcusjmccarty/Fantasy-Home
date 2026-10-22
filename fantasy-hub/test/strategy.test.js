import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
function setup(){
 let html='';const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{markup:'',writes:0,get innerHTML(){return this.markup},set innerHTML(value){this.markup=value;this.writes++},addEventListener(){},add(){}});return nodes.get(id)};
 const c=vm.createContext({document:{addEventListener(){}},sourceName:()=>"Exhibition",el,Option:class{},setExplorer:s=>{html=s},heading:(title,copy)=>`<div><h3>${title}</h3><p>${copy}</p></div>`,currentWeek:6,currentPlayerId:'allen',XL:{player:null},normalizeNFLAbbr:x=>x,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),labFormat:(v,d=1)=>v==null?'—':Number(v).toFixed(d),labPct:v=>v==null?'—':Number(v).toFixed(1)+'%',nameKey:v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,''),expandTable:(headers,rows)=>`<table>${headers.join('|')}${rows.join('')}</table>`});
 const script=read('script.js');vm.runInContext(script.slice(script.indexOf('function makeDemo()'),script.indexOf('function updateUI()')),c);
 vm.runInContext("var model=makeDemo();var currentTeamId='1';var getTeam=()=>model.teams.find(t=>t.id===currentTeamId);var findTeam=id=>model.teams.find(t=>t.id===id);var getPool=()=>Object.values(model.players);var rowsFor=t=>t.playerIds.map(id=>model.players[id]);var teamName=t=>t?.name||'No team';",c);
 vm.runInContext(read('analytics-math.js'),c);vm.runInContext(read('strategy.js'),c);
 return {run:code=>vm.runInContext(code,c),html:()=>html,node:el};
}
test('all strategy reports render with the real exhibition model',()=>{
 const h=setup();for(const route of ['outlook','opportunity','trade']){h.run(`renderStrategy('${route}')`);assert.ok(h.html().length>500);assert.ok(!h.html().includes('NaN'));assert.ok(!h.html().includes('undefined'));}
});
test('trade picks produce modeled comparisons and survive rendering',()=>{
 const h=setup();h.run("renderStrategy('trade');STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1'];renderTrade()");assert.ok(!h.html().includes('Build both sides'));assert.match(h.html(),/YOUR LINEUP CHANGE/);assert.match(h.html(),/checked/);
});
test('opportunity filters and external player selection render safely',()=>{
 const h=setup();h.run("renderStrategy('opportunity');STRATEGY.player='usage:allen';STRATEGY.period='recent';STRATEGY.position='QB';STRATEGY.search='Josh';renderOpportunity()");assert.match(h.html(),/Josh Allen/);assert.match(h.html(),/3 recorded weeks/);assert.ok(!h.html().includes('NaN'));
 h.run("STRATEGY.search='NoSuchName';renderOpportunity()");assert.match(h.html(),/No players match/);
});
test('new league resets stale trade selections and missing periods remain unavailable',()=>{
 const h=setup();h.run("renderStrategy('trade');STRATEGY.trade.give=['cook'];model.league='Other league';strategyContext()");assert.equal(h.run('STRATEGY.trade.give.length'),0);
 h.run("STRATEGY.period='recent'");assert.equal(h.run("usageTotals({weeks:{1:{carries:3,targets:0}}},{through_week:8})"),null);
});
test('home windows follow player selection and keep unavailable data blank',()=>{
 const h=setup();assert.match(h.node('home-share-player').innerHTML,/value="allen" selected/);
 h.run("currentPlayerId='cook';renderStrategyHome()");
 assert.match(h.node('home-outlook-player').innerHTML,/value="cook" selected/);
 assert.match(h.node('home-share-player').innerHTML,/value="cook" selected/);
 assert.match(h.node('share-preview').innerHTML,/SYNTHETIC EXHIBITION DATA/);
 h.run("currentPlayerId='dal';renderStrategyHome()");
 assert.match(h.node('share-preview').innerHTML,/Touches<\/span><strong>—/);
 h.run("currentPlayerId='allen';model.players.allen.scores={};renderStrategyHome()");
 assert.match(h.node('outlook-preview').innerHTML,/Estimated floor.*?<strong>—<\/strong>/);
});
test('changing the active team clears trade selections from the old roster',()=>{
 const h=setup();h.run("STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1'];currentTeamId='2';renderStrategyHome()");
 assert.equal(h.run('STRATEGY.trade.give.length'),0);assert.equal(h.run('STRATEGY.trade.get.length'),0);
 assert.match(h.node('trade-preview').innerHTML,/data-home-trade-add="give"/);
});
test('franchise scopes and opportunity leader scopes respect roster membership',()=>{
 const h=setup();assert.equal(h.run("strategyPlayerPool('2').length"),12);
 assert.equal(h.run("strategyPlayerPool('active').some(p=>p.id==='cook')"),true);
 const active=h.run('opportunityRows(usageDataset()).length');h.run("STRATEGY.leaders='all'");assert.ok(h.run('opportunityRows(usageDataset()).length')>active);
 h.run("STRATEGY.homeScope='2';renderStrategyHome()");assert.match(h.node('home-outlook-player').innerHTML,/Avery Knight/);assert.ok(!h.node('home-outlook-player').innerHTML.includes('James Cook'));
});
test('home trade controls update the same packages used in the full calculator',()=>{
 const h=setup();h.run("updateTradeControl({id:'',dataset:{homeTradeAdd:'give'},value:'cook'});updateTradeControl({id:'',dataset:{homeTradeAdd:'get'},value:'demo-1-1'})");
 assert.equal(h.run("STRATEGY.trade.give[0]"),'cook');assert.match(h.node('trade-preview').innerHTML,/Remove James Cook/);assert.match(h.node('trade-preview').innerHTML,/DIFFERENCE<\/span><b>-1.7/);
 h.run("renderStrategy('trade')");assert.match(h.html(),/checked/);
 h.run("updateTradeControl({id:'home-trade-partner',dataset:{},value:'3'})");assert.equal(h.run('STRATEGY.trade.get.length'),0);
});
test('D/ST report labels the opposing offense and Scouting File opens Player Outlook',()=>{
 const h=setup();h.run("STRATEGY.player='dal';renderDefensiveOutlook()");assert.match(h.html(),/OPPOSING OFFENSE/);assert.match(h.html(),/Sack rate conceded/);
 const file=h.run("scoutingFile(model.players.allen)");assert.match(file,/data-strategy-open="outlook"/);assert.match(file,/range-floor/);assert.match(file,/Availability/);assert.ok(!file.includes('PRIOR SCORING'));assert.ok(!file.includes('data-strategy-open="trade"'));
});

test('eight share bars and actionable metrics render in both scopes',()=>{
 const h=setup();h.run("STRATEGY.player='cook';renderStrategy('opportunity')");
 assert.match(h.html(),/Est. TD chance/);assert.match(h.html(),/Inside-10 share/);assert.match(h.html(),/Recent touches/);
 assert.equal((h.node('share-preview').innerHTML.match(/class="strategy-share share-/g)||[]).length,8);
 assert.match(h.run("shareHistoryChart(model.players.cook)"),/data-share-week="1"/);
});
test('leader filter roundtrip retains player and uses roster identity lookup only once per member',()=>{
 const h=setup();const active=h.run('opportunityRows(usageDataset()).map(r=>r.r.gsis_id).join()');
 h.run("STRATEGY.player='cook';STRATEGY.leaders='all';opportunityRows(usageDataset());STRATEGY.leaders='active'");
 assert.equal(h.run('opportunityRows(usageDataset()).map(r=>r.r.gsis_id).join()'),active);assert.equal(h.run('STRATEGY.player'),'cook');
 h.run('var matches=0;var originalLookup=usageFor;usageFor=(...args)=>{matches++;return originalLookup(...args)};opportunityRows(usageDataset())');
 assert.equal(h.run('matches'),h.run('tradeRoster(getTeam()).length'));
});
test('TD estimate is hidden for unavailable players and data coverage stays explicit',()=>{
 const h=setup();assert.ok(h.run('usageForecast(model.players.cook,usageDataset()).chance')>0);
 h.run("model.players.cook.status='OUT'");assert.equal(h.run('usageForecast(model.players.cook,usageDataset()).chance'),null);
});
test('trade workbench compares lineups and counteroffers without changing league rosters',()=>{
 const h=setup();const roster=h.run('getTeam().playerIds.join()');
 h.run("renderStrategy('trade');STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1'];renderTrade();findTradeAlternatives()");
 assert.match(h.html(),/STARTING LINEUP/);assert.match(h.html(),/BALANCE THE DEAL/);assert.ok(!h.html().includes('ROSTER FIT'));
 assert.equal(h.run('getTeam().playerIds.join()'),roster);
});
test('counteroffers prioritize filling the starting lineup over package balance alone',()=>{
 const h=setup();h.run("renderStrategy('trade');STRATEGY.trade.give=['cook',Object.values(model.players).find(p=>p.name==='Christian McCaffrey').id];STRATEGY.trade.get=['demo-1-1'];findTradeAlternatives()");
 assert.ok(h.run('STRATEGY.trade.alternatives.length')>0);assert.notEqual(h.run('STRATEGY.trade.alternatives[0].impact'),null);
});

test('unchanged home panels retain their DOM; changed player data still refreshes',()=>{
 const h=setup(),ids=['outlook-preview','share-preview','player-share-spark','home-outlook-player','home-share-player','trade-preview'];
 const writes=ids.map(id=>h.node(id).writes);h.run('renderStrategyHome();renderStrategyHome()');
 assert.deepEqual(ids.map(id=>h.node(id).writes),writes);
 h.run('model.players.allen.projections={7:99};renderStrategyHome()');
 assert.ok(h.node('outlook-preview').writes>writes[0]);assert.match(h.node('outlook-preview').innerHTML,/99.0/);
 assert.equal(h.node('home-outlook-player').writes,writes[3]);
});
test('trade edits preserve unrelated home panels and counteroffers share one evaluator',()=>{
 const h=setup(),ids=['outlook-preview','share-preview','player-share-spark','home-outlook-player','home-share-player'],writes=ids.map(id=>h.node(id).writes);
 h.run("updateTradeControl({id:'',dataset:{homeTradeAdd:'give'},value:'cook'});updateTradeControl({id:'',dataset:{homeTradeAdd:'get'},value:'demo-1-1'});renderTrade()");
 assert.deepEqual(ids.map(id=>h.node(id).writes),writes);
 h.run('var batches=0;var makeEvaluator=FantasyMath.createTradeEvaluator;FantasyMath.createTradeEvaluator=(...args)=>{batches++;return makeEvaluator(...args)};findTradeAlternatives()');
 assert.equal(h.run('batches'),1);assert.deepEqual(ids.map(id=>h.node(id).writes),writes);
});

test('weekly share periods aggregate only the selected week and keep future weeks out',()=>{
 const h=setup();h.run("STRATEGY.period='week:2'");
 const totals=h.run("usageTotals({weeks:{1:{carries:100},2:{carries:5,targets:3,receptions:2,team_totals:{carries:20,targets:30}},7:{carries:999}}},{through_week:7})");
 assert.equal(totals.touches,7);assert.equal(totals.opportunities,8);assert.equal(totals.weeks,1);assert.equal(totals.opportunity_share,16);
 h.run("renderStrategy('opportunity')");assert.match(h.html(),/value="week:2" selected/);assert.ok(!h.html().includes('value="week:7"'));
 h.run("STRATEGY.period='week:5'");assert.equal(h.run("usageTotals({weeks:{2:{carries:5}}},{through_week:6})"),null);
});
test('share bars open the selected player and week; chart whitespace does nothing',()=>{
 const h=setup();h.run("var opened=null;var openExplorer=(...args)=>{opened=args};openShareHistory({target:{closest:()=>null},stopPropagation(){}})");assert.equal(h.run('opened'),null);
 h.run("openShareHistory({target:{closest:()=>({dataset:{shareWeek:'3',sharePlayer:'cook'}})},stopPropagation(){}})");
 assert.equal(h.run('STRATEGY.period'),'week:3');assert.equal(h.run('STRATEGY.player'),'cook');assert.equal(h.run('opened.join()'),'opportunity,cook');
 const chart=h.run('shareHistoryChart(model.players.cook)');assert.match(chart,/class="share-week-bar"/);assert.ok(!chart.includes('data-open-share'));assert.ok(!chart.includes('0–'));
});
test('workload metrics and share bars reveal definitions without a yellow TD card',()=>{
 const h=setup();h.run("renderStrategy('opportunity')");assert.match(h.html(),/<details class="strategy-metric metric-disclosure"/);assert.match(h.html(),/<details class="strategy-share share-blue share-disclosure"/);assert.ok(!h.html().includes('td-estimate'));assert.ok(!h.html().includes('15+ pts'));
});
