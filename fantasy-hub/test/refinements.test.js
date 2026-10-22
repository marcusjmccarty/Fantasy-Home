import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
test('home position periods preserve recorded zeroes, negatives and D/ST aliases',()=>{
 const c=vm.createContext({model:{players:{r:{pos:'RB'},d:{pos:'D/ST'},w:{pos:'WR'}}},number:n=>typeof n==='number'&&Number.isFinite(n)?n:null});
 vm.runInContext(section(read('script.js'),'function homePositionTotals(','function drawPositions('),c);
 const team={history:[{week:1,starters:{r:10,d:-2,w:null}},{week:2,starters:{r:0,d:5,w:8}}]};c.team=team;
 const all=vm.runInContext('homePositionTotals(team)',c),week=vm.runInContext("homePositionTotals(team,'2')",c);
 assert.equal(all.totals.RB,10);assert.equal(all.totals.DEF,3);assert.equal(week.totals.RB,0);assert.equal(week.known,3);assert.equal(vm.runInContext("homePositionTotals(team,'3').known",c),0);
});
test('expanded graph limits overlapping labels and scales to measured plot dimensions',()=>{
 const c=vm.createContext({window:{innerWidth:1800,innerHeight:1000},XL:{graph:{x:'x',y:'y',showLabels:true,color:'pos'},selectedPoint:null},META:{x:{name:'Targets'},y:{name:'Points'}},esc:String,labFormat:n=>String(n),graphCorrelations:()=>null,playerColor:()=>'blue'});
 vm.runInContext(section(read('explorer.js'),'function scatterSVG(','function metricSelect('),c);
 c.rows=Array.from({length:20},(_,i)=>({x:12,y:20,p:{id:i,name:'Player '+i}}));
 const html=vm.runInContext('scatterSVG(rows,{width:1500,height:550})',c);
 assert.match(html,/viewBox="0 0 1500 550"/);assert.equal((html.match(/class="lab-dot label-visible"/g)||[]).length,1);assert.equal((html.match(/class="lab-label"/g)||[]).length,20);
 assert.ok(!html.includes('NaN'));
});

test('home matchup retains all starters, excludes bench and preserves missing scores',()=>{
 const players={a:{name:'Starter A',pos:'RB',scores:{}},b:{name:'Bench B',pos:'WR',scores:{}},c:{name:'Starter C',pos:'QB',scores:{}}};
 const c=vm.createContext({model:{players,currentWeek:6},currentWeek:6,esc:String,teamName:t=>t.name,number:n=>typeof n==='number'?n:null,nfmt:n=>n==null?'—':String(n)});
 vm.runInContext(section(read('script.js'),'function lineupSlotLabel(',"el('matchup-panel').addEventListener"),c);
 c.team={name:'Test',wins:3,losses:2,history:[{week:1,lineup:[{id:'b',starter:false,points:20},{id:'a',starter:true,points:0},{id:'c',starter:true,points:null}]}]};
 const html=vm.runInContext('homeMatchupRoster(team,1)',c);assert.match(html,/Starter A/);assert.match(html,/Starter C/);assert.ok(!html.includes('Bench B'));assert.match(html,/<strong>0<\/strong>/);assert.match(html,/<strong>—<\/strong>/);
});

test('active week selectors stay synchronized and reject unavailable weeks',()=>{
 const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',replaceChildren(...opts){this.options=opts},add(o){this.options.push(o)}});return nodes.get(id)};
 const team={history:[{week:1},{week:3}]};const c=vm.createContext({el,currentWeek:7,model:{weeks:[1,2,3],currentWeek:7},Option:class{constructor(text,value){this.text=text;this.value=value}},getTeam:()=>team,XL:{open:null}});
 vm.runInContext(section(read('script.js'),'function availableActiveWeeks(','function drawMatchup('),c);vm.runInContext('var updateUI=()=>updateWeekMenu(getTeam());updateUI();setActiveWeek(2)',c);
 assert.equal(el('header-current-week').value,'2');assert.equal(el('week-select').value,'2');assert.equal(vm.runInContext('currentWeek',c),2);
 vm.runInContext('setActiveWeek(18)',c);assert.equal(vm.runInContext('currentWeek',c),2);
 assert.ok(el('week-select').options.some(o=>o.value==='7'));assert.equal(el('header-current-week').options.find(o=>o.value==='7').text,'07');
});

test('home lineup respects actual slots, keeps FLEX after TE and D/ST before K',()=>{
 const positions=['K','WR','RB','DEF','TE','QB','WR','RB','WR','QB'];
 const slots=[17,23,2,16,6,0,4,2,4,20];
 const players=Object.fromEntries(positions.map((pos,i)=>[String(i),{id:String(i),name:'Player '+i,pos,scores:{}}]));
 const c=vm.createContext({model:{players,currentWeek:7},currentWeek:7,esc:String,teamName:t=>t.name,number:n=>typeof n==='number'?n:null,nfmt:n=>n==null?'—':String(n)});
 vm.runInContext(section(read('script.js'),'function lineupSlotLabel(',"el('matchup-panel').addEventListener"),c);
 c.team={name:'Slots',history:[{week:7,lineup:slots.map((slot,i)=>({id:String(i),slot,starter:slot!==20,points:i}))}]};
 assert.equal(vm.runInContext("teamLineupEntries(team,7).filter(e=>e.starter).map(lineupSlotLabel).join(',')",c),'QB,RB,RB,WR,WR,TE,FLEX,D/ST,K');
 const html=vm.runInContext('homeMatchupRoster(team,7)',c);assert.ok(html.indexOf('Player 1')>html.indexOf('Player 4'));assert.ok(!html.includes('Player 9'));
});
