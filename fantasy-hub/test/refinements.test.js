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
