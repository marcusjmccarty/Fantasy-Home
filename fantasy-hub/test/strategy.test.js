import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
function setup(){
 let html='';const handlers=new Map(),nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{markup:'',writes:0,get innerHTML(){return this.markup},set innerHTML(value){this.markup=value;this.writes++},addEventListener(){},add(){}});return nodes.get(id)};
 const c=vm.createContext({window:{addEventListener(){}},document:{addEventListener(type,fn){handlers.set(type,[...(handlers.get(type)||[]),fn])}},sourceName:()=>"Exhibition",el,Option:class{},setExplorer:s=>{html=s},heading:(title,copy)=>`<div><h3>${title}</h3><p>${copy}</p></div>`,currentWeek:7,number:v=>typeof v==='number'&&Number.isFinite(v)?v:null,nfmt:(v,d=1)=>v==null?'—':Number(v).toFixed(d),sum:xs=>xs.reduce((a,b)=>a+b,0),currentPlayerId:'allen',XL:{player:null},normalizeNFLAbbr:x=>x,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),labFormat:(v,d=1)=>v==null?'—':Number(v).toFixed(d),labPct:v=>v==null?'—':Number(v).toFixed(1)+'%',nameKey:v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,''),expandTable:(headers,rows)=>`<table>${headers.join('|')}${rows.join('')}</table>`});
 const script=read('script.js');vm.runInContext(script.slice(script.indexOf('function makeDemo()'),script.indexOf('function updateUI()')),c);
 vm.runInContext("var model=makeDemo();var currentTeamId='1';var getTeam=()=>model.teams.find(t=>t.id===currentTeamId);var findTeam=id=>model.teams.find(t=>t.id===id);var getPool=()=>Object.values(model.players);var rowsFor=t=>t.playerIds.map(id=>model.players[id]);var teamName=t=>t?.name||'No team';",c);
 vm.runInContext(script.slice(script.indexOf('function lineupSlotLabel('),script.indexOf('function homeMatchupRoster(')),c);
 vm.runInContext(script.slice(script.indexOf('function playerQuickStats('),script.indexOf('function drawProfile(')),c);vm.runInContext(read('analytics-math.js'),c);vm.runInContext(read('interactions.js'),c);vm.runInContext(read('strategy.js'),c);
 return {run:code=>vm.runInContext(code,c),html:()=>html,node:el,change:(id,value)=>{for(const fn of handlers.get('change')||[])fn({target:{id,value,dataset:{}}})}};
}
test('all strategy reports render with the real exhibition model',()=>{
 const h=setup();for(const route of ['outlook','opportunity','trade']){h.run(`renderStrategy('${route}')`);assert.ok(h.html().length>500);assert.ok(!h.html().includes('NaN'));assert.ok(!h.html().includes('undefined'));}
});
test('trade picks produce modeled comparisons and survive rendering',()=>{
 const h=setup();h.run("renderStrategy('trade');STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1'];renderTrade()");assert.ok(!h.html().includes('Build both sides'));assert.match(h.html(),/TEAM A \/ LINEUP CHANGE/);assert.match(h.html(),/checked/);
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
 const h=setup();assert.match(h.node('share-preview').innerHTML,/Josh Allen/);
 h.run("currentPlayerId='cook';renderStrategyHome()");
 assert.match(h.node('outlook-preview').innerHTML,/James Cook/);
 assert.match(h.node('share-preview').innerHTML,/James Cook/);
 assert.match(h.node('share-preview').innerHTML,/SYNTHETIC EXHIBITION DATA/);
 h.run("currentPlayerId='dal';renderStrategyHome()");
 assert.ok(!h.node('share-preview').innerHTML.includes('Inside-5 carries'));assert.ok(!h.node('share-preview').innerHTML.includes('Est. TD chance'));assert.match(h.node('share-preview').innerHTML,/Proj · W7/);
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
 h.run("STRATEGY.scope='2';STRATEGY.player='demo-1-1';renderStrategyHome()");assert.match(h.node('outlook-preview').innerHTML,/Josh Allen/);assert.equal(h.run('homePlayer().id'),'allen');
});
test('home trade controls update the same packages used in the full calculator',()=>{
 const h=setup();h.run("updateTradeControl({id:'',dataset:{homeTradeAdd:'give'},value:'cook'});updateTradeControl({id:'',dataset:{homeTradeAdd:'get'},value:'demo-1-1'})");
 assert.equal(h.run("STRATEGY.trade.give[0]"),'cook');assert.match(h.node('trade-preview').innerHTML,/Remove James Cook/);assert.match(h.node('trade-preview').innerHTML,/A LINEUP GAIN/);assert.equal(h.run('Math.round(tradeModel().impact*10)/10'),3.1);assert.match(h.node('trade-preview').innerHTML,/home-trade-center/);
 h.run("renderStrategy('trade')");assert.match(h.html(),/checked/);
 h.run("updateTradeControl({id:'home-trade-partner',dataset:{},value:'3'})");assert.equal(h.run('STRATEGY.trade.get.length'),0);
});
test('D/ST report labels the opposing offense and Scouting File opens Player Outlook',()=>{
 const h=setup();h.run("STRATEGY.player='dal';renderDefensiveOutlook()");assert.match(h.html(),/OPPOSING OFFENSE/);assert.match(h.html(),/Sack rate conceded/);
 const file=h.run("scoutingFile(model.players.allen)");assert.match(file,/data-strategy-open="outlook"/);assert.match(file,/range-floor/);assert.match(file,/Availability/);assert.ok(!file.includes('PRIOR SCORING'));assert.ok(!file.includes('data-strategy-open="trade"'));
});

