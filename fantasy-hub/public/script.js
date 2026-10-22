/* GRIDIRON/86 — standalone fantasy dashboard. No framework, bundler, or API key. */
'use strict';

const API = 'https://api.sleeper.app/v1';
const el = id => document.getElementById(id);
const nfmt = (value, digits = 1) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum = xs => xs.reduce((a, b) => a + (number(b) ?? 0), 0);
const currentYear = new Date().getFullYear();
const initialUrlParams = new URLSearchParams(window.location.search);
let model = makeDemo();
let currentTeamId = '1';
let currentPlayerId = null;
let currentWeek = 6;
let playerDirectory = null;
let linkedUserId = null;
let loading = false;

const teamName = t => t?.name || `Team ${t?.id ?? '—'}`;
const findTeam = id => model.teams.find(t => String(t.id) === String(id));
const getTeam = () => findTeam(currentTeamId) || model.teams[0];
const scoredWeeks = () => model.weeks;
const getStats = team => {
  const history = team?.history || [];
  const pts = sum(history.map(x => x.points));
  return {pts, avg:history.length ? pts / history.length : 0,
    against:sum(history.map(x => x.oppPoints)),
    high:history.reduce((best,x)=>!best || x.points>best.points ? x:best, null), played:history.length};
};
const ranked = () => [...model.teams].sort((a,b)=>b.wins-a.wins || b.ties-a.ties || getStats(b).pts-getStats(a).pts || teamName(a).localeCompare(teamName(b)));
function setStatus(text, isLive = false) {
  el('connection-status').textContent = text;
  el('status-dot').classList.toggle('live', isLive);
}
function setDialogMessage(message, kind = '') {
  const p=el('dialog-message'); p.textContent=message;p.className=`dialog-message ${kind}`;
}
function clock() { el('system-clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
clock(); setInterval(clock, 60_000);

function makeDemo(){
  const p=[
    ['allen','Josh Allen','QB','BUF',[24.2,31.6,18.4,22.0,19.0,27.4]],
    ['cmc','Christian McCaffrey','RB','SF',[18.4,22.2,14.0,21.0,22.0,19.6]],
    ['chase',"Ja’Marr Chase",'WR','CIN',[17.6,21.0,19.0,23.0,22.0,24.2]],
    ['kelce','Travis Kelce','TE','KC',[10,14.2,12,16,13,13.2]],
    ['tucker','Justin Tucker','K','BAL',[8,11,7.6,10,9,9]],
    ['dal','Dallas Defense','DEF','DAL',[12,9,8,13,9,11]],
    ['deebo','Deebo Samuel','WR','SF',[15,17,11,13,14,12.4]],
    ['cook','James Cook','RB','BUF',[12.2,13.6,10.2,14,12.4,14.6]],
    ['demo-flex','Jordan Vale','WR','CHI',[9,15,7,11,16,12]]
  ];
  const players=Object.fromEntries(p.map(([id,name,pos,nfl,weeks])=>[id,{id,name,pos,nfl,status:'ACTIVE',scores:Object.fromEntries(weeks.map((v,i)=>[i+1,v]))}]));
  players.deebo.status='QUESTIONABLE';
  const scores=[108.4,132.6,96.2,145.8,119.6,140.0], against=[102.2,115,119.6,121.6,101.3,148.6];
  const names=['The Gridiron Club','Sunday Strikers','Fourth & Forever','End Zone Theory','Two-Minute Drill','The Blitz Unit','Red Zone Society','Hail Mary Club'];
  const records=[[4,2],[6,0],[5,1],[4,2],[3,3],[2,4],[1,5],[0,6]];
  const teams=names.map((name,i)=>({id:String(i+1),name,owner:i===0?'Example Owner':`Manager ${i+1}`,
    wins:records[i][0],losses:records[i][1],ties:0,playerIds:i===0?p.map(x=>x[0]):[],
    history:i===0?scores.map((points,index)=>({week:index+1,points,oppPoints:against[index],opponentId:String(index%7+2),
      starters:Object.fromEntries(p.slice(0,6).map(x=>[x[0],x[4][index]]))}))
      :scores.map((v,j)=>({week:j+1,points:Math.round((v*(.8+i*.035)+(j%3)*5)*10)/10,oppPoints:null,opponentId:null,starters:{}}))}));
  // Fictional opponent rosters let the Trade Desk be explored before connecting.
  const demoNames=['Riley Park','Drew Palmer','Avery Knight','Cameron Stone','Miles Sutton','Alex Reed','Sam Brooks','Taylor Hayes','Casey Ward','Logan Ellis','Morgan West','Blake Quinn'];
  const demoPositions=['QB','RB','RB','WR','WR','TE','WR','K','DEF','RB','WR','QB'];
  for(let i=1;i<teams.length;i++){
    teams[i].playerIds=demoPositions.map((pos,j)=>{
      const id=`demo-${i}-${j}`,baseline=pos==='QB'?18:pos==='K'||pos==='DEF'?7:10;
      players[id]={id,name:demoNames[(j+i)%demoNames.length]+' '+String(i),pos,nfl:['CHI','GB','DET','MIN','BUF','KC'][j%6],status:'ACTIVE',scores:Object.fromEntries(Array.from({length:6},(_,w)=>[w+1,Math.round((baseline+(i+j+w)%7-2)*10)/10]))};
      return id;
    });
  }
  // Recorded exhibition lineups, including benches, exercise the matchup lists.
  for(const [index,team] of teams.entries())for(const history of team.history){
    history.lineup=team.playerIds.map((id,playerIndex)=>({id,starter:index===0?id in history.starters:playerIndex<9,points:players[id].scores[history.week]}));
    if(index>0)history.starters=Object.fromEntries(history.lineup.filter(row=>row.starter).map(row=>[row.id,row.points]));
  }
  return {source:'demo',leagueId:null,league:'Exhibition League',season:2026,scoring:'PPR',weeks:[1,2,3,4,5,6],
    teams,players, liveWeek:null, description:'FICTIONAL EXAMPLE · not league results'};
}

function updateUI() {
  if(!model?.teams?.length) return;
  const team=getTeam(); currentTeamId=String(team.id);
  const currentValues=[...el('team-select').options].map(x=>x.value);
  if(model.teams.length!==currentValues.length || model.teams.some(t=>!currentValues.includes(String(t.id)))) {
    el('team-select').replaceChildren(...model.teams.map(t=>new Option(teamName(t),String(t.id))));
  }
  el('team-select').value=currentTeamId;
  el('team-name').textContent=teamName(team);
  el('team-owner').textContent=`${team.owner || 'League member'} · ${model.league}`;
  el('league-name').textContent=model.league;
  el('season-name').textContent=`${model.season} SEASON`;
  el('header-current-week').textContent='Week '+String(model.currentWeek || model.liveWeek || Math.max(1,...(model.weeks||[1])));
  el('header-record').textContent=`${team.wins}–${team.losses}${team.ties ? `–${team.ties}`:''}`;
  el('header-rank').textContent=String(ranked().findIndex(t=>String(t.id)===currentTeamId)+1).padStart(2,'0')+` / ${String(model.teams.length).padStart(2,'0')}`;
  el('header-scoring').textContent=model.scoring;
  const stats=getStats(team);
  el('total-points').textContent=nfmt(stats.pts,2);
  el('avg-points').textContent=stats.played?nfmt(stats.avg,2):'—';
  el('best-week').textContent=stats.high?`W${String(stats.high.week).padStart(2,'0')} / ${nfmt(stats.high.points)}`:'—';
  el('points-against').textContent=team.history.some(x=>x.oppPoints!=null)?nfmt(stats.against,2):'—';
  el('weeks-reported').textContent=String(stats.played).padStart(2,'0');
  // Home summary mirrors the expanded Club Overview statistics; one source of truth.
  const leagueMean = model.teams.length ? sum(model.teams.map(t => getStats(t).pts)) / model.teams.length : null;
  const values = team.history.map(h => h.points).filter(v => Number.isFinite(v));
  const sd = values.length ? Math.sqrt(sum(values.map(v => (v-stats.avg)**2)) / values.length) : null;
  const standing = ranked().findIndex(t => String(t.id) === currentTeamId) + 1;
  const pad = n => String(n).padStart(2,'0');
  el('home-league-delta').textContent = leagueMean === null ? '—' : `${stats.pts-leagueMean>0?'+':''}${nfmt(stats.pts-leagueMean,1)}`;
  el('home-scoring-std').textContent = nfmt(sd,1);
  el('home-league-position').textContent = pad(standing);
  el('home-record').textContent = el('header-record').textContent;
  el('home-standing').textContent = `${pad(standing)}/${pad(model.teams.length)}`;
  el('home-point-diff').textContent = team.history.some(h=>h.oppPoints!=null) ? `${stats.pts-stats.against>0?'+':''}${nfmt(stats.pts-stats.against,1)}` : '—';
  el('summary-footnote').textContent=model.source==='demo'?'DEMO MODE — All numbers are example figures.' : model.source==='sleeper'?'Calculated from Sleeper league matchups. Current week can be provisional.':model.source==='espn'?'ESPN fantasy scoring. Current week may be provisional.':'Values supplied by the imported file.';
  setStatus(model.source==='demo'?'SAMPLE DATA':model.source==='sleeper'?'SLEEPER CONNECTED':model.source==='espn'?'ESPN CONNECTED':'LOCAL FILE',model.source!=='demo');
  el('roster-label').textContent=model.source==='demo'?'PERSONNEL / SAMPLE':model.source==='sleeper'?'PERSONNEL / SLEEPER':model.source==='espn'?'PERSONNEL / ESPN':'PERSONNEL / IMPORT';
  el('roster-footnote').textContent=model.source==='demo'?'EXAMPLE STATS ONLY · CONNECT FOR ACTUAL DATA':model.source==='sleeper'?'PLAYER TOTALS FOLLOW AVAILABLE LEAGUE MATCHUP HISTORY':model.source==='espn'?'ESPN SCORING · CURRENT WEEK MAY CHANGE':'STATS PROVIDED BY YOUR FILE';
  el('footer-source').textContent=model.description;
  drawWeekly(team); drawWeeklyHomeLedger(team); drawStandings(); drawPositions(team); updateWeekMenu(team); drawMatchup(team); drawRoster(team); drawProfile(team);
  if(model.source==='sleeper') {try{localStorage.setItem('gridiron86-last',JSON.stringify({league:model.leagueId,roster:currentTeamId}));}catch{}}
  updateDeepLink();
  if(typeof explorerUpdate === "function") explorerUpdate();
}

function updateDeepLink(){
  try{
    const u=new URL(window.location.href);
    if(model.source==='sleeper'){u.searchParams.set('league',model.leagueId);u.searchParams.set('roster',currentTeamId);}
    else {u.searchParams.delete('league');u.searchParams.delete('roster');}
    history.replaceState(null,'',u);
  }catch{}
}

function drawWeekly(team){
  const data=team.history;
  const root=el('weekly-chart');
  el('chart-range').textContent=data.length?`WK ${String(data[0].week).padStart(2,'0')}—${String(data[data.length-1].week).padStart(2,'0')}`:'NO SCORES';
  if(!data.length){root.innerHTML='<div class="empty-chart">NO SCORING HISTORY FOUND FOR THIS FRANCHISE</div>';return;}
  const avg=sum(data.map(x=>x.points))/data.length;
  const max=Math.max(1,...data.map(x=>x.points),avg)*1.15;
  const height=130;
  root.innerHTML=`<div class="chart-average" style="--avg-height:${(avg/max*height).toFixed(1)}px"></div>`+
    data.map((x,i)=>`<div class="chart-col" title="Week ${x.week}: ${nfmt(x.points,2)} pts"><span class="chart-val">${nfmt(x.points,0)}</span><div class="chart-bar" data-home-week="${x.week}" role="button" tabindex="0" aria-label="Open week ${x.week} starting lineup" style="height:${Math.max(1,x.points/max*height).toFixed(1)}px"></div><span class="bar-label">${esc('W'+x.week)}</span></div>`).join('');
}

function drawWeeklyHomeLedger(team){
  const body=el('weekly-home-rows');if(!body)return;
  body.innerHTML=(team.history||[]).map(h=>{
    const week=Number(h.week);
    const played=model.teams.map(t=>t.history.find(x=>Number(x.week)===week)?.points).filter(v=>number(v)!==null);
    const rank=played.length?1+played.filter(v=>v>h.points).length:null;
    const opponent=findTeam(h.opponentId);
    return `<tr class="weekly-home-row" data-week="${week}" tabindex="0" role="button" aria-label="Open week ${week} matchup box score" title="Open week ${week} matchup box score"><td>W${String(week).padStart(2,'0')}</td><td>${esc(opponent?teamName(opponent):'—')}</td><td class="num">${nfmt(h.points,1)}</td><td class="num">${nfmt(h.oppPoints,1)}</td><td class="num">${rank===null?'—':String(rank).padStart(2,'0')+'/'+String(played.length).padStart(2,'0')}</td></tr>`;
  }).join('')||'<tr><td colspan="5">NO SCORES REPORTED</td></tr>';
  body.querySelectorAll('[data-week]').forEach(row=>{
    const open=()=>{if(typeof openExplorer==='function')openExplorer('matchup',null,{week:Number(row.dataset.week)})};
    row.addEventListener('click',e=>{e.stopPropagation();open()});
    row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();open()}});
  });
}

