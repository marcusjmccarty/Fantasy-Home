/* One workspace, two altitudes.
   The Dashboard shows every window at a glance; each report opens inline in the
   same page, under one persistent report bar. There is no separate "windowed" or
   "tabbed" mode any more: expanding a window and choosing a report are the same
   action, so the browser's Back button, deep links (#/matchup) and keyboard
   navigation all follow one model.

   body[data-layout] keeps its historical values for the stylesheet:
   'dashboard' = window grid visible, 'tabbed' = a report is open inline. */
'use strict';
const WORKSPACE_GROUPS=[
  ['Home',[['dashboard','Dashboard','All windows at a glance']]],
  ['Team',[
    ['summary','Overview','Franchise report'],
    ['matchup','Matchup','Matchup center'],
    ['roster','Roster','Personnel register'],
    ['weekly','Weekly','Scoring history'],
  ]],
  ['League',[
    ['standings','Standings','League table'],
    ['league-contributions','Trends','Weekly position contributions'],
  ]],
  ['Players',[
    ['profile','Player','Individual player report'],
    ['player-analytics','Game logs','Statistical archive'],
    ['agents','Free agents','Waiver wire scouting'],
    ['position-compare','Compare','Compare players by position'],
  ]],
  ['Strategy',[
    ['positions','Positions','Position allocation'],
    ['outlook','Outlook','Player outlook and range'],
    ['opportunity','Touches','Touches and opportunity share'],
    ['trade','Trades','Trade calculator: roster impact of trades'],
    ['graph','Lab','Custom grapher'],
  ]],
];
// Flat list of reports (excludes the dashboard), kept for other scripts.
const WORKSPACE_TABS=WORKSPACE_GROUPS.flatMap(([group,items])=>items.filter(([id])=>id!=='dashboard').map(([id,label,hint])=>[id,label,`${group.toUpperCase()} / ${hint.toUpperCase()}`]));
const WORKSPACE_IDS=new Set(WORKSPACE_TABS.map(([id])=>id));
const PLAYER_REPORTS=['profile','player-analytics','outlook','opportunity'];
const workspaceTabs=el('workspace-tabs');
const workspace={view:'dashboard',seq:0,restoring:false,origin:null,dashboardScroll:0};

workspaceTabs.innerHTML=WORKSPACE_GROUPS.map(([group,items])=>`<div class="report-group" role="group" aria-label="${group}">${group==='Home'?'':`<span class="report-group-label" aria-hidden="true">${group}</span>`}<div class="report-group-items">${items.map(([id,label,hint])=>`<button type="button" id="workspace-tab-${id}" data-workspace="${id}" title="${hint}"${id==='dashboard'?' class="report-home"':''}>${id==='dashboard'?'<span aria-hidden="true" class="report-home-glyph">▦</span>':''}${label}</button>`).join('')}</div></div>`).join('');
const workspaceButtons=()=>[...workspaceTabs.querySelectorAll('[data-workspace]')];

