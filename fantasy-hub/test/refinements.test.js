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
const graphContext=(extra={})=>{
 const c=vm.createContext({window:{innerWidth:1800,innerHeight:1000},XL:{graph:{x:'x',y:'y',showLabels:true,color:'pos'},selectedPoint:null},META:{x:{name:'Targets'},y:{name:'Points'}},esc:String,labFormat:n=>String(n),graphCorrelations:()=>null,playerColor:()=>'blue',...extra});
 vm.runInContext(section(read('explorer.js'),'function scatterSVG(','function metricSelect('),c);return c;
};
test('expanded graph limits overlapping labels and scales to measured plot dimensions',()=>{
 const c=graphContext();
 c.rows=Array.from({length:20},(_,i)=>({x:12,y:20,p:{id:i,name:'Player '+i}}));
 const html=vm.runInContext('scatterSVG(rows,{width:1500,height:550})',c);
 assert.match(html,/viewBox="0 0 1500 550"/);assert.equal((html.match(/class="lab-dot label-visible"/g)||[]).length,1);assert.equal((html.match(/class="lab-label"/g)||[]).length,20);
 assert.ok(!html.includes('NaN'));
});

test('scatter axes carry readable round-number tick labels',()=>{
 const c=graphContext();c.rows=[{x:3.2,y:7.9,p:{id:1,name:'A'}},{x:41.7,y:24.4,p:{id:2,name:'B'}},{x:18,y:12,p:{id:3,name:'C'}}];
 const html=vm.runInContext('scatterSVG(rows,{width:1200,height:600})',c),ticks=[...html.matchAll(/class="lab-tick"[^>]*>([^<]+)</g)].map(m=>m[1]);
 assert.ok(ticks.length>=6,ticks.join());assert.ok(ticks.every(t=>/^-?[\d,]+(\.\d+)?$/.test(t)),ticks.join());
 assert.equal(vm.runInContext('JSON.stringify(graphNiceTicks(0,100,5))',c),'[0,20,40,60,80,100]');
 assert.equal(vm.runInContext('JSON.stringify(graphNiceTicks(0.3,1.2,4))',c),'[0.5,0.75,1]');
 assert.equal(vm.runInContext('JSON.stringify([graphNiceTicks(5,5),graphNiceTicks(NaN,1)])',c),'[[5],[]]');
 assert.equal(vm.runInContext('graphTickLabel(2.5,[0,2.5,5])',c),'2.5');assert.equal(vm.runInContext('graphTickLabel(0.75,[0.5,0.75,1])',c),'0.75');assert.equal(vm.runInContext('graphTickLabel(1,[0.5,0.75,1])',c),'1.00');assert.equal(vm.runInContext('graphTickLabel(1000,[0,500,1000])',c),'1,000');
});
test('scatter labels never overlap and always include extremes and the selected player',()=>{
 const c=graphContext();
 // A tight cluster of long names plus four extremes.
 c.rows=[...Array.from({length:30},(_,i)=>({x:10+(i%6)*.3,y:10+Math.floor(i/6)*.3,p:{id:'c'+i,name:'Clustered Player '+i}})),
  {x:0,y:10,p:{id:'minx',name:'Lowest X'}},{x:30,y:11,p:{id:'maxx',name:'Highest X'}},{x:12,y:0,p:{id:'miny',name:'Lowest Y'}},{x:11,y:25,p:{id:'maxy',name:'Highest Y'}}];
 c.XL.selectedPoint='c14';
 const html=vm.runInContext('scatterSVG(rows,{width:900,height:500})',c);
 const visible=[...html.matchAll(/<g class="lab-dot label-visible"[^>]*data-graph-player="([^"]+)"[\s\S]*?<text class="lab-label" x="([\d.-]+)" y="([\d.-]+)">([^<]+)</g)].map(m=>({id:m[1],x:+m[2],y:+m[3],name:m[4]}));
 const ids=visible.map(v=>v.id);for(const id of ['minx','maxx','miny','maxy','c14'])assert.ok(ids.includes(id),id+' should be labelled');
 assert.ok(visible.length<30,'dense cluster must be thinned');
 const box=v=>({x:v.x,y:v.y-11,w:v.name.length*13*.62,h:13});
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=box(visible[i]),b=box(visible[j]);assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`${visible[i].name} overlaps ${visible[j].name}`);}
 c.XL.graph.showLabels=false;assert.ok(!vm.runInContext('scatterSVG(rows,{width:900,height:500})',c).includes('label-visible'));
});
test('variable lab never defaults to a deterministic pairing such as total vs points per game',()=>{
 const src=read('explorer.js');assert.doesNotMatch(src,/graph:\{x:'total',y:'avg'/);
 const pairs=section(src,'function ensureGraphAxes(','function graphPresetAvailable(');assert.doesNotMatch(pairs,/\['total','avg'\]|\['avg','total'\]/);
});

test('home matchup retains all starters, excludes bench and preserves missing scores',()=>{
 const players={a:{name:'Starter A',pos:'RB',scores:{}},b:{name:'Bench B',pos:'WR',scores:{}},c:{name:'Starter C',pos:'QB',scores:{}}};
 const c=vm.createContext({model:{players,currentWeek:6},currentWeek:6,esc:String,teamName:t=>t.name,number:n=>typeof n==='number'?n:null,nfmt:n=>n==null?'—':String(n)});
 vm.runInContext(section(read('script.js'),'function lineupSlotLabel(',"el('matchup-panel').addEventListener"),c);
 c.team={name:'Test',wins:3,losses:2,history:[{week:1,lineup:[{id:'b',starter:false,points:20},{id:'a',starter:true,points:0},{id:'c',starter:true,points:null}]}]};
 const html=vm.runInContext('homeMatchupRoster(team,1)',c);assert.match(html,/Starter A/);assert.match(html,/Starter C/);assert.ok(!html.includes('Bench B'));assert.match(html,/>0<small>FINAL<\/small>/);assert.match(html,/>—<small>FINAL<\/small>/);
});

test('active week selectors stay synchronized and reject unavailable weeks',()=>{
 const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',replaceChildren(...opts){this.options=opts},add(o){this.options.push(o)}});return nodes.get(id)};
 const team={history:[{week:1},{week:3}]};const c=vm.createContext({el,currentWeek:7,model:{weeks:[1,2,3],currentWeek:7},Option:class{constructor(text,value){this.text=text;this.value=value}},getTeam:()=>team,XL:{open:null}});
 vm.runInContext(section(read('script.js'),'function availableActiveWeeks(','function drawMatchup('),c);vm.runInContext('var updateUI=()=>updateWeekMenu(getTeam());updateUI();setActiveWeek(2)',c);
 assert.equal(el('header-current-week').value,'2');assert.equal(el('week-select').value,'2');assert.equal(vm.runInContext('currentWeek',c),2);
 vm.runInContext('setActiveWeek(18)',c);assert.equal(vm.runInContext('currentWeek',c),2);
 assert.ok(el('week-select').options.some(o=>o.value==='7'));assert.equal(el('header-current-week').options.find(o=>o.value==='7').text,'7');
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
