/* Pure analytics. No network, DOM, or provider-specific globals. */
(function(root){
 'use strict';
 const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const quantile=(values,q)=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),i=(a.length-1)*q,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l)};
 function outlook(player,week){
  const observations=Object.entries(player.scores||{}).map(([w,v])=>({week:Number(w),points:numeric(v)})).filter(x=>x.week>0&&x.week<week&&x.points!==null).sort((a,b)=>a.week-b.week).slice(-8);
  const values=observations.map(x=>x.points),mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const projection=numeric(player.projections?.[week])??numeric(player.espnProj),center=projection??mean;
  const low=values.length>=4?quantile(values,.2):null,high=values.length>=4?quantile(values,.8):null;
  // Preserve the observed distance from the mean around the current projection.
  // This is a transparent scenario band, not a calibrated probability forecast.
  return {center,floor:low===null||center===null?null:Math.min(center,center+low-mean),ceiling:high===null||center===null?null:Math.max(center,center+high-mean),sample:values.length,observations,source:projection!==null?'Provider projection':'Historical mean',mean};
 }
 function value(player,week,mode='balanced'){
  const o=outlook(player,week),v=o.observations.map(x=>x.points),recent=v.slice(-3),form=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:null;
  if(mode==='projection')return numeric(player.projections?.[week])??numeric(player.espnProj);
  if(mode==='history')return o.mean;
  if(o.center===null)return null;
  return form===null?o.center:o.center*.6+form*.4;
 }
 function packageValue(players,week,mode){const values=players.map(p=>value(p,week,mode));return {total:values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0),missing:values.filter(v=>v===null).length};}
 const eligible={QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],FLEX:['RB','WR','TE'],SUPERFLEX:['QB','RB','WR','TE'],K:['K'],DEF:['DEF','D/ST']};
 function bestLineup(players,slots,week,mode){
  if(slots.length>12)return null;
  const unique=[...new Map(players.map(p=>[String(p.id),p])).values()];
  const scores=unique.map(p=>value(p,week,mode));
  // Bitmask assignment gives the highest scoring lineup, including flex slots,
  // without assigning one player twice. Missing scores are not replaced by zero.
  let dp=new Map([[0,{total:0,players:[]}]]);
  unique.forEach((p,i)=>{if(scores[i]===null)return;const next=new Map(dp);for(const [mask,state] of dp)slots.forEach((slot,j)=>{
   if((mask&(1<<j))||!eligible[slot]?.includes(p.pos))return;const key=mask|(1<<j),total=state.total+scores[i];
   if(!next.has(key)||total>next.get(key).total)next.set(key,{total,players:[...state.players,{slot,index:j,player:p.id,points:scores[i]}]});
  });dp=next;});
  const result=dp.get((1<<slots.length)-1);return result?{...result,missing:unique.filter((p,i)=>scores[i]===null).length}:null;
 }
 root.FantasyMath={numeric,quantile,outlook,value,packageValue,bestLineup};
})(globalThis);