function playerFor(type){
  return PLAYER_REPORTS.includes(type)?(XL.player||currentPlayerId||rowsFor(getTeam())[0]?.id):null;
}
const BASE_TITLE=document.title;
function markCurrent(view){
  workspace.view=view;
  // Each view has its own page title, so tabs, history and screen readers say where you are.
  const label=WORKSPACE_GROUPS.flatMap(([,items])=>items).find(([id])=>id===view)?.[1];
  document.title=view==='dashboard'||!label?BASE_TITLE:`${label} — ${BASE_TITLE}`;
  for(const button of workspaceButtons()){
    const current=button.dataset.workspace===view;
    if(current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  const active=el(`workspace-tab-${view}`);
  // Keep the active item visible when the bar scrolls sideways on small screens.
  if(active&&workspaceTabs.scrollWidth>workspaceTabs.clientWidth){
    const left=active.offsetLeft-workspaceTabs.offsetLeft;
    if(left<workspaceTabs.scrollLeft)workspaceTabs.scrollLeft=left-24;
    else if(left+active.offsetWidth>workspaceTabs.scrollLeft+workspaceTabs.clientWidth)workspaceTabs.scrollLeft=left+active.offsetWidth-workspaceTabs.clientWidth+24;
  }
}
function remember(view,player){
  if(workspace.restoring)return;
  const state={gridiron:true,view,player:player??null,seq:++workspace.seq};
  const url=new URL(location.href);url.hash=view==='dashboard'?'':`/${view}`;
  try{
    // The very first entry replaces the load state so Back leaves the site cleanly.
    if(history.state?.gridiron)history.pushState(state,'',url);else history.replaceState(state,'',url);
  }catch{}
}
function reportTop(){
  // In tab view the team header is hidden, so the report starts right under the title bar.
  return Math.max(0,el('explore-dialog').getBoundingClientRect().top+window.scrollY-8);
}
/* The tab strip lives in exactly one place: the top title bar on the dashboard,
   or the report's own dark bar (between the arrows and Close) in tab view. */
/* If the tabs don't fit beside the logo and controls, they take their own
   row inside the same black title bar instead of scattering across lines. */
const tabsFit=new ResizeObserver(()=>{
  const nav=el('workspace-navigation'),menu=nav.parentElement;
  if(!menu?.classList.contains('menu-bar'))return;
  menu.classList.remove('tabs-own-row');
  const tabs=[...nav.querySelectorAll('[data-workspace]')].filter(t=>t.offsetParent);
  const tops=new Set(tabs.map(t=>Math.round(t.getBoundingClientRect().top)));
  if(tops.size>1||nav.scrollWidth>nav.clientWidth+1)menu.classList.add('tabs-own-row');
});
function placeTabs(){
  const nav=el('workspace-navigation');
  if(document.body.dataset.layout==='tabbed'){
    const bar=document.querySelector('#explore-dialog .explore-title-bar'),actions=bar.querySelector('.explore-top-actions');
    if(nav.parentElement!==bar)bar.insertBefore(nav,actions);
    nav.classList.remove('in-titlebar');
  }else{
    const menu=document.querySelector('.menu-bar'),right=menu.querySelector('.menu-right');
    if(nav.parentElement!==menu)menu.insertBefore(nav,right);
    nav.classList.add('in-titlebar');
  }
}

/* Called by openExplorer before it renders: switch the page into report view. */
function enterReportView(){
  // Tiles open as floating windows (modal); only tabs, shortcuts, history and
  // deep links switch the page into tab view.
  if(document.body.dataset.layout==='tabbed'||!workspace.wantInline)return;
  const active=document.activeElement;
  workspace.origin=active&&active!==document.body?(active.closest('.win')||active):null;
  workspace.dashboardScroll=window.scrollY;
  const report=el('explore-dialog');
  if(report.open&&report.matches(':modal'))report.close();
  document.body.dataset.layout='tabbed';
  document.querySelector('.window-grid').hidden=true;
  document.querySelector('.dossiers-section').hidden=true;
  report.setAttribute('role','region');report.removeAttribute('aria-modal');
  workspace.entering=true;
  placeTabs();
}
function showDashboard({fromHistory=false}={}){
  const report=el('explore-dialog'),wasReport=document.body.dataset.layout==='tabbed';
  workspace.closing=true;
  if(report.open)report.close();
  workspace.closing=false;
  document.body.dataset.layout='dashboard';
  document.querySelector('.window-grid').hidden=false;
  document.querySelector('.dossiers-section').hidden=false;
  report.removeAttribute('role');
  el('explore-content').removeAttribute('aria-labelledby');
  XL.open=null;
  placeTabs();
  markCurrent('dashboard');
  if(!fromHistory&&wasReport)remember('dashboard');
  if(wasReport){
    if(typeof renderGraphHome==='function')renderGraphHome();
    window.scrollTo(0,workspace.dashboardScroll||0);
    const origin=workspace.origin;
    if(origin?.isConnected&&!fromHistory)origin.focus({preventScroll:true});
  }
}
function openReport(type,{player=null,focus=true}={}){
  if(type==='dashboard')return showDashboard();
  if(!WORKSPACE_IDS.has(type))return;
  if(type===XL.open&&document.body.dataset.layout==='tabbed')return;
  workspace.focusReport=focus;
  workspace.wantInline=true;
  try{openExplorer(type,player??playerFor(type));}finally{workspace.wantInline=false;}
}

document.addEventListener('workspace:opened',event=>{
  const type=event.detail.type;
  markCurrent(type);
  el('explore-content').setAttribute('aria-labelledby','explore-title');
  // Floating windows are transient: only tab view gets addresses and history entries.
  if(document.body.dataset.layout!=='tabbed')return;
  remember(type,XL.player);
  const entering=workspace.entering;workspace.entering=false;
  if(!workspace.restoring){
    // Bring the report into view under the sticky report bar.
    const top=reportTop();
    if(entering||window.scrollY>top)window.scrollTo(0,top);
  }
  // Coming from a dashboard window, move focus to the report so screen readers
  // announce it; switching from the report bar leaves focus on the bar.
  if(entering||workspace.focusReport===false){
    const title=el('explore-title');title.tabIndex=-1;
    if(entering&&!workspace.quietStart)title.focus({preventScroll:true});
  }
  workspace.focusReport=true;
});

el('explore-dialog').addEventListener('close',()=>{
  // The close button, or anything else that closes the report, returns to the dashboard.
  if(!workspace.closing&&document.body.dataset.layout==='tabbed')showDashboard();
  else if(!workspace.closing)markCurrent('dashboard');
});

workspaceTabs.addEventListener('click',event=>{
  const button=event.target.closest('[data-workspace]');if(!button)return;
  openReport(button.dataset.workspace,{focus:false});
});
workspaceTabs.addEventListener('keydown',event=>{
  const buttons=workspaceButtons(),index=buttons.indexOf(event.target);
  if(index<0)return;
  let next;
  if(event.key==='ArrowRight')next=(index+1)%buttons.length;
  if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=buttons.length-1;
  if(next===undefined)return;
  event.preventDefault();buttons[next].focus();
});

window.addEventListener('popstate',event=>{
  const state=event.state;
  const target=state?.gridiron?state.view:(location.hash.replace(/^#\/?/,'')||'dashboard');
  workspace.restoring=true;
  try{
    if(target==='dashboard'||!WORKSPACE_IDS.has(target)){showDashboard({fromHistory:true});}
    else{
      const open=el('explore-dialog').open&&document.body.dataset.layout==='tabbed';
      const seq=state?.seq??0;
      if(open&&seq<workspace.seq&&XL.history.length)exploreBack();
      else if(open&&seq>workspace.seq&&XL.future.length)exploreForward();
      else{workspace.wantInline=true;try{openExplorer(target,state?.player??playerFor(target));}finally{workspace.wantInline=false;}}
    }
    if(state?.seq!=null)workspace.seq=state.seq;
  }finally{workspace.restoring=false;}
});

// The report's own back/forward arrows move through browser history, so the
// arrows, the browser buttons and Alt+Left/Right always agree.
for(const [id,step] of [['explore-back',-1],['explore-forward',1]]){
  el(id).addEventListener('click',event=>{
    if(document.body.dataset.layout!=='tabbed')return;
    event.stopImmediatePropagation();history.go(step);
  },true);
}
el('explore-close').setAttribute('aria-label','Close report and return to the dashboard');

// Start where the address says: #/matchup opens the matchup report directly.
(()=>{
  const start=location.hash.replace(/^#\/?/,'');
  try{history.replaceState({gridiron:true,view:'dashboard',player:null,seq:0},'',location.href.replace(/#.*$/,''));}catch{}
  document.body.dataset.layout='dashboard';
  placeTabs();tabsFit.observe(document.querySelector('.menu-bar'));
  markCurrent('dashboard');
  if(WORKSPACE_IDS.has(start)){workspace.quietStart=true;openReport(start);workspace.quietStart=false;}
})();
