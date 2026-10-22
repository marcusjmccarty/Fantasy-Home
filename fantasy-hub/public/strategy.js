/* Strategy workspaces: observed opportunity, transparent estimates, roster analysis. */
'use strict';
const STRATEGY={identity:'',player:null,scope:'all',homeScope:'active',homePlayer:null,lastCurrent:null,leaders:'active',period:'season',position:'ALL',search:'',sort:'opportunities',usage:new Map(),usageBusy:new Set(),usageErrors:new Map(),defense:new Map(),defenseBusy:new Set(),ai:new Map(),aiBusy:new Set(),aiErrors:new Map(),trade:{partner:null,give:[],get:[],mode:'balanced',format:'standard',drops:{give:[],get:[]},alternatives:[]}};
const STRATEGY_FORMATS={standard:['QB','RB','RB','WR','WR','TE','FLEX','K','DEF'],threewr:['QB','RB','RB','WR','WR','WR','TE','FLEX','K','DEF'],superflex:['QB','RB','RB','WR','WR','TE','FLEX','SUPERFLEX','K','DEF']};
const strategyWeek=()=>Math.max(1,Math.min(18,Number(model.currentWeek||model.liveWeek||(model.source==='demo'?7:currentWeek)||1)));
function usagePlayer(r){return getPool().find(p=>usageFor(p,{players:[r]})===r)||{id:'usage:'+r.gsis_id,name:r.name,pos:r.position,nfl:Object.values(r.weeks).at(-1)?.team,scores:{},status:'Availability not supplied'};}
function strategyPlayerPool(scope='all'){
 const pool=scope==='all'?getPool():tradeRoster(scope==='active'?getTeam():findTeam(scope));
 return [...pool].sort((a,b)=>a.name.localeCompare(b.name));
}
function scopeOptions(selected){return [['all','Every player'],['active','Active franchise'],...model.teams.map(t=>[String(t.id),teamName(t)])].map(([id,label])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('');}
function strategyContext(){
 const key=`${model.source}|${model.season}|${model.leagueId||model.league}|${getTeam()?.id}`;
 if(STRATEGY.identity!==key){STRATEGY.identity=key;STRATEGY.player=null;STRATEGY.homePlayer=null;STRATEGY.scope='all';STRATEGY.homeScope='active';STRATEGY.trade.give=[];STRATEGY.trade.get=[];STRATEGY.trade.partner=null;STRATEGY.trade.drops={give:[],get:[]};STRATEGY.trade.alternatives=[];STRATEGY.trade.searched=false;}
}
function strategyPlayer(){
 const id=STRATEGY.player||XL.player||currentPlayerId;
 const p=getPool().find(p=>String(p.id)===String(id));if(p)return p;
 if(String(id).startsWith('usage:')){const row=usageDataset()?.players.find(p=>'usage:'+p.gsis_id===id);if(row)return usagePlayer(row);}
 return rowsFor(getTeam())[0]||getPool()[0];
}
function strategyHeading(kicker,title,copy){return `<header class="strategy-heading">${heading(title,copy)}<span class="strategy-source">${model.source==='demo'?'SYNTHETIC EXHIBITION DATA':esc(model.season)+' SEASON'}<br>WEEK ${strategyWeek()}</span></header>`;}
function strategyPlayerPicker(p,extra=''){
 const pool=strategyPlayerPool(STRATEGY.scope);
 return `<div class="lab-controls strategy-ribbon"><label>FRANCHISE<select id="strategy-scope">${scopeOptions(STRATEGY.scope)}</select></label><label class="ribbon-player">PLAYER<select id="strategy-player">${p&&!pool.some(x=>String(x.id)===String(p.id))?`<option value="${esc(p.id)}">${esc(p.name)} · selected outside filter</option>`:''}${pool.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(p?.id)?'selected':''}>${esc(x.name)} · ${esc(x.pos)} · ${esc(x.nfl)}</option>`).join('')}</select></label>${extra}${!extra&&p?`<span class="strategy-picker-note">${esc(p.status||'Status unavailable')} · ${esc(model.scoring)}</span><button class="lab-action" data-strategy-profile="${esc(p.id)}">Player file ↗</button>`:''}</div>`;
}
function strategyMetric(label,value,detail='',accent=''){return `<div class="strategy-metric ${accent}"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(detail)}</small></div>`;}
function renderStrategy(type){strategyContext();if(XL.player&&['outlook','opportunity'].includes(type)&&!STRATEGY.player)STRATEGY.player=XL.player;if(type==='outlook')renderDefensiveOutlook();else if(type==='opportunity')renderOpportunity();else renderTrade();}
function currentProjection(p){return FantasyMath.outlook(p,strategyWeek());}
const RANGE_HELP={floor:'The lower scenario shifts the historical 20th percentile around the current center, using up to eight earlier scoring weeks. At least four observations are required. It is not a minimum: a player can score below this number.',center:'Uses the provider’s projection for this week. If none was supplied, the center is the mean of up to eight earlier recorded weeks, labeled Historical mean. This is an estimate, not a guaranteed score.',ceiling:'The upper scenario shifts the historical 80th percentile around the current center, using up to eight earlier scoring weeks. At least four observations are required. It is not a maximum or a calibrated confidence bound.'};
function rangeBar(o){
 if(o.floor===null||o.ceiling===null)return '<div class="range-unavailable">Range requires four prior scoring weeks.</div>';
 const span=Math.max(o.ceiling-o.floor,1),lo=o.floor-span*.15,hi=o.ceiling+span*.15,pos=v=>(v-lo)/(hi-lo)*100;
 return `<div class="range-track" role="img" aria-label="Estimated floor ${labFormat(o.floor)}, center ${labFormat(o.center)}, estimated ceiling ${labFormat(o.ceiling)} fantasy points"><i class="range-floor" style="left:${pos(o.floor)}%"></i><i class="range-center" style="left:${pos(o.center)}%"></i><i class="range-ceiling" style="left:${pos(o.ceiling)}%"></i></div><div class="range-labels"><span>FLOOR ${labFormat(o.floor)}</span><span>CENTER ${labFormat(o.center)}</span><span>CEILING ${labFormat(o.ceiling)}</span></div>`;
}
function rangeMetrics(o,compact=false){return `<div class="strategy-metrics three ${compact?'compact-range':''}">${[['floor','Estimated floor',o.floor],['center',o.source==='Provider projection'?'Provider prediction':'Historical mean',o.center],['ceiling','Estimated ceiling',o.ceiling]].map(([key,label,value])=>`<details class="strategy-metric range-help ${key==='center'?'featured':''}"><summary><span>${label} <i aria-hidden="true">ⓘ</i></span><strong>${labFormat(value)}</strong></summary><p>${RANGE_HELP[key]}</p></details>`).join('')}</div>`;}
function matchupContext(p){
 const data=STRATEGY.defense.get(`${model.season}:${strategyWeek()}`),opp=data?.opponents?.[normalizeNFLAbbr(p.nfl)],isDefense=['DEF','D/ST'].includes(p.pos),side=isDefense?'offense':'defense';
 return {data,opp,isDefense,side,rating:data?.teams?.[opp],unit:data?.units?.[opp]?.[side]};
}
function matchupSummary(p){
 const {data,opp,isDefense,rating,unit}=matchupContext(p);
 if(model.source==='demo')return 'Exhibition scoring is synthetic. Connect a league to see the verified opponent, NFL efficiency and an AI matchup report.';
 if(!opp)return 'No opponent is confirmed in the schedule feed for this week. This may be a bye or unavailable schedule data; a scoring estimate does not establish that a game is scheduled.';
 const rank=rating?.[isDefense?'offenseRank':'defenseRank'],ppg=rating?.[isDefense?'offensePPG':'defenseAllowedPPG'];
 return `${opp} ${isDefense?'scores':'allows'} ${labFormat(ppg)} NFL points per game${rank?' (#'+rank+' of '+data.rankedTeams+')':''}.${unit?` ${labFormat(unit.yardsPerPlay)} yards per play${isDefense?'':' allowed'}; ${labPct(unit.sackRate)} ${isDefense?'sack rate conceded':'sack rate generated'}.`:''} ${isDefense?'Opponent scoring and giveaways frame the D/ST matchup.':'Team-level context; position-specific fantasy points allowed are not supplied.'}`;
}
function opponentMetrics(p){
 const {data,isDefense,rating,unit}=matchupContext(p),rank=rating?.[isDefense?'offenseRank':'defenseRank'];
 const peers=Object.values(data?.units||{}).map(t=>t[isDefense?'offense':'defense']).filter(Boolean);
 const avg=key=>{const values=peers.map(t=>t[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;};
 const rows=[[isDefense?'Points / game':'Points allowed / game',rating?.[isDefense?'offensePPG':'defenseAllowedPPG'],null,'points'],['Yards / play',unit?.yardsPerPlay,avg('yardsPerPlay'),'number'],['Net pass yards / play',unit?.netPassYardsPerPlay,avg('netPassYardsPerPlay'),'number'],['Rush yards / play',unit?.rushYardsPerPlay,avg('rushYardsPerPlay'),'number'],[isDefense?'Sack rate conceded':'Sack rate generated',unit?.sackRate,avg('sackRate'),'percent'],[isDefense?'Giveaways / game':'Takeaways / game',unit?.turnoversPerGame,avg('turnoversPerGame'),'number'],['EPA / play',unit?.epaPerPlay,avg('epaPerPlay'),'epa'],['Success rate',unit?.successRate,avg('successRate'),'percent'],['Explosive play rate',unit?.explosiveRate,avg('explosiveRate'),'percent']];
 return `<div class="opponent-table">${expandTable(['OPPONENT METRIC',isDefense?'OFFENSE':'DEFENSE','NFL UNIT AVG','DIFFERENCE'],rows.map(([label,value,mean,kind])=>{const fmt=n=>kind==='percent'?labPct(n):labFormat(n,kind==='epa'?2:1),delta=value!=null&&mean!=null?value-mean:null;return `<tr><th scope="row">${label}</th><td><b>${fmt(value)}</b></td><td>${fmt(mean)}</td><td>${kind==='points'?(rank?'#'+rank+' / '+data.rankedTeams:'—'):delta===null?'—':(delta>0?'+':'')+labFormat(delta,kind==='epa'?2:1)+(kind==='percent'?' pp':'')}</td></tr>`}))}</div>`;
}
function aiKey(p){return `${model.source}:${model.leagueId||model.league}:${model.season}:${strategyWeek()}:${p.id}:${JSON.stringify(p.scores)}:${currentProjection(p).center}`;}
function matchupAI(p,compact=false){
 const key=aiKey(p),result=STRATEGY.ai.get(key),busy=STRATEGY.aiBusy.has(key),error=STRATEGY.aiErrors.get(key);
 if(result)return `<div class="matchup-ai ${compact?'compact':''}"><span class="strategy-section-label">AI MATCHUP OVERVIEW · ${esc(result.provider)}</span>${result.outlook.split(/\n\s*\n/).filter(Boolean).map(t=>`<p>${esc(t)}</p>`).join('')}</div>`;
 if(compact)return `<p class="matchup-home-copy">${esc(matchupSummary(p))}</p>`;
 return `<div class="matchup-ai"><p>${esc(matchupSummary(p))}</p>${model.source==='demo'?'<p class="lab-note">AI analysis is available for connected league players; demonstration scores are never presented as real NFL evidence.</p>':`<button class="lab-action" data-matchup-ai="${esc(p.id)}" ${busy?'disabled':''}>${busy?'Analyzing matchup…':'Generate AI matchup overview ↗'}</button><span class="ai-generation-note" role="status">${esc(error||'2–3 paragraphs · generated from scoring and verified opponent data')}</span>`}</div>`;
}
function priorScoring(p,compact=false){
 const rows=FantasyMath.scoringHistory(p,strategyWeek());
 return `<section class="lab-panel prior-scoring"><h4>PRIOR SCORING / WEEK-BY-WEEK</h4>${rows.length?expandTable(['WK','FLOOR¹','PROJ.','CEILING¹','ACTUAL','Δ PROJ.'],rows.map(r=>`<tr><td>W${r.week}</td><td>${labFormat(r.floor)}</td><td>${labFormat(r.projection)}</td><td>${labFormat(r.ceiling)}</td><td><b>${labFormat(r.actual)}</b></td><td class="${r.projection!==null&&r.actual>=r.projection?'positive-text':'negative-text'}">${r.projection===null?'—':labFormat(r.actual-r.projection)}</td></tr>`)):'<p class="lab-note">No prior scores supplied.</p>'}<p class="lab-note">¹ Reconstructed from earlier weeks only, not archived forecasts. Missing provider projections stay blank; ranges use the prior mean when absent. Four earlier scores required.</p></section>`;
}
function scoutingFile(p){
 const o=currentProjection(p),m=matchupContext(p);
 return `<section class="lab-panel scouting-file" data-strategy-open="outlook" data-strategy-player="${esc(p.id)}" tabindex="0" role="link" aria-label="Open Player Outlook for ${esc(p.name)}"><h4>SCOUTING FILE <span>PLAYER OUTLOOK ↗</span></h4><dl class="scouting-facts">${[['Availability',p.status||'Not supplied'],['Position / NFL',`${p.pos} / ${p.nfl}`],['Rostered',labPct(p.owned)],['Started',labPct(p.started)],['Scoring source',sourceName()],['Current projection',o.source==='Provider projection'?labFormat(o.center):'Not supplied']].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="scouting-outlook"><div class="window-topline"><b>WEEK ${strategyWeek()} / SCORING SCENARIOS</b><span>${m.opp?'VS '+esc(m.opp):'OPPONENT UNCONFIRMED'}</span></div>${rangeMetrics(o,true)}${rangeBar(o)}<p class="lab-note">${esc(m.opp?`${m.opp} ${m.isDefense?'offense':'defense'} · ${labFormat(m.unit?.yardsPerPlay)} yards/play · ${labPct(m.unit?.sackRate)} sack rate.`:model.source==='demo'?'Exhibition values · connect a league for NFL matchup analysis.':'Opponent data pending.')} Open Player Outlook for the full matchup analysis.</p></div></section>`;
}
function renderDefensiveOutlook(){
 const p=strategyPlayer();if(!p){setExplorer(strategyHeading('PLAYER OUTLOOK','Select a league first','Load player data to see projections and opponent context.'));return;}
 const o=currentProjection(p),key=`${model.season}:${strategyWeek()}`,m=matchupContext(p);
 setExplorer(strategyHeading('PLAYER OUTLOOK',p.name,'PLAYER OUTLOOK / Scoring range, prior evidence and the matchup ahead.')+strategyPlayerPicker(p)+
 `<div class="strategy-outlook-grid"><section class="strategy-range"><h4>PROJECTED SCORING RANGE <span>WEEK ${strategyWeek()} · ${esc(model.scoring)}</span></h4>${rangeMetrics(o)}<div class="range-evidence">${strategyMetric('Prior scoring average',labFormat(o.mean))}${strategyMetric('Last 3 average',labFormat(o.observations.length?o.observations.slice(-3).reduce((s,r)=>s+r.points,0)/Math.min(3,o.observations.length):null))}${strategyMetric('Prior weeks',String(o.sample))}</div>${rangeBar(o)}<p>${o.sample} prior scoring weeks · select a metric for its explanation. ${/^(OUT|IR|INJURED_RESERVE|SUSPENDED)$/i.test(p.status||'')?'PLAYER MARKED UNAVAILABLE. Estimates do not override injury status.':''}</p></section>${priorScoring(p)}</div>`+
 `<section class="lab-panel strategy-opponent"><div class="strategy-section-title"><h4>${m.isDefense?'OPPOSING OFFENSE':'DEFENSIVE OUTLOOK'} / ${m.opp?'VS '+esc(m.opp):'OPPONENT UNCONFIRMED'}</h4>${model.source!=='demo'?`<button class="lab-action" id="strategy-refresh-defense">${STRATEGY.defenseBusy.has(key)?'Loading…':'Refresh opponent'}</button>`:''}</div><div class="opponent-report-grid">${opponentMetrics(p)}${matchupAI(p)}</div><p class="lab-note">${m.rating?m.rating.games+' completed games · ':''}NFL scoring: ESPN. Efficiency: NFLverse recorded plays before Week ${strategyWeek()}${m.unit?' ('+m.unit.games+' games)':''}. Lower EPA, success and explosive rates are better for a defense. Team points allowed includes all scoring; it is not fantasy points allowed to this position. The range is not adjusted by opponent ranking.</p></section>`);
 if(model.source!=='demo'&&!STRATEGY.defense.has(key))void loadStrategyDefense();
}
async function loadStrategyDefense(force=false){
 const key=`${model.season}:${strategyWeek()}`;if(STRATEGY.defenseBusy.has(key)||(!force&&STRATEGY.defense.has(key)))return;
 STRATEGY.defenseBusy.add(key);
 try{const r=await fetch(`/api/nfl/matchup-strength?season=${model.season}&week=${strategyWeek()}`);if(!r.ok)throw Error();STRATEGY.defense.set(key,await r.json());}catch{STRATEGY.defense.set(key,null);}finally{STRATEGY.defenseBusy.delete(key);if(XL.open==='outlook')renderDefensiveOutlook();renderStrategyHome();if(XL.open==='profile'){const p=getPool().find(p=>String(p.id)===String(XL.player)),host=el('explore-content').querySelector?.('.scouting-file');if(p&&host)host.outerHTML=scoutingFile(p);}}
}
async function generateMatchupAI(p){
 if(!p||model.source==='demo')return;
 const key=aiKey(p);if(STRATEGY.aiBusy.has(key))return;STRATEGY.aiBusy.add(key);STRATEGY.aiErrors.delete(key);if(XL.open==='outlook')renderDefensiveOutlook();
 const o=currentProjection(p),scores=o.observations,values=scores.map(r=>r.points),recent=values.slice(-3);
 try{const response=await fetch('/api/ai/outlook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report:'matchup',player:{id:p.id,name:p.name,pos:p.pos,nfl:normalizeNFLAbbr(p.nfl),status:p.status,season:Number(model.season),week:strategyWeek(),projection:o.source==='Provider projection'?o.center:null,floor:o.floor,ceiling:o.ceiling,average:o.mean,games:o.sample,recent:recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:null,last:values.at(-1),best:values.length?Math.max(...values):null,low:values.length?Math.min(...values):null,recentWeeks:scores.slice(-5)}})});const data=await response.json();if(!response.ok)throw Error(data.error||'Matchup analysis unavailable.');STRATEGY.ai.set(key,data);}catch(e){STRATEGY.aiErrors.set(key,e.message||'Unable to generate the overview. Retry shortly.');}finally{STRATEGY.aiBusy.delete(key);if(XL.open==='outlook'&&String(strategyPlayer()?.id)===String(p.id))renderDefensiveOutlook();renderStrategyHome();}
}
let demoUsageCache=null;
function demoUsage(){
 if(demoUsageCache?.model===model)return demoUsageCache.data;
 const fields=['carries','targets','receptions','redzone_carries','redzone_targets','inside10_carries','inside10_targets','inside5_carries','inside5_targets'];
 const data={td_schema:1,season:model.season,through_week:6,source:'Fictional demonstration',generated_at:null,players:getPool().filter(p=>['QB','RB','WR','TE'].includes(p.pos)).map((p,i)=>({name:p.name,gsis_id:p.id,position:p.pos,weeks:Object.fromEntries(Array.from({length:6},(_,n)=>{const carries=p.pos==='RB'?12+(i+n)%7:p.pos==='QB'?3+n%3:0,targets=p.pos==='QB'?0:4+(i+n)%6,values=[carries,targets,Math.floor(targets*.65),carries?2+n%3:0,targets?1+n%2:0,carries?1+n%2:0,targets?1:0,carries?1:0,0];return [n+1,{team:p.nfl,rushing_tds:carries&&((i+n)%3===0)?1:0,receiving_tds:targets&&((i+n)%4===0)?1:0,...Object.fromEntries(fields.map((f,j)=>[f,values[j]])),team_totals:{carries:28,targets:33,receptions:22,redzone_carries:7,redzone_targets:6,inside10_carries:4,inside10_targets:3,inside5_carries:3,inside5_targets:2}}]}))}))};
 demoUsageCache={model,data};return data;
}
function usageDataset(){return model.source==='demo'?demoUsage():STRATEGY.usage.get(Number(model.season));}
async function loadUsage(force=false){
 const season=Number(model.season);if(STRATEGY.usageBusy.has(season)||(!force&&(STRATEGY.usage.has(season)||STRATEGY.usageErrors.has(season))))return;
 STRATEGY.usageBusy.add(season);STRATEGY.usageErrors.delete(season);
 try{const r=await fetch(`/data/usage-${season}.json`,{cache:force?'reload':'default'});if(!r.ok)throw Error('The season’s opportunity dataset has not been published yet.');const data=await r.json();if(data.schema!==1||Number(data.season)!==season||!Array.isArray(data.players))throw Error('The opportunity dataset is unavailable.');STRATEGY.usage.set(season,data);}catch(e){STRATEGY.usageErrors.set(season,e.message||'Unable to load opportunity data.');}finally{STRATEGY.usageBusy.delete(season);if(XL.open==='opportunity')renderOpportunity();renderStrategyHome();}
}
const usageIndexes=new WeakMap();
function usageFor(p,data){
 if(!p||!data)return null;
 let index=usageIndexes.get(data);
 if(!index){index={ids:new Map(),espn:new Map(),names:new Map()};for(const row of data.players){index.ids.set('usage:'+row.gsis_id,row);if(row.espn_id)index.espn.set(String(row.espn_id),row);const key=nameKey(row.name);index.names.set(key,index.names.has(key)?null:row);}usageIndexes.set(data,index);}
 return index.ids.get(String(p.id))||index.espn.get(String(p.espnId||''))||index.names.get(nameKey(p.name))||null;
}
function usageTotals(row,data){
 if(!row)return null;
 const selected=Object.entries(row.weeks).filter(([w])=>Number(w)<strategyWeek()&&(STRATEGY.period==='season'||Number(w)>Math.min(data.through_week,strategyWeek()-1)-3)),keys=['carries','targets','receptions','redzone_carries','redzone_targets','inside10_carries','inside10_targets','inside5_carries','inside5_targets'];
 if(!selected.length)return null;
 const totals=Object.fromEntries(keys.map(k=>[k,0])),team=Object.fromEntries(keys.map(k=>[k,0]));
 for(const [,r] of selected)for(const k of keys){totals[k]+=Number(r[k]||0);team[k]+=Number(r.team_totals?.[k]||0);}
 const ratio=(a,b)=>b>0?a/b*100:null;
 return {...totals,weeks:selected.length,opportunities:totals.carries+totals.targets,touches:totals.carries+totals.receptions,redzone:totals.redzone_carries+totals.redzone_targets,target_share:ratio(totals.targets,team.targets),rush_share:ratio(totals.carries,team.carries),opportunity_share:ratio(totals.carries+totals.targets,team.carries+team.targets),redzone_share:ratio(totals.redzone_carries+totals.redzone_targets,team.redzone_carries+team.redzone_targets),touch_share:ratio(totals.carries+totals.receptions,team.carries+team.receptions),reception_share:ratio(totals.receptions,team.receptions),inside10_share:ratio(totals.inside10_carries+totals.inside10_targets,team.inside10_carries+team.inside10_targets),inside5_share:ratio(totals.inside5_carries+totals.inside5_targets,team.inside5_carries+team.inside5_targets)};
}
function shareBar(label,value,color='blue'){return `<div class="strategy-share share-${color}"><div><span>${label}</span><b>${labPct(value)}</b></div><div class="strategy-share-track"><i style="width:${Math.max(0,Math.min(100,value||0))}%"></i></div></div>`;}
const SHARE_METRICS=[['Target share','target_share','blue'],['Carry share','rush_share','green'],['Opportunity share','opportunity_share','purple'],['Touch share','touch_share','orange'],['Reception share','reception_share','cyan'],['Red-zone share','redzone_share','red'],['Inside-10 share','inside10_share','pink'],['Inside-5 share','inside5_share','indigo']];
function shareBars(v){return SHARE_METRICS.map(([name,key,color])=>shareBar(name,v?.[key],color)).join('');}
function usageForecast(p,data){
 const row=usageFor(p,data),estimate=FantasyMath.touchdownEstimate(row,data,strategyWeek()),unavailable=/^(OUT|IR|INJURED_RESERVE|SUSPENDED)$/i.test(p?.status||'');
 const m=matchupContext(p||{}),noGame=m.data&&m.data.opponents&&!m.opp;
 const recent=Object.entries(row?.weeks||{}).filter(([w])=>Number(w)<strategyWeek()).sort((a,b)=>Number(a[0])-Number(b[0])).slice(-3).map(([,v])=>v),avg=keys=>recent.length?recent.reduce((s,r)=>s+keys.reduce((n,k)=>n+Number(r[k]||0),0),0)/recent.length:null;
 return {...estimate,recentTouches:avg(['carries','receptions']),recentRedzone:avg(['redzone_carries','redzone_targets']),chance:unavailable||noGame?null:estimate?.chance??null};
}
function usageStatCards(p,v,data){
 const f=usageForecast(p,data),values=FantasyMath.outlook(p,strategyWeek()).observations.map(r=>r.points),hit=values.length?values.filter(v=>v>=15).length/values.length*100:null;
 return `${strategyMetric('Touches',labFormat(v?.touches,0))}${strategyMetric('Opportunities',labFormat(v?.opportunities,0))}${strategyMetric('Red-zone chances',labFormat(v?.redzone,0))}${strategyMetric('Inside-5 carries',labFormat(v?.inside5_carries,0))}${strategyMetric('Est. TD chance · W'+strategyWeek(),labPct(f.chance),'','td-estimate')}${strategyMetric('Recent touches / wk',labFormat(f.recentTouches))}${strategyMetric('Recent RZ chances / wk',labFormat(f.recentRedzone))}${strategyMetric('15+ pts · prior hit rate',labPct(hit))}`;
}
function usageSnapshot(p,v){
 return `<section class="lab-panel usage-snapshot" id="usage-snapshot"><div class="strategy-section-title"><div><span class="strategy-section-label">PLAYER SNAPSHOT</span><h4>${esc(p.name)}</h4></div><span>${v?v.weeks+' recorded weeks':'No matched play-by-play record'}</span></div><div class="strategy-metrics usage-metrics">${usageStatCards(p,v,usageDataset())}</div><div class="strategy-share-grid">${shareBars(v)}</div></section>`;
}
function opportunityRows(data){
 const active=STRATEGY.leaders==='active'?new Set(tradeRoster(getTeam()).map(p=>usageFor(p,data)?.gsis_id).filter(Boolean)):null;
 return (data?.players||[]).filter(r=>(!active||active.has(r.gsis_id))&&(STRATEGY.position==='ALL'||r.position===STRATEGY.position)&&`${r.name} ${Object.values(r.weeks).at(-1)?.team||''}`.toLowerCase().includes(STRATEGY.search.toLowerCase())).map(r=>({r,v:usageTotals(r,data)})).filter(({v})=>v?.weeks).sort((a,b)=>(b.v[STRATEGY.sort]??-1)-(a.v[STRATEGY.sort]??-1)||a.r.name.localeCompare(b.r.name));
}
function opportunityTable(data){
 const rows=opportunityRows(data),selected=usageFor(strategyPlayer(),data)?.gsis_id;
 return `<div class="opportunity-results" id="opportunity-results"><p class="strategy-data-note">${rows.length} PLAYERS · click to select · double-click or Enter twice for Player Terminal</p>${expandTable(['PLAYER','POS / NFL','CAR','TGT','REC','TOUCHES','TEAM %','TGT %','RUSH %','RZ CAR / TGT','INSIDE 10','INSIDE 5'],rows.slice(0,300).map(({r,v})=>`<tr data-usage-player="${esc(r.gsis_id)}" tabindex="0" aria-selected="${selected===r.gsis_id}" class="usage-row ${selected===r.gsis_id?'selected':''}" aria-label="Select ${esc(r.name)}; double-click to open Player Terminal"><td><b>${esc(r.name)}</b></td><td>${esc(r.position||'—')} / ${esc(Object.values(r.weeks).at(-1)?.team||'—')}</td><td>${v.carries}</td><td>${v.targets}</td><td>${v.receptions}</td><td><b>${v.touches}</b></td><td>${labPct(v.opportunity_share)}</td><td>${labPct(v.target_share)}</td><td>${labPct(v.rush_share)}</td><td>${v.redzone_carries} / ${v.redzone_targets}</td><td>${v.inside10_carries} / ${v.inside10_targets}</td><td>${v.inside5_carries} / ${v.inside5_targets}</td></tr>`))}${!rows.length?'<p>No players match these filters.</p>':''}${rows.length>300?'<p>Showing the top 300. Narrow by position or name for more.</p>':''}</div>`;
}
function updateOpportunityResults(){
 const data=usageDataset(),results=el('opportunity-results');if(results)results.outerHTML=opportunityTable(data);
 const p=strategyPlayer(),host=el('usage-snapshot');if(host&&p)host.outerHTML=usageSnapshot(p,usageTotals(usageFor(p,data),data));
}
function renderOpportunity(){
 const data=usageDataset(),p=strategyPlayer(),row=usageFor(p,data),v=usageTotals(row,data),season=Number(model.season),rows=opportunityRows(data);
 const filters=`<label>PERIOD<select id="usage-period"><option value="season" ${STRATEGY.period==='season'?'selected':''}>Season</option><option value="recent" ${STRATEGY.period==='recent'?'selected':''}>Latest 3 weeks</option></select></label><label>POSITION<select id="usage-position">${['ALL','QB','RB','WR','TE'].map(pos=>`<option ${STRATEGY.position===pos?'selected':''}>${pos}</option>`).join('')}</select></label><label>FIND<input id="usage-search" type="search" placeholder="Name or NFL team" value="${esc(STRATEGY.search)}"></label><label>SORT<select id="usage-sort">${[['opportunities','Opportunities'],['redzone','Red-zone chances'],['target_share','Target share'],['rush_share','Rush share'],['touches','Touches']].map(([id,label])=>`<option value="${id}" ${STRATEGY.sort===id?'selected':''}>${label}</option>`).join('')}</select></label>${model.source!=='demo'?`<button id="strategy-refresh-usage" class="lab-action" ${STRATEGY.usageBusy.has(season)?'disabled':''}>Refresh</button>`:''}`;
 setExplorer(strategyHeading('OPPORTUNITY','Touches & Share','Recorded workload / Touches, scoring-area chances and a share of the offense.')+strategyPlayerPicker(p,filters)+
 `${!data?`<section class="strategy-empty"><h4>${STRATEGY.usageErrors.has(season)?'Waiting for the season dataset.':'Loading recorded NFL plays…'}</h4><p>${esc(STRATEGY.usageErrors.get(season)||'Team shares and red-zone counts will appear when published data is available.')}</p></section>`:''}`+
 (data&&p?usageSnapshot(p,v):'')+
 `${data?`<section class="lab-panel opportunity-leaders"><div class="strategy-section-title"><h4>OPPORTUNITY LEADERS</h4><label class="leader-filter">SHOW <select id="usage-leaders"><option value="active" ${STRATEGY.leaders==='active'?'selected':''}>Active franchise roster</option><option value="all" ${STRATEGY.leaders==='all'?'selected':''}>Every NFL player</option></select></label></div>${opportunityTable(data)}</section>`:''}`+
 `<details class="strategy-method"><summary>TD estimate, metric definitions & coverage ⓘ</summary><p>Estimated TD chance is the modeled chance of at least one rushing or receiving touchdown in Week ${strategyWeek()}, conditional on the recorded role continuing. Passing TDs are excluded. It uses prior TD frequency, four prior-equivalent weeks of position-cohort shrinkage, a recent-three-week opportunity adjustment capped at 0.5–1.5×, and a Poisson model (1 − exp(−rate)). Requires four recorded weeks and TD coverage. Not calibrated against future outcomes; no opponent or injury adjustment. Unavailable players or missing confirmed games have no estimate.</p><p>Recent averages cover up to three recorded weeks before this week. The 15+ point hit rate is an observed fraction, not this week’s probability. Eight bars show percentages of the corresponding team total, including receptions and inside-10/inside-5 carries plus targets.</p><p>${esc(data?.source||"Dataset unavailable")} · through Week ${data?.through_week||"—"}${data?.generated_at?" · published "+esc(new Date(data.generated_at).toLocaleDateString()):""}</p><p>Touches = carries + receptions. Opportunities = carries + targets. Red-zone chances start within 20 yards of the end zone. Inside-10 and inside-5 columns show carries / targets. Per-week averages use recorded player weeks, not team games.</p><p>Shares compare the player with all identified opportunities for their NFL offense during those same weeks. Red-zone share uses team red-zone carries + targets; team opportunity share uses all carries + targets. These are not snap shares. No-play penalties, kneels, spikes and two-point attempts are excluded. Zero is observed; a dash means unavailable.</p><p><a href="https://nflreadr.nflverse.com/articles/dictionary_pbp.html" target="_blank" rel="noopener noreferrer">NFLverse definitions ↗</a></p></details>`);
 renderStrategyHome();if(model.source!=='demo'&&!data)void loadUsage();
}
// Keep the table DOM in place on a single click, so the same row receives dblclick.
function selectUsagePlayer(id,open=false){
 const row=usageDataset()?.players.find(r=>r.gsis_id===id);if(!row)return;
 const p=usagePlayer(row);STRATEGY.player=String(p.id);XL.player=String(p.id);
 if(open){if(String(p.id).startsWith('usage:')&&!getPool().some(x=>String(x.id)===String(p.id)))XL.free.push(p);openExplorer('profile',p.id);return;}
 const host=el('usage-snapshot');if(host)host.outerHTML=usageSnapshot(p,usageTotals(row,usageDataset()));
 el('explore-content').querySelectorAll('[data-usage-player]').forEach(node=>{const selected=node.dataset.usagePlayer===id;node.classList.toggle('selected',selected);node.setAttribute('aria-selected',String(selected));});
 const select=el('strategy-player');if(select){if(!Array.from(select.options).some(o=>o.value===String(p.id)))select.add(new Option(p.name+' · selected from leaders',p.id));select.value=p.id;}
}
function shareHistoryChart(p,home=false){
 const row=usageFor(p,usageDataset()),rows=FantasyMath.weeklyShares(row,strategyWeek()),scale=Math.max(10,Math.ceil(Math.max(0,...rows.map(r=>r.share||0))/10)*10);
 return `<section class="share-history-panel ${home?'home-share-history':''}" data-open-share="${esc(p?.id||'')}" tabindex="0" role="link" aria-label="Open Touches and Share${p?' for '+esc(p.name):''}"><div class="window-topline"><b>SHARE % / WEEK</b><span class="share-scale">0–${scale}% · TEAM OPPORTUNITIES ↗</span></div>${rows.length?`<div class="share-history-chart ${rows.length>12?'dense-weeks':''}" style="--week-count:${rows.length}">${rows.map(r=>`<button type="button" class="share-week" data-share-week="${r.week}" data-share-player="${esc(p.id)}" aria-label="Week ${r.week}: ${labPct(r.share)} opportunity share. Open week scoring table" title="Week ${r.week} · ${labPct(r.share)} team opportunity share"><span class="share-week-value">${labFormat(r.share,0)}%</span><i style="height:${r.share>0?Math.max(2,Math.min(100,r.share/scale*100)):0}%"></i><span class="share-week-label">${r.week}</span></button>`).join('')}</div>`:'<p class="lab-note">Share history unavailable for this player.</p>'}${home?'':'<p class="lab-note">Week → scoring table · panel → Touches & Share</p>'}</section>`;
}
function renderPlayerShareCharts(){
 const p=getPool().find(p=>String(p.id)===String(currentPlayerId)),home=el('player-share-spark');if(home)home.innerHTML=shareHistoryChart(p,true);
 const expanded=el('player-share-history');if(expanded){const player=getPool().find(p=>String(p.id)===String(XL.player));expanded.innerHTML=shareHistoryChart(player);}
}
function openShareHistory(event){
 const week=event.target.closest('[data-share-week]'),panel=event.target.closest('[data-open-share]');if(!panel)return;
 event.stopPropagation();
 if(week){openPlayerPositionContributions(week.dataset.sharePlayer,Number(week.dataset.shareWeek));return;}
 if(panel.dataset.openShare)openExplorer('opportunity',panel.dataset.openShare);
}
// Capture before the homepage's expandable card and the terminal's panel routes.
document.addEventListener('click',event=>{if(event.target.closest('[data-open-share]'))openShareHistory(event);},true);
document.addEventListener('keydown',event=>{if(event.target.matches('[data-open-share]')&&['Enter',' '].includes(event.key)){event.preventDefault();openShareHistory(event);}},true);
function tradeRoster(team){return (team?.playerIds||[]).map(id=>model.players[id]).filter(Boolean);}
function tradeSide(team,side){const selected=STRATEGY.trade[side],players=tradeRoster(team);return `<section class="lab-panel trade-side"><div class="trade-side-heading"><span>${side==='give'?'YOU SEND':'YOU RECEIVE'}</span><strong>${esc(teamName(team))}</strong><small>${selected.length} selected</small></div><div class="trade-player-list">${players.length?players.map(p=>{const points=FantasyMath.value(p,strategyWeek(),STRATEGY.trade.mode),on=selected.includes(String(p.id));return `<label class="trade-player ${on?'selected':''}"><input type="checkbox" data-trade-side="${side}" value="${esc(p.id)}" ${on?'checked':''}><span class="trade-position">${esc(p.pos)}</span><span><b>${esc(p.name)}</b><small>${esc(p.nfl)} · ${esc(p.status||'Status unavailable')}</small></span><strong>${labFormat(points)}</strong></label>`}).join(''):'<p class="lab-note">This team has no loaded roster. Select another team or refresh your league.</p>'}</div></section>`;}
function tradeModel(){
 ensureTrade();const t=STRATEGY.trade,own=tradeRoster(getTeam()),their=tradeRoster(findTeam(t.partner));
 t.drops??={give:[],get:[]};for(const [side,roster] of [['give',own],['get',their]])t.drops[side]=t.drops[side].filter(id=>!t[side].includes(id)&&roster.some(p=>String(p.id)===id));
 return FantasyMath.tradeAnalysis(own,their,t.give,t.get,STRATEGY_FORMATS[t.format],strategyWeek(),t.mode,t.drops);
}
const tradeSigned=n=>n===null?'—':(n>0?'+':'')+labFormat(n);
function tradeLineupTable(title,before,after,roster){
 const names=new Map(roster.map(p=>[String(p.id),p.name]));
 if(!before||!after)return `<section class="lab-panel"><h4>${esc(title)}</h4><p class="lab-note">A full lineup cannot be scored in this format. A required position or player estimate is missing.</p></section>`;
 const slots=STRATEGY_FORMATS[STRATEGY.trade.format];
 return `<section class="lab-panel trade-lineup"><h4>${esc(title)} / STARTING LINEUP</h4>${expandTable(['SLOT','BEFORE','AFTER','Δ PTS'],slots.map((slot,index)=>{const a=before.players.find(p=>p.index===index),b=after.players.find(p=>p.index===index),changed=String(a.player)!==String(b.player);return `<tr class="${changed?'lineup-changed':''}"><th scope="row">${slot}</th><td>${esc(names.get(String(a.player))||a.player)}<small>${labFormat(a.points)}</small></td><td>${esc(names.get(String(b.player))||b.player)}<small>${labFormat(b.points)}</small></td><td class="${b.points>=a.points?'positive-text':'negative-text'}">${tradeSigned(b.points-a.points)}</td></tr>`}).concat([`<tr class="trade-lineup-total"><th>TOTAL</th><td>${labFormat(before.total)}</td><td>${labFormat(after.total)}</td><td>${tradeSigned(after.total-before.total)}</td></tr>`]))}</section>`;
}
function tradeDrops(team,side){
 const t=STRATEGY.trade,players=tradeRoster(team).filter(p=>!t[side].includes(String(p.id))),extra=(side==='give'?t.get.length-t.give.length:t.give.length-t.get.length),selected=t.drops[side];
 return `<details class="trade-drop-picker"><summary>${side==='give'?'Your':'Partner’s'} optional drops · ${selected.length} selected${extra>0?' · '+extra+' extra received':''}</summary><div>${players.map(p=>`<label><input type="checkbox" data-trade-drop="${side}" value="${esc(p.id)}" ${selected.includes(String(p.id))?'checked':''}>${esc(p.name)} <span>${esc(p.pos)} · ${labFormat(FantasyMath.value(p,strategyWeek(),t.mode))}</span></label>`).join('')}</div></details>`;
}
function tradePlayerEvidence(a){
 return expandTable(['SIDE / PLAYER','POS','VALUE / WK','PROJECTION','LAST 3 AVG','FLOOR','CEILING','STATUS'],[['SEND',a.give],['RECEIVE',a.get]].flatMap(([side,players])=>players.map(p=>{const o=currentProjection(p),recent=o.observations.slice(-3);return `<tr><td><small>${side}</small><b>${esc(p.name)}</b></td><td>${esc(p.pos)}</td><td><b>${labFormat(FantasyMath.value(p,strategyWeek(),STRATEGY.trade.mode))}</b></td><td>${o.source==='Provider projection'?labFormat(o.center):'—'}</td><td>${labFormat(recent.length?recent.reduce((s,r)=>s+r.points,0)/recent.length:null)}</td><td>${labFormat(o.floor)}</td><td>${labFormat(o.ceiling)}</td><td>${esc(p.status||'Not supplied')}</td></tr>`})));
}
function findTradeAlternatives(){
 const t=STRATEGY.trade,a=tradeModel();if(!a.ready)return;
 const side=a.delta>0?'give':'get',roster=tradeRoster(side==='give'?getTeam():findTeam(t.partner));
 const candidates=roster.filter(p=>!t[side].includes(String(p.id))&&!t.drops[side].includes(String(p.id))&&FantasyMath.value(p,strategyWeek(),t.mode)!==null).map(p=>({p,gap:Math.abs(Math.abs(a.delta)-FantasyMath.value(p,strategyWeek(),t.mode))})).sort((a,b)=>a.gap-b.gap);
 t.alternatives=candidates.map(({p})=>{const give=side==='give'?[...t.give,String(p.id)]:t.give,get=side==='get'?[...t.get,String(p.id)]:t.get,result=FantasyMath.tradeAnalysis(tradeRoster(getTeam()),tradeRoster(findTeam(t.partner)),give,get,STRATEGY_FORMATS[t.format],strategyWeek(),t.mode,t.drops);return {id:String(p.id),name:p.name,side,balance:result.balance,impact:result.impact,theirImpact:result.theirImpact,delta:result.delta};}).filter(r=>r.balance>a.balance).sort((a,b)=>Number(b.impact!==null&&b.theirImpact!==null)-Number(a.impact!==null&&a.theirImpact!==null)||b.balance-a.balance).slice(0,3);
 t.searched=true;renderTrade();
}
function renderTrade(){
 const t=STRATEGY.trade,mine=getTeam(),others=ensureTrade(),partner=findTeam(t.partner),own=tradeRoster(mine),their=tradeRoster(partner),a=tradeModel();
 const {ready,delta,impact,theirImpact,give,get}=a;
 const verdict=!give.length||!get.length?'Build both sides of the deal.':!ready?'Some selected players are missing scores.':impact!==null&&theirImpact!==null&&impact>0&&theirImpact>0?'Both starting lineups improve.':impact!==null&&impact>0?'Your starting lineup improves.':impact!==null&&impact<0?'Your starting lineup loses points.':a.balance>=95?'Close on modeled scoring.':delta>0?'More package scoring coming your way.':'More package scoring going the other way.';
 const alerts=[...give,...get].filter(p=>p.status&&!/^(ACTIVE|HEALTHY|A)$/i.test(p.status));
 setExplorer(strategyHeading('TRADE CALCULATOR','Trade Calculator','Package value, starting-lineup impact and counteroffer scenarios in your scoring system.')+
 `<div class="lab-controls trade-controls"><label>TRADE PARTNER<select id="trade-partner">${others.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===t.partner?'selected':''}>${esc(teamName(x))}</option>`).join('')}</select></label><label>VALUATION<select id="trade-mode">${[['balanced','60% center + 40% recent form'],['projection','Provider projection only'],['history','Prior scoring average'],['floor','Conservative · historical floor'],['ceiling','Upside · historical ceiling']].map(([id,label])=>`<option value="${id}" ${t.mode===id?'selected':''}>${label}</option>`).join('')}</select></label><label>STARTER FORMAT<select id="trade-format">${[['standard','1 QB · 2 RB · 2 WR · TE · FLEX · K · D/ST'],['threewr','3 WR + FLEX'],['superflex','2 WR + FLEX + SUPERFLEX']].map(([id,label])=>`<option value="${id}" ${t.format===id?'selected':''}>${label}</option>`).join('')}</select></label><button class="lab-action" id="trade-clear">Clear trade</button></div>`+
 `<div class="trade-verdict" aria-live="polite"><div class="trade-verdict-heading"><div><span class="strategy-section-label">YOUR PERSPECTIVE / WEEK ${strategyWeek()}</span><h4>${verdict}</h4></div><div class="trade-balance"><b>${ready?labFormat(a.balance,0)+'%':'—'}</b><span>PACKAGE BALANCE</span><meter min="0" max="100" value="${a.balance||0}" aria-label="Package scoring balance"></meter></div></div><div class="strategy-metrics four">${strategyMetric('Package difference',tradeSigned(delta))}${strategyMetric('Your lineup change',tradeSigned(impact))}${strategyMetric('Their lineup change',tradeSigned(theirImpact))}${strategyMetric('Your roster size',a.afterOwn.length+' / '+own.length)}</div><div class="trade-package-totals"><span>YOU SEND <b>${labFormat(give.length?a.sent.total:null)}</b></span><span>YOU RECEIVE <b>${labFormat(get.length?a.received.total:null)}</b></span><span>MODELED POINTS / WEEK</span></div></div>`+
 `<div class="lab-two">${tradeSide(mine,'give')}${tradeSide(partner,'get')}</div>`+
 `<div class="lab-two trade-drop-row">${tradeDrops(mine,'give')}${tradeDrops(partner,'get')}</div>`+
 `${alerts.length?`<p class="trade-alert">AVAILABILITY · ${alerts.map(p=>esc(p.name)+': '+esc(p.status)).join(' · ')}. Supplied values are retained; availability is not assumed.</p>`:''}`+
 `<div class="lab-two trade-lineup-grid">${tradeLineupTable('YOUR TEAM',a.before,a.after,[...own,...their])}${tradeLineupTable('TRADE PARTNER',a.theirBefore,a.theirAfter,[...own,...their])}</div>`+
 `<section class="lab-panel trade-counteroffers"><div class="strategy-section-title"><h4>COUNTEROFFER WORKBENCH</h4><button class="lab-action" id="trade-counteroffers" ${ready?'':'disabled'}>Compare balancing additions ↗</button></div><p class="lab-note">Compare one-player additions to the lower-valued package. Complete starting lineups are prioritized, then scoring balance. Review both teams and any required drops.</p><div class="trade-alternatives">${(t.alternatives||[]).map(r=>`<article><b>${r.side==='give'?'Send':'Receive'} + ${esc(r.name)}</b><div><span>Balance <strong>${labFormat(r.balance,0)}%</strong></span><span>You <strong>${tradeSigned(r.impact)}</strong></span><span>Partner <strong>${tradeSigned(r.theirImpact)}</strong></span></div><button class="lab-action" data-trade-alternative="${esc(r.id)}" data-side="${r.side}">Try this package</button></article>`).join('')}${t.searched&&!t.alternatives.length?'<p>No single-player addition improves the current package balance. Try exchanging a player or changing the partner.</p>':''}</div></section>`+
 `${give.length||get.length?`<details class="strategy-method trade-evidence"><summary>Selected player evidence / projections, form & range</summary>${tradePlayerEvidence(a)}</details>`:''}`+
 `<details class="strategy-method"><summary>Valuation, roster assumptions & coverage ⓘ</summary><p>Values are fantasy points per week in the loaded scoring system. Balanced mode uses 60% current provider projection (or prior mean) and 40% last-three recorded scoring average. History uses up to eight earlier weeks. Floor and ceiling use the Player Outlook scenarios, not calibrated probabilities. Missing estimates stay blank.</p><p>Package balance is 100 × (1 − absolute package difference / the larger absolute package value). Starting lineups are optimized exactly with each player assigned once, including FLEX and SUPERFLEX. The selected format is an explicit assumption; verify it against your league. Roster size shows after / before. Optional drops are included in lineup comparisons, but no automatic roster limit is assumed.</p><p>This is a weekly scoring and lineup simulator. It has no dynasty, draft-pick, keeper, contract, rest-of-season, schedule or market-consensus feed. Counteroffers compare modeled scores, not the chance another manager accepts. No trade is submitted and no roster is changed.</p></details>`);
 renderStrategyHome();
}
function ensureTrade(){
 const t=STRATEGY.trade,others=model.teams.filter(x=>String(x.id)!==String(getTeam()?.id));
 if(!others.some(x=>String(x.id)===String(t.partner)))t.partner=String(others[0]?.id||'');
 t.give=t.give.filter(id=>tradeRoster(getTeam()).some(p=>String(p.id)===id));t.get=t.get.filter(id=>tradeRoster(findTeam(t.partner)).some(p=>String(p.id)===id));
 return others;
}
function homeTradeSide(team,side){
 const selected=STRATEGY.trade[side],roster=tradeRoster(team);
 return `<div class="home-trade-side"><label>${side==='give'?'YOU SEND':'YOU RECEIVE'}<select data-home-trade-add="${side}" aria-label="Add player to ${side==='give'?'send':'receive'}"><option value="">+ Add a player…</option>${roster.filter(p=>!selected.includes(String(p.id))).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.pos)} · ${labFormat(FantasyMath.value(p,strategyWeek(),STRATEGY.trade.mode))}</option>`).join('')}</select></label><div class="home-trade-picks">${selected.map(id=>{const p=roster.find(p=>String(p.id)===id);return p?`<button data-home-trade-remove="${side}" data-id="${esc(id)}" aria-label="Remove ${esc(p.name)} from ${side==='give'?'send':'receive'}">${esc(p.name)} <b>×</b></button>`:''}).join('')||'<span>No players selected</span>'}</div></div>`;
}
function homePlayer(){const pool=strategyPlayerPool(STRATEGY.homeScope);return pool.find(p=>String(p.id)===String(STRATEGY.homePlayer||currentPlayerId))||pool[0];}
function renderStrategyHome(){
 const host=el('outlook-preview');if(!host)return;strategyContext();
 if(STRATEGY.lastCurrent!==currentPlayerId){STRATEGY.lastCurrent=currentPlayerId;STRATEGY.homePlayer=null;}
 const pool=strategyPlayerPool(STRATEGY.homeScope),p=homePlayer();
 for(const id of ['home-outlook-player','home-share-player']){const select=el(id);select.innerHTML=pool.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(p?.id)?'selected':''}>${esc(x.name)} · ${esc(x.pos)}</option>`).join('')||'<option value="">No roster loaded</option>';select.disabled=!p;}
 for(const id of ['home-outlook-scope','home-share-scope']){const select=el(id);if(select)select.innerHTML=scopeOptions(STRATEGY.homeScope);}
 const o=p?currentProjection(p):{floor:null,center:null,ceiling:null,sample:0},key=`${model.season}:${strategyWeek()}`,data=usageDataset(),v=usageTotals(usageFor(p,data),data);
 const metric=(label,value,cls='')=>`<div class="${cls}"><span>${label}</span><b>${value}</b></div>`;
 host.innerHTML=`<div class="window-topline"><span>WEEK ${strategyWeek()} / FANTASY PTS</span><span>${esc(model.scoring)}</span></div>${rangeMetrics(o,true)}${rangeBar(o)}${p?matchupAI(p,true):''}<p class="tiny-caption">${model.source==='demo'?'EXHIBITION VALUES · ':''}${o.sample} prior weeks · scenario estimates${p&&/^(OUT|IR|INJURED_RESERVE|SUSPENDED)$/i.test(p.status||'')?' · PLAYER UNAVAILABLE':''}</p><span class="strategy-home-action">OPEN PLAYER OUTLOOK ▣</span>`;
 el('share-preview').innerHTML=`<div class="window-topline"><span>${STRATEGY.period==='recent'?'LATEST 3 NFL WEEKS':'SEASON OPPORTUNITY'}</span><span>WEEK ${strategyWeek()}</span></div><div class="strategy-metrics home-usage-metrics">${p?usageStatCards(p,v,data):''}</div><div class="strategy-home-share-grid">${shareBars(v)}</div>${model.source==='demo'?'<p class="tiny-caption">SYNTHETIC EXHIBITION DATA</p>':''}<span class="strategy-home-action">OPEN WORKLOAD, TD METHOD & LEADERS ▣</span>`;
 renderPlayerShareCharts();
 const others=ensureTrade(),t=STRATEGY.trade,own=tradeRoster(getTeam()),partner=findTeam(t.partner),their=tradeRoster(partner),give=own.filter(x=>t.give.includes(String(x.id))),get=their.filter(x=>t.get.includes(String(x.id))),g=give.length?FantasyMath.packageValue(give,strategyWeek(),t.mode).total:null,r=get.length?FantasyMath.packageValue(get,strategyWeek(),t.mode).total:null;
 el('trade-preview').innerHTML=`<div class="home-trade-controls"><label>PARTNER<select id="home-trade-partner">${others.map(team=>`<option value="${esc(team.id)}" ${String(team.id)===t.partner?'selected':''}>${esc(teamName(team))}</option>`).join('')}</select></label><label>VALUE<select id="home-trade-mode">${[['balanced','Balanced'],['projection','Projection'],['history','History'],['floor','Floor'],['ceiling','Ceiling']].map(([id,label])=>`<option value="${id}" ${t.mode===id?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="strategy-home-metrics" aria-live="polite">${metric('YOU SEND',labFormat(g))}${metric('YOU RECEIVE',labFormat(r))}${metric('DIFFERENCE',g!==null&&r!==null?(r-g>0?'+':'')+labFormat(r-g):'—','estimate-center')}</div><div class="home-trade-builder">${homeTradeSide(getTeam(),'give')}${homeTradeSide(partner,'get')}</div><div class="home-trade-footer"><span>MODELED PTS / WEEK</span><button class="lab-action" id="home-trade-clear">Clear</button></div><p class="tiny-caption">Add players to both packages. Expand for starting-lineup impact.${model.source==='demo'?' EXHIBITION DATA.':''}</p><span class="strategy-home-action">OPEN FULL TRADE SIMULATOR ▣</span>`;
 if(model.source!=='demo'){if(!STRATEGY.usage.has(Number(model.season))&&!STRATEGY.usageErrors.has(Number(model.season)))void loadUsage();if(!STRATEGY.defense.has(key))void loadStrategyDefense();}
}
function updateTradeControl(target){
 const id=target.id?.replace(/^home-/,''),mapping={'trade-partner':'partner','trade-mode':'mode','trade-format':'format'},t=STRATEGY.trade;
 if(mapping[id]){t[mapping[id]]=target.value;if(id==='trade-partner'){t.get=[];t.drops={give:[],get:[]};}}
 else if(target.dataset.tradeDrop){const side=target.dataset.tradeDrop;t.drops[side]=target.checked?[...new Set([...t.drops[side],target.value])]:t.drops[side].filter(id=>id!==target.value);}
 else if(target.dataset.tradeSide){const side=target.dataset.tradeSide;t[side]=target.checked?[...new Set([...t[side],target.value])]:t[side].filter(id=>id!==target.value);}
 else if(target.dataset.homeTradeAdd){if(target.value)t[target.dataset.homeTradeAdd]=[...new Set([...t[target.dataset.homeTradeAdd],target.value])];}
 else return false;
 t.alternatives=[];t.searched=false;if(XL.open==='trade'){renderTrade();if(target.dataset.tradeDrop){const input=el('explore-content').querySelector?.(`input[data-trade-drop="${target.dataset.tradeDrop}"][value="${CSS.escape(target.value)}"]`);const details=input?.closest('details');if(details)details.open=true;}}else renderStrategyHome();return true;
}
document.addEventListener('click',event=>{
 if(event.target.closest('.range-help,a'))return;
 const route=event.target.closest('[data-strategy-open]');if(route){STRATEGY.player=route.dataset.strategyPlayer||null;openExplorer(route.dataset.strategyOpen,STRATEGY.player);return;}
 const profile=event.target.closest('[data-strategy-profile]');if(profile){const p=strategyPlayer();if(p&&String(p.id).startsWith('usage:')&&!getPool().some(x=>String(x.id)===String(p.id)))XL.free.push(p);openExplorer('profile',profile.dataset.strategyProfile);return;}
 const player=event.target.closest('[data-usage-player]');if(player){selectUsagePlayer(player.dataset.usagePlayer);return;}
 const ai=event.target.closest('[data-matchup-ai]');if(ai){void generateMatchupAI(strategyPlayer());return;}
 if(event.target.id==='trade-counteroffers'){findTradeAlternatives();return;}
 const alternative=event.target.closest('[data-trade-alternative]');if(alternative){STRATEGY.trade[alternative.dataset.side].push(alternative.dataset.tradeAlternative);STRATEGY.trade.alternatives=[];STRATEGY.trade.searched=false;renderTrade();return;}
 const remove=event.target.closest('[data-home-trade-remove]');if(remove){const side=remove.dataset.homeTradeRemove;STRATEGY.trade[side]=STRATEGY.trade[side].filter(id=>id!==remove.dataset.id);renderStrategyHome();return;}
 if(event.target.id==='strategy-refresh-defense')void loadStrategyDefense(true);
 if(event.target.id==='strategy-refresh-usage')void loadUsage(true);
 if(['trade-clear','home-trade-clear'].includes(event.target.id)){STRATEGY.trade.give=[];STRATEGY.trade.get=[];STRATEGY.trade.drops={give:[],get:[]};STRATEGY.trade.alternatives=[];STRATEGY.trade.searched=false;if(XL.open==='trade')renderTrade();else renderStrategyHome();}
});
document.addEventListener('dblclick',event=>{const row=event.target.closest('[data-usage-player]');if(row)selectUsagePlayer(row.dataset.usagePlayer,true);});
document.addEventListener('keydown',event=>{
 const row=event.target.closest('[data-usage-player]');if(row&&['Enter',' '].includes(event.key)){event.preventDefault();selectUsagePlayer(row.dataset.usagePlayer,event.key==='Enter'&&row.getAttribute('aria-selected')==='true');}
 const file=event.target.closest('.scouting-file');if(file&&event.target===file&&['Enter',' '].includes(event.key)){event.preventDefault();STRATEGY.player=file.dataset.strategyPlayer;openExplorer('outlook',STRATEGY.player);}
});
document.addEventListener('change',event=>{
 const t=event.target;if(updateTradeControl(t)){const focus=t.id?el(t.id):t.dataset.homeTradeAdd?el('trade-preview').querySelector(`[data-home-trade-add="${t.dataset.homeTradeAdd}"]`):el('explore-content').querySelector?.(`input[${t.dataset.tradeDrop?'data-trade-drop':'data-trade-side'}="${t.dataset.tradeDrop||t.dataset.tradeSide}"][value="${CSS.escape(t.value)}"]`);focus?.focus?.({preventScroll:true});return;}
 if(t.id==='strategy-player'){STRATEGY.player=t.value;XL.player=t.value;renderStrategy(XL.open);}
 if(t.id==='strategy-scope'){STRATEGY.scope=t.value;STRATEGY.player=strategyPlayerPool(t.value)[0]?.id||null;XL.player=STRATEGY.player;renderStrategy(XL.open);}
 const usage={'usage-period':'period','usage-position':'position','usage-sort':'sort','usage-leaders':'leaders'};if(usage[t.id]){STRATEGY[usage[t.id]]=t.value;updateOpportunityResults();if(t.id==='usage-period')renderStrategyHome();}
 if(['home-outlook-scope','home-share-scope'].includes(t.id)){STRATEGY.homeScope=t.value;STRATEGY.homePlayer=null;renderStrategyHome();}
 if(['home-outlook-player','home-share-player'].includes(t.id)){STRATEGY.homePlayer=t.value;if(tradeRoster(getTeam()).some(p=>String(p.id)===t.value)){currentPlayerId=t.value;drawRoster(getTeam());drawProfile(getTeam());}else renderStrategyHome();}
 if(t.id&&el(t.id))el(t.id).focus?.({preventScroll:true});
});
el('explore-content').addEventListener('input',event=>{if(event.target.id==='usage-search'){const text=event.target.value,pos=event.target.selectionStart;STRATEGY.search=text;deferRender('usage',()=>{if(XL.open!=='opportunity')return;updateOpportunityResults();const input=el('usage-search');input?.focus({preventScroll:true});input?.setSelectionRange(pos,pos);});}});
for(const id of ['home-go-to','explore-jump'])for(const [value,label] of [['outlook','PLAYER OUTLOOK'],['opportunity','TOUCHES & SHARE'],['trade','TRADE CALCULATOR']])el(id)?.add(new Option(label,value));
renderStrategyHome();