function homeStandingOrder(){
  const key=el('home-standing-sort')?.value||'rank';
  const official=ranked();
  const indexed=new Map(official.map((t,i)=>[String(t.id),i]));
  return [...model.teams].sort((a,b)=>{
    let diff=0;
    if(key==='points')diff=getStats(b).pts-getStats(a).pts;
    else if(key==='avg')diff=getStats(b).avg-getStats(a).avg;
    else if(key==='against')diff=getStats(a).against-getStats(b).against;
    else if(key==='wins')diff=b.wins-a.wins;
    return diff||indexed.get(String(a.id))-indexed.get(String(b.id));
  });
}
function drawStandings(){
  const official=new Map(ranked().map((t,i)=>[String(t.id),i+1]));
  el('standings-body').innerHTML=homeStandingOrder().map(t=>`<tr data-team="${esc(t.id)}" class="${currentTeamId===String(t.id)?'selected':''}" tabindex="0" title="Select ${esc(teamName(t))}; double-click for Club Overview"><td>${String(official.get(String(t.id))).padStart(2,'0')}</td><td>${esc(teamName(t))}</td><td>${t.wins}–${t.losses}${t.ties?`–${t.ties}`:''}</td><td class="num">${nfmt(getStats(t).pts,1)}</td></tr>`).join('');
}
// Delegate row events so re-rendering a selection never loses double-clicks.
el('standings-body').addEventListener('click',e=>{
  const row=e.target.closest('tr[data-team]');if(!row)return;
  const id=row.dataset.team;
  currentTeamId=id;currentPlayerId=null;updateUI();
  if(e.detail>=2 && typeof openExplorer==='function')openExplorer('summary');
  e.stopPropagation();
});
el('standings-body').addEventListener('keydown',e=>{
  const row=e.target.closest('tr[data-team]');if(!row)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();currentTeamId=row.dataset.team;currentPlayerId=null;updateUI();e.stopPropagation();}
});
el('home-standing-sort')?.addEventListener('change',()=>drawStandings());

