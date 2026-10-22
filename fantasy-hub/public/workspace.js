/* One workspace, two altitudes, one menu bar.
   The Dashboard shows every window at a glance; each report opens inline in the
   same page. Navigation lives in the classic pull-down menu bar at the top of the
   screen (Team / League / Players / Strategy), so it costs no extra height:
   the GRIDIRON/86 mark returns to the dashboard, each menu lists its reports
   with a one-line description and its keyboard shortcut. Expanding a window and
   choosing a report are the same action, so browser Back, deep links (#/matchup)
   and keyboard navigation all follow one model.

   body[data-layout] keeps its historical values for the stylesheet:
   'dashboard' = window grid visible, 'tabbed' = a report is open inline. */
'use strict';
const WORKSPACE_GROUPS=[
  ['Home',[['dashboard','Dashboard','All windows at a glance']]],
  ['Team',[
    ['summary','Overview','Franchise report card'],
    ['matchup','Matchup','This week, head to head'],
    ['roster','Roster','Every player you roster'],
    ['weekly','Weekly','Week-by-week scoring'],
  ]],
  ['League',[
    ['standings','Standings','League table and rankings'],
    ['league-contributions','Trends','Who scores from which positions'],
  ]],
  ['Players',[
    ['profile','Player file','One player in depth'],
    ['player-analytics','Game logs','Every game, every stat'],
    ['agents','Free agents','Who is available to add'],
    ['position-compare','Compare','Players side by side by position'],
  ]],
  ['Strategy',[
    ['positions','Positions','Where your points come from'],
    ['outlook','Outlook','Projected range for a player'],
    ['opportunity','Touches','Usage and opportunity share'],
    ['trade','Trades','Test a trade on both lineups'],
    ['graph','Variable lab','Chart any stat against another'],
  ]],
];
// Flat list of reports (excludes the dashboard), kept for other scripts.
const WORKSPACE_TABS=WORKSPACE_GROUPS.flatMap(([group,items])=>items.filter(([id])=>id!=='dashboard').map(([id,label,hint])=>[id,label,`${group.toUpperCase()} / ${hint.toUpperCase()}`]));
const WORKSPACE_IDS=new Set(WORKSPACE_TABS.map(([id])=>id));
const PLAYER_REPORTS=['profile','player-analytics','outlook','opportunity'];
const workspaceTabs=el('workspace-tabs');
const workspace={view:'dashboard',seq:0,restoring:false,origin:null,dashboardScroll:0};
const groupOf=view=>WORKSPACE_GROUPS.find(([,items])=>items.some(([id])=>id===view))?.[0]||'Home';

workspaceTabs.innerHTML=`<button type="button" class="menu-home" id="workspace-tab-dashboard" data-workspace="dashboard" title="Dashboard: all windows at a glance"><span class="system-glyph" aria-hidden="true">▦</span><b>GRIDIRON/86</b><span class="sr-only">, dashboard</span></button>`+
  WORKSPACE_GROUPS.filter(([group])=>group!=='Home').map(([group,items])=>{
    const slug=group.toLowerCase();
    return `<div class="menu-group" data-group="${group}"><button type="button" class="menu-title" id="menu-title-${slug}" aria-expanded="false" aria-controls="menu-${slug}">${group}<span class="menu-caret" aria-hidden="true">▾</span></button>`+
      `<div class="menu-list" id="menu-${slug}" role="group" aria-labelledby="menu-title-${slug}" hidden>${items.map(([id,label,hint])=>`<button type="button" class="menu-item" id="workspace-tab-${id}" data-workspace="${id}" title="${hint}"><span class="menu-check" aria-hidden="true">✓</span><span class="menu-label"><b>${label}</b><small>${hint}</small></span></button>`).join('')}</div></div>`;
  }).join('');
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
  const group=groupOf(view);
  for(const title of workspaceTabs.querySelectorAll('.menu-title')){
    title.classList?.toggle('is-current',title.closest?.('.menu-group')?.dataset.group===group);
  }
  // The page header says where you are: DASHBOARD, or e.g. STRATEGY / TRADES.
  const crumb=el('team-eyebrow');
  if(crumb)crumb.textContent=view==='dashboard'?'Dashboard':`${group} / ${label}`;
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
  const report=el('explore-dialog');
  const bar=document.querySelector('.menu-bar');
  return Math.max(0,report.getBoundingClientRect().top+window.scrollY-(bar?.offsetHeight||40)-10);
}

/* Called by openExplorer before it renders: switch the page into report view. */
function enterReportView(){
  if(document.body.dataset.layout==='tabbed')return;
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
  markCurrent('dashboard');
  if(!fromHistory)remember('dashboard');
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
  openExplorer(type,player??playerFor(type));
}

