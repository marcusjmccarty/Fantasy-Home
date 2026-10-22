/* One report renderer, two ways to explore. No duplicated data or UI state. */
'use strict';
const WORKSPACE_TABS = [
  ['summary','Overview','TEAM / FRANCHISE REPORT'],
  ['matchup','Matchup','TEAM / MATCHUP CENTER'],
  ['roster','Roster','TEAM / PERSONNEL REGISTER'],
  ['weekly','Weekly','TEAM / SCORING HISTORY'],
  ['standings','Standings','LEAGUE / TABLE'],
  ['profile','Player file','PLAYERS / INDIVIDUAL REPORT'],
  ['player-analytics','Game logs','PLAYERS / STATISTICAL ARCHIVE'],
  ['agents','Free agents','PLAYERS / WAIVER WIRE'],
  ['positions','Positions','ANALYSIS / POSITION ALLOCATION'],
  ['position-compare','Player pool','ANALYSIS / POSITION COMPARISON'],
  ['league-contributions','League trends','ANALYSIS / WEEKLY CONTRIBUTIONS'],
  ['outlook','Defensive outlook','STRATEGY / MATCHUP & RANGE'],
  ['opportunity','Touches & share','STRATEGY / TOUCHES & SHARE'],
  ['trade','Trade calculator','STRATEGY / ROSTER IMPACT'],
  ['graph','Variable lab','ANALYSIS / CUSTOM GRAPHER'],
];
const WORKSPACE_STORAGE='gridiron86-workspace-v2';
let workspacePreference={layout:'dashboard',tab:'summary'};
try{
  const saved=JSON.parse(localStorage.getItem(WORKSPACE_STORAGE)||'null');
  if(saved?.layout==='tabbed')workspacePreference.layout='tabbed';
  if(WORKSPACE_TABS.some(([id])=>id===saved?.tab))workspacePreference.tab=saved.tab;
}catch{/* Storage can be unavailable in private browsing. */}
function saveWorkspacePreference(){try{localStorage.setItem(WORKSPACE_STORAGE,JSON.stringify(workspacePreference));}catch{}}
const workspaceTabs=el('workspace-tabs');
workspaceTabs.innerHTML=WORKSPACE_TABS.map(([id,label])=>`<button type="button" role="tab" id="workspace-tab-${id}" data-workspace="${id}" aria-controls="explore-content" aria-selected="false" tabindex="-1">${label}</button>`).join('');
function syncWorkspaceTab(type){
  const report=WORKSPACE_TABS.find(([id])=>id===type);if(!report)return;
  workspacePreference.tab=type;saveWorkspacePreference();
  workspaceTabs.querySelectorAll('[role=tab]').forEach(button=>{
    const selected=button.dataset.workspace===type;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  if(document.body.dataset.layout==='tabbed'){
    el('explore-content').setAttribute('aria-labelledby',`workspace-tab-${type}`);
    const active=el(`workspace-tab-${type}`);
    // Reveal overflowed tabs without moving the page or report scroll position.
    if(active.offsetLeft<workspaceTabs.scrollLeft)workspaceTabs.scrollLeft=active.offsetLeft;
    else if(active.offsetLeft+active.offsetWidth>workspaceTabs.scrollLeft+workspaceTabs.clientWidth)workspaceTabs.scrollLeft=active.offsetLeft+active.offsetWidth-workspaceTabs.clientWidth;
  }
}
function activateWorkspace(type){
  if(type===XL.open)return;
  const player=['profile','player-analytics','outlook','opportunity'].includes(type)?(XL.player||currentPlayerId||rowsFor(getTeam())[0]?.id):null;
  openExplorer(type,player);
}
function setWorkspaceLayout(layout){
  const tabbed=layout==='tabbed',report=el('explore-dialog');
  const previous=XL.open||workspacePreference.tab;
  // close() removes a modal from the top layer before reopening it inline.
  if(report.open)report.close();
  document.body.dataset.layout=tabbed?'tabbed':'dashboard';
  workspacePreference.layout=tabbed?'tabbed':'dashboard';
  el('workspace-navigation').hidden=!tabbed;
  document.querySelector('.window-grid').hidden=tabbed;
  document.querySelector('.dossiers-section').hidden=tabbed;
  document.querySelectorAll('[data-layout]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layout===workspacePreference.layout)));
  if(tabbed){
    report.setAttribute('role','region');report.removeAttribute('aria-modal');
    el('explore-content').setAttribute('role','tabpanel');el('explore-content').tabIndex=0;
    openExplorer(previous,['profile','player-analytics','outlook','opportunity'].includes(previous)?(XL.player||currentPlayerId||rowsFor(getTeam())[0]?.id):null);
  }else{
    report.removeAttribute('role');
    el('explore-content').removeAttribute('role');el('explore-content').removeAttribute('aria-labelledby');el('explore-content').removeAttribute('tabindex');
    XL.open=null;
  }
  saveWorkspacePreference();
}
document.querySelectorAll('[data-layout]').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.layout!==document.body.dataset.layout)setWorkspaceLayout(button.dataset.layout);
}));
workspaceTabs.addEventListener('click',event=>{
  const tab=event.target.closest('[data-workspace]');if(tab)activateWorkspace(tab.dataset.workspace);
});
workspaceTabs.addEventListener('keydown',event=>{
  const tabs=[...workspaceTabs.querySelectorAll('[role=tab]')],index=tabs.indexOf(event.target);
  if(index<0)return;
  let next;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=tabs.length-1;
  if(next===undefined)return;
  event.preventDefault();tabs[next].focus();activateWorkspace(tabs[next].dataset.workspace);
});
document.addEventListener('workspace:opened',event=>syncWorkspaceTab(event.detail.type));
window.addEventListener('resize',()=>{
  if(document.body.dataset.layout==='tabbed'&&XL.open)syncWorkspaceTab(XL.open);
});
el('explore-dialog').addEventListener('cancel',event=>{if(document.body.dataset.layout==='tabbed')event.preventDefault();});
setWorkspaceLayout(workspacePreference.layout);