function homePositionTotals(team,period='all'){
 const totals={QB:0,RB:0,WR:0,TE:0,K:0,DEF:0};let known=0;
 (team.history||[]).filter(h=>period==='all'||Number(h.week)===Number(period)).forEach(h=>Object.entries(h.starters||{}).forEach(([id,points])=>{
  const position=model.players[id]?.pos==='D/ST'?'DEF':model.players[id]?.pos;
  if(Object.hasOwn(totals,position)&&number(points)!==null){totals[position]+=points;known++;}
 }));return {totals,known};
}
function drawPositions(team){
 const picker=el('home-position-week'),weeks=[...new Set(team.history.map(h=>Number(h.week)))].sort((a,b)=>a-b),period=picker.value==='all'||weeks.includes(Number(picker.value))?picker.value:'all';
 picker.innerHTML='<option value="all">Season</option>'+weeks.map(w=>`<option value="${w}">Week ${w}</option>`).join('');picker.value=period;
 const {totals,known}=homePositionTotals(team,period),max=Math.max(...Object.values(totals),1),total=sum(Object.values(totals)),colors={QB:'#487ebb',RB:'#399676',WR:'#9466bc',TE:'#b85d70',K:'#b07c33',DEF:'#657b83'};
 el('position-caption').textContent=known?'':'No starter scores for this period.';
 el('position-chart').innerHTML=known?Object.entries(totals).map(([pos,value])=>`<div class="position-row"><strong>${pos}</strong><div class="meter-track"><button type="button" class="meter-fill" data-home-position="${pos}" style="width:${Math.max(1,Math.min(100,100*Math.max(0,value)/max)).toFixed(1)}%;background:${colors[pos]}" aria-label="Open ${pos} position allocation${period==='all'?' for the season':' for week '+period}"></button></div><b>${nfmt(value,1)}<small>${total>0&&value>=0?nfmt(value/total*100,0)+'%':''}</small></b></div>`).join(''):'<div class="empty-chart">NO POSITION DATA</div>';
}
el('home-position-week').addEventListener('change',()=>drawPositions(getTeam()));
el('position-chart').addEventListener('click',event=>{event.stopPropagation();if(!event.target.closest('[data-home-position]'))return;const period=el('home-position-week').value;openExplorer('positions',null,period==='all'?{}:{week:Number(period)});});
function homeMatchupRoster(team,week){
 if(!team)return '<p class="lab-note">No opponent.</p>';
 const h=team.history.find(h=>Number(h.week)===week),active=week===Number(model.currentWeek||model.liveWeek||currentWeek);
 let rows=(h?.lineup?.length?h.lineup:active?team.currentLineup||[]:[]).map(r=>({...r,p:model.players[r.id]})).filter(r=>r.p);
 if(!rows.length)rows=Object.entries(h?.starters||{}).map(([id,points])=>({id,p:model.players[id],points,starter:true})).filter(r=>r.p);
 return `<div class="matchup-roster-scroll" tabindex="0" aria-label="${esc(teamName(team))} week ${week} roster">${rows.length?rows.map(r=>`<button type="button" class="matchup-roster-player ${r.starter===false?'is-bench':''}" data-matchup-player="${esc(r.id)}"><span>${r.starter===false?'BN':esc(r.p.pos)}</span><b>${esc(r.p.name)}</b><strong>${nfmt(number(r.points)??number(r.p.scores?.[week]),1)}</strong></button>`).join(''):'<p class="lab-note">Roster scores unavailable.</p>'}</div>`;
}
el('matchup-panel').addEventListener('click',event=>{event.stopPropagation();const player=event.target.closest('[data-matchup-player]');if(player)openExplorer('profile',player.dataset.matchupPlayer);});

function updateWeekMenu(team){
  const previous=String(currentWeek);
  const available=[...new Set([...team.history.map(h=>h.week),Number(model.currentWeek||model.liveWeek||0)].filter(w=>Number.isFinite(w)&&w>=1&&w<=18))].sort((a,b)=>a-b);
  if(!available.includes(Number(previous))) currentWeek=available.at(-1) || 1;
  el('week-select').replaceChildren(...available.map(w=>new Option(String(w).padStart(2,'0'),String(w))));
  if(!available.length)el('week-select').add(new Option('—','0'));
  el('week-select').value=String(currentWeek);
}

function drawMatchup(team){
  const current=team.history.find(x=>Number(x.week)===Number(currentWeek))||(Number(team.currentMatchup?.week)===Number(currentWeek)?team.currentMatchup:null);
  if(!current){el('matchup-panel').innerHTML='<div class="empty-chart">NO MATCHUP ON FILE FOR THIS WEEK</div>';el('matchup-comment').textContent='This week is selectable, but ESPN has not supplied the fixture yet.';return;}
  const opponent=findTeam(current.opponentId);
  // Week-in-progress ESPN scores may exist in lineup entries before the league
  // schedule reports a finalized team score. Use official values first, then
  // sum recorded starters when available; never silently turn missing into 0.
  const week=Number(current.week);
  const ownOfficial=number(current.points),otherOfficial=number(current.oppPoints);
  const calculated=typeof weeklyLineupData==='function'?weeklyLineupData(team,week):null;
  const opposite=opponent&&typeof weeklyLineupData==='function'?weeklyLineupData(opponent,week):null;
  const own=calculated?.officialDisplay??ownOfficial??calculated?.computedActual??null;
  const other=opposite?.officialDisplay??otherOfficial??opposite?.computedActual??null;
  const result=own===null?'NOT STARTED':other===null?'NO OPPONENT':own===other?'TIE':own>other?'VICTORY':'DEFEAT';
  const provisional=Number(model.currentWeek||model.liveWeek)===Number(current.week);
  el('matchup-panel').innerHTML=`<div class="matchup-score-strip"><div><b title="${esc(teamName(team))}">${esc(teamName(team))}</b><small>${team.wins}–${team.losses}${team.ties?'–'+team.ties:''}</small><strong>${nfmt(own,1)}</strong></div><span class="matchup-result">${provisional?'LIVE':result}</span><div><b title="${esc(opponent?teamName(opponent):'BYE')}">${esc(opponent?teamName(opponent):'BYE')}</b><small>${opponent?opponent.wins+'–'+opponent.losses+(opponent.ties?'–'+opponent.ties:''):'—'}</small><strong>${nfmt(other,1)}</strong></div></div><div class="matchup-roster-pair">${homeMatchupRoster(team,week)}${homeMatchupRoster(opponent,week)}</div>`;
  el('matchup-comment').textContent='';

}

