/* GRIDIRON/86 RESEARCH EDITION — expanded workspaces. Vanilla JS, no frameworks. */
'use strict';
const XL = {
  open:null, player:null, free:[], offset:0, freeLoaded:false, freeBusy:false, freeError:'',
  advanced:new Map(), importedColumns:[], demoSeeded:false, positionRowsVisible:new Map(),
  graph:{x:'total',y:'avg',pos:'ALL',scope:'ALL',minimum:0,showLabels:true,trend:true,search:'',color:'pos'},
  agent:{pos:'ALL',search:'',sort:'projected'}, positionComparePos:'ALL', positionCompareWeek:'all', positionComparisonView:'position', positionComparisonPool:'ROSTERED', positionComparisonSort:'GRADE', leagueComparisonPos:'ALL', leagueComparisonView:'week', graphStatFocus:null, graphAutoSource:null, graphUserSelected:false, graphNotice:'',
  standingsSort:'rank', viewTeamId:null, lineupScenarios:new Map(), viewWeek:null, franchiseWeek:null, franchiseWeekTeam:null, selectedPoint:null, news:new Map(), overview:new Map(), history:[], future:[], focusedSeries:null, focusTarget:null, positionWeek:"all", positionFocusPlayer:null, positionSharePos:'LEADING', playerLogRange:'all', playerArchiveAll:false, opponentScouting:new Map(), scoutingPending:new Set(),
};
const NFL_WEEK_STATE=new Map(); // Scoring week -> ESPN NFL game states, no speculation about status.
const COLORS={QB:'#3875bc',RB:'#2c9764',WR:'#8a61bb',TE:'#d57939',K:'#d0a22b',DEF:'#bd5960','D/ST':'#bd5960','?':'#6b777f'};
const METRICS=[
  ['total','Fantasy points','pts','Fantasy league'],['avg','Fantasy pts / game','pts','Fantasy league'],['last','Latest week pts','pts','Fantasy league'],
  ['recent','Last 3 avg','pts','Fantasy league'],['best','Best game','pts','Fantasy league'],['low','Worst game','pts','Fantasy league'],
  ['std','Scoring std dev','pts','Calculated'],['games','Games reported','games','Fantasy league'],['projected','ESPN next/current projection','pts','ESPN (when available)'],
  ['owned','ESPN % rostered','%','ESPN (when available)'],['started','ESPN % started','%','ESPN (when available)'],
  ['pass_att','Passing attempts','att','ESPN box score / CSV'],['pass_cmp','Pass completions','cmp','ESPN box score / CSV'],['pass_yds','Passing yards','yds','ESPN box score / CSV'],['pass_td','Passing TD','TD','ESPN box score / CSV'],['int','Interceptions','INT','ESPN box score / CSV'],
  ['rush_att','Rush attempts','att','ESPN box score / CSV'],['rush_yds','Rushing yards','yds','ESPN box score / CSV'],['rush_td','Rushing TD','TD','ESPN box score / CSV'],
  ['receptions','Receptions','rec','ESPN box score / CSV'],['rec_yds','Receiving yards','yds','ESPN box score / CSV'],['rec_td','Receiving TD','TD','ESPN box score / CSV'],
  ['targets','Targets','tgt','ESPN box score / NFL data / CSV'],['yac','Yards after catch','yds','Imported advanced CSV'],['air_yards','Air yards','yds','Imported advanced CSV'],
  ['epa','Expected points added','EPA','Imported advanced CSV'],['passer_rating','Passer rating','rating','Imported advanced CSV'],
  ['target_share','Target share','%','Imported advanced CSV'],['snap_pct','Snap percentage','%','Imported advanced CSV'],
];
const META=Object.fromEntries(METRICS.map(([k,name,unit,source])=>[k,{name,unit,source}]));
// ESPN's football raw box score stat keys, as implemented in common ESPN fantasy adapters.
const ESPNSTAT={pass_att:'0',pass_cmp:'1',pass_yds:'3',pass_td:'4',int:'20',rush_att:'23',rush_yds:'24',rush_td:'25',receptions:'53',targets:'58',rec_yds:'42',rec_td:'43'};
// Only recorded raw ESPN statistics are eligible for addition; never infer an
// absent statline from fantasy points or replace missing values with zero.
const RAW_STATS_DISPLAY=[['pass_cmp','CMP'],['pass_att','ATT'],['pass_yds','PASS YDS'],['pass_td','PASS TD'],['int','INT'],['rush_att','CAR'],['rush_yds','RUSH YDS'],['rush_td','RUSH TD'],['receptions','REC'],['targets','TGT'],['rec_yds','REC YDS'],['rec_td','REC TD']];
function sumRecordedStatlines(entries,weeks){
 const sums={},seen=new Set();
 for(const entry of entries){
  const p=entry?.p||entry;if(!p)continue;
  for(const wk of weeks){
   const row=p.statlines?.[wk];if(!row)continue;
   const key=String(p.id)+'|'+wk;if(seen.has(key))continue;seen.add(key);
   for(const [metric,id] of Object.entries(ESPNSTAT)){
    const v=labNum(row[id]);if(v===null)continue;
    sums[metric]=(sums[metric]||0)+v;
   }
  }
 }
 return sums;
}
function formatRecordedTotals(entries,weeks){
 const sums=sumRecordedStatlines(entries,weeks);
 const text=RAW_STATS_DISPLAY.filter(([key])=>sums[key]!=null && (sums[key]!==0 || key==='targets')).map(([key,label])=>`${labFormat(sums[key],key.includes('yds')?1:0)} ${label}`).join(' · ');
 return text||'—';
}
function rawTotalCell(text){return `<span class="recorded-stat-total" title="${esc(text)}">${esc(text)}</span>`;}

