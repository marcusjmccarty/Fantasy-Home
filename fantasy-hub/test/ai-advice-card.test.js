import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/explorer.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('// ---- AI advice: request builder'),source.indexOf('async function generateAIOutlook(){'));
function setup(){
 const c=vm.createContext({esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),labFormat:v=>v==null?'—':Number(v).toFixed(1),labNum:v=>Number.isFinite(Number(v))&&v!==null&&v!==''?Number(v):null,
  summarize:()=>({}),seriesFor:()=>[],XL:{free:[{id:'fa',name:'Free Back',pos:'RB',nfl:'LV',scores:{1:9,2:11},espnProj:10}]},
  model:{source:'demo',scoring:'PPR',currentWeek:3,teams:[{id:'1',playerIds:['a','b']},{id:'2',playerIds:['c']}],players:{a:{id:'a',name:'Alpha Back',pos:'RB',nfl:'BUF',status:'ACTIVE',scores:{1:10,2:14},espnProj:13},b:{id:'b',name:'Beta Back',pos:'RB',nfl:'MIA',scores:{1:6,2:7},espnProj:8},c:{id:'c',name:'Gamma Back',pos:'RB',nfl:'NYJ',scores:{1:20},espnProj:18}}}});
 vm.runInContext(readFileSync(new URL('../public/analytics-math.js',import.meta.url),'utf8'),c);
 vm.runInContext("var getTeam=()=>model.teams[0];"+block,c);return c;
}
const payload={provider:'Gemini',generatedAt:'2026-10-23T14:00:00Z',advice:{verdict:'Start',decision:'lineup',confidence:'Medium',headline:'Start him <now>.',reasons:['Gets 70% of carries.','Faces a soft run defense.'],risks:['Few targets.'],compare:'Start him over Beta Back (8 projected).',waiver:null,context:'Week 3 vs MIA.',outlook:{floor:9,median:13,ceiling:17,medianBasis:'provider projection'}}};
test('AI advice card shows verdict text, confidence, range, bullets and an escaped headline',()=>{
 const c=setup(),html=c.aiAdviceCard(payload,{week:3});
 assert.match(html,/class="ai-verdict-badge">START</);assert.match(html,/Confidence: <b>Medium<\/b>/);assert.match(html,/LINEUP CALL · WEEK 3/);
 assert.match(html,/Floor <b>9\.0<\/b>.*Median <b>13\.0<\/b>.*Ceiling <b>17\.0<\/b>/s);assert.match(html,/<h6>Why<\/h6><ul class="ai-advice-reasons"><li>Gets 70% of carries\.<\/li>/);assert.match(html,/<h6>Watch out<\/h6>/);
 assert.match(html,/<b>Compare:<\/b> Start him over Beta Back/);assert.ok(!html.includes('Waivers:'));assert.match(html,/AI analysis · Gemini · may be wrong · <time datetime="2026-10-23T14:00:00Z">/);
 assert.ok(html.includes('Start him &lt;now&gt;.'));assert.ok(!html.includes('<now>'));
 const compact=c.aiAdviceCard(payload,{compact:true});assert.match(compact,/compact/);assert.ok(!compact.includes('Watch out'));assert.match(compact,/ai-advice-why/);
 const plain=c.aiAdviceCard({provider:'Gemini',advice:null,outlook:'One.\n\nTwo.'});assert.match(plain,/AI NOTES/);assert.match(plain,/<p>One\.<\/p><p>Two\.<\/p>/);
 assert.match(c.aiAdviceCard({...payload,advice:{...payload.advice,verdict:'Trade for',decision:'trade'}}),/verdict-trade-for/);
});
test('AI advice request sends role, same-position alternatives and lineup slots',()=>{
 const c=setup();
 const mine=c.aiAdviceRequest(c.model.players.a,{week:3,season:2026});
 assert.equal(mine.role,'mine');assert.deepEqual(Array.from(mine.alternatives,a=>a.name),['Beta Back','Free Back']);assert.equal(mine.alternatives[1].where,'free');
 assert.equal(mine.player.projection,13);assert.deepEqual({...mine.lineupSlots},{position:2,flex:1});assert.equal(mine.scoring,'PPR');
 assert.equal(c.aiAdviceRequest(c.XL.free[0],{week:3,season:2026}).role,'free');
 const other=c.aiAdviceRequest(c.model.players.c,{week:3,season:2026});assert.equal(other.role,'other');assert.ok(other.alternatives.every(a=>a.where==='roster'));
 assert.ok(JSON.stringify(mine).length<3000,'payload stays small');
 assert.match(c.aiAdviceError(429),/try again in a minute/);assert.match(c.aiAdviceError(503),/not switched on/);
});
