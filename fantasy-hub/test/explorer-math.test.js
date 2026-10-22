// Variable Lab regression statistics, extracted from explorer.js and checked
// against values computed by hand.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/explorer.js',import.meta.url),'utf8');
const c=vm.createContext({});
vm.runInContext("const labNum=v=>v===undefined||v===null||v===''||!Number.isFinite(Number(v))?null:Number(v);const labSum=v=>v.reduce((a,b)=>a+(labNum(b)||0),0);"+src.slice(src.indexOf('function graphCorrelations('),src.indexOf('const GRAPH_STAT_EXPLAIN')),c);
const stats=rows=>vm.runInContext('graphStatistics',c)(rows);
const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-9,`${msg}: ${a} vs ${b}`);
test('Pearson, R², slope, intercept, RMSE and Spearman match hand calculations',()=>{
 // x=1..5, y=2,4,5,4,5: mean x 3, mean y 4; Sxy=6, Sxx=10, Syy=6.
 const s=stats([[1,2],[2,4],[3,5],[4,4],[5,5]].map(([x,y])=>({x,y})));
 close(s.r,6/Math.sqrt(60),'r');close(s.r2,.6,'r2');close(s.slope,.6,'slope');close(s.intercept,2.2,'intercept');
 // Residuals: -.8,.6,1,-.6,-.2 → SSE 2.4, RMSE sqrt(2.4/5).
 close(s.rmse,Math.sqrt(.48),'rmse');
 // Ranks x 1..5; tied y ranks 1,2.5,4.5,2.5,4.5 (mean 3): Sxy 7, Sxx 10, Syy 9 → ρ = 7/√90.
 close(s.spearman,7/Math.sqrt(90),'spearman');
});
test('a constant column has no correlation or slope, even with floating-point noise',()=>{
 const s=stats([{x:.1,y:1},{x:.1,y:2},{x:.1,y:4}]);
 assert.equal(s.r,null);assert.equal(s.slope,null);assert.equal(s.intercept,null);assert.equal(s.rmse,null);
 const flatY=stats([{x:1,y:.7},{x:2,y:.7},{x:3,y:.7}]);assert.equal(flatY.r,null);assert.equal(flatY.slope,0);
});