test('eight share bars and actionable metrics render in both scopes',()=>{
 const h=setup();h.run("currentPlayerId='cook';STRATEGY.player='cook';renderStrategy('opportunity')");
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
 const h=setup(),ids=['outlook-preview','share-preview','player-share-spark','trade-preview'];
 const writes=ids.map(id=>h.node(id).writes);h.run('renderStrategyHome();renderStrategyHome()');
 assert.deepEqual(ids.map(id=>h.node(id).writes),writes);
 h.run('model.players.allen.projections={7:99};renderStrategyHome()');
 assert.ok(h.node('outlook-preview').writes>writes[0]);assert.match(h.node('outlook-preview').innerHTML,/99.0/);
 assert.equal(h.node('share-preview').writes,writes[1]);
});
test('trade edits preserve unrelated home panels and counteroffers share one evaluator',()=>{
 const h=setup(),ids=['outlook-preview','share-preview','player-share-spark'],writes=ids.map(id=>h.node(id).writes);
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
test('share bars open their week while the full chart opens the player season',()=>{
 const h=setup();h.run("var opened=null;var openExplorer=(...args)=>{opened=args};openShareHistory({target:{closest:()=>null},stopPropagation(){}})");assert.equal(h.run('opened'),null);
 h.run("openShareHistory({target:{closest:s=>s==='[data-share-week]'?{dataset:{shareWeek:'3',sharePlayer:'cook'}}:null},stopPropagation(){}})");
 assert.equal(h.run('STRATEGY.period'),'week:3');assert.equal(h.run('STRATEGY.player'),'cook');assert.equal(h.run('opened.join()'),'opportunity,cook');
 const chart=h.run('shareHistoryChart(model.players.cook)');assert.match(chart,/class="share-week-bar"/);assert.ok(!chart.includes('data-open-share'));assert.ok(!chart.includes('0–'));
 h.run("openShareHistory({target:{closest:s=>s==='[data-share-all]'?{dataset:{shareAll:'cook'}}:null},stopPropagation(){}})");
 assert.equal(h.run('STRATEGY.period'),'season');assert.equal(h.run('opened.join()'),'opportunity,cook');
 h.run("STRATEGY.period='week:2';openShareHistory({target:{closest:s=>s==='[data-share-chart]'?{dataset:{shareChart:'cook'}}:null},stopPropagation(){}})");assert.equal(h.run('STRATEGY.period'),'season');assert.equal(h.run('opened.join()'),'opportunity,cook');
});
test('workload metrics and share bars reveal definitions without a yellow TD card',()=>{
 const h=setup();h.run("STRATEGY.player='cook';renderStrategy('opportunity')");assert.match(h.html(),/stat-help-trigger strategy-metric metric-disclosure/);assert.match(h.html(),/strategy-share share-blue share-disclosure stat-help-trigger/);assert.ok(!h.html().includes('td-estimate'));assert.ok(!h.html().includes('15+ pts'));
});

test('franchise filters retain the selected player when they remain in scope',()=>{
 const h=setup();h.run("renderStrategy('opportunity');STRATEGY.player='cook';XL.player='cook';XL.open='opportunity';STRATEGY.period='week:3'");
 h.change('strategy-scope','active');assert.equal(h.run('STRATEGY.player'),'cook');
 h.change('strategy-scope','all');assert.equal(h.run('STRATEGY.player'),'cook');assert.equal(h.run('STRATEGY.period'),'week:3');
 h.change('strategy-scope','2');assert.equal(h.run("strategyPlayerPool('2').some(p=>p.id===STRATEGY.player)"),true);
});

test('either trade franchise can change independently without changing the active franchise',()=>{
 const h=setup();h.run("renderStrategy('trade');STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1']");
 h.change('trade-team','3');h.change('trade-partner','4');
 assert.equal(h.run('currentTeamId'),'1');assert.equal(h.run('tradeTeam().id'),'3');assert.equal(h.run('STRATEGY.trade.partner'),'4');
 assert.equal(h.run('STRATEGY.trade.give.length'),0);assert.equal(h.run('STRATEGY.trade.get.length'),0);
 assert.match(h.node('trade-preview').innerHTML,/id="home-trade-team"/);
 h.change('home-trade-team','4');assert.notEqual(h.run('STRATEGY.trade.team'),h.run('STRATEGY.trade.partner'));
 assert.equal(h.run('currentTeamId'),'1');
});

test('changing trade teams cancels stale searches while package edits reuse their results',()=>{
 const h=setup();h.run("var workers=[];var Worker=class{constructor(){workers.push(this)}postMessage(data){this.data=data}terminate(){this.stopped=true}};XL.open='trade';renderTrade()");
 assert.equal(h.run('workers.length'),1);
 h.run("STRATEGY.trade.give=['cook'];renderTrade()");assert.equal(h.run('workers.length'),1);
 h.change('trade-partner','3');assert.equal(h.run('workers.length'),2);assert.equal(h.run('workers[0].stopped'),true);
 h.run("workers[0].onmessage({data:{results:[],checked:999}})");assert.equal(h.run('tradeSearch.result'),null);
 h.run("workers[1].onmessage({data:{results:[],checked:42,total:42,scope:'All 1–2 player packages'}})");
 assert.equal(h.run('tradeSearch.result.checked'),42);assert.equal(h.run('workers[1].stopped'),true);
});

test('receiver and quarterback share metrics follow recorded involvement',()=>{
 const h=setup();
 const receiver=h.run("shareBars({carries:0,targets:12,target_share:24},{pos:'WR'})");
 assert.ok(receiver.includes('Target share'));assert.ok(!receiver.includes('Carry share'));
 assert.ok(h.run("shareBars({carries:1,targets:12},{pos:'WR'})").includes('Carry share'));
 const qb=h.run("shareBars({carries:5,targets:0},{pos:'QB'})");assert.ok(qb.includes('Carry share'));assert.ok(!qb.includes('Target share'));assert.ok(!qb.includes('Reception share'));
 const cards=h.run("usageStatCards({id:'receiver',pos:'WR',scores:{}},{carries:0,targets:12,inside5_targets:3},usageDataset())");assert.match(cards,/Inside-5 targets/);assert.ok(!cards.includes('Inside-5 carries'));
});
test('metric popovers anchor to the right half, with the center opening from the left',()=>{
 const h=setup(),row=Array.from({length:9},(_,i)=>({left:20+i*100,right:110+i*100}));
 for(let i=0;i<9;i++)assert.equal(h.run(`metricPopupLeft(${JSON.stringify(row[i])},${JSON.stringify(row)},260,1400)`),i<5?row[i].left:row[i].right-260);
 assert.equal(h.run('metricPopupLeft({left:900,right:990},[{left:900,right:990}],260,1000)'),728);
 assert.equal(h.run('metricPopupLeft({left:2,right:90},[{left:2,right:90}],260,1000)'),12);
});

test('home workload has three key metrics while the expanded snapshot keeps eight',()=>{
 const h=setup();h.run("currentPlayerId='cook';STRATEGY.player='cook';renderStrategyHome();renderOpportunity()");
 assert.equal((h.node('share-preview').innerHTML.match(/class="stat-help-trigger strategy-metric/g)||[]).length,3);
 assert.equal((h.html().match(/class="stat-help-trigger strategy-metric metric-disclosure/g)||[]).length,8);
 assert.match(h.node('share-preview').innerHTML,/TD chance/);assert.match(h.node('share-preview').innerHTML,/RZ chances/);
});
test('active week drives historical projections and the three player quick stats without future leakage',()=>{
 const h=setup();h.run("model.currentWeek=7;model.players.allen.espnProj=99;model.players.allen.projections={7:99,3:20};currentWeek=3;renderStrategyHome()");
 assert.equal(h.run('strategyWeek()'),3);assert.equal(h.run('currentProjection(model.players.allen).center'),20);
 let cards=h.run('playerQuickStats(model.players.allen)');assert.match(cards,/Proj · W3/);assert.match(cards,/Last wk · W2/);assert.ok(!cards.includes('99.0'));
 h.run('currentWeek=4');assert.notEqual(h.run('currentProjection(model.players.allen).center'),99);assert.ok(!h.run('playerQuickStats(model.players.allen)').includes('99.0'));
 assert.equal(h.run('tradeRoster(getTeam())[0].espnProj'),null);
});
test('lineup assessment uses comparable prior evidence and never treats a short pool as a firm tier',()=>{
 const h=setup();h.run("model.players.cook.status='OUT'");assert.equal(h.run('lineupRead(model.players.cook).label'),'Bench · unavailable');
 h.run("getPool=()=>[model.players.allen]");assert.equal(h.run('lineupRead(model.players.allen).label'),'Role uncertain');assert.match(h.run('lineupRead(model.players.allen).summary'),/too small/);
});

test('Outlook surfaces route to the selected player while nested help remains separate',()=>{
 const h=setup();h.run("STRATEGY.player='cook';renderDefensiveOutlook()");
 assert.match(h.html(),/prior-scoring report-link[^>]*data-report-open="player-analytics"[^>]*data-report-player="cook"/);
 assert.match(h.html(),/strategy-range report-link[^>]*data-report-open="profile"[^>]*data-report-player="cook"/);
 assert.match(h.html(),/data-stat-help=/);assert.ok(!h.html().includes('Player file ↗'));
 h.run("STRATEGY.defense.set(model.season+':7',{opponents:{BUF:'DAL'}});renderDefensiveOutlook()");
 assert.match(h.html(),/data-opponent-archive="DAL"/);assert.equal(h.run("findOpponentDefense('DAL').id"),'dal');h.run("XL.open='outlook';var archiveRoute=null;var openExplorer=(...args)=>archiveRoute=args;openOpponentArchive('DAL')");assert.equal(h.run("archiveRoute.join(',')"),'player-analytics,dal');assert.equal(h.run("findOpponentDefense('XYZ')"),undefined);
});
test('trade roster follows starting slots before bench and home balance has an explicit empty state',()=>{
 const h=setup();h.run("currentWeek=6;getTeam().history.find(h=>h.week===6).lineup=[{id:'cook',slot:23,starter:true},{id:'tucker',slot:17,starter:true},{id:'allen',slot:0,starter:true},{id:'dal',slot:16,starter:true},{id:'chase',slot:4,starter:true},{id:'cmc',slot:2,starter:true},{id:'kelce',slot:6,starter:true}]");
 assert.equal(h.run("tradeRoster(getTeam()).slice(0,7).map(p=>p.id).join(',')"),'allen,cmc,chase,kelce,cook,dal,tucker');
 h.run("renderStrategy('trade')");assert.match(h.html(),/data-trade-club="1"/);assert.match(h.html(),/data-trade-player="cook"/);assert.match(h.html(),/trade-position">FLEX/);
 const home=h.node('trade-preview').innerHTML;assert.match(home,/trade-balance-ring/);assert.match(home,/ADD PLAYERS/);assert.ok(!home.includes('No players selected'));assert.ok(!home.includes('>—<'));
});
test('TD methodology is visible without expanding a disclosure',()=>{
 const h=setup();h.run("renderStrategy('opportunity')");assert.match(h.html(),/<section class="strategy-method lab-panel"><h4>TD ESTIMATE/);assert.ok(!h.html().includes('<details class="strategy-method"'));
});

test('exhibition rosters supply explicit FLEX and bench slot assignments',()=>{
 const h=setup();h.run('currentWeek=6');assert.equal(h.run("teamLineupEntries(findTeam('2'),6).filter(e=>e.starter).map(lineupSlotLabel).join(',')"),'QB,RB,RB,WR,WR,TE,FLEX,D/ST,K');
});


test('home trade accepts every rostered player, fits into adaptive packages and shares the expanded analysis',()=>{
 const h=setup();h.run("for(const id of getTeam().playerIds)updateTradeControl({id:'',dataset:{homeTradeAdd:'give'},value:id})");
 assert.equal(h.run('STRATEGY.trade.give.length'),h.run('getTeam().playerIds.length'));
 const html=h.node('trade-preview').innerHTML;assert.equal((html.match(/data-home-trade-remove="give"/g)||[]).length,h.run('getTeam().playerIds.length'));
 assert.match(html,/home-trade-packages dense/);assert.ok(!html.includes('home-trade-difference'));
 h.run("STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1'];renderHomeTrade();renderTrade()");
 assert.match(h.html(),/This week’s projections/);assert.match(h.html(),/\+3\.1 pts \/ week/);assert.match(h.node('trade-preview').innerHTML,/\+3\.1/);
});

test('trade player list is keyboard and screen-reader friendly',()=>{
 const h=setup();h.run("renderStrategy('trade')");const html=h.html();
 assert.ok(!/class="lab-panel trade-side[^"]*"[^>]*role="link"/.test(html),'trade side is not a link');
 assert.ok(!/class="trade-player[^"]*"[^>]*tabindex/.test(html),'rows add no extra tab stop');
 assert.ok(!html.includes('double-click'));
 assert.match(html,/<input type="checkbox" id="trade-give-cook"[^>]*>/);assert.match(html,/<label for="trade-give-cook"/);
 assert.match(html,/data-trade-details="cook" aria-label="Details for James Cook"/);
 assert.match(html,/1\. Players Team A gives/);assert.match(html,/2\. Players Team B gives/);
 assert.match(html,/<p role="status" class="trade-verdict-text"><b>Choose at least one player from each team/);
 assert.ok(!/class="trade-verdict"[^>]*aria-live/.test(html));
 h.run("STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1'];renderTrade()");
 assert.match(h.html(),/role="status" class="trade-verdict-text"><b>Team A gains 3\.1 pts; Team B (gains|loses|stays)/);
});
test('trade recommendations explain an empty result and offer the closest options',()=>{
 const h=setup();h.run("XL.open='trade';var Worker=class{postMessage(d){this.data=d}terminate(){}};var hostNode=el('trade-recommendations');renderTrade();STRATEGY.trade.partner='8';renderTrade()");
 h.run("tradeSearch.result=FantasyMath.searchTrades(tradeRoster(tradeTeam()),tradeRoster(findTeam('8')),tradeConfig().slots,strategyWeek(),STRATEGY.trade.mode);renderTradeRecommendations()");
 const out=h.node('trade-recommendations').innerHTML;
 assert.match(out,/No trade improves both starting lineups/);assert.match(out,/Why none were found/);assert.match(out,/Closest options/);assert.match(out,/data-trade-kind="near"/);
 h.run("STRATEGY.trade.partner='2';tradeSearch.result=FantasyMath.searchTrades(tradeRoster(tradeTeam()),tradeRoster(findTeam('2')),tradeConfig().slots,strategyWeek(),STRATEGY.trade.mode);renderTradeRecommendations()");
 assert.match(h.node('trade-recommendations').innerHTML,/\d+ mutually beneficial trades/);
});
test('trade valuation falls back to rest of season when no projections exist',()=>{
 const h=setup();h.run("for(const p of Object.values(model.players))p.projections={};STRATEGY.trade.modeChosen=false;ensureTrade()");
 assert.equal(h.run('STRATEGY.trade.mode'),'season');
 assert.ok(h.run("FantasyMath.tradeValue(tradeRoster(getTeam())[0],strategyWeek(),STRATEGY.trade.mode)")>0);
});
