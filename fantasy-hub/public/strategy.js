/* Strategy workspaces: observed opportunity, transparent estimates, roster analysis. */
'use strict';
const STRATEGY={identity:'',player:null,scope:'all',homeScope:'active',homePlayer:null,lastCurrent:null,leaders:'active',period:'season',position:'ALL',search:'',sort:'opportunities',usage:new Map(),usageBusy:new Set(),usageErrors:new Map(),defense:new Map(),defenseBusy:new Set(),ai:new Map(),aiBusy:new Set(),aiErrors:new Map(),trade:{team:null,partner:null,give:[],get:[],mode:'projection',format:'standard',drops:{give:[],get:[]},alternatives:[]}};
const strategyWeek=()=>Math.max(1,Math.min(18,Number(currentWeek||model.currentWeek||model.liveWeek||1)));
function usagePlayer(r){const data=usageDataset();return getPool().find(p=>usageFor(p,data)===r)||{id:'usage:'+r.gsis_id,name:r.name,pos:r.position,nfl:Object.values(r.weeks).at(-1)?.team,scores:{},status:'Availability not supplied'};}
function strategyPlayerPool(scope='all'){
 const pool=scope==='all'?getPool():tradeRoster(scope==='active'?getTeam():findTeam(scope));
 return [...pool].sort((a,b)=>a.name.localeCompare(b.name));
}
function scopeOptions(selected){return [['all','Every player'],['active','Active franchise'],...model.teams.map(t=>[String(t.id),teamName(t)])].map(([id,label])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('');}
function strategyContext(){
 const key=`${model.source}|${model.season}|${model.leagueId||model.league}|${getTeam()?.id}`;
 if(STRATEGY.identity!==key){STRATEGY.identity=key;STRATEGY.player=null;STRATEGY.homePlayer=null;STRATEGY.scope='all';STRATEGY.homeScope='active';STRATEGY.trade.give=[];STRATEGY.trade.get=[];STRATEGY.trade.team=null;STRATEGY.trade.partner=null;STRATEGY.trade.drops={give:[],get:[]};STRATEGY.trade.alternatives=[];STRATEGY.trade.searched=false;STRATEGY.trade.search={};}
}
function strategyPlayer(){
 const id=STRATEGY.player||XL.player||currentPlayerId;
 const p=getPool().find(p=>String(p.id)===String(id));if(p)return p;
 if(String(id).startsWith('usage:')){const row=usageDataset()?.players.find(p=>'usage:'+p.gsis_id===id);if(row)return usagePlayer(row);}
 return rowsFor(getTeam())[0]||getPool()[0];
}
function strategyHeading(kicker,title,copy){return `<header class="strategy-heading">${heading(title,copy||STRATEGY_PURPOSE[kicker]||'')}<span class="strategy-source">${model.source==='demo'?'SYNTHETIC EXHIBITION DATA':esc(model.season)+' SEASON'}<br>WEEK ${strategyWeek()}</span></header>`;}
function strategyPlayerPicker(p,extra=''){
 const pool=strategyPlayerPool(STRATEGY.scope);
 return `<div class="lab-controls strategy-ribbon"><label>Franchise<select id="strategy-scope">${scopeOptions(STRATEGY.scope)}</select></label><label class="ribbon-player">Player<select id="strategy-player">${p&&!pool.some(x=>String(x.id)===String(p.id))?`<option value="${esc(p.id)}">${esc(p.name)} · selected outside filter</option>`:''}${pool.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(p?.id)?'selected':''}>${esc(x.name)} · ${esc(x.pos)} · ${esc(x.nfl)}</option>`).join('')}</select></label>${extra}${!extra&&p?`<span class="strategy-picker-note">${esc(p.status||'Status unavailable')} · ${esc(model.scoring)}</span>`:''}</div>`;
}
const STRATEGY_PURPOSE={'PLAYER OUTLOOK':'What this player is likely to score this week, the evidence behind it, and the opponent ahead.',OPPORTUNITY:'How much of the ball each player gets — the volume that drives fantasy points.',TRADE:'Test a trade: see how each team’s best starting lineup changes, and find deals that help both sides.'};
function strategyMetric(label,value,detail='',accent=''){return `<div class="strategy-metric ${accent}"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(detail)}</small></div>`;}
function renderStrategy(type){strategyContext();if(XL.player&&['outlook','opportunity'].includes(type)&&!STRATEGY.player)STRATEGY.player=XL.player;if(type==='outlook')renderDefensiveOutlook();else if(type==='opportunity')renderOpportunity();else renderTrade();}
function currentProjection(p){const week=strategyWeek(),providerWeek=Number(model.currentWeek||model.liveWeek||model.weeks?.at(-1));return FantasyMath.outlook(p,week,{historical:week!==providerWeek});}
const RANGE_HELP={floor:'The lower scenario shifts the historical 20th percentile around the current center, using up to eight earlier scoring weeks. At least four observations are required. It is not a minimum: a player can score below this number.',center:'Uses the provider’s projection for this week. If none was supplied, the center is the mean of up to eight earlier recorded weeks, labeled Historical mean. This is an estimate, not a guaranteed score.',ceiling:'The upper scenario shifts the historical 80th percentile around the current center, using up to eight earlier scoring weeks. At least four observations are required. It is not a maximum or a calibrated confidence bound.'};
function rangeBar(o){
 if(o.floor===null||o.ceiling===null)return '<div class="range-unavailable">Range requires four prior scoring weeks.</div>';
 const span=Math.max(o.ceiling-o.floor,1),lo=o.floor-span*.15,hi=o.ceiling+span*.15,pos=v=>(v-lo)/(hi-lo)*100;
 return `<div class="range-track" role="img" aria-label="Estimated floor ${labFormat(o.floor)}, center ${labFormat(o.center)}, estimated ceiling ${labFormat(o.ceiling)} fantasy points"><i class="range-floor" style="left:${pos(o.floor)}%"></i><i class="range-center" style="left:${pos(o.center)}%"></i><i class="range-ceiling" style="left:${pos(o.ceiling)}%"></i></div><div class="range-labels"><span>FLOOR ${labFormat(o.floor)}</span><span>CENTER ${labFormat(o.center)}</span><span>CEILING ${labFormat(o.ceiling)}</span></div>`;
}
function rangeMetrics(o,compact=false){return `<div class="strategy-metrics three ${compact?'compact-range':''}">${[['floor','Estimated floor',o.floor],['center',o.source==='Provider projection'?'Provider prediction':'Historical mean',o.center],['ceiling','Estimated ceiling',o.ceiling]].map(([key,label,value])=>statHelpTile(label,labFormat(value),RANGE_HELP[key],`strategy-metric range-help range-${key}`)).join('')}</div>`;}
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
function lineupContext(p){
 const o=currentProjection(p),provider=o.source==='Provider projection',week=strategyWeek(),pos=p.pos;
 const value=player=>provider?(Number.isFinite(player.projections?.[week])?player.projections[week]:week===Number(model.currentWeek||model.liveWeek)?number(player.espnProj):null):FantasyMath.outlook({...player,projections:{},espnProj:null},week).mean;
 const score=value(p),peers=getPool().filter(x=>x.pos===pos).map(value).filter(Number.isFinite);
 return {leagueSize:model.teams.length,scoring:model.scoring,rank:score===null?null:1+peers.filter(v=>v>score).length,peers:peers.length,basis:provider?'provider projections':'prior scoring averages'};
}
function lineupRead(p){
 const c=lineupContext(p),o=currentProjection(p),data=usageDataset(),f=usageForecast(p,data),row=usageFor(p,data),prior=Object.entries(row?.weeks||{}).filter(([w])=>Number(w)<strategyWeek()).map(([,r])=>r);
 const unavailable=FantasyMath.unavailability(p.status)!==null;
 let label='Role uncertain';
 if(unavailable)label='Bench · unavailable';
 else if(c.rank&&c.peers>=c.leagueSize){const band=Math.ceil(c.rank/c.leagueSize);label=['RB','WR'].includes(p.pos)?band<3?p.pos+band+'-range':band===3?'Flex-range':'Depth / emergency flex':band===1?p.pos+'1-range':band===2?'Streaming option':'Bench depth';}
 let summary=unavailable?'Keep this player out of the starting plan while that availability status holds.':c.rank&&c.peers>=c.leagueSize?`${label} in the loaded player pool, based on ${c.basis}.`:'The loaded comparison pool is too small to assign a dependable lineup tier.';
 if(!unavailable&&prior.length){const avg=prior.reduce((n,r)=>n+Number(r.carries||0)+Number(r.receptions||0),0)/prior.length,trend=avg>0&&f.recentTouches!==null?f.recentTouches/avg:1;
 summary+=trend>1.15?' The recent workload is growing, supporting a stronger volume floor if that role holds.':trend<.85?' Recent touches are declining; favor a steadier alternative unless you need upside.':' Recent usage is stable, so the case rests on sustaining the role rather than a sudden workload jump.';
 if(f.recentRedzone<1)summary+=' Limited red-zone involvement makes a touchdown-led ceiling harder to rely on.';
 }else if(!unavailable&&o.sample>=4){summary+=o.floor<o.center*.65?' The scoring downside is wide; lean toward steadier options when protecting a lead.':' The recorded scoring range supports a steadier role, but does not establish future touches.';}
 return {label,summary,context:c};
}
function aiKey(p){return `${model.source}:${model.leagueId||model.league}:${model.season}:${strategyWeek()}:${p.id}:${p.status}:${JSON.stringify(p.scores)}:${currentProjection(p).center}:${JSON.stringify(lineupContext(p))}:v5`;}
function matchupAI(p,compact=false){
 const key=aiKey(p),result=STRATEGY.ai.get(key),busy=STRATEGY.aiBusy.has(key),error=STRATEGY.aiErrors.get(key),read=lineupRead(p);
 if(result){const paragraphs=result.outlook.split(/\n\s*\n/).filter(Boolean);return `<div class="matchup-ai ${compact?'compact':''}"><span class="strategy-section-label">AI OVERVIEW${compact?'':' · '+esc(result.provider)}</span>${(compact?paragraphs.slice(0,1):paragraphs).map(t=>`<p>${esc(t)}</p>`).join('')}</div>`;}
 return `<div class="matchup-ai ${compact?'compact':''}"><span class="strategy-section-label">${model.source==='demo'?'EXHIBITION OUTLOOK':'LINEUP OUTLOOK'}</span><p>${esc(read.summary)}</p>${model.source==='demo'?'':`<button class="lab-action" data-matchup-ai="${esc(p.id)}" ${busy?'disabled':''}>${busy?'Analyzing matchup…':'Generate AI overview ↗'}</button>${error?`<span class="ai-generation-note" role="status">${esc(error)}</span>`:''}`}</div>`;
}
function findOpponentDefense(nfl){return getPool().find(p=>['DEF','D/ST'].includes(p.pos)&&normalizeNFLAbbr(p.nfl)===normalizeNFLAbbr(nfl));}
async function openOpponentArchive(nfl,trigger){
 let defense=findOpponentDefense(nfl);const selected=strategyPlayer()?.id;
 if(!defense&&model.source==='espn'){
  trigger?.setAttribute('aria-busy','true');
  try{const response=await fetch('/api/espn/free-agents?position=DEF&limit=100&offset=0',{credentials:'same-origin'});const data=await response.json();if(!response.ok)throw Error(data.error||'Defense data unavailable');
   for(const entry of data.players||[]){const p=makeFreePlayer(entry);if(p&&['DEF','D/ST'].includes(p.pos)&&!getPool().some(x=>String(x.id)===String(p.id)))XL.free.push(p);}defense=findOpponentDefense(nfl);
  }catch{/* The report remains usable if the connected provider cannot supply this defense. */}
  finally{trigger?.removeAttribute('aria-busy');}
 }
 if(XL.open!=='outlook'||String(strategyPlayer()?.id)!==String(selected))return;
 if(defense){openExplorer('player-analytics',defense.id);return;}
 if(trigger&&!trigger.querySelector('[data-opponent-status]')){const note=document.createElement('p');note.className='lab-note';note.dataset.opponentStatus='';note.setAttribute('role','status');note.textContent=nfl+' defense statistics are unavailable in the connected dataset.';trigger.append(note);}
}
function priorScoring(p,compact=false){
 const rows=FantasyMath.scoringHistory(p,strategyWeek());
 return `<section class="lab-panel prior-scoring report-link" data-report-open="player-analytics" data-report-player="${esc(p.id)}" role="link" tabindex="0" aria-label="Open ${esc(p.name)} Statistical Archive"><h4>Earlier weeks: range vs result</h4>${rows.length?expandTable(['Week','Floor¹','Projection','Ceiling¹','Actual','Vs projection'],rows.map(r=>`<tr><td>W${r.week}</td><td>${labFormat(r.floor)}</td><td>${labFormat(r.projection)}</td><td>${labFormat(r.ceiling)}</td><td><b>${labFormat(r.actual)}</b></td><td class="${r.projection===null?'':r.actual>=r.projection?'positive-text':'negative-text'}">${r.projection===null?'—':labFormat(r.actual-r.projection)}</td></tr>`)):'<p class="lab-note">No prior scores supplied.</p>'}<p class="lab-note">¹ Reconstructed from earlier weeks only, not archived forecasts. Missing provider projections stay blank; ranges use the prior mean when absent. Four earlier scores required.</p></section>`;
}
function scoutingFile(p){
 const o=currentProjection(p),m=matchupContext(p);
 return `<section class="lab-panel scouting-file" data-strategy-open="outlook" data-strategy-player="${esc(p.id)}" tabindex="0" role="link" aria-label="Open Player Outlook for ${esc(p.name)}"><h4>SCOUTING FILE <span>PLAYER OUTLOOK ↗</span></h4><dl class="scouting-facts">${[['Availability',p.status||'Not supplied'],['Position / NFL',`${p.pos} / ${p.nfl}`],['Rostered',labPct(p.owned)],['Started',labPct(p.started)],['Scoring source',sourceName()],['Current projection',o.source==='Provider projection'?labFormat(o.center):'Not supplied']].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><div class="scouting-outlook"><div class="window-topline"><b>WEEK ${strategyWeek()} / SCORING SCENARIOS</b><span>${m.opp?'VS '+esc(m.opp):'OPPONENT UNCONFIRMED'}</span></div>${rangeMetrics(o,true)}${rangeBar(o)}<p class="lab-note">${esc(m.opp?`${m.opp} ${m.isDefense?'offense':'defense'} · ${labFormat(m.unit?.yardsPerPlay)} yards/play · ${labPct(m.unit?.sackRate)} sack rate.`:model.source==='demo'?'Exhibition values · connect a league for NFL matchup analysis.':'Opponent data pending.')} Open Player Outlook for the full matchup analysis.</p></div></section>`;
}
function renderDefensiveOutlook(){
 const p=strategyPlayer();if(!p){setExplorer(strategyHeading('PLAYER OUTLOOK','Select a league first','Load player data to see projections and opponent context.'));return;}
 const o=currentProjection(p),key=`${model.season}:${strategyWeek()}`,m=matchupContext(p);
 setExplorer(strategyHeading('PLAYER OUTLOOK',p.name+' · outlook','')+strategyPlayerPicker(p)+
 `<div class="strategy-outlook-grid"><section class="strategy-range report-link" data-report-open="profile" data-report-player="${esc(p.id)}" role="link" tabindex="0" aria-label="Open ${esc(p.name)} Player Terminal"><h4>Week ${strategyWeek()} scoring range <span>${esc(model.scoring)} · select a figure for its meaning</span></h4>${rangeMetrics(o)}<div class="range-evidence">${strategyMetric('Prior scoring average',labFormat(o.mean))}${strategyMetric('Last 3 average',labFormat(o.observations.length?o.observations.slice(-3).reduce((s,r)=>s+r.points,0)/Math.min(3,o.observations.length):null))}${strategyMetric('Prior weeks',String(o.sample))}</div>${rangeBar(o)}<p>Based on ${o.sample} earlier scoring weeks.${FantasyMath.unavailability(p.status)?' <b>Player marked unavailable</b> — estimates do not override injury status.':''}</p></section>${priorScoring(p)}</div>`+
 `<section class="lab-panel strategy-opponent ${m.opp?'report-link':''}" ${m.opp?`data-opponent-archive="${esc(m.opp)}" role="link" tabindex="0" aria-label="Open ${esc(m.opp)} Defense Statistical Archive"`:""}><div class="strategy-section-title"><h4>${m.isDefense?'OPPOSING OFFENSE':'DEFENSIVE OUTLOOK'} / ${m.opp?'VS '+esc(m.opp):'OPPONENT UNCONFIRMED'}</h4>${model.source!=='demo'?`<button class="lab-action" id="strategy-refresh-defense">${STRATEGY.defenseBusy.has(key)?'Loading…':'Refresh opponent'}</button>`:''}</div><div class="opponent-report-grid">${opponentMetrics(p)}${matchupAI(p)}</div>${strategyDisclosure('outlook:method','Sources and how to read the opponent table',`<p>${m.rating?m.rating.games+' completed games. ':''}NFL scoring from ESPN; efficiency from NFLverse plays before Week ${strategyWeek()}${m.unit?' ('+m.unit.games+' games)':''}.</p><p><b>EPA</b> (expected points added), success rate and explosive-play rate: lower is better for a defense. Team points allowed includes all scoring and is not fantasy points allowed to this position. The scoring range is not adjusted for the opponent.</p>`)}</section>`);
 if(model.source!=='demo'&&!STRATEGY.defense.has(key))void loadStrategyDefense();
}
async function loadStrategyDefense(force=false){
 const key=`${model.season}:${strategyWeek()}`;if(STRATEGY.defenseBusy.has(key)||(!force&&STRATEGY.defense.has(key)))return;
 STRATEGY.defenseBusy.add(key);
 try{const r=await fetch(`/api/nfl/matchup-strength?season=${model.season}&week=${strategyWeek()}`);if(!r.ok)throw Error();STRATEGY.defense.set(key,await r.json());}catch{STRATEGY.defense.set(key,null);}finally{STRATEGY.defenseBusy.delete(key);if(XL.open==='outlook')renderDefensiveOutlook();renderStrategyHome();if(XL.open==='profile'){const p=getPool().find(p=>String(p.id)===String(XL.player)),host=el('explore-content').querySelector?.('.scouting-file');if(p&&host)host.outerHTML=scoutingFile(p);}}
}
async function generateMatchupAI(p){
 if(!p||model.source==='demo')return;
 const key=aiKey(p);if(STRATEGY.aiBusy.has(key))return;STRATEGY.aiBusy.add(key);STRATEGY.aiErrors.delete(key);if(XL.open==='outlook')renderDefensiveOutlook();renderStrategyHome();
 const o=currentProjection(p),scores=o.observations,values=scores.map(r=>r.points),recent=values.slice(-3);
 try{const response=await fetch('/api/ai/outlook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report:'matchup',lineupContext:lineupContext(p),player:{id:p.id,name:p.name,pos:p.pos,nfl:normalizeNFLAbbr(p.nfl),status:p.status,season:Number(model.season),week:strategyWeek(),projection:o.source==='Provider projection'?o.center:null,floor:o.floor,ceiling:o.ceiling,average:o.mean,games:o.sample,recent:recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:null,last:values.at(-1),best:values.length?Math.max(...values):null,low:values.length?Math.min(...values):null,recentWeeks:scores.slice(-5)}})});const data=await response.json();if(!response.ok)throw Error(data.error||'Matchup analysis unavailable.');STRATEGY.ai.set(key,data);}catch(e){STRATEGY.aiErrors.set(key,e.message||'Unable to generate the overview. Retry shortly.');}finally{STRATEGY.aiBusy.delete(key);if(XL.open==='outlook'&&String(strategyPlayer()?.id)===String(p.id))renderDefensiveOutlook();renderStrategyHome();}
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
 const selected=Object.entries(row.weeks).filter(([w])=>Number(w)>0&&Number(w)<strategyWeek()&&(STRATEGY.period.startsWith('week:')?Number(w)===Number(STRATEGY.period.slice(5)):STRATEGY.period==='season'||Number(w)>Math.min(data.through_week,strategyWeek()-1)-3)),keys=['carries','targets','receptions','redzone_carries','redzone_targets','inside10_carries','inside10_targets','inside5_carries','inside5_targets'];
 if(!selected.length)return null;
 const totals=Object.fromEntries(keys.map(k=>[k,0])),team=Object.fromEntries(keys.map(k=>[k,0]));
 for(const [,r] of selected)for(const k of keys){totals[k]+=Number(r[k]||0);team[k]+=Number(r.team_totals?.[k]||0);}
 const ratio=(a,b)=>b>0?a/b*100:null;
 return {...totals,weeks:selected.length,opportunities:totals.carries+totals.targets,touches:totals.carries+totals.receptions,redzone:totals.redzone_carries+totals.redzone_targets,target_share:ratio(totals.targets,team.targets),rush_share:ratio(totals.carries,team.carries),opportunity_share:ratio(totals.carries+totals.targets,team.carries+team.targets),redzone_share:ratio(totals.redzone_carries+totals.redzone_targets,team.redzone_carries+team.redzone_targets),touch_share:ratio(totals.carries+totals.receptions,team.carries+team.receptions),reception_share:ratio(totals.receptions,team.receptions),inside10_share:ratio(totals.inside10_carries+totals.inside10_targets,team.inside10_carries+team.inside10_targets),inside5_share:ratio(totals.inside5_carries+totals.inside5_targets,team.inside5_carries+team.inside5_targets)};
}
const USAGE_HELP={
 touches:'Carries plus receptions in the selected period. A quick measure of how often the player actually handled the ball.',
 opportunities:'Carries plus targets in the selected period. Includes incomplete passes, so it captures chances as well as completed touches.',
 redzone:'Carries and targets inside the opponent’s 20-yard line in the selected period.',
 inside5Targets:'Targets inside the opponent’s 5-yard line in the selected period.',
 inside5:'Carries inside the opponent’s 5-yard line. These are close-range scoring opportunities, not touchdowns.',
 td:'Chance of at least one rushing or receiving TD in the upcoming week, estimated from prior TD frequency, position peers and recent workload. Passing TDs are excluded; this is a model estimate, not a betting probability.',
 recentTouches:'Average carries plus receptions across the last three recorded games before the upcoming week.',
 recentRedzone:'Average red-zone carries plus targets across the last three recorded games.',
 projection:'Provider fantasy-point projection for the upcoming week. When no projection is supplied, the prior scoring average appears instead.',
 target_share:'Player targets divided by team targets during the selected player weeks.',
 rush_share:'Player carries divided by team carries during the selected player weeks.',
 opportunity_share:'Player carries plus targets divided by the team’s carries plus targets during those same weeks.',
 touch_share:'Player carries plus receptions divided by the team’s carries plus receptions during those same weeks.',
 reception_share:'Player receptions divided by team receptions during the selected player weeks.',
 redzone_share:'Player red-zone carries plus targets divided by the team’s red-zone opportunities.',
 inside10_share:'Share of the team’s carries and targets inside the opponent’s 10-yard line.',
 inside5_share:'Share of the team’s carries and targets inside the opponent’s 5-yard line.'
};
function usageTile(label,value,key){return statHelpTile(label,value,USAGE_HELP[key],'strategy-metric metric-disclosure');}
function shareBar(label,value,color='blue',key='opportunity_share'){
 return `<button type="button" class="strategy-share share-${color} share-disclosure stat-help-trigger" data-stat-title="${esc(label)}" data-stat-help="${esc(USAGE_HELP[key])}" aria-expanded="false"><span class="share-bar-label"><span>${label}</span><b>${labPct(value)}</b></span><span class="strategy-share-track"><i style="width:${Math.max(0,Math.min(100,value||0))}%"></i></span></button>`;
}
const SHARE_METRICS=[['Target share','target_share','blue'],['Carry share','rush_share','green'],['Opportunity share','opportunity_share','purple'],['Touch share','touch_share','orange'],['Reception share','reception_share','cyan'],['Red-zone share','redzone_share','red'],['Inside-10 share','inside10_share','pink'],['Inside-5 share','inside5_share','indigo']];
function usageApplicability(p,v){
 const pos=p?.pos,skill=['QB','RB','WR','TE','FB'].includes(pos);
 return {skill,rush:skill&&(['QB','RB','FB'].includes(pos)||v?.carries>0),receive:skill&&(pos!=='QB'||v?.targets>0)};
}
function shareBars(v,p){
 const a=usageApplicability(p,v);if(!a.skill)return '<p class="lab-note">Touch shares apply to offensive skill players.</p>';
 return SHARE_METRICS.filter(([,key])=>key==='rush_share'?a.rush:['target_share','reception_share'].includes(key)?a.receive:true).map(([name,key,color])=>shareBar(name,v?.[key],color,key)).join('');
}
function usagePeriodLabel(){return STRATEGY.period.startsWith('week:')?'WEEK '+Number(STRATEGY.period.slice(5)):STRATEGY.period==='recent'?'LATEST 3 WEEKS':'SEASON';}
function usagePeriodOptions(data){
 const weeks=[...new Set((data?.players||[]).flatMap(r=>Object.keys(r.weeks||{}).map(Number)))].filter(w=>w>0&&w<strategyWeek()).sort((a,b)=>a-b);
 return [['season','Full season'],['recent','Latest 3 weeks'],...weeks.map(w=>['week:'+w,'Week '+w])].map(([value,label])=>`<option value="${value}" ${STRATEGY.period===value?'selected':''}>${label}</option>`).join('');
}
function usageForecast(p,data){
 const row=usageFor(p,data),estimate=FantasyMath.touchdownEstimate(row,data,strategyWeek()),unavailable=FantasyMath.unavailability(p?.status)!==null;
 const m=matchupContext(p||{}),noGame=m.data&&m.data.opponents&&!m.opp;
 const recent=Object.entries(row?.weeks||{}).filter(([w])=>Number(w)<strategyWeek()).sort((a,b)=>Number(a[0])-Number(b[0])).slice(-3).map(([,v])=>v),avg=keys=>recent.length?recent.reduce((s,r)=>s+keys.reduce((n,k)=>n+Number(r[k]||0),0),0)/recent.length:null;
 return {...estimate,recentTouches:avg(['carries','receptions']),recentRedzone:avg(['redzone_carries','redzone_targets']),chance:unavailable||noGame?null:estimate?.chance??null};
}
function usageStatTiles(p,v,data,compact=false){
 const f=usageForecast(p,data),o=currentProjection(p),a=usageApplicability(p,v),proj=usageTile((o.source==='Provider projection'?'Projection':'Scoring avg')+' · W'+strategyWeek(),labFormat(o.center),'projection');
 if(!a.skill)return {lead:[proj],more:[]};
 return {lead:[usageTile('Touches',labFormat(v?.touches,0),'touches'),usageTile('Opportunities',labFormat(v?.opportunities,0),'opportunities'),usageTile(compact?'Est. TD chance':'Est. TD chance · W'+strategyWeek(),labPct(f.chance),'td'),proj],
  more:[usageTile('Red-zone chances',labFormat(v?.redzone,0),'redzone'),a.rush?usageTile('Inside-5 carries',labFormat(v?.inside5_carries,0),'inside5'):usageTile('Inside-5 targets',labFormat(v?.inside5_targets,0),'inside5Targets'),usageTile(compact?'Touches / game':'Recent touches / game',labFormat(f.recentTouches),'recentTouches'),usageTile(compact?'RZ / game':'Recent RZ / game',labFormat(f.recentRedzone),'recentRedzone')]};
}
function usageStatCards(p,v,data,compact=false){const t=usageStatTiles(p,v,data,compact);return [...t.lead,...t.more].join('');}
// Report disclosure, with a plain fallback when explorer helpers are absent (tests).
function strategyDisclosure(key,summary,body){return typeof disclosure==='function'?disclosure(key,summary,body):`<details class="report-disclosure" data-disclosure="${esc(key)}"><summary>${summary}</summary><div class="report-disclosure-body">${body}</div></details>`;}
function homeUsageCards(p,v,data){
 const f=usageForecast(p,data),a=usageApplicability(p,v);
 if(!a.skill)return playerQuickStats(p);
 return usageTile('Touches / game',labFormat(f.recentTouches),'recentTouches')+usageTile('RZ chances / game',labFormat(f.recentRedzone),'recentRedzone')+usageTile('TD chance · W'+strategyWeek(),labPct(f.chance),'td');
}
function usageSnapshot(p,v){
 const tiles=usageStatTiles(p,v,usageDataset());
 return `<section class="lab-panel usage-snapshot" id="usage-snapshot"><div class="strategy-section-title"><div><span class="strategy-section-label">Selected player · ${usagePeriodLabel().toLowerCase()}</span><h4>${esc(p.name)}</h4></div><span>${v?v.weeks+' recorded weeks':'No play-by-play record matched this player'}</span></div><div class="strategy-metrics usage-metrics report-keys">${tiles.lead.join('')}</div><div class="strategy-share-grid">${shareBars(v,p)}</div>${tiles.more.length?strategyDisclosure('opportunity:more','More workload figures <small>red zone, goal line, recent per-game</small>',`<div class="strategy-metrics usage-metrics report-keys">${tiles.more.join('')}</div>`):''}</section>`;
}
function opportunityRows(data){
 const active=STRATEGY.leaders==='active'?new Set(tradeRoster(getTeam()).map(p=>usageFor(p,data)?.gsis_id).filter(Boolean)):null;
 return (data?.players||[]).filter(r=>(!active||active.has(r.gsis_id))&&(STRATEGY.position==='ALL'||r.position===STRATEGY.position)&&`${r.name} ${Object.values(r.weeks).at(-1)?.team||''}`.toLowerCase().includes(STRATEGY.search.toLowerCase())).map(r=>({r,v:usageTotals(r,data)})).filter(({v})=>v?.weeks).sort((a,b)=>(b.v[STRATEGY.sort]??-1)-(a.v[STRATEGY.sort]??-1)||a.r.name.localeCompare(b.r.name));
}
function opportunityTable(data){
 const rows=opportunityRows(data),selected=usageFor(strategyPlayer(),data)?.gsis_id;
 return `<div class="opportunity-results" id="opportunity-results"><p class="strategy-data-note">${rows.length} PLAYERS · ${usagePeriodLabel()}</p>${expandTable(['Player','Pos / NFL','Carries','Targets','Rec','Touches','Opp share','Target share','Rush share','Red zone car / tgt','Inside 10','Inside 5'],rows.slice(0,300).map(({r,v})=>`<tr data-usage-player="${esc(r.gsis_id)}" tabindex="0" aria-selected="${selected===r.gsis_id}" class="usage-row ${selected===r.gsis_id?'selected':''}" aria-label="Select ${esc(r.name)}; double-click to open Player Terminal"><td><b>${esc(r.name)}</b></td><td>${esc(r.position||'—')} / ${esc(Object.values(r.weeks).at(-1)?.team||'—')}</td><td>${v.carries}</td><td>${v.targets}</td><td>${v.receptions}</td><td><b>${v.touches}</b></td><td>${labPct(v.opportunity_share)}</td><td>${labPct(v.target_share)}</td><td>${labPct(v.rush_share)}</td><td>${v.redzone_carries} / ${v.redzone_targets}</td><td>${v.inside10_carries} / ${v.inside10_targets}</td><td>${v.inside5_carries} / ${v.inside5_targets}</td></tr>`),'',{extra:[2,4,10,11],sorted:{opportunities:6,redzone:9,target_share:7,rush_share:8,touches:5}[STRATEGY.sort],titles:{5:USAGE_HELP.touches,6:USAGE_HELP.opportunity_share,7:USAGE_HELP.target_share,8:USAGE_HELP.rush_share,9:USAGE_HELP.redzone,10:USAGE_HELP.inside10_share,11:USAGE_HELP.inside5_share}})}${!rows.length?'<p class="report-empty" role="status"><b>No players match these filters.</b>Clear the search or choose “ALL” positions.</p>':''}${rows.length>300?'<p class="lab-note">Showing the top 300. Narrow by position or name to see others.</p>':''}</div>`;
}
function updateOpportunityResults(){
 const data=usageDataset(),results=el('opportunity-results');if(results)results.outerHTML=opportunityTable(data);
 const p=strategyPlayer(),host=el('usage-snapshot');if(host&&p)host.outerHTML=usageSnapshot(p,usageTotals(usageFor(p,data),data));
}
function renderOpportunity(){
 const data=usageDataset(),p=strategyPlayer(),row=usageFor(p,data),v=usageTotals(row,data),season=Number(model.season);
 const filters=`<label>Period<select id="usage-period">${usagePeriodOptions(data)}</select></label><label>Position<select id="usage-position">${['ALL','QB','RB','WR','TE'].map(pos=>`<option ${STRATEGY.position===pos?'selected':''}>${pos}</option>`).join('')}</select></label><label>Search<input id="usage-search" type="search" placeholder="Name or NFL team" value="${esc(STRATEGY.search)}"></label><label>Sort by<select id="usage-sort">${[['opportunities','Opportunities'],['redzone','Red-zone chances'],['target_share','Target share'],['rush_share','Rush share'],['touches','Touches']].map(([id,label])=>`<option value="${id}" ${STRATEGY.sort===id?'selected':''}>${label}</option>`).join('')}</select></label>${model.source!=='demo'?`<button id="strategy-refresh-usage" class="lab-action" ${STRATEGY.usageBusy.has(season)?'disabled':''}>Refresh</button>`:''}`;
 setExplorer(strategyHeading('OPPORTUNITY','Touches & share','')+strategyPlayerPicker(p,filters)+
 `${!data?`<section class="strategy-empty"><h4>${STRATEGY.usageErrors.has(season)?'Waiting for the season dataset.':'Loading recorded NFL plays…'}</h4><p>${esc(STRATEGY.usageErrors.get(season)||'Team shares and red-zone counts will appear when published data is available.')}</p></section>`:''}`+
 (data&&p?usageSnapshot(p,v):'')+
 `${data?`<section class="lab-panel opportunity-leaders"><div class="strategy-section-title"><h4>Opportunity leaders</h4><label class="leader-filter">Show <select id="usage-leaders"><option value="active" ${STRATEGY.leaders==='active'?'selected':''}>Active franchise roster</option><option value="all" ${STRATEGY.leaders==='all'?'selected':''}>Every NFL player</option></select></label>${typeof columnsToggle==='function'?columnsToggle(4):''}</div>${opportunityTable(data)}</section>`:''}`+
 `<section class="strategy-method lab-panel"><h4>TD ESTIMATE · HOW IT WORKS</h4><p>Estimated TD chance is the modeled chance of at least one rushing or receiving touchdown in Week ${strategyWeek()}, if the recorded role continues. Passing TDs are excluded. It blends prior TD frequency with position peers (four prior-equivalent weeks), adjusts for the last three weeks’ workload (capped at 0.5–1.5×) and uses a Poisson model (1 − exp(−rate)). Needs four recorded weeks; not calibrated against outcomes; no opponent or injury adjustment. Unavailable players or unconfirmed games get no estimate.</p>${strategyDisclosure('opportunity:definitions','Metric definitions and data coverage <small>touches, shares, red zone, sources</small>',`<p>Touches = carries + receptions. Opportunities = carries + targets. Red-zone chances start within 20 yards of the end zone. Inside-10 and inside-5 columns show carries / targets. Recent averages cover up to three recorded weeks before this week; per-week averages use recorded player weeks, not team games.</p><p>Shares compare the player with every identified opportunity for their NFL offense in the same weeks (red-zone share uses team red-zone carries + targets). These are not snap shares. No-play penalties, kneels, spikes and two-point attempts are excluded. Zero is observed; a dash means unavailable.</p><p>${esc(data?.source||"Dataset unavailable")} · through Week ${data?.through_week||"—"}${data?.generated_at?" · published "+esc(new Date(data.generated_at).toLocaleDateString()):""} · <a href="https://nflreadr.nflverse.com/articles/dictionary_pbp.html" target="_blank" rel="noopener noreferrer">NFLverse definitions ↗</a></p>`)}</section>`);
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
 return `<section class="share-history-panel ${home?'home-share-history':''}" data-share-chart="${esc(p?.id||'')}" tabindex="0" role="group" aria-label="Open season share for ${esc(p?.name||'selected player')}"><div class="window-topline"><button class="share-history-link" type="button" data-share-all="${esc(p?.id||'')}">SHARE % / WEEK</button></div>${rows.length?`<div class="share-history-chart ${rows.length>12?'dense-weeks':''}" style="--week-count:${rows.length}" aria-label="Weekly opportunity share">${rows.map(r=>`<div class="share-week"><span class="share-week-value">${labFormat(r.share,0)}%</span><button type="button" class="share-week-bar" data-share-week="${r.week}" data-share-player="${esc(p.id)}" aria-label="Week ${r.week}: ${labPct(r.share)} opportunity share. Open week ${r.week} Touches and Share" title="Week ${r.week} · ${labPct(r.share)}" style="height:${r.share>0?Math.max(2,Math.min(100,r.share/scale*100)):2}%"></button><span class="share-week-label">W${r.week}</span></div>`).join('')}</div>`:'<p class="lab-note">No share history.</p>'}</section>`;
}
// These hosts are owned here; preserve unchanged controls and disclosure state.
// The node itself is the key, so a newly mounted report always renders.
const strategyMarkup=new WeakMap();
function setStrategyHTML(node,html){
 if(!node||strategyMarkup.get(node)===html)return;
 node.innerHTML=html;strategyMarkup.set(node,html);
}
function renderPlayerShareCharts(){
 const p=getPool().find(p=>String(p.id)===String(currentPlayerId)),home=el('player-share-spark');if(home)setStrategyHTML(home,shareHistoryChart(p,true));
 const expanded=el('player-share-history');if(expanded){const player=getPool().find(p=>String(p.id)===String(XL.player));setStrategyHTML(expanded,shareHistoryChart(player));}
}
function openShareHistory(event){
 const week=event.target.closest('[data-share-week]'),all=event.target.closest('[data-share-all]'),chart=event.target.closest('[data-share-chart]');
 const id=week?.dataset.sharePlayer||all?.dataset.shareAll||chart?.dataset.shareChart;if(!id)return;
 event.stopPropagation();STRATEGY.period=week?'week:'+week.dataset.shareWeek:'season';STRATEGY.player=id;
 openExplorer('opportunity',id);
}
// Bars select a week; the remaining chart surface opens the season report.
document.addEventListener('click',event=>{if(event.target.closest('[data-share-chart]')){event.stopPropagation();openShareHistory(event);}},true);
document.addEventListener('keydown',event=>{const chart=event.target.closest('[data-share-chart]');if(chart&&event.target===chart&&['Enter',' '].includes(event.key)){event.preventDefault();openShareHistory(event);}});
function tradeRoster(team){
 const week=strategyWeek(),historical=week!==Number(model.currentWeek||model.liveWeek||model.weeks?.at(-1));
 return teamLineupEntries(team,week,true).filter(e=>(team?.playerIds||[]).some(id=>String(id)===String(e.id))).map(e=>{const out=FantasyMath.unavailability(e.p.status);return {...e.p,espnProj:historical?null:e.p.espnProj,tradeUnavailable:!historical&&(out!==null||Number(e.p.byeWeek)===week),seasonUnavailable:!historical&&out==='season'};});
}
function tradeTeam(){return findTeam(STRATEGY.trade.team)||getTeam();}
function tradeConfig(){return FantasyMath.leagueLineup(model);}
const TRADE_MODES=[['projection','This week’s projections'],['season','Rest of season (projection + average)'],['balanced','Projection + recent form'],['history','Scoring average'],['floor','Conservative floor'],['ceiling','Upside ceiling']];
const TRADE_MODE_NOTE={projection:'This week only. Players who are out, on IR or on a bye count as zero, so a short-term absence can make a trade look better or worse than it is over the season.',season:'Weekly value over the rest of the season: the provider projection and the player’s scoring average weighted equally. A bye or one-week injury does not count against a player; IR and suspensions do.',balanced:'This week’s projection (or scoring average) blended 60/40 with the last three games.',history:'Average points in up to eight earlier games. A bye or one-week injury does not count against a player.',floor:'A cautious estimate from each player’s lower recent games.',ceiling:'An optimistic estimate from each player’s better recent games.'};
function tradeFormatLabel(){const counts=new Map();for(const slot of tradeConfig().slots){const label=FantasyMath.slotLabel(slot);counts.set(label,(counts.get(label)||0)+1);}return [...counts].map(([label,count])=>count+' '+label).join(' · ')||'Lineup settings unavailable';}
function tradeTeamOptions(selected,exclude=''){return model.teams.filter(t=>String(t.id)!==String(exclude)).map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?'selected':''}>${esc(teamName(t))}</option>`).join('');}
function tradeSide(team,side){
 const slots=new Map(teamLineupEntries(team,strategyWeek(),true).map(e=>[String(e.id),lineupSlotLabel(e.starter===false?{p:e.p}:e)]));
 const selected=STRATEGY.trade[side],players=tradeRoster(team),picked=players.filter(p=>selected.includes(String(p.id))),total=picked.length?FantasyMath.packageValue(picked,strategyWeek(),STRATEGY.trade.mode).total:null;
 const step=side==='give'?'1. Players Team A gives':'2. Players Team B gives',listId='trade-list-'+side;
 return `<section class="lab-panel trade-side ${side}" aria-labelledby="${listId}-title"><div class="trade-side-heading"><span id="${listId}-title">${step} · ${selected.length} selected</span><strong><button type="button" class="trade-club-link" data-trade-club="${esc(team.id)}" aria-label="Open ${esc(teamName(team))} club overview">${esc(teamName(team))}</button></strong><b>${labFormat(total)} <small>pts / wk</small></b></div><div class="trade-player-list" data-trade-list="${side}" role="group" aria-labelledby="${listId}-title">${players.length?players.map(p=>{const points=FantasyMath.tradeValue(p,strategyWeek(),STRATEGY.trade.mode),on=selected.includes(String(p.id)),id=`trade-${side}-${String(p.id).replace(/[^\w-]/g,'_')}`,status=p.status&&!/^(ACTIVE|HEALTHY|A)$/i.test(p.status)?p.status:'';return `<div class="trade-player ${on?'selected':''}" data-trade-player="${esc(p.id)}"><input type="checkbox" id="${esc(id)}" data-trade-side="${side}" value="${esc(p.id)}" ${on?'checked':''}><span class="trade-position">${esc(slots.get(String(p.id))||p.pos)}</span><span class="trade-player-name" style="display:flex;align-items:center;gap:10px"><label for="${esc(id)}" style="flex:1;min-width:0;cursor:pointer"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</b>${status?'<small>'+esc(status)+'</small>':''}</label><button type="button" class="trade-player-details" data-trade-details="${esc(p.id)}" aria-label="Details for ${esc(p.name)}" style="flex:none;font:12px var(--mono);padding:2px 4px;border:0;background:none;color:#3b6c97;text-decoration:underline;cursor:pointer">Details</button></span><span class="trade-nfl">${esc(p.nfl)}</span><strong>${labFormat(points)}<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"> points per week</span></strong></div>`}).join(''):'<p class="lab-note">No roster loaded for this team.</p>'}</div></section>`;
}
function tradeEvaluator(){
 ensureTrade();const t=STRATEGY.trade,own=tradeRoster(tradeTeam()),their=tradeRoster(findTeam(t.partner));
 t.drops??={give:[],get:[]};for(const [side,roster] of [['give',own],['get',their]])t.drops[side]=t.drops[side].filter(id=>!t[side].includes(id)&&roster.some(p=>String(p.id)===id));
 return FantasyMath.createTradeEvaluator(own,their,tradeConfig().slots,strategyWeek(),t.mode);
}
function tradeModel(){const evaluate=tradeEvaluator(),t=STRATEGY.trade;return evaluate(t.give,t.get,t.drops);}
const tradeSigned=n=>n===null?'—':(n>0?'+':'')+labFormat(n);
function tradeLineupTable(title,before,after,roster){
 const names=new Map(roster.map(p=>[String(p.id),p.name]));
 if(!before||!after)return `<section class="lab-panel"><h4>${esc(title)}</h4><p class="lab-note">A full lineup cannot be scored in this format. A required position or player estimate is missing.</p></section>`;
 const slots=tradeConfig().slots;
 return `<section class="lab-panel trade-lineup"><h4>${esc(title)} / STARTING LINEUP</h4>${before.missing||after.missing?`<p class="lab-note">Unpriced players excluded: ${before.missing} before · ${after.missing} after.</p>`:''}${expandTable(['SLOT','BEFORE','AFTER','Δ PTS'],slots.map((slot,index)=>{const a=before.players.find(p=>p.index===index),b=after.players.find(p=>p.index===index),changed=String(a.player)!==String(b.player);return `<tr class="${changed?'lineup-changed':''}"><th scope="row">${esc(FantasyMath.slotLabel(slot))}</th><td>${a.empty?'Empty slot':esc(names.get(String(a.player))||a.player)}<small>${labFormat(a.points)}</small></td><td>${b.empty?'Empty slot':esc(names.get(String(b.player))||b.player)}<small>${labFormat(b.points)}</small></td><td class="${b.points>=a.points?'positive-text':'negative-text'}">${tradeSigned(b.points-a.points)}</td></tr>`}).concat([`<tr class="trade-lineup-total"><th>TOTAL</th><td>${labFormat(before.total)}</td><td>${labFormat(after.total)}</td><td>${tradeSigned(after.total-before.total)}</td></tr>`]))}</section>`;
}
function tradeDrops(team,side){
 const t=STRATEGY.trade,players=tradeRoster(team).filter(p=>!t[side].includes(String(p.id))),extra=(side==='give'?t.get.length-t.give.length:t.give.length-t.get.length),selected=t.drops[side];
 return `<section class="trade-drop-picker"><h4>${side==='give'?'Team A':'Team B'} optional drops · ${selected.length} selected${extra>0?' · '+extra+' extra received':''}</h4><div>${players.map(p=>`<label><input type="checkbox" data-trade-drop="${side}" value="${esc(p.id)}" ${selected.includes(String(p.id))?'checked':''}>${esc(p.name)} <span>${esc(p.pos)} · ${labFormat(FantasyMath.tradeValue(p,strategyWeek(),t.mode))}</span></label>`).join('')}</div></section>`;
}
function tradePlayerEvidence(a){
 return expandTable(['SIDE / PLAYER','POS','VALUE / WK','PROJECTION','LAST 3 AVG','FLOOR','CEILING','STATUS'],[['SEND',a.give],['RECEIVE',a.get]].flatMap(([side,players])=>players.map(p=>{const o=currentProjection(p),recent=o.observations.slice(-3);return `<tr><td><small>${side}</small><b>${esc(p.name)}</b></td><td>${esc(p.pos)}</td><td><b>${labFormat(FantasyMath.tradeValue(p,strategyWeek(),STRATEGY.trade.mode))}</b></td><td>${o.source==='Provider projection'?labFormat(o.center):'—'}</td><td>${labFormat(recent.length?recent.reduce((s,r)=>s+r.points,0)/recent.length:null)}</td><td>${labFormat(o.floor)}</td><td>${labFormat(o.ceiling)}</td><td>${esc(p.status||'Not supplied')}</td></tr>`})));
}
function findTradeAlternatives(analysis=null,evaluator=null){
 const t=STRATEGY.trade,evaluate=evaluator||tradeEvaluator(),a=analysis||evaluate(t.give,t.get,t.drops);t.alternatives=[];t.searched=!!a.ready;
 if(!a.ready)return [];
 const weakest=Math.min(a.impact??-Infinity,a.theirImpact??-Infinity),candidates=[];
 for(const side of ['give','get'])for(const p of tradeRoster(side==='give'?tradeTeam():findTeam(t.partner))){
  if(t[side].includes(String(p.id))||t.drops[side].includes(String(p.id)))continue;
  const give=side==='give'?[...t.give,String(p.id)]:t.give,get=side==='get'?[...t.get,String(p.id)]:t.get,result=evaluate(give,get,t.drops);
  if(result.impact===null||result.theirImpact===null||Math.min(result.impact,result.theirImpact)<=weakest+.01)continue;
  candidates.push({id:String(p.id),name:p.name,side,balance:result.balance,impact:result.impact,theirImpact:result.theirImpact,delta:result.delta});
 }
 t.alternatives=candidates.sort((a,b)=>Math.min(b.impact,b.theirImpact)-Math.min(a.impact,a.theirImpact)||(b.impact+b.theirImpact)-(a.impact+a.theirImpact)||b.balance-a.balance).slice(0,3);
 return t.alternatives;
}
const tradeSearch={key:'',worker:null,result:null,visible:6,error:''};
function tradeVerdictSentence(a){
 if(!a.give.length||!a.get.length)return 'Choose at least one player from each team to compare a trade.';
 if(!a.ready)return 'A value is missing for at least one selected player, so this trade cannot be scored.';
 if(a.impact===null||a.theirImpact===null)return 'A starting lineup could not be scored. Check the lineup settings.';
 const side=(name,n)=>Math.abs(n)<.05?name+' stays level':n>0?name+' gains '+labFormat(n)+' pts':name+' loses '+labFormat(-n)+' pts';
 return `${side('Team A',a.impact)}; ${side('Team B',a.theirImpact)} per week.${a.balance===null?'':' Balance '+labFormat(a.balance,0)+'%.'}`;
}
function tradeDiagnosisText(data,names){
 const d=data.diagnosis;if(!d)return '';
 const list=rows=>rows.slice(0,3).map(r=>esc(names.get(r.id)||r.id)+' ('+esc(r.pos)+', +'+labFormat(r.gain)+')').join(', ');
 const weak=rows=>rows.map(r=>r.empty?'an empty '+esc(r.slot)+' slot':esc(r.slot)+' ('+labFormat(r.points)+')').join(' and ');
 const why={
  'no-surplus':'Neither bench has a player who would start for the other team, so any trade has to move a starter, and the side that loses the starter loses more than it gains.',
  'only-own-surplus':'Only Team A has bench players who would start for Team B. Team B has no bench player who would start for Team A, so Team A cannot get a lineup upgrade without giving up a starter.',
  'only-their-surplus':'Only Team B has bench players who would start for Team A. Team A has no bench player who would start for Team B, so Team B cannot get a lineup upgrade without giving up a starter.',
  'both-surplus':'Both teams have bench players the other team would start, but every swap that fills one need opens a bigger hole somewhere else.'
 }[d.reason];
 return `<div class="trade-diagnosis"><p><b>Why none were found.</b> ${why}</p><ul><li>Team A bench players who would start for Team B: ${d.ownSurplus.length?list(d.ownSurplus):'none'}.</li><li>Team B bench players who would start for Team A: ${d.theirSurplus.length?list(d.theirSurplus):'none'}.</li><li>Weakest starting slots: Team A ${weak(d.ownWeakest)||'none'}; Team B ${weak(d.theirWeakest)||'none'}.</li></ul><p>Try another Team B, or switch “Value by” to rest of season so a bye or one-week injury does not decide the result.</p></div>`;
}
function tradeCard(r,index,names,kind){
 const nameList=ids=>ids.map(id=>esc(names.get(id)||id)).join(' + ');
 const gain=n=>`<strong class="${n>=.05?'positive-text':n<=-.05?'negative-text':''}">${tradeSigned(n)} <small>pts / wk</small></strong>`;
 const pct=n=>n===null||n===undefined?'':`<span>${tradeSigned(n)}% lineup change</span>`;
 return `<article class="trade-recommendation"><header><b>${r.give.length} for ${r.get.length}</b><span>${labFormat(r.balance,0)}% balance</span></header><div class="trade-recommendation-sides"><div><small>Team A gives</small><b>${nameList(r.give)}</b>${gain(r.impact)}${pct(r.yourChange)}${r.drops.give.length?'<em>Then drops '+nameList(r.drops.give)+'</em>':''}</div><div><small>Team B gives</small><b>${nameList(r.get)}</b>${gain(r.theirImpact)}${pct(r.theirChange)}${r.drops.get.length?'<em>Then drops '+nameList(r.drops.get)+'</em>':''}</div></div><button type="button" class="lab-action" data-trade-recommendation="${index}" data-trade-kind="${kind}">Compare this trade</button></article>`;
}
function renderTradeRecommendations(){
 const host=el('trade-recommendations');if(!host||XL.open!=='trade')return;
 const data=tradeSearch.result;
 if(tradeSearch.error){host.innerHTML=`<p class="lab-note" role="status">${esc(tradeSearch.error)}</p>`;return;}
 if(!data){host.innerHTML='<p class="trade-search-progress" role="status">Comparing every 1- and 2-player package…</p>';return;}
 if(data.unavailable){host.innerHTML=`<p class="lab-note" role="status">${data.reason==='no-values'?'One of these teams has no player values for this setting (for example, no projections for this week). Switch “Value by” to rest of season or scoring average.':'The league’s starting lineup settings are not available, so lineups cannot be compared.'}</p>`;return;}
 const roster=[...tradeRoster(tradeTeam()),...tradeRoster(findTeam(STRATEGY.trade.partner))],names=new Map(roster.map(p=>[String(p.id),p.name]));
 const scope=`${esc(data.scope)} · ${data.checked.toLocaleString()} checked${data.checked<data.total?' of '+data.total.toLocaleString():''}`;
 if(!data.results.length){
  host.innerHTML=`<div class="trade-search-summary"><strong role="status">No trade improves both starting lineups</strong><span>${scope}</span></div>${tradeDiagnosisText(data,names)}${data.near?.length?`<h5 class="trade-near-title">Closest options</h5><p class="lab-note">One team gains; the other gives up the least. Use these as a starting point for a counteroffer.</p><div class="trade-recommendation-grid">${data.near.map((r,i)=>tradeCard(r,i,names,'near')).join('')}</div>`:''}`;
  return;
 }
 host.innerHTML=`<div class="trade-search-summary"><strong role="status">${data.results.length.toLocaleString()} mutually beneficial ${data.results.length===1?'trade':'trades'}</strong><span>${scope}${data.hidden?' · '+data.hidden.toLocaleString()+' with an extra throw-in hidden':''}</span></div><p class="lab-note">Both teams’ best starting lineups gain points. Ranked by the smaller of the two gains, so the fairest wins come first.</p><div class="trade-recommendation-grid">${data.results.slice(0,tradeSearch.visible).map((r,i)=>tradeCard(r,i,names,'result')).join('')}</div>${data.results.length>tradeSearch.visible?`<button type="button" class="lab-action trade-show-more" id="trade-more">Show ${Math.min(12,data.results.length-tradeSearch.visible)} more · ${data.results.length-tradeSearch.visible} remaining</button>`:''}`;
}
function requestTradeRecommendations(){
 const own=tradeRoster(tradeTeam()),their=tradeRoster(findTeam(STRATEGY.trade.partner)),slots=tradeConfig().slots,week=strategyWeek(),mode=STRATEGY.trade.mode;
 const fingerprint=p=>[p.id,p.pos,p.eligibleSlots,FantasyMath.tradeValue(p,week,mode)];
 const key=JSON.stringify([slots,week,mode,own.map(fingerprint),their.map(fingerprint)]);
 if(key===tradeSearch.key){renderTradeRecommendations();return;}
 tradeSearch.worker?.terminate();tradeSearch.key=key;tradeSearch.result=null;tradeSearch.visible=6;tradeSearch.error='';
 if(typeof Worker==='undefined'){tradeSearch.error='Automatic comparisons need browser worker support.';renderTradeRecommendations();return;}
 try{
  const worker=new Worker('trade-search-worker.js?v=9.20.0');tradeSearch.worker=worker;
  worker.onmessage=event=>{if(tradeSearch.key!==key)return;tradeSearch.result=event.data;worker.terminate();tradeSearch.worker=null;renderTradeRecommendations();};
  worker.onerror=()=>{if(tradeSearch.key!==key)return;worker.terminate();tradeSearch.worker=null;tradeSearch.error='Trade search could not finish. Change a team to retry.';renderTradeRecommendations();};
  worker.postMessage({own,their,slots,week,mode});
 }catch{tradeSearch.error='Trade search could not start.';renderTradeRecommendations();}
}
function tradeFavorBar(a,compact=false){
 const signals=FantasyMath.tradeSignals(a),known=signals.yourShare!==null;
 return `<div class="trade-favor ${compact?'compact':''}"><span class="trade-favor-title">${'PACKAGE VALUE RECEIVED'}</span><span class="trade-favor-labels"><b>A ${known?labFormat(signals.yourShare,0)+'%':compact?'':'—'}</b><b>B ${known?labFormat(signals.theirShare,0)+'%':compact?'':'—'}</b></span><span class="trade-favor-track ${known?'':'is-empty'}"><i style="width:${known?signals.yourShare:50}%"></i></span></div>`;
}
function tradeBalance(a){return `<div class="trade-balance-ring" style="--balance:${a.ready?a.balance:0}%" role="img" aria-label="Package balance ${a.ready?labFormat(a.balance,0)+' percent':'not available'}"><span><b class="${a.ready?'':'balance-empty'}">${a.ready?labFormat(a.balance,0)+'%':'ADD PLAYERS'}</b><small>PACKAGE</small><small>BALANCE</small></span></div>`;}
function tradeImpactCard(label,team,before,after,impact,percent,ready){
 const known=ready&&before&&after,positive=known&&impact>=0;
 return `<section class="trade-impact-card ${known?(positive?'positive':'negative'):''}"><span>${label}</span><h4>${esc(teamName(team))}</h4><strong>${known?(percent===null?'—':tradeSigned(percent)+'%'):'—'}</strong><div class="trade-impact-points">${known?tradeSigned(impact)+' pts / week':ready?'Incomplete starting lineup':'Select players to compare'}</div><div class="trade-before-after"><span>BEFORE <b>${labFormat(before?.total)}</b></span><span>AFTER <b>${ready?labFormat(after?.total):'—'}</b></span></div></section>`;
}
function renderTrade(analysis=null,preserveRosters=false){
 const retained=preserveRosters?[...(el('explore-content').querySelectorAll?.('[data-trade-list]')||[])]:[];
 ensureTrade();const t=STRATEGY.trade,mine=tradeTeam(),partner=findTeam(t.partner),own=tradeRoster(mine),their=tradeRoster(partner),evaluate=tradeEvaluator(),a=analysis||evaluate(t.give,t.get,t.drops),signals=FantasyMath.tradeSignals(a);
 const {ready,impact,theirImpact,give,get}=a;findTradeAlternatives(a,evaluate);
 const verdict=tradeVerdictSentence(a);
 const dropCount=a.requiredDrops.give+a.requiredDrops.get;
 const alerts=[...give,...get].filter(p=>p.status&&!/^(ACTIVE|HEALTHY|A)$/i.test(p.status));
 setExplorer(`<div class="trade-desk">${strategyHeading('TRADE','Trade Calculator','')}<div class="lab-controls trade-controls"><label class="trade-team-a">TEAM A<select id="trade-team">${tradeTeamOptions(t.team)}</select></label><div class="trade-center-controls"><label>VALUE BY<select id="trade-mode">${TRADE_MODES.map(([id,label])=>`<option value="${id}" ${t.mode===id?'selected':''}>${label}</option>`).join('')}</select></label><button class="lab-action" id="trade-clear">Reset</button></div><label class="trade-team-b">TEAM B<select id="trade-partner">${tradeTeamOptions(t.partner,t.team)}</select></label></div>
 <section class="trade-verdict"><div class="trade-verdict-heading"><span>Week ${strategyWeek()} · ${esc(model.scoring)} · ${esc(tradeFormatLabel())}</span><p role="status" class="trade-verdict-text"><b>${esc(verdict)}</b></p></div><p class="lab-note trade-explainer">Tick players in steps 1 and 2. Gains count only players who would start; balance of 100% means equal value sent each way.</p><div class="trade-dashboard">${tradeImpactCard('TEAM A / LINEUP CHANGE',mine,a.before,a.after,impact,signals.yourChange,ready)}<section class="trade-center-card">${tradeBalance(a)}${tradeFavorBar(a)}</section>${tradeImpactCard('TEAM B / LINEUP CHANGE',partner,a.theirBefore,a.theirAfter,theirImpact,signals.theirChange,ready)}</div></section>
 ${dropCount?`<p class="trade-alert">Roster space: choose ${a.requiredDrops.give} Team A / ${a.requiredDrops.get} Team B drops below to finalize this package.</p>`:''}<div class="trade-builder-grid">${tradeSide(mine,'give')}${tradeSide(partner,'get')}</div>
 ${alerts.length?`<p class="trade-alert">${alerts.map(p=>esc(p.name)+' · '+esc(p.status)).join(' / ')}</p>`:''}
 <section class="lab-panel trade-counteroffers"><div class="strategy-section-title"><h4>BALANCE THE DEAL</h4><span>PRIORITIZES THE WEAKER LINEUP</span></div><div class="trade-alternatives">${t.alternatives.map(r=>`<article><span>${r.side==='give'?'ADD TO TEAM A':'ADD TO TEAM B'}</span><b>${esc(r.name)}</b><div class="alternative-balance"><strong>${labFormat(r.balance,0)}%</strong><span>balance</span></div><div><span>A <strong>${tradeSigned(r.impact)}</strong></span><span>B <strong>${tradeSigned(r.theirImpact)}</strong></span></div><button class="lab-action" data-trade-alternative="${esc(r.id)}" data-side="${r.side}">Add to package</button></article>`).join('')||`<p class="lab-note">${ready?'No single addition improves the weaker lineup.':'Choose a package to see lineup improvements.'}</p>`}</div></section>
 ${strategyDisclosure('trade:lineups',`Starting lineups before and after <small>${tradeConfig().slots.length} slots × 2 teams</small>`,`<section class="trade-details"><div class="lab-two trade-lineup-grid">${tradeLineupTable(teamName(mine),a.before,a.after,[...own,...their])}${tradeLineupTable(teamName(partner),a.theirBefore,a.theirAfter,[...own,...their])}</div></section>`)}
 ${dropCount||t.drops.give.length||t.drops.get.length?`<section class="trade-details trade-drops-open"><h4>Roster drops</h4><div class="lab-two trade-drop-row">${tradeDrops(mine,'give')}${tradeDrops(partner,'get')}</div></section>`:strategyDisclosure('trade:drops','Optional roster drops <small>none needed for this package</small>',`<div class="lab-two trade-drop-row">${tradeDrops(mine,'give')}${tradeDrops(partner,'get')}</div>`)}
 ${give.length||get.length?strategyDisclosure('trade:evidence',`Player evidence <small>${give.length+get.length} players · projection, form, range, status</small>`,`<section class="trade-details">${tradePlayerEvidence(a)}</section>`):''}
 <section class="lab-panel trade-recommendations"><div class="strategy-section-title"><h4>BETTER FOR BOTH TEAMS</h4><span>RANKED BY THE SMALLER OF THE TWO GAINS</span></div><div id="trade-recommendations"></div></section>
${strategyDisclosure('trade:method','How the calculator works',`<section class="trade-method"><p>Lineup change re-optimizes every starting slot before and after the trade. Bench points count only if that player enters the best lineup. ${esc(TRADE_MODE_NOTE[t.mode]||'')} Points already scored are not trade value. Package balance compares exchanged totals, not win probability. A starting slot nobody on the roster can fill counts as zero. ${esc(tradeConfig().source)}. Recommendations include bench drops when an extra incoming player would increase roster size. This is a weekly scoring model, without draft-pick or keeper values.</p></section>`)}</div>`);
 renderHomeTrade();requestTradeRecommendations();
 for(const list of retained){const side=list.dataset.tradeList,replacement=el('explore-content').querySelector(`[data-trade-list="${side}"]`);if(!replacement)continue;for(const input of list.querySelectorAll('[data-trade-side]')){input.checked=STRATEGY.trade[side].includes(input.value);input.closest('.trade-player').classList.toggle('selected',input.checked);}replacement.replaceWith(list);}

}
function ensureTrade(){
 const t=STRATEGY.trade;if(!model.teams.some(x=>String(x.id)===String(t.team)))t.team=String(getTeam()?.id||'');
 const others=model.teams.filter(x=>String(x.id)!==t.team);
 if(!others.some(x=>String(x.id)===String(t.partner)))t.partner=String(others[0]?.id||'');
 const own=tradeRoster(tradeTeam()),their=tradeRoster(findTeam(t.partner));
 t.give=t.give.filter(id=>own.some(p=>String(p.id)===id));t.get=t.get.filter(id=>their.some(p=>String(p.id)===id));
 // Sleeper and imported files carry no projections. Until the user picks a
 // valuation, use rest of season (which falls back to scoring averages).
 if(!t.modeChosen){const week=strategyWeek(),hasProjection=[...own,...their].some(p=>FantasyMath.value(p,week,'projection')!==null);t.mode=hasProjection?'projection':'season';}
 return others;
}
function homeTradeSide(team,side,a){
 const selected=STRATEGY.trade[side],roster=tradeRoster(team),impact=side==='give'?a.impact:a.theirImpact,before=side==='give'?a.before:a.theirBefore,after=side==='give'?a.after:a.theirAfter;
 return `<div class="home-trade-side"><div class="home-trade-gain"><span>${side==='give'?'A':'B'} LINEUP GAIN</span><b class="home-trade-total ${impact===null?'':impact>=0?'positive-text':'negative-text'}">${a.ready?tradeSigned(impact):'0.0'}</b><small>${a.ready?labFormat(before?.total)+' → '+labFormat(after?.total):'BEST STARTING LINEUP'}</small></div><label class="home-trade-add"><span>${side==='give'?'A SENDS':'B SENDS'} · ${selected.length}</span><select data-home-trade-add="${side}" aria-label="Add player to ${side==='give'?'send':'receive'}"><option value="">+ Player…</option>${roster.filter(p=>!selected.includes(String(p.id))).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.pos)} · ${labFormat(FantasyMath.tradeValue(p,strategyWeek(),STRATEGY.trade.mode))}</option>`).join('')}</select></label></div>`;
}
function homeTradePicks(side){
 const ids=STRATEGY.trade[side],roster=tradeRoster(side==='give'?tradeTeam():findTeam(STRATEGY.trade.partner));
 return ids.map(id=>{const p=roster.find(p=>String(p.id)===id);return p?`<button data-home-trade-remove="${side}" data-id="${esc(id)}" aria-label="Remove ${esc(p.name)} from ${side==='give'?'send':'receive'}" title="${esc(p.name)}"><span>${esc(p.name)}</span><b>×</b></button>`:''}).join('');
}
function homePlayer(){return tradeRoster(getTeam()).find(p=>String(p.id)===String(currentPlayerId))||tradeRoster(getTeam())[0];}
function renderStrategyHome(){
 const host=el('outlook-preview');if(!host)return;strategyContext();const p=homePlayer();
 const o=p?currentProjection(p):{floor:null,center:null,ceiling:null,sample:0},key=`${model.season}:${strategyWeek()}`,data=usageDataset(),v=usageTotals(usageFor(p,data),data);
 setStrategyHTML(host,`<div class="window-topline"><b>${esc(p?.name||'Select a player')}</b><span>W${strategyWeek()} · ${esc(model.scoring)}</span></div>${rangeMetrics(o,true)}${rangeBar(o)}${p?matchupAI(p,true):''}${p&&FantasyMath.unavailability(p.status)?'<p class="tiny-caption">PLAYER UNAVAILABLE</p>':''}`);
 setStrategyHTML(el('share-preview'),`<div class="window-topline"><b>${esc(p?.name||'Select a player')}</b><span>${usagePeriodLabel()}</span></div><div class="strategy-metrics home-usage-metrics">${p?homeUsageCards(p,v,data):''}</div><div class="strategy-home-share-grid">${shareBars(v,p)}</div>${model.source==='demo'?'<p class="tiny-caption">SYNTHETIC EXHIBITION DATA</p>':''}`);
 renderPlayerShareCharts();
 renderHomeTrade();
 if(model.source!=='demo'){if(!STRATEGY.usage.has(Number(model.season))&&!STRATEGY.usageErrors.has(Number(model.season)))void loadUsage();if(!STRATEGY.defense.has(key))void loadStrategyDefense();}
}
function renderHomeTrade(){
 ensureTrade();const t=STRATEGY.trade,partner=findTeam(t.partner),a=tradeModel(),count=Math.max(t.give.length,t.get.length),density=count>8?'dense':count>4?'compact':'normal';
 const dropCount=a.requiredDrops.give+a.requiredDrops.get;
 setStrategyHTML(el('trade-preview'),`<div class="home-trade-controls"><label>TEAM A<select id="home-trade-team">${tradeTeamOptions(t.team)}</select></label><label>TEAM B<select id="home-trade-partner">${tradeTeamOptions(t.partner,t.team)}</select></label></div><div class="home-trade-builder" aria-live="polite">${homeTradeSide(tradeTeam(),'give',a)}<div class="home-trade-center">${tradeBalance(a)}</div>${homeTradeSide(partner,'get',a)}</div><div class="home-trade-packages ${density}"><div class="home-trade-picks give">${homeTradePicks('give')}</div><div class="home-trade-picks get">${homeTradePicks('get')}</div></div><div class="home-trade-dashboard">${tradeFavorBar(a,true)}</div><div class="home-trade-footer"><span>W${strategyWeek()} · ${t.mode==='projection'?'PROJECTIONS':t.mode==='season'?'REST OF SEASON':t.mode.toUpperCase()}${dropCount?' · '+dropCount+' DROP'+(dropCount>1?'S':'')+' NEEDED':''}</span><button class="lab-action" id="home-trade-clear">Reset</button></div>`);
}
function updateTradeControl(target){
 const id=target.id?.replace(/^home-/,''),mapping={'trade-team':'team','trade-partner':'partner','trade-mode':'mode'},t=STRATEGY.trade;
 if(mapping[id]){t[mapping[id]]=target.value;if(id==='trade-mode')t.modeChosen=true;if(id==='trade-partner'||id==='trade-team'){if(id==='trade-team')t.give=[];t.get=[];t.drops={give:[],get:[]};}}
 else if(target.dataset.tradeDrop){const side=target.dataset.tradeDrop;t.drops[side]=target.checked?[...new Set([...t.drops[side],target.value])]:t.drops[side].filter(id=>id!==target.value);}
 else if(target.dataset.tradeSide){const side=target.dataset.tradeSide;t[side]=target.checked?[...new Set([...t[side],target.value])]:t[side].filter(id=>id!==target.value);}
 else if(target.dataset.homeTradeAdd){if(target.value)t[target.dataset.homeTradeAdd]=[...new Set([...t[target.dataset.homeTradeAdd],target.value])];}
 else return false;
 t.alternatives=[];t.searched=false;if(XL.open==='trade')renderTrade(null,!!target.dataset.tradeSide);else renderHomeTrade();return true;
}
document.addEventListener('click',event=>{
 if(event.target.closest('details,a'))return;
 const report=event.target.closest('[data-report-open]');if(report&&!event.target.closest('button,input,select')){openExplorer(report.dataset.reportOpen,report.dataset.reportPlayer);return;}
 const opponent=event.target.closest('[data-opponent-archive]');if(opponent&&!event.target.closest('button,input,select')){void openOpponentArchive(opponent.dataset.opponentArchive,opponent);return;}
 const club=event.target.closest('[data-trade-club]');if(club){openExplorer('summary',null,{teamId:club.dataset.tradeClub});return;}
 const details=event.target.closest('[data-trade-details]');if(details){openExplorer('profile',details.dataset.tradeDetails);return;}
 const route=event.target.closest('[data-strategy-open]');if(route){STRATEGY.player=route.dataset.strategyPlayer||null;openExplorer(route.dataset.strategyOpen,STRATEGY.player);return;}
 const profile=event.target.closest('[data-strategy-profile]');if(profile){const p=strategyPlayer();if(p&&String(p.id).startsWith('usage:')&&!getPool().some(x=>String(x.id)===String(p.id)))XL.free.push(p);openExplorer('profile',profile.dataset.strategyProfile);return;}
 const player=event.target.closest('[data-usage-player]');if(player){selectUsagePlayer(player.dataset.usagePlayer);return;}
 const ai=event.target.closest('[data-matchup-ai]');if(ai){void generateMatchupAI(getPool().find(p=>String(p.id)===ai.dataset.matchupAi)||strategyPlayer());return;}
 if(event.target.id==='trade-more'){tradeSearch.visible+=12;renderTradeRecommendations();return;}
 const recommendation=event.target.closest('[data-trade-recommendation]');if(recommendation){const r=tradeSearch.result?.[recommendation.dataset.tradeKind==='near'?'near':'results']?.[Number(recommendation.dataset.tradeRecommendation)];if(r){STRATEGY.trade.give=[...r.give];STRATEGY.trade.get=[...r.get];STRATEGY.trade.drops={give:[...r.drops.give],get:[...r.drops.get]};renderTrade();el('explore-content').scrollTop=0;}return;}
 const alternative=event.target.closest('[data-trade-alternative]');if(alternative){STRATEGY.trade[alternative.dataset.side].push(alternative.dataset.tradeAlternative);STRATEGY.trade.alternatives=[];STRATEGY.trade.searched=false;renderTrade();return;}
 const remove=event.target.closest('[data-home-trade-remove]');if(remove){const side=remove.dataset.homeTradeRemove;STRATEGY.trade[side]=STRATEGY.trade[side].filter(id=>id!==remove.dataset.id);STRATEGY.trade.alternatives=[];STRATEGY.trade.searched=false;renderHomeTrade();return;}
 if(event.target.id==='strategy-refresh-defense')void loadStrategyDefense(true);
 if(event.target.id==='strategy-refresh-usage')void loadUsage(true);
 if(['trade-clear','home-trade-clear'].includes(event.target.id)){STRATEGY.trade.give=[];STRATEGY.trade.get=[];STRATEGY.trade.drops={give:[],get:[]};STRATEGY.trade.alternatives=[];STRATEGY.trade.searched=false;STRATEGY.trade.search={};if(XL.open==='trade')renderTrade();else renderHomeTrade();}
});
document.addEventListener('dblclick',event=>{const row=event.target.closest('[data-usage-player]');if(row)selectUsagePlayer(row.dataset.usagePlayer,true);});
document.addEventListener('keydown',event=>{
 if(['Enter',' '].includes(event.key)&&event.target.matches('[data-report-open],[data-opponent-archive]')){event.preventDefault();const node=event.target;if(node.dataset.reportOpen)openExplorer(node.dataset.reportOpen,node.dataset.reportPlayer);else void openOpponentArchive(node.dataset.opponentArchive,node);return;}
 const row=event.target.closest('[data-usage-player]');if(row&&['Enter',' '].includes(event.key)){event.preventDefault();selectUsagePlayer(row.dataset.usagePlayer,event.key==='Enter'&&row.getAttribute('aria-selected')==='true');}
 const file=event.target.closest('.scouting-file');if(file&&event.target===file&&['Enter',' '].includes(event.key)){event.preventDefault();STRATEGY.player=file.dataset.strategyPlayer;openExplorer('outlook',STRATEGY.player);}
});
document.addEventListener('change',event=>{
 const t=event.target;if(updateTradeControl(t)){const focus=t.id?el(t.id):t.dataset.homeTradeAdd?el('trade-preview').querySelector(`[data-home-trade-add="${t.dataset.homeTradeAdd}"]`):el('explore-content').querySelector?.(`input[${t.dataset.tradeDrop?'data-trade-drop':'data-trade-side'}="${t.dataset.tradeDrop||t.dataset.tradeSide}"][value="${CSS.escape(t.value)}"]`);focus?.focus?.({preventScroll:true});return;}
 if(t.id==='strategy-player'){STRATEGY.player=t.value;XL.player=t.value;renderStrategy(XL.open);}
 if(t.id==='strategy-scope'){const selected=strategyPlayer()?.id;STRATEGY.scope=t.value;const pool=strategyPlayerPool(t.value);STRATEGY.player=pool.find(p=>String(p.id)===String(selected))?.id||pool[0]?.id||null;XL.player=STRATEGY.player;renderStrategy(XL.open);}
 const usage={'usage-period':'period','usage-position':'position','usage-sort':'sort','usage-leaders':'leaders'};if(usage[t.id]){STRATEGY[usage[t.id]]=t.value;updateOpportunityResults();if(t.id==='usage-period')renderStrategyHome();}
 // Restore focus only to a control that a re-render replaced; never pull focus back on blur.
 if(t.id&&el(t.id)&&el(t.id)!==t&&(!document.activeElement||document.activeElement===document.body))el(t.id).focus?.({preventScroll:true});
});
// Ignore stale report instances and respect focus moves during the debounce.
el('explore-content').addEventListener('input',event=>{if(event.target.id==='usage-search'){const text=event.target.value,pos=event.target.selectionStart;STRATEGY.search=text;deferRender('usage',()=>{if(XL.open!=='opportunity'||event.target!==el('usage-search'))return;const ownsFocus=document.activeElement===el('usage-search');updateOpportunityResults();const input=el('usage-search');if(ownsFocus){input?.focus({preventScroll:true});input?.setSelectionRange(pos,pos);}});}});
for(const id of ['home-go-to','explore-jump'])for(const [value,label] of [['outlook','PLAYER OUTLOOK'],['opportunity','TOUCHES & SHARE'],['trade','TRADE CALCULATOR']])el(id)?.add(new Option(label,value));
renderStrategyHome();
