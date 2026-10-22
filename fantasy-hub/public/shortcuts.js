/* GRIDIRON/86 keyboard layer.
   One registry (SHORTCUTS) is the single source of truth: the key router reads it
   to decide what a key press does, and the KEYS help dialog is rendered from it,
   so the documentation cannot drift from the behaviour.

   Part 1 is pure (no DOM) and is exercised directly by test/shortcuts.test.js.
   Part 2 wires the registry to the page: command palette, help, go-to sequences,
   Escape layering, list and dashboard-window arrow navigation, skip links and
   polite announcements. Report renderers stay the owners of their own state;
   this file only routes keys to the same public functions the mouse uses. */
'use strict';
const GridironKeys=(()=>{
 // Go-to letters: G then the letter opens that report. Labels mirror the report bar.
 const REPORT_KEYS=[
  ['d','dashboard','Dashboard'],['o','summary','Overview'],['m','matchup','Matchup'],['r','roster','Roster'],
  ['w','weekly','Weekly'],['s','standings','Standings'],['t','league-contributions','Trends'],
  ['p','profile','Player file'],['l','player-analytics','Game logs'],['f','agents','Free agents'],
  ['c','position-compare','Compare'],['a','positions','Positions'],['u','outlook','Outlook'],
  ['h','opportunity','Touches'],['x','trade','Trades'],['v','graph','Variable lab'],
 ];
 const GROUPS=['Navigate','Reports','Team & week','Lists & tables','View','Help'];
 /* Each entry: id (command), group, keys (display: alternatives, chords separated by
    spaces, keys inside a chord by '+'), label. Routing fields:
      combo  - a modified chord that always works (Ctrl/Cmd+K)
      key    - a single printable key; obeys the "single-key shortcuts" switch
      seq    - a two-key sequence starting with G; obeys the switch
      always - not affected by the switch (Escape, arrows: WCAG 2.1.4 exempt)
      doc    - performed by the focused control itself; listed for completeness */
 const SHORTCUTS=[
  {id:'palette',group:'Navigate',combo:'mod+k',always:true,keys:['Mod+K'],label:'Command palette: jump to any report, team, week, player or action'},
  {id:'palette',group:'Navigate',key:':',keys:[':'],label:'Command palette (single key)'},
  {id:'goto-help',group:'Navigate',doc:true,keys:['G'],label:'Go to… then press a report letter (see Reports). A hint appears while waiting'},
  {id:'prev-report',group:'Navigate',key:'[',keys:['['],label:'Previous report in the report bar'},
  {id:'next-report',group:'Navigate',key:']',keys:[']'],label:'Next report in the report bar'},
  {id:'escape',group:'Navigate',always:true,keys:['Esc'],label:'Close the top card, menu or dialog; step out of a control; then leave the report for the dashboard'},
  {id:'history',group:'Navigate',doc:true,always:true,keys:['Alt+←','Alt+→'],label:'Back / forward through visited reports (browser history; ⌘[ and ⌘] on Mac)'},
  {id:'bar',group:'Navigate',doc:true,always:true,keys:['←','→','Home','End'],label:'Move along the report bar when it has focus; Enter opens'},
  {id:'tab',group:'Navigate',doc:true,always:true,keys:['Tab','Shift+Tab'],label:'Move between controls. The first Tab on the page reveals Skip links'},
  ...REPORT_KEYS.map(([letter,report,label])=>({id:'goto',arg:report,group:'Reports',seq:['g',letter],keys:[`G ${letter.toUpperCase()}`],label})),
  {id:'prev-week',group:'Team & week',key:',',keys:[','],label:'Previous week'},
  {id:'next-week',group:'Team & week',key:'.',keys:['.'],label:'Next week'},
  {id:'prev-team',group:'Team & week',key:'<',keys:['<'],label:'Previous franchise'},
  {id:'next-team',group:'Team & week',key:'>',keys:['>'],label:'Next franchise'},
  {id:'team',group:'Team & week',key:'t',keys:['T'],label:'Choose a franchise (palette, type to filter)'},
  {id:'player',group:'Team & week',key:'p',keys:['P'],label:'Find a player and open their file'},
  {id:'list',group:'Lists & tables',doc:true,always:true,keys:['↑','↓'],label:'Previous / next row in a table or list'},
  {id:'list-next',group:'Lists & tables',key:'j',keys:['J'],label:'Next row (when a row has focus)'},
  {id:'list-prev',group:'Lists & tables',key:'k',keys:['K'],label:'Previous row (when a row has focus)'},
  {id:'list-ends',group:'Lists & tables',doc:true,always:true,keys:['Home','End'],label:'First / last row'},
  {id:'list-open',group:'Lists & tables',doc:true,always:true,keys:['Enter','Space'],label:'Open or select the focused row, window or button'},
  {id:'windows',group:'Lists & tables',doc:true,always:true,keys:['←','↑','→','↓'],label:'Dashboard: move between windows by position'},
  {id:'window-out',group:'Lists & tables',doc:true,always:true,keys:['Esc'],label:'Dashboard: from a control inside a window, return to the window'},
  {id:'window-move',group:'Lists & tables',doc:true,always:true,keys:['Space','←','→','↑','↓'],label:'Dashboard: on a window’s move handle (the square in its title bar), Space picks it up, arrows move it, Space drops it, Esc cancels. You can also drag windows by their title bars.'},
  {id:'width',group:'View',key:'w',keys:['W'],label:'Page width panel (arrows 1%, Page Up/Down 10%, Esc closes)'},
  {id:'narrower',group:'View',key:'-',keys:['-'],label:'Narrower page (5%)'},
  {id:'wider',group:'View',key:'=',keys:['='],label:'Wider page (5%)'},
  {id:'help',group:'Help',key:'?',keys:['?'],label:'Show this list of shortcuts'},
  {id:'search',group:'Help',key:'/',keys:['/'],label:'Search in the current view (free agents, variable lab, touches…), else the palette'},
 ];
 const SINGLE=new Map(SHORTCUTS.filter(s=>s.key).map(s=>[s.key,s]));
 const SEQUENCE=new Map(SHORTCUTS.filter(s=>s.seq).map(s=>[s.seq[1],s]));
 const MODIFIER_ONLY=new Set(['Shift','Control','Alt','Meta','AltGraph','CapsLock','OS','Fn','Hyper','Super']);

 // Caps Lock without Shift still means the lower-case shortcut.
 function keyOf(event){
  const key=String(event.key??'');
  return key.length===1&&!event.shiftKey&&key>='A'&&key<='Z'?key.toLowerCase():key;
 }
 /* Decide what a keydown means. ctx: {enabled, editing, pending, modal}
    modal is 'palette' | 'help' | 'other' | null. Returns {id,arg} | {pending} | null. */
 function route(event,ctx={}){
  if(event.isComposing||event.keyCode===229)return null;
  const key=keyOf(event);
  if(MODIFIER_ONLY.has(key))return null;
  const mod=event.ctrlKey||event.metaKey;
  if(mod&&!event.altKey&&!event.shiftKey&&key.toLowerCase()==='k'){
   return ctx.modal&&ctx.modal!=='palette'&&ctx.modal!=='help'?null:{id:'palette'};
  }
  // Leave every other Ctrl/Alt/Cmd chord to the browser and the OS (Alt+←, Cmd+L, AltGr text).
  if(mod||event.altKey||event.getModifierState?.('AltGraph'))return null;
  if(key==='Escape')return {id:'escape'};
  if(ctx.editing)return null;
  if(ctx.modal)return ctx.modal==='help'&&key==='?'&&ctx.enabled?{id:'help'}:null;
  if(!ctx.enabled)return null;
  if(ctx.pending==='g'){const hit=SEQUENCE.get(key);return hit?{id:hit.id,arg:hit.arg}:{id:'cancel-pending'};}
  if(key==='g')return {pending:'g'};
  const hit=SINGLE.get(key);
  return hit?{id:hit.id,arg:hit.arg}:null;
 }

 /* Fuzzy match used by the palette and the help filter. 0 = no match; higher is better.
    Exact prefix > word-start substring > substring > all words > ordered subsequence. */
 function fuzzyScore(query,text,{subsequence=true}={}){
  const q=String(query??'').toLowerCase().trim().replace(/\s+/g,' '),t=String(text??'').toLowerCase();
  if(!q)return 1;if(!t)return 0;
  const boundary=i=>i===0||/[\s\-\/(&·.,'’]/.test(t[i-1]);
  const at=t.indexOf(q);
  if(at===0)return 1000-Math.min(t.length,200)*.5;
  if(at>0)return (boundary(at)?850:600)-at-Math.min(t.length,200)*.1;
  const words=q.split(' ');
  if(words.length>1&&words.every(w=>t.includes(w)))return 500-words.reduce((n,w)=>n+t.indexOf(w),0)*.2;
  if(!subsequence)return 0;
  let from=0,prev=-2,score=0,first=-1;
  for(const ch of q.replace(/ /g,'')){
   const i=t.indexOf(ch,from);if(i<0)return 0;
   if(first<0)first=i;
   score+=i===prev+1?6:boundary(i)?5:1;prev=i;from=i+1;
  }
  return Math.min(400,100+score*4-first-t.length*.05);
 }

 /* Spatial navigation between rectangles ({left,top,right,bottom}).
    dir: 'left'|'right'|'up'|'down'. Returns the index of the best candidate or -1.
    Edge gap counts most; misalignment across the axis is penalised. */
 function pickInDirection(from,rects,dir){
  const cx=r=>(r.left+r.right)/2,cy=r=>(r.top+r.bottom)/2;
  const gapAcross=(a0,a1,b0,b1)=>Math.max(0,Math.max(a0,b0)-Math.min(a1,b1));
  let best=-1,bestScore=Infinity;
  rects.forEach((r,i)=>{
   if(r===from)return;
   let ahead,primary,across;
   if(dir==='right'){ahead=cx(r)>cx(from)+1&&r.right>from.right;primary=Math.max(0,r.left-from.right);across=gapAcross(from.top,from.bottom,r.top,r.bottom);}
   else if(dir==='left'){ahead=cx(r)<cx(from)-1&&r.left<from.left;primary=Math.max(0,from.left-r.right);across=gapAcross(from.top,from.bottom,r.top,r.bottom);}
   else if(dir==='down'){ahead=cy(r)>cy(from)+1&&r.bottom>from.bottom;primary=Math.max(0,r.top-from.bottom);across=gapAcross(from.left,from.right,r.left,r.right);}
   else {ahead=cy(r)<cy(from)-1&&r.top<from.top;primary=Math.max(0,from.top-r.bottom);across=gapAcross(from.left,from.right,r.left,r.right);}
   if(!ahead)return;
   const centre=dir==='left'||dir==='right'?Math.abs(cy(r)-cy(from)):Math.abs(cx(r)-cx(from));
   const score=primary+across*3+centre*.05;
   if(score<bestScore){bestScore=score;best=i;}
  });
  return best;
 }
 // Row movement inside a list; clamps instead of wrapping so the ends are discoverable.
 function nextIndex(index,count,key){
  if(!count)return -1;
  if(key==='Home')return 0;
  if(key==='End')return count-1;
  const step=key==='ArrowDown'||key==='j'?1:key==='ArrowUp'||key==='k'?-1:key==='PageDown'?10:key==='PageUp'?-10:0;
  if(!step)return -1;
  return Math.max(0,Math.min(count-1,(index<0?(step>0?-1:count):index)+step));
 }
 // Display helpers shared by the help dialog, tooltips and palette hints.
 function chordText(chord,mac=false){
  return chord.split('+').map(k=>k==='Mod'?(mac?'⌘':'Ctrl'):k).join(mac&&chord.startsWith('Mod+')?'':'+');
 }
 function keysText(entry,mac=false){return entry.keys.map(alt=>alt.split(' ').map(c=>chordText(c,mac)).join(' then ')).join(' or ');}
 function goKeys(report){const hit=REPORT_KEYS.find(([,id])=>id===report);return hit?`G then ${hit[0].toUpperCase()}`:'';}
 function helpModel(filter='',mac=false){
  const q=String(filter).trim();
  return GROUPS.map(group=>({group,items:SHORTCUTS.filter(s=>s.group===group&&(!q||fuzzyScore(q,`${s.label} ${keysText(s,mac)} ${group}`)>0))})).filter(g=>g.items.length);
 }
 return {REPORT_KEYS,GROUPS,SHORTCUTS,route,keyOf,fuzzyScore,pickInDirection,nextIndex,chordText,keysText,goKeys,helpModel};
})();
if(typeof globalThis!=='undefined')globalThis.GridironKeys=GridironKeys;

/* ---------------------------------------------------------------- page wiring */
(()=>{
 if(typeof document==='undefined'||!document.getElementById?.('shortcuts-dialog'))return;
 const K=GridironKeys,$=id=>document.getElementById(id);
 const mac=/Mac|iPhone|iPad|iPod/.test(navigator.platform||navigator.userAgent||'');
 const help=$('shortcuts-dialog'),enabled=$('shortcuts-enabled'),report=$('explore-dialog'),bar=$('workspace-tabs');
 const helpButtons=()=>[...document.querySelectorAll('[data-shortcuts-help]')];
 const announce=(text)=>window.gridironAnnounce?.(text);
 const isReport=()=>document.body.dataset.layout==='tabbed'&&report.open;
 const visible=node=>!!node&&node.isConnected&&!node.disabled&&node.getClientRects().length>0&&!node.closest('[hidden],[inert]')&&getComputedStyle(node).visibility!=='hidden';
 const TEXT_INPUT=/^(text|search|email|number|password|tel|url|date|datetime-local|month|week|time)$/;
 function editing(target){
  if(!(target instanceof Element))return false;
  if(target.matches('input'))return TEXT_INPUT.test(target.type||'text');
  return !!target.closest('textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="searchbox"]');
 }
 const reportLabel=id=>K.REPORT_KEYS.find(([,r])=>r===id)?.[2]||id;

 /* ---------- preference: single-key shortcuts on/off (WCAG 2.1.4) ---------- */
 const preferenceKey='gridiron86-keyboard-shortcuts-v1';
 try{enabled.checked=localStorage.getItem(preferenceKey)!=='off';}catch{}
 function syncHints(){
  const on=enabled.checked;
  for(const button of helpButtons()){
   button.textContent=button.closest('.menu-bar')?'?':(on?'KEYS ?':'KEYS');button.classList.toggle('keys-icon',!!button.closest('.menu-bar'));
   button.title=on?'Keyboard shortcuts (?)':'Keyboard shortcuts (single-key shortcuts are off)';
   button.setAttribute('aria-label',on?'Keyboard shortcuts':'Keyboard shortcuts, single-key shortcuts off');
   button.setAttribute('aria-controls',help.id);
   if(on)button.setAttribute('aria-keyshortcuts','?');else button.removeAttribute('aria-keyshortcuts');
  }
  const width=$('page-width');
  if(width){width.title=on?'Drag to set page width (W)':'Drag to set page width';if(on)width.setAttribute('aria-keyshortcuts','W');else width.removeAttribute('aria-keyshortcuts');}
  for(const button of bar.querySelectorAll('[data-workspace]')){
   const base=button.dataset.baseTitle??=button.title||'';
   const go=K.goKeys(button.dataset.workspace);
   button.title=on&&go?`${base} (${go})`:base;
   button.dataset.go=go.replace('G then ','G');
   if(on&&go)button.setAttribute('aria-keyshortcuts',go.replace(' then ',' '));else button.removeAttribute('aria-keyshortcuts');
  }
  document.body.classList.toggle('single-keys-off',!on);
  if(help.open)renderHelp();
 }
 enabled.addEventListener('change',()=>{
  syncHints();
  try{localStorage.setItem(preferenceKey,enabled.checked?'on':'off');}catch{}
  announce(enabled.checked?'Single-key shortcuts on':'Single-key shortcuts off. Ctrl+K, Escape and arrow keys still work');
 });

 /* ---------- skip links (first Tab stop on the page) ---------- */
 const skip=document.createElement('nav');
 skip.className='skip-links';skip.setAttribute('aria-label','Skip links');
 skip.innerHTML='<a href="#workspace-navigation" class="skip-link" data-skip="bar">Skip to report bar</a><a href="#explore-content" class="skip-link" data-skip="content">Skip to content</a>';
 document.body.prepend(skip);
 skip.addEventListener('click',event=>{
  const link=event.target.closest('[data-skip]');if(!link)return;
  event.preventDefault();
  if(link.dataset.skip==='bar')(bar.querySelector('[aria-current="page"]')||bar.querySelector('[data-workspace]'))?.focus();
  else focusContent();
 });
 function focusContent(){
  if(isReport()){const title=$('explore-title');title.tabIndex=-1;title.focus();return;}
  const first=[...document.querySelectorAll('.window-grid .win .chrome')].find(visible);first?.focus();
 }

 /* ---------- palette launcher in the menu bar ---------- */
 const keysButton=document.querySelector('.menu-right [data-shortcuts-help]');
 const launcher=document.createElement('button');
 launcher.type='button';launcher.id='palette-button';launcher.className='menu-action palette-launch';
 launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-keyshortcuts','Control+K Meta+K');
 launcher.title=`Command palette (${mac?'⌘K':'Ctrl+K'})`;
 launcher.innerHTML=`<span class="palette-launch-label">FIND</span> <kbd>${mac?'⌘K':'CTRL K'}</kbd>`;
 launcher.setAttribute('aria-label','Command palette');
 keysButton?.before(launcher);
 launcher.addEventListener('click',()=>openPalette());

 /* ---------- "G…" pending chip ---------- */
 const chip=document.createElement('div');
 chip.className='key-chip';chip.hidden=true;chip.setAttribute('aria-hidden','true');
 chip.innerHTML=`<b><kbd>G</kbd> GO TO…</b><span>${K.REPORT_KEYS.map(([k,,label])=>`<kbd>${k.toUpperCase()}</kbd> ${label}`).join('<i> · </i>')}</span>`;
 document.body.append(chip);
 let pending=null,pendingTimer=0;
 function setPending(value){
  pending=value;clearTimeout(pendingTimer);chip.hidden=!value;
  if(value){announce('Go to. Press a report letter.');pendingTimer=setTimeout(()=>setPending(null),2500);}
 }

 /* ---------- navigation commands ---------- */
 function settleFocus(){
  const active=document.activeElement;
  if(bar.contains(active))return;
  if(isReport()){
   if(active&&active!==document.body&&report.contains(active)&&visible(active)&&!$('explore-content').contains(active))return;
   const title=$('explore-title');title.tabIndex=-1;title.focus({preventScroll:true});
  }
 }
 function goTo(id){
  if(id==='dashboard')return toDashboard();
  if(isReport()&&XL.open===id){settleFocus();announce(`${reportLabel(id)} report`);return true;}
  openReport(id);
  settleFocus();
  return true;
 }
 function toDashboard(){
  const from=isReport()?XL.open:null;
  if(!from){focusContent();return true;}
  showDashboard();
  const active=document.activeElement;
  if(!active||active===document.body||!visible(active)){
   const win=document.querySelector(`.window-grid .win[data-explore="${CSS.escape(from)}"] .chrome`);
   (visible(win)?win:bar.querySelector('[data-workspace="dashboard"]'))?.focus({preventScroll:false});
  }
  return true;
 }
 function stepReport(delta){
  const ids=[...bar.querySelectorAll('[data-workspace]')].map(b=>b.dataset.workspace);
  const current=ids.indexOf(isReport()?XL.open:'dashboard');
  const next=current+delta;
  if(next<0||next>=ids.length){announce(delta<0?'Already at the first report':'Already at the last report');return true;}
  return goTo(ids[next]);
 }
 /* Change a select the way the user would, without letting change handlers that
    re-focus "the control that changed" pull keyboard focus away from where it was. */
 function commitSelect(select,value){
  const before=document.activeElement;
  select.value=String(value);
  select.dispatchEvent(new Event('change',{bubbles:true}));
  if(before&&before!==select&&before!==document.body&&before.isConnected&&visible(before))before.focus({preventScroll:true});
  else if(document.activeElement===select&&before!==select){if(isReport())settleFocus();else select.blur();}
 }
 function stepWeek(delta){
  const select=$('header-current-week');if(!select||!select.options.length)return false;
  const next=select.selectedIndex+delta;
  if(next<0||next>=select.options.length){announce(`Week ${select.value} is the ${delta<0?'first':'last'} available week`);return true;}
  commitSelect(select,select.options[next].value);
  return true;
 }
 function teamSelect(){const inReport=isReport()&&$('explore-team-switch');return inReport||$('team-select');}
 function switchTeam(id){
  const select=teamSelect();if(!select)return false;
  if(select.value===String(id)){announce(`${select.selectedOptions[0]?.text||'Team'} is already selected`);return true;}
  commitSelect(select,id);
  return true;
 }
 function stepTeam(delta){
  const select=teamSelect();if(!select||!select.options.length)return false;
  const n=select.options.length,next=(select.selectedIndex+delta+n)%n;
  return switchTeam(select.options[next].value);
 }
 function focusSearch(){
  const scope=isReport()?$('explore-content'):document.querySelector('.window-grid');
  const field=[...scope.querySelectorAll('input[type="search"],input[id$="-search"],input[id*="search"]')].find(visible);
  if(!field)return openPalette();
  field.focus();field.select?.();return true;
 }
 function toggleWidth(){
  const slider=$('page-width'),api=window.gridironPageWidth;
  if(!api||!visible(slider)){announce('Page width is fixed at this screen size');return true;}
  api.open();announce(`Page width ${api.value} percent. Use arrow keys to adjust`);
  return true;
 }
 function widthStep(delta){
  const api=window.gridironPageWidth,toggle=$('page-width');
  if(!api||!visible(toggle)){announce('Page width is fixed at this screen size');return true;}
  api.step(delta);announce(`Page width ${api.value} percent`);return true;
 }
 function toggleHelp(){if(help.open)help.close();else openHelp();return true;}

 /* ---------- list and table rows ---------- */
 const LISTS=[
  ['.row-link','tbody,table'],
  ['[data-fa-preview-player]','#fa-summary,.fa-teaser'],
  ['.trade-player','.trade-player-list'],
  ['.trade-player-list input[type="checkbox"]','.trade-player-list'],
  ['.home-trade-builder input[type="checkbox"]','.home-trade-builder'],
  ['tr[tabindex="0"]','tbody'],
 ];
 function listFor(target){
  if(!(target instanceof Element))return null;
  for(const [item,scope] of LISTS){
   if(!target.matches(item))continue;
   const host=target.closest(scope);if(!host)continue;
   return [...host.querySelectorAll(item)].filter(visible);
  }
  return null;
 }
 function moveInList(target,key){
  const items=listFor(target);if(!items)return false;
  const next=K.nextIndex(items.indexOf(target),items.length,key);
  if(next<0)return false;
  items[next].focus();items[next].scrollIntoView({block:'nearest'});
  return true;
 }

 /* ---------- dashboard windows: spatial arrows ---------- */
 const windowButtons=()=>[...document.querySelectorAll('.window-grid .win > .title-bar .chrome,.dossiers-section .win > .title-bar .chrome')].filter(visible);
 function moveBetweenWindows(target,key){
  const buttons=windowButtons(),index=buttons.indexOf(target);if(index<0)return false;
  let next=-1;
  if(key==='Home')next=0;else if(key==='End')next=buttons.length-1;
  else{
   const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[key];if(!dir)return false;
   const rects=buttons.map(b=>b.closest('.win').getBoundingClientRect());
   next=K.pickInDirection(rects[index],rects,dir);
  }
  if(next<0)return true; // edge of the grid: keep focus, still swallow the scroll
  const win=buttons[next].closest('.win');
  buttons[next].focus({preventScroll:true});
  win.scrollIntoView({block:'nearest',inline:'nearest'});
  return true;
 }

 /* ---------- Escape layering ---------- */
 const modal=()=>[...document.querySelectorAll('dialog')].filter(d=>d.open&&d.matches(':modal')).at(-1)||null;
 function dismissRanking(){
  for(const [id,selector] of [['player-ranking-host','.player-rank-trigger'],['summary-ranking-host','.summary-rank-trigger'],['position-ranking-host','.position-rank-trigger']]){
   const host=$(id);if(!visible(host))continue;
   const trigger=report.querySelector(`${selector}[aria-expanded="true"]`);
   if(typeof dismissRankHost==='function')dismissRankHost(host,selector);else host.hidden=true;
   if(visible(trigger))trigger.focus({preventScroll:true});
   return true;
  }
  return false;
 }
 function escape(event){
  const target=event.target instanceof Element?event.target:document.activeElement;
  if(modal())return false; // native dialogs own Escape and restore focus themselves
  if(pending){setPending(null);return true;}
  if(dismissRanking())return true;
  const picker=report.querySelector('[data-lineup-picker][aria-expanded="true"]');
  if(picker&&visible(picker)){const key=picker.dataset.lineupPicker;picker.click();report.querySelector(`[data-lineup-picker="${CSS.escape(key)}"]`)?.focus();return true;}
  const details=target?.closest?.('details[open]');
  if(details&&!details.closest('.window-grid')){details.open=false;details.querySelector('summary')?.focus();return true;}
  // A search field with text keeps Escape: the browser clears it natively.
  if(target?.matches?.('input[type="search"]')&&target.value)return false;
  const win=target?.closest?.('.window-grid .win, .dossiers-section .win');
  if(win&&!isReport()){
   const chrome=win.querySelector(':scope > .title-bar .chrome');
   if(chrome&&target!==chrome){chrome.focus();return true;}
   return false;
  }
  if(isReport()){
   if(editing(target)&&report.contains(target)){const title=$('explore-title');title.tabIndex=-1;title.focus();announce('Left the field. Press Escape again for the dashboard');return true;}
   return toDashboard();
  }
  return false;
 }

 /* ---------- command dispatch ---------- */
 const COMMANDS={
  palette:()=>palette.open?(closePalette(),true):openPalette(),
  help:toggleHelp,
  search:focusSearch,
  'prev-report':()=>stepReport(-1),'next-report':()=>stepReport(1),
  goto:id=>goTo(id),
  'prev-week':()=>stepWeek(-1),'next-week':()=>stepWeek(1),
  'prev-team':()=>stepTeam(-1),'next-team':()=>stepTeam(1),
  team:()=>openPalette('teams'),player:()=>openPalette('players'),
  width:toggleWidth,narrower:()=>widthStep(-5),wider:()=>widthStep(5),
  'list-next':()=>moveInList(document.activeElement,'j'),'list-prev':()=>moveInList(document.activeElement,'k'),
 };
 const modalName=()=>palette.open?'palette':help.open?'help':modal()?'other':null;
 // Capture phase, after the metric-card handler in interactions.js, so a key that
 // a popover consumed never also navigates.
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented)return;
  if(event.repeat&&event.key==='Escape'){if(modal())event.preventDefault();return;}
  const result=K.route(event,{enabled:enabled.checked,editing:editing(event.target),pending,modal:modalName()});
  if(!result){return;}
  if(result.pending){event.preventDefault();setPending(result.pending);return;}
  if(result.id==='cancel-pending'){setPending(null);event.preventDefault();return;}
  if(pending&&result.id!=='escape')setPending(null);
  let handled=false;
  if(result.id==='escape')handled=escape(event);
  else if(event.repeat&&!['list-next','list-prev','prev-week','next-week','narrower','wider'].includes(result.id))handled=true;
  else handled=!!COMMANDS[result.id]?.(result.arg);
  if(handled){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 // Bubble phase: component handlers (rows, charts, report bar) run first.
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
  const target=event.target;if(!(target instanceof Element))return;
  if(modalName()==='palette'||event.shiftKey)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)&&target.matches('.win > .title-bar .chrome')){
   if(moveBetweenWindows(target,event.key))event.preventDefault();return;
  }
  if(['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)&&!editing(target)){
   if(moveInList(target,event.key))event.preventDefault();
  }
 });

 /* ---------- announcements for view, team and week changes ---------- */
 // When focus lands on the report title the screen reader already reads it; the
 // live region covers the cases where focus stays put (report bar, palette, keys).
 document.addEventListener('workspace:opened',event=>{
  const type=event.detail?.type;
  requestAnimationFrame(()=>{if(document.activeElement!==$('explore-title'))announce(`${reportLabel(type)} report opened`);});
 });
 new MutationObserver(()=>{if(document.body.dataset.layout==='dashboard')announce('Dashboard');}).observe(document.body,{attributes:true,attributeFilter:['data-layout']});
 document.addEventListener('change',event=>{
  const t=event.target;if(!(t instanceof HTMLSelectElement))return;
  if(t.id==='team-select'||t.id==='explore-team-switch'||t.id==='roster-team-switch')queueMicrotask(()=>announce(`Team: ${t.selectedOptions[0]?.text||''}`));
  if(t.id==='header-current-week'||t.id==='week-select')queueMicrotask(()=>announce(`Week ${t.value}`));
 });
 let filterTimer=0;
 function announceFreeAgents(){
  clearTimeout(filterTimer);
  filterTimer=setTimeout(()=>{
   if(typeof agentList!=='function')return;
   const n=agentList().length;announce(`${n} free agent${n===1?'':'s'} match`);
  },700);
 }
 document.addEventListener('input',event=>{if(['agent-search','home-fa-search'].includes(event.target.id))announceFreeAgents();});
 document.addEventListener('change',event=>{if(['agent-position','agent-sort','home-fa-position'].includes(event.target.id))announceFreeAgents();});

 /* ================================================================ help dialog */
 const filter=$('shortcuts-filter'),list=$('shortcuts-list'),count=$('shortcuts-count');
 const kbd=chord=>chord.split('+').map(k=>`<kbd>${k==='Mod'?(mac?'⌘':'Ctrl'):esc(k)}</kbd>`).join('<span class="kbd-plus">+</span>');
 const keysHTML=entry=>entry.keys.map(alt=>alt.split(' ').map(kbd).join('<span class="kbd-then">then</span>')).join('<span class="kbd-or">or</span>');
 function renderHelp(){
  const model=K.helpModel(filter.value,mac),on=enabled.checked;
  const total=model.reduce((n,g)=>n+g.items.length,0);
  list.innerHTML=model.map(({group,items})=>`<section class="shortcut-group" aria-labelledby="shortcut-group-${group.replace(/\W+/g,'-')}"><h3 id="shortcut-group-${group.replace(/\W+/g,'-')}">${esc(group)}</h3><table><tbody>${items.map(item=>{
   const off=!on&&!item.always&&!item.combo;
   return `<tr class="${off?'is-off':''}"><th scope="row">${keysHTML(item)}</th><td>${esc(item.label)}${off?' <span class="shortcut-off">(off)</span>':''}</td></tr>`;
  }).join('')}</tbody></table></section>`).join('')||'<p class="shortcuts-empty">No shortcut matches that filter.</p>';
  count.textContent=filter.value.trim()?`${total} shortcut${total===1?'':'s'} match`:'';
 }
 function openHelp(){filter.value='';renderHelp();if(!help.open)help.showModal();filter.focus();return true;}
 filter.addEventListener('input',renderHelp);
 // Down arrow from the filter scrolls the list so long groups are readable without the mouse.
 filter.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='PageDown'){event.preventDefault();list.scrollBy({top:event.key==='PageDown'?list.clientHeight*.8:60});}if(event.key==='ArrowUp'||event.key==='PageUp'){event.preventDefault();list.scrollBy({top:event.key==='PageUp'?-list.clientHeight*.8:-60});}});
 helpButtons().forEach(button=>button.addEventListener('click',openHelp));
 // Native restoration is enough unless the opener was replaced while the dialog was open.
 const recoverFocus=dialog=>dialog.addEventListener('close',()=>{
  requestAnimationFrame(()=>{
   const active=document.activeElement;
   if(modal()||active&&active!==document.body&&visible(active))return;
   if(isReport()){settleFocus();return;}
   (helpButtons().find(visible)||launcher)?.focus({preventScroll:true});
  });
 });
 recoverFocus(help);

 /* ================================================================ command palette */
 const palette=document.createElement('dialog');
 palette.id='command-palette';palette.className='command-palette';palette.setAttribute('aria-labelledby','palette-title');
 palette.innerHTML=`<div class="palette-bar"><b id="palette-title">▦ COMMAND PALETTE</b><span class="palette-mode" id="palette-mode" hidden></span><span class="palette-esc"><kbd>Esc</kbd> close</span></div>
<div class="palette-field"><span aria-hidden="true">›</span><input id="palette-input" type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" aria-describedby="palette-help" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Report, team, week, player or action…"></div>
<div id="palette-list" class="palette-list" role="listbox" aria-label="Results"></div>
<div class="palette-foot"><span id="palette-help"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open · <kbd>Backspace</kbd> on empty leaves a filter</span><span id="palette-count" role="status" aria-live="polite"></span></div>`;
 document.body.append(palette);
 const pInput=palette.querySelector('#palette-input'),pList=palette.querySelector('#palette-list'),pCount=palette.querySelector('#palette-count'),pMode=palette.querySelector('#palette-mode');
 const MODES={all:'',teams:'TEAMS',players:'PLAYERS',weeks:'WEEKS',reports:'REPORTS',actions:'ACTIONS'};
 const KIND_ORDER=['Recent','Reports','Teams','Weeks','Players','Actions'];
 const KIND_LIMIT={Players:30};
 const RECENT_KEY='gridiron86-palette-recent';
 let pState={mode:'all',items:[],shown:[],active:0};
 const readRecent=()=>{try{return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]').filter(x=>typeof x==='string').slice(0,6);}catch{return [];}};
 const pushRecent=id=>{try{localStorage.setItem(RECENT_KEY,JSON.stringify([id,...readRecent().filter(x=>x!==id)].slice(0,6)));}catch{}};
 function commandItems(){
  const items=[];
  const viewTeam=String(isReport()&&typeof XL!=='undefined'&&XL.viewTeamId?XL.viewTeamId:$('team-select')?.value);
  // Reports, in report-bar order.
  for(const button of bar.querySelectorAll('[data-workspace]')){
   const id=button.dataset.workspace,label=button.textContent.trim(),detail=(button.dataset.baseTitle||button.title||'').replace(/\s*\(G then .\)$/,'');
   items.push({id:`report:${id}`,kind:'Reports',label:id==='dashboard'?'Dashboard':label,detail,hint:K.goKeys(id).replace(' then ',' '),terms:`${detail} report go`,current:(isReport()?XL.open:'dashboard')===id,run:()=>goTo(id)});
  }
  for(const option of $('team-select')?.options||[])items.push({id:`team:${option.value}`,kind:'Teams',label:option.text,detail:option.value===viewTeam?'Current franchise':'Switch franchise',terms:'team franchise club switch',current:option.value===viewTeam,run:()=>switchTeam(option.value)});
  const week=$('header-current-week');
  for(const option of week?.options||[])items.push({id:`week:${option.value}`,kind:'Weeks',label:`Week ${option.text}`,detail:option.value===week.value?'Current week':'Set the active week',terms:`wk w${option.text} week ${option.text}`,current:option.value===week.value,run:()=>{commitSelect(week,option.value);return true;}});
  if(typeof getPool==='function'){
   const teamsById=new Map((typeof model!=='undefined'?model.teams:[]).flatMap(t=>t.playerIds.map(id=>[String(id),t])));
   for(const p of getPool()){
    const team=teamsById.get(String(p.id));
    items.push({id:`player:${p.id}`,kind:'Players',label:p.name,detail:`${p.pos||'—'} · ${p.nfl||'FA'} · ${team?teamName(team):'Free agent'}`,terms:`${p.pos||''} ${p.nfl||''} ${team?teamName(team):'free agent waiver'} player`,mine:team&&String(team.id)===viewTeam,run:()=>{
     if(isReport()&&XL.open==='profile'&&String(XL.player)===String(p.id)){settleFocus();return true;}
     openExplorer('profile',p.id);settleFocus();return true;}});
   }
  }
  const width=window.gridironPageWidth,canWidth=width&&visible($('page-width'));
  const action=(id,label,detail,run,extra={})=>items.push({id:`action:${id}`,kind:'Actions',label,detail,run,...extra});
  action('load','Load league data…','ESPN, Sleeper or a JSON file',()=>{$('open-data').click();return true;},{terms:'connect import espn sleeper json open'});
  action('refresh','Refresh data','Reload the connected league',()=>{$('refresh-button').click();return true;},{terms:'reload update sync'});
  if(canWidth){
   action('width','Page width…','Focus the width slider',()=>toggleWidth(),{hint:'W',terms:'resize narrow wide layout'});
   for(const v of [100,90,80,70])action(`width-${v}`,`Page width ${v===100?'full':v+'%'}`,'Width preset',()=>{width.set(v);announce(`Page width ${v} percent`);return true;},{terms:`width ${v} percent layout`});
  }
  action('about','About GRIDIRON/86','Version and data notes',()=>{$('about-button').click();return true;});
  action('help','Keyboard shortcuts','List every shortcut',()=>openHelp(),{hint:'?',terms:'keys help'});
  action('toggle-keys',enabled.checked?'Turn single-key shortcuts off':'Turn single-key shortcuts on','Ctrl+K, Escape and arrows always work',()=>{enabled.checked=!enabled.checked;enabled.dispatchEvent(new Event('change'));return true;},{terms:'accessibility speech screen reader disable enable'});
  action('top','Focus the report bar','Move to the navigation',()=>{(bar.querySelector('[aria-current="page"]')||bar.querySelector('button'))?.focus();return true;},{terms:'navigation skip'});
  return items;
 }
 function rankItems(){
  const q=pInput.value,mode=pState.mode;
  const kindFor={teams:'Teams',players:'Players',weeks:'Weeks',reports:'Reports',actions:'Actions'}[mode];
  let pool=pState.items.filter(i=>!kindFor||i.kind===kindFor);
  const groups=new Map();
  if(!q.trim()){
   if(mode==='all'){
    const byId=new Map(pool.map(i=>[i.id,i]));
    const recent=readRecent().map(id=>byId.get(id)).filter(Boolean);
    if(recent.length)groups.set('Recent',recent.map(i=>({...i,kind:'Recent',from:i.kind})));
    pool=pool.filter(i=>i.kind!=='Players');
   }
   if(mode==='players')pool=[...pool].sort((a,b)=>(b.mine?1:0)-(a.mine?1:0)||a.label.localeCompare(b.label));
   for(const item of pool){if(!groups.has(item.kind))groups.set(item.kind,[]);groups.get(item.kind).push(item);}
  }else{
   // Your own franchise's players get a small boost, but only when they actually match.
   const scored=pool.map(item=>{const match=Math.max(K.fuzzyScore(q,item.label),K.fuzzyScore(q,`${item.label} ${item.detail||''} ${item.terms||''}`,{subsequence:false})*.7);return {item,score:match>0?match+(item.mine?5:0):0};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
   for(const {item} of scored){if(!groups.has(item.kind))groups.set(item.kind,[]);groups.get(item.kind).push(item);}
  }
  const ordered=[...groups.entries()].sort((a,b)=>q.trim()?0:KIND_ORDER.indexOf(a[0])-KIND_ORDER.indexOf(b[0]));
  return ordered.map(([kind,items])=>[kind,items.slice(0,mode==='players'?120:KIND_LIMIT[kind]??60)]);
 }
 function renderPalette(){
  const groups=rankItems();
  pState.shown=groups.flatMap(([,items])=>items);
  pState.active=Math.min(pState.active,Math.max(0,pState.shown.length-1));
  let index=0;
  pList.innerHTML=groups.map(([kind,items],g)=>`<div role="group" aria-labelledby="palette-group-${g}"><div class="palette-group" id="palette-group-${g}" role="presentation">${esc(kind.toUpperCase())}</div>${items.map(item=>{const i=index++;return `<div role="option" id="palette-option-${i}" data-index="${i}" class="palette-option${item.current?' is-current':''}" aria-selected="${i===pState.active}"><span class="palette-kind" aria-hidden="true">${esc((item.from||item.kind).slice(0,1))}</span><span class="palette-label">${esc(item.label)}${item.current?' <small>(current)</small>':''}</span><span class="palette-detail">${esc(item.detail||'')}</span>${item.hint?`<span class="palette-hint" aria-hidden="true">${esc(item.hint).split(' ').map(k=>`<kbd>${k}</kbd>`).join('')}</span>`:''}</div>`;}).join('')}</div>`).join('')||'<p class="palette-empty">No matches. Try a report, franchise, week number or player name.</p>';
  const n=pState.shown.length;
  pCount.textContent=n?`${n} result${n===1?'':'s'}`:'No results';
  syncActive();
 }
 function syncActive(){
  const option=pList.querySelector(`#palette-option-${pState.active}`);
  for(const node of pList.querySelectorAll('[aria-selected="true"]'))if(node!==option)node.setAttribute('aria-selected','false');
  if(option){option.setAttribute('aria-selected','true');pInput.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
  else pInput.removeAttribute('aria-activedescendant');
 }
 function setMode(mode){
  pState.mode=mode;pMode.hidden=mode==='all';pMode.textContent=MODES[mode]||'';
  pInput.placeholder=mode==='teams'?'Type a franchise name…':mode==='players'?'Type a player, position or NFL team…':mode==='weeks'?'Type a week number…':'Report, team, week, player or action…';
  pInput.setAttribute('aria-label',mode==='all'?'Command palette search':`Command palette, ${MODES[mode].toLowerCase()} only`);
 }
 function openPalette(mode='all'){
  if(help.open)help.close();
  if(modal())return false;
  pState={mode,items:commandItems(),shown:[],active:0};
  setMode(mode);pInput.value='';
  renderPalette();
  if(mode==='teams'||mode==='weeks'){const current=pState.shown.findIndex(i=>i.current);if(current>=0){pState.active=current;syncActive();}}
  palette.showModal();pInput.focus();
  return true;
 }
 function closePalette(){if(palette.open)palette.close();}
 function runActive(){
  const item=pState.shown[pState.active];if(!item)return;
  pushRecent(item.id);
  closePalette();
  // Run after the dialog has returned focus to where the user was.
  requestAnimationFrame(()=>{item.run();});
 }
 pInput.addEventListener('input',()=>{pState.active=0;renderPalette();});
 pInput.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  const n=pState.shown.length;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(n){pState.active=(pState.active+(event.key==='ArrowDown'?1:-1)+n)%n;syncActive();}return;}
  if(event.key==='PageDown'||event.key==='PageUp'){event.preventDefault();if(n){pState.active=Math.max(0,Math.min(n-1,pState.active+(event.key==='PageDown'?8:-8)));syncActive();}return;}
  if((event.key==='Home'||event.key==='End')&&event.ctrlKey){event.preventDefault();pState.active=event.key==='Home'?0:n-1;syncActive();return;}
  if(event.key==='Enter'){event.preventDefault();runActive();return;}
  if(event.key==='Backspace'&&!pInput.value&&pState.mode!=='all'){event.preventDefault();setMode('all');renderPalette();announce('All results');return;}
  if(event.key==='Tab'){event.preventDefault();}
 });
 pList.addEventListener('mousemove',event=>{const option=event.target.closest('[role=option]');if(option&&Number(option.dataset.index)!==pState.active){pState.active=Number(option.dataset.index);syncActive();}});
 pList.addEventListener('click',event=>{const option=event.target.closest('[role=option]');if(!option)return;pState.active=Number(option.dataset.index);runActive();});
 // Clicking the backdrop closes, like Escape.
 palette.addEventListener('click',event=>{if(event.target===palette)closePalette();});
 recoverFocus(palette);

 /* ---------- dashboard windows and the report bar carry their shortcuts ---------- */
 syncHints();
})();
