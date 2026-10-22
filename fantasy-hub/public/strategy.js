/* Strategy workspaces: observed opportunity, transparent estimates, roster analysis. */
'use strict';
const STRATEGY={identity:'',player:null,scope:'all',homeScope:'active',homePlayer:null,lastCurrent:null,leaders:'active',period:'season',position:'ALL',search:'',sort:'opportunities',usage:new Map(),usageBusy:new Set(),usageErrors:new Map(),defense:new Map(),defenseBusy:new Set(),ai:new Map(),aiBusy:new Set(),aiErrors:new Map(),trade:{partner:null,give:[],get:[],mode:'balanced',format:'standard'}};
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
 if(STRATEGY.identity!==key){STRATEGY.identity=key;STRATEGY.player=null;STRATEGY.homePlayer=null;STRATEGY.scope='all';STRATEGY.homeScope='active';STRATEGY.trade.give=[];STRATEGY.trade.get=[];STRATEGY.trade.partner=null;}
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
 return `<div class="opponent-stat-grid">${[
 [isDefense?'Scoring / game':'Points allowed / game',labFormat(rating?.[isDefense?'offensePPG':'defenseAllowedPPG']),rank?'Rank '+rank+' / '+data.rankedTeams:'NFL scoreboard'],
 ['Yards / play',labFormat(unit?.yardsPerPlay),isDefense?'Offense gained':'Defense allowed'],
 ['Net pass yards / play',labFormat(unit?.netPassYardsPerPlay),'Includes sacks'],
 ['Rush yards / play',labFormat(unit?.rushYardsPerPlay),'Kneels excluded'],
 [isDefense?'Sack rate conceded':'Sack rate generated',labPct(unit?.sackRate),'Sacks / pass plays'],
 [isDefense?'Giveaways / game':'Takeaways / game',labFormat(unit?.turnoversPerGame),'INT + lost fumbles'],
 ['EPA / play',labFormat(unit?.epaPerPlay,2),isDefense?'Offensive efficiency':'Efficiency allowed'],
 ['Success rate',labPct(unit?.successRate),'Plays with positive EPA'],
 ['Explosive play rate',labPct(unit?.explosiveRate),'Pass ≥20 / rush ≥10 yards']
 ].map(([label,value,detail])=>strategyMetric(label,value,detail)).join('')}</div>`;
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
function scoutingFile(p){const o=currentProjection(p);return `<section class="lab-panel scouting-file" data-strategy-open="outlook" data-strategy-player="${esc(p.id)}" tabindex="0" role="link" aria-label="Open Player Outlook for ${esc(p.name)}"><h4>SCOUTING FILE <span>PLAYER OUTLOOK ↗</span></h4><div class="scouting-meta"><b>${esc(p.pos)} / ${esc(p.nfl)}</b><span>${esc(p.status||'Status unavailable')}</span><span>Rostered ${labPct(p.owned)} · Started ${labPct(p.started)}</span></div>${rangeMetrics(o,true)}${rangeBar(o)}${matchupAI(p,true)}<div class="scouting-history">${priorScoring(p,true)}</div></section>`;}
function renderDefensiveOutlook(){
 const p=strategyPlayer();if(!p){setExplorer(strategyHeading('PLAYER OUTLOOK','Select a league first','Load player data to see projections and opponent context.'));return;}
 const o=currentProjection(p),key=`${model.season}:${strategyWeek()}`,m=matchupContext(p);
 setExplorer(strategyHeading('PLAYER OUTLOOK',p.name,'PLAYER OUTLOOK / Scoring range, prior evidence and the matchup ahead.')+strategyPlayerPicker(p)+
 `<div class="strategy-outlook-grid"><section class="strategy-range"><h4>PROJECTED SCORING RANGE <span>WEEK ${strategyWeek()} · ${esc(model.scoring)}</span></h4>${rangeMetrics(o)}${rangeBar(o)}<p>${o.sample} prior scoring weeks · select a metric for its explanation. ${/^(OUT|IR|INJURED_RESERVE|SUSPENDED)$/i.test(p.status||'')?'PLAYER MARKED UNAVAILABLE. Estimates do not override injury status.':''}</p></section>${priorScoring(p)}</div>`+
 `<section class="lab-panel strategy-opponent"><div class="strategy-section-title"><h4>${m.isDefense?'OPPOSING OFFENSE':'DEFENSIVE OUTLOOK'} / ${m.opp?'VS '+esc(m.opp):'OPPONENT UNCONFIRMED'}</h4>${model.source!=='demo'?`<button class="lab-action" id="strategy-refresh-defense">${STRATEGY.defenseBusy.has(key)?'Loading…':'Refresh opponent'}</button>`:''}</div>${opponentMetrics(p)}${matchupAI(p)}<p class="lab-note">${m.rating?m.rating.games+' completed games · ':''}NFL scoring: ESPN. Efficiency: NFLverse recorded plays before Week ${strategyWeek()}${m.unit?' ('+m.unit.games+' games)':''}. Lower EPA, success and explosive rates are better for a defense. Team points allowed includes all scoring; it is not fantasy points allowed to this position. The range is not adjusted by opponent ranking.</p></section>`);
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
function demoUsage(){
 const fields=['carries','targets','receptions','redzone_carries','redzone_targets','inside10_carries','inside10_targets','inside5_carries','inside5_targets'];
 return {season:model.season,through_week:6,source:'Fictional demonstration',generated_at:null,players:getPool().filter(p=>['QB','RB','WR','TE'].includes(p.pos)).map((p,i)=>({name:p.name,gsis_id:p.id,position:p.pos,weeks:Object.fromEntries(Array.from({length:6},(_,n)=>{const carries=p.pos==='RB'?12+(i+n)%7:p.pos==='QB'?3+n%3:0,targets=p.pos==='QB'?0:4+(i+n)%6,values=[carries,targets,Math.floor(targets*.65),carries?2+n%3:0,targets?1+n%2:0,carries?1+n%2:0,targets?1:0,carries?1:0,0];return [n+1,{team:p.nfl,...Object.fromEntries(fields.map((f,j)=>[f,values[j]])),team_totals:{carries:28,targets:33,receptions:22,redzone_carries:7,redzone_targets:6,inside10_carries:4,inside10_targets:3,inside5_carries:3,inside5_targets:2}}]}))}))};
}
function usageDataset(){return model.source==='demo'?demoUsage():STRATEGY.usage.get(Number(model.season));}
async function loadUsage(force=false){
 const season=Number(model.season);if(STRATEGY.usageBusy.has(season)||(!force&&(STRATEGY.usage.has(season)||STRATEGY.usageErrors.has(season))))return;
 STRATEGY.usageBusy.add(season);STRATEGY.usageErrors.delete(season);
 try{const r=await fetch(`/data/usage-${season}.json`,{cache:force?'reload':'default'});if(!r.ok)throw Error('The season’s opportunity dataset has not been published yet.');const data=await r.json();if(data.schema!==1||Number(data.season)!==season||!Array.isArray(data.players))throw Error('The opportunity dataset is unavailable.');STRATEGY.usage.set(season,data);}catch(e){STRATEGY.usageErrors.set(season,e.message||'Unable to load opportunity data.');}finally{STRATEGY.usageBusy.delete(season);if(XL.open==='opportunity')renderOpportunity();renderStrategyHome();}
}
function usageFor(p,data){
 if(!p||!data)return null;
 if(String(p.id).startsWith('usage:'))return data.players.find(x=>'usage:'+x.gsis_id===p.id);
 const id=String(p.espnId||'');if(id){const row=data.players.find(x=>String(x.espn_id)===id);if(row)return row;}
 // Exact normalized full names only, require a unique match. Never initials.
 const matches=data.players.filter(x=>nameKey(x.name)===nameKey(p.name));return matches.length===1?matches[0]:null;
}
function usageTotals(row,data){
 if(!row)return null;
 const selected=Object.entries(row.weeks).filter(([w])=>STRATEGY.period==='season'||Number(w)>data.through_week-3),keys=['carries','targets','receptions','redzone_carries','redzone_targets','inside10_carries','inside10_targets','inside5_carries','inside5_targets'];
 if(!selected.length)return null;
 const totals=Object.fromEntries(keys.map(k=>[k,0])),team=Object.fromEntries(keys.map(k=>[k,0]));
 for(const [,r] of selected)for(const k of keys){totals[k]+=Number(r[k]||0);team[k]+=Number(r.team_totals?.[k]||0);}
 const ratio=(a,b)=>b>0?a/b*100:null;
 return {...totals,weeks:selected.length,opportunities:totals.carries+totals.targets,touches:totals.carries+totals.receptions,redzone:totals.redzone_carries+totals.redzone_targets,target_share:ratio(totals.targets,team.targets),rush_share:ratio(totals.carries,team.carries),opportunity_share:ratio(totals.carries+totals.targets,team.carries+team.targets),redzone_share:ratio(totals.redzone_carries+totals.redzone_targets,team.redzone_carries+team.redzone_targets)};
}
function shareBar(label,value,color='blue'){return `<div class="strategy-share share-${color}"><div><span>${label}</span><b>${labPct(value)}</b></div><div class="strategy-share-track"><i style="width:${Math.max(0,Math.min(100,value||0))}%"></i></div></div>`;}
function usageSnapshot(p,v){
 const rate=n=>v?labFormat(n/v.weeks)+' / recorded week':'No matched play record';
 return `<section class="lab-panel usage-snapshot" id="usage-snapshot"><div class="strategy-section-title"><div><span class="strategy-section-label">PLAYER SNAPSHOT</span><h4>${esc(p.name)}</h4></div><span>${v?v.weeks+' recorded weeks':'No matched play-by-play record'}</span></div><div class="strategy-metrics four">${strategyMetric('Touches',labFormat(v?.touches,0),rate(v?.touches)+' · carries + catches')}${strategyMetric('Opportunities',labFormat(v?.opportunities,0),rate(v?.opportunities)+' · carries + targets')}${strategyMetric('Red-zone chances',labFormat(v?.redzone,0),v?`${v.redzone_carries} carries + ${v.redzone_targets} targets inside 20`:'Carries + targets inside 20')}${strategyMetric('Inside-5 carries',labFormat(v?.inside5_carries,0),v?v.carries?`${labFormat(v.inside5_carries/v.carries*100)}% of carries at the goal line`:'No recorded carries':'Goal-line rushing work')}</div><div class="strategy-share-grid">${shareBar('Target share',v?.target_share,'blue')}${shareBar('Rushing share',v?.rush_share,'green')}${shareBar('Team opportunity share',v?.opportunity_share,'purple')}${shareBar('Red-zone share',v?.redzone_share,'orange')}</div></section>`;
}
function opportunityRows(data){
 const roster=tradeRoster(getTeam());
 return (data?.players||[]).map(r=>({r,v:usageTotals(r,data)})).filter(({r,v})=>v?.weeks&&(STRATEGY.leaders!=='active'||roster.some(p=>usageFor(p,data)===r))&&(STRATEGY.position==='ALL'||r.position===STRATEGY.position)&&`${r.name} ${Object.values(r.weeks).at(-1)?.team||''}`.toLowerCase().includes(STRATEGY.search.toLowerCase())).sort((a,b)=>(b.v[STRATEGY.sort]??-1)-(a.v[STRATEGY.sort]??-1)||a.r.name.localeCompare(b.r.name));
}
function renderOpportunity(){
 const data=usageDataset(),p=strategyPlayer(),row=usageFor(p,data),v=usageTotals(row,data),season=Number(model.season),rows=opportunityRows(data);
 const filters=`<label>PERIOD<select id="usage-period"><option value="season" ${STRATEGY.period==='season'?'selected':''}>Season</option><option value="recent" ${STRATEGY.period==='recent'?'selected':''}>Latest 3 weeks</option></select></label><label>POSITION<select id="usage-position">${['ALL','QB','RB','WR','TE'].map(pos=>`<option ${STRATEGY.position===pos?'selected':''}>${pos}</option>`).join('')}</select></label><label>FIND<input id="usage-search" type="search" placeholder="Name or NFL team" value="${esc(STRATEGY.search)}"></label><label>SORT<select id="usage-sort">${[['opportunities','Opportunities'],['redzone','Red-zone chances'],['target_share','Target share'],['rush_share','Rush share'],['touches','Touches']].map(([id,label])=>`<option value="${id}" ${STRATEGY.sort===id?'selected':''}>${label}</option>`).join('')}</select></label>${model.source!=='demo'?`<button id="strategy-refresh-usage" class="lab-action" ${STRATEGY.usageBusy.has(season)?'disabled':''}>Refresh</button>`:''}`;
 setExplorer(strategyHeading('OPPORTUNITY','Touches & Share','Recorded workload / Touches, scoring-area chances and a share of the offense.')+strategyPlayerPicker(p,filters)+
 `${!data?`<section class="strategy-empty"><h4>${STRATEGY.usageErrors.has(season)?'Waiting for the season dataset.':'Loading recorded NFL plays…'}</h4><p>${esc(STRATEGY.usageErrors.get(season)||'Team shares and red-zone counts will appear when published data is available.')}</p></section>`:`<p class="strategy-data-note">${esc(data.source)} · through Week ${data.through_week}${data.generated_at?' · published '+esc(new Date(data.generated_at).toLocaleDateString()):' · SYNTHETIC EXHIBITION VALUES'} · ${STRATEGY.period==='season'?'Season to date':'Latest three calendar weeks'}</p>`}`+
 (data&&p?usageSnapshot(p,v):'')+
 `${data?`<section class="lab-panel opportunity-leaders"><div class="strategy-section-title"><h4>OPPORTUNITY LEADERS / ${rows.length} PLAYERS</h4><label class="leader-filter">SHOW <select id="usage-leaders"><option value="active" ${STRATEGY.leaders==='active'?'selected':''}>Active franchise roster</option><option value="all" ${STRATEGY.leaders==='all'?'selected':''}>Every NFL player</option></select></label></div><p class="strategy-data-note">Click a row to select · double-click to open Player Terminal · Enter selects / Enter again opens</p>${expandTable(['PLAYER','POS / NFL','CAR','TGT','REC','TOUCHES','TEAM %','TGT %','RUSH %','RZ CAR / TGT','INSIDE 10','INSIDE 5'],rows.slice(0,300).map(({r,v})=>`<tr data-usage-player="${esc(r.gsis_id)}" tabindex="0" aria-selected="${row?.gsis_id===r.gsis_id}" class="usage-row ${row?.gsis_id===r.gsis_id?'selected':''}" aria-label="Select ${esc(r.name)}; double-click to open Player Terminal"><td><b>${esc(r.name)}</b></td><td>${esc(r.position||'—')} / ${esc(Object.values(r.weeks).at(-1)?.team||'—')}</td><td>${v.carries}</td><td>${v.targets}</td><td>${v.receptions}</td><td><b>${v.touches}</b></td><td>${labPct(v.opportunity_share)}</td><td>${labPct(v.target_share)}</td><td>${labPct(v.rush_share)}</td><td>${v.redzone_carries} / ${v.redzone_targets}</td><td>${v.inside10_carries} / ${v.inside10_targets}</td><td>${v.inside5_carries} / ${v.inside5_targets}</td></tr>`))}${!rows.length?'<p>No players match these filters.</p>':''}${rows.length>300?'<p>Showing the top 300. Narrow by position or name for more.</p>':''}</section>`:''}`+
 `<details class="strategy-method"><summary>Definitions & coverage</summary><p>Touches = carries + receptions. Opportunities = carries + targets. Red-zone chances start within 20 yards of the end zone. Inside-10 and inside-5 columns show carries / targets. Per-week averages use recorded player weeks, not team games.</p><p>Shares compare the player with all identified opportunities for their NFL offense during those same weeks. Red-zone share uses team red-zone carries + targets; team opportunity share uses all carries + targets. These are not snap shares. No-play penalties, kneels, spikes and two-point attempts are excluded. Zero is observed; a dash means unavailable.</p><p><a href="https://nflreadr.nflverse.com/articles/dictionary_pbp.html" target="_blank" rel="noopener noreferrer">NFLverse definitions ↗</a></p></details>`);
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
function tradeRoster(team){return (team?.playerIds||[]).map(id=>model.players[id]).filter(Boolean);}
function tradeSide(team,side){const selected=STRATEGY.trade[side],players=tradeRoster(team);return `<section class="lab-panel trade-side"><div class="trade-side-heading"><span>${side==='give'?'YOU SEND':'YOU RECEIVE'}</span><strong>${esc(teamName(team))}</strong><small>${selected.length} selected</small></div><div class="trade-player-list">${players.length?players.map(p=>{const points=FantasyMath.value(p,strategyWeek(),STRATEGY.trade.mode),on=selected.includes(String(p.id));return `<label class="trade-player ${on?'selected':''}"><input type="checkbox" data-trade-side="${side}" value="${esc(p.id)}" ${on?'checked':''}><span class="trade-position">${esc(p.pos)}</span><span><b>${esc(p.name)}</b><small>${esc(p.nfl)} · ${esc(p.status||'Status unavailable')}</small></span><strong>${labFormat(points)}</strong></label>`}).join(''):'<p class="lab-note">This team has no loaded roster. Select another team or refresh your league.</p>'}</div></section>`;}
function renderTrade(){
 const t=STRATEGY.trade,mine=getTeam(),others=model.teams.filter(x=>String(x.id)!==String(mine.id));
 if(!others.some(x=>String(x.id)===String(t.partner)))t.partner=String(others[0]?.id||'');
 const partner=findTeam(t.partner),own=tradeRoster(mine),their=tradeRoster(partner);
 t.give=t.give.filter(id=>own.some(p=>String(p.id)===id));t.get=t.get.filter(id=>their.some(p=>String(p.id)===id));
 const give=own.filter(p=>t.give.includes(String(p.id))),get=their.filter(p=>t.get.includes(String(p.id))),g=FantasyMath.packageValue(give,strategyWeek(),t.mode),r=FantasyMath.packageValue(get,strategyWeek(),t.mode);
 const ready=give.length&&get.length&&g.total!==null&&r.total!==null,delta=ready?r.total-g.total:null,slots=STRATEGY_FORMATS[t.format];
 const before=FantasyMath.bestLineup(own,slots,strategyWeek(),t.mode),after=FantasyMath.bestLineup([...own.filter(p=>!t.give.includes(String(p.id))),...get],slots,strategyWeek(),t.mode);
 const theirBefore=FantasyMath.bestLineup(their,slots,strategyWeek(),t.mode),theirAfter=FantasyMath.bestLineup([...their.filter(p=>!t.get.includes(String(p.id))),...give],slots,strategyWeek(),t.mode);
 const impact=ready&&before&&after?after.total-before.total:null,theirImpact=ready&&theirBefore&&theirAfter?theirAfter.total-theirBefore.total:null;
 const magnitude=ready?Math.max(Math.abs(g.total),Math.abs(r.total),1):1;
 const verdict=!give.length||!get.length?'Build both sides of the deal.':!ready?'Some selected players are missing scores.':Math.abs(delta)/magnitude<=.05?'Close on modeled scoring.':delta>0?'More scoring coming your way.':'More scoring going the other way.';
 setExplorer(strategyHeading('03 / TRADE CALCULATOR','Trade Calculator','Compare player packages and their effect on both starting lineups.')+
 `<div class="lab-controls"><label>TRADE PARTNER<select id="trade-partner">${others.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===t.partner?'selected':''}>${esc(teamName(x))}</option>`).join('')}</select></label><label>VALUATION<select id="trade-mode">${[['balanced','60% center + 40% recent form'],['projection','Provider projection only'],['history','Prior scoring average']].map(([id,label])=>`<option value="${id}" ${t.mode===id?'selected':''}>${label}</option>`).join('')}</select></label><label>STARTER FORMAT<select id="trade-format">${[['standard','1 QB · 2 RB · 2 WR · 1 TE · FLEX · K · D/ST'],['threewr','3 WR + FLEX'],['superflex','2 WR + FLEX + SUPERFLEX']].map(([id,label])=>`<option value="${id}" ${t.format===id?'selected':''}>${label}</option>`).join('')}</select></label><button class="lab-action" id="trade-clear">Clear trade</button></div>`+
 `<div class="trade-verdict" aria-live="polite"><span class="strategy-section-label">YOUR PERSPECTIVE</span><h4>${verdict}</h4><div class="strategy-metrics four">${strategyMetric('Package difference',delta===null?'—':(delta>0?'+':'')+labFormat(delta),'Incoming minus outgoing / week')}${strategyMetric('Your lineup change',impact===null?'—':(impact>0?'+':'')+labFormat(impact),'Best eligible starting lineup')}${strategyMetric('Their lineup change',theirImpact===null?'—':(theirImpact>0?'+':'')+labFormat(theirImpact),'Trade partner’s perspective')}${strategyMetric('Roster spots',ready?String(get.length-give.length):'—','Extra players you receive')}</div></div>`+
 `<div class="lab-two">${tradeSide(mine,'give')}${tradeSide(partner,'get')}</div>`+
 `<section class="lab-panel"><h4>ROSTER FIT / BEFORE → AFTER</h4>${expandTable(['POSITION','YOUR ROSTER','PARTNER ROSTER'],['QB','RB','WR','TE','K','DEF'].map(pos=>{const count=ps=>ps.filter(p=>p.pos===pos||pos==='DEF'&&p.pos==='D/ST').length;return `<tr><td>${pos==='DEF'?'D/ST':pos}</td><td>${count(own)} → ${count([...own.filter(p=>!t.give.includes(String(p.id))),...get])}</td><td>${count(their)} → ${count([...their.filter(p=>!t.get.includes(String(p.id))),...give])}</td></tr>`}))}<p class="lab-note">${ready&&(!before||!after||!theirBefore||!theirAfter)?'A lineup total is unavailable where a roster cannot fill this format with scored players. ':''}${get.length>give.length?'You receive extra players; confirm roster capacity and any required drops. ':''}Format is a selectable assumption, not automatically inferred from league settings. Missing player estimates can change the best-lineup result.</p></section>`+
 `<details class="strategy-method"><summary>What this calculator measures</summary><p>Values are fantasy points per week in your loaded scoring system. Balanced valuation weights the current provider projection (or prior mean) at 60% and the last three prior recorded weeks at 40%. Projection-only mode leaves missing projections blank. History uses up to eight prior weeks.</p><p>The lineup calculation assigns each player once to the best eligible slot, including flex. A package within 5% is labeled close. These are transparent scoring comparisons, not dynasty values, rest-of-season forecasts, trade recommendations, or acceptance probabilities. Injury changes, future schedules, keeper rules, roster limits and required drops are not priced in.</p><p>Nothing here submits a trade or changes a roster.</p></details>`);
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
 el('share-preview').innerHTML=`<div class="window-topline"><span>${STRATEGY.period==='recent'?'LATEST 3 NFL WEEKS':'SEASON OPPORTUNITY'}</span><span>${data?'THRU W'+data.through_week:'AWAITING DATA'}</span></div><div class="strategy-home-metrics">${metric('TOUCHES',labFormat(v?.touches,0))}${metric('OPPORTUNITIES',labFormat(v?.opportunities,0))}${metric('RED-ZONE CHANCES',labFormat(v?.redzone,0))}</div><div class="strategy-home-share-grid">${shareBar('Target share',v?.target_share,'blue')}${shareBar('Rushing share',v?.rush_share,'green')}${shareBar('Team opportunity',v?.opportunity_share,'purple')}${shareBar('Red-zone share',v?.redzone_share,'orange')}</div><div class="strategy-home-line"><span>RED-ZONE CAR / TGT</span><b>${labFormat(v?.redzone_carries,0)} / ${labFormat(v?.redzone_targets,0)}</b></div><div class="strategy-home-line"><span>INSIDE-5 CAR / TGT</span><b>${labFormat(v?.inside5_carries,0)} / ${labFormat(v?.inside5_targets,0)}</b></div><p class="tiny-caption">${model.source==='demo'?'SYNTHETIC EXHIBITION DATA':data?'NFLverse · shares during recorded weeks.':'Opportunity data unavailable. Expand to retry.'}</p><span class="strategy-home-action">OPEN WORKLOAD & LEADERS ▣</span>`;
 const others=ensureTrade(),t=STRATEGY.trade,own=tradeRoster(getTeam()),partner=findTeam(t.partner),their=tradeRoster(partner),give=own.filter(x=>t.give.includes(String(x.id))),get=their.filter(x=>t.get.includes(String(x.id))),g=give.length?FantasyMath.packageValue(give,strategyWeek(),t.mode).total:null,r=get.length?FantasyMath.packageValue(get,strategyWeek(),t.mode).total:null;
 el('trade-preview').innerHTML=`<div class="home-trade-controls"><label>PARTNER<select id="home-trade-partner">${others.map(team=>`<option value="${esc(team.id)}" ${String(team.id)===t.partner?'selected':''}>${esc(teamName(team))}</option>`).join('')}</select></label><label>VALUE<select id="home-trade-mode">${[['balanced','Balanced'],['projection','Projection'],['history','History']].map(([id,label])=>`<option value="${id}" ${t.mode===id?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="strategy-home-metrics" aria-live="polite">${metric('YOU SEND',labFormat(g))}${metric('YOU RECEIVE',labFormat(r))}${metric('DIFFERENCE',g!==null&&r!==null?(r-g>0?'+':'')+labFormat(r-g):'—','estimate-center')}</div><div class="home-trade-builder">${homeTradeSide(getTeam(),'give')}${homeTradeSide(partner,'get')}</div><div class="home-trade-footer"><span>MODELED PTS / WEEK</span><button class="lab-action" id="home-trade-clear">Clear</button></div><p class="tiny-caption">Add players to both packages. Expand for starting-lineup impact.${model.source==='demo'?' EXHIBITION DATA.':''}</p><span class="strategy-home-action">OPEN FULL TRADE SIMULATOR ▣</span>`;
 if(model.source!=='demo'){if(!STRATEGY.usage.has(Number(model.season))&&!STRATEGY.usageErrors.has(Number(model.season)))void loadUsage();if(!STRATEGY.defense.has(key))void loadStrategyDefense();}
}
function updateTradeControl(target){
 const id=target.id?.replace(/^home-/,''),mapping={'trade-partner':'partner','trade-mode':'mode','trade-format':'format'},t=STRATEGY.trade;
 if(mapping[id]){t[mapping[id]]=target.value;if(id==='trade-partner')t.get=[];}
 else if(target.dataset.tradeSide){const side=target.dataset.tradeSide;t[side]=target.checked?[...new Set([...t[side],target.value])]:t[side].filter(id=>id!==target.value);}
 else if(target.dataset.homeTradeAdd){if(target.value)t[target.dataset.homeTradeAdd]=[...new Set([...t[target.dataset.homeTradeAdd],target.value])];}
 else return false;
 if(XL.open==='trade')renderTrade();else renderStrategyHome();return true;
}
document.addEventListener('click',event=>{
 if(event.target.closest('.range-help'))return;
 const route=event.target.closest('[data-strategy-open]');if(route){STRATEGY.player=route.dataset.strategyPlayer||null;openExplorer(route.dataset.strategyOpen,STRATEGY.player);return;}
 const profile=event.target.closest('[data-strategy-profile]');if(profile){const p=strategyPlayer();if(p&&String(p.id).startsWith('usage:')&&!getPool().some(x=>String(x.id)===String(p.id)))XL.free.push(p);openExplorer('profile',profile.dataset.strategyProfile);return;}
 const player=event.target.closest('[data-usage-player]');if(player){selectUsagePlayer(player.dataset.usagePlayer);return;}
 const ai=event.target.closest('[data-matchup-ai]');if(ai){void generateMatchupAI(strategyPlayer());return;}
 const remove=event.target.closest('[data-home-trade-remove]');if(remove){const side=remove.dataset.homeTradeRemove;STRATEGY.trade[side]=STRATEGY.trade[side].filter(id=>id!==remove.dataset.id);renderStrategyHome();return;}
 if(event.target.id==='strategy-refresh-defense')void loadStrategyDefense(true);
 if(event.target.id==='strategy-refresh-usage')void loadUsage(true);
 if(['trade-clear','home-trade-clear'].includes(event.target.id)){STRATEGY.trade.give=[];STRATEGY.trade.get=[];if(XL.open==='trade')renderTrade();else renderStrategyHome();}
});
document.addEventListener('dblclick',event=>{const row=event.target.closest('[data-usage-player]');if(row)selectUsagePlayer(row.dataset.usagePlayer,true);});
document.addEventListener('keydown',event=>{
 const row=event.target.closest('[data-usage-player]');if(row&&['Enter',' '].includes(event.key)){event.preventDefault();selectUsagePlayer(row.dataset.usagePlayer,event.key==='Enter'&&row.getAttribute('aria-selected')==='true');}
 const file=event.target.closest('.scouting-file');if(file&&event.target===file&&['Enter',' '].includes(event.key)){event.preventDefault();STRATEGY.player=file.dataset.strategyPlayer;openExplorer('outlook',STRATEGY.player);}
});
document.addEventListener('change',event=>{
 const t=event.target;if(updateTradeControl(t)){const focus=t.id?el(t.id):t.dataset.homeTradeAdd?el('trade-preview').querySelector(`[data-home-trade-add="${t.dataset.homeTradeAdd}"]`):el('explore-content').querySelector?.(`input[data-trade-side="${t.dataset.tradeSide}"][value="${CSS.escape(t.value)}"]`);focus?.focus?.({preventScroll:true});return;}
 if(t.id==='strategy-player'){STRATEGY.player=t.value;XL.player=t.value;renderStrategy(XL.open);}
 if(t.id==='strategy-scope'){STRATEGY.scope=t.value;STRATEGY.player=strategyPlayerPool(t.value)[0]?.id||null;XL.player=STRATEGY.player;renderStrategy(XL.open);}
 const usage={'usage-period':'period','usage-position':'position','usage-sort':'sort','usage-leaders':'leaders'};if(usage[t.id]){STRATEGY[usage[t.id]]=t.value;renderOpportunity();}
 if(['home-outlook-scope','home-share-scope'].includes(t.id)){STRATEGY.homeScope=t.value;STRATEGY.homePlayer=null;renderStrategyHome();}
 if(['home-outlook-player','home-share-player'].includes(t.id)){STRATEGY.homePlayer=t.value;if(tradeRoster(getTeam()).some(p=>String(p.id)===t.value)){currentPlayerId=t.value;drawRoster(getTeam());drawProfile(getTeam());}else renderStrategyHome();}
 if(t.id&&el(t.id))el(t.id).focus?.({preventScroll:true});
});
el('explore-content').addEventListener('input',event=>{if(event.target.id==='usage-search'){const text=event.target.value,pos=event.target.selectionStart;STRATEGY.search=text;deferRender('usage',()=>{if(XL.open!=='opportunity')return;renderOpportunity();const input=el('usage-search');input?.focus({preventScroll:true});input?.setSelectionRange(pos,pos);});}});
for(const id of ['home-go-to','explore-jump'])for(const [value,label] of [['outlook','PLAYER OUTLOOK'],['opportunity','TOUCHES & SHARE'],['trade','TRADE CALCULATOR']])el(id)?.add(new Option(label,value));
renderStrategyHome();
