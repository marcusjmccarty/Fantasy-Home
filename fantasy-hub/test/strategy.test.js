import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
function setup(){
 let html='';const node={addEventListener(){},add(){}};
 const c=vm.createContext({document:{addEventListener(){}},el:()=>node,Option:class{},setExplorer:s=>{html=s},currentWeek:6,currentPlayerId:'allen',XL:{player:null},normalizeNFLAbbr:x=>x,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),labFormat:(v,d=1)=>v==null?'—':Number(v).toFixed(d),labPct:v=>v==null?'—':Number(v).toFixed(1)+'%',nameKey:v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,''),expandTable:(headers,rows)=>`<table>${headers.join('|')}${rows.join('')}</table>`});
 const script=read('script.js');vm.runInContext(script.slice(script.indexOf('function makeDemo()'),script.indexOf('function updateUI()')),c);
 vm.runInContext("var model=makeDemo();var currentTeamId='1';var getTeam=()=>model.teams.find(t=>t.id===currentTeamId);var findTeam=id=>model.teams.find(t=>t.id===id);var getPool=()=>Object.values(model.players);var rowsFor=t=>t.playerIds.map(id=>model.players[id]);var teamName=t=>t?.name||'No team';",c);
 vm.runInContext(read('analytics-math.js'),c);vm.runInContext(read('strategy.js'),c);
 return {run:code=>vm.runInContext(code,c),html:()=>html};
}
test('all strategy reports render with the real exhibition model',()=>{
 const h=setup();for(const route of ['outlook','opportunity','trade']){h.run(`renderStrategy('${route}')`);assert.ok(h.html().length>500);assert.ok(!h.html().includes('NaN'));assert.ok(!h.html().includes('undefined'));}
});
test('trade picks produce modeled comparisons and survive rendering',()=>{
 const h=setup();h.run("renderStrategy('trade');STRATEGY.trade.give=['cook'];STRATEGY.trade.get=['demo-1-1'];renderTrade()");assert.ok(!h.html().includes('Build both sides'));assert.match(h.html(),/Your lineup change/);assert.match(h.html(),/checked/);
});
test('opportunity filters and external player selection render safely',()=>{
 const h=setup();h.run("renderStrategy('opportunity');STRATEGY.player='usage:allen';STRATEGY.period='recent';STRATEGY.position='QB';STRATEGY.search='Josh';renderOpportunity()");assert.match(h.html(),/Josh Allen/);assert.match(h.html(),/3 recorded weeks/);assert.ok(!h.html().includes('NaN'));
 h.run("STRATEGY.search='NoSuchName';renderOpportunity()");assert.match(h.html(),/No players match/);
});
test('new league resets stale trade selections and missing periods remain unavailable',()=>{
 const h=setup();h.run("renderStrategy('trade');STRATEGY.trade.give=['cook'];model.league='Other league';strategyContext()");assert.equal(h.run('STRATEGY.trade.give.length'),0);
 h.run("STRATEGY.period='recent'");assert.equal(h.run("usageTotals({weeks:{1:{carries:3,targets:0}}},{through_week:8})"),null);
});