document.addEventListener('workspace:opened',event=>{
  const type=event.detail.type;
  markCurrent(type);
  el('explore-content').setAttribute('aria-labelledby','explore-title');
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
});

/* ---------- Pull-down menus (disclosure navigation pattern) ----------
   Works for the report menus and the View menu on the right of the menu bar. */
const menuBar=document.querySelector('.menu-bar');
const menuTitles=()=>[...menuBar.querySelectorAll('.menu-title')].filter(t=>t.offsetParent!==null);
const menuItems=list=>[...list.querySelectorAll('button:not([disabled])')];
let openMenu=null;
function closeMenus({focusTitle=false}={}){
  if(!openMenu)return;
  const title=openMenu;openMenu=null;
  title.setAttribute('aria-expanded','false');
  el(title.getAttribute('aria-controls')).hidden=true;
  if(focusTitle)title.focus();
}
function showMenu(title,{focus=null}={}){
  if(openMenu&&openMenu!==title)closeMenus();
  openMenu=title;
  title.setAttribute('aria-expanded','true');
  const list=el(title.getAttribute('aria-controls'));list.hidden=false;
  // Keep the menu on screen.
  list.style.left='';const r=list.getBoundingClientRect();
  if(r.right>window.innerWidth-6)list.style.left=`${Math.round(window.innerWidth-6-r.right)}px`;
  const items=menuItems(list);
  if(focus==='first')items[0]?.focus();
  else if(focus==='last')items.at(-1)?.focus();
  else if(focus==='current')(list.querySelector('[aria-current="page"]')||items[0])?.focus();
}
menuBar.addEventListener('click',event=>{
  const title=event.target.closest('.menu-title');
  if(title){openMenu===title?closeMenus():showMenu(title);return;}
  const item=event.target.closest('.menu-list button');
  if(item){closeMenus();}
  const report=event.target.closest('[data-workspace]');
  if(report)openReport(report.dataset.workspace,{focus:!report.classList?.contains('menu-home')});
});
// Classic menu bars: once one menu is open, pointing at another opens it.
menuBar.addEventListener('pointerover',event=>{
  const title=event.target.closest('.menu-title');
  if(title&&openMenu&&openMenu!==title&&event.pointerType!=='touch')showMenu(title);
});
document.addEventListener('pointerdown',event=>{if(openMenu&&!event.target.closest('.menu-group'))closeMenus();});
menuBar.addEventListener('focusout',event=>{
  if(openMenu&&!event.relatedTarget?.closest?.('.menu-group'))closeMenus();
});
menuBar.addEventListener('keydown',event=>{
  const title=event.target.closest('.menu-title'),list=event.target.closest('.menu-list');
  const titles=menuTitles();
  const neighbour=(from,delta)=>titles[(titles.indexOf(from)+delta+titles.length)%titles.length];
  if(title){
    if(['ArrowDown','Enter',' '].includes(event.key)){event.preventDefault();showMenu(title,{focus:event.key==='ArrowDown'?'first':'current'});}
    else if(event.key==='ArrowUp'){event.preventDefault();showMenu(title,{focus:'last'});}
    else if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
      event.preventDefault();const next=neighbour(title,event.key==='ArrowRight'?1:-1);
      if(openMenu)showMenu(next);next.focus();
    }else if(event.key==='Escape'&&openMenu){event.preventDefault();event.stopPropagation();closeMenus({focusTitle:true});}
    return;
  }
  if(!list)return;
  const items=menuItems(list),i=items.indexOf(document.activeElement),owner=openMenu;
  if(event.key==='ArrowDown'){event.preventDefault();items[(i+1)%items.length]?.focus();}
  else if(event.key==='ArrowUp'){event.preventDefault();items[(i-1+items.length)%items.length]?.focus();}
  else if(event.key==='Home'){event.preventDefault();items[0]?.focus();}
  else if(event.key==='End'){event.preventDefault();items.at(-1)?.focus();}
  else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenus({focusTitle:true});}
  else if(event.key==='Tab'){closeMenus();}
  else if((event.key==='ArrowRight'||event.key==='ArrowLeft')&&owner){
    event.preventDefault();const next=neighbour(owner,event.key==='ArrowRight'?1:-1);showMenu(next,{focus:'first'});
  }
});
window.addEventListener('resize',()=>closeMenus());
// An open menu owns Escape before any global shortcut (window capture runs first).
window.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!openMenu)return;
  event.preventDefault();event.stopImmediatePropagation();closeMenus({focusTitle:true});
},true);

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
      else openExplorer(target,state?.player??playerFor(target));
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
  markCurrent('dashboard');
  if(WORKSPACE_IDS.has(start)){workspace.quietStart=true;openReport(start);workspace.quietStart=false;}
})();
