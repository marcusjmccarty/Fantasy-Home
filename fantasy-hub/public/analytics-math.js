/* Pure analytics. No network, DOM, or provider-specific globals. */
(function(root){
 'use strict';
 const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const quantile=(values,q)=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),i=(a.length-1)*q,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l)};
 function outlook(player,week,{historical=false}={}){
  const observations=Object.entries(player.scores||{}).map(([w,v])=>({week:Number(w),points:numeric(v)})).filter(x=>x.week>0&&x.week<week&&x.points!==null).sort((a,b)=>a.week-b.week).slice(-8);
  const values=observations.map(x=>x.points),mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const projection=numeric(player.projections?.[week])??(historical?null:numeric(player.espnProj)),center=projection??mean;
  const low=values.length>=4?quantile(values,.2):null,high=values.length>=4?quantile(values,.8):null;
  // Preserve the observed distance from the mean around the current projection.
  // This is a transparent scenario band, not a calibrated probability forecast.
  return {center,floor:low===null||center===null?null:Math.min(center,center+low-mean),ceiling:high===null||center===null?null:Math.max(center,center+high-mean),sample:values.length,observations,source:projection!==null?'Provider projection':'Historical mean',mean};
 }
 function value(player,week,mode='balanced'){
  const o=outlook(player,week),v=o.observations.map(x=>x.points),recent=v.slice(-3),form=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:null;
  if(mode==='projection')return numeric(player.projections?.[week])??numeric(player.espnProj);
  if(mode==='history')return o.mean;
  if(mode==='floor'||mode==='ceiling')return o[mode];
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
 function scoringHistory(player,week){
  return Object.entries(player.scores||{}).map(([w,v])=>({week:Number(w),actual:numeric(v)})).filter(r=>r.week>0&&r.week<week&&r.actual!==null).sort((a,b)=>a.week-b.week).map(r=>({...r,...outlook(player,r.week,{historical:true}),projection:numeric(player.projections?.[r.week])}));
 }
 function weeklyShares(row,week){
  return Object.entries(row?.weeks||{}).filter(([w])=>Number(w)>0&&Number(w)<week).sort((a,b)=>Number(a[0])-Number(b[0])).map(([w,r])=>{
   const denominator=numeric(r.team_totals?.carries)!==null&&numeric(r.team_totals?.targets)!==null?r.team_totals.carries+r.team_totals.targets:null;
   return {week:Number(w),share:denominator>0?(Number(r.carries||0)+Number(r.targets||0))/denominator*100:null};
  });
 }
 function touchdownEstimate(row,data,week){
  if(!row||data?.td_schema!==1)return null;
  const prior=r=>Object.entries(r.weeks||{}).filter(([w])=>Number(w)>0&&Number(w)<week).sort((a,b)=>Number(a[0])-Number(b[0])).map(([,v])=>v);
  const weeks=prior(row);if(weeks.length<4)return null;
  const peers=data.players.filter(r=>r.position===row.position&&r.gsis_id!==row.gsis_id).flatMap(prior);
  if(!peers.length)return null;
  const tds=rs=>rs.reduce((s,r)=>s+Number(r.rushing_tds||0)+Number(r.receiving_tds||0),0);
  const opportunities=rs=>rs.reduce((s,r)=>s+Number(r.carries||0)+Number(r.targets||0),0)/rs.length;
  const avg=opportunities(weeks);if(!avg)return null;
  // Four prior-equivalent weeks shrink a small sample toward its position cohort.
  // Recent workload adjusts frequency, not the success rate of an opportunity.
  const workload=Math.min(1.5,Math.max(.5,opportunities(weeks.slice(-3))/avg));
  const lambda=(tds(weeks)+4*tds(peers)/peers.length)/(weeks.length+4)*workload;
  return {chance:100*(1-Math.exp(-lambda)),lambda,sample:weeks.length,tds:tds(weeks),recentTouches:weeks.slice(-3).reduce((s,r)=>s+Number(r.carries||0)+Number(r.receptions||0),0)/Math.min(3,weeks.length),recentOpportunities:opportunities(weeks.slice(-3)),recentRedzone:weeks.slice(-3).reduce((s,r)=>s+Number(r.redzone_carries||0)+Number(r.redzone_targets||0),0)/Math.min(3,weeks.length)};
 }
 function tradeAnalysis(own,their,giveIds,getIds,slots,week,mode='balanced',drops={give:[],get:[]}){
  const picked=(roster,ids)=>roster.filter(p=>ids.includes(String(p.id)));
  const give=picked(own,giveIds),get=picked(their,getIds),sent=packageValue(give,week,mode),received=packageValue(get,week,mode);
  const afterOwn=[...own.filter(p=>!giveIds.includes(String(p.id))&&!drops.give?.includes(String(p.id))),...get];
  const afterTheir=[...their.filter(p=>!getIds.includes(String(p.id))&&!drops.get?.includes(String(p.id))),...give];
  const before=bestLineup(own,slots,week,mode),after=bestLineup(afterOwn,slots,week,mode),theirBefore=bestLineup(their,slots,week,mode),theirAfter=bestLineup(afterTheir,slots,week,mode);
  const ready=!!give.length&&!!get.length&&sent.total!==null&&received.total!==null;
  const delta=ready?received.total-sent.total:null;
  return {give,get,sent,received,before,after,theirBefore,theirAfter,afterOwn,afterTheir,ready,delta,balance:ready?100*(1-Math.min(1,Math.abs(delta)/Math.max(Math.abs(sent.total),Math.abs(received.total),1))):null,impact:ready&&before&&after?after.total-before.total:null,theirImpact:ready&&theirBefore&&theirAfter?theirAfter.total-theirBefore.total:null};
 }
 root.FantasyMath={numeric,quantile,outlook,scoringHistory,value,packageValue,bestLineup,weeklyShares,touchdownEstimate,tradeAnalysis};
})(globalThis);
