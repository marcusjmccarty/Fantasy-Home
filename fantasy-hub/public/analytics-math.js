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
  if(mode==='projection')return numeric(player.projections?.[week])??numeric(player.espnProj);
  const o=outlook(player,week),v=o.observations.map(x=>x.points),recent=v.slice(-3),form=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:null;
  if(mode==='history')return o.mean;
  if(mode==='floor'||mode==='ceiling')return o[mode];
  if(o.center===null)return null;
  return form===null?o.center:o.center*.6+form*.4;
 }
 function packageValue(players,week,mode){const values=players.map(p=>value(p,week,mode));return {total:values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0),missing:values.filter(v=>v===null).length};}
 const eligible={QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],FLEX:['RB','WR','TE'],SUPERFLEX:['QB','RB','WR','TE'],K:['K'],DEF:['DEF','D/ST']};
 function bestLineup(players,slots,week,mode){
  return scoredLineup(players,slots,p=>value(p,week,mode));
 }
 function scoredLineup(players,slots,score){
  if(slots.length>12)return null;
  const unique=[...new Map(players.map(p=>[String(p.id),p])).values()];
  const scores=unique.map(score),size=1<<slots.length,full=size-1;
  // Descending masks cannot reuse the current player. Immutable path links
  // preserve earlier assignments without copying a lineup at every transition.
  const totals=new Float64Array(size).fill(-Infinity),paths=new Array(size),positionMasks=new Map(),slotIndexes=[],previousSlots=[];
  slots.forEach((slot,j)=>{slotIndexes[1<<j]=j;const previous=j?slots.lastIndexOf(slot,j-1):-1;previousSlots[j]=previous>=0?1<<previous:0;});
  totals[0]=0;
  for(let i=0;i<unique.length;i++){
   const p=unique[i],points=scores[i];if(points===null)continue;
   if(!positionMasks.has(p.pos))positionMasks.set(p.pos,slots.reduce((mask,slot,j)=>mask|(eligible[slot]?.includes(p.pos)?1<<j:0),0));
   const positions=positionMasks.get(p.pos);if(!positions)continue;
   for(let mask=full;mask>=0;mask--){
    if(totals[mask]===-Infinity)continue;
    let available=positions&~mask;
    while(available){
     const bit=available&-available,index=slotIndexes[bit];available^=bit;
     // Identical slots are interchangeable: fill them in order instead of
     // exploring every permutation of the same RB/WR assignment.
     if(previousSlots[index]&&!(mask&previousSlots[index]))continue;
     const key=mask|bit,total=totals[mask]+points;
     if(total>totals[key]){totals[key]=total;paths[key]={previous:paths[mask],index,player:p.id,points};}
    }
   }
  }
  if(totals[full]===-Infinity)return null;
  const playersInLineup=[];
  for(let path=paths[full];path;path=path.previous)playersInLineup.push({slot:slots[path.index],index:path.index,player:path.player,points:path.points});
  return {total:totals[full],players:playersInLineup.reverse(),missing:scores.filter(v=>v===null).length};
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
 // One synchronous comparison batch owns this snapshot. Nothing is cached
 // across roster, week, projection or valuation changes.
 function createTradeEvaluator(own,their,slots,week,mode='balanced'){
  const scores=new Map([...own,...their].map(p=>[p,value(p,week,mode)])),score=p=>scores.get(p);
  const before=scoredLineup(own,slots,score),theirBefore=scoredLineup(their,slots,score);
  const packageScore=players=>{const values=players.map(score);return {total:values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0),missing:values.filter(v=>v===null).length};};
  return (giveIds,getIds,drops={give:[],get:[]})=>{
   const giveSet=new Set(giveIds),getSet=new Set(getIds),ownDrops=new Set(drops.give),theirDrops=new Set(drops.get);
   const give=own.filter(p=>giveSet.has(String(p.id))),get=their.filter(p=>getSet.has(String(p.id))),sent=packageScore(give),received=packageScore(get);
   const afterOwn=[...own.filter(p=>!giveSet.has(String(p.id))&&!ownDrops.has(String(p.id))),...get];
   const afterTheir=[...their.filter(p=>!getSet.has(String(p.id))&&!theirDrops.has(String(p.id))),...give];
   const unchanged=!give.length&&!get.length;
   const after=unchanged&&!ownDrops.size?before:scoredLineup(afterOwn,slots,score),theirAfter=unchanged&&!theirDrops.size?theirBefore:scoredLineup(afterTheir,slots,score);
   const ready=!!give.length&&!!get.length&&sent.total!==null&&received.total!==null,delta=ready?received.total-sent.total:null;
   return {give,get,sent,received,before,after,theirBefore,theirAfter,afterOwn,afterTheir,ready,delta,balance:ready?100*(1-Math.min(1,Math.abs(delta)/Math.max(Math.abs(sent.total),Math.abs(received.total),1))):null,impact:ready&&before&&after?after.total-before.total:null,theirImpact:ready&&theirBefore&&theirAfter?theirAfter.total-theirBefore.total:null};
  };
 }
 function tradeAnalysis(own,their,giveIds,getIds,slots,week,mode='balanced',drops={give:[],get:[]}){
  return createTradeEvaluator(own,their,slots,week,mode)(giveIds,getIds,drops);
 }
 root.FantasyMath={numeric,quantile,outlook,scoringHistory,value,packageValue,bestLineup,weeklyShares,touchdownEstimate,tradeAnalysis,createTradeEvaluator};
})(globalThis);