const POS_ORDER=['QB','RB','WR','TE','K','DEF'];
const labNum=v=>v===undefined||v===null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const labSum=v=>v.reduce((a,b)=>a+(labNum(b)||0),0);
const labFormat=(v,d=1)=>labNum(v)===null?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const labPct=v=>labNum(v)===null?'—':`${labFormat(v,1)}%`;
const nameKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function sourceName(){return model.source==='demo'?'DEMONSTRATION — SYNTHETIC DATA':model.source==='espn'?'ESPN FANTASY / READ ONLY':model.source==='sleeper'?'SLEEPER FANTASY / READ ONLY':'LOCAL JSON / READ ONLY'}
const explorerTeam=()=>findTeam(XL.viewTeamId)||getTeam();
function getAllPlayers(){return Object.values(model.players||{}).filter(p=>p&&p.id&&p.name)}
function getPool(){const ids=new Set(model.teams.flatMap(t=>t.playerIds.map(String))),seen=new Set();return [...getAllPlayers(),...XL.free.filter(p=>!ids.has(String(p.id)))].filter(p=>{const key=String(p.id);if(seen.has(key))return false;seen.add(key);return true})}
function seriesFor(p){return Object.entries(p.scores||{}).map(([w,s])=>({week:Number(w),points:labNum(s)})).filter(x=>x.points!==null&&x.week>=1&&x.week<=18).sort((a,b)=>a.week-b.week)}
function summarize(p){const games=seriesFor(p),vals=games.map(g=>g.points),avg=vals.length?labSum(vals)/vals.length:null;return {games:vals.length,total:vals.length?labSum(vals):labNum(p.seasonTotal),avg,last:vals.at(-1)??null,recent:vals.length?labSum(vals.slice(-3))/Math.min(vals.length,3):null,best:vals.length?Math.max(...vals):null,low:vals.length?Math.min(...vals):null,std:vals.length>1?Math.sqrt(labSum(vals.map(v=>(v-avg)**2))/vals.length):null,projected:labNum(p.espnProj),owned:labNum(p.owned),started:labNum(p.started)}}
function playerRawStats(p){const res={};for(const [k,id] of Object.entries(ESPNSTAT)){
    const rows=Object.values(p.statlines||{}).filter(v=>v&&typeof v==='object');
    const vals=rows.map(v=>labNum(v[id])).filter(v=>v!==null);
    if(vals.length)res[k]=labSum(vals);
  }
  return res;
}
function advancedFor(p){return XL.advanced.get(nameKey(p.name))||{};}
function metricRow(p){return {...summarize(p),...playerRawStats(p),...advancedFor(p)};}
function metricValue(p,key){return labNum(metricRow(p)[key]);}
function teamForPlayer(p){return model.teams.find(t=>t.playerIds.some(id=>String(id)===String(p.id)))||null}
function playerColor(p){return COLORS[p.pos]||COLORS['?']}
function tag(text){return `<span class="lab-tag">${esc(text)}</span>`}
function metricsHTML(p){const stats=summarize(p),items=[['SEASON POINTS',stats.total,'acc-blue'],['WEEKLY AVERAGE',stats.avg,'acc-green'],['LATEST WEEK',stats.last,'acc-purple'],['RECENT / LAST 3',stats.recent,'acc-orange'],['BEST / WORST',stats.best===null?'—':`${labFormat(stats.best)} / ${labFormat(stats.low)}`,'acc-red'],['CONSISTENCY σ',stats.std,'acc-cyan']];return `<div class="lab-stats">${items.map(([title,value,cls])=>`<div class="lab-stat ${cls}"><small>${title}</small><b>${typeof value==='string'?esc(value):labFormat(value)}</b></div>`).join('')}</div>`}
// Compare one player to the *currently starting* players at the same position,
// regardless of whether the selected player is rostered, benched, or a free agent.
function startingPositionPeers(p){
 const normalize=pos=>pos==='D/ST'?'DEF':pos;
 const peers=new Map();
 for(const t of model.teams){
   const current=(t.currentLineup||[]).filter(e=>e.starter!==false&&![20,21].includes(Number(e.slot)));
   if(current.length){
     for(const e of current){const other=model.players[e.id];if(other&&normalize(other.pos)===normalize(p.pos))peers.set(String(other.id),other);}
   }else{
     // Historical providers: use the most recent lineup with starter flags.
     const h=(t.history||[]).slice().reverse().find(x=>Array.isArray(x.lineup)&&x.lineup.length);
     if(h)for(const e of h.lineup){if(e.starter===false||[20,21].includes(Number(e.slot)))continue;const other=model.players[e.id];if(other&&normalize(other.pos)===normalize(p.pos))peers.set(String(other.id),other);}
   }
 }
 return [...peers.values()];
}
const PLAYER_RANK_TITLES=['SEASON POINTS','WEEKLY AVERAGE','LATEST WEEK','RECENT / LAST 3','BEST / WORST','CONSISTENCY σ'];
function playerRankValue(p,i){const s=summarize(p);return [s.total,s.avg,s.last,s.recent,s.best,s.std][i]}
function playerRankingMetrics(p){
 const s=summarize(p),items=[s.total,s.avg,s.last,s.recent,s.best===null?'—':`${labFormat(s.best)} / ${labFormat(s.low)}`,s.std];
 return `<div class="player-rank-anchor"><div class="lab-stats player-ranked-stats">${items.map((value,i)=>`<button type="button" class="lab-stat acc-${['blue','green','purple','orange','red','cyan'][i]} player-rank-trigger" data-player-rank="${i}" aria-expanded="false" title="Compare this metric with league starters at ${esc(p.pos)}"><small>${PLAYER_RANK_TITLES[i]}</small><b>${typeof value==='string'?esc(value):labFormat(value)}</b></button>`).join('')}</div><div id="player-ranking-host" class="summary-ranking-host player-ranking-host" hidden></div></div>`;
}
function togglePlayerRanking(index){
 const host=el('player-ranking-host');if(!host)return;
 const trigger=el('explore-content').querySelector(`.player-rank-trigger[data-player-rank="${index}"]`);
 if(!host.hidden&&host.dataset.rank===String(index)){host.hidden=true;host.innerHTML='';host.dataset.rank='';}
 else{
  const selected=model.players[XL.player]||XL.free.find(x=>String(x.id)===String(XL.player));if(!selected)return;
  const peers=startingPositionPeers(selected),byId=new Map(peers.map(z=>[String(z.id),z]));byId.set(String(selected.id),selected);
  const sorted=[...byId.values()].map(z=>({p:z,v:playerRankValue(z,index)})).sort((a,b)=>a.v===null?1:b.v===null?-1:index===5?a.v-b.v:b.v-a.v);
  host.innerHTML=`<div class="summary-rank-head">${esc(selected.pos)} / ${esc(PLAYER_RANK_TITLES[index])}</div><div class="summary-rank-scroll"><table class="lab-table"><thead><tr><th>#</th><th>PLAYER</th><th>${esc(PLAYER_RANK_TITLES[index])}</th></tr></thead><tbody>${sorted.map(({p,v},i)=>`<tr data-ranking-player="${esc(String(p.id))}" tabindex="0" role="button" title="Open ${esc(p.name)} player terminal" class="${String(p.id)===String(selected.id)?'is-current':''}"><td>${String(i+1).padStart(2,'0')}</td><td title="${esc(p.name)}${String(p.id)===String(selected.id)&&!peers.some(z=>String(z.id)===String(selected.id))?' · selected player, not a starter':''}">${esc(p.name)}${String(p.id)===String(selected.id)&&!peers.some(z=>String(z.id)===String(selected.id))?' *':''}</td><td><b>${index===4?`${labFormat(summarize(p).best,1)} / ${labFormat(summarize(p).low,1)}`:labFormat(v,1)}</b></td></tr>`).join('')}</tbody></table></div>${!peers.length?'<div class="player-rank-note">No starters available for the current period. Showing selected player only.</div>':!peers.some(z=>String(z.id)===String(selected.id))?'<div class="player-rank-note">* Selected player compared with current starters.</div>':''}`;
  host.hidden=false;host.dataset.rank=String(index);host.dataset.side=index<3?'left':'right';
  const anchor=host.closest('.player-rank-anchor');if(trigger&&anchor){const r=trigger.getBoundingClientRect(),a=anchor.getBoundingClientRect();host.style.top=`${r.top-a.top}px`;host.style.minWidth=`${r.width}px`;if(index<3){host.style.left=`${r.left-a.left}px`;host.style.right='auto';}else{host.style.right=`${a.right-r.right}px`;host.style.left='auto';}}
 }
 el('explore-content').querySelectorAll('.player-rank-trigger').forEach(b=>b.setAttribute('aria-expanded',String(!host.hidden&&b.dataset.playerRank===host.dataset.rank)));
}
function expandTable(headers,rows,cls=''){return `<div class="lab-table-scroll"><table class="lab-table ${cls}"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}" class="empty-chart">DATA NOT SUPPLIED BY THIS PROVIDER</td></tr>`}</tbody></table></div>`}
function trendBars(items,colorFn=()=>COLORS.QB,maximum=null){
 const max=maximum||Math.max(1,...items.map(v=>Math.max(0,labNum(v.v)||0)));
 return `<div class="lab-histogram ${items.length>12?'dense-weeks':''}" style="--week-count:${items.length}">${items.map((v,i)=>`<div class="lab-hist-col" title="${esc(v.label)} · ${labFormat(v.v)}"><strong>${labFormat(v.v,0)}</strong><button type="button" class="lab-hist-bar ${v.week?'player-week-bar':''}" ${v.week?`data-player-week="${v.week}" aria-label="Open Week ${v.week} starter contributions"`: 'disabled'} style="height:${Math.max(2,(labNum(v.v)||0)/max*100)}%;background:${colorFn(v,i)}"></button><small>${esc(v.short??v.label)}</small></div>`).join('')}</div>`;
}
var graphResizeObserver=null,graphPaintFrame=null;
function setExplorer(html){if(graphPaintFrame!==null){cancelAnimationFrame(graphPaintFrame);graphPaintFrame=null;}if(typeof closeStatHelp==='function')closeStatHelp();graphResizeObserver?.disconnect();el('explore-content').innerHTML=html;el('explore-source').textContent=sourceName();}
function explorerClubHeader(type,playerId=null){
 const host=el('explore-club');if(!host)return;
 const id=String(explorerTeam().id);
 host.innerHTML=`<select id="explore-team-switch" aria-label="Choose active fantasy team">${model.teams.map(t=>`<option value="${esc(String(t.id))}" ${String(t.id)===id?'selected':''}>${esc(teamName(t))}</option>`).join('')}</select>`;
 host.title='Change active homepage franchise without leaving this report or player';
}

function openExplorer(type,arg=null,options={}){
 const dialog=el('explore-dialog');
 const entering=!dialog.open;
 if(entering){
   XL.viewTeamId=String(currentTeamId); // Home franchise is never altered by modal browsing.
   XL.lineupScenarios.clear();
   XL.history=[];XL.future=[];XL.viewWeek=null;
 }else if(!options.fromBack&&!options.fromForward){
   XL.history.push({type:XL.open,player:XL.player,week:XL.viewWeek,franchiseWeek:XL.franchiseWeek,focus:XL.focusTarget,team:XL.viewTeamId,positionWeek:XL.positionWeek,positionFocusPlayer:XL.positionFocusPlayer,positionComparisonView:XL.positionComparisonView,leagueComparisonView:XL.leagueComparisonView,strategyPeriod:typeof STRATEGY!=='undefined'?STRATEGY.period:null});
   XL.future=[];
 }
 if(options.teamId!==undefined)XL.viewTeamId=String(options.teamId);
 if(type==='summary'&&XL.franchiseWeekTeam!==String(XL.viewTeamId)){
   XL.franchiseWeekTeam=String(XL.viewTeamId);XL.franchiseWeek=null;
 }
 if(type==='summary'&&Object.hasOwn(options,'week'))XL.franchiseWeek=Number(options.week);
 if(type==='positions'&&!options.fromBack&&!options.fromForward){
   XL.positionWeek=Object.hasOwn(options,'week')?String(options.week):'all';
   XL.positionFocusPlayer=options.playerId==null?null:String(options.playerId);
 }
 if(type==='player-analytics'&&XL.open!=='player-analytics'){XL.playerLogRange='all';XL.playerArchiveAll=false;}
 if(type==='graph'&&XL.open!=='graph'&&!options.keepGraphStat)XL.graphStatFocus=null;
 XL.open=type;XL.focusTarget=options.focus||null;
 if(arg!==null){XL.player=arg;if(['outlook','opportunity'].includes(type)&&typeof STRATEGY!=='undefined')STRATEGY.player=arg;}
 if(Object.hasOwn(options,'week'))XL.viewWeek=Number(options.week);
 else if(type==='matchup'&&entering)XL.viewWeek=Number(currentWeek);
 const names={outlook:'PLAYER OUTLOOK / MATCHUP & PROJECTIONS',opportunity:'TOUCHES & SHARE / OPPORTUNITY DATA',trade:'TRADE CALCULATOR / ROSTER IMPACT',summary:'CLUB OVERVIEW / FULL REPORT',weekly:'WEEKLY PRODUCTION / SCORING LAB',standings:'LEAGUE TABLE / ADVANCED STANDINGS',positions:'POSITION ALLOCATION / USAGE',matchup:'MATCHUP CENTER / LIVE & HISTORIC SCORES',profile:'PLAYER TERMINAL / GAME LOG',roster:'PERSONNEL REGISTER / COMPLETE ROSTER',agents:'FREE AGENT WIRE / SCOUTING',graph:'VARIABLE LAB / MULTIVARIATE GRAPHER','position-compare':'ROSTERED PLAYERS / POSITION COMPARISON','league-contributions':'LEAGUE / WEEKLY POSITION CONTRIBUTIONS','player-analytics':'PLAYER STATISTICAL ARCHIVE / COMPLETE GAME LOG'};
 el('explore-title').textContent=names[type]||'PLAYER DOSSIER';
 el('explore-context').textContent=`${model.season} SEASON`;
 const profileOwner=type==='profile'?(model.players[arg||XL.player]||XL.free.find(p=>String(p.id)===String(arg||XL.player))):null;
 explorerClubHeader(type,arg||XL.player);
 el('explore-back').title=XL.history.length?'Previous expanded window':'No previous expanded window';
 el('explore-back').disabled=!XL.history.length;
 el('explore-forward').disabled=!XL.future.length;
 if(el('explore-jump'))el('explore-jump').value=type;
 renderExplorer();if(entering){if(document.body.dataset.layout==='tabbed')dialog.show();else dialog.showModal();}document.dispatchEvent(new CustomEvent('workspace:opened',{detail:{type}}));dialog.scrollTop=0;el('explore-content').scrollTop=0;el('explore-content').style.paddingBottom='';
 if(XL.focusTarget==='weekly-ledger')focusWeeklyLedger();
 if(XL.focusTarget==='franchise-lineup')focusFranchiseLineup();
 if(XL.focusTarget==='position-contributions')focusPositionContributions();
 if(XL.focusTarget==='player-editorial')requestAnimationFrame(()=>{const content=el('explore-content');if(content)content.scrollTop=content.scrollHeight-content.clientHeight;});
}
function focusWeeklyLedger(){requestAnimationFrame(()=>focusExplorerSection('weekly-full-ledger'));}
function focusFranchiseLineup(){requestAnimationFrame(()=>focusExplorerSection('franchise-lineup-anchor'));}
function focusPositionContributions(){requestAnimationFrame(()=>focusExplorerSection('starter-contributions-panel'));}
function openPlayerPositionContributions(playerId,week){
 const p=model.players[String(playerId)]||XL.free.find(z=>String(z.id)===String(playerId));
 const t=p?teamForPlayer(p):null;
 openExplorer('summary',null,{teamId:String(t?.id??XL.viewTeamId??currentTeamId),week:Number(week),focus:'franchise-lineup'});
}

function exploreBack(){
 const previous=XL.history.pop();if(!previous)return;
 XL.future.push({type:XL.open,player:XL.player,week:XL.viewWeek,franchiseWeek:XL.franchiseWeek,focus:XL.focusTarget,team:XL.viewTeamId,positionWeek:XL.positionWeek,positionFocusPlayer:XL.positionFocusPlayer,positionComparisonView:XL.positionComparisonView,leagueComparisonView:XL.leagueComparisonView,strategyPeriod:typeof STRATEGY!=='undefined'?STRATEGY.period:null});
 XL.viewTeamId=previous.team;XL.viewWeek=previous.week;XL.franchiseWeek=previous.franchiseWeek;XL.player=previous.player;if(typeof STRATEGY!=='undefined'){STRATEGY.player=XL.player;if(previous.strategyPeriod)STRATEGY.period=previous.strategyPeriod;}XL.positionWeek=previous.positionWeek||'all';XL.positionFocusPlayer=previous.positionFocusPlayer||null;XL.positionComparisonView=previous.positionComparisonView||'position';XL.leagueComparisonView=previous.leagueComparisonView||'week';
 openExplorer(previous.type,previous.player,{fromBack:true,focus:previous.focus,...(previous.type==='summary'&&Number.isFinite(previous.franchiseWeek)?{week:previous.franchiseWeek}:{})});
}
function exploreForward(){
 const next=XL.future.pop();if(!next)return;
 XL.history.push({type:XL.open,player:XL.player,week:XL.viewWeek,franchiseWeek:XL.franchiseWeek,focus:XL.focusTarget,team:XL.viewTeamId,positionWeek:XL.positionWeek,positionFocusPlayer:XL.positionFocusPlayer,positionComparisonView:XL.positionComparisonView,leagueComparisonView:XL.leagueComparisonView,strategyPeriod:typeof STRATEGY!=='undefined'?STRATEGY.period:null});
 XL.viewTeamId=next.team;XL.viewWeek=next.week;XL.franchiseWeek=next.franchiseWeek;XL.player=next.player;if(typeof STRATEGY!=='undefined'){STRATEGY.player=XL.player;if(next.strategyPeriod)STRATEGY.period=next.strategyPeriod;}XL.positionWeek=next.positionWeek||'all';XL.positionFocusPlayer=next.positionFocusPlayer||null;XL.positionComparisonView=next.positionComparisonView||'position';XL.leagueComparisonView=next.leagueComparisonView||'week';
 openExplorer(next.type,next.player,{fromForward:true,focus:next.focus,...(next.type==='summary'&&Number.isFinite(next.franchiseWeek)?{week:next.franchiseWeek}:{})});
}
function refreshMatchupHeader(){
 // The week picker belongs to the heading, not the dark window chrome.
 const head=el('explore-match-week');
 if(head){head.hidden=true;head.replaceChildren();}
}

function renderExplorer(){if(!XL.open)return;const type=XL.open;refreshMatchupHeader();
  el('explore-content').classList.remove('weekly-register-focused');
  if(typeof renderStrategy==='function'&&['outlook','opportunity','trade'].includes(type))return renderStrategy(type);
  if(type==='summary')return detailSummary();if(type==='weekly')return detailWeekly();if(type==='standings')return detailStandings();
  if(type==='player-analytics')return detailPlayerAnalytics(XL.player||currentPlayerId);if(type==='positions')return detailPositions();if(type==='position-compare')return detailPositionComparison();if(type==='league-contributions')return detailLeagueContributions();if(type==='matchup')return detailMatchup();if(type==='profile')return detailPlayer(XL.player||currentPlayerId);if(type==='roster')return detailRoster();if(type==='agents')return detailAgents();if(type==='graph')return detailGraph();
}
function heading(title,desc){return `<div class="lab-intro"><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`}
function record(team){return `${team.wins}–${team.losses}${team.ties?`–${team.ties}`:''}`}
// This week's starting roster is sourced from the same weekly lineup data used
// by the Matchup Center. Missing current-week box scores are disclosed, not guessed.
// An isolated, read-only lineup scenario. No ESPN roster writes are ever made.
function lineupKey(team,week){return `${model.leagueId||model.league}:${team.id}:${week}`;}
function whatIfFor(team,week){
 const key=lineupKey(team,week);
 if(!XL.lineupScenarios.has(key))XL.lineupScenarios.set(key,{key,swaps:{},picker:null});
 return XL.lineupScenarios.get(key);
}
function eligibleBench(slot,pos,originalPos){
 const p=pos==='D/ST'?'DEF':pos;
 if(slot===null||slot===undefined)return p===(originalPos==='D/ST'?'DEF':originalPos);
 const k=Number(slot);
 if([23,24,3,5].includes(k))return ['RB','WR','TE'].includes(p);
 const bySlot={0:'QB',2:'RB',4:'WR',6:'TE',16:'DEF',17:'K'};
 return bySlot[k]===p;
}
// Shared lineup state and totals: Franchise Report and Matchup Center always
// show the same read-only what-if scenario for the same team and week.
function weeklyLineupData(t,wanted){
 const activeWeek=Number(model.currentWeek||model.liveWeek||t.currentMatchup?.week||currentWeek||wanted);
 const liveMatch=Number(t.currentMatchup?.week)===wanted?t.currentMatchup:null;
 const weekHistory=(t.history||[]).find(h=>Number(h.week)===wanted);
 const hasWeekEntries=!!(weekHistory?.lineup?.length||Object.keys(weekHistory?.starters||{}).length);
 const liveRoster=wanted===activeWeek?(t.currentLineup||[]):[];
 const chosen=hasWeekEntries?weekHistory:liveRoster.length?{week:wanted,points:weekHistory?.points??liveMatch?.points??null,lineup:liveRoster,starters:{}}:weekHistory||null;
 const data=sideLineup({...t,history:chosen?[chosen]:[]},wanted);
 const entries=[...data.items];
 if(wanted===activeWeek){
   const known=new Set(entries.map(e=>String(e.id)));
   for(const id of t.playerIds||[]){
     if(known.has(String(id))||!model.players[id])continue;
     entries.push({id:String(id),p:model.players[id],slot:20,starter:false,points:model.players[id].scores?.[wanted]??null,projected:model.players[id].projections?.[wanted]??model.players[id].espnProj??null});
   }
 }
 const originalStarters=entries.filter(e=>e.starter),scenario=whatIfFor(t,wanted),entryById=new Map(entries.map(e=>[String(e.id),e]));
 const starters=originalStarters.map(original=>{
   const candidate=entryById.get(String(scenario.swaps[String(original.id)]));
   const e=candidate||original;
   return {...e,slot:original.slot,starter:true,originalId:String(original.id),isSub:!!candidate};
 });
 const assigned=new Set(starters.map(e=>String(e.id)));
 const bench=entries.filter(e=>!assigned.has(String(e.id))).map(e=>({...e,starter:false}));
 const changes=starters.filter(e=>e.isSub).length;
 const scoreFor=e=>labNum(e.points??e.p?.scores?.[wanted]);
 const projFor=e=>labNum(e.projected??e.p?.projections?.[wanted]??(wanted===activeWeek?e.p?.espnProj:null));
 const actualValues=starters.map(scoreFor).filter(v=>v!==null);
 const projectionValues=starters.map(projFor).filter(v=>v!==null);
 const computedActual=actualValues.length?labSum(actualValues):null;
 const computedProjection=projectionValues.length?labSum(projectionValues):null;
 const official=labNum(weekHistory?.points??(wanted===activeWeek?liveMatch?.points:null));
 const origActual=originalStarters.map(scoreFor).filter(v=>v!==null);
 const completeOrig=originalStarters.length>0&&origActual.length===originalStarters.length;
 // Official ESPN total is authoritative. A complete original starter sum is a
 // clearly-marked fallback, NOT the temporary what-if total.
 const officialDisplay=official??(completeOrig?labSum(origActual):null);
 const displayedTotal=changes?computedActual:official??computedActual;
 const completeActual=starters.length>0&&actualValues.length===starters.length;
 const completeProj=starters.length>0&&projectionValues.length===starters.length;
 const reliableActual=changes?completeActual:(official!==null||completeActual);
 const diff=displayedTotal!==null&&computedProjection!==null&&completeProj&&reliableActual?displayedTotal-computedProjection:null;
 return {team:t,week:wanted,activeWeek,weekHistory,originalStarters,starters,bench,scenario,changes,scoreFor,projFor,computedActual,computedProjection,official,officialDisplay,completeOrig,displayedTotal,completeActual,completeProj,diff};
}
function lineupPickerButton(data,e,asBench=false){
 const {scenario,originalStarters,bench,projFor}=data;
 const p=e.p;
 if(asBench&&Number(e.slot)===21)return '<span class="franchise-slot">IR</span>';
 const origin=String(e.originalId||e.id);
 const pos=asBench?'BENCH':(e.slot===null?p.pos:slotName(e.slot));
 const pickerKey=(asBench?'bench:':'starter:')+origin;
 const open=scenario.picker===pickerKey;
 let choices=[];
 if(asBench){
   choices=originalStarters.filter(x=>eligibleBench(x.slot,p.pos,x.p.pos)).map(x=>({origin:String(x.id),bench:String(e.id),title:`${slotName(x.slot)} · ${x.p.name}`,proj:projFor(e)}));
 }else{
   choices=bench.filter(x=>Number(x.slot)!==21&&eligibleBench(e.slot,x.p.pos,e.p.pos)).map(x=>({origin,bench:String(x.id),title:x.p.name,proj:projFor(x)}));
 }
 const title=asBench?'Choose a starting position for this bench player':`Try a bench replacement for ${pos}`;
 const button=`<button type="button" class="franchise-slot franchise-slot-button ${e.isSub?'slot-is-sub':''}" data-lineup-picker="${esc(pickerKey)}" aria-expanded="${open}" title="${esc(title)}">${esc(pos)}</button>`;
 const restore=!asBench&&e.isSub?`<button type="button" data-sub-origin="${esc(origin)}" data-sub-bench="${esc(origin)}" class="franchise-sub-option">RESTORE ORIGINAL <small>↺</small></button>`:'';
 const popup=open?`<div class="franchise-sub-menu" role="group" aria-label="What-if lineup replacements"><div class="franchise-sub-heading">${asBench?'SUB INTO WHICH SLOT?':'REPLACE WITH BENCH PLAYER'}</div>${restore}${choices.map(c=>`<button type="button" class="franchise-sub-option" data-sub-origin="${esc(c.origin)}" data-sub-bench="${esc(c.bench)}"><span>${esc(c.title)}</span><small>${labFormat(c.proj,1)} PROJ</small></button>`).join('')||'<div class="franchise-sub-empty">NO ELIGIBLE SLOTS</div>'}</div>`:'';
 return button+popup;
}
function matchupProgress(data){
 const events=NFL_WEEK_STATE.get(data.week);
 if(!events||!data.starters.length)return {live:null,pending:null};
 let live=0,pending=0,known=0;
 for(const e of data.starters){
  const team=String(e.p?.nfl||'').toUpperCase();
  const state=events[team];
  if(state==='in'){live++;known++;}
  else if(state==='pre'){pending++;known++;}
  else if(state==='post')known++;
 }
 return known===data.starters.length?{live,pending}:{live:null,pending:null};
}
function progressLabel(data){
 const progress=matchupProgress(data);
 return `IN PLAY ${progress.live===null?'—':progress.live} · YET TO PLAY ${progress.pending===null?'—':progress.pending}`;
}
async function fetchNFLWeekState(week){
 const current=Number(model.currentWeek||model.liveWeek||currentWeek);
 if(week!==current||NFL_WEEK_STATE.has(week)||model.source==='demo')return;
 NFL_WEEK_STATE.set(week,null);
 try{
  const url='/api/nfl/game-status?season='+encodeURIComponent(model.season)+'&week='+encodeURIComponent(week);
  const resp=await fetch(url,{credentials:'same-origin'});
  if(!resp.ok)throw Error('NFL games unavailable');
  const payload=await resp.json();
  NFL_WEEK_STATE.set(week,payload.teams||null);
  if(XL.open==='matchup'&&Number(XL.viewWeek)===week){
   // Update only progress labels; never clear user substitutions or scroll position.
   for(const tag of el('explore-content').querySelectorAll('[data-matchup-progress]')){
    const t=findTeam(tag.dataset.matchupProgress);
    if(t)tag.textContent=progressLabel(weeklyLineupData(t,week));
   }
  }
 }catch{NFL_WEEK_STATE.set(week,null);}
}
function focusExplorerSection(targetId){
 const container=el('explore-content'),target=document.getElementById(targetId);
 if(!container||!target)return;
 // Scroll only the expanded window, not the homepage. Other sections remain above.
 const box=target.getBoundingClientRect(),parent=container.getBoundingClientRect();
 if(document.body.dataset.layout==='tabbed'){target.scrollIntoView({block:'start',behavior:'auto'});return;}
 const desired=Math.max(0,container.scrollTop+box.top-parent.top-8);
 const available=container.scrollHeight-container.clientHeight;
 // Short weekly tables need temporary scroll runway so the linked section can
 // reach the top. The padding is cleared on the next expanded navigation.
 if(desired>available)container.style.paddingBottom=(Math.ceil(desired-available)+16)+'px';
 container.scrollTop=desired;
}
function lineupReset(data){return data.changes?`<button class="franchise-reset" type="button" data-reset-lineup>↺ RESET ${data.changes} SUB${data.changes===1?'':'S'}</button>`:'';}
function franchiseWeekLineup(t){
 const wanted=Number(XL.franchiseWeek??model.currentWeek??model.liveWeek??currentWeek??t.history.at(-1)?.week??1);
 const data=weeklyLineupData(t,wanted),{starters,bench,scoreFor,projFor}=data;
 const weeks=[...new Set([...(model.weeks||[]),...(t.history||[]).map(h=>Number(h.week)),data.activeWeek].map(Number).filter(x=>Number.isFinite(x)&&x>=1&&x<=18))].sort((a,b)=>a-b);
 const line=e=>{
   const p=e.p,points=scoreFor(e),projected=projFor(e),delta=points!==null&&projected!==null?points-projected:null;
   return `<tr class="franchise-player-row ${e.isSub?'franchise-substituted':''}" data-open-player="${esc(String(e.id))}" tabindex="0" role="button" aria-label="Open ${esc(p.name)} dossier"><td class="franchise-slot-cell">${lineupPickerButton(data,e,!e.starter)}</td><td class="franchise-person"><strong>${esc(p.name)}</strong></td><td>${esc(p.nfl)}</td><td class="franchise-status">${esc(p.status||'—')}</td><td class="franchise-number">${labFormat(projected,2)}</td><td class="franchise-number"><b>${labFormat(points,2)}</b></td><td class="franchise-number ${delta===null?'':delta>=0?'positive-text':'negative-text'}">${delta===null?'—':`${delta>0?'+':''}${labFormat(delta,2)}`}</td><td class="franchise-statline" title="${esc(describeStatline(p,wanted))}">${esc(describeStatline(p,wanted))}</td></tr>`;
 };
 const diff=data.diff;
 // Numeric totals use the SAME table columns (5/6/7) as player values.
 const recordedTotal=formatRecordedTotals(starters,[wanted]);
 const summary=`<tr class="franchise-totals-row"><td colspan="4" class="franchise-totals-label"><b>${data.changes?'WHAT-IF':'STARTERS'} · ${starters.length} LISTED</b>${data.changes&&!data.completeActual?' <small>PARTIAL</small>':''}</td><td class="franchise-number"><b>${labFormat(data.computedProjection,2)}</b></td><td class="franchise-number"><b>${labFormat(data.displayedTotal,2)}</b></td><td class="franchise-number ${diff===null?'':diff>=0?'positive-text':'negative-text'}"><b>${diff===null?'—':`${diff>0?'+':''}${labFormat(diff,2)}`}</b></td><td class="franchise-totals-actions">${rawTotalCell(recordedTotal)}${lineupReset(data)}</td></tr>`;
 return `<section id="franchise-lineup-anchor" class="lab-panel franchise-week-panel" data-lineup-team="${esc(String(t.id))}" data-lineup-week="${wanted}">
 <div class="franchise-week-title"><h4 data-open-roster tabindex="0" role="button" aria-label="Open complete Personnel Register" title="Open Personnel Register">Week <select id="franchise-lineup-week" class="franchise-week-picker" aria-label="Select starting lineup week">${weeks.map(w=>`<option value="${w}" ${w===wanted?'selected':''}>${String(w).padStart(2,'0')}</option>`).join('')}</select> / Starting Lineup</h4><div class="franchise-week-title-right"><strong class="franchise-week-top-score" title="${data.changes?'Simulated what-if scoring':'Official reported fantasy points where available'}">${labFormat(data.displayedTotal,2)} <small>PTS${data.changes?' / WHAT-IF':''}</small></strong><span class="franchise-week-badge">${wanted===data.activeWeek?'CURRENT WEEK':'HISTORICAL WEEK'}</span></div></div>
 <div class="franchise-week-scroll"><table class="franchise-week-table"><thead><tr><th>SLOT</th><th>PLAYER</th><th>NFL</th><th>STATUS</th><th>PROJ</th><th>FPTS</th><th>+/− PROJ</th><th>RECORDED NFL STATLINE</th></tr></thead><tbody>
 ${starters.map(line).join('')||'<tr><td colspan="8" class="franchise-empty">ESPN has not supplied a lineup for this week.</td></tr>'}
 ${summary}
 ${bench.length?'<tr class="franchise-subhead"><td colspan="8">BENCH / RESERVES</td></tr>':''}${bench.map(line).join('')}
 </tbody></table></div>
 <div class="franchise-lineup-footer" aria-label="Starting lineup scoring totals"><span><b>STARTING TOTAL</b> · ${starters.length} players</span><span>PROJ <b>${labFormat(data.computedProjection,2)}</b></span><span>OFFICIAL <b>${labFormat(data.officialDisplay,2)}</b></span>${data.changes?`<span class="simulated-total">WHAT-IF <b>${labFormat(data.displayedTotal,2)}</b>${!data.completeActual?' · PARTIAL':''}</span>`:''}<span class="franchise-stat-footer" title="Recorded starting-lineup NFL statistics">NFL STATS <b>${esc(recordedTotal)}</b></span><span>+/− <b>${data.diff===null?'—':(data.diff>0?'+':'')+labFormat(data.diff,2)}</b></span></div>
 <p class="lab-note">Choose any starter slot or bench slot to simulate a different eligible lineup. These are read-only what-if totals; ESPN is never modified.${data.changes?' Modified scores are based on the available player results.':''} Unreported scores display —, not zero.${data.official===null&&data.computedActual!==null&&!data.completeActual?' Current starter scoring is incomplete.':''}</p></section>`;
}
function refreshFranchiseLineup(){
 const existing=el('explore-content').querySelector('.franchise-week-panel');if(!existing)return;
 const view=el('explore-content'),scroll=view.scrollTop;
 const template=document.createElement('template');template.innerHTML=franchiseWeekLineup(explorerTeam()).trim();
 existing.replaceWith(template.content.firstElementChild);view.scrollTop=scroll;
}
function refreshLineupView(){
 const content=el('explore-content'),scroll=content.scrollTop;
 if(XL.open==='summary')refreshFranchiseLineup();
 else if(XL.open==='matchup'){detailMatchup();content.scrollTop=scroll;}
}
function detailSummary(){
 const t=explorerTeam(),s=getStats(t),points=t.history.map(h=>labNum(h.points)).filter(v=>v!==null);
 const mean=points.length?labSum(points)/points.length:0;
 const sd=points.length?Math.sqrt(labSum(points.map(v=>(v-mean)**2))/points.length):null;
 const leaguePts=labSum(model.teams.map(z=>getStats(z).pts))/Math.max(1,model.teams.length);
 const recentWeek=Number(model.currentWeek||model.liveWeek||currentWeek||0);
 const ledgerWeeks=[...(t.history||[])];
 if(recentWeek>0&&!ledgerWeeks.some(h=>Number(h.week)===recentWeek)){
   const live=t.currentMatchup;
   if(Number(live?.week)===recentWeek)ledgerWeeks.push({...live});
 }
 ledgerWeeks.sort((a,b)=>Number(a.week)-Number(b.week));
 const items=ledgerWeeks.map(h=>{
   const week=Number(h.week),op=findTeam(h.opponentId);
   const currentData=week===recentWeek?weeklyLineupData(t,week):null;
   const ourScore=currentData?.officialDisplay??labNum(h.points)??currentData?.computedActual??null;
   const theirData=op&&week===recentWeek?weeklyLineupData(op,week):null;
   const oppScore=theirData?.officialDisplay??labNum(h.oppPoints)??theirData?.computedActual??null;
   const margin=ourScore!==null&&oppScore!==null?ourScore-oppScore:null;
   const scores=model.teams.map(tm=>{
     const th=(tm.history||[]).find(z=>Number(z.week)===week);
     const fromHistory=labNum(th?.points);
     if(week!==recentWeek)return fromHistory;
     const live=tm.currentMatchup;
     const score=weeklyLineupData(tm,week);
     return score.officialDisplay??fromHistory??(Number(live?.week)===week?labNum(live.points):null)??score.computedActual??null;
   }).filter(v=>v!==null);
   const leagueAvg=scores.length?labSum(scores)/scores.length:null;
   const ranking=ourScore===null?'—':`${String(1+scores.filter(v=>v>ourScore).length).padStart(2,'0')}/${String(scores.length).padStart(2,'0')}`;
   return `<tr data-open-match="${week}" data-ledger-week="${week}" tabindex="0" role="button" title="Open Week ${week} Matchup Center" aria-label="Open Week ${week} Matchup Center"><td>W${String(week).padStart(2,'0')}</td><td title="${esc(op?teamName(op):'Opponent unavailable')}" class="ledger-opponent-cell">${esc(op?teamName(op):'—')}</td><td class="num">${labFormat(ourScore,1)}</td><td class="num">${labFormat(oppScore,1)}</td><td class="num ${margin===null?'':margin>=0?'positive-text':'negative-text'}">${margin===null?'—':(margin>0?'+':'')+labFormat(margin,1)}</td><td class="num">${labFormat(leagueAvg,1)}</td><td class="num">${esc(ranking)}</td></tr>`;
 });
 setExplorer(heading('Franchise performance report','This week’s individual scoring, league-relative performance, and season matchup history. All values come from the connected league.')+
 `<div class="summary-rank-anchor"><div class="lab-stats summary-ranked-stats">${[['TOTAL POINTS',s.pts],['PER WEEK',s.avg],['VS LEAGUE AVG',s.pts-leaguePts],['PTS ALLOWED',t.history.some(x=>x.oppPoints!=null)?s.against:null],['SCORING σ',sd],['LEAGUE POSITION',ranked().findIndex(x=>x.id===t.id)+1]].map(([a,b],i)=>`<button type="button" class="lab-stat acc-${['blue','green','purple','red','orange','cyan'][i]} summary-rank-trigger" data-summary-rank="${i}" aria-expanded="false" aria-label="Show league ranking for ${esc(a)}"><small>${esc(a)}</small><b>${labFormat(b,i===5?0:1)}</b></button>`).join('')}</div>`+
 `<div class="summary-ranking-host" id="summary-ranking-host" hidden></div></div>`+
 `<div class="summary-report-grid"><section class="lab-panel summary-ledger-panel" data-open-weekly-table tabindex="0" role="button" aria-label="Open the full week-by-week scoring register in Weekly Production"><div class="summary-ledger-header"><h4>MATCHUP LEDGER</h4><span>OPEN FULL WEEKLY REGISTER ↗</span></div><table class="summary-ledger-table"><colgroup><col class="wk"><col class="op"><col class="numeric"><col class="numeric"><col class="numeric"><col class="numeric"><col class="rank"></colgroup><thead><tr><th>WK</th><th>OPPONENT</th><th>PTS</th><th>OPP</th><th>MARGIN</th><th>LG AVG</th><th>WK RANK</th></tr></thead><tbody>${items.join('')||'<tr><td colspan="7" class="empty-chart">No recorded matchups.</td></tr>'}</tbody></table><p class="lab-note">Click an opponent’s ribbon to open that week’s Matchup Center, or elsewhere to open the full weekly scoring register.</p></section>`+
 `<section class="lab-panel summary-record-panel"><h4>RECORD AND PERFORMANCE</h4><div class="lab-definition"><span>Head-to-head</span><b>${record(t)}</b><span>League standing</span><b>${String(ranked().findIndex(x=>x.id===t.id)+1).padStart(2,'0')}/${String(model.teams.length).padStart(2,'0')}</b><span>Best week</span><b>${s.high?'W'+s.high.week+' · '+labFormat(s.high.points):'—'}</b><span>Point differential</span><b>${t.history.some(x=>x.oppPoints!=null)?labFormat(s.pts-s.against):'—'}</b><span>Reported weeks</span><b>${t.history.length}</b><span>Scoring volatility (σ)</span><b>${labFormat(sd,1)}</b></div></section></div>`+
 franchiseWeekLineup(t));
}

function toggleSummaryRanking(index){
 const host=el('summary-ranking-host');if(!host)return;
 const active=host.dataset.rank;
 if(!host.hidden&&active===String(index)){host.hidden=true;host.innerHTML='';host.dataset.rank='';}
 else {
  const label=['TOTAL POINTS','PER WEEK','VS LEAGUE AVG','PTS ALLOWED','SCORING σ','LEAGUE POSITION'][index];
  const score=z=>{const st=getStats(z),history=z.history||[],pts=history.map(h=>labNum(h.points)).filter(v=>v!==null);
    const mean=pts.length?labSum(pts)/pts.length:0;
    const leaguePts=labSum(model.teams.map(x=>getStats(x).pts))/Math.max(1,model.teams.length);
    return [st.pts,st.avg,st.pts-leaguePts,history.some(h=>h.oppPoints!=null)?st.against:null,
      pts.length?Math.sqrt(labSum(pts.map(v=>(v-mean)**2))/pts.length):null,
      ranked().findIndex(x=>x.id===z.id)+1][index];};
  const rows=model.teams.map(t=>({t,value:score(t)})).sort((a,b)=>{
    if(a.value===null)return 1;if(b.value===null)return -1;
    return index===3||index===4||index===5?a.value-b.value:b.value-a.value;
  });
  host.innerHTML=`<div class="summary-rank-head"><span>${esc(label)} / LEAGUE RANKINGS</span></div>
    <div class="summary-rank-scroll"><table class="lab-table"><thead><tr><th>#</th><th>FRANCHISE</th><th>${esc(label)}</th></tr></thead><tbody>${rows.map(({t,value},i)=>`<tr data-ranking-team="${esc(String(t.id))}" tabindex="0" role="button" title="Open ${esc(teamName(t))} Club Overview" class="${String(t.id)===String(explorerTeam().id)?'is-current':''}"><td>${String(i+1).padStart(2,'0')}</td><td>${esc(teamName(t))}</td><td><b>${labFormat(value,index===5?0:2)}</b></td></tr>`).join('')}</tbody></table></div>`;
  host.hidden=false;host.dataset.rank=String(index);host.dataset.side=index<3?'left':'right';
  const trigger=document.querySelector(`.summary-rank-trigger[data-summary-rank="${index}"]`);
  const anchor=document.querySelector('.summary-rank-anchor');
  if(trigger&&anchor){
    const r=trigger.getBoundingClientRect(), a=anchor.getBoundingClientRect();
    host.style.top=`${r.top-a.top}px`;host.style.minWidth=`${r.width}px`;
    if(index<3){host.style.left=`${r.left-a.left}px`;host.style.right='auto';}
    else {host.style.right=`${a.right-r.right}px`;host.style.left='auto';}
  }
 }
 document.querySelectorAll('.summary-rank-trigger').forEach(btn=>btn.setAttribute('aria-expanded',String(!host.hidden&&btn.dataset.summaryRank===host.dataset.rank)));
}
// WEEKLY PRODUCTION — COMPARISON LAB
// State is scoped to the current league and active franchise. We intentionally do
// not synthesize unreported weeks as zero: absent scores break line segments.
const WEEKLY_PALETTE=['#487ebb','#b85864','#42966d','#9462b4','#ca8c44','#3d9ca3','#bd647e','#7576b6','#769350','#aa784a','#5f8999','#996a8f'];
const WEEKLY_COLORS={line:'#273742',league:'#8d57b7',mean:'#c67736'};
XL.weekly={baseTeam:null,baseModel:null,compare:[],lines:['active'],showBars:true,showLines:true,showPoints:true,showNames:false,showLeague:true,showMean:true};
function weeklySettings(){
 const state=XL.weekly;
 if(state.baseTeam!==String(explorerTeam().id)||state.baseModel!==model){
   state.baseTeam=String(explorerTeam().id);state.baseModel=model;
   state.compare=[];state.lines=['active'];
   state.showBars=true;state.showLines=true;state.showPoints=true;state.showNames=false;
 }
 state.compare=state.compare.filter(id=>String(id)!==String(explorerTeam().id)&&!!findTeam(id));
 state.lines=state.lines.filter(id=>id==='active'||!!findTeam(id)).filter((id,i,arr)=>arr.indexOf(id)===i).slice(0,10);
 return state;
}
function weeklyTeam(id){return id==='active'?explorerTeam():findTeam(id)}
function weeklyShortName(team){
 const name=teamName(team);
 const initials=name.split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,4).toUpperCase();
 return initials||name.slice(0,4).toUpperCase();
}
function weeklyColor(id){
 if(String(id)===String(explorerTeam().id))return WEEKLY_PALETTE[0];
 const index=model.teams.findIndex(t=>String(t.id)===String(id));
 return WEEKLY_PALETTE[(index% (WEEKLY_PALETTE.length-1)+WEEKLY_PALETTE.length-1)%(WEEKLY_PALETTE.length-1)+1];
}
function weeklyScore(team,week){const h=team?.history.find(x=>Number(x.week)===Number(week));return h?labNum(h.points):null;}
function weeklyLeagueAvg(week){
 const scores=model.teams.map(t=>weeklyScore(t,week)).filter(v=>v!==null);
 return scores.length?labSum(scores)/scores.length:null;
}
function weeklyRank(week,score){
 const vals=model.teams.map(t=>weeklyScore(t,week)).filter(v=>v!==null);
 if(score===null||!vals.length)return '—';
 return `${1+vals.filter(v=>v>score).length} / ${vals.length}`;
}
function weeklyLinePath(weeks,values,xAt,yAt){
 let paths=[],part=[];
 weeks.forEach((w,i)=>{
   const v=values[i];
   if(v===null){if(part.length)paths.push(part.join(' '));part=[];return;}
   part.push(`${part.length?'L':'M'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`);
 });
 if(part.length)paths.push(part.join(' '));
 return paths;
}
function weeklyComparativeChart(){
 const state=weeklySettings();
 const barTeams=state.showBars?[explorerTeam(),...state.compare.map(findTeam).filter(Boolean)]:[];
 const rainbowBars=!state.compare.length&&!state.lines.some(id=>id!=='active');
 const lineTeams=state.showLines?state.lines.map(weeklyTeam).filter(Boolean):[];
 const relevant=[...barTeams,...lineTeams,explorerTeam()];
 const weeks=[...new Set(relevant.flatMap(t=>(t.history||[]).map(h=>Number(h.week))))].filter(w=>w>=1).sort((a,b)=>a-b);
 if(!weeks.length)return '<div class="empty-chart">NO WEEKLY SCORING HISTORY AVAILABLE</div>';
 const leagueValues=weeks.map(weeklyLeagueAvg);
 const ownScores=explorerTeam().history.map(h=>labNum(h.points)).filter(v=>v!==null);
 const seasonMean=ownScores.length?labSum(ownScores)/ownScores.length:null;
 const values=[...barTeams.flatMap(t=>weeks.map(w=>weeklyScore(t,w))),...lineTeams.flatMap(t=>weeks.map(w=>weeklyScore(t,w))),...(state.showLeague?leagueValues:[]),...(state.showMean?[seasonMean]:[])].filter(v=>v!==null);
 const lower=Math.min(0,...values),upper=Math.max(1,...values),unit=20;
 const domainLow=Math.min(0,Math.floor(lower/unit)*unit),domainHigh=Math.max(unit,Math.ceil((upper+7)/unit)*unit);
 const plotH=190,left=53,top=26,right=25,bottom=state.showNames&&barTeams.length?100:40;
 const containerWidth=el('explore-content')?.clientWidth||1000;
 // Fill the entire tile on desktop. Scroll only when too many weeks/bars make it unreadable.
 const available=Math.max(305,el('weekly-comparison-host')?.clientWidth||containerWidth-30);
 const required=left+right+weeks.length*Math.max(48,barTeams.length*(state.showNames?19:14)+22);
 const width=Math.ceil(Math.max(available,required));
 const chartW=width-left-right,step=chartW/weeks.length,chartBottom=top+plotH;
 const y=v=>top+(domainHigh-v)/(domainHigh-domainLow)*plotH;
 const x=i=>left+step*(i+.5);
 const bars=[],pointLabels=[],barCenters=new Map();
 const focus=XL.focusedSeries;const mark=(key,html)=>`<g class="weekly-series-mark" data-focused="${focus===key}" data-series-key="${esc(key)}">${html}</g>`;
 weeks.forEach((w,i)=>{
   if(!barTeams.length)return;
   const usable=Math.max(24,step-14),gap=2;
   const barW=Math.max(3,Math.min(30,(usable-gap*(barTeams.length-1))/barTeams.length));
   const fullW=barTeams.length*barW+(barTeams.length-1)*gap,start=x(i)-fullW/2;
   barTeams.forEach((t,j)=>{
     const score=weeklyScore(t,w);if(score===null)return;
     const cx=start+j*(barW+gap)+barW/2;
     barCenters.set(`${i}|${String(t.id)}`,cx);
     const zero=y(0),valueY=y(score),h=Math.max(1,Math.abs(zero-valueY));
     const rectY=score>=0?valueY:zero;
     const fill=rainbowBars?WEEKLY_PALETTE[i%6]:weeklyColor(t.id);
     bars.push(mark('bar:'+String(t.id),`<g class="weekly-bar-hit" data-weekly-bar-week="${w}" data-weekly-bar-team="${esc(String(t.id))}" role="button" tabindex="0" aria-label="Open ${esc(teamName(t))} week ${w} starting lineup"><rect x="${(cx-barW/2).toFixed(1)}" y="${rectY.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${fill}" fill-opacity=".83" stroke="#ffffff" stroke-width=".55"><title>${esc(teamName(t))} · Week ${w}: ${labFormat(score,2)} fantasy points — click for Starting Lineup</title></rect></g>`));
     if(state.showPoints)pointLabels.push(mark(state.showLines&&lineTeams.some(lt=>String(lt.id)===String(t.id))&&XL.focusedSeries==='line:'+String(t.id)?'line:'+String(t.id):'bar:'+String(t.id),`<text class="weekly-data-label" x="${cx.toFixed(1)}" y="${Math.max(12,rectY-5).toFixed(1)}" text-anchor="middle" fill="${fill}">${esc(labFormat(score,0))}</text>`));
     // Full franchise name is pinned to the foot of its bar, independent of point labels.
     if(state.showNames){const foot=chartBottom+7;bars.push(mark('bar:'+String(t.id),`<text class="weekly-team-label" transform="translate(${cx.toFixed(1)} ${foot.toFixed(1)}) rotate(-45)" text-anchor="end" fill="${weeklyColor(t.id)}"><title>${esc(teamName(t))} · Week ${w}</title>${esc(teamName(t))}</text>`));}
   });
 });
 const grid=[];
 const tickStep=domainHigh-domainLow>200?50:domainHigh-domainLow>120?25:20;
 for(let tick=Math.ceil(domainLow/tickStep)*tickStep;tick<=domainHigh;tick+=tickStep){const ty=y(tick);grid.push(`<line x1="${left}" y1="${ty.toFixed(1)}" x2="${width-right}" y2="${ty.toFixed(1)}" stroke="#dce1df" stroke-width="1"/><text x="${left-10}" y="${(ty+3.5).toFixed(1)}" text-anchor="end" class="weekly-axis-text">${tick}</text>`);}
 const paths=[];
 for(const t of lineTeams){
   const lineValues=weeks.map(w=>weeklyScore(t,w)),color=weeklyColor(t.id);
   // Matching bars and lines use the exact same measured point coordinates.
   const xFor=i=>barCenters.get(`${i}|${String(t.id)}`)??x(i);
   weeklyLinePath(weeks,lineValues,xFor,y).forEach(d=>paths.push(mark('line:'+String(t.id),`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)));
   lineValues.forEach((v,i)=>{if(v!==null)paths.push(mark('line:'+String(t.id),`<circle cx="${xFor(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.1" fill="${color}" stroke="#fff" stroke-width="1"><title>${esc(teamName(t))} · Week ${weeks[i]}: ${labFormat(v,2)} points</title></circle>`));});
   // Line labels also work without bars. The label remains visible while focused.
   if(state.showPoints)lineValues.forEach((v,i)=>{
     if(v===null)return;
     if(barTeams.some(bt=>String(bt.id)===String(t.id)))return; // one label for coincident bar and line
     const key='line:'+String(t.id);
     pointLabels.push(mark(key,`<text class="weekly-data-label weekly-line-data-label" x="${xFor(i).toFixed(1)}" y="${Math.max(13,y(v)-10).toFixed(1)}" text-anchor="middle" fill="${color}">${esc(labFormat(v,0))}</text>`));
   });
 }
 if(state.showLeague){
   weeklyLinePath(weeks,leagueValues,x,y).forEach(d=>paths.push(mark('league',`<path d="${d}" fill="none" stroke="${WEEKLY_COLORS.league}" stroke-width="2" stroke-dasharray="6 4"/>`)));
   leagueValues.forEach((v,i)=>{if(v!==null)paths.push(mark('league',`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4" fill="${WEEKLY_COLORS.league}"><title>League week ${weeks[i]} average: ${labFormat(v,2)}</title></circle>`));});
   if(state.showPoints)leagueValues.forEach((v,i)=>{if(v!==null){
     const nearby=[...barTeams,...lineTeams].some(t=>{const score=weeklyScore(t,weeks[i]);return score!==null&&Math.abs(y(score)-y(v))<24;});
     const avgLabelY=nearby?Math.min(chartBottom-3,y(v)+19):Math.max(13,y(v)-11);
     pointLabels.push(mark('league',`<text class="weekly-data-label weekly-line-data-label weekly-league-data-label" x="${x(i).toFixed(1)}" y="${avgLabelY.toFixed(1)}" text-anchor="middle" fill="${WEEKLY_COLORS.league}">${esc(labFormat(v,1))}</text>`));}});
 }
 if(state.showMean&&seasonMean!==null){const ym=y(seasonMean);paths.push(mark('mean',`<line x1="${left}" y1="${ym.toFixed(1)}" x2="${width-right}" y2="${ym.toFixed(1)}" stroke="${WEEKLY_COLORS.mean}" stroke-width="1.9" stroke-dasharray="8 5"><title>Selected team's season average: ${labFormat(seasonMean,2)}</title></line>`));}
 const axisLabels=weeks.map((week,i)=>`<text x="${x(i).toFixed(1)}" y="${state.showNames&&barTeams.length?top-11:chartBottom+19}" text-anchor="middle" class="weekly-axis-text">WK ${String(week).padStart(2,'0')}</text>`).join('');
 const legendToken=(key,title,marker,removeAttr)=>`<span class="weekly-legend-item ${XL.focusedSeries===key?'is-focused':''}" role="button" tabindex="0" data-weekly-focus="${esc(key)}" aria-pressed="${XL.focusedSeries===key}" title="Focus or unfocus ${esc(title)}">${marker}<span>${esc(title)}</span><button class="weekly-legend-remove" type="button" ${removeAttr} aria-label="Remove ${esc(title)} from chart" title="Remove ${esc(title)}">×</button></span>`;
 const legend=[...barTeams.map(t=>{
   const own=String(t.id)===String(explorerTeam().id);
   return legendToken('bar:'+String(t.id),teamName(t)+' · BAR',`<i style="background:${rainbowBars?'linear-gradient(90deg, #487ebb 0 17%, #b85864 17% 34%, #42966d 34% 51%, #9462b4 51% 68%, #ca8c44 68% 85%, #3d9ca3 85% 100%)':weeklyColor(t.id)}"></i>`,own?'data-weekly-hide-bars':'data-weekly-remove="'+esc(t.id)+'"');
 }),...state.showLines?lineTeams.map(t=>{
   const id=state.lines.find(id=>String(weeklyTeam(id)?.id)===String(t.id));
   return legendToken('line:'+String(t.id),teamName(t)+' · LINE',`<i class="weekly-line-key" style="border-color:${weeklyColor(t.id)}"></i>`,'data-weekly-remove-line="'+esc(id)+'"');
 }):[],...(state.showLeague?[legendToken('league','LEAGUE WK AVG',`<i class="weekly-dash-key" style="border-color:${WEEKLY_COLORS.league}"></i>`,'data-weekly-hide-league')]:[]),...(state.showMean?[legendToken('mean','SEASON AVG',`<i class="weekly-dash-key" style="border-color:${WEEKLY_COLORS.mean}"></i>`,'data-weekly-hide-mean')]:[])].join('');
 const empty=!barTeams.length&&!lineTeams.length&&!state.showLeague&&!state.showMean;
 return `<div class="weekly-plot-scroll" role="region" aria-label="Full-width scoring bars and aligned team lines" tabindex="0"><svg viewBox="0 0 ${width} ${plotH+top+bottom}" width="${width}" height="${plotH+top+bottom}" class="weekly-comparison-svg ${XL.focusedSeries?'weekly-focus-active':''}" role="img" aria-label="Weekly scoring comparison">${grid.join('')}<line x1="${left}" y1="${y(0).toFixed(1)}" x2="${width-right}" y2="${y(0).toFixed(1)}" stroke="#65716e" stroke-width="1.1"/>${bars.join('')}${paths.join('')}${pointLabels.filter(label=>!XL.focusedSeries||!label.includes(`data-series-key="${esc(XL.focusedSeries)}"`)).join('')}${pointLabels.filter(label=>XL.focusedSeries&&label.includes(`data-series-key="${esc(XL.focusedSeries)}"`)).join('')}${axisLabels}<text x="17" y="${top+plotH/2}" transform="rotate(-90 17 ${top+plotH/2})" text-anchor="middle" class="weekly-axis-label">FANTASY POINTS</text>${empty?`<text x="${width/2}" y="${top+plotH/2}" text-anchor="middle" class="weekly-empty">Turn on bars, lines, or averages to display data.</text>`:''}</svg></div><div class="weekly-legend">${legend}</div>`;
}
function detailWeekly(){
 const t=explorerTeam(),hist=t.history,state=weeklySettings(),avg=hist.length?labSum(hist.map(h=>h.points))/hist.length:null;
 const eligibleBars=model.teams.filter(z=>String(z.id)!==String(t.id)&&!state.compare.includes(String(z.id)));
 const eligibleLines=model.teams.filter(z=>!state.lines.includes(String(z.id))&&!(String(z.id)===String(t.id)&&state.lines.includes('active')));
 const barChips=state.compare.map(id=>findTeam(id)).filter(Boolean).map(t=>`<button type="button" class="weekly-comparison-chip" data-weekly-remove="${esc(t.id)}" title="Remove scoring bars for ${esc(teamName(t))}"><i style="background:${weeklyColor(t.id)}"></i>${esc(teamName(t))}<span aria-hidden="true">×</span></button>`).join('');
 const lineChips=state.lines.map(id=>({id,team:weeklyTeam(id)})).filter(x=>x.team).map(({id,team})=>`<button type="button" class="weekly-comparison-chip" data-weekly-remove-line="${esc(id)}" title="Remove scoring line for ${esc(teamName(team))}"><i class="weekly-line-key" style="border-color:${weeklyColor(team.id)}"></i>${esc(teamName(team))}<span aria-hidden="true">×</span></button>`).join('');
 const allWeeks=model.teams.flatMap(z=>z.history.map(h=>labNum(h.points))).filter(x=>x!==null);
 const leagueSeasonAvg=allWeeks.length?labSum(allWeeks)/allWeeks.length:null;
 const rows=hist.map((h,i)=>{
   const score=labNum(h.points),opScore=labNum(h.oppPoints),weekAvg=weeklyLeagueAvg(h.week);
   const rank=weeklyRank(h.week,score),rankedVals=model.teams.map(z=>weeklyScore(z,h.week)).filter(v=>v!==null);
   const margin=score!==null&&opScore!==null?score-opScore:null;
   const result=margin===null?'—':margin>0?'W':margin<0?'L':'T';
   const cumulative=labSum(hist.slice(0,i+1).map(x=>x.points));
   return `<tr class="lab-clickable weekly-ledger-row" tabindex="0" role="button" data-open-match="${h.week}" aria-label="Open week ${h.week} matchup box score"><td>W${String(h.week).padStart(2,'0')}</td><td class="weekly-opponent">${esc(teamName(findTeam(h.opponentId)))}</td><td class="result-${result.toLowerCase()}"><b>${result}</b></td><td><strong>${labFormat(score,2)}</strong></td><td>${labFormat(opScore,2)}</td><td class="${margin===null?'':margin>=0?'positive-text':'negative-text'}">${margin===null?'—':(margin>0?'+':'')+labFormat(margin,2)}</td><td>${labFormat(weekAvg,2)}</td><td>${weekAvg===null||score===null?'—':labFormat(score-weekAvg,2)}</td><td>${avg===null||score===null?'—':labFormat(score-avg,2)}</td><td>${labFormat(cumulative,2)}</td><td>${labFormat(cumulative/(i+1),2)}</td><td>${labFormat(rankedVals.length?Math.max(...rankedVals):null,2)}</td><td>${labFormat(rankedVals.length?Math.min(...rankedVals):null,2)}</td><td><b>${esc(rank)}</b></td></tr>`;
 });
 setExplorer(heading('Weekly production / league comparisons','Select bars to open the corresponding Starting Lineup. Original view colors each week independently; comparisons use franchise colors.')+
 `<section class="lab-panel weekly-full-panel"><div class="weekly-panel-header"><h4>COMPARATIVE SCORING · ${hist.length} REPORTED WEEKS</h4><span>BAR SERIES: ${state.compare.length+1} · LINE SERIES: ${state.lines.length}/10</span></div>
 <div class="weekly-toolbar" aria-label="Scoring chart controls">
   <label class="weekly-add-picker"><span>ADD BARS</span><select id="weekly-compare-add" aria-label="Add bar series"><option value="">+ BAR SERIES</option>${eligibleBars.map(z=>`<option value="${esc(z.id)}">${esc(teamName(z))}</option>`).join('')}</select></label>
   <label class="weekly-add-picker"><span>ADD LINES</span><select id="weekly-line-add" aria-label="Add line series" ${state.lines.length>=10?'disabled':''}><option value="">+ LINE SERIES${state.lines.length>=10?' (10 MAX)':''}</option>${eligibleLines.map(z=>`<option value="${esc(z.id)}">${esc(teamName(z))}</option>`).join('')}</select></label>
   <label class="weekly-toggle"><input type="checkbox" id="weekly-show-bars" ${state.showBars?'checked':''}> Bars</label>
   <label class="weekly-toggle"><input type="checkbox" id="weekly-show-lines" ${state.showLines?'checked':''}> Lines</label>
   <label class="weekly-toggle"><input type="checkbox" id="weekly-show-names" ${state.showNames?'checked':''}> Team names</label>
   <label class="weekly-toggle"><input type="checkbox" id="weekly-show-points" ${state.showPoints?'checked':''}> Points</label>
   <label class="weekly-toggle"><input type="checkbox" id="weekly-show-league" ${state.showLeague?'checked':''}> League avg</label>
   <label class="weekly-toggle"><input type="checkbox" id="weekly-show-mean" ${state.showMean?'checked':''}> Season avg</label>
   <button type="button" class="weekly-reset" id="weekly-clear" title="Reset bar and line selections">RESET</button>
 </div>
 <div id="weekly-comparison-host">${weeklyComparativeChart()}</div><p class="lab-note">Each line uses its franchise color and meets the top of that team's corresponding bar. When a team's bars are hidden, its line is centered on the week. Hover for exact fantasy scores.</p></section>`+
 `<section class="lab-panel weekly-register-panel" id="weekly-full-ledger" tabindex="-1"><div class="weekly-register-heading"><h4><button type="button" class="weekly-register-focus" data-weekly-focus-table>WEEK-BY-WEEK SCORING / FULL REGISTER ↗</button></h4><span>SELECT A ROW TO OPEN ITS MATCHUP BOX SCORE</span></div><div class="weekly-register-summary"><span>TEAM SEASON AVG <b>${labFormat(avg,2)}</b></span><span>LEAGUE GAME AVG <b>${labFormat(leagueSeasonAvg,2)}</b></span><span>WEEKS <b>${String(hist.length).padStart(2,'0')}</b></span></div>${expandTable(['WEEK','OPPONENT','RESULT','POINTS FOR','POINTS ALLOWED','MARGIN','LEAGUE WK AVG','VS LEAGUE AVG','VS YOUR AVG','CUMULATIVE PTS','RUNNING AVG','WEEK HIGH','WEEK LOW',"WEEK’S SCORING RANK"],rows,'weekly-full-register')}<div class="weekly-register-footnote"><strong>READING THE REPORT</strong><p>Weekly average: mean of all league franchises reporting that week. Week rank: selected team's weekly score ranked against those same franchises. Cumulative points and running average include only recorded weeks. Unreported scores remain blank.</p></div></section>`);
 const host=el('weekly-comparison-host');if(host&&typeof ResizeObserver!=='undefined'){
  let measured=0;const resize=()=>{if(!host.isConnected)return;const width=host.clientWidth;if(width&&width!==measured){measured=width;host.innerHTML=weeklyComparativeChart();}};
  requestAnimationFrame(resize);graphResizeObserver=new ResizeObserver(resize);graphResizeObserver.observe(host);
 }

}
function detailStandings(){
 const base=ranked();
 const official=new Map(base.map((t,i)=>[String(t.id),i+1]));
 const weeks=[...new Set(model.teams.flatMap(t=>t.history.map(h=>h.week)))];
 const allplay=t=>weeks.reduce((acc,w)=>{const mine=t.history.find(h=>h.week===w);if(!mine)return acc;const other=model.teams.filter(x=>x.id!==t.id).map(x=>x.history.find(h=>h.week===w)?.points).filter(x=>x!=null);return acc+other.filter(v=>mine.points>v).length+other.filter(v=>mine.points===v).length*.5},0);
 const categories=[
   ['OFFICIAL LEAGUE ORDER',t=>official.get(String(t.id)),false],
   ['POINTS SCORED',t=>getStats(t).pts,true],
   ['AVERAGE POINTS / WEEK',t=>getStats(t).avg,true],
   ['FEWEST POINTS ALLOWED',t=>getStats(t).against,false],
   ['WINS',t=>t.wins,true],
   ['ALL-PLAY WINS',t=>allplay(t),true]
 ];
 const summary=model.teams.map(t=>({t,stats:getStats(t)}));
 const reportWeeks=t=>t.history.map(h=>labNum(h.points)).filter(v=>v!==null);
 const statsFor=t=>{
   const s=getStats(t),weekly=reportWeeks(t),avg=weekly.length?labSum(weekly)/weekly.length:null;
   const sd=weekly.length?Math.sqrt(labSum(weekly.map(v=>(v-avg)**2))/weekly.length):null;
   const margins=t.history.map(h=>h.oppPoints===null?null:h.points-h.oppPoints).filter(v=>v!==null);
   return {s,weekly,sd,margin:margins.length?labSum(margins)/margins.length:null};
 };
 const panels=categories.map(([label,value,descending])=>{
   const teams=[...model.teams].sort((a,b)=>(descending?value(b)-value(a):value(a)-value(b))||official.get(String(a.id))-official.get(String(b.id)));
   const rows=teams.map((t,i)=>{
     const {s,weekly,sd,margin}=statsFor(t);
     const best=weekly.length?Math.max(...weekly):null,worst=weekly.length?Math.min(...weekly):null;
     const pf=s.pts,pa=s.against;
     return `<tr class="lab-clickable" data-set-team="${esc(t.id)}" tabindex="0" title="Open ${esc(teamName(t))} Franchise Performance Report" role="button" aria-label="Open Franchise Performance Report for ${esc(teamName(t))}"><td>${String(i+1).padStart(2,'0')}</td><td class="league-stat-name"><strong>${esc(teamName(t))}</strong></td><td>${labFormat(value(t),label==='WINS'||label==='OFFICIAL LEAGUE ORDER'?0:1)}</td><td>${record(t)}</td><td>${labFormat(pf,2)}</td><td>${labFormat(pa,2)}</td><td>${labFormat(pf-pa,2)}</td><td>${labFormat(s.avg,2)}</td><td>${labFormat(sd,2)}</td><td>${labFormat(margin,2)}</td><td>${labFormat(best,2)}</td><td>${labFormat(worst,2)}</td><td>${weekly.length}</td><td>${labFormat(allplay(t),1)}</td><td>${labFormat(weekly.length?labSum(weekly.slice(-3))/Math.min(3,weekly.length):null,2)}</td></tr>`;
   });
   return `<section class="lab-panel standings-category"><h4>${label} <small>SCROLL HORIZONTALLY FOR FULL METRICS →</small></h4>${expandTable(['RANK','FRANCHISE','CATEGORY VALUE','RECORD','POINTS FOR','POINTS ALLOWED','POINT DIFFERENTIAL','PTS / WEEK','SCORING σ','AVG MARGIN','BEST WEEK','WORST WEEK','WEEKS','ALL-PLAY WINS','LAST 3 AVG'],rows,'standings-full-table')}</section>`;
 }).join('');
 setExplorer(heading('League-wide rankings','Each category is independently ranked below. Use the sort menu on the homepage to reorder the compact League Table.')+panels+
 '<p class="lab-note">All-play wins count how many other franchises each team outscored each week; ties count as half-wins. Points allowed are only meaningful where matchup results exist.</p>');
}
// The position file uses only *actual recorded starters*. Positional share is
// a share of the observed starter subtotal, not the franchise's schedule total
// when ESPN has not supplied every player score.
function starterPositionRows(t){
 const rows=[],seen=new Set();
 const add=(week,id,pts)=>{
  const p=model.players[id],v=labNum(pts),w=Number(week);
  if(!p||v===null||!Number.isFinite(w))return;
  const key=String(w)+'|'+String(id);if(seen.has(key))return;
  seen.add(key);rows.push({week:w,id:String(id),p,pos:p.pos==='D/ST'?'DEF':p.pos,points:v});
 };
 for(const h of t.history||[]){
  const reported=Object.entries(h.starters||{});
  if(reported.length){for(const [id,value] of reported)add(h.week,id,value);}
  else for(const e of h.lineup||[]){if(e.starter!==false && ![20,21].includes(Number(e.slot)))add(h.week,e.id,e.points??e.p?.scores?.[h.week]);}
 }
 const active=Number(model.currentWeek||model.liveWeek||currentWeek||0);
 if(active&&!rows.some(r=>r.week===active)){
  const data=weeklyLineupData(t,active);
  for(const e of data.originalStarters)add(active,e.id,data.scoreFor(e));
 }
 return rows;
}
// All Position Allocation mini-rankings compare like-for-like observed data.
// A missing season/week is unavailable, never an invented zero.
const POSITION_RANK_TITLES=['TOTAL STARTER POINTS','AVG PTS / START','LEADING POSITION SHARE','BENCH POINTS','PTS / REPORTED WEEK','BENCH SCORING SHARE'];
function positionBenchStats(t,weeks){
 let points=0,scored=0;
 for(const week of weeks){
  const h=(t.history||[]).find(entry=>Number(entry.week)===Number(week));
  const active=Number(model.currentWeek||model.liveWeek||currentWeek||0);
  const lineup=h?.lineup?.length?h.lineup:(Number(week)===active?t.currentLineup||[]:[]);
  for(const e of lineup){
   const slot=Number(e.slot);
   if(!(slot===20 || (e.starter===false&&slot!==21)))continue;
   const p=model.players[e.id];const v=labNum(e.points??p?.scores?.[week]);
   if(v!==null){points+=v;scored++;}
  }
 }
 return {points:scored?points:null,scored};
}
function positionTeamRanks(t,wk){
 const all=starterPositionRows(t),rows=wk==='all'?all:all.filter(r=>r.week===Number(wk));
 const points=rows.length?labSum(rows.map(r=>r.points)):null;
 const byPos=new Map();for(const r of rows)byPos.set(r.pos,(byPos.get(r.pos)||0)+r.points);
 const top=[...byPos].sort((a,b)=>b[1]-a[1])[0];
 const weeks=[...new Set(rows.map(r=>r.week))];
 const bench=positionBenchStats(t,weeks);
 return {team:t,values:[points,points!==null?points/rows.length:null,points>0&&top?top[1]/points*100:null,bench.points,points!==null?points/weeks.length:null,bench.points!==null&&points!==null&&bench.points+points>0?bench.points/(bench.points+points)*100:null],leader:top?.[0]||null,posShares:Object.fromEntries(POS_ORDER.map(pos=>[pos,points>0?(byPos.get(pos)||0)/points*100:null]))};
}
function togglePositionRanking(index){
 const host=el('position-ranking-host'),trigger=el('explore-content').querySelector(`[data-position-rank="${index}"]`);
 if(!host||!trigger)return;
 if(!host.hidden&&host.dataset.rank===String(index)){
  host.hidden=true;host.innerHTML='';host.dataset.rank='';
 }else{
  const wk=XL.positionWeek||'all',active=explorerTeam();
  const sharePos=index===2?(XL.positionSharePos||'LEADING'):'LEADING';
  const rankMetric=r=>index===2&&sharePos!=='LEADING'?r.posShares[sharePos]:r.values[index];
  const ranks=model.teams.map(t=>positionTeamRanks(t,wk)).sort((a,b)=>{
   const av=rankMetric(a),bv=rankMetric(b);
   return av===null?1:bv===null?-1:bv-av;
  });
  const format=r=>{
   const v=rankMetric(r);if(v===null)return '—';
   return index===2?`${esc(sharePos==='LEADING'?r.leader||'?':sharePos)} · ${labFormat(v,1)}%`:index===5?labPct(v):labFormat(v,2);
  };
  host.innerHTML=`<div class="summary-rank-head">${esc(index===2?'POSITION SHARE':POSITION_RANK_TITLES[index])} / ${wk==='all'?'SEASON':'WEEK '+wk}${index===2?`<label class="share-banner-picker"><select id="position-share-select" aria-label="Select position for share ranking">${['LEADING',...POS_ORDER].map(pos=>`<option value="${pos}" ${sharePos===pos?'selected':''}>${pos==='LEADING'?'LEADER':pos==='DEF'?'D/ST':pos}</option>`).join('')}</select></label>`:''}</div><div class="summary-rank-scroll"><table class="lab-table"><thead><tr><th>#</th><th>FRANCHISE</th><th>${esc(index===2?'LEADER / SHARE':POSITION_RANK_TITLES[index])}</th></tr></thead><tbody>${ranks.map((r,i)=>`<tr data-ranking-team="${esc(String(r.team.id))}" tabindex="0" role="button" class="${String(r.team.id)===String(active.id)?'is-current':''}" title="Open ${esc(teamName(r.team))} Club Overview"><td>${rankMetric(r)===null?'—':String(ranks.slice(0,i+1).filter(z=>rankMetric(z)!==null).length).padStart(2,'0')}</td><td title="${esc(teamName(r.team))}">${esc(teamName(r.team))}</td><td><b>${format(r)}</b></td></tr>`).join('')}</tbody></table></div>`;
  host.hidden=false;host.dataset.rank=String(index);
  const anchor=host.closest('.position-rank-anchor'),r=trigger.getBoundingClientRect(),a=anchor.getBoundingClientRect();
  host.style.top=`${r.top-a.top}px`;host.style.minWidth=`${r.width}px`;
  if(index<3){host.style.left=`${r.left-a.left}px`;host.style.right='auto';}
  else{host.style.right=`${a.right-r.right}px`;host.style.left='auto';}
 }
 el('explore-content').querySelectorAll('[data-position-rank]').forEach(b=>b.setAttribute('aria-expanded',String(!host.hidden&&b.dataset.positionRank===host.dataset.rank)));
}
function detailPositions(){
 const t=explorerTeam(),all=starterPositionRows(t);
 const selected=String(XL.positionWeek||'all');
 const weeks=[...new Set(all.map(r=>r.week))].sort((a,b)=>a-b);
 if(selected!=='all'&&!weeks.includes(Number(selected)))XL.positionWeek='all';
 const wk=String(XL.positionWeek||'all');
 const rows=wk==='all'?all:all.filter(r=>r.week===Number(wk));
 const positions=POS_ORDER.filter(pos=>rows.some(r=>r.pos===pos));
 const byPos=Object.fromEntries(positions.map(pos=>[pos,rows.filter(r=>r.pos===pos)]));
 const total=labSum(rows.map(r=>r.points)),max=Math.max(1,...positions.map(pos=>labSum(byPos[pos].map(r=>r.points))));
 const pointsPerStart=rows.length?total/rows.length:null;
 const leadingPosition=positions.length?positions.reduce((a,b)=>labSum(byPos[a].map(r=>r.points))>=labSum(byPos[b].map(r=>r.points))?a:b):null;
 const leadingShare=leadingPosition&&total>0?labSum(byPos[leadingPosition].map(r=>r.points))/total*100:null;
 // Bench production uses the *recorded* bench assignments and player scores
 // for the selected period. No estimate from starter points or team scores.
 const covered=[...new Set(rows.map(r=>r.week))];
 let benchPoints=0,benchGames=0,benchEntries=0;
 for(const week of covered){
  const historic=(t.history||[]).find(h=>Number(h.week)===Number(week));
  const activeWeek=Number(model.currentWeek||model.liveWeek||currentWeek||0);
  // Current lineup can be present even when the scheduled history has no box score.
  const original=historic?.lineup?.length?historic.lineup:(Number(week)===activeWeek?t.currentLineup||[]:[]);
  for(const entry of original){
   const slot=Number(entry.slot);
   if(!(slot===20 || (entry.starter===false&&slot!==21)))continue;
   benchEntries++;
   const player=model.players[entry.id];
   const value=labNum(entry.points??player?.scores?.[week]);
   if(value!==null){benchPoints+=value;benchGames++;}
  }
 }
 const benchTotal=benchGames?labFormat(benchPoints,2):'—';
 const weekly=[...new Set(all.map(r=>r.week))].sort((a,b)=>a-b);
 const maxWeek=Math.max(1,...weekly.map(w=>labSum(all.filter(r=>r.week===w).map(r=>r.points))));
 const legends=positions.map(pos=>`<span><i style="background:${COLORS[pos]||COLORS['?']}"></i>${esc(pos)}</span>`).join('');
 const weeklyChart=weekly.map(w=>{
  const groups=POS_ORDER.map(pos=>({pos,val:labSum(all.filter(r=>r.week===w&&r.pos===pos).map(r=>r.points))})).filter(r=>r.val>0);
  const sum=labSum(groups.map(g=>g.val));
  return `<div class="position-week-col ${wk===String(w)?'selected':''}"><b>${labFormat(sum,0)}</b><button class="position-week-pillar" type="button" data-position-week="${w}" aria-label="Open Week ${w} starting lineup" title="Week ${w}: ${labFormat(sum,2)} starter points" style="height:${Math.max(3,sum/maxWeek*152).toFixed(1)}px">${groups.map(g=>`<i style="height:${(g.val/sum*100).toFixed(2)}%;background:${COLORS[g.pos]||COLORS['?']}" title="${g.pos}: ${labFormat(g.val,2)}"></i>`).join('')}</button><small>W${String(w).padStart(2,'0')}</small></div>`;
 }).join('');
 const positionList=positions.map(pos=>{
  const arr=byPos[pos],points=labSum(arr.map(r=>r.points)),games=arr.length;
  return `<div class="position-focus-row"><span class="position-focus-pos" style="border-left-color:${COLORS[pos]||'#718080'}">${esc(pos)}</span><div class="position-focus-track" aria-label="${esc(pos)} scored ${labFormat(points,1)} fantasy points"><i style="background:${COLORS[pos]||'#718080'};width:${(points/max*100).toFixed(1)}%"></i></div><b>${labFormat(points,2)} PTS</b><small>${labFormat(total?points/total*100:null,1)}% SHARE</small><small>${labFormat(points/games,1)} / START</small></div>`;
 }).join('');
 // The time-filter changes only TOTAL FPTS. Games started, per-start
 // average and best game always cover every recorded regular-season week.
 const seasonContributors=new Map();
 for(const r of all){
  const value=seasonContributors.get(r.id)||{p:r.p,seasonPoints:0,starts:0,best:null};
  value.seasonPoints+=r.points;value.starts++;value.best=value.best===null?r.points:Math.max(value.best,r.points);
  seasonContributors.set(r.id,value);
 }
 const periodContributors=new Map();
 for(const r of rows){periodContributors.set(r.id,(periodContributors.get(r.id)||0)+r.points);}
 const leaders=[...periodContributors.keys()].map(id=>({...seasonContributors.get(id),periodPoints:periodContributors.get(id)})).sort((a,b)=>b.periodPoints-a.periodPoints);
 const matrix=weekly.map(w=>{
  const vals=POS_ORDER.map(pos=>labSum(all.filter(r=>r.week===w&&r.pos===pos).map(r=>r.points)));
  return `<tr class="lab-clickable" data-position-week="${w}" role="button" tabindex="0" title="Open Week ${w} starting lineup"><td>W${String(w).padStart(2,'0')}</td>${POS_ORDER.map((pos,i)=>`<td>${all.some(r=>r.week===w&&r.pos===pos)?labFormat(vals[i],1):'—'}</td>`).join('')}<td><strong>${labFormat(labSum(vals),2)}</strong></td></tr>`;
 });
 const weekSelector=`<label class="position-week-filter">SCORING PERIOD <select id="position-week-filter" aria-label="Filter positional scoring by week"><option value="all" ${wk==='all'?'selected':''}>FULL SEASON</option>${weeks.map(w=>`<option value="${w}" ${wk===String(w)?'selected':''}>WEEK ${String(w).padStart(2,'0')}</option>`).join('')}</select></label>`;
 setExplorer(heading('Position allocation / starter analytics','Recorded starter contributions by natural NFL position. Click a week to open its lineup; click a player to open the Player Terminal.')+
 `<section class="lab-panel position-allocation-hub"><div class="position-allocation-head"><h4>POSITIONAL SCORING / ${esc(teamName(t))}</h4>${weekSelector}</div><div class="position-rank-anchor"><div class="lab-stats position-topline">${(()=>{
  const b=positionBenchStats(t,[...new Set(rows.map(r=>r.week))]);
  const nWeeks=new Set(rows.map(r=>r.week)).size;
  const posShare=leadingPosition&&leadingShare!==null?leadingPosition+' · '+labFormat(leadingShare,1)+'%':'—';
  const data=[rows.length?labFormat(total,2):'—',rows.length?labFormat(pointsPerStart,2):'—',posShare,benchTotal,nWeeks?labFormat(total/nWeeks,2):'—',benchGames&&rows.length&&total+benchPoints>0?labPct(benchPoints/(total+benchPoints)*100):'—'];
  const colors=['blue','green','purple','orange','cyan','red'];
  return data.map((v,i)=>`<button type="button" class="lab-stat acc-${colors[i]} position-rank-trigger" data-position-rank="${i}" aria-expanded="false" title="Compare ${esc(POSITION_RANK_TITLES[i])} across your league"><small>${esc(POSITION_RANK_TITLES[i])}</small><b>${esc(v)}</b></button>`).join('');
 })()}</div><div id="position-ranking-host" class="summary-ranking-host position-ranking-host" hidden></div></div>
 <div class="position-allocation-columns"><section class="position-drilldown-card" data-position-comparison tabindex="0" aria-label="Open a league-wide player comparison by position"><h4><span>POINTS BY POSITION</span></h4>${positionList||'<p class="lab-note">No position-specific starter scores have been supplied for this period.</p>'}<p class="lab-note">Position shares use recorded starter production. Bench Points sums separately recorded bench scores for the selected period; missing games are excluded.</p></section><section class="position-drilldown-card" data-league-contributions tabindex="0" aria-label="Open week-by-week position comparisons for every franchise"><h4><span>WEEKLY CONTRIBUTION · STACKED</span></h4><div class="position-week-plot" role="group" aria-label="Stacked weekly starting player production">${weeklyChart||'<p class="lab-note">No weekly starter production available.</p>'}</div><div class="position-legend">${legends}</div><p class="lab-note">Colors identify positions. Clicking a week opens its full starting lineup.</p></section></div></section>`+
 `<section class="lab-panel starter-contributions-panel" id="starter-contributions-panel" tabindex="-1"><div class="position-contribution-heading"><h4>STARTER CONTRIBUTIONS / ${wk==='all'?'FULL SEASON':'WEEK '+wk}</h4><span>${wk==='all'?'Season production':'Week total · season context'}</span></div>${expandTable(['PLAYER','POSITION','STARTS (SEASON)','TOTAL FPTS'+(wk==='all'?'':' (WEEK)'),'PTS / START (SEASON)','BEST GAME (SEASON)'],leaders.map(entry=>{
  const focused=String(XL.positionFocusPlayer)===String(entry.p.id);
  return `<tr class="lab-clickable ${focused?'position-contributor-focused':''}" data-open-player="${esc(entry.p.id)}" tabindex="0" role="button" title="Open ${esc(entry.p.name)} Player Terminal"><td><strong>${esc(entry.p.name)}</strong>${focused?' <span class="position-focus-marker">◀ SELECTED</span>':''}</td><td><span class="position-chip" style="border-color:${COLORS[entry.p.pos]||'#8aa'}">${esc(entry.p.pos)}</span></td><td>${entry.starts}</td><td><b>${labFormat(entry.periodPoints,2)}</b></td><td>${labFormat(entry.seasonPoints/entry.starts,2)}</td><td>${labFormat(entry.best,2)}</td></tr>`;
 }))}${XL.positionFocusPlayer&&!leaders.some(e=>String(e.p.id)===String(XL.positionFocusPlayer))?'<p class="lab-note">The selected player has no recorded start in this scoring period; starter contribution is not the same as fantasy points scored while benched.</p>':''}<p class="lab-note">Week selection filters Total FPTS only. Starts, points per start, and best game always reflect the full observed season. Bench games are excluded.</p></section>`+
 `<section class="lab-panel"><h4>WEEKLY POSITION MATRIX</h4>${expandTable(['WEEK',...POS_ORDER,'RECORDED STARTERS'],matrix)}<p class="lab-note">Missing individual statlines remain blank. Recorded starter subtotals can differ from the official fantasy team total.</p></section>`);
}

// v8.7 / Position comparisons. Use only owned league-roster players; a player's
// season totals may be supplied separately from weekly observations.
// Shared scoring observations for position comparisons. Historical lineup starts
// are counted only when the league actually reports a starting assignment.
function leagueRosterObservations(){
 const owned=[];
 for(const team of model.teams){for(const id of team.playerIds||[]){const p=model.players[id];if(p)owned.push({p,team});}}
 const starts=new Map(),weekly=new Map();
 for(const team of model.teams){
  const weeks=new Set((team.history||[]).map(x=>Number(x.week)));
  if(team.currentLineup?.length)weeks.add(Number(model.currentWeek||currentWeek));
  for(const w of weeks){
   const h=(team.history||[]).find(x=>Number(x.week)===w);
   // Provider-specific historical starter dictionaries are explicit
   // starting assignments, even if a detailed lineup is unavailable.
   const entries=h?.lineup?.length?h.lineup:
    Object.keys(h?.starters||{}).length?Object.entries(h.starters).map(([id,points])=>({id,points,starter:true,slot:null})):
    Number(model.currentWeek||currentWeek)===w?(team.currentLineup||[]):[];
   for(const e of entries){
    if(e.starter===false||[20,21].includes(Number(e.slot)))continue;
    const id=String(e.id),p=model.players[id];if(!p)continue;
    const k=id+'|'+w;if(starts.has(k))continue;
    starts.set(k,true);weekly.set(k,labNum(e.points??p.scores?.[w]));
   }
  }
 }
 return {owned,starts,weekly};
}
// Transparent relative within-position research grade: no grade without at least
// three *recorded* fantasy scores. This is not an ESPN projection or player value.
function gradePositionPool(players){
 const byPos=new Map(),norm=p=>p.pos==='D/ST'?'DEF':p.pos;
 for(const p of players){const pos=norm(p.pos),list=byPos.get(pos)||[];list.push(p);byPos.set(pos,list);}
 const grades=new Map(),sampleSizes=new Map();
 // A sorted peer distribution is computed once per position. The previous
 // implementation re-sorted *all* peers for *every* player, causing long
 // filter pauses and excessive allocations in Safari with large free-agent pools.
 const distribution=values=>values.filter(v=>labNum(v)!==null).sort((a,b)=>a-b);
 const percentile=(value,sorted,higher=true)=>{
  if(!sorted.length||labNum(value)===null)return null;
  if(sorted.length===1)return 50;
  let low=0,high=sorted.length;
  while(low<high){const mid=(low+high)>>1;if(sorted[mid]<value)low=mid+1;else high=mid;}
  const below=low;low=0;high=sorted.length;
  while(low<high){const mid=(low+high)>>1;if(sorted[mid]<=value)low=mid+1;else high=mid;}
  const equal=low-below;
  const pct=100*(below+(equal-1)/2)/(sorted.length-1);
  return higher?pct:100-pct;
 };
 for(const list of byPos.values()){
  const summaries=list.map(p=>{const q=summarize(p),size=observedPlayerGames(p).games||0,ppg=playedPointsAverage(p);return {p,q,size,ppg};});
  const eligible=summaries.filter(r=>r.size>=3&&r.ppg!==null);
  const avgs=distribution(eligible.map(r=>r.ppg));
  const recent=distribution(eligible.map(r=>r.q.recent));
  const cvs=distribution(eligible.map(r=>r.q.std!==null?r.q.std/Math.max(Math.abs(r.ppg),.1):null));
  for(const r of summaries){
   const {p,q,size,ppg}=r;
   if(size<3||ppg===null){grades.set(String(p.id),null);continue;}
   const season=percentile(ppg,avgs);
   const canComposite=q.games>=3&&q.recent!==null;
   const form=canComposite?percentile(q.recent,recent):null;
   const steadiness=canComposite&&q.std!==null?percentile(q.std/Math.max(Math.abs(ppg),.1),cvs,false):null;
   const raw=canComposite?(.60*season+.25*(form??50)+.15*(steadiness??50)):season;
   const weight=size/(size+3);
   grades.set(String(p.id),Math.round((50+(raw-50)*weight)*10)/10);
   sampleSizes.set(String(p.id),canComposite?'composite':'ppg-only');
  }
 }
 grades.basis=sampleSizes;return grades;
}
// NFL opponent strength is derived from finalized public scoreboard games,
// NOT a fabricated position-specific fantasy matchup grade.
function normalizeNFLAbbr(abbr){const a=String(abbr||'').toUpperCase();return ({'WAS':'WSH','LA':'LAR','JAC':'JAX','D/ST':'DEF'})[a]||a;}
function scoutingWeek(){return Math.max(1,Math.min(18,Number(model.currentWeek||model.liveWeek||currentWeek||1)));}
function opponentScoutingFor(p,week=scoutingWeek()){
 const data=XL.opponentScouting.get(String(week));
 const team=normalizeNFLAbbr(p.nfl),opponent=normalizeNFLAbbr(data?.opponents?.[team]);
 const rating=data?.teams?.[opponent],defense=['DEF','D/ST'].includes(p.pos);
 return {opponent:opponent||null,rank:rating?(defense?rating.offenseRank:rating.defenseRank):null,
  ppg:rating?(defense?rating.offensePPG:rating.defenseAllowedPPG):null,
  games:rating?.games??null,basis:defense?'OPP OFFENSE':'OPP DEFENSE',available:!!data?.rankedTeams};
}
async function loadOpponentScouting(week=scoutingWeek()){
 const key=String(week);
 if(model.source!=='espn'||XL.opponentScouting.has(key)||XL.scoutingPending.has(key))return;
 XL.scoutingPending.add(key);
 try{
  const resp=await fetch(`/api/nfl/matchup-strength?season=${encodeURIComponent(model.season)}&week=${encodeURIComponent(week)}`,{credentials:'same-origin'});
  if(!resp.ok)throw Error('ESPN NFL matchup ratings unavailable');
  const payload=await resp.json();XL.opponentScouting.set(key,payload);
 }catch{XL.opponentScouting.set(key,null);}
 finally{XL.scoutingPending.delete(key);if(XL.open==='position-compare')schedulePositionRender();}
}
// Recorded scoring weeks count as observed appearances only when each week
// really has a reported player score. Prefer an explicit NFLverse game count,
// when present, to avoid penalizing free agents with sparse ESPN logs.
function observedPlayerGames(p){
 const sourced=labNum(p.gamesPlayed??p.games_played??advancedFor(p).games);
 const observed=seriesFor(p).length;
 // A public weekly-stat release can trail a live ESPN scoring period. Never
 // divide a newer season point total by fewer recorded games than scored weeks.
 if(sourced!==null&&sourced>0&&sourced>=observed)return {games:sourced,source:'VERIFIED NFL GAMES'};
 return {games:observed||null,source:observed?'REPORTED FANTASY WEEKS':'UNAVAILABLE'};
}
function playedPointsAverage(p){
 const period=summarize(p),count=observedPlayerGames(p);
 // The season total is not assumed to match partial logs unless verified
 // games are available or the full value equals the observed-week sum.
 const season=labNum(p.seasonTotal),total=count.source==='VERIFIED NFL GAMES'?(season??period.total):period.total;
 if(count.games===null||total===null)return null;
 if(count.source==='REPORTED FANTASY WEEKS'&&season!==null&&Math.abs(season-labSum(seriesFor(p).map(x=>x.points)))>.02)return null;
 return total/count.games;
}
let playerGameCountsStarted=false;
async function ensurePlayerGameCounts(){
 if(model.source!=='espn'||playerGameCountsStarted)return;
 playerGameCountsStarted=true;
 try{
  const r=await fetch('/api/nflverse/advanced?season='+encodeURIComponent(model.season));
  if(!r.ok)throw Error('NFL games source unavailable');
  const obj=await r.json(),lookup=new Map((obj.players||[]).map(v=>[nameKey(v.name),v]));
  let changed=0;
  for(const p of getPool()){
   const found=lookup.get(nameKey(p.name));if(!found)continue;
   // Require matching current NFL franchise when both sides know it, to
   // avoid attributing an ambiguous player-name season to the wrong athlete.
   const nfl=normalizeNFLAbbr(p.nfl),observed=normalizeNFLAbbr(found.team);
   if(nfl&&observed&&nfl!==observed)continue;
   const games=labNum(found.games);if(games===null||games<1)continue;
   const key=nameKey(p.name),existing=XL.advanced.get(key)||{};
   XL.advanced.set(key,{...existing,games});changed++;
  }
  XL.gamesStatus=changed?`${changed} NFL game counts cross-checked with nflverse`:'NFL games feed contained no matching players';
 }catch{XL.gamesStatus='NFL games source unavailable; ESPN observed-week totals retained';}
 if(XL.open==='position-compare')schedulePositionRender();
}
let positionRenderPending=false;
let positionGradeCache=null;
function schedulePositionRender(){
 if(positionRenderPending)return;
 positionRenderPending=true;
 requestAnimationFrame(()=>{
  positionRenderPending=false;
  if(XL.open!=='position-compare'||!el('explore-dialog')?.open)return;
  try{detailPositionComparison()}catch(error){
   console.error('GRIDIRON position-comparison render failed',error);
   recordFilterDiagnostic('render-error',String(error?.message||error));
   const target=el('position-compare-results');
   if(target)target.insertAdjacentHTML('afterbegin','<p class="lab-note position-error">This filter could not be rendered. Other reports are still available. Try another filter.</p>');
  }
 });
}
function recordFilterDiagnostic(event,detail){
 try{
  const key='gridiron_filter_diagnostics_v1';
  const history=JSON.parse(sessionStorage.getItem(key)||'[]');
  history.push({event,detail:String(detail||'').slice(0,150),at:new Date().toISOString()});
  sessionStorage.setItem(key,JSON.stringify(history.slice(-20)));
 }catch{} // Browser storage might be restricted.
}
function recentPositionDiagnostic(){
 try{return JSON.parse(sessionStorage.getItem('gridiron_filter_diagnostics_v1')||'[]')}catch{return []}
}
// Safe, session-scoped, non-credential diagnostics for intermittent WebKit reloads.
window.addEventListener('error',event=>{
 if(XL.open==='position-compare')recordFilterDiagnostic('javascript-error',String(event.message||'Unknown error'));
});
window.addEventListener('unhandledrejection',event=>{
 if(XL.open==='position-compare')recordFilterDiagnostic('promise-error',String(event.reason?.message||'Uncaught rejection'));
});
function detailPositionComparison(){
 const {owned,starts,weekly:starterScores}=leagueRosterObservations();
 const pool=XL.positionComparisonPool||'ROSTERED',sort=XL.positionComparisonSort||'GRADE';
 el('explore-title').textContent=pool==='ROSTERED'?'ROSTERED PLAYERS / POSITION COMPARISON':pool==='FREE'?'FREE AGENTS / POSITION COMPARISON':'ALL PLAYERS / POSITION COMPARISON';
 const assigned=new Set(owned.map(({p})=>String(p.id)));
 const free=XL.free.filter(p=>!assigned.has(String(p.id)));
 const source=(pool==='FREE'?free:pool==='ALL'?[...owned.map(e=>e.p),...free]:owned.map(e=>e.p));
 const knownIds=new Set();
 const chosen=source.filter(p=>{const key=String(p.id);if(knownIds.has(key))return false;knownIds.add(key);return true;});
 const ownedById=new Map(owned.map(o=>[String(o.p.id),o]));
 const findOwned=p=>ownedById.get(String(p.id));
 const startCountByPlayer=new Map();for(const k of starts.keys()){const id=k.slice(0,k.lastIndexOf('|'));startCountByPlayer.set(id,(startCountByPlayer.get(id)||0)+1);}
 const weeks=[...new Set(chosen.flatMap(p=>seriesFor(p).map(g=>g.week)))].sort((a,b)=>a-b);
 const scouting=scoutingWeek();if(model.source==='espn'&&!XL.opponentScouting.has(String(scouting)))void loadOpponentScouting(scouting);
 if(model.source==='espn'&&!playerGameCountsStarted)void ensurePlayerGameCounts();
 const period=String(XL.positionCompareWeek||'all'),mode=XL.positionComparisonView||'position';
 const normalize=p=>p.pos==='D/ST'?'DEF':p.pos;
 const gradeSignature=[model,XL.free.length,XL.advanced.size,XL.gamesStatus||'',Number(model.currentWeek||0)];
 const grades=positionGradeCache&&gradeSignature.every((x,i)=>positionGradeCache.signature[i]===x)
  ?positionGradeCache.grades:gradePositionPool([...owned.map(e=>e.p),...free]);
 positionGradeCache={signature:gradeSignature,grades}; // invariant across displayed pool filters
 const rows=chosen.map(p=>{
  const s=summarize(p),item=findOwned(p),team=item?.team||null;
  const points=period==='all'?s.total:labNum(p.scores?.[period]);
  const startCount=startCountByPlayer.get(String(p.id))||0;
  const grade=grades.get(String(p.id));
  return {p,team,pos:normalize(p),points,starts:startCount,
   perStart:playedPointsAverage(p),
   ppg:playedPointsAverage(p),best:s.best,reported:observedPlayerGames(p).games,grade,opp:opponentScoutingFor(p,scouting),
   project:labNum(p.espnProj),owned:labNum(p.owned),recent:s.recent,std:s.std,status:p.status||'—'};
 });
 const sections=mode==='position'?POS_ORDER.filter(pos=>XL.positionComparePos==='ALL'||pos===XL.positionComparePos).map(pos=>({name:pos,rows:rows.filter(x=>x.pos===pos),color:COLORS[pos]})):
 [...model.teams.map(team=>({name:teamName(team),team,rows:rows.filter(x=>x.team&&String(x.team.id)===String(team.id)&&(XL.positionComparePos==='ALL'||x.pos===XL.positionComparePos)),color:'#4f809e'})),
 ...(pool!=='ROSTERED'?[{name:'FREE AGENT POOL',rows:rows.filter(x=>!x.team&&(XL.positionComparePos==='ALL'||x.pos===XL.positionComparePos)),color:'#8a7189'}]:[])];
 const filterBar=`<div class="lab-controls position-compare-controls"><div class="compare-mode-toggle" role="group" aria-label="Group player comparisons"><button type="button" class="${mode==='position'?'selected':''}" data-position-view="position" aria-pressed="${mode==='position'}">BY POSITION</button><button type="button" class="${mode==='team'?'selected':''}" data-position-view="team" aria-pressed="${mode==='team'}">BY FRANCHISE</button></div><label>PLAYER POOL<select id="position-player-pool"><option value="ROSTERED" ${pool==='ROSTERED'?'selected':''}>ROSTERED</option><option value="FREE" ${pool==='FREE'?'selected':''}>FREE AGENTS</option><option value="ALL" ${pool==='ALL'?'selected':''}>ALL LOADED PLAYERS</option></select></label><label>POSITION<select id="position-compare-position">${['ALL',...POS_ORDER].map(pos=>`<option value="${pos}" ${XL.positionComparePos===pos?'selected':''}>${pos==='DEF'?'D/ST':pos}</option>`).join('')}</select></label><label>SCORING PERIOD<select id="position-compare-week"><option value="all" ${period==='all'?'selected':''}>FULL SEASON</option>${weeks.map(w=>`<option value="${w}" ${period===String(w)?'selected':''}>WEEK ${String(w).padStart(2,'0')}</option>`).join('')}</select></label><label>SORT<select id="position-player-sort"><option value="GRADE" ${sort==='GRADE'?'selected':''}>GRIDIRON GRADE</option><option value="POINTS" ${sort==='POINTS'?'selected':''}>FANTASY PTS</option><option value="PPG" ${sort==='PPG'?'selected':''}>PTS / GAME</option><option value="BEST" ${sort==='BEST'?'selected':''}>BEST GAME</option></select></label></div>`;
 const value=r=>sort==='GRADE'?r.grade:sort==='PPG'?r.ppg:sort==='BEST'?r.best:r.points;
 const renderContext=[mode,pool,XL.positionComparePos,period,sort].join('|');
 const sectionsHTML=sections.map(g=>{
  const sorted=g.rows.slice().sort((a,b)=>(value(b)??-Infinity)-(value(a)??-Infinity)||(b.points??-Infinity)-(a.points??-Infinity)||a.p.name.localeCompare(b.p.name));
  const observed=sorted.filter(r=>r.points!==null),sum=labSum(observed.map(r=>r.points)),max=observed.reduce((highest,r)=>Math.max(highest,Math.max(0,r.points)),1);
  const totalKnown=labSum(rows.filter(r=>r.points!==null).map(r=>r.points));
  const pageKey=renderContext+'|'+g.name;
  const visibleLimit=XL.positionRowsVisible.get(pageKey)||30;
  const rowMarkup=sorted.slice(0,visibleLimit).map((r,i)=>{
   const share=sum>0&&r.points!==null?r.points/sum*100:null;
   const color=COLORS[r.pos]||g.color,grade=r.grade,opp=r.opp;
   const status=opp.opponent?`vs ${opp.opponent}`:'BYE / TBA';
   const opposition=opp.rank!==null?`#${String(opp.rank).padStart(2,'0')} / ${labFormat(opp.ppg,1)} PPG`:'—';
   const franchise=r.team?`<button type="button" data-set-team="${esc(String(r.team.id))}" class="position-rich-team" title="Open ${esc(teamName(r.team))}">${esc(mode==='position'?teamName(r.team):r.pos==='DEF'?'D/ST':r.pos)}</button>`:`<span class="position-free-label">${mode==='team'?r.pos:'FREE AGENT'}</span>`;
   return `<div class="position-player-rich-row"><small class="position-player-place">${String(i+1).padStart(2,'0')}</small><button type="button" data-open-player="${esc(String(r.p.id))}" class="position-rich-name">${esc(r.p.name)}</button>${franchise}<button class="position-rich-meter" type="button" data-open-player="${esc(String(r.p.id))}" title="Open ${esc(r.p.name)}"><i style="width:${r.points===null?0:Math.max(0,r.points)/max*100}%;background:${color}"></i></button><strong>${labFormat(r.points,1)}</strong><span>${labPct(share)}</span><span>${labFormat(r.perStart,1)}</span><span>${labFormat(r.best,1)}</span><b class="position-player-grade ${grade!==null&&grade>=65?'good-grade':''}" title="${grades.basis.get(String(r.p.id))==='ppg-only'?'PPG-only grade using verified played-game count':'Composite grade from at least three recorded weeks'}">${grade===null?'—':`${grades.basis.get(String(r.p.id))==='ppg-only'?'~':''}${labFormat(grade,0)}`}</b><span>${r.reported??'—'}</span><span>${labFormat(r.recent,1)}</span><span>${labFormat(r.std,1)}</span><span class="position-availability" title="ESPN reported player availability">${esc(r.status)}</span><span class="position-opponent" title="NFL Week ${scouting} opponent from ESPN game schedule">${esc(status)}</span><span class="position-strength" title="${esc(opp.basis)} rank by NFL scored/allowed points per completed game; lower allowed = stronger defense">${opposition}</span><span>${labFormat(r.project,1)}</span><span>${labPct(r.owned)}</span></div>`;
  }).join('');
  const head=`<div class="position-rich-head"><span>RANK</span><span>PLAYER</span><span>${mode==='team'?'POS':'FRANCHISE'}</span><span>SCORING</span><span>PTS</span><span>SHARE</span><span>PTS/GAME</span><span>BEST</span><span>GRADE</span><span>GP</span><span>LAST 3</span><span>σ</span><span>STATUS</span><span>WK ${scouting} OPP</span><span>${'OPP NFL RANK / PPG'}</span><span>PROJ</span><span>ROST%</span></div>`;
  return `<section class="lab-panel position-league-panel"><header class="position-league-head"><h4>${g.team?`<button type="button" class="comparison-team-title" data-set-team="${esc(String(g.team.id))}">${esc(g.name)}</button>`:`<span class="position-chip" style="border-color:${g.color}">${esc(g.name==='DEF'?'D/ST':g.name)}</span>`} · ${g.rows.length} PLAYERS</h4><span class="position-inline-insight">${observed.length} REPORTED · ${labFormat(sum,1)} PTS · ${labPct(totalKnown>0?sum/totalKnown*100:null)} OF DISPLAYED POOL</span></header><div class="position-rich-scroll">${head}${rowMarkup||'<p class="lab-note">No players match these filters.</p>'}</div>${sorted.length>visibleLimit?`<div class="position-compare-pager"><span>SHOWING ${visibleLimit} OF ${sorted.length} · FULL-POOL RANKINGS</span><button type="button" class="lab-action" data-position-show-more="${esc(pageKey)}">SHOW 30 MORE ↓</button></div>`:''}</section>`;
 }).join('');
 const loading=pool!=='ROSTERED'&&model.source==='espn';
 const loader=loading?`<div class="position-pool-status">${XL.freeBusy?'LOADING AVAILABLE PLAYERS…':`<b>${free.length}</b> free agents loaded · ${XL.freeLoaded?'Load another page to broaden rankings.':'ESPN pool not loaded.'}`} <button type="button" class="lab-action" id="position-load-more" ${XL.freeBusy?'disabled':''}>${XL.freeLoaded?'LOAD MORE':'LOAD FREE AGENTS'}</button>${XL.freeError?` <small>${esc(XL.freeError)}</small>`:''}</div>`:'';
 const description=`Compare ${pool==='FREE'?'available free agents':pool==='ALL'?'all loaded players':'rostered players'} with NFL Week ${scouting} opponent strength. NFL rank is by completed-game points allowed (or points scored for D/ST), not fantasy points allowed by position.`;
 const resultHTML=(XL.gamesStatus?`<div class="position-game-source">${esc(XL.gamesStatus)}</div>`:'')+loader+sectionsHTML+
 `<section class="position-grade-method"><b>GRIDIRON POSITION GRADE · 0–100</b><p>Within each position, a descriptive score using 60% season fantasy points per reported game, 25% last-three average, and 15% lower relative scoring volatility. Percentile components are shrunk toward 50 for small samples. A player needs at least three recorded scoring weeks; unavailable metrics and zero-data free agents receive no grade. This is <b>not</b> a projection or ESPN ranking. Player share uses the displayed group. PTS/GAME uses official NFL games played when supplied by nflverse; otherwise it uses actual recorded scoring weeks and does not divide an incomplete season total by a partial log. A '~' grade is PPG-only when recent scoring history is missing. NFL opponent ranks reflect overall points scored/allowed per completed game, not defense versus a particular fantasy position.</p></section>`;
 const content=el('explore-content');
 const results=content.querySelector('#position-compare-results');
 // Keep native filter controls mounted, and never discard focused <select>s
 // while Safari is still handling their change event.
 if(results&&content.querySelector('#position-player-pool')){
  const caption=content.querySelector('#position-compare-intro p');
  if(caption)caption.textContent=description;
  content.querySelectorAll('[data-position-view]').forEach(btn=>{const selected=btn.dataset.positionView===mode;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));});
  const previousScroll=content.scrollTop;
  results.innerHTML=resultHTML;
  results.dataset.renderKey=`${pool}/${XL.positionComparePos}/${period}/${sort}`;
  content.scrollTop=previousScroll;
 }else{
  setExplorer(`<div class="lab-intro" id="position-compare-intro"><h3>Player pool / position analytics</h3><p>${esc(description)}</p></div>`+filterBar+`<div id="position-compare-results" data-render-key="${pool}/${XL.positionComparePos}/${period}/${sort}">${resultHTML}</div>`);
 }
 recordFilterDiagnostic('render',`${pool}/${XL.positionComparePos}/${period}/${sort}; ${chosen.length} players`);
}
// The league weekly comparison defaults to WEEK -> teams, with TEAM -> weeks
// as an alternate view. Both use exactly the same recorded input observations.
function detailLeagueContributions(){
 const rows=model.teams.map(team=>({team,rows:starterPositionRows(team)}));
 const officialFor=(team,w)=>{const h=team.history?.find(r=>Number(r.week)===w);const v=labNum(h?.points);if(v!==null)return v;return Number(team.currentMatchup?.week)===w?labNum(team.currentMatchup?.points):null;};
 const weeks=[...new Set(rows.flatMap(({team,rows:rs})=>[...rs.map(x=>x.week),...(team.history||[]).filter(h=>labNum(h.points)!==null).map(x=>Number(x.week)),Number(team.currentMatchup?.week)].filter(w=>Number.isFinite(w)&&w>0)))].sort((a,b)=>a-b);
 const pos=XL.leagueComparisonPos||'ALL',mode=XL.leagueComparisonView||'week';
 const point=(team,w)=>{
  const source=rows.find(r=>String(r.team.id)===String(team.id));const all=source?.rows||[];
  const current=all.filter(r=>r.week===w&&(pos==='ALL'||r.pos===pos));
  const has=current.length>0;const official=!has&&pos==='ALL'?officialFor(team,w):null;
  const total=has?labSum(current.map(r=>r.points)):official;
  const byPos=POS_ORDER.map(p=>({pos:p,points:labSum(current.filter(r=>r.pos===p).map(r=>r.points))})).filter(x=>x.points>0);
  return {team,week:w,total,neutral:!has&&official!==null,byPos};
 };
 const all=weeks.flatMap(w=>model.teams.map(t=>point(t,w)));
 const max=Math.max(1,...all.map(x=>Math.max(0,x.total||0)));
 const controls=`<div class="lab-controls league-weekly-filters"><div class="compare-mode-toggle" role="group" aria-label="Group weekly scoring comparisons"><button type="button" class="${mode==='week'?'selected':''}" data-league-view="week" aria-pressed="${mode==='week'}">BY WEEK</button><button type="button" class="${mode==='team'?'selected':''}" data-league-view="team" aria-pressed="${mode==='team'}">BY FRANCHISE</button></div><label>SHOW POSITION <select id="league-compare-position">${['ALL',...POS_ORDER].map(z=>`<option value="${z}" ${z===pos?'selected':''}>${z==='ALL'?'ALL POSITIONS':z==='DEF'?'D/ST':z}</option>`).join('')}</select></label><span class="position-comparison-note">One shared point scale · gray indicates official totals with no positional split</span></div>`;
 const bar=x=>{
  const active=x.total!==null;const height=active?Math.max(2,Math.max(0,x.total)/max*168):2;
  return `<div class="league-contribution-week ${x.neutral?'total-only':''}" title="${esc(teamName(x.team))} · W${x.week} · ${active?labFormat(x.total,2)+' PTS':'score unavailable'}"><b>${labFormat(x.total,0)}</b><button type="button" class="league-contribution-bar league-contribution-bar-hit" data-league-week="${x.week}" data-league-team="${esc(String(x.team.id))}" style="height:${height.toFixed(1)}px" aria-label="Open ${esc(teamName(x.team))} week ${x.week} Starting Lineup">${x.neutral?'<i style="height:100%;background:#9aa5a4"></i>':x.byPos.map(g=>`<i style="height:${(g.points/Math.max(x.total||0,.01)*100).toFixed(2)}%;background:${COLORS[g.pos]}"></i>`).join('')}</button><span class="league-contribution-team-label">${mode==='week'?esc(teamName(x.team)):String(x.week).padStart(2,'0')}</span></div>`;
 };
 const groups=mode==='week'?weeks.map(w=>({week:w,items:model.teams.map(t=>point(t,w))})):model.teams.map(team=>({team,items:weeks.map(w=>point(team,w))}));
 const panels=groups.map(group=>{
  const items=group.items,available=items.filter(x=>x.total!==null),sum=labSum(available.map(x=>x.total));
  const title=mode==='week'?`WEEK ${String(group.week).padStart(2,'0')}`:teamName(group.team);
  const name=`<strong>${esc(title)}</strong>`;
  return `<section class="lab-panel league-contribution-franchise"><div class="league-contribution-franchise-heading">${name}<span>${available.length} / ${items.length} REPORTED · ${labFormat(available.length?sum:null,1)} PTS</span></div><div class="league-contribution-scroll"><div class="league-contribution-bars ${mode==='week'?'league-bars-by-week':''}">${items.map(bar).join('')}</div></div></section>`;
 }).join('');
 const leg=POS_ORDER.filter(p=>pos==='ALL'||p===pos).map(p=>`<span><i style="background:${COLORS[p]}"></i>${p==='DEF'?'D/ST':p}</span>`).join('')+(pos==='ALL'?'<span><i style="background:#9aa5a4"></i>OFFICIAL TOTAL ONLY</span>':'');
 setExplorer(heading('League / weekly scoring comparison',mode==='week'?'Each week compares all franchises at the same scale; switch to By Franchise for scoring history.':'Each franchise shows its recorded weekly position contributions. Switch to By Week for head-to-head comparisons.')+controls+`<div class="position-legend league-comparison-legend">${leg}</div><div class="league-comparison-grid ${mode==='week'?'league-grouped-by-week':''}">${panels||'<p class="lab-note">No reported weekly team scores have been supplied.</p>'}</div><p class="lab-note">Colored segments represent recorded starting-player contributions. Neutral totals are official fantasy team scores where the position breakdown is unavailable. A bar opens that week’s Starting Lineup; missing totals are never set to zero.</p>`);
}

const slotName=id=>({0:'QB',2:'RB',4:'WR',6:'TE',16:'D/ST',17:'K',20:'BENCH',21:'IR',23:'FLEX',24:'RB/WR/TE'}[Number(id)]||'FLEX');
function sideLineup(t,week){const h=t?.history.find(x=>Number(x.week)===Number(week))||(Number(week)===Number(model.currentWeek)?{week,points:t?.currentMatchup?.points??null,lineup:t?.currentLineup||[],starters:{}}:null);if(!h)return {h:null,items:[]};let entries=(h.lineup||[]).map(x=>({...x,p:model.players[x.id]})).filter(x=>x.p);
 if(!entries.length)entries=Object.entries(h.starters||{}).map(([id,points])=>({id,slot:null,points,projected:null,starter:true,p:model.players[id]})).filter(x=>x.p);
 const slotOrder={0:0,2:1,4:3,6:5,23:6,24:6,3:6,5:6,16:7,17:8};
 const posOrder={QB:0,RB:1,WR:3,TE:5,FLEX:6,DEF:7,'D/ST':7,K:8};
 const slotRank=e=>{const slot=Number(e.slot);return e.slot!==null&&Object.hasOwn(slotOrder,slot)?slotOrder[slot]:(posOrder[e.p?.pos]??9)};
 entries.sort((a,b)=>Number(b.starter)-Number(a.starter)||slotRank(a)-slotRank(b)||(a.order??0)-(b.order??0)||String(a.p?.name||'').localeCompare(String(b.p?.name||'')));
 return {h,items:entries};}
function matchupLines(t,week){
 if(!t)return '<div class="lab-panel">No opponent box score is recorded.</div>';
 const data=weeklyLineupData(t,week),{starters,bench,projFor,scoreFor}=data;
 const tr=e=>{
   const p=e.p,actual=scoreFor(e),projected=projFor(e);
   const stat=describeStatline(p,week),injured=/^(OUT|IR|DOUBTFUL|QUESTIONABLE)/i.test(String(p.status||''));
   return `<tr class="lab-clickable matchup-player-row ${e.isSub?'franchise-substituted':''}" data-open-player="${esc(String(e.id))}" tabindex="0" role="button" aria-label="Open ${esc(p.name)} player dossier"><td class="franchise-slot-cell">${lineupPickerButton(data,e,!e.starter)}</td><td class="matchup-player-name"><strong title="${esc(p.name)}">${esc(p.name)}</strong>${injured?`<small title="${esc(p.status)}"> ${esc(p.status)}</small>`:''}</td><td class="matchup-numeric">${labFormat(projected,2)}</td><td class="matchup-numeric"><strong>${labFormat(actual,2)}</strong></td><td class="matchup-statline" title="${esc(stat)}"><span>${esc(stat)}</span></td></tr>`;
 };
 // The official score is immutable. Both official and what-if totals remain
 // legible beneath their corresponding columns after a substitution.
 const official=labFormat(data.officialDisplay,2),officialTag=data.official===null&&data.officialDisplay!==null?' (COMPUTED)':'';
 const officialRaw=formatRecordedTotals(data.originalStarters,[week]);
 const officialProjs=data.originalStarters.map(projFor).filter(v=>v!==null);
 const officialProjection=officialProjs.length?labSum(officialProjs):null;
 const scenarioRaw=formatRecordedTotals(starters,[week]);
 const officialRow=`<tr class="matchup-total-row matchup-official-row"><td colspan="2"><b>OFFICIAL${officialTag}</b> · ${starters.length} STARTERS</td><td class="matchup-numeric">${labFormat(officialProjection,2)}</td><td class="matchup-numeric"><b>${official}</b></td><td class="matchup-statline">${rawTotalCell(officialRaw)}</td></tr>`;
 const whatIfRow=data.changes?`<tr class="matchup-total-row matchup-simulation-row"><td colspan="2"><b>WHAT-IF</b>${!data.completeActual?' · PARTIAL':''}</td><td class="matchup-numeric">${labFormat(data.computedProjection,2)}</td><td class="matchup-numeric"><b>${labFormat(data.displayedTotal,2)}</b></td><td class="matchup-statline">${rawTotalCell(scenarioRaw)}</td></tr>`:'';
 return `<div class="lab-panel matchup-franchise-panel" data-matchup-team="${esc(String(t.id))}" data-lineup-team="${esc(String(t.id))}" data-lineup-week="${week}" tabindex="0" role="button" aria-label="Open ${esc(teamName(t))} starting lineup"><div class="lab-match-team"><div><small>${esc(record(t))}</small><div class="matchup-team-heading"><h4 title="${esc(teamName(t))}">${esc(teamName(t))}</h4>${data.changes?lineupReset(data):''}</div></div><div class="matchup-franchise-score"><strong>${labFormat(data.displayedTotal,2)}</strong><small data-matchup-progress="${esc(String(t.id))}">${progressLabel(data)}</small>${data.changes?`<small>WHAT-IF${!data.completeActual?' (PARTIAL)':''}</small>`:''}</div></div>
 ${expandTable(['SLOT','PLAYER','PROJ','FPTS','BOX SCORE'],[...starters.map(tr),officialRow,whatIfRow,...(bench.length?['<tr class="lab-subhead"><td colspan="5">BENCH / IR</td></tr>']:[]),...bench.map(tr)],'matchup-whatif-table')}
 ${!starters.length?'<p class="lab-note">ESPN did not supply starting lineup entries for this week; official team totals are used when available.</p>':''}</div>`;
}
function matchupWeekList(t){
 return [...new Set([...(t.history||[]).map(h=>Number(h.week)),Number(model.currentWeek||model.liveWeek||currentWeek||0)].filter(w=>w>=1&&w<=18))].sort((a,b)=>a-b);
}
function detailMatchup(){
 const t=explorerTeam(),weeks=matchupWeekList(t),wk=weeks.includes(Number(XL.viewWeek))?Number(XL.viewWeek):weeks.at(-1)||1;
 XL.viewWeek=wk;
 const h=t.history.find(x=>Number(x.week)===wk)||(Number(t.currentMatchup?.week)===wk?t.currentMatchup:null);
 const op=findTeam(h?.opponentId),ourData=weeklyLineupData(t,wk),theirData=op?weeklyLineupData(op,wk):null;
 const status=wk===Number(model.currentWeek||model.liveWeek)?'CURRENT / PROVISIONAL':'HISTORICAL / REPORTED';
 const boardSide=(team,data)=>`<div><small>${esc(team?teamName(team):'BYE / UNAVAILABLE')}</small><b>${labFormat(data?.displayedTotal,2)}</b><span>${team?esc(record(team)):''}</span>${data?.changes?`<span class="matchup-score-whatif">WHAT-IF${!data.completeActual?' (PARTIAL)':''} · OFFICIAL ${labFormat(data.officialDisplay,2)}</span>`:data?.official===null&&data?.displayedTotal!==null?`<span>${data.completeActual?'STARTERS REPORTED':'PARTIAL · UNREPORTED SCORES'}</span>`:''}</div>`;
 setExplorer(`<div class="lab-intro"><h3 class="matchup-heading">Week <select id="lab-match-week" class="matchup-heading-week" aria-label="Choose matchup week">${weeks.map(w=>`<option value="${w}" ${w===wk?'selected':''}>${String(w).padStart(2,'0')}</option>`).join('')}</select> / Matchup box score</h3><p>${status} · Select a player for their dossier, a slot for a what-if substitution, or a team box score for its focused Starting Lineup report.</p></div>`+
 `${model.source==='espn'?`<a class="matchup-espn-link matchup-under-title" href="https://fantasy.espn.com/football/league?leagueId=${encodeURIComponent(model.leagueId)}" target="_blank" rel="noopener noreferrer">VIEW ON ESPN ↗</a>`:''}`+
 `<div class="lab-scoreboard">${boardSide(t,ourData)}<strong>VS</strong>${boardSide(op,theirData)}</div>`+
 `<div class="lab-two match-columns">${matchupLines(t,wk)}${op?matchupLines(op,wk):'<div class="lab-panel">No opponent box score is recorded.</div>'}</div>`+
 `<p class="lab-note">The scoreboard uses official ESPN team points when available; otherwise it sums reported starters. What-if substitutions recalculate each side separately and never change ESPN rosters. A dash means the source has not reported a result.</p>`);
 if(wk===Number(model.currentWeek||model.liveWeek||currentWeek))void fetchNFLWeekState(wk);
}
function playerTitle(p){return `${p.name} / ${p.pos} / ${p.nfl}`}
function describeStatline(p,w){const row=p.statlines?.[w];if(!row)return '—';const out=[];for(const [metric,key] of Object.entries(ESPNSTAT)){if(!['pass_yds','pass_td','rush_yds','rush_att','rec_yds','receptions','targets','rec_td','int'].includes(metric))continue;const v=labNum(row[key]);if(v!==null&&(v!==0||(metric==='targets'&&['WR','RB','TE'].includes(p.pos))))out.push(`${labFormat(v,0)} ${metric.replace('_',' ')}`);}return out.length?out.join(' · '):'—'}
// Deep statistical archive, all views use the same recorded season logs and
// known NFL raw stats. A dash means unreported — never guessed as zero.
const PLAYER_GAMELOG_GROUPS=[
 ['PASSING',[['pass_cmp','CMP'],['pass_att','ATT'],['pass_yds','PASS YDS'],['pass_td','PASS TD'],['int','INT']]],
 ['RUSHING',[['rush_att','CARRIES'],['rush_yds','RUSH YDS'],['rush_td','RUSH TD']]],
 ['RECEIVING',[['targets','TARGETS'],['receptions','REC'],['rec_yds','REC YDS'],['rec_td','REC TD']]],
 ['KICKING',[['fg_0_19','FG 0–19'],['fg_20_29','FG 20–29'],['fg_30_39','FG 30–39'],['fg_40_49','FG 40–49'],['fg_50','FG 50+'],['pat','PAT']]],
 ['DEFENSE',[['dst_sacks','SACKS'],['dst_int','INT'],['dst_fum','FUM REC'],['dst_td','DEF TD'],['dst_safety','SAFETIES']]]
];
const PLAYER_GAMELOG_EXTRA_IDS={fg_0_19:'74',fg_20_29:'75',fg_30_39:'76',fg_40_49:'77',fg_50:'78',pat:'80',dst_sacks:'89',dst_int:'90',dst_fum:'91',dst_td:'93',dst_safety:'95'};
function playerLogWeeks(p){return [...new Set([...Object.keys(p.scores||{}),...Object.keys(p.projections||{}),...Object.keys(p.statlines||{})].map(Number).filter(w=>Number.isInteger(w)&&w>0&&w<=18))].sort((a,b)=>a-b);}
function playerRawWeek(p,week,key){const data=p.statlines?.[week];if(!data)return null;return labNum(data[ESPNSTAT[key]||PLAYER_GAMELOG_EXTRA_IDS[key]]);}
function playerLogCsv(p){
 const header=['week','fantasy_points','espn_projection',...PLAYER_GAMELOG_GROUPS.flatMap(g=>g[1].map(x=>x[0]))];
 const rows=playerLogWeeks(p).map(w=>[w,p.scores?.[w]??'',p.projections?.[w]??'',...header.slice(3).map(k=>playerRawWeek(p,w,k)??'')]);
 const escapeCsv=v=>'"'+String(v).replaceAll('"','""')+'"';
 const csv=[header,...rows].map(row=>row.map(escapeCsv).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='gridiron-'+nameKey(p.name)+'-gamelog-'+model.season+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
// One *continuous* wrapped game-log table. Every band reuses the same week
// rows, with at most six statistical columns; overflowing stat categories
// return on the next band instead of scrolling across the screen.
function detailPlayerAnalytics(playerId){
 const p=model.players[String(playerId)]||XL.free.find(z=>String(z.id)===String(playerId));
 if(!p){setExplorer(heading('Complete game log','Player unavailable in this dataset.'));return;}
 XL.player=String(p.id);
 const all=playerLogWeeks(p),weeks=all; // Entire reported season. No redundant archive filter ribbon.
 const raw=(w,k)=>playerRawWeek(p,w,k);
 const score=w=>labNum(p.scores?.[w]);
 const projection=w=>labNum(p.projections?.[w]);
 const ratio=(numerator,denominator,mult=1)=>denominator!==null&&denominator>0&&numerator!==null?numerator/denominator*mult:null;
 const passer=w=>{
  const at=raw(w,'pass_att'),cmp=raw(w,'pass_cmp'),yards=raw(w,'pass_yds'),td=raw(w,'pass_td'),intercept=raw(w,'int');
  if([at,cmp,yards,td,intercept].some(v=>v===null)||at<=0)return null;
  const clamp=v=>Math.max(0,Math.min(2.375,v));
  return (clamp((cmp/at-.3)*5)+clamp((yards/at-3)*.25)+clamp(td/at*20)+clamp(2.375-intercept/at*25))/6*100;
 };
 const ttl=w=>{const a=raw(w,'rush_att'),b=raw(w,'targets');return a===null&&b===null?null:(a||0)+(b||0)};
 const fields=[
  ['FANTASY SCORING',[
   ['SCORE','FPTS',score],['PROJ','ESPN PROJ',projection],['DIFF','+/−',w=>score(w)!==null&&projection(w)!==null?score(w)-projection(w):null],
   ['3WK AVG','ROLLING AVG',w=>{const seen=weeks.filter(v=>v<=w&&score(v)!==null).slice(-3).map(score);return seen.length?labSum(seen)/seen.length:null}],
   ['20+','20+ PTS',w=>score(w)===null?null:score(w)>=20?1:0],['NFL DATA','RAW REPORTED',w=>p.statlines?.[w]&&Object.keys(p.statlines[w]).length?1:null]]],
  ['PASSING · VOLUME',[
   ['CMP','PASS CMP',w=>raw(w,'pass_cmp')],['ATT','PASS ATT',w=>raw(w,'pass_att')],['YDS','PASS YDS',w=>raw(w,'pass_yds')],['TD','PASS TD',w=>raw(w,'pass_td')],['INT','PASS INT',w=>raw(w,'int')],
   ['YPA','PASS YDS / ATT',w=>ratio(raw(w,'pass_yds'),raw(w,'pass_att'))]]],
  ['PASSING · EFFICIENCY',[
   ['CMP%','COMPLETION %',w=>ratio(raw(w,'pass_cmp'),raw(w,'pass_att'),100)],['NFL RTG','CALC PASSER RTG',passer],
   ['TD%','PASS TD RATE',w=>ratio(raw(w,'pass_td'),raw(w,'pass_att'),100)],['INT%','INT RATE',w=>ratio(raw(w,'int'),raw(w,'pass_att'),100)],
   ['PASS YDS','YARDS',w=>raw(w,'pass_yds')],['TOTAL TD','PASS + RUSH TD',w=>{const a=raw(w,'pass_td'),b=raw(w,'rush_td');return a===null&&b===null?null:(a||0)+(b||0); }]]],
  ['RUSHING · PRODUCTION',[
   ['CAR','RUSH ATT',w=>raw(w,'rush_att')],['YDS','RUSH YDS',w=>raw(w,'rush_yds')],['TD','RUSH TD',w=>raw(w,'rush_td')],
   ['YPC','YDS / CARRY',w=>ratio(raw(w,'rush_yds'),raw(w,'rush_att'))],
   ['REC','RECEPTIONS',w=>raw(w,'receptions')],['OPP','RUSHES + TARGETS',ttl]]],
  ['RECEIVING · VOLUME',[
   ['TGT','TARGETS',w=>raw(w,'targets')],['REC','RECEPTIONS',w=>raw(w,'receptions')],['YDS','REC YDS',w=>raw(w,'rec_yds')],['TD','REC TD',w=>raw(w,'rec_td')],
   ['YPT','YDS / TARGET',w=>ratio(raw(w,'rec_yds'),raw(w,'targets'))],['YPR','YDS / RECEPTION',w=>ratio(raw(w,'rec_yds'),raw(w,'receptions'))]]],
  ['RECEIVING · EFFICIENCY',[
   ['CATCH%','CATCH RATE',w=>ratio(raw(w,'receptions'),raw(w,'targets'),100)],['TGT','TARGETS',w=>raw(w,'targets')],['REC','RECEPTIONS',w=>raw(w,'receptions')],
   ['YPC','REC YDS / REC',w=>ratio(raw(w,'rec_yds'),raw(w,'receptions'))],['REC TD','RECEIVING TD',w=>raw(w,'rec_td')],
   ['FPTS/OPP','FPTS / OPPORTUNITY',w=>ratio(score(w),ttl(w))]]],
  ['KICKING · CONVERSIONS',[
   ['0–19','FG 0–19',w=>raw(w,'fg_0_19')],['20–29','FG 20–29',w=>raw(w,'fg_20_29')],['30–39','FG 30–39',w=>raw(w,'fg_30_39')],
   ['40–49','FG 40–49',w=>raw(w,'fg_40_49')],['50+','FG 50+',w=>raw(w,'fg_50')],['PAT','EXTRA POINTS',w=>raw(w,'pat')]]],
  ['DEFENSE / SPECIAL TEAMS',[
   ['SACK','DEF SACKS',w=>raw(w,'dst_sacks')],['INT','DEF INT',w=>raw(w,'dst_int')],['FUM REC','FUM RECOVERED',w=>raw(w,'dst_fum')],
   ['TD','DEF TD',w=>raw(w,'dst_td')],['SFTY','SAFETIES',w=>raw(w,'dst_safety')],['FPTS','FANTASY PTS',score]]]
 ];
 const totals={};const need=(w,k)=>raw(w,k);
 const sumStat=k=>{const v=weeks.map(w=>need(w,k)).filter(x=>x!==null);return v.length?labSum(v):null;};
 const sumScore=weeks.map(score).filter(v=>v!==null),sumProjection=weeks.map(projection).filter(v=>v!==null);
 const sumPoints=sumScore.length?labSum(sumScore):null;
 const sumFor=field=>{
  const [key]=field;
  if(key==='SCORE'||key==='FPTS')return sumPoints;
  if(key==='PROJ')return sumProjection.length?labSum(sumProjection):null;
  if(key==='DIFF')return sumScore.length===weeks.length&&sumProjection.length===weeks.length?labSum(sumScore)-labSum(sumProjection):null;
  if(key==='3WK AVG')return sumScore.length?labSum(sumScore)/sumScore.length:null;
  if(key==='20+')return sumScore.filter(x=>x>=20).length;
  if(key==='NFL DATA')return weeks.filter(w=>p.statlines?.[w]&&Object.keys(p.statlines[w]).length).length;
  if(key==='CMP'||key==='PASS YDS')return sumStat(key==='CMP'?'pass_cmp':'pass_yds');
  if(key==='CAR')return sumStat('rush_att');
  if(key==='TGT')return sumStat('targets');
  if(key==='REC')return sumStat('receptions');
  if(key==='YDS')return null; // category-dependent below
  if(key==='TD'||key==='INT'||key==='ATT'||key==='PAT'||key==='SACK'||key==='FUM REC'||key==='SFTY'||key==='0–19'||key==='20–29'||key==='30–39'||key==='40–49'||key==='50+')return null; // resolved by a category-aware reducer below
  return null;
 };
 const categoryTotal=(category,f)=>{
  const [label,desc,fn]=f;
  const stats=PLAYER_GAMELOG_GROUPS.find(g=>g[0]===category)?.[1]||[];
  const key=stats.find(([,alias])=>alias===label)?.[0];
  if(key)return sumStat(key);
  // Aggregated ratios use aggregated recorded numerators and denominators,
  // never a sum of percentages or a sum of per-week efficiencies.
  const S=sumStat;
  if(label==='YPA'&&category.startsWith('PASSING'))return ratio(S('pass_yds'),S('pass_att'));
  if(label==='CMP%')return ratio(S('pass_cmp'),S('pass_att'),100);
  if(label==='TD%')return ratio(S('pass_td'),S('pass_att'),100);
  if(label==='INT%')return ratio(S('int'),S('pass_att'),100);
  if(label==='CATCH%')return ratio(S('receptions'),S('targets'),100);
  if(label==='YPC'&&category.startsWith('RUSHING'))return ratio(S('rush_yds'),S('rush_att'));
  if(label==='YPC'&&category.startsWith('RECEIVING'))return ratio(S('rec_yds'),S('receptions'));
  if(label==='YPT')return ratio(S('rec_yds'),S('targets'));
  if(label==='YPR')return ratio(S('rec_yds'),S('receptions'));
  if(label==='OPP'){const a=S('rush_att'),b=S('targets');return a===null&&b===null?null:(a||0)+(b||0);}
  if(label==='FPTS/OPP'){const a=S('rush_att'),b=S('targets');return ratio(sumPoints,a===null&&b===null?null:(a||0)+(b||0));}
  if(label==='TOTAL TD'){const a=S('pass_td'),b=S('rush_td');return a===null&&b===null?null:(a||0)+(b||0);}
  if(label==='NFL RTG')return null; // never sum weekly passer ratings
  if(category.startsWith('PASSING'))return S(({'CMP':'pass_cmp','ATT':'pass_att','YDS':'pass_yds','TD':'pass_td','INT':'int','PASS YDS':'pass_yds'})[label]);
  if(category.startsWith('RUSHING'))return S(({'CAR':'rush_att','YDS':'rush_yds','TD':'rush_td','REC':'receptions'})[label]);
  if(category.startsWith('RECEIVING'))return S(({'TGT':'targets','REC':'receptions','YDS':'rec_yds','TD':'rec_td','REC TD':'rec_td'})[label]);
  if(category.startsWith('KICKING'))return S(({'0–19':'fg_0_19','20–29':'fg_20_29','30–39':'fg_30_39','40–49':'fg_40_49','50+':'fg_50','PAT':'pat'})[label]);
  if(category.startsWith('DEFENSE'))return S(({'SACK':'dst_sacks','INT':'dst_int','FUM REC':'dst_fum','TD':'dst_td','SFTY':'dst_safety'})[label]);
  return sumFor(f);
 };
 const isRatio=label=>['YPA','CMP%','NFL RTG','TD%','INT%','YPC','YPT','YPR','CATCH%','FPTS/OPP','3WK AVG'].includes(label);
 const selectedFields=fields.filter(([title,columns])=>XL.playerArchiveAll||title==='FANTASY SCORING'||title.startsWith('POSITION PEERS')||weeks.some(w=>columns.some(([, ,fn])=>fn(w)!==null)));
 const bandHTML=selectedFields.map(([title,columns],band)=>{
  // The same compact seven-column grid is reused for every stat band.
  const headings=['WEEK',...columns.map(([,desc])=>desc)];
  const rows=weeks.map(w=>`<tr class="lab-clickable archive-week-row" data-gamelog-week="${w}" tabindex="0" role="button" title="Open Week ${w} lineup"><th scope="row">W${String(w).padStart(2,'0')}</th>${columns.map(([label,,fn])=>`<td>${labFormat(fn(w),label.includes('%')?1:label==='FPTS'||label==='SCORE'||label==='PROJ'||label==='DIFF'||isRatio(label)?2:0)}</td>`).join('')}</tr>`).join('');
  const aggregate=columns.map(field=>{
   const v=categoryTotal(title,field),decimal=isRatio(field[0])||['SCORE','FPTS','PROJ','DIFF','YDS'].includes(field[0]);
   return `<td>${labFormat(v,decimal?2:0)}</td>`;
  }).join('');
  const averages=columns.map(field=>{
   const v=categoryTotal(title,field);const reported=weeks.filter(w=>field[2](w)!==null).length;
   const result=v===null?null:isRatio(field[0])?v:reported?v/reported:null;
   return `<td>${labFormat(result,2)}</td>`;
  }).join('');
  return `<tbody class="archive-band" data-archive-band="${band}"><tr class="archive-band-title"><th colspan="7">${String(band+1).padStart(2,'0')} / ${esc(title)}</th></tr><tr class="archive-band-columns">${headings.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr>${rows||'<tr><td colspan="7">No recorded weekly data.</td></tr>'}<tr class="archive-grand-total"><th scope="row">TOTAL / RATE</th>${aggregate}</tr><tr class="archive-avg-row"><th scope="row">AVG / REPORTED</th>${averages}</tr></tbody>`;
 }).join('');
 const extra=advancedFor(p);
 const seasonOnly=[['YAC',extra.yac],['AIR YARDS',extra.air_yards],['EPA',extra.epa],['SNAP %',extra.snap_pct],['TARGET SHARE',extra.target_share],['PASSER RTG',extra.passer_rating]].filter(([,value])=>labNum(value)!==null);
 const advancedBand=seasonOnly.length?`<tbody class="archive-band archive-season-extra"><tr class="archive-band-title"><th colspan="7">09 / ADVANCED SEASON TOTALS · IMPORTED DATA</th></tr><tr class="archive-band-columns"><th>PERIOD</th>${Array.from({length:6},(_,i)=>`<th>${esc(seasonOnly[i]?.[0]||'—')}</th>`).join('')}</tr><tr><th scope="row">SEASON</th>${Array.from({length:6},(_,i)=>`<td>${labFormat(seasonOnly[i]?.[1],2)}</td>`).join('')}</tr></tbody>`:'';

 setExplorer(`<div class="archive-banner archive-single-banner"><div><small>GRIDIRON / COMPLETE GAME LOG · ${model.season}</small><h3>${esc(p.name)} <span>${esc(p.pos)} · ${esc(p.nfl)}</span></h3></div><button type="button" class="lab-action" id="player-log-export">EXPORT ALL REPORTED DATA CSV ↗</button></div>`+
 `<div class="archive-matrix-sheet"><table class="archive-wrapped-table" aria-label="Complete game log with wrapped statistical bands">${bandHTML}${advancedBand}</table></div>`+
 `<p class="lab-note">One continuous register: each band repeats the same weeks and wraps the next six metrics below. TOTAL / RATE calculates rates from summed observed components; AVG / REPORTED uses weeks where that field is present. NFL values are actual reported statistics, not estimated from fantasy points. ESPN season totals may be more complete than the displayed weekly period.</p>`);
}

function detailPlayer(playerId){const p=model.players[playerId]||XL.free.find(z=>String(z.id)===String(playerId));if(!p){setExplorer(heading('Player unavailable','This player has no accessible data in the active dataset.'));return;}
 XL.player=String(p.id);const s=summarize(p),games=seriesFor(p);const allweeks=[...new Set([...Object.keys(p.scores||{}),...Object.keys(p.projections||{})].map(Number))].sort((a,b)=>a-b);
 const reportedWeeks=allweeks.filter(w=>labNum(p.scores?.[w])!==null);
 const projectedWeeks=allweeks.filter(w=>labNum(p.projections?.[w])!==null);
 const paired=allweeks.filter(w=>labNum(p.scores?.[w])!==null&&labNum(p.projections?.[w])!==null);
 const logStats=formatRecordedTotals([p],allweeks);
 const logActual=reportedWeeks.length?labSum(reportedWeeks.map(w=>p.scores[w])):null;
 const logProj=projectedWeeks.length?labSum(projectedWeeks.map(w=>p.projections[w])):null;
 const logDiff=paired.length===reportedWeeks.length&&paired.length===projectedWeeks.length&&paired.length?logActual-logProj:null;
 const extras=Object.entries(metricRow(p)).filter(([k,v])=>['pass_att','pass_cmp','pass_yds','pass_td','int','rush_att','rush_yds','rush_td','receptions','rec_yds','rec_td','targets','yac','air_yards','epa','passer_rating','snap_pct'].includes(k)&&labNum(v)!==null);
 const statusColor=/OUT|INJURED|IR|SUSPENDED/i.test(p.status)?'negative-text':'positive-text';
 setExplorer(heading(playerTitle(p),`${esc(p.status||'UNKNOWN')} · ${teamForPlayer(p)?'Rostered: '+teamName(teamForPlayer(p)):'Free agent / not on current team'} · ${model.season}`)+
 playerRankingMetrics(p)+`<div class="player-quick-stats strategy-metrics three">${playerQuickStats(p)}</div>`+
 `<div class="lab-two player-terminal-top"><div class="lab-panel player-chart-pair"><div class="player-weekly-panel" data-chart-surface="${esc(p.id)}" tabindex="0" role="group" aria-label="Open position allocation for ${esc(p.name)}"><h4>WEEKLY POINTS</h4><div class="player-weekly-chart">${games.length?trendBars(games.map(g=>({label:'Week '+g.week,short:'W'+g.week,v:g.points,week:g.week})),(v,i)=>['#487ebb','#399676','#9466bc','#b85d70','#d39b43'][i%5]):'<p>No reported scoring weeks.</p>'}</div></div><div id="player-share-history">${shareHistoryChart(p)}</div></div>${scoutingFile(p)}</div>`+
 `<div class="lab-panel player-complete-log" data-open-player-analytics tabindex="0" role="button" aria-label="Expand complete player statistical archive"><h4>COMPLETE FANTASY GAME LOG <span class="player-log-open">OPEN COMPLETE STATISTICAL FILE ↗</span></h4>${expandTable(['WK','FANTASY POINTS','ESPN PROJECTION','DIFFERENCE','AVAILABLE STATLINE'],allweeks.map(w=>{const actual=labNum(p.scores?.[w]),proj=labNum(p.projections?.[w]);return `<tr class="lab-clickable player-gamelog-row" data-gamelog-week="${w}" tabindex="0" role="button" title="Open Week ${w} starting lineup"><td>W${w}</td><td><strong>${labFormat(actual,2)}</strong></td><td>${labFormat(proj,2)}</td><td class="${actual!==null&&proj!==null?(actual>=proj?'positive-text':'negative-text'):''}">${actual!==null&&proj!==null?labFormat(actual-proj,2):'—'}</td><td class="lab-statline">${esc(describeStatline(p,w))}</td></tr>`}).concat([`<tr class="player-log-total"><td><b>TOTAL · ${reportedWeeks.length} WK</b></td><td><b>${labFormat(logActual,2)}</b></td><td>${labFormat(logProj,2)}</td><td>${logDiff===null?'—':labFormat(logDiff,2)}</td><td class="lab-statline">${rawTotalCell(logStats)}</td></tr>`]))}<p class="lab-note">Scoring is taken from the connected fantasy league. NFL box-score fields appear only when ESPN returned their underlying stat categories.</p></div>`+
 `<div class="lab-two player-terminal-context" id="player-editorial-anchor"><div class="player-terminal-left"><section class="lab-panel player-terminal-stats"><h4>BOX SCORE / ADVANCED STATISTICS</h4>${extras.length?`<div class="player-compact-boxscore">${extras.map(([k,v])=>`<div class="player-boxscore-metric" title="${esc(META[k]?.name||k)}"><span>${esc(META[k]?.name||k)}</span><b>${labFormat(v,2)}</b></div>`).join('')}</div>`:'<p class="lab-note">Raw NFL statistics unavailable. ESPN or advanced CSV data can provide more detail.</p>'}</section><section class="lab-panel player-terminal-outlook"><h4>PLAYER OUTLOOK / PERFORMANCE & NEXT MATCHUP</h4><div id="lab-player-outlook">${playerContextSections(XL.overview.get(String(p.espnId||p.id)),p).outlookHTML}</div><div id="lab-next-matchup" class="next-matchup-line">Next-week opponent: looking up NFL schedule…</div><div class="ai-outlook-action"><button type="button" class="lab-action" id="lab-generate-ai" data-ai-player="${esc(String(p.id))}">GENERATE AI OUTLOOK ↗</button><span id="lab-ai-status">On demand · server API key required</span></div><div id="lab-ai-outlook" class="ai-outlook-result"></div></section></div><section class="lab-panel player-terminal-news"><h4>VERIFIED PLAYER NEWS</h4><div id="lab-player-news">${playerContextSections(XL.overview.get(String(p.espnId||p.id)),p).newsHTML}</div><button class="lab-action" id="lab-fetch-news" data-news-id="${esc(p.espnId||p.id)}">REFRESH SOURCED NEWS ↻</button></section></div>`);
 void hydrateNextMatchup(p);void hydrateAIStatus(p);if(p.espnId)void hydrateProfileEditorial(p);
}
function renderNewsItems(entries,compact=false){
 if(!entries?.length)return '<p class="lab-note">No verified player-specific articles have been returned.</p>';
 return entries.slice(0,compact?3:5).map(a=>{
   const text=esc(a.headline||a.title||'Player update');
   const link=typeof a.url==='string'&&/^https:\/\/[^\s/@]+(?:\/|$)/i.test(a.url)?a.url:null;
   const headline=link?`<a class="player-news-headline" href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="Read original article: ${text}">${text} ↗</a>`:`<strong>${text}</strong>`;
   return `<article class="lab-news">${headline}<small>${esc([a.provider,a.date].filter(Boolean).join(' · ')||'Verified player report')}${!link?' · LINK NOT PROVIDED BY SOURCE':''}</small>${!compact?`<p>${esc(String(a.story||a.summary||a.description||'').slice(0,360))}</p>`:''}</article>`;
 }).join('');
}

function observedPlayerSummary(p){
 if(!p)return '<p class="player-news-fallback">Recorded player scoring is unavailable.</p>';
 const stats=summarize(p),franchise=teamForPlayer(p),values=seriesFor(p);
 const last=values.at(-1),prior=values.slice(-3),recent=prior.length?labSum(prior.map(x=>x.points))/prior.length:null;
 const form=recent!==null&&stats.avg!==null?recent-stats.avg:null;
 const context=stats.games
   ? `${esc(p.name)} recorded ${labFormat(stats.total,1)} fantasy points over ${stats.games} scoring weeks (${labFormat(stats.avg,1)} points per reported week).`
   : `${esc(p.name)} has no reported fantasy scoring weeks in this dataset.`;
 const trend=stats.games?`<p><b>RECENT FORM</b> · The last ${prior.length} reported ${prior.length===1?'game averaged':'games averaged'} ${labFormat(recent,1)} points${form!==null?`, ${form>=0?'+':''}${labFormat(form,1)} relative to the season average`:''}. ${last?`Week ${last.week} was ${labFormat(last.points,1)} points.`:''}</p>`:'';
 const range=stats.best!==null?`<p><b>SCORING RANGE</b> · Best ${labFormat(stats.best,1)}; worst ${labFormat(stats.low,1)}; standard deviation ${labFormat(stats.std,1)} points where calculable.</p>`:'';
 const club=franchise?`<p class="player-overview-affiliation">Fantasy franchise: <b>${esc(teamName(franchise))}</b> · ${esc(p.pos)} / ${esc(p.nfl)}</p>`:`<p class="player-overview-affiliation">${esc(p.pos)} / ${esc(p.nfl)} · Not assigned to a franchise in the loaded league</p>`;
 return `<div class="player-factual-overview"><b>RECORDED PERFORMANCE / DATA OVERVIEW</b><p>${context}</p>${trend}${range}${club}<small>Calculated solely from reported fantasy scoring. These are observations, not source articles or predictions.</small></div>`;
}

function playerContextSections(data,p,compact=false){
 const outlook=data?.outlook;
 const outlookHTML=outlook?.text?
 `<div class="player-outlook"><b>VERIFIED EDITORIAL OUTLOOK</b>${outlook.date?`<small> · ${esc(outlook.date)}</small>`:''}<p>${esc(outlook.text)}</p></div>`:
 observedPlayerSummary(p);
 const stories=data?.articles||[];
 const newsHTML=stories.length?renderNewsItems(stories.slice(0,compact?3:5),compact):
 '<p class="player-news-fallback">No verified player-specific headlines available.</p>';
 return {outlookHTML,newsHTML};
}
function fillDossierContext(node,data,p){
 if(!node)return;
 const pieces=playerContextSections(data,p,true);
 const left=node.querySelector('.dossier-context-outlook .dossier-scroll-copy');
 const right=node.querySelector('.dossier-context-news .dossier-scroll-copy');
 if(left)left.innerHTML=pieces.outlookHTML;
 if(right)right.innerHTML=pieces.newsHTML;
 if(p)void hydrateDossierSchedule(node,p);
}
function renderPlayerOverview(data,compact=false,p=null){
 if(!data)return observedPlayerSummary(p)+'<p class="player-news-fallback">No verified player-specific editorial updates have been retrieved.</p>';
 const outlook=data.outlook;
 const lead=outlook?.text?`<div class="player-outlook"><b>ATTRIBUTED PLAYER OUTLOOK</b>${outlook.date?`<small> · ${esc(outlook.date)}</small>`:''}<p>${esc(outlook.text)}</p></div>`:observedPlayerSummary(p);
 const stories=data.articles||[];
 const articles=stories.length?renderNewsItems(stories.slice(0,compact?2:4)):'<p class="player-news-fallback">No verified player-specific recent article was returned.</p>';
 return lead+`<div class="player-news-heading">RECENT PLAYER NEWS <small>${esc(data.source||'ESPN NFL')}</small></div>`+articles;
}
async function getPlayerOverview(id,{force=false,playerName=''}={}){
 const k=String(id);if(!force&&XL.overview.has(k))return XL.overview.get(k);
 const response=await fetch('/api/espn/player-overview?playerId='+encodeURIComponent(k)+'&playerName='+encodeURIComponent(playerName));
 const json=await response.json();if(!response.ok)throw Error(json.error||'ESPN player overview is unavailable');
 if(String(json.playerId)!==k)throw Error('Player update identity does not match the selected player');
 XL.overview.set(k,json);return json;
}
const UPCOMING_NFL_CACHE=new Map();
async function verifiedUpcomingOpponent(p){
 const week=Math.min(18,Number(model.currentWeek||model.liveWeek||currentWeek||1)+1);
 const season=Number(model.season);
 const key=season+':'+week;
 if(!UPCOMING_NFL_CACHE.has(key))UPCOMING_NFL_CACHE.set(key,fetch(`/api/nfl/game-status?season=${season}&week=${week}`).then(r=>r.ok?r.json():null).catch(()=>null));
 const data=await UPCOMING_NFL_CACHE.get(key);
 const team=String(p.nfl||'').toUpperCase();const opponent=data?.opponents?.[team];
 return {week,opponent:opponent||null};
}
async function hydrateProfileEditorial(p){
 const id=String(p.espnId),selected=String(p.id);
 try{
  const data=await getPlayerOverview(id,{playerName:p.name});
  if(XL.open!=='profile'||String(XL.player)!==selected)return;
  const parts=playerContextSections(data,p);
  const outlook=el('lab-player-outlook'),news=el('lab-player-news');
  if(outlook)outlook.innerHTML=parts.outlookHTML;
  if(news)news.innerHTML=parts.newsHTML;
 }catch{/* Recorded fantasy overview is the safe default. */}
}
async function hydrateDossierSchedule(node,p){
 const outlook=node.querySelector('.dossier-context-outlook .dossier-scroll-copy');
 if(!outlook)return;
 const {week,opponent}=await verifiedUpcomingOpponent(p);
 if(!node.isConnected||!outlook.isConnected)return;
 const line=document.createElement('p');line.className='dossier-schedule';
 line.textContent=`NEXT NFL WEEK ${week} · ${opponent?'vs '+opponent:'opponent unavailable from verified schedule'}`;
 outlook.appendChild(line);
}
async function hydrateNextMatchup(p){
 const host=el('lab-next-matchup');if(!host)return;
 const id=String(p.id);const {week,opponent}=await verifiedUpcomingOpponent(p);
 if(!host.isConnected||String(XL.player)!==id)return;
 host.textContent=`Week ${week} NFL opponent: ${opponent||'not confirmed by the schedule feed'}`;
}
async function hydrateAIStatus(p){
 const button=el('lab-generate-ai'),status=el('lab-ai-status');if(!button)return;
 button.disabled=true;
 try{const r=await fetch('/api/ai/status');const data=await r.json();if(!button.isConnected||String(XL.player)!==String(p.id))return;
   button.disabled=!data.enabled;status.textContent=data.enabled?`${data.provider||'AI'} · generated text, not news`:'Set GEMINI_API_KEY or OPENAI_API_KEY on server';
 }catch{if(status)status.textContent='AI is unavailable on this server';}
}
async function generateAIOutlook(){
 const p=model.players[XL.player]||XL.free.find(z=>String(z.id)===String(XL.player));if(!p)return;
 const button=el('lab-generate-ai'),out=el('lab-ai-outlook');if(!button||!out)return;
 button.disabled=true;out.textContent='Generating a statistics-grounded outlook…';
 try{
   const matchup=await verifiedUpcomingOpponent(p);
   const s=summarize(p);
   const request={player:{id:String(p.id),name:p.name,pos:p.pos,nfl:p.nfl,status:p.status||'',
     total:s.total,average:s.avg,recent:s.recent,last:s.last,best:s.best,low:s.low,games:s.games,
     projection:labNum(p.espnProj),week:matchup.week,opponent:matchup.opponent,
     recentWeeks:seriesFor(p).slice(-4)},season:model.season};
   const response=await fetch('/api/ai/outlook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
   const payload=await response.json();if(!response.ok)throw Error(payload.error||'AI outlook could not be generated');
   if(out.isConnected&&String(XL.player)===String(p.id))out.innerHTML=`<b>${esc(payload.provider||'AI')} OUTLOOK · NOT VERIFIED NEWS</b><p>${esc(payload.outlook)}</p><small>Generated using supplied recorded statistics and verified schedule context; not a guaranteed projection.</small>`;
 }catch(error){if(out.isConnected)out.textContent='AI Outlook unavailable: '+String(error.message||error);}
 finally{if(button.isConnected)button.disabled=false;}
}
async function fetchNews(id){
 const host=el('lab-player-news');if(host)host.innerHTML='<p class="lab-note">Checking verified player reports…</p>';
 const p=getAllPlayers().find(z=>String(z.espnId||z.id)===String(id))||XL.free.find(z=>String(z.espnId||z.id)===String(id));
 try{const data=await getPlayerOverview(id,{force:true,playerName:p?.name||''});XL.news.set(String(id),data.articles||[]);
   if(el('lab-player-news'))el('lab-player-news').innerHTML=playerContextSections(data,p).newsHTML;
   if(el('lab-player-outlook'))el('lab-player-outlook').innerHTML=playerContextSections(data,p).outlookHTML;
 }catch(e){if(el('lab-player-news'))el('lab-player-news').innerHTML='<p class="lab-note">Verified editorial news is unavailable.</p>';}
}
function detailRoster(){const t=explorerTeam(),players=rowsFor(t).sort((a,b)=>(b.total??-Infinity)-(a.total??-Infinity));
 setExplorer(heading('Current personnel register','Select a player to inspect their dossier. Changing franchises here also changes the team shown on the homepage.')+
 `<div class="lab-stats roster-overview-stats">${[['ROSTERED',players.length],['TEAM AVG / WK',getStats(t).avg],['QB / RB / WR',players.filter(p=>['QB','RB','WR'].includes(p.pos)).length],['INJURY FLAGS',players.filter(p=>/OUT|QUESTION|DOUBT|INJUR|IR/i.test(p.status)).length]].map(([k,v],i)=>`<div class="lab-stat acc-${['blue','green','purple','red'][i]}"><small>${k}</small><b>${labFormat(v,i===1?1:0)}</b></div>`).join('')}<div class="roster-team-toolbar"><label for="roster-team-switch">FRANCHISE <select id="roster-team-switch" aria-label="Choose a franchise and update homepage team">${model.teams.map(z=>`<option value="${esc(String(z.id))}" ${String(z.id)===String(t.id)?'selected':''}>${esc(teamName(z))}</option>`).join('')}</select></label><span>UPDATES HOME TEAM</span></div></div>`+
 expandTable(['POSITION','PLAYER','NFL','STATUS','SEASON','AVG/WK','LATEST','ESPN PROJ','% ROSTERED','% STARTED'],players.map(p=>`<tr class="lab-clickable" data-open-player="${esc(p.id)}" tabindex="0" role="button"><td>${esc(p.pos)}</td><td><strong>${esc(p.name)}</strong></td><td>${esc(p.nfl)}</td><td>${esc(p.status)}</td><td>${labFormat(p.total)}</td><td>${labFormat(p.average)}</td><td>${labFormat(p.last)}</td><td>${labFormat(p.espnProj)}</td><td>${labPct(p.owned)}</td><td>${labPct(p.started)}</td></tr>`)));
}
function makeFreePlayer(entry){const pool=entry?.playerPoolEntry||entry||{},raw=entry?.player||pool.player||{},pid=String(raw.id||entry.id||pool.id||'');if(!pid)return null;const stats=[...(raw.stats||[]),...(pool.stats||[]),...(entry?.stats||[])];
 const p=makeEspnPlayer?makeEspnPlayer({playerId:pid,playerPoolEntry:{...pool,player:raw}},model.currentWeek||1):null;
 if(!p)return null;const curr=model.currentWeek||1;
 const actSeason=stats.find(s=>Number(s.statSourceId??s.statTypeId)===0&&Number(s.scoringPeriodId)===0);
 const projCurrent=stats.find(s=>[1,2].includes(Number(s.statSourceId??s.statTypeId))&&Number(s.scoringPeriodId)===curr&&labNum(s.appliedTotal)!==null);
 p.seasonTotal=labNum(actSeason?.appliedTotal)??p.seasonTotal;p.espnProj=labNum(projCurrent?.appliedTotal)??p.espnProj;
 if(Number(raw.defaultPositionId)===16||raw.eligibleSlots?.includes(16))p.pos='D/ST';
 p.owned=labNum(entry.percentOwned??pool.percentOwned??entry.ratings?.percentOwned??raw.ownership?.percentOwned);
 p.started=labNum(entry.percentStarted??pool.percentStarted??raw.ownership?.percentStarted);
 p.availability=String(entry.status||pool.status||(entry.onTeamId?'ONTEAM':'FREEAGENT'));
 p.scores={...(p.scores||{})};p.statlines={...(p.statlines||{})};p.projections={...(p.projections||{})};for(const s of stats){const wk=Number(s.scoringPeriodId);if(wk<1||wk>18)continue;const source=Number(s.statSourceId??s.statTypeId);if(source===0){const value=labNum(s.appliedTotal);if(value!==null)p.scores[wk]=value;if(s.stats||s.appliedStats)p.statlines[wk]=s.stats||s.appliedStats;}if(source===1&&labNum(s.appliedTotal)!==null)p.projections[wk]=Number(s.appliedTotal)}
 return p;
}
async function loadFreeAgentPool(reset=false){
 if(model.source!=='espn'||XL.freeBusy)return;
 if(reset){XL.free=[];XL.offset=0;XL.freeLoaded=false;XL.freeError='';}
 XL.freeBusy=true;explorerUpdate();
 try{
   const url=`/api/espn/free-agents?limit=60&offset=${XL.offset}`;
   const resp=await fetch(url,{credentials:'same-origin'});
   const data=await resp.json();
   if(!resp.ok)throw Error(data.error||'ESPN free-agent request failed');
   const assigned=new Set(model.teams.flatMap(t=>t.playerIds.map(String)));
   const merge=items=>{
     const existing=new Set(XL.free.map(p=>String(p.id)));
     for(const item of items||[]){
       const p=makeFreePlayer(item);
       if(!p||assigned.has(String(p.id))||existing.has(String(p.id)))continue;
       XL.free.push(p);existing.add(String(p.id));
     }
   };
   merge(data.players);
   for(const p of XL.free){const previous=data.previousWeekScores?.[String(p.id)];if(labNum(previous)!==null&&Number.isInteger(Number(data.previousWeek))){p.scores[Number(data.previousWeek)]=Number(previous);}}
   XL.offset+=60;
   // Fetch a full, position-filtered ESPN D/ST pool, then sort by this
   // scoring week's ESPN projected fantasy points in the user interface.
   // There are only 32 NFL defenses, so 100 covers the entire NFL field.
   let defenseFailure='';
   try{
     const dresp=await fetch('/api/espn/free-agents?position=DEF&limit=100&offset=0',{credentials:'same-origin'});
     const ddata=await dresp.json();
     if(!dresp.ok)throw Error(ddata.error||'Defense lookup failed');
     merge((ddata.players||[]).filter(e=>{
       const player=e?.player||e?.playerPoolEntry?.player||{};
       return Number(player.defaultPositionId)===16||player.eligibleSlots?.includes(16);
     }));
     for(const p of XL.free){const previous=ddata.previousWeekScores?.[String(p.id)];if(labNum(previous)!==null&&Number.isInteger(Number(ddata.previousWeek))){p.scores[Number(ddata.previousWeek)]=Number(previous);}}
   }catch(err){defenseFailure=err.message;}
   XL.freeLoaded=true;
   XL.freeError=defenseFailure?'D/ST lookup unavailable: '+defenseFailure:'';
 }catch(err){XL.freeError=err.message;XL.freeLoaded=false;}
 finally{XL.freeBusy=false;explorerUpdate();if(XL.open==='position-compare')schedulePositionRender();else if(XL.open==='agents'||XL.open==='graph')renderExplorer();}
}
function demoAgents(){return [
  {id:'fa1',name:'Jordan Vale',pos:'WR',nfl:'SEA',status:'ACTIVE',owned:36.2,started:14.7,espnProj:13.8,scores:{1:11.1,2:18.6,3:9.2,4:13.5,5:22,6:10.6}},
  {id:'fa2',name:'Drew Palmer',pos:'RB',nfl:'CHI',status:'ACTIVE',owned:28.4,started:7.6,espnProj:11.3,scores:{1:7.4,2:8.1,3:15.1,4:19.2,5:11.9,6:12.8}},
  {id:'fa3',name:'Miles Sutton',pos:'QB',nfl:'ARI',status:'ACTIVE',owned:42.1,started:19.3,espnProj:18.9,scores:{1:14.9,2:12.1,3:17.9,4:23.4,5:15.7,6:21.3}},
  {id:'fa4',name:'Avery Knight',pos:'TE',nfl:'DEN',status:'QUESTIONABLE',owned:13.9,started:2.5,espnProj:8.3,scores:{1:5.3,2:8.7,3:3.5,4:12.1,5:7.3,6:9.1}},
  {id:'fa5',name:'Riley Park',pos:'WR',nfl:'HOU',status:'ACTIVE',owned:21.6,started:5.9,espnProj:10.5,scores:{1:5.4,2:10.2,3:16.8,4:8.3,5:13.5,6:17.2}},
  {id:'fa6',name:'Cameron Stone',pos:'RB',nfl:'MIN',status:'ACTIVE',owned:8.2,started:1.9,espnProj:7.8,scores:{1:5.8,2:4.3,3:6.6,4:14.7,5:12.5,6:10.2}},
  {id:'fa7',name:'Julian West',pos:'WR',nfl:'BUF',status:'ACTIVE',owned:26.8,started:11.3,espnProj:12.4,scores:{1:9.7,2:15.8,3:13.2,4:17.3,5:12.1,6:13.9}},
  {id:'fa8',name:'Theo Burns',pos:'TE',nfl:'DET',status:'ACTIVE',owned:19.0,started:8.1,espnProj:9.2,scores:{1:7.0,2:11.4,3:10.1,4:9.4,5:12.7,6:8.0}},
  {id:'fa9',name:'Micah Reed',pos:'RB',nfl:'PHI',status:'ACTIVE',owned:33.1,started:16.5,espnProj:10.2,scores:{1:12.2,2:9.0,3:15.3,4:8.4,5:10.2,6:16.1}},
  {id:'fa10',name:'Owen Brooks',pos:'QB',nfl:'MIA',status:'ACTIVE',owned:11.4,started:3.8,espnProj:16.8,scores:{1:16.2,2:22.3,3:12.1,4:20.0,5:14.8,6:17.4}},
  {id:'fa11',name:'Nico Price',pos:'WR',nfl:'LAC',status:'QUESTIONABLE',owned:7.4,started:1.1,espnProj:7.4,scores:{1:3.6,2:12.1,3:8.6,4:4.3,5:11.9,6:7.5}},
  {id:'fa12',name:'Luca Hayes',pos:'K',nfl:'GB',status:'ACTIVE',owned:18.7,started:4.7,espnProj:8.5,scores:{1:8,2:10,3:7,4:9,5:12,6:6}},
  {id:'fa13',name:'Marcus Lane',pos:'WR',nfl:'NYG',status:'ACTIVE',owned:15.3,started:5.2,espnProj:9.8,scores:{1:7.3,2:10.9,3:6.1,4:13.0,5:14.1,6:12.0}},
  {id:'fa14',name:'Damon Moss',pos:'RB',nfl:'LV',status:'ACTIVE',owned:23.0,started:9.6,espnProj:11.8,scores:{1:10.3,2:11.0,3:18.0,4:12.6,5:9.8,6:13.2}}
 ];}
const NFL_SEARCH_TEAMS={
 ARI:'Arizona Cardinals',ATL:'Atlanta Falcons',BAL:'Baltimore Ravens',BUF:'Buffalo Bills',CAR:'Carolina Panthers',CHI:'Chicago Bears',CIN:'Cincinnati Bengals',CLE:'Cleveland Browns',DAL:'Dallas Cowboys',DEN:'Denver Broncos',DET:'Detroit Lions',GB:'Green Bay Packers',HOU:'Houston Texans',IND:'Indianapolis Colts',JAX:'Jacksonville Jaguars',KC:'Kansas City Chiefs',LV:'Las Vegas Raiders',LAC:'Los Angeles Chargers',LAR:'Los Angeles Rams',LA:'Los Angeles Rams',MIA:'Miami Dolphins',MIN:'Minnesota Vikings',NE:'New England Patriots',NO:'New Orleans Saints',NYG:'New York Giants',NYJ:'New York Jets',PHI:'Philadelphia Eagles',PIT:'Pittsburgh Steelers',SF:'San Francisco 49ers',SEA:'Seattle Seahawks',TB:'Tampa Bay Buccaneers',TEN:'Tennessee Titans',WAS:'Washington Commanders',WSH:'Washington Commanders'};
function nflSearchText(code){const abbr=String(code||'').trim().toUpperCase();return [abbr,NFL_SEARCH_TEAMS[abbr]||'',abbr==='WSH'||abbr==='WAS'?'Washington Football Team':'' ,abbr==='JAX'?'Jacksonville Jags':'',abbr==='LAR'||abbr==='LA'?'St Louis Rams':''].join(' ').toLowerCase();}
function agentList(){let list=XL.free;const a=XL.agent;
 if(a.pos!=='ALL')list=list.filter(p=>a.pos==='DEF'?['DEF','D/ST'].includes(p.pos):p.pos===a.pos);
 if(a.search){const query=a.search.trim().toLowerCase();const exactTeamCode=query.toUpperCase();list=list.filter(p=>Object.hasOwn(NFL_SEARCH_TEAMS,exactTeamCode)?String(p.nfl||'').toUpperCase()===exactTeamCode:(String(p.name||'')+' '+nflSearchText(p.nfl)).includes(query));}
 list=[...list].sort((x,y)=>{const k=a.sort;return (metricValue(y,k)??-Infinity)-(metricValue(x,k)??-Infinity)});return list;
}
function detailAgents(){const list=agentList();const count=XL.free.length;
 setExplorer(heading('Free agent scouting terminal','View the league-specific available-player pool. No adds, drops, or waiver claims are made by this read-only tool.')+
 `<div class="lab-controls"><label>POSITION <select id="agent-position">${['ALL',...POS_ORDER].map(v=>`<option ${XL.agent.pos===v?'selected':''}>${v}</option>`).join('')}</select></label><label>SEARCH <input id="agent-search" value="${esc(XL.agent.search)}" placeholder="Player, city, team, or abbreviation"></label><label>SORT <select id="agent-sort">${[['projected','Projected points'],['avg','Weekly average'],['owned','ESPN roster %'],['total','Season points'],['recent','Last 3 avg']].map(([key,text])=>`<option value="${key}" ${XL.agent.sort===key?'selected':''}>${text}</option>`).join('')}</select></label><button class="lab-action" id="agent-reload">REFRESH POOL ↻</button></div>`+
 `<div class="lab-info">${model.source==='demo'?'DEMO: all free agent names and scores are fictional.':model.source==='espn'?`ESPN available-player feed · ${count} players loaded · ${XL.freeBusy?'Loading…':XL.freeError?'Feed error: '+esc(XL.freeError):'Read-only'}`:'This provider does not offer an integrated free-agent feed in this build. You can still inspect imported players.'}</div>`+
 expandTable(['POS','PLAYER','NFL','STATUS','SEASON PTS','AVG','LAST WK','LAST 3','PROJ','% ROSTERED','% STARTED'],list.slice(0,160).map(p=>{const s=summarize(p);return `<tr class="lab-clickable" data-open-player="${esc(p.id)}" tabindex="0" role="button" aria-label="Open ${esc(p.name)} player dossier"><td>${esc(p.pos)}</td><td><strong>${esc(p.name)}</strong></td><td>${esc(p.nfl)}</td><td>${esc(p.status)}</td><td>${labFormat(s.total)}</td><td>${labFormat(s.avg)}</td><td>${labFormat(s.last)}</td><td>${labFormat(s.recent)}</td><td>${labFormat(p.espnProj)}</td><td>${labPct(p.owned)}</td><td>${labPct(p.started)}</td></tr>`}))+
 `${model.source==='espn'?`<div class="lab-controls"><button class="lab-action" id="agent-more" ${XL.freeBusy?'disabled':''}>LOAD NEXT 60 ESPN PLAYERS ↓</button><span class="lab-note">Availability reflects ESPN's latest permitted response. Some leagues return a limited pool.</span></div>`:''}`);
}
function graphCandidates(){let ps=getPool();if(XL.graph.scope==='TEAM')ps=rowsFor(explorerTeam());else if(XL.graph.scope==='FREE')ps=XL.free;else if(XL.graph.scope==='LEAGUE')ps=getAllPlayers();if(XL.graph.pos!=='ALL')ps=ps.filter(p=>XL.graph.pos==='DEF'?['DEF','D/ST'].includes(p.pos):p.pos===XL.graph.pos);if(XL.graph.search)ps=ps.filter(p=>(p.name+' '+p.nfl).toLowerCase().includes(XL.graph.search.toLowerCase()));return ps.filter(p=>summarize(p).games>=XL.graph.minimum||XL.graph.minimum===0);}
// Pick a real, available pair on initial load. ESPN can supply season/projected
// scores without week-by-week logs, so the graph must not assume those exist.
function ensureGraphAxes(){
 const key=[model.source,model.leagueId||model.league,model.season,model.teams?.length].join('|');
 if(key!==XL.graphAutoSource){XL.graphAutoSource=key;XL.graphUserSelected=false;XL.graphNotice='';}
 if(XL.graphUserSelected)return;
 if(graphData().length)return;
 const pairs=[['total','avg'],['total','projected'],['projected','owned'],['owned','started'],['owned','total'],['projected','started'],['recent','last'],['total','last'],['avg','std'],['pass_yds','pass_td'],['rush_att','rush_yds'],['receptions','rec_yds']];
 const previous=[XL.graph.x,XL.graph.y];
 for(const [x,y] of pairs){XL.graph.x=x;XL.graph.y=y;if(graphData().length){
  XL.graphNotice=`Showing available ${META[y].name} versus ${META[x].name} data. Other stats need additional source records.`;
  return;
 }}
 XL.graph.x=previous[0];XL.graph.y=previous[1];
}
function graphPresetAvailable(x,y){
 const prevX=XL.graph.x,prevY=XL.graph.y;
 XL.graph.x=x;XL.graph.y=y;const available=graphData().length>0;
 XL.graph.x=prevX;XL.graph.y=prevY;
 return available;
}
function activeMetricOptions(list){const counts=Object.fromEntries(METRICS.map(m=>[m[0],0]));for(const p of list)for(const key of Object.keys(counts))if(metricValue(p,key)!==null)counts[key]++;return counts;}
function graphData(){return graphCandidates().map(p=>({p,x:metricValue(p,XL.graph.x),y:metricValue(p,XL.graph.y)})).filter(r=>r.x!==null&&r.y!==null)}
function graphCorrelations(rows){const n=rows.length;if(n<2)return null;const x=labSum(rows.map(v=>v.x))/n,y=labSum(rows.map(v=>v.y))/n;const cov=labSum(rows.map(v=>(v.x-x)*(v.y-y))),sx=labSum(rows.map(v=>(v.x-x)**2)),sy=labSum(rows.map(v=>(v.y-y)**2));return {r:sx&&sy?cov/Math.sqrt(sx*sy):null,slope:sx?cov/sx:null,intercept:sx?y-cov/sx*x:null};}
// Descriptive statistics are computed exclusively from complete X/Y pairs.
// A dash is used when correlation or a fitted model is undefined.
function graphStatistics(rows){
 const n=rows.length,fit=graphCorrelations(rows);
 const meanX=n?labSum(rows.map(r=>r.x))/n:null;
 const meanY=n?labSum(rows.map(r=>r.y))/n:null;
 const r=fit?.r??null,slope=fit?.slope??null,intercept=fit?.intercept??null;
 const rmse=slope!==null&&intercept!==null&&n>1?Math.sqrt(labSum(rows.map(v=>(v.y-(slope*v.x+intercept))**2))/n):null;
 const ranks=(values)=>{
  const sorted=values.map((value,i)=>({value,i})).sort((a,b)=>a.value-b.value),out=Array(values.length);
  for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;
   const rank=((i+1)+j)/2;for(let k=i;k<j;k++)out[sorted[k].i]=rank;i=j;
  }
  return out;
 };
 let spearman=null;
 if(n>1){const rx=ranks(rows.map(p=>p.x)),ry=ranks(rows.map(p=>p.y));const a=rx.reduce((x,y)=>x+y,0)/n,b=ry.reduce((x,y)=>x+y,0)/n;
  const xy=labSum(rx.map((x,i)=>(x-a)*(ry[i]-b))),sx=labSum(rx.map(x=>(x-a)**2)),sy=labSum(ry.map(y=>(y-b)**2));
  if(sx>0&&sy>0)spearman=xy/Math.sqrt(sx*sy);
 }
 return {n,meanX,meanY,r,r2:r===null?null:r*r,slope,intercept,rmse,spearman};
}
const GRAPH_STAT_EXPLAIN={
 n:['Plotted players','Number of players with recorded, nonmissing values for both selected axes. The metric is based on matched pairs, not the entire league.'],
 r:['Pearson correlation (r)','Measures the strength and direction of a linear relationship. Values range from −1 to +1. Correlation does not establish causation; outliers and mixed positions can distort it.'],
 r2:['R-squared (R²)','Fraction of variation in the plotted Y values explained by the fitted straight-line relationship with X (on this observed sample). It is not a predictive guarantee.'],
 slope:['Regression slope','Expected change in Y units for a one-unit increase in X along the least-squares fitted line. If X has no variation, the slope is undefined.'],
 intercept:['Regression intercept','The fitted value of Y when X equals zero. It may not have a meaningful football interpretation if zero lies outside the observed X range.'],
 rmse:['Residual RMSE','Typical size of the fitted line’s error, measured in Y-axis units: square root of the average squared residual. Smaller means a closer in-sample fit.'],
 spearman:['Spearman rank correlation (ρ)','Measures whether players generally move in the same rank order across X and Y, including nonlinear monotonic patterns. Tied values receive averaged ranks.'],
 meanX:['Mean X','Arithmetic average of the recorded X values among plotted players. It changes when you filter positions, players, or data sources.'],
 meanY:['Mean Y','Arithmetic average of the recorded Y values among plotted players, not the league-wide average for all unplotted players.']
};
function graphStatExplanation(key){
 const [name,description]=GRAPH_STAT_EXPLAIN[key]||GRAPH_STAT_EXPLAIN.r;
 return `<strong>${esc(name)}</strong> <span>${esc(description)}</span>`;
}
function graphStatButtons(stats){
 const defs=[['n','MATCHED',String(stats.n)],['r','PEARSON r',labFormat(stats.r,3)],['r2','R²',labFormat(stats.r2,3)],['spearman','SPEARMAN ρ',labFormat(stats.spearman,3)],['slope','SLOPE',labFormat(stats.slope,3)],['intercept','INTERCEPT',labFormat(stats.intercept,2)],['rmse','RMSE',labFormat(stats.rmse,2)],['meanX','MEAN X',labFormat(stats.meanX,2)],['meanY','MEAN Y',labFormat(stats.meanY,2)]];
 return defs.map(([key,name,value])=>statHelpTile(name,value,GRAPH_STAT_EXPLAIN[key][1],'graph-stat-chip','up').replace('data-stat-title=',`data-graph-stat="${key}" data-stat-title=`)).join('');
}
function scatterSVG(rows,dimensions={}){
 const mobile=window.innerWidth<=650;
 // Use the available pixels instead of scaling a fixed canvas to a wide screen.
 const W=Math.max(240,Math.round(dimensions.width||window.innerWidth-(mobile?70:140)));
 const H=Math.max(180,Math.round(dimensions.height||window.innerHeight-350));
 const m=mobile?{l:47,t:18,r:16,b:42}:{l:62,t:18,r:22,b:45};
 const w=W-m.l-m.r,h=H-m.t-m.b;
 if(!rows.length)return '<div class="lab-no-data"><b>NO COMPARABLE DATA POINTS</b><p>Choose two metrics present in this dataset, adjust the position filter, or import an advanced CSV.</p></div>';
 let xs=rows.map(x=>x.x),ys=rows.map(x=>x.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const padX=Math.max(1,(xmax-xmin)*.09),padY=Math.max(1,(ymax-ymin)*.10);
 xmin=xmin>=0&&xmin<padX?0:xmin-padX;xmax+=padX;ymin=ymin>=0&&ymin<padY?0:ymin-padY;ymax+=padY;
 const tx=v=>m.l+(v-xmin)/(xmax-xmin||1)*w,ty=v=>m.t+h-(v-ymin)/(ymax-ymin||1)*h;
 const ticks=(axis)=>Array.from({length:6},(_,i)=>{const v=(axis==='x'?xmin:ymin)+(axis==='x'?xmax-xmin:ymax-ymin)*i/5;return axis==='x'?`<line x1="${tx(v)}" y1="${m.t}" x2="${tx(v)}" y2="${m.t+h}" stroke="#e6e8e6"/><text x="${tx(v)}" y="${m.t+h+15}" text-anchor="middle">${labFormat(v,1)}</text>`:`<line x1="${m.l}" y1="${ty(v)}" x2="${m.l+w}" y2="${ty(v)}" stroke="#e6e8e6"/><text x="${m.l-8}" y="${ty(v)+4}" text-anchor="end">${labFormat(v,1)}</text>`}).join('');
 const fit=graphCorrelations(rows);let regression='';if(XL.graph.trend&&fit&&fit.slope!==null){const y1=fit.intercept+fit.slope*xmin,y2=fit.intercept+fit.slope*xmax;regression=`<line x1="${tx(xmin)}" y1="${ty(y1)}" x2="${tx(xmax)}" y2="${ty(y2)}" stroke="#b3515b" stroke-width="2" stroke-dasharray="8 5" clip-path="url(#graphclip)"/>`}
 const occupied=[];
 const circles=rows.map((d,i)=>{
  const x=tx(d.x),y=ty(d.y),name=String(d.p.name),labelWidth=Math.min(W-m.l-m.r,name.length*7.2+14);
  const lx=Math.max(m.l+4,x+labelWidth+12>W-m.r?x-labelWidth-9:x+9),ly=y<30?y+22:y-10;
  const visible=XL.graph.showLabels&&!occupied.some(k=>lx<k.x+k.w+6&&lx+labelWidth>k.x-6&&ly>k.y-18&&ly<k.y+18);
  if(visible)occupied.push({x:lx,y:ly,w:labelWidth});
  return `<g class="lab-dot ${visible?'label-visible':''}" tabindex="0" role="button" data-graph-point="${i}" data-graph-player="${esc(String(d.p.id))}" aria-label="Open ${esc(name)} Player Terminal"><circle cx="${x}" cy="${y}" r="${XL.selectedPoint===d.p.id?8:6}" stroke="#fff" stroke-width="1.4" fill="${XL.graph.color==='pos'?playerColor(d.p):'#487ebb'}"/><text class="lab-label" x="${lx}" y="${ly}">${esc(name)}</text></g>`;
 }).join('');
 return `<svg class="lab-scatter-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter plot: ${esc(META[XL.graph.x].name)} against ${esc(META[XL.graph.y].name)}"><defs><clipPath id="graphclip"><rect x="${m.l}" y="${m.t}" width="${w}" height="${h}"/></clipPath></defs><rect x="${m.l}" y="${m.t}" width="${w}" height="${h}" fill="#fff" stroke="#a5aaa8"/>${ticks('x')}${ticks('y')}${regression}${circles}<text x="${m.l+w/2}" y="${H-5}" text-anchor="middle" class="lab-axis-title">${esc(META[XL.graph.x].name)}</text><text x="15" y="${m.t+h/2}" transform="rotate(-90 15 ${m.t+h/2})" text-anchor="middle" class="lab-axis-title">${esc(META[XL.graph.y].name)}</text></svg>`;
}
function metricSelect(which,counts){return `<select id="graph-${which}">${METRICS.map(([key,name,unit,source])=>`<option value="${key}" ${XL.graph[which]===key?'selected':''}>${esc(name)}${counts[key]===0?' · not loaded':''}</option>`).join('')}</select>`}
function detailGraph(){
 ensureGraphAxes();
 const cands=graphCandidates(),counts=activeMetricOptions(cands),rows=graphData(),stats=graphStatistics(rows),avail=METRICS.filter(([k])=>counts[k]>0);
 const presets=[['avg','std','CONSISTENCY'],['avg','total','VOLUME'],['targets','rec_yds','WR TARGETS'],['rush_att','rush_yds','RB CARRIES'],['pass_yds','pass_td','QB VOLUME'],['epa','avg','EPA vs FPTS']];
 setExplorer('<section class="graph-screen">'+heading('Variable Lab','')+
 `<div class="graph-control-deck"><div class="lab-controls graph-unified-toolbar" aria-label="Variable Lab filters and axes"><label class="graph-pool">POOL <select id="graph-scope">${[['ALL','All available'],['TEAM','Selected team'],['LEAGUE','League rosters'],['FREE','Free agents']].map(([v,n])=>`<option value="${v}" ${XL.graph.scope===v?'selected':''}>${n}</option>`).join('')}</select></label><label class="graph-position">POSITION <select id="graph-pos">${['ALL',...POS_ORDER].map(v=>`<option ${XL.graph.pos===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="graph-x">X AXIS ${metricSelect('x',counts)}</label><button id="graph-swap" class="lab-action graph-swap" title="Swap graph axes">⇄</button><label class="graph-y">Y AXIS ${metricSelect('y',counts)}</label><label class="graph-games">MIN GAMES <select id="graph-minimum">${[0,1,2,3,5].map(n=>`<option ${XL.graph.minimum===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="graph-search">SEARCH <input id="graph-search" placeholder="Player name" value="${esc(XL.graph.search)}"></label><label class="graph-toggle"><input id="graph-trend" type="checkbox" ${XL.graph.trend?'checked':''}><span>TREND</span></label><label class="graph-toggle"><input id="graph-labels" type="checkbox" ${XL.graph.showLabels?'checked':''}><span>LABELS</span></label></div>
 <div class="graph-preset-ribbon"><b>QUICK PLOTS</b>${presets.map(([x,y,n])=>`<button type="button" class="graph-preset ${XL.graph.x===x&&XL.graph.y===y?'active':''}" data-preset="${x},${y}" ${graphPresetAvailable(x,y)?'':`disabled title="Requires recorded ${esc(META[x].name)} and ${esc(META[y].name)}; load NFL data or choose another preset"`}>${n}</button>`).join('')}<span class="graph-preset-hint">Select axes above or use a preset.</span></div></div>`+
 `<div class="lab-graph-layout"><section class="lab-panel lab-graph-panel"><div class="lab-graph-top"><h4>${esc(META[XL.graph.y].name)} BY ${esc(META[XL.graph.x].name)}</h4><div class="lab-graph-legend">${POS_ORDER.map(pos=>`<span><i style="background:${COLORS[pos]}"></i>${pos}</span>`).join('')}</div><span>${rows.length} MATCHED PAIRS / ${cands.length} CANDIDATES</span></div><div class="graph-plot"></div></section>
 <aside class="lab-graph-aside"><div class="graph-stat-heading"><h4>GRAPH STATISTICS</h4></div><div class="graph-stat-grid">${graphStatButtons(stats)}</div><div id="lab-point-info" class="lab-point-info" hidden></div></aside></div>`+
 `</section><details class="graph-tools strategy-method"><summary>Data sources & export</summary><div class="lab-controls graph-enrichment-panel"><label>ENRICH WITH NFL DATA <input id="graph-import" type="file" accept=".csv,text/csv"></label><button class="lab-action" id="graph-load-nflverse">LOAD NFLverse ADVANCED METRICS ↻</button><button class="lab-action" id="graph-export">EXPORT PLOT DATA CSV ↓</button><button class="lab-action" id="graph-export-svg">SAVE SVG GRAPH ↓</button><button class="lab-action" id="graph-clear-import">CLEAR IMPORTED METRICS</button></div>`+
 `<div class="lab-panel"><h4>DATA DICTIONARY / PROVENANCE</h4><p class="lab-note">ESPN fantasy scores use the league's scoring system. NFL box-score fields and advanced CSVs are included only when supplied. Advanced measurements may use different time periods; compare only compatible periods. Imports are matched by player name, and unavailable fields remain blank.</p><div class="lab-dictionary">${METRICS.map(([k,n,u,source])=>`<div><span>${esc(n)}</span><b class="${counts[k]?'positive-text':''}">${counts[k]} players</b><small>${esc(source)}</small></div>`).join('')}</div></div></details>`);
 const plot=el('explore-content').querySelector('.graph-plot');
 if(plot){
  const choose=event=>{const dot=event.target.closest('[data-graph-point]');if(!dot)return;event.stopPropagation();const r=rows[Number(dot.dataset.graphPoint)];if(r){XL.selectedPoint=String(r.p.id);openExplorer('profile',String(r.p.id));}};
  plot.addEventListener('click',choose);
  // Paint a noninteractive copy above the chart without moving keyboard targets.
  const foreground=dot=>{
   plot.querySelector('.graph-point-highlight')?.remove();
   if(!dot||!plot.contains(dot))return;
   const overlay=document.createElementNS('http://www.w3.org/2000/svg','g');
   overlay.setAttribute('class','graph-point-highlight');overlay.setAttribute('aria-hidden','true');
   for(const child of dot.children)overlay.append(child.cloneNode(true));
   dot.ownerSVGElement.append(overlay);
  };
  const focused=()=>document.activeElement?.closest('.lab-dot');
  plot.addEventListener('pointerover',event=>foreground(event.target.closest('.lab-dot')||focused()));
  plot.addEventListener('pointerout',event=>foreground(event.relatedTarget?.closest?.('.lab-dot')||focused()));
  plot.addEventListener('focusin',event=>foreground(event.target.closest('.lab-dot')));
  plot.addEventListener('focusout',event=>foreground(event.relatedTarget?.closest?.('.lab-dot')));
  plot.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose(event);}});
  let measuredWidth=0,measuredHeight=0;
  const redraw=()=>{
   if(!plot.isConnected||!plot.getClientRects().length)return;
   const r=plot.getBoundingClientRect(),width=Math.round(r.width),height=Math.round(r.height);
   if(!width||!height||(width===measuredWidth&&height===measuredHeight))return;
   measuredWidth=width;measuredHeight=height;
   const active=plot.contains(document.activeElement)?document.activeElement.closest('[data-graph-point]'):null;
   const point=active?.dataset.graphPoint;
   plot.innerHTML=scatterSVG(rows,{width,height});
   if(point!==undefined)plot.querySelector(`[data-graph-point="${point}"]`)?.focus({preventScroll:true});
  };
  const schedule=()=>{
   if(graphPaintFrame!==null)return;
   graphPaintFrame=requestAnimationFrame(()=>{graphPaintFrame=null;if(plot.isConnected){fitGraphScreen();redraw();}});
  };
  schedule();graphResizeObserver=new ResizeObserver(schedule);graphResizeObserver.observe(plot);
 }
}
function fitGraphScreen(){
 const screen=el('explore-content').querySelector('.graph-screen');if(!screen)return;
 if(window.innerWidth<=730){screen.style.height='auto';return;}
 const content=el('explore-content'),tabbed=document.body.dataset.layout==='tabbed';
 const top=screen.getBoundingClientRect().top+(tabbed?window.scrollY:content.scrollTop);
 const footer=tabbed?0:el('explore-dialog').querySelector('.explore-footer').getBoundingClientRect().height;
 const gutter=tabbed?12:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--window-gutter'))||14;
 screen.style.height=Math.max(window.innerWidth<730?680:390,window.innerHeight-top-footer-gutter-12)+'px';
}

async function loadNFLverse(){
 const b=el('graph-load-nflverse');if(!b)return;b.disabled=true;b.textContent='FETCHING NFLverse…';
 try{const resp=await fetch('/api/nflverse/advanced?season='+encodeURIComponent(model.season));const data=await resp.json();if(!resp.ok)throw Error(data.error||'Data not available');let matched=0;const keys=new Set(getPool().map(p=>nameKey(p.name)));
 for(const entry of data.players||[]){const key=nameKey(entry.name);if(!key)continue;const obj={};for(const [col,v] of Object.entries(entry))if(META[col]&&labNum(v)!==null)obj[col]=labNum(v);if(Object.keys(obj).length){XL.advanced.set(key,{...XL.advanced.get(key),...obj});if(keys.has(key))matched++;}}
 XL.importedColumns=[...new Set([...XL.importedColumns,'nflverse'])];renderExplorer();const elMsg=el('lab-point-info');if(elMsg){elMsg.hidden=false;elMsg.textContent=`NFLverse ${data.season}: ${data.weeklyRows} observed weekly rows, ${matched} matched player names. Values are season-to-date aggregates, not projections. Source: nflverse public player stats.`;}
 }catch(error){b.disabled=false;b.textContent='RETRY NFLverse DATA ↻';const elMsg=el('lab-point-info');if(elMsg){elMsg.hidden=false;elMsg.textContent='Advanced download unavailable: '+error.message+'. You can still import a CSV.';}}
}
function exportBlob(content,name,type='text/csv'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function csvEscape(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function exportGraph(){const rows=graphData(),cols=['player','nfl_team','position',XL.graph.x,XL.graph.y];const text=[cols.join(','),...rows.map(r=>[r.p.name,r.p.nfl,r.p.pos,r.x,r.y].map(csvEscape).join(','))].join('\n');exportBlob(text,'gridiron86-variable-lab.csv');}
function exportSVG(){const svg=el('explore-content').querySelector('.lab-scatter-svg');if(svg)exportBlob(new XMLSerializer().serializeToString(svg),'gridiron86-scatter.svg','image/svg+xml');}
// Minimal RFC-4180 quoted-field parser. Supports commas, CRLF and multiline quoted values.
function parseCSV(text){const rows=[];let row=[],value='',inQuotes=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(inQuotes&&text[i+1]==='"'){value+='"';i++;}else inQuotes=!inQuotes;}else if(ch===','&&!inQuotes){row.push(value);value='';}else if((ch==='\n'||ch==='\r')&&!inQuotes){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';}else value+=ch;}row.push(value);if(row.some(v=>v.trim()))rows.push(row);return rows;}
const HEADER_ALIASES={player:['player','player_name','name','player_display_name','full_name'],targets:['targets','target','receiving_targets'],yac:['yac','yards_after_catch','receiving_yards_after_catch'],air_yards:['air_yards','receiving_air_yards'],epa:['epa','total_epa','passing_epa','receiving_epa'],passer_rating:['passer_rating','passer_rating_nfl','passing_rating'],snap_pct:['snap_pct','snap_percentage','snap_share'],target_share:['target_share','target_percentage'],rush_att:['carries','rushing_attempts','rush_att'],rec_yds:['receiving_yards','rec_yds'],pass_yds:['passing_yards','pass_yds'],rush_yds:['rushing_yards','rush_yds'],receptions:['receptions','receiving_receptions']};
async function importAdvanced(file){if(file.size>5_000_000)throw Error('Use a CSV under 5 MB to keep the browser responsive.');const rows=parseCSV(await file.text());if(rows.length<2)throw Error('CSV needs a header row and player rows.');const headers=rows[0].map(v=>v.trim().toLowerCase().replace(/[\s-]+/g,'_'));const which=aliases=>aliases.map(a=>headers.indexOf(a)).find(i=>i>=0)??-1;const playerIndex=which(HEADER_ALIASES.player);if(playerIndex<0)throw Error('CSV needs a player, player_name, or name column.');const mapping=Object.fromEntries(Object.entries(HEADER_ALIASES).filter(([k])=>k!=='player').map(([k,v])=>[k,which(v)]).filter(([,v])=>v>=0));let matched=0;const lookup=new Set(getPool().map(p=>nameKey(p.name)));
 for(const row of rows.slice(1)){const key=nameKey(row[playerIndex]);if(!key)continue;const obj={};for(const [field,i] of Object.entries(mapping)){const num=labNum(row[i]);if(num!==null)obj[field]=num;}if(!Object.keys(obj).length)continue;XL.advanced.set(key,{...XL.advanced.get(key),...obj});if(lookup.has(key))matched++;}
 XL.importedColumns=[...new Set([...XL.importedColumns,...Object.keys(mapping)])];renderExplorer();const note=el('lab-point-info');if(note){note.hidden=false;note.textContent=`Imported ${rows.length-1} CSV rows. ${matched} matched players currently in the dashboard. Values retain the CSV's stated time range.`;}
}
function seedDemoStats(){
 // These invented demo stats only enable exploration of the custom graph in exhibition mode.
 const cases={
  'Josh Allen':{pass_yds:1583,pass_att:195,pass_cmp:132,pass_td:13,epa:55.3},
  'Christian McCaffrey':{rush_att:114,rush_yds:548,targets:37,receptions:30,rec_yds:235,yac:206,epa:27.2},
  'Ja’Marr Chase':{targets:67,receptions:42,rec_yds:592,yac:217,air_yards:733,epa:29.8,target_share:29.7},
  'Deebo Samuel':{targets:47,receptions:33,rec_yds:391,yac:234,air_yards:410,epa:19.4,target_share:22.1},
  'Travis Kelce':{targets:48,receptions:37,rec_yds:387,yac:160,air_yards:388,epa:17.8},
  'James Cook':{rush_att:94,rush_yds:471,targets:24,receptions:20,rec_yds:154,yac:142,epa:18.7},
  'Jordan Vale':{targets:49,receptions:28,rec_yds:386,yac:134,air_yards:510,epa:7.9},
  'Riley Park':{targets:56,receptions:32,rec_yds:404,yac:198,air_yards:469,epa:14.5},
  'Drew Palmer':{rush_att:88,rush_yds:385,targets:14,epa:9.8},
  'Miles Sutton':{pass_yds:1205,pass_att:182,pass_cmp:119,pass_td:9,epa:23.3},
  'Avery Knight':{targets:32,receptions:24,rec_yds:202,yac:105,epa:8.2},
  'Cameron Stone':{rush_att:63,rush_yds:307,targets:18,epa:6.4}
 };
 for(const [name,data] of Object.entries(cases))XL.advanced.set(nameKey(name),data);
 XL.demoSeeded=true;
}
function lastReportedAgentPoints(p){
 const history=seriesFor(p);if(history.length)return history.at(-1).points;
 // ESPN may supply a single current/previous reported score separately.
 return labNum(p.lastWeekPoints);
}
function renderFreeAgentHome(){
 const host=el('fa-summary');if(!host)return;
 const list=agentList(),shown=list.slice(0,14);
 el('fa-source-tag').textContent=model.source==='espn'?(XL.freeBusy?'FETCHING…':XL.freeLoaded?'ESPN FREE AGENTS':'ESPN / NOT LOADED'):model.source==='demo'?'DEMO FREE AGENTS':'NO LINKED WIRE';
 const sortLabel={projected:'Projected',total:'Season',avg:'Weekly avg',recent:'Last 3',owned:'Rostered'}[XL.agent.sort]||'Projected';
 host.innerHTML=shown.length?`<div class="fa-teaser-heading" aria-hidden="true"><span>POS</span><span>PLAYER</span><span>LAST</span><span>PROJ</span><span>ROST%</span></div>`+shown.map(p=>{
  const sorted=metricValue(p,XL.agent.sort);
  const detail=XL.agent.sort!=='projected'?` · ${sortLabel}: ${labFormat(sorted)}`:'';
  return `<div class="fa-teaser-row" data-fa-preview-player="${esc(String(p.id))}" role="button" tabindex="0" aria-label="Open ${esc(p.name)} player terminal" title="${esc(p.name)} (${esc(p.nfl)})${esc(detail)}"><b>${esc(p.pos)}</b><span title="${esc(p.name)} / ${esc(p.nfl)}${esc(detail)}">${esc(p.name)}</span><strong class="fa-last">${labFormat(lastReportedAgentPoints(p))}</strong><strong>${labFormat(p.espnProj)}</strong><strong class="fa-rostered">${labPct(p.owned)}</strong></div>`;
 }).join(''):`<p class="muted-note">${XL.freeBusy?'Loading available players…':XL.freeError?'ESPN feed error. Expand to retry.':XL.free.length?'No players match these filters.':model.source==='espn'?'Connect ESPN or expand to request the available pool.':'No available players for this dataset.'}</p>`;
 el('fa-note').textContent=XL.free.length?`${list.length} / ${XL.free.length} matching · expand for full scouting`:model.source==='espn'?'Expand to request the ESPN free-agent pool.':'Expand to inspect the available pool.';
}
function graphPreviewSvg(rows){
 const isNarrow=window.innerWidth<730;
 const H=isNarrow?310:385;
 const homeHost=el('graph-teaser');
 const targetWidth=homeHost?.clientWidth|| (isNarrow?390:920);
 const targetHeight=Math.max(190,(homeHost?.clientHeight||360)-43);
 const W=Math.max(isNarrow?390:650,Math.round(H*targetWidth/targetHeight));
 const m={l:isNarrow?29:26,r:6,t:11,b:26};const w=W-m.l-m.r,h=H-m.t-m.b;
 if(!rows.length)return '<div class="graph-home-empty">NO COMPARABLE RECORDS · CHANGE METRICS OR OPEN VARIABLE LAB</div>';
 const xs=rows.map(r=>r.x),ys=rows.map(r=>r.y),pad=(lo,hi)=>Math.max(.5,(hi-lo)*.08);
 let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const px=pad(xmin,xmax),py=pad(ymin,ymax);xmin-=px;xmax+=px;ymin-=py;ymax+=py;
 const tx=v=>m.l+(v-xmin)/(xmax-xmin||1)*w,ty=v=>m.t+h-(v-ymin)/(ymax-ymin||1)*h;
 const grids=Array.from({length:5},(_,i)=>{const frac=i/4;return `<line x1="${m.l}" x2="${m.l+w}" y1="${m.t+frac*h}" y2="${m.t+frac*h}" stroke="#e4e9e5"/><line x1="${m.l+frac*w}" x2="${m.l+frac*w}" y1="${m.t}" y2="${m.t+h}" stroke="#edf0ed"/>`;}).join('');
 const fit=graphCorrelations(rows);
 const trend=XL.graph.trend&&fit&&fit.slope!==null?`<line x1="${tx(xmin)}" y1="${ty(fit.intercept+fit.slope*xmin)}" x2="${tx(xmax)}" y2="${ty(fit.intercept+fit.slope*xmax)}" stroke="#b35665" stroke-width="1.6" stroke-dasharray="5 4"/>`:'';
 const occupied=[];
 const dots=rows.map(r=>{
  const x=tx(r.x),y=ty(r.y);
  let label='';
  if(XL.graph.showLabels){
   const name=String(r.p.name||'').slice(0,19),estimatedWidth=name.length*5.4+8;
   let lx=x+7,ly=y-9;
   if(lx+estimatedWidth>W-m.r)lx=x-estimatedWidth-6;
   if(ly<12)ly=y+14;
   if(!occupied.some(k=>lx<k.x+k.w+5&&lx+estimatedWidth>k.x-5&&ly>k.y-10&&ly<k.y+10)){
    occupied.push({x:lx,y:ly,w:estimatedWidth});
    label=`<text class="graph-home-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${esc(name)}</text>`;
   }
  }
  return `<circle class="graph-home-dot" data-home-graph-player="${esc(String(r.p.id))}" cx="${x}" cy="${y}" r="4.2" fill="${playerColor(r.p)}" stroke="white" stroke-width=".9" tabindex="0" role="button" aria-label="Open ${esc(r.p.name)} player dossier"><title>${esc(r.p.name)} · ${META[XL.graph.x].name}: ${labFormat(r.x)} · ${META[XL.graph.y].name}: ${labFormat(r.y)}</title></circle>${label}`;
 }).join('');
 return `<svg class="graph-home-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatterplot of ${esc(META[XL.graph.x].name)} versus ${esc(META[XL.graph.y].name)}"><rect x="${m.l}" y="${m.t}" width="${w}" height="${h}" fill="#fff" stroke="#9daaa6"/>${grids}${trend}${dots}<text x="${m.l+w/2}" y="${H-7}" text-anchor="middle">${esc(META[XL.graph.x].name)}</text><text x="9" y="${m.t+h/2}" text-anchor="middle" transform="rotate(-90 9 ${m.t+h/2})">${esc(META[XL.graph.y].name)}</text></svg>`;
}
function renderGraphHome(){
 const host=el('graph-teaser');if(!host)return;
 ensureGraphAxes();
 const x=el('home-graph-x'),y=el('home-graph-y');
 for(const [box,key] of [[x,'x'],[y,'y']]){
  if(!box.options.length)box.innerHTML=METRICS.map(([id,title])=>`<option value="${id}">${esc(title)}</option>`).join('');
  box.value=XL.graph[key];
 }
 el('home-graph-pos').value=XL.graph.pos;
 el('home-graph-trend').checked=XL.graph.trend;
 el('home-graph-labels').checked=XL.graph.showLabels;
 const rows=graphData(),stats=graphStatistics(rows);
 host.innerHTML=graphPreviewSvg(rows)+`<div class="graph-home-stats" aria-label="Graph statistics">${[['n','MATCHED',String(stats.n)],['r','PEARSON r',labFormat(stats.r,2)],['r2','R²',labFormat(stats.r2,2)],['slope','SLOPE',labFormat(stats.slope,2)]].map(([id,title,v])=>`${statHelpTile(title,v,GRAPH_STAT_EXPLAIN[id][1],'graph-stat-chip','up').replace('class="',`data-home-stat="${id}" class="`)}`).join('')}</div>`;
}
let graphResizeFrame=null;window.addEventListener('resize',()=>{if(graphResizeFrame)cancelAnimationFrame(graphResizeFrame);graphResizeFrame=requestAnimationFrame(()=>{graphResizeFrame=null;if(el('graph-teaser')?.getClientRects().length)renderGraphHome();if(XL.open==='graph')fitGraphScreen()});});
function explorerUpdate(){const host=el('fa-summary');if(!host)return;
 if(model.source==='demo'&&!XL.demoSeeded)seedDemoStats();
 if(model.source!=='demo'&&XL.demoSeeded){XL.advanced.clear();XL.importedColumns=[];XL.demoSeeded=false;}
 if(model.source==='demo'&&(!XL.free.length||!XL.freeLoaded)){XL.free=demoAgents();XL.freeLoaded=true;}
 if(model.source!=='demo'&&model.source!=='espn'){XL.free=[];XL.freeLoaded=false;}
 if(model.source==='espn'&&XL.free.length&&XL.free[0].id==='fa1'){XL.free=[];XL.freeLoaded=false;}
 el('home-fa-position').value=XL.agent.pos;
 el('home-fa-sort').value=XL.agent.sort;
 if(document.activeElement!==el('home-fa-search'))el('home-fa-search').value=XL.agent.search;
 renderFreeAgentHome();renderGraphHome();
 if(document.body.dataset.layout==='tabbed'&&XL.open){
   XL.viewTeamId=String(currentTeamId);
   if(!model.players[XL.player]&&!XL.free.some(p=>String(p.id)===String(XL.player)))XL.player=currentPlayerId;
   explorerClubHeader(XL.open,XL.player);
   el('explore-context').textContent=`${model.season} SEASON`;
   renderExplorer();
 }else if(XL.open&&el('explore-dialog')?.open&&XL.open!=='graph'&&XL.open!=='agents')renderExplorer();
}
// Inline compact homepage filters share state with each expanded workspace.
for(const [id,key] of [['home-fa-position','pos'],['home-fa-sort','sort']])el(id).addEventListener('change',event=>{
 XL.agent[key]=event.target.value;
 renderFreeAgentHome();
});
el('home-fa-search').addEventListener('input',event=>{XL.agent.search=event.target.value;renderFreeAgentHome();});
for(const [id,key] of [['home-graph-pos','pos'],['home-graph-x','x'],['home-graph-y','y']])el(id).addEventListener('change',event=>{
 XL.graph[key]=event.target.value;XL.graphUserSelected=true;XL.graphNotice='';renderGraphHome();
});
el('home-graph-trend').addEventListener('change',event=>{XL.graph.trend=event.target.checked;renderGraphHome();});
el('home-graph-labels').addEventListener('change',event=>{XL.graph.showLabels=event.target.checked;renderGraphHome();});
el('graph-teaser').addEventListener('click',event=>{
 const stat=event.target.closest('[data-home-stat]');if(stat){event.stopPropagation();showStatHelp(stat);return;}
 const dot=event.target.closest('[data-home-graph-player]');if(!dot)return;
 event.stopPropagation();openExplorer('profile',dot.dataset.homeGraphPlayer);
});
el('graph-teaser').addEventListener('keydown',event=>{
 const stat=event.target.closest('[data-home-stat]');if(stat&&['Enter',' '].includes(event.key)){event.preventDefault();stat.click();return;}
 const dot=event.target.closest('[data-home-graph-player]');
 if(dot&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();openExplorer('profile',dot.dataset.homeGraphPlayer);}
});
const freePreview=el('fa-summary');
freePreview.addEventListener('click',event=>{
 const item=event.target.closest('[data-fa-preview-player]');if(!item)return;
 event.stopPropagation();openExplorer('profile',item.dataset.faPreviewPlayer);
});
freePreview.addEventListener('keydown',event=>{
 const item=event.target.closest('[data-fa-preview-player]');
 if(item&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();openExplorer('profile',item.dataset.faPreviewPlayer);}
});
const dialog=el('explore-dialog');el('explore-close').addEventListener('click',()=>dialog.close());el('explore-back').addEventListener('click',exploreBack);el('explore-forward').addEventListener('click',exploreForward);dialog.addEventListener('close',()=>{if(dialog.open)return;XL.open=null;XL.viewWeek=null;XL.history=[];XL.future=[];XL.viewTeamId=null;XL.lineupScenarios.clear()});
// Native <dialog> backdrop clicks are delivered to the dialog element itself.
// Only dismiss when the pointer is OUTSIDE its rectangle, never on contents.
dialog.addEventListener('click',e=>{
 if(e.target!==dialog||document.body.dataset.layout==='tabbed')return;
 const r=dialog.getBoundingClientRect();
 if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
});
document.querySelectorAll('.expandable').forEach(box=>{
 box.addEventListener('click',e=>{if(e.target.closest('select,input,label,a,details,[data-stat-help],[data-chart-surface],[data-share-chart],.lab-link,[data-player],[data-team],[data-home-trade-remove],#home-trade-clear,[data-matchup-ai]'))return;openExplorer(box.dataset.explore,['outlook','opportunity'].includes(box.dataset.explore)?homePlayer()?.id:box.dataset.explore==='profile'?currentPlayerId:null)});
 box.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===box){e.preventDefault();openExplorer(box.dataset.explore,['outlook','opportunity'].includes(box.dataset.explore)?homePlayer()?.id:box.dataset.explore==='profile'?currentPlayerId:null)}});
});
// The small homepage chart offers the same direct week-to-lineup path as
// its expanded comparative chart. All other space still expands Weekly Production.
el('weekly-chart').addEventListener('click',event=>{
 event.stopPropagation();const bar=event.target.closest('[data-home-week]');if(!bar){openExplorer('weekly');return;}
 event.preventDefault();event.stopPropagation();
 openExplorer('summary',null,{teamId:String(currentTeamId),week:Number(bar.dataset.homeWeek),focus:'franchise-lineup'});
});
// Player bars select a week; the chart surface opens Position Allocation for the player’s franchise.
el('player-spark').addEventListener('click',event=>{
 const bar=event.target.closest('button[data-home-player-week]');
 event.stopPropagation();
 if(bar){if(!bar.disabled)openPlayerPositionContributions(currentPlayerId,Number(bar.dataset.homePlayerWeek));}else openPlayerPositionAllocation(currentPlayerId);

});
el('weekly-chart').addEventListener('keydown',event=>{
 const bar=event.target.closest('[data-home-week]');if(!bar||!['Enter',' '].includes(event.key))return;
 event.preventDefault();event.stopPropagation();bar.click();
});
// Individual Player Files use the same week and Position Allocation destinations.
const playerDossiers=el('player-dossiers');
playerDossiers.addEventListener('click',e=>{
 const dossier=e.target.closest('.dossier-window');if(!dossier)return;
 const id=dossier.id.replace(/^dossier-/,'');
 const bar=e.target.closest('[data-dossier-week]');
 if(bar){e.stopPropagation();openPlayerPositionContributions(id,Number(bar.dataset.dossierWeek));return;}
 if(e.target.closest('.dossier-news-panel')){if(e.target.closest('a[href]')){e.stopPropagation();return;}e.preventDefault();e.stopPropagation();openExplorer('profile',id,{focus:'player-editorial'});return;}
 if(e.target.closest('a,select,input'))return;
 if(e.target.closest('[data-dossier-chart]')){e.stopPropagation();openPlayerPositionAllocation(id);return;}
 openExplorer('profile',id);
});
playerDossiers.addEventListener('keydown',e=>{
 if(!['Enter',' '].includes(e.key))return;
 if(e.target.matches('[data-dossier-chart],.dossier-news-panel')){e.preventDefault();e.target.click();}
});
const overviewPending=new Map();let dossierNewsObserver;
function prepareDossierNews(){
 if(dossierNewsObserver)dossierNewsObserver.disconnect();
 if(typeof IntersectionObserver==='undefined')return;
 dossierNewsObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){if(!entry.isIntersecting)continue;
   dossierNewsObserver.unobserve(entry.target);loadDossierOverview(entry.target);
  }
 },{rootMargin:'250px 0px'});
 playerDossiers.querySelectorAll('[data-dossier-news]').forEach(node=>{
  if(node.dataset.dossierNews)dossierNewsObserver.observe(node);
  else{const p=model.players[node.dataset.dossierPlayerId]||XL.free.find(z=>String(z.id)===node.dataset.dossierPlayerId);fillDossierContext(node,null,p);}
 });
}
async function loadDossierOverview(node){
 const id=node.dataset.dossierNews;if(!id)return;
 const key=String(id);const p=model.players[node.dataset.dossierPlayerId]||XL.free.find(z=>String(z.id)===String(node.dataset.dossierPlayerId));
 if(XL.overview.has(key)){fillDossierContext(node,XL.overview.get(key),p);return;}
 if(!overviewPending.has(key))overviewPending.set(key,getPlayerOverview(key,{playerName:p?.name||node.dataset.dossierName||''}).finally(()=>overviewPending.delete(key)));
 try{const data=await overviewPending.get(key);if(node.isConnected)fillDossierContext(node,data,p);}
 catch(err){if(node.isConnected)fillDossierContext(node,null,p);}
}
playerDossiers.addEventListener('click',e=>{
 const retry=e.target.closest('[data-dossier-retry]');if(!retry)return;
 e.stopPropagation();const node=retry.closest('.dossier-news-panel');if(node){node.innerHTML='<p class="player-news-fallback">Checking ESPN…</p>';loadDossierOverview(node);}
},true);

const debounce={};function deferRender(key,fn,delay=170){clearTimeout(debounce[key]);debounce[key]=setTimeout(fn,delay);}
// One clear popover interaction contract: click a ranked person/team to navigate;
// click the open tile or anywhere else to dismiss WITHOUT triggering the underlying link.
// Capture runs before delegated report navigation and prevents accidental jumps.
function dismissRankHost(host,selector){
 host.hidden=true;host.dataset.rank='';host.innerHTML='';
 el('explore-content').querySelectorAll(selector).forEach(button=>button.setAttribute('aria-expanded','false'));
}
el('explore-content').addEventListener('click',event=>{
 const playerHost=el('player-ranking-host'),summaryHost=el('summary-ranking-host'),positionHost=el('position-ranking-host');
 const host=playerHost&&!playerHost.hidden?playerHost:summaryHost&&!summaryHost.hidden?summaryHost:positionHost&&!positionHost.hidden?positionHost:null;
 if(!host)return;
 if(host===positionHost&&event.target.closest('#position-share-select')){event.stopPropagation();return;}
 const player=event.target.closest('[data-ranking-player]');
 const team=event.target.closest('[data-ranking-team]');
 const within=host.contains(event.target);
 // Clicking the trigger itself toggles the tile closed. Everywhere else outside
 // also closes it and consumes that FIRST click, including links and controls.
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const shareSwitch=within&&host===positionHost?event.target.closest('[data-share-pos]'):null;
 if(shareSwitch){
   XL.positionSharePos=shareSwitch.dataset.sharePos;
   dismissRankHost(host,'.position-rank-trigger');
   togglePositionRanking(2);
   return;
 }
 if(host===playerHost)dismissRankHost(host,'.player-rank-trigger');
 else dismissRankHost(host,host===positionHost?'.position-rank-trigger':'.summary-rank-trigger');
 if(within&&player)openExplorer('profile',player.dataset.rankingPlayer);
 else if(within&&team)openExplorer('summary',null,{teamId:team.dataset.rankingTeam});
},true);
// Entire analytic panels are hotspots, except the existing per-week bars.
// Capture runs before delegated week navigation but preserves weekly-bar clicks.
el('explore-content').addEventListener('click',e=>{
 const pos=e.target.closest('[data-position-comparison]');
 const weeks=e.target.closest('[data-league-contributions]');
 if(!pos&&!weeks)return;
 if(e.target.closest('[data-position-week],.position-rank-trigger,#position-ranking-host,select,input'))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 if(pos){XL.positionCompareWeek=XL.positionWeek||'all';openExplorer('position-compare');}
 else openExplorer('league-contributions');
},true);
el('explore-content').addEventListener('change',e=>{
 if(e.target.id!=='position-share-select')return;
 XL.positionSharePos=e.target.value;
 const host=el('position-ranking-host');if(host){host.hidden=true;host.dataset.rank='';host.innerHTML='';}
 togglePositionRanking(2);
});
el('explore-content').addEventListener('keydown',e=>{
 if(!['Enter',' '].includes(e.key))return;
 const panel=e.target.closest('[data-position-comparison],[data-league-contributions]');
 if(panel&&e.target===panel){e.preventDefault();panel.click();}
});
// Header controls, the modal's dark backdrop, and any other outside surface
// follow the same dismiss-first rule. The next click activates that control.
document.addEventListener('click',event=>{
 const playerHost=el('player-ranking-host'),summaryHost=el('summary-ranking-host'),positionHost=el('position-ranking-host');
 const host=playerHost&&!playerHost.hidden?playerHost:summaryHost&&!summaryHost.hidden?summaryHost:positionHost&&!positionHost.hidden?positionHost:null;
 if(!host||el('explore-content').contains(event.target))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 dismissRankHost(host,host===playerHost?'.player-rank-trigger':host===positionHost?'.position-rank-trigger':'.summary-rank-trigger');
},true);
el('explore-content').addEventListener('keydown',event=>{
 if(event.key!=='Enter'&&event.key!==' ')return;
 const row=event.target.closest('[data-ranking-player],[data-ranking-team]');if(!row)return;
 const host=row.closest('.summary-ranking-host');if(!host||host.hidden)return;
 event.preventDefault();row.click();
});
el('explore-content').addEventListener('click',e=>{
 const host=el('player-ranking-host');
 if(host&&!host.hidden&&!e.target.closest('.player-rank-trigger,#player-ranking-host')){
  host.hidden=true;host.dataset.rank='';document.querySelectorAll('.player-rank-trigger').forEach(x=>x.setAttribute('aria-expanded','false'));
 }
});
el('explore-content').addEventListener('click',e=>{
 const host=el('summary-ranking-host');
 if(host&&!host.hidden&&e.target.closest('.summary-ranking-host')){
  host.hidden=true;host.dataset.rank='';
  document.querySelectorAll('.summary-rank-trigger').forEach(b=>b.setAttribute('aria-expanded','false'));
  e.stopImmediatePropagation();
 }
});
el('explore-content').addEventListener('click',e=>{
 const host=el('summary-ranking-host');
 if(host&&!host.hidden&&!e.target.closest('.summary-ranking-host,.summary-rank-trigger')){
   host.hidden=true;host.dataset.rank='';
   document.querySelectorAll('.summary-rank-trigger').forEach(b=>b.setAttribute('aria-expanded','false'));
 }
});
el('explore-content').addEventListener('click',async e=>{
 // Graph bars link to a focused starting lineup; the chart surface opens Position Allocation.
 const positionWeek=e.target.closest('[data-position-week]');
 if(positionWeek){e.stopPropagation();openExplorer('summary',null,{teamId:String(XL.viewTeamId??currentTeamId),week:Number(positionWeek.dataset.positionWeek),focus:'franchise-lineup'});return;}
 const weeklyBar=e.target.closest('[data-weekly-bar-week]');
 if(weeklyBar){e.stopPropagation();openExplorer('summary',null,{teamId:weeklyBar.dataset.weeklyBarTeam,week:Number(weeklyBar.dataset.weeklyBarWeek),focus:'franchise-lineup'});return;}
 const playerWeek=e.target.closest('[data-player-week]');
 if(playerWeek){e.stopPropagation();openPlayerPositionContributions(XL.player,Number(playerWeek.dataset.playerWeek));return;}
 const scoringChart=e.target.closest('[data-chart-surface]');if(scoringChart){e.stopPropagation();openPlayerPositionAllocation(scoringChart.dataset.chartSurface||XL.player||currentPlayerId);return;}
 // Clicking the non-player surface of Starting Lineup opens the expanded roster.
 // Player rows still open dossiers, and slot buttons still open what-if substitutions.
 const lineupSurface=e.target.closest('.franchise-week-panel');
 if(lineupSurface&&!e.target.closest('tr.franchise-player-row,.franchise-sub-menu,.franchise-slot-button,select,button,a,input')){
  openExplorer('roster');return;
 }
 const posRank=e.target.closest('[data-position-rank]');
 if(posRank){e.stopPropagation();togglePositionRanking(Number(posRank.dataset.positionRank));return;}
 const rank=e.target.closest('[data-player-rank]');
 if(rank){e.stopPropagation();togglePlayerRanking(Number(rank.dataset.playerRank));return;}
 const rankOverlay=e.target.closest('#player-ranking-host');
 if(rankOverlay){rankOverlay.hidden=true;rankOverlay.dataset.rank='';document.querySelectorAll('.player-rank-trigger').forEach(x=>x.setAttribute('aria-expanded','false'));e.stopPropagation();return;}
 const archivePanel=e.target.closest('[data-open-player-analytics]');
 if(archivePanel&&!e.target.closest('[data-gamelog-week],button,a,select,input')){e.stopPropagation();openExplorer('player-analytics',XL.player);return;}
 const openGame=e.target.closest('[data-gamelog-week]');
 if(openGame){const player=model.players[XL.player]||XL.free.find(p=>String(p.id)===String(XL.player));const team=player?teamForPlayer(player):null;openExplorer('summary',null,{teamId:String(team?.id??XL.viewTeamId??currentTeamId),week:Number(openGame.dataset.gamelogWeek),focus:'franchise-lineup'});return;}
 const picker=e.target.closest('[data-lineup-picker]');
 if(picker){
  e.stopPropagation();const panel=picker.closest('[data-lineup-team]');
  const t=findTeam(panel?.dataset.lineupTeam),week=Number(panel?.dataset.lineupWeek);
  if(!t)return;
  const scenario=whatIfFor(t,week),key=picker.dataset.lineupPicker;
  scenario.picker=scenario.picker===key?null:key;
  refreshLineupView();return;
 }
 const chosen=e.target.closest('[data-sub-bench]');
 if(chosen){
  e.stopPropagation();const panel=chosen.closest('[data-lineup-team]');
  const t=findTeam(panel?.dataset.lineupTeam),week=Number(panel?.dataset.lineupWeek);
  if(!t)return;
  const scenario=whatIfFor(t,week),{subOrigin,subBench}=chosen.dataset;
  // A bench player can fill only one starting slot per what-if scenario.
  for(const [origin,pid] of Object.entries(scenario.swaps))if(origin!==subOrigin&&pid===subBench)delete scenario.swaps[origin];
  if(subBench===subOrigin)delete scenario.swaps[subOrigin];else scenario.swaps[subOrigin]=subBench;
  scenario.picker=null;refreshLineupView();return;
 }
 const reset=e.target.closest('[data-reset-lineup]');
 if(reset){
  e.stopPropagation();const panel=reset.closest('[data-lineup-team]');
  const t=findTeam(panel?.dataset.lineupTeam),week=Number(panel?.dataset.lineupWeek);
  if(t){const scenario=whatIfFor(t,week);scenario.swaps={};scenario.picker=null;refreshLineupView();}return;
 }
 // Focus the full scoring register within the existing Weekly Production view.
 // This changes scroll position only, never the modal history or the Back button.
 const weeklyPanel=e.target.closest('#weekly-full-ledger');
 if(weeklyPanel&&!e.target.closest('[data-open-match],button,a,select,input')){
  focusWeeklyLedger();return;
 }
 const focusItem=e.target.closest('[data-weekly-focus]');
 if(focusItem&&!e.target.closest('.weekly-legend-remove')){XL.focusedSeries=XL.focusedSeries===focusItem.dataset.weeklyFocus?null:focusItem.dataset.weeklyFocus;renderExplorer();return;}
 if(e.target.closest('[data-weekly-focus-table]')){focusWeeklyLedger();return;}
 const positionMore=e.target.closest('[data-position-show-more]');
 if(positionMore){const key=positionMore.dataset.positionShowMore;XL.positionRowsVisible.set(key,(XL.positionRowsVisible.get(key)||30)+30);if(XL.positionRowsVisible.size>80)XL.positionRowsVisible=new Map([...XL.positionRowsVisible].slice(-50));schedulePositionRender();return;}
 const positionMode=e.target.closest('[data-position-view]');
 if(positionMode){XL.positionComparisonView=positionMode.dataset.positionView;recordFilterDiagnostic('view',XL.positionComparisonView);schedulePositionRender();return;}
 const leagueMode=e.target.closest('[data-league-view]');
 if(leagueMode){XL.leagueComparisonView=leagueMode.dataset.leagueView;renderExplorer();return;}
 const contribution=e.target.closest('[data-league-week][data-league-team]');
 if(contribution){e.stopPropagation();openExplorer('summary',null,{teamId:contribution.dataset.leagueTeam,week:Number(contribution.dataset.leagueWeek),focus:'franchise-lineup'});return;}
 const button=e.target.closest('button,[data-ledger-team],[data-open-player],[data-set-team],[data-open-match],[data-open-weekly],[data-open-weekly-table],[data-matchup-team]');if(!button)return;
 if(button.dataset.matchupTeam!==undefined){openExplorer('summary',null,{teamId:button.dataset.matchupTeam,week:XL.viewWeek,focus:'franchise-lineup'});return;}
 if(button.dataset.summaryRank!==undefined){toggleSummaryRanking(Number(button.dataset.summaryRank));return;}
 if(button.dataset.summaryRankClose!==undefined){el('summary-ranking-host').hidden=true;document.querySelectorAll('.summary-rank-trigger').forEach(b=>b.setAttribute('aria-expanded','false'));return;}
 if(button.dataset.ledgerTeam!==undefined){openExplorer('matchup',null,{week:Number(button.closest('tr')?.dataset.ledgerWeek||model.currentWeek||currentWeek)});return;}
 if(button.dataset.openWeeklyTable!==undefined){openExplorer('weekly',null,{focus:'weekly-ledger'});return;}
 if(button.id==='weekly-show-chart'){XL.focusTarget=null;renderExplorer();el('explore-content').scrollTop=0;return;}
 if(button.dataset.openWeekly!==undefined){openExplorer('weekly');return;}
 if(button.dataset.openPlayer){openExplorer('profile',button.dataset.openPlayer);return;}
 if(button.dataset.openMatch){openExplorer('matchup',null,{week:Number(button.dataset.openMatch)});return;}
 if(button.closest('.weekly-legend-remove'))XL.focusedSeries=null;
 if(button.dataset.weeklyHideBars!==undefined){XL.weekly.showBars=false;renderExplorer();return;}
 if(button.dataset.weeklyHideLeague!==undefined){XL.weekly.showLeague=false;renderExplorer();return;}
 if(button.dataset.weeklyHideMean!==undefined){XL.weekly.showMean=false;renderExplorer();return;}
 if(button.dataset.weeklyRemove){XL.weekly.compare=XL.weekly.compare.filter(id=>id!==button.dataset.weeklyRemove);renderExplorer();return;}
 if(button.dataset.weeklyRemoveLine!==undefined){XL.weekly.lines=XL.weekly.lines.filter(id=>id!==button.dataset.weeklyRemoveLine);renderExplorer();return;}
 if(button.id==='weekly-clear'){XL.weekly.compare=[];XL.weekly.lines=['active'];XL.weekly.showBars=true;XL.weekly.showLines=true;XL.weekly.showNames=false;XL.weekly.showPoints=true;renderExplorer();return;}
 if(button.dataset.setTeam){openExplorer('summary',null,{teamId:button.dataset.setTeam});return;}
 if(button.dataset.graphStat){
  showStatHelp(button);return;}
 if(button.dataset.preset){const [x,y]=button.dataset.preset.split(',');if(!graphPresetAvailable(x,y))return;XL.graph.x=x;XL.graph.y=y;XL.graphUserSelected=true;XL.graphNotice='';renderExplorer();return;}
 if(button.id==='graph-swap'){const {x,y}=XL.graph;XL.graph.x=y;XL.graph.y=x;renderExplorer();return;}
 if(button.id==='graph-export'){exportGraph();return;}
 if(button.id==='graph-load-nflverse'){loadNFLverse();return;}
 if(button.id==='graph-export-svg'){exportSVG();return;}
 if(button.id==='graph-clear-import'){XL.advanced.clear();XL.importedColumns=[];renderExplorer();return;}
 if(button.id==='agent-reload'){loadFreeAgentPool(true);return;}
 if(button.id==='player-log-toggle-all'){XL.playerArchiveAll=!XL.playerArchiveAll;renderExplorer();return;}
 if(button.id==='player-log-export'){const p=model.players[String(XL.player)]||XL.free.find(x=>String(x.id)===String(XL.player));if(p)playerLogCsv(p);return;}
 if(button.id==='position-load-more'){void loadFreeAgentPool(false);return;}
 if(button.id==='agent-more'){loadFreeAgentPool(false);return;}
 if(button.id==='lab-generate-ai'){void generateAIOutlook();return;}
 if(button.id==='lab-fetch-news'){fetchNews(button.dataset.newsId);return;}
});
el('explore-content').addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){
  const positionWeek=e.target.closest('[data-position-week]');if(positionWeek){e.preventDefault();positionWeek.click();return;}
  const bar=e.target.closest('[data-weekly-bar-week]');if(bar){e.preventDefault();bar.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
  const playerBar=e.target.closest('[data-player-week]');if(playerBar){e.preventDefault();playerBar.click();return;}
  if(e.target.matches('[data-open-positions]')){e.preventDefault();e.target.click();return;}
 }
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('h4[data-open-roster]')){e.preventDefault();openExplorer('roster');return;}
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-open-player-analytics]')){e.preventDefault();openExplorer('player-analytics',XL.player);return;}
 if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-gamelog-week]')){
  e.preventDefault();const row=e.target.closest('[data-gamelog-week]'),player=model.players[XL.player]||XL.free.find(p=>String(p.id)===String(XL.player));const team=player?teamForPlayer(player):null;
  openExplorer('summary',null,{teamId:String(team?.id??XL.viewTeamId??currentTeamId),week:Number(row.dataset.gamelogWeek),focus:'franchise-lineup'});return;
 }
 if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-player-rank]')){e.preventDefault();togglePlayerRanking(Number(e.target.closest('[data-player-rank]').dataset.playerRank));return;}
 const matchupPanel=e.target.closest('[data-matchup-team]');
 if(matchupPanel&&(e.key==='Enter'||e.key===' ')&&e.target===matchupPanel){e.preventDefault();openExplorer('summary',null,{teamId:matchupPanel.dataset.matchupTeam,week:XL.viewWeek,focus:'franchise-lineup'});return;}
 const agentRow=e.target.closest('tr[data-open-player]');
 if(agentRow && (e.key==='Enter'||e.key===' ') && e.target===agentRow){e.preventDefault();openExplorer('profile',agentRow.dataset.openPlayer);return;}
 const legend=e.target.closest('[data-weekly-focus]');
 if(legend&&(e.key==='Enter'||e.key===' ')&&!e.target.closest('.weekly-legend-remove')){e.preventDefault();XL.focusedSeries=XL.focusedSeries===legend.dataset.weeklyFocus?null:legend.dataset.weeklyFocus;renderExplorer();return;}
 const weeklyTable=e.target.closest('[data-open-weekly-table]');
 if(weeklyTable&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openExplorer('weekly',null,{focus:'weekly-ledger'});return;}
 const teamRow=e.target.closest('tr[data-set-team]');
 if(teamRow&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openExplorer('summary',null,{teamId:teamRow.dataset.setTeam});return;}
 const weeklyButton=e.target.closest('[data-open-weekly]');
 if(weeklyButton&&(e.key==='Enter'||e.key===' ')){
  e.preventDefault();openExplorer('weekly');return;
 }
 const row=e.target.closest('tr[data-open-match]');
 if(row&&(e.key==='Enter'||e.key===' ')&&e.target.closest('button,a,select,input')===null){
   e.preventDefault();openExplorer('matchup',null,{week:Number(row.dataset.openMatch)});
 }
});
el('explore-jump').addEventListener('change',e=>{const type=e.target.value;if(type&&type!==XL.open)openExplorer(type,['profile','player-analytics'].includes(type)?(XL.player||currentPlayerId||rowsFor(getTeam())[0]?.id):null);});
el('home-go-to')?.addEventListener('change',e=>{
 const type=e.target.value;
 e.target.value='';
 if(type)openExplorer(type,['profile','player-analytics'].includes(type)?(currentPlayerId||rowsFor(getTeam())[0]?.id):null);
});