function rowsFor(team){
  return team.playerIds.map(id=>model.players[id] || {id,name:`PLAYER ${id}`,pos:'?',nfl:'—',status:'—',scores:{}}).map(p=>{
    const observed=Object.entries(p.scores||{}).filter(([w,v])=>model.weeks.includes(Number(w)) && number(v)!==null);
    const total=observed.length?sum(observed.map(([,v])=>v)):null;
    const last=number(p.scores?.[model.weeks.at(-1)]);
    return {...p,total,last,average:observed.length?total/observed.length:null,appearances:observed.length};
  });
}
function drawRoster(team){
  const players=rowsFor(team),sort=el('sort-players').value;
  players.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='position'?a.pos.localeCompare(b.pos)||a.name.localeCompare(b.name):((b[sort==='week'?'last':'total']??-Infinity)-(a[sort==='week'?'last':'total']??-Infinity)));
  const max=Math.max(1,...players.map(x=>x.total??0));
  if(!players.length){el('player-rows').innerHTML='<tr><td colspan="8" class="empty-chart">NO PLAYERS ON THE CURRENT ROSTER</td></tr>';}
  else el('player-rows').innerHTML=players.map(p=>`<tr data-player="${esc(p.id)}" class="${currentPlayerId===p.id?'selected':''}" tabindex="0" role="button" aria-label="Select ${esc(p.name)}; double-click for full dossier"><td><span class="pos-badge">${esc(p.pos)}</span></td><td>${esc(p.name)}</td><td>${esc(p.nfl)}</td><td>${esc(p.status || '—')}</td><td>${nfmt(p.total)}</td><td>${nfmt(p.last)}</td><td>${nfmt(p.average)}</td><td><div class="output-bar"><span style="width:${p.total===null?0:Math.max(0,Math.min(100,p.total/max*100)).toFixed(1)}%"></span></div></td></tr>`).join('');
  drawPlayerDossiers(players);
  el('player-count').textContent=`${String(players.length).padStart(2,'0')} PLAYERS · ${model.weeks.length} SCORING WEEKS`;
  // Click selects the player and updates the compact Player Terminal.
  // Double-click opens the full dossier; delegation survives table redraws.

}
el('player-rows').addEventListener('click',e=>{
  const row=e.target.closest('tr[data-player]');if(!row)return;
  currentPlayerId=row.dataset.player;
  drawRoster(getTeam());drawProfile(getTeam());
  if(e.detail>=2 && typeof openExplorer==='function')openExplorer('profile',currentPlayerId);
  e.stopPropagation();
});
el('player-rows').addEventListener('keydown',e=>{
  const row=e.target.closest('tr[data-player]');if(!row)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();currentPlayerId=row.dataset.player;drawRoster(getTeam());drawProfile(getTeam());e.stopPropagation();}
});
function drawProfile(team){
  const list=rowsFor(team);
  if(!list.some(p=>p.id===currentPlayerId))currentPlayerId=[...list].sort((a,b)=>(b.total??-Infinity)-(a.total??-Infinity))[0]?.id||null;
  const p=list.find(p=>p.id===currentPlayerId);
  el('profile-name').textContent=p?.name||'NO SELECTION';
  el('profile-team').textContent=p?`${p.nfl} / ${p.status}`:'—';
  el('player-pos-top').textContent=p?.pos||'—';
  const upcoming=Number(model.currentWeek||model.liveWeek||(model.source==='demo'?7:currentWeek)||1),projection=number(p?.projections?.[upcoming])??number(p?.espnProj);
  el('profile-total').textContent=nfmt(projection);el('profile-estimate-label').textContent='W'+upcoming+' PROJ';
  el('profile-last').textContent=nfmt(p?.last);
  const recent=Object.entries(p?.scores||{}).filter(([w,v])=>Number(w)<upcoming&&number(v)!==null).sort((a,b)=>Number(a[0])-Number(b[0])).slice(-3).map(([,v])=>v);
  el('profile-average').textContent=nfmt(recent.length?sum(recent)/recent.length:null);
  if(typeof renderStrategyHome==='function')renderStrategyHome();
  if(!p||!model.weeks.length){el('player-spark').innerHTML='<div class="empty-chart">NO PLAYER HISTORY</div>';return;}
  const values=model.weeks.map(w=>number(p.scores?.[w])),max=Math.max(1,...values.map(v=>v??0));
  el('player-spark').classList.toggle('dense-weeks',values.length>12);
  el('player-spark').innerHTML=values.map((v,i)=>`<div class="home-player-week" title="Week ${model.weeks[i]}: ${nfmt(v)}"><span class="home-player-value">${v===null?'—':nfmt(v,1)}</span><button type="button" class="mini-bar ${v===null?'is-blank':''}" data-home-player-week="${model.weeks[i]}" ${v===null?'disabled':''} aria-label="Week ${model.weeks[i]}: ${nfmt(v)}. View starter contributions" style="height:${v===null?'8':Math.max(2,100*v/max)}%"></button><small class="home-point-week">${model.weeks[i]}</small></div>`).join('');
  el('player-caption').textContent='';
}

async function getJSON(path){
  let response;
  try{response=await fetch(`${API}${path}`,{headers:{'Accept':'application/json'}})}
  catch{throw new Error('Network request failed. Check your connection. If opening the HTML file directly, try a local web server (see README). Browser/network CORS policies may apply.')}
  if(!response.ok)throw new Error(`Sleeper request failed (${response.status}) for ${path}.`);
  try{return await response.json()}catch{throw new Error('Sleeper returned invalid JSON.')}
}
async function mapLimited(items,concurrency,fn){
  let next=0;
  const results=new Array(items.length);
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while(next<items.length){const index=next++;results[index]=await fn(items[index],index)}
  }));
  return results;
}
function scoringType(settings){
  const rec=settings?.rec;
  if(rec===1)return 'PPR';if(rec===0.5)return 'HALF PPR';if(rec===0)return 'STANDARD';return 'CUSTOM';
}
function inferPos(id,directory){
  const item=directory?.[id];if(item?.position)return item.position==='DST'?'DEF':item.position;
  if(/^[A-Z]{2,3}$/.test(id))return 'DEF';return '?';
}
function playerFromDirectory(id,directory){
  const entry=directory?.[id]||{};
  const def=/^[A-Z]{2,3}$/.test(id);
  const name=entry.full_name || [entry.first_name,entry.last_name].filter(Boolean).join(' ') || (def?`${id} Defense`:`Player ${id}`);
  const status=(entry.injury_status || entry.status || '—').toUpperCase();
  return {id,name,pos:inferPos(id,directory),nfl:entry.team|| (def?id:'FA'),status,scores:{}};
}
function rosterOwner(roster,users){return users.find(u=>String(u.user_id)===String(roster.owner_id)) || users.find(u=>u.user_id && (roster.co_owners||[]).includes(u.user_id))}
function getMatchupPoints(m){return number(m.custom_points) ?? number(m.points) ?? 0}

