/* Pure analytics. No network, DOM, or provider-specific globals. */
(function(root){
 'use strict';
 const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const quantile=(values,q)=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),i=(a.length-1)*q,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l)};
 function projectionFor(player,week){return numeric(player.projections?.[week])??(!player.projectionWeek||Number(player.projectionWeek)===Number(week)?numeric(player.espnProj):null);}
 function outlook(player,week,{historical=false}={}){
  const observations=Object.entries(player.scores||{}).map(([w,v])=>({week:Number(w),points:numeric(v)})).filter(x=>x.week>0&&x.week<week&&x.points!==null).sort((a,b)=>a.week-b.week).slice(-8);
  const values=observations.map(x=>x.points),mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const projection=historical?numeric(player.projections?.[week]):projectionFor(player,week),center=projection??mean;
  const low=values.length>=4?quantile(values,.2):null,high=values.length>=4?quantile(values,.8):null;
  // Preserve the observed distance from the mean around the current projection.
  // This is a transparent scenario band, not a calibrated probability forecast.
  return {center,floor:low===null||center===null?null:Math.min(center,center+low-mean),ceiling:high===null||center===null?null:Math.max(center,center+high-mean),sample:values.length,observations,source:projection!==null?'Provider projection':'Historical mean',mean};
 }
 function value(player,week,mode='balanced'){
  if(mode==='projection')return projectionFor(player,week);
  const o=outlook(player,week),v=o.observations.map(x=>x.points),recent=v.slice(-3),form=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:null;
  if(mode==='history')return o.mean;
  if(mode==='floor'||mode==='ceiling')return o[mode];
  if(o.center===null)return null;
  return form===null?o.center:o.center*.6+form*.4;
 }
 function tradeValue(player,week,mode='projection'){return player.tradeUnavailable?0:value(player,week,mode);}
 function packageValue(players,week,mode){const values=players.map(p=>tradeValue(p,week,mode));return {total:values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0),missing:values.filter(v=>v===null).length};}
 const eligible={QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],FLEX:['RB','WR','TE'],SUPERFLEX:['QB','RB','WR','TE'],K:['K'],DEF:['DEF','D/ST']};
 function bestLineup(players,slots,week,mode){
  return scoredLineup(players,slots,p=>tradeValue(p,week,mode));
 }
 function slotLabel(slot){return typeof slot==='string'?slot:slot.label||'Slot '+slot.id;}
 function canFill(player,slot){
  if(typeof slot==='object'&&Array.isArray(player.eligibleSlots)&&player.eligibleSlots.length)return player.eligibleSlots.map(Number).includes(Number(slot.id));
  return (typeof slot==='object'?slot.positions:eligible[slot])?.includes(player.pos)||false;
 }
 // Rectangular Hungarian assignment: exact maximum scoring, one player per slot.
 // Polynomial work keeps exhaustive small-package trade searches responsive.
 function scoredLineup(players,slots,score){
  if(!Array.isArray(slots)||!slots.length)return null;
  const all=[...new Map(players.map(p=>[String(p.id),p])).values()],scored=all.map(p=>({p,points:score(p)})),known=scored.filter(r=>r.points!==null&&Number.isFinite(r.points));
  const m=slots.length,n=known.length;if(n<m)return null;
  const allowed=slots.map(slot=>known.map(({p})=>canFill(p,slot))),u=new Float64Array(m+1),v=new Float64Array(n+1),assignment=new Int32Array(n+1),way=new Int32Array(n+1);
  for(let i=1;i<=m;i++){
   assignment[0]=i;let j0=0;const minimum=new Float64Array(n+1).fill(Infinity),used=new Uint8Array(n+1);
   do{
    used[j0]=1;const i0=assignment[j0];let delta=Infinity,j1=0;
    for(let j=1;j<=n;j++)if(!used[j]){
     const cost=allowed[i0-1][j-1]?-known[j-1].points-u[i0]-v[j]:Infinity;
     if(cost<minimum[j]){minimum[j]=cost;way[j]=j0;}
     if(minimum[j]<delta){delta=minimum[j];j1=j;}
    }
    if(!Number.isFinite(delta))return null;
    for(let j=0;j<=n;j++)if(used[j]){u[assignment[j]]+=delta;v[j]-=delta;}else minimum[j]-=delta;
    j0=j1;
   }while(assignment[j0]);
   do{const j1=way[j0];assignment[j0]=assignment[j1];j0=j1;}while(j0);
  }
  const lineup=[];for(let j=1;j<=n;j++)if(assignment[j]){const index=assignment[j]-1;lineup.push({slot:slotLabel(slots[index]),index,player:known[j-1].p.id,points:known[j-1].points});}
  lineup.sort((a,b)=>a.index-b.index);
  return {total:lineup.reduce((sum,p)=>sum+p.points,0),players:lineup,missing:scored.length-known.length};
 }
 function leagueLineup(model){
  const labels={0:['QB',['QB']],1:['TEAM QB',['QB']],2:['RB',['RB']],3:['RB / WR',['RB','WR']],4:['WR',['WR']],5:['WR / TE',['WR','TE']],6:['TE',['TE']],7:['SUPERFLEX',['QB','RB','WR','TE']],16:['D/ST',['DEF','D/ST']],17:['K',['K']],23:['FLEX',['RB','WR','TE']],24:['FLEX',['RB','WR','TE']]};
  const counts=model.settings?.rosterSettings?.lineupSlotCounts;
  if(counts&&typeof counts==='object'){
   const slots=[];for(const [id,count] of Object.entries(counts).sort((a,b)=>[0,1,2,4,6,3,5,7,23,24,16,17].indexOf(Number(a[0]))-[0,1,2,4,6,3,5,7,23,24,16,17].indexOf(Number(b[0])))){
    if([20,21].includes(Number(id))||!Number.isInteger(Number(count))||count<0||count>30)continue;
    const [label,positions]=labels[id]||['SLOT '+id,[]];for(let i=0;i<Number(count);i++)slots.push({id:Number(id),label,positions});
   }
   return {slots,source:'ESPN league settings'};
  }
  if(model.source==='demo')return {slots:['QB','RB','RB','WR','WR','TE','FLEX','DEF','K'],source:'Exhibition lineup'};
  if(Array.isArray(model.rosterPositions))return {slots:model.rosterPositions.filter(s=>!['BN','BE','IR','RESERVE'].includes(s)).map(s=>s==='SUPER_FLEX'?'SUPERFLEX':s==='DEF'?'DEF':s),source:'League roster settings'};
  const recorded=model.teams?.map(t=>(t.currentLineup||[]).filter(e=>e.starter!==false&&![20,21].includes(Number(e.slot)))).find(rows=>rows.length&&rows.every(e=>Number.isInteger(e.slot)));
  return {slots:recorded?.map(e=>({id:e.slot,label:labels[e.slot]?.[0]||'SLOT '+e.slot,positions:labels[e.slot]?.[1]||[]}))||[],source:recorded?'Recorded starting slots':'Lineup settings unavailable'};
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
 function createTradeEvaluator(own,their,slots,week,mode='projection'){
  own=[...new Map(own.map(p=>[String(p.id),p])).values()];their=[...new Map(their.map(p=>[String(p.id),p])).values()];
  const scores=new Map([...own,...their].map(p=>[p,tradeValue(p,week,mode)])),score=p=>scores.get(p);
  const before=scoredLineup(own,slots,score),theirBefore=scoredLineup(their,slots,score);
  const packageScore=players=>{const values=players.map(score);return {total:values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0),missing:values.filter(v=>v===null).length};};
  return (giveIds,getIds,drops={give:[],get:[]})=>{
   const giveSet=new Set(giveIds.map(String)),getSet=new Set(getIds.map(String)),ownDrops=new Set((drops.give||[]).map(String)),theirDrops=new Set((drops.get||[]).map(String));
   const give=own.filter(p=>giveSet.has(String(p.id))),get=their.filter(p=>getSet.has(String(p.id))),sent=packageScore(give),received=packageScore(get);
   const afterOwn=[...own.filter(p=>!giveSet.has(String(p.id))&&!ownDrops.has(String(p.id))),...get];
   const afterTheir=[...their.filter(p=>!getSet.has(String(p.id))&&!theirDrops.has(String(p.id))),...give];
   const unchanged=!give.length&&!get.length;
   const after=unchanged&&!ownDrops.size?before:scoredLineup(afterOwn,slots,score),theirAfter=unchanged&&!theirDrops.size?theirBefore:scoredLineup(afterTheir,slots,score);
   const ready=!!give.length&&!!get.length&&sent.total!==null&&received.total!==null,delta=ready?received.total-sent.total:null;
   return {give,get,sent,received,before,after,theirBefore,theirAfter,afterOwn,afterTheir,requiredDrops:{give:Math.max(0,afterOwn.length-own.length),get:Math.max(0,afterTheir.length-their.length)},ready,delta,balance:ready?100*(1-Math.min(1,Math.abs(delta)/Math.max(Math.abs(sent.total),Math.abs(received.total),1))):null,impact:ready&&before&&after?after.total-before.total:null,theirImpact:ready&&theirBefore&&theirAfter?theirAfter.total-theirBefore.total:null};
  };
 }
 function tradeAnalysis(own,their,giveIds,getIds,slots,week,mode='projection',drops={give:[],get:[]}){
  return createTradeEvaluator(own,their,slots,week,mode)(giveIds,getIds,drops);
 }
 function searchTrades(own,their,slots,week,mode='projection',{limit=50000}={}){
  const evaluate=createTradeEvaluator(own,their,slots,week,mode),baseline=evaluate([],[]);
  if(!baseline.before||!baseline.theirBefore)return {results:[],checked:0,total:0,scope:'1–2 players per side',unavailable:true};
  const packages=roster=>{const ids=[...new Set(roster.filter(p=>tradeValue(p,week,mode)!==null).map(p=>String(p.id)))];return [...ids.map(id=>[id]),...ids.flatMap((id,i)=>ids.slice(i+1).map(next=>[id,next]))];};
  const left=packages(own),right=packages(their),all=left.length*right.length,limited=all>limit;
  const results=[];let checked=0,total=0;
  const dropFor=(after,lineup,incoming,originalCount)=>{
   const count=after.length-originalCount;if(count<=0)return [];
   const starters=new Set(lineup.players.map(p=>String(p.player)));
   return after.filter(p=>!starters.has(String(p.id))&&!incoming.includes(String(p.id))).sort((a,b)=>(tradeValue(a,week,mode)??-Infinity)-(tradeValue(b,week,mode)??-Infinity)).slice(0,count).map(p=>String(p.id));
  };
  for(const give of left)for(const get of right){
   if(limited&&give.length===2&&get.length===2)continue;total++;if(checked>=limit)continue;checked++;
   let a=evaluate(give,get);
   if(a.impact===null||a.theirImpact===null||a.impact<.05||a.theirImpact<.05)continue;
   const drops={give:dropFor(a.afterOwn,a.after,get,own.length),get:dropFor(a.afterTheir,a.theirAfter,give,their.length)};
   if(drops.give.length||drops.get.length)a=evaluate(give,get,drops);
   if(a.afterOwn.length>own.length||a.afterTheir.length>their.length)continue;
   if(a.impact===null||a.theirImpact===null||a.impact<.05||a.theirImpact<.05)continue;
   const signals=tradeSignals(a);
   results.push({give,get,drops,impact:a.impact,theirImpact:a.theirImpact,balance:a.balance,yourChange:signals.yourChange,theirChange:signals.theirChange});
  }
  results.sort((a,b)=>Math.min(b.yourChange??0,b.theirChange??0)-Math.min(a.yourChange??0,a.theirChange??0)||(b.impact+b.theirImpact)-(a.impact+a.theirImpact)||b.balance-a.balance);
  return {results,checked,total,scope:limited?'1-for-1, 1-for-2 & 2-for-1':'All 1–2 player packages',limited:checked<all};
 }
 function tradeSignals(a){
  const sent=a.sent?.total,received=a.received?.total,valid=a.ready&&sent>=0&&received>=0&&sent+received>0;
  const change=(before,impact)=>before&&Math.abs(before.total)>0&&impact!==null?impact/Math.abs(before.total)*100:null;
  return {yourShare:valid?received/(sent+received)*100:null,theirShare:valid?sent/(sent+received)*100:null,yourChange:a.ready?change(a.before,a.impact):null,theirChange:a.ready?change(a.theirBefore,a.theirImpact):null};
 }
 root.FantasyMath={numeric,quantile,outlook,scoringHistory,value,tradeValue,packageValue,bestLineup,weeklyShares,touchdownEstimate,tradeAnalysis,createTradeEvaluator,tradeSignals,leagueLineup,slotLabel,searchTrades};
})(globalThis);