el('explore-match-week').addEventListener('change',e=>{if(e.target.id==='lab-match-week'){XL.viewWeek=Number(e.target.value);renderExplorer();}});
el('explore-club').addEventListener('change',e=>{
 if(e.target.id!=='explore-team-switch')return;
 const chosen=findTeam(e.target.value);if(!chosen)return;
 const id=String(chosen.id);
 if(id===String(XL.viewTeamId)&&id===String(currentTeamId))return;
 const selectedPlayer=XL.player; // A player file stays on the same person.
 const opts={teamId:id};
 if(XL.open==='summary'&&Number.isFinite(Number(XL.franchiseWeek))&&Number(XL.franchiseWeek)>0)opts.week=Number(XL.franchiseWeek);
 if(XL.open==='matchup'&&Number.isFinite(Number(XL.viewWeek)))opts.week=Number(XL.viewWeek);
 currentTeamId=id;
 updateUI(); // Intentional active-team switch across every report.
 XL.player=selectedPlayer;
 openExplorer(XL.open,XL.open==='profile'?selectedPlayer:null,opts);
});

el('explore-content').addEventListener('change',e=>{
 if(e.target.id==='roster-team-switch'){
  const id=String(e.target.value),team=findTeam(id);if(!team)return;
  if(id!==String(currentTeamId)){
   currentTeamId=id;currentPlayerId=null;updateUI();
   XL.viewTeamId=id;XL.franchiseWeek=null;XL.franchiseWeekTeam=id;
   // Back from this special roster switch goes to the NEW home franchise.
   XL.history.push({type:'summary',player:null,week:null,franchiseWeek:null,focus:null,team:id});
   XL.future=[];
  }else XL.viewTeamId=id;
  XL.viewTeamId=id;renderExplorer();
  el('explore-context').textContent=`${model.season} SEASON`;explorerClubHeader(XL.open,XL.player);
  el('explore-back').disabled=!XL.history.length;
  el('explore-forward').disabled=true;
  return;
 }
 if(e.target.id==='player-log-range'){XL.playerLogRange=e.target.value;renderExplorer();return;}
 if(e.target.id==='position-player-pool'){XL.positionComparisonPool=e.target.value;recordFilterDiagnostic('pool',e.target.value);schedulePositionRender();if(e.target.value!=='ROSTERED'&&model.source==='espn'&&!XL.freeLoaded&&!XL.freeBusy)void loadFreeAgentPool(false);return;}
 if(e.target.id==='position-player-sort'){XL.positionComparisonSort=e.target.value;recordFilterDiagnostic('sort',e.target.value);schedulePositionRender();return;}
 if(e.target.id==='position-compare-position'){XL.positionComparePos=e.target.value;recordFilterDiagnostic('position',e.target.value);schedulePositionRender();return;}
 if(e.target.id==='position-compare-week'){XL.positionCompareWeek=e.target.value;recordFilterDiagnostic('week',e.target.value);schedulePositionRender();return;}
 if(e.target.id==='league-compare-position'){XL.leagueComparisonPos=e.target.value;renderExplorer();return;}
 if(e.target.id==='position-week-filter'){XL.positionWeek=e.target.value;XL.positionFocusPlayer=null;renderExplorer();return;}
 if(e.target.id==='franchise-lineup-week'){
  XL.franchiseWeek=Number(e.target.value);
  const oldPanel=el('explore-content').querySelector('.franchise-week-panel');
  if(oldPanel)refreshFranchiseLineup();
  return;
 }
 if(e.target.id==='lab-match-week'){
  XL.viewWeek=Number(e.target.value);renderExplorer();
 }
});
el('explore-content').addEventListener('change',async e=>{
 const t=e.target;if(t.id==='graph-import'&&t.files[0]){try{await importAdvanced(t.files[0])}catch(error){alert(error.message)}return;}
 if(t.id==='weekly-compare-add'){if(t.value&&!XL.weekly.compare.includes(t.value)&&t.value!==String(explorerTeam().id))XL.weekly.compare.push(t.value);renderExplorer();return;}
 if(t.id==='weekly-line-add'){
   if(t.value && XL.weekly.lines.length<10 && !XL.weekly.lines.includes(t.value)) XL.weekly.lines.push(t.value);
   renderExplorer();return;
 }
 if(t.id==='weekly-show-bars'){XL.weekly.showBars=t.checked;renderExplorer();return;}
 if(t.id==='weekly-show-lines'){XL.weekly.showLines=t.checked;renderExplorer();return;}
 if(t.id==='weekly-show-names'){XL.weekly.showNames=t.checked;renderExplorer();return;}
 if(t.id==='weekly-show-points'){XL.weekly.showPoints=t.checked;renderExplorer();return;}
 if(t.id==='weekly-show-league'){XL.weekly.showLeague=t.checked;renderExplorer();return;}
 if(t.id==='weekly-show-mean'){XL.weekly.showMean=t.checked;renderExplorer();return;}
 if(t.id==='lab-match-week'){XL.viewWeek=Number(t.value);renderExplorer();return;}
 if(t.id==='agent-position'){XL.agent.pos=t.value;if(t.value==='DEF')XL.agent.sort='projected';renderExplorer();return;}
 if(t.id==='agent-sort'){XL.agent.sort=t.value;renderExplorer();return;}
 const fields={'graph-x':'x','graph-y':'y','graph-pos':'pos','graph-scope':'scope','graph-minimum':'minimum','graph-labels':'showLabels','graph-trend':'trend'};
 if(t.id in fields){XL.graph[fields[t.id]]=t.type==='checkbox'?t.checked:t.id==='graph-minimum'?Number(t.value):t.value;XL.graphUserSelected=true;XL.graphNotice='';renderExplorer();return;}
});
function renderSearchResults(input,report){
 if(XL.open!==report||!input.isConnected)return;
 const active=document.activeElement,inside=el('explore-content').contains(active);
 const selection=active===input?[input.selectionStart,input.selectionEnd,input.selectionDirection]:null;
 const attribute=['data-graph-player','data-preset','data-open-player','data-graph-stat'].find(name=>active?.hasAttribute(name));
 const selector=active?.id?'#'+CSS.escape(active.id):attribute?`[${attribute}="${CSS.escape(active.getAttribute(attribute))}"]`:null;
 renderExplorer();
 // Leave focus outside this replaced subtree alone; the user may have moved on.
 if(!inside||active.isConnected)return;
 const renderedInput=el(input.id),afterRender=document.activeElement;
 const restore=()=>{
  if(XL.open!==report||el(input.id)!==renderedInput||document.activeElement!==afterRender)return;
  const target=(selector&&el('explore-content').querySelector(selector))||renderedInput;
  target?.focus({preventScroll:true});
  if(selection&&target===renderedInput)target.setSelectionRange(...selection);
 };
 // Graph points are mounted by the already scheduled graph paint frame.
 if(attribute==='data-graph-player')requestAnimationFrame(restore);else restore();
}
el('explore-content').addEventListener('input',e=>{
 const t=e.target;
 if(t.id==='agent-search'){XL.agent.search=t.value;deferRender('agent',()=>renderSearchResults(t,'agents'));}
 if(t.id==='graph-search'){XL.graph.search=t.value;deferRender('graph',()=>renderSearchResults(t,'graph'));}
});
// Initialization runs after the original dashboard script, preserving its primary UI.
explorerUpdate();
prepareDossierNews();

el('explore-content').addEventListener('keydown',event=>{const chart=event.target.closest('[data-chart-surface]');if(chart&&event.target===chart&&['Enter',' '].includes(event.key)){event.preventDefault();openPlayerPositionAllocation(chart.dataset.chartSurface||XL.player||currentPlayerId);}});

const homePointsChart=document.querySelector('.home-points-history');
homePointsChart.addEventListener('click',event=>{event.stopPropagation();openPlayerPositionAllocation(currentPlayerId);});
homePointsChart.addEventListener('keydown',event=>{if(event.target===homePointsChart&&['Enter',' '].includes(event.key)){event.preventDefault();openPlayerPositionAllocation(currentPlayerId);}});

function openPlayerPositionAllocation(id){
 const p=model.players[id]||XL.free.find(p=>String(p.id)===String(id)),team=p?teamForPlayer(p):null;
 openExplorer('positions',null,{teamId:String(team?.id??XL.viewTeamId??currentTeamId)});
}