async function loadSleeper(leagueId, requestedRoster=null, preferredUserId=null){
  const id=String(leagueId).trim();
  if(!/^\d{6,30}$/.test(id))throw new Error('Enter a valid numeric Sleeper league ID or URL.');
  if(loading)return;
  loading=true;setDialogMessage('LOADING LEAGUE, ROSTERS AND SCORING HISTORY…');setStatus('FETCHING SLEEPER…',true);
  try{
    const [league,rosters,users,nflState]=await Promise.all([
      getJSON(`/league/${id}`),getJSON(`/league/${id}/rosters`),getJSON(`/league/${id}/users`),getJSON('/state/nfl')
    ]);
    if(!league?.league_id||!Array.isArray(rosters)||!rosters.length)throw new Error('This league does not exist or has no rosters.');
    const year=Number(league.season),nowYear=Number(nflState?.season),seasonMatches=String(nflState?.season)===String(year);
    // Get the league's full schedule (including old-season histories). Future zero-score weeks are filtered out.
    const weekCount=Math.max(1,Math.min(18,Number(league.settings?.playoff_week_start||15)+3));
    const weeks=Array.from({length:weekCount},(_,i)=>i+1);
    const [matchups,dir]=await Promise.all([
      mapLimited(weeks,5,async w=>{try{return await getJSON(`/league/${id}/matchups/${w}`)}catch{return []}}),
      (async()=>{try{if(!playerDirectory)playerDirectory=await getJSON('/players/nfl');return playerDirectory}catch{return null}})()
    ]);
    const entries=matchups.map((rows,i)=>({week:weeks[i],rows:Array.isArray(rows)?rows:[]})).filter(e=>e.rows.some(r=>number(r.points)!==null && Math.abs(r.points)>0 || number(r.custom_points)!==null && Math.abs(r.custom_points)>0));
    const playedWeeks=entries.map(e=>e.week);
    const allIds=new Set();
    rosters.forEach(r=>(r.players||[]).forEach(pid=>allIds.add(String(pid))));
    for(const {rows} of entries)for(const m of rows){
      (m.players||[]).forEach(pid=>pid&&allIds.add(String(pid)));
      (m.starters||[]).forEach(pid=>pid&&pid!=='0'&&allIds.add(String(pid)));
      Object.keys(m.players_points||{}).forEach(pid=>allIds.add(String(pid)));
    }
    const players=Object.fromEntries([...allIds].map(pid=>[pid,playerFromDirectory(pid,dir)]));
    // Collect each player's weekly league-scored output across the league, including trades.
    for(const {week,rows} of entries)for(const m of rows){
      for(const [pid,pts] of Object.entries(m.players_points||{}))if(number(pts)!==null && players[pid])players[pid].scores[week]=pts;
      if(Array.isArray(m.starters_points))m.starters?.forEach((pid,i)=>{
        if(players[pid] && players[pid].scores[week]===undefined && number(m.starters_points[i])!==null)players[pid].scores[week]=m.starters_points[i];
      });
    }
    const teams=rosters.map(roster=>{
      const owner=rosterOwner(roster,users),settings=roster.settings||{};
      const history=entries.map(({week,rows})=>{
        const mine=rows.find(m=>String(m.roster_id)===String(roster.roster_id));
        if(!mine)return null;
        const opponent=rows.find(m=>m!==mine && m.matchup_id!=null && mine.matchup_id!=null && String(m.matchup_id)===String(mine.matchup_id));
        const starters=Object.create(null);
        for(const [i,pid] of (mine.starters||[]).entries()){
          const p=mine.players_points?.[pid]??(Array.isArray(mine.starters_points)?mine.starters_points[i]:null);
          if(players[pid] && number(p)!==null)starters[String(pid)]=p;
        }
        return {week,points:getMatchupPoints(mine),oppPoints:opponent?getMatchupPoints(opponent):null,opponentId:opponent?String(opponent.roster_id):null,starters};
      }).filter(Boolean);
      const name=owner?.metadata?.team_name?.trim() || owner?.display_name || owner?.username || `Team ${roster.roster_id}`;
      return {id:String(roster.roster_id),name,owner:owner?.display_name || owner?.username || 'Unknown manager',ownerId:roster.owner_id||null,
        wins:Number(settings.wins)||0,losses:Number(settings.losses)||0,ties:Number(settings.ties)||0,
        playerIds:(roster.players||[]).map(String),history};
    });
    const activeWeek=seasonMatches && Number(nflState?.week)>0?Number(nflState.week):null;
    model={source:'sleeper',leagueId:id,league:league.name||'Sleeper League',season:year,scoring:scoringType(league.scoring_settings),
      weeks:playedWeeks,teams,players,liveWeek:activeWeek&&playedWeeks.includes(activeWeek)?activeWeek:null,
      description:`SLEEPER / LEAGUE ${id} / READ-ONLY DATA`};
    const owned=teams.find(t=>preferredUserId && String(t.ownerId)===String(preferredUserId));
    currentTeamId=teams.find(t=>String(t.id)===String(requestedRoster))?.id || owned?.id || teams[0].id;
    currentPlayerId=null;currentWeek=playedWeeks.at(-1)||1;
    updateUI();setDialogMessage(`CONNECTED · ${teams.length} TEAMS · ${playedWeeks.length} SCORING WEEKS`,'success');
    el('data-dialog').close();
  }catch(error){setStatus(model.source==='demo'?'SAMPLE DATA':model.source==='sleeper'?'SLEEPER CONNECTED':model.source==='espn'?'ESPN CONNECTED':'LOCAL FILE',model.source!=='demo');throw error}
  finally{loading=false}
}

