// Run: node scripts/benchmark-analytics.mjs [older analytics-math.js]
// Measures synchronous analytics only, not network or browser rendering.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const positions=['QB','QB','RB','RB','RB','RB','WR','WR','WR','WR','WR','TE','TE','K','DEF','RB','WR','QB','TE','DEF'];
const roster=team=>positions.map((pos,i)=>({id:`${team}-${i}`,pos,scores:Object.fromEntries(Array.from({length:12},(_,w)=>[w+1,((i*11+w*7+team*3)%31)-2])),projections:{13:5+(i*13+team*3)%25}}));
const own=roster(1),their=roster(2),slots=['QB','RB','RB','WR','WR','TE','FLEX','SUPERFLEX','K','DEF'];
for(const file of [...process.argv.slice(2),new URL('../public/analytics-math.js',import.meta.url)]){
 const context=vm.createContext({});vm.runInContext(readFileSync(file,'utf8'),context);const math=context.FantasyMath;
 const batch=()=>{
  const evaluate=math.createTradeEvaluator?.(own,their,slots,13,'balanced')||((give,get)=>math.tradeAnalysis(own,their,give,get,slots,13,'balanced'));
  let checksum=0;
  for(let i=0;i<their.length;i++)if(i!==2){const a=evaluate(['1-2'],['2-2',`2-${i}`]);checksum+=a.delta+(a.impact??0)+(a.theirImpact??0);}
  return checksum;
 };
 for(let i=0;i<3;i++)batch();const samples=[];let checksum;
 for(let i=0;i<9;i++){const start=performance.now();checksum=batch();samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);
 console.log(JSON.stringify({file:String(file),scenario:'19 counteroffers / 20-player rosters / 10 starters',medianMs:+samples[4].toFixed(2),rangeMs:[samples[0],samples.at(-1)].map(n=>+n.toFixed(2)),checksum:+checksum.toFixed(6)}));
}