async function discoverUser(username,season){
  if(loading)return;
  const userInput=username.trim();if(!userInput)throw new Error('Enter a Sleeper username.');
  if(!Number.isInteger(season)||season<2017||season>2100)throw new Error('Enter a valid football season.');
  loading=true;setDialogMessage('SEARCHING SLEEPER ACCOUNT…');
  try{
    const user=await getJSON(`/user/${encodeURIComponent(userInput)}`);
    if(!user?.user_id)throw new Error('No Sleeper user found for that username.');
    linkedUserId=String(user.user_id);
    const leagues=await getJSON(`/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${season}`);
    if(!Array.isArray(leagues)||!leagues.length){el('league-results').replaceChildren();throw new Error(`${user.display_name || userInput} has no NFL leagues for ${season}. Try a different season.`)}
    el('league-results').innerHTML=leagues.map(l=>`<div class="league-result"><div><strong>${esc(l.name||'Unnamed League')}</strong><small>${esc(l.total_rosters??'?')} TEAMS / ${esc(l.status||'UNKNOWN').replace(/_/g,' ').toUpperCase()}</small></div><button type="button" data-league-id="${esc(l.league_id)}">OPEN ↗</button></div>`).join('');
    el('league-results').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>connect(button.dataset.leagueId,null,linkedUserId)));
    setDialogMessage(`FOUND ${leagues.length} LEAGUE${leagues.length===1?'':'S'} FOR ${user.display_name || userInput}. CHOOSE OPEN.`,'success');
  }finally{loading=false}
}
function parseLeagueId(value){
  const match=String(value||'').trim().match(/(?:\/league\/)?(\d{6,30})(?:\/|\?|#|$)/);
  return match?match[1]:String(value||'').trim();
}
async function connect(id,roster,owner){
  try{await loadSleeper(parseLeagueId(id),roster,owner)}
  catch(e){setDialogMessage(e.message||'Could not load this league.','error')}
}
function importJSON(d){
  if(!d||!Array.isArray(d.teams)||!d.teams.length||d.teams.length>100)throw new Error('JSON needs a nonempty "teams" array. Download the sample format.');
  const maxWeeks=Math.min(18,Math.max(0,...d.teams.map(t=>Array.isArray(t.weeks)?t.weeks.length:0)));
  if(!maxWeeks)throw new Error('Each team must have a "weeks" array of scored weekly team points.');
  const weeks=Array.from({length:maxWeeks},(_,i)=>i+1);
  const players=Object.create(null);
  const teams=d.teams.map((t,i)=>{
    const id=String(t.id??i+1),members=Array.isArray(t.roster)?t.roster:[];
    const playerIds=members.map((p,j)=>{
      const pid=String(p.id??`${id}-${j}`);
      if(!players[pid])players[pid]={id:pid,name:p.name||`Player ${j+1}`,pos:p.position||p.pos||'?',nfl:p.nflTeam||p.nfl||'—',status:p.status||'—',scores:{}};
      (Array.isArray(p.weeks)?p.weeks:[]).forEach((v,k)=>{if(number(v)!==null)players[pid].scores[k+1]=v});
      return pid;
    });
    return {id,name:String(t.name||`Team ${i+1}`),owner:String(t.owner||'Imported member'),wins:Number(t.wins)||0,losses:Number(t.losses)||0,ties:Number(t.ties)||0,playerIds,
      history:(t.weeks||[]).slice(0,maxWeeks).map((v,index)=>{
        const opponentId=t.opponents?.[index]==null?null:String(t.opponents[index]);
        const starters=Object.create(null);
        members.forEach((p,j)=>{const pid=playerIds[j];if(p.starter!==false && number(p.weeks?.[index])!==null)starters[pid]=p.weeks[index]});
        return {week:index+1,points:number(v)??0,oppPoints:null,opponentId,starters};
      })};
  });
  for(const team of teams)for(const h of team.history){
    const opponent=teams.find(t=>String(t.id)===String(h.opponentId));
    h.oppPoints=opponent?.history.find(x=>x.week===h.week)?.points??null;
  }
  model={source:'json',leagueId:null,league:String(d.league||'Imported League'),season:Number(d.season)||currentYear,
    scoring:String(d.scoring||'CUSTOM'),weeks,teams,players,liveWeek:null,description:'LOCAL JSON IMPORT / NOT SYNCED'};
  currentTeamId=teams[0].id;currentPlayerId=null;currentWeek=maxWeeks;updateUI();
}

const TEMPLATE={
  league:'Neighborhood Fantasy League',season:2026,scoring:'PPR',
  teams:[
    {id:'a',name:'North Side',owner:'Alex',wins:2,losses:1,weeks:[116.4,129.7,105.1],opponents:['b','b','b'],roster:[
      {id:'p1',name:'Example Quarterback',position:'QB',nflTeam:'CHI',status:'ACTIVE',starter:true,weeks:[23.4,27.1,18.0]},
      {id:'p2',name:'Example Receiver',position:'WR',nflTeam:'BUF',status:'ACTIVE',starter:true,weeks:[16.1,21.2,13.9]},
      {id:'p3',name:'Bench Player',position:'RB',nflTeam:'NYJ',status:'ACTIVE',starter:false,weeks:[8.1,10.0,11.5]}]},
    {id:'b',name:'South Side',owner:'Sam',wins:1,losses:2,weeks:[104.9,131.3,101.1],opponents:['a','a','a'],roster:[
      {id:'p4',name:'Example Running Back',position:'RB',nflTeam:'DET',status:'ACTIVE',starter:true,weeks:[19.5,24.1,12.4]}]}
  ]
};
function selectTab(tab){
  for(const btn of document.querySelectorAll('[data-tab]')){const active=btn.dataset.tab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',String(active))}
  el('espn-pane').hidden=tab!=='espn';el('sleeper-pane').hidden=tab!=='sleeper';el('json-pane').hidden=tab!=='json';setDialogMessage('');
}
function openData(){el('data-dialog').showModal();setDialogMessage('');}

el('open-data').addEventListener('click',openData);
el('load-help').addEventListener('click',openData);
el('about-button').addEventListener('click',()=>el('about-dialog').showModal());
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
el('lookup-user-form').addEventListener('submit',async e=>{e.preventDefault();try{await discoverUser(el('username-input').value,Number(el('season-input').value))}catch(error){setDialogMessage(error.message,'error')}});
el('direct-league-form').addEventListener('submit',e=>{e.preventDefault();connect(el('league-id-input').value,null,null)});
el('demo-button').addEventListener('click',()=>{model=makeDemo();currentTeamId='1';currentWeek=6;currentPlayerId=null;linkedUserId=null;try{localStorage.removeItem('gridiron86-last')}catch{}updateUI();el('data-dialog').close()});
el('refresh-button').addEventListener('click',()=>{if(model.source==='sleeper')connect(model.leagueId,currentTeamId,null);else if(model.source==='espn')connectESPN();else if(model.source==='demo')openData();else{openData();selectTab('json');setDialogMessage('Choose your JSON file again to reload it.')}});
el('team-select').addEventListener('change',e=>{currentTeamId=e.target.value;currentPlayerId=null;currentWeek=Number(model.currentWeek||model.liveWeek||model.weeks.at(-1)||1);updateUI()});
el('week-select').addEventListener('change',e=>{currentWeek=Number(e.target.value);drawMatchup(getTeam())});
el('sort-players').addEventListener('change',()=>drawRoster(getTeam()));
el('json-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5000000)throw new Error('File exceeds 5 MB.');const data=JSON.parse(await file.text());importJSON(data);setDialogMessage('FILE IMPORTED','success');el('data-dialog').close()}catch(error){setDialogMessage(`Unable to import: ${error.message}`,'error')}finally{e.target.value=''}});
el('download-template').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(TEMPLATE,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='gridiron86-example.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

el('season-input').value=currentYear;
updateUI();
// Shareable links are ?league=123&roster=4; local users can reopen their last linked league automatically.
let last=null;try{last=JSON.parse(localStorage.getItem('gridiron86-last')||'null')}catch{}
const startupLeague=initialUrlParams.get('league'); // ESPN-first: do not auto-open an old Sleeper league over a saved ESPN session.
if(startupLeague){
  const requested=initialUrlParams.get('roster')||last?.roster;
  connect(startupLeague,requested,null);
}

const espnN = v => v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const POS={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'D/ST'};
const NFL={1:'ATL',2:'BUF',3:'CHI',4:'CIN',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GB',10:'TEN',11:'IND',12:'KC',13:'LV',14:'LAR',15:'MIA',16:'MIN',17:'NE',18:'NO',19:'NYG',20:'NYJ',21:'PHI',22:'ARI',23:'PIT',24:'LAC',25:'SF',26:'SEA',27:'TB',28:'WSH',29:'CAR',30:'JAX',33:'BAL',34:'HOU'};
const espnPlayer = p=>p;
function espnScoring(settings){const items=settings?.scoringSettings?.scoringItems||[];const rec=items.find(x=>Number(x.statId)===53);if(rec){if(Number(rec.points)===1)return 'FULL PPR';if(Number(rec.points)===.5)return 'HALF PPR';if(Number(rec.points)===0)return 'STANDARD'}return 'CUSTOM SCORING'}
function makeEspnPlayer(entry,current){
 const pool=entry?.playerPoolEntry||{},p=pool.player||{},pid=String(entry?.playerId||pool.id||p.id||'');if(!pid)return null;
 const stats=[...(p.stats||[]),...(pool.stats||[])];
 const actualSeason=stats.find(s=>Number(s.statTypeId ?? s.statSourceId)===0&&Number(s.scoringPeriodId)===0&&espnN(s.appliedTotal)!==null);
 const projection=stats.find(s=>(Number(s.statTypeId ?? s.statSourceId)===1||Number(s.statTypeId ?? s.statSourceId)===2)&&Number(s.scoringPeriodId)===Number(current)&&espnN(s.appliedTotal)!==null);
 const availability=p.injuryStatus|| (p.injured?'INJURED':null) || entry?.status || 'ACTIVE';
 return espnPlayer({id:pid,espnId:pid,name:p.fullName||[p.firstName,p.lastName].filter(Boolean).join(' ')||`ESPN PLAYER ${pid}`,pos:POS[p.defaultPositionId]||POS[entry.lineupSlotId]||'?',nfl:NFL[p.proTeamId]||'FA',status:availability,starter:![20,21].includes(Number(entry.lineupSlotId)),scores:{},statlines:{},projections:{},seasonTotal:espnN(actualSeason?.appliedTotal),gamesPlayed:espnN(p.gamesPlayed??p.statistics?.gamesPlayed),espnProj:espnN(projection?.appliedTotal),owned:espnN(p.ownership?.percentOwned??pool.percentOwned),started:espnN(p.ownership?.percentStarted??pool.percentStarted)});
}
function rosterStatsFromEntry(entry,week){const pool=entry?.playerPoolEntry||{},p=pool.player||{};
 const groups=[...(pool.stats||[]),...(p.stats||[])];
 const actual=groups.find(s=>Number(s.statTypeId ?? s.statSourceId)===0&&Number(s.scoringPeriodId)===week&&espnN(s.appliedTotal)!==null);
 const projected=groups.find(s=>(Number(s.statTypeId ?? s.statSourceId)===1||Number(s.statTypeId ?? s.statSourceId)===2)&&Number(s.scoringPeriodId)===week&&espnN(s.appliedTotal)!==null);
 return {actual:espnN(actual?.appliedTotal)??espnN(pool.appliedStatTotal),projected:espnN(projected?.appliedTotal),statline:actual?.stats||actual?.appliedStats||null};
}
function normalizeESPN(input,leagueId,year){const raw=input.base||{},sourceTeams=raw.teams||[],members=raw.members||[],memberMap=Object.fromEntries(members.map(m=>[String(m.id),m]));
 if(!sourceTeams.length)throw Error('ESPN supplied no rostered teams.');
 const current=Number(raw.scoringPeriodId||raw.status?.currentScoringPeriod?.id||input.boxscores?.at(-1)?.week||1);
 const teams=sourceTeams.map(t=>({id:String(t.id),name:String(t.name||[t.location,t.nickname].filter(Boolean).join(' ')||t.abbrev||`Team ${t.id}`),owner:(t.owners||[]).map(o=>{const m=memberMap[String(o)];return m?.displayName||[m?.firstName,m?.lastName].filter(Boolean).join(' ')||'League manager'}).join(' & ')||'League manager',wins:Number(t.record?.overall?.wins||0),losses:Number(t.record?.overall?.losses||0),ties:Number(t.record?.overall?.ties||0),pf:espnN(t.record?.overall?.pointsFor),pa:espnN(t.record?.overall?.pointsAgainst),playerIds:[],currentLineup:[],history:[]}));
 const byId=Object.fromEntries(teams.map(t=>[t.id,t]));const players=Object.create(null);
 for(const original of sourceTeams){const team=byId[String(original.id)];for(const entry of original.roster?.entries||[]){const p=makeEspnPlayer(entry,current);if(!p)continue;players[p.id]=players[p.id]||p;players[p.id].starter=p.starter;team.playerIds.push(p.id);const currentStats=rosterStatsFromEntry(entry,current);team.currentLineup.push({id:p.id,slot:Number(entry.lineupSlotId),starter:p.starter,points:currentStats.actual,projected:currentStats.projected})}}
 // Full-season matchup scoreboard: only count scoring periods through the current NFL week,
 // and avoid recording scheduled future 0-0 matchups as completed games.
 for(const match of raw.schedule||[]){const w=Number(match.matchupPeriodId||0);if(w<1||w>18||w>current)continue;const home=match.home||{},away=match.away||{};const a=byId[String(home.teamId)],b=byId[String(away.teamId)];if(!a&&!b)continue;const hp=espnN(home.totalPoints)||0,ap=espnN(away.totalPoints)||0;
   if(w===current){
     if(a)a.currentMatchup={week:w,opponentId:b?.id||null,points:hp===0&&ap===0?null:hp,oppPoints:b?(hp===0&&ap===0?null:ap):null};
     if(b)b.currentMatchup={week:w,opponentId:a?.id||null,points:hp===0&&ap===0?null:ap,oppPoints:a?(hp===0&&ap===0?null:hp):null};
   }
   if(w>=current&&hp===0&&ap===0)continue;
   const append=(team,points,opp,oppTeam)=>{if(!team)return;const prev=team.history.find(h=>h.week===w);if(prev){prev.points=points;prev.oppPoints=opp}else team.history.push({week:w,points,oppPoints:opp,opponentId:oppTeam?.id||null,starters:{},lineup:[]})};
   append(a,hp,b?ap:null,b);append(b,ap,a?hp:null,a);
 }
 // ESPN mBoxscore returns the actual weekly roster and per-player applied fantasy totals.
 // A week may fail individually; don't manufacture zeros when data are missing.
 for(const {week,data} of input.boxscores||[]){if(!data?.schedule)continue;
 for(const match of data.schedule){if(Number(match.matchupPeriodId)!==Number(week))continue;
 for(const side of [match.home,match.away]){if(!side?.teamId)continue;const team=byId[String(side.teamId)];if(!team)continue;
 const hist=team.history.find(h=>h.week===Number(week));if(!hist)continue;
 const entries=side.rosterForCurrentScoringPeriod?.entries||side.roster?.entries||[];
 for(const entry of entries){const pid=String(entry.playerId||entry.playerPoolEntry?.id||entry.playerPoolEntry?.player?.id||'');if(!pid)continue;
 if(!players[pid]){const p=makeEspnPlayer(entry,current);if(p)players[pid]=p;else continue}
 else{const detail=makeEspnPlayer(entry,current);if(detail){if(players[pid].name.startsWith('ESPN PLAYER'))players[pid].name=detail.name;if(players[pid].pos==='?')players[pid].pos=detail.pos}}
 const scores=rosterStatsFromEntry(entry,Number(week));if(!players[pid].statlines)players[pid].statlines={};if(!players[pid].projections)players[pid].projections={};
 if(scores.actual!==null){players[pid].scores[week]=scores.actual;if(![20,21].includes(Number(entry.lineupSlotId)))hist.starters[pid]=scores.actual}
 if(scores.statline)players[pid].statlines[week]=scores.statline;
 if(scores.projected!==null){players[pid].projections[week]=scores.projected;if(Number(week)===current)players[pid].espnProj=scores.projected;}
 if(!hist.lineup)hist.lineup=[];hist.lineup.push({id:pid,slot:Number(entry.lineupSlotId),points:scores.actual,projected:scores.projected,starter:![20,21].includes(Number(entry.lineupSlotId))});
 }
 }
 }
 }
 // Fallback where ESPN's basic mRoster includes weekly stats, but historical box scores did not.
 for(const original of sourceTeams)for(const entry of original.roster?.entries||[]){const pid=String(entry.playerId||entry.playerPoolEntry?.id||'');const p=players[pid];if(!p)continue;const stats=[...(entry.playerPoolEntry?.player?.stats||[]),...(entry.playerPoolEntry?.stats||[])];for(const s of stats){if(Number(s.statTypeId ?? s.statSourceId)===0&&Number(s.scoringPeriodId)>=1&&Number(s.scoringPeriodId)<=current&&espnN(s.appliedTotal)!==null&&p.scores[s.scoringPeriodId]===undefined)p.scores[s.scoringPeriodId]=Number(s.appliedTotal);if(Number(s.statTypeId ?? s.statSourceId)===0&&Number(s.scoringPeriodId)>=1&&(s.stats||s.appliedStats)){p.statlines??={};p.statlines[s.scoringPeriodId]=s.stats||s.appliedStats}}}
 teams.forEach(t=>t.history.sort((a,b)=>a.week-b.week));
 const missing=(input.unavailableWeeks||[]).length;
 return {source:'espn',league:String(raw.settings?.name||`ESPN LEAGUE ${leagueId}`),season:year,scoring:espnScoring(raw.settings),leagueId:String(leagueId),currentWeek:current,teams,players,description:`ESPN FANTASY · ${year} · ${missing?missing+' BOX SCORE WEEKS UNAVAILABLE · ':''}CURRENT WEEK CAN BE PROVISIONAL`,url:`https://fantasy.espn.com/football/league?leagueId=${encodeURIComponent(leagueId)}`,settings:raw.settings||{}};
}


function importESPN(data,league,season){
 const next=normalizeESPN(data,league,season);
 const players=next.players;
 next.teams=next.teams.map(t=>({...t,players:t.playerIds.map(id=>players[id]).filter(Boolean).map(p=>({...p,team:p.nfl,position:p.pos,weekly:p.scores,total:p.seasonTotal})),roster:t.playerIds.map(id=>players[id]).filter(Boolean)}));
 // Original renderer reads roster via playerIds and model.players; preserve both.
 next.weeks=[...new Set(next.teams.flatMap(t=>t.history.map(h=>h.week)))].sort((a,b)=>a-b);next.liveWeek=next.currentWeek;model=next;currentTeamId=String(data.preferredTeamId||next.teams[0].id);currentPlayerId=null;currentWeek=Number(next.currentWeek)||next.weeks.at(-1)||1;updateUI();el('data-dialog').close();
 if(typeof loadFreeAgentPool==='function')loadFreeAgentPool(true);
}
async function checkESPN(){try{const r=await fetch('/api/espn/session',{credentials:'same-origin'});if(!r.ok)throw Error();const s=await r.json();el('espn-session-state').textContent=s.active?'ESPN SESSION ACTIVE (UP TO 3 HOURS)':'NO PRIVATE SESSION ACTIVE';return s}catch{el('espn-session-state').textContent='ESPN BRIDGE UNAVAILABLE — CHECK DEPLOYMENT';return {active:false}}}
async function connectESPN(){
 const league=el('espn-league').value.trim(),season=Number(el('espn-season').value),swid=el('espn-swid').value.trim(),s2=el('espn-s2').value.trim();
 if(!/^\d{1,18}$/.test(league)){setDialogMessage('Invalid ESPN league ID','error');return}
 const button=el('espn-submit');button.disabled=true;setDialogMessage('Retrieving ESPN league and weekly scores…');
 try{const r=await fetch('/api/espn/league',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({leagueId:league,season,swid,s2})});const data=await r.json();if(!r.ok)throw Error(data.error||'ESPN request failed');importESPN(data,league,season);el('espn-swid').value='';el('espn-s2').value='';await checkESPN()}
 catch(e){setDialogMessage(e.message,'error')}finally{button.disabled=false}
}
el('espn-form').addEventListener('submit',e=>{e.preventDefault();connectESPN()});
el('espn-forget').addEventListener('click',async()=>{await fetch('/api/espn/logout',{method:'POST',credentials:'same-origin'});await checkESPN()});
checkESPN().then(s=>{if(s.active){el('espn-league').value=s.leagueId||'28375786';el('espn-season').value=s.season||2026;connectESPN()}});


function drawPlayerDossiers(players){
 const host=el('player-dossiers');if(!host)return;
 if(!players.length){host.innerHTML='';return;}
 const palette=['#2868b2','#ba424a','#27845e','#7853a7','#bc7428','#16899a'];
 host.innerHTML=players.map((p,i)=>{
  const weeks=model.weeks||[];
  const observed=weeks.map(w=>({week:w,score:number(p.scores?.[w])})).filter(x=>x.score!==null);
  const scores=observed.map(x=>x.score);
  const avg=scores.length?sum(scores)/scores.length:null;
  const high=scores.length?Math.max(...scores):null;
  const low=scores.length?Math.min(...scores):null;
  const last3=scores.length?sum(scores.slice(-3))/Math.min(3,scores.length):null;
  const variance=scores.length>1?sum(scores.map(v=>(v-avg)**2))/scores.length:null;
  const std=variance===null?null:Math.sqrt(variance);
  const color=palette[i%palette.length];
  const metric=(label,value,sub,accent='')=>`<div class="dossier-metric"><span>${label}</span><strong style="${accent?'color:'+accent:''}">${value}</strong><small>${sub}</small></div>`;
  const max=Math.max(1,...scores);
  const bars=weeks.map((w,wi)=>{
    const v=number(p.scores?.[w]),barPx=v===null?3:Math.max(3,(Math.max(0,v)/max)*74);
    const ink=palette[wi%palette.length];
    return `<button type="button" class="dossier-bar-wrap" data-dossier-week="${w}" ${v===null?'disabled':''} aria-label="${esc(p.name)} Week ${w}, ${nfmt(v)} fantasy points. Open Starter Contributions" title="Week ${w}: ${nfmt(v)}" style="--dossier-h:${barPx.toFixed(1)}px"><span class="dossier-point-label">${v===null?'':nfmt(v,1)}</span><div class="dossier-bar" style="height:${barPx.toFixed(1)}px;background:${v===null?'#d8d8d4':ink}"></div><small>W${w}</small></button>`;
  }).join('');
  return `<section class="win dossier-window" id="dossier-${esc(p.id)}" style="--player-accent:${color}"><header class="title-bar"><span class="box-ornament"></span><h2>${esc(p.name)} · ${esc(p.pos)} · ${esc(p.nfl)}</h2><span class="dossier-status">${esc(p.status||'—')}</span><button type="button" class="chrome dossier-expand" title="Expand complete player dossier" aria-label="Expand complete player dossier">▣</button></header>
    <div class="dossier-content">
      <div class="dossier-primary">
        <div class="dossier-metrics">${metric('SEASON POINTS',nfmt(p.total),'OBSERVED TOTAL',color)}${metric('WEEKLY AVG',nfmt(avg),'SCORING WEEKS')}${metric('LATEST WEEK',nfmt(p.last),'MOST RECENT WEEK')}${metric('LAST 3 AVG',nfmt(last3),'RECENT FORM',color)}${metric('BEST / WORST',`${nfmt(high,1)} / ${nfmt(low,1)}`,'RECORDED RANGE')}${metric('CONSISTENCY',nfmt(std,1),'STD. DEVIATION · LOWER = STEADIER')}</div>
        <div class="dossier-featured" aria-label="Player projection and availability"><div><small>ESPN PROJECTION</small><strong>${nfmt(p.espnProj,1)}</strong></div><div><small>AVAILABILITY</small><strong class="${/OUT|INJURED|IR|SUSPENDED/i.test(p.status)?'negative-text':'positive-text'}">${esc(p.status||'NOT REPORTED')}</strong></div></div>
        <div class="dossier-bottom"><div class="window-topline"><span>WEEKLY SCORING / ${scores.length} REPORTED</span><span>${esc(p.pos)} · ${esc(p.nfl)}</span></div><div class="dossier-chart" data-dossier-chart="${esc(String(p.id))}" tabindex="0" role="button" aria-label="Open ${esc(p.name)} position allocation. Select an individual bar for that week's starter contributions">${bars||'<span class="empty-chart">NO HISTORY AVAILABLE</span>'}</div><div class="dossier-chart-hint">BAR → WEEK CONTRIBUTIONS · WHITE SPACE → POSITION ALLOCATION</div></div>
      </div>
      <div class="dossier-news-panel" id="dossier-news-${esc(String(p.id))}" data-dossier-player-id="${esc(String(p.id))}" data-dossier-name="${esc(p.name)}" data-dossier-news="${p.espnId?esc(String(p.espnId)):''}" tabindex="0" role="button" aria-label="Open ${esc(p.name)} Player Terminal"><div class="dossier-context-outlook"><div class="dossier-panel-heading">PERFORMANCE & OUTLOOK</div><div class="dossier-scroll-copy"><p class="player-news-fallback">${p.espnId?'Retrieving verified outlook and recent performance…':'Performance context loads from recorded scores.'}</p></div></div><div class="dossier-context-news"><div class="dossier-panel-heading">RECENT VERIFIED NEWS</div><div class="dossier-scroll-copy"><p class="player-news-fallback">${p.espnId?'Loading articles for this player…':'No verified player news source attached.'}</p></div></div></div>
    </div></section>`;
 }).join('');
 if(typeof prepareDossierNews==='function')prepareDossierNews();
}
