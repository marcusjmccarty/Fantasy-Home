/* Floating metric cards. They cover their trigger without changing the layout. */
'use strict';
function statHelpTile(label,value,description,classes='',direction='down'){
 return `<button type="button" class="stat-help-trigger ${classes}" data-stat-title="${esc(label)}" data-stat-help="${esc(description)}" data-stat-direction="${direction}" aria-expanded="false"><span>${esc(label)}</span><strong>${value}</strong></button>`;
}
let openMetricHelp=null;
function closeStatHelp(restore=false){
 if(!openMetricHelp)return;const {card,trigger}=openMetricHelp;openMetricHelp=null;card.remove();trigger.setAttribute('aria-expanded','false');if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});
}
function metricPopupLeft(rect,row,width,viewport,margin=12){
 const ordered=[...row].sort((a,b)=>a.left-b.left),index=ordered.findIndex(r=>Math.abs(r.left-rect.left)<1);
 const right=index>=Math.ceil(ordered.length/2);
 return Math.max(margin,Math.min(right?rect.right-width:rect.left,viewport-margin-width));
}
function showStatHelp(trigger){
 closeStatHelp();const rect=trigger.getBoundingClientRect(),card=document.createElement('section'),margin=12;
 card.className='metric-popover';card.setAttribute('role','dialog');card.setAttribute('aria-label',trigger.dataset.statTitle);card.tabIndex=-1;
 const rankings=trigger.dataset.statRankings?JSON.parse(trigger.dataset.statRankings):null;
 card.innerHTML=`<header>${esc(trigger.dataset.statTitle)}</header><strong>${esc(trigger.querySelector('strong,b')?.textContent||'')}</strong>${rankings?`<table class="metric-ranking"><thead><tr><th>#</th><th>FRANCHISE</th><th>${esc(trigger.dataset.statUnit)}</th></tr></thead><tbody>${rankings.map(r=>`<tr class="${r.id===String(currentTeamId)?'is-active':''}"><td>${r.rank}</td><td>${esc(r.name)}</td><td>${Number(r.value).toFixed(1)}</td></tr>`).join('')||'<tr><td colspan="3">No recorded starts.</td></tr>'}</tbody></table>`:`<p>${esc(trigger.dataset.statHelp)}</p>`}`;
 card.style.setProperty('--metric-accent',getComputedStyle(trigger).getPropertyValue('--metric-accent')||getComputedStyle(trigger).borderTopColor);
 const width=Math.min(Math.max(rect.width,rankings?360:260),innerWidth-margin*2);card.style.width=width+'px';card.style.minHeight=rect.height+'px';const row=[...trigger.parentElement.querySelectorAll('[data-stat-help]')].map(el=>el.getBoundingClientRect()).filter(r=>Math.abs(r.top-rect.top)<3);card.style.left=metricPopupLeft(rect,row,width,innerWidth,margin)+'px';
 (trigger.closest('dialog')||document.body).append(card);
 const up=trigger.dataset.statDirection==='up'||rect.top+card.offsetHeight>innerHeight-margin;
 card.style.top=Math.max(margin,up?rect.bottom-card.offsetHeight:rect.top)+'px';card.style.maxHeight=(innerHeight-margin*2)+'px';
 openMetricHelp={card,trigger};trigger.setAttribute('aria-expanded','true');card.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 if(openMetricHelp){event.preventDefault();event.stopImmediatePropagation();closeStatHelp(true);return;}
 const trigger=event.target.closest('[data-stat-help]');if(!trigger)return;
 event.preventDefault();event.stopImmediatePropagation();showStatHelp(trigger);
},true);
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.getModifierState('AltGraph')||event.shiftKey)return;
 if(openMetricHelp&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeStatHelp(true);}
},true);
// A queued scroll/resize can arrive after the card opens. Restore its focus
// only while it still owns focus; never pull focus back from another control.
function closeStatHelpForViewportChange(){
 if(openMetricHelp)closeStatHelp(openMetricHelp.card.contains(document.activeElement));
}
document.addEventListener('scroll',event=>{if(openMetricHelp&&!openMetricHelp.card.contains(event.target))closeStatHelpForViewportChange();},true);
window.addEventListener('resize',closeStatHelpForViewportChange);

/* ---------------------------------------------------------------------------
   Keyboard and screen-reader structure. Report templates stay simple strings;
   this layer upgrades whatever they render, so new reports get it for free:
   - a polite live region (window.gridironAnnounce)
   - clickable table rows keep native row semantics and gain one real button
   - one focus target per dashboard window (its ▣ open button)
   - LOAD DATA tabs follow the ARIA tabs pattern
   - overflowing scroll containers become focusable labelled regions
   - focus is never stranded on <body> when a re-render replaces it. */
(()=>{
 if(typeof document==='undefined'||typeof MutationObserver==='undefined'||!document.querySelector)return;
 const $=id=>document.getElementById(id);

 /* ---------- live region ---------- */
 const live=document.createElement('div');
 live.id='gridiron-live';live.className='visually-hidden';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
 document.body.append(live);
 let liveTimer=0;
 window.gridironAnnounce=text=>{
  // Clear first so an identical message is announced again.
  clearTimeout(liveTimer);live.textContent='';
  liveTimer=setTimeout(()=>{live.textContent=String(text||'');},60);
 };
 $('connection-status')?.setAttribute('role','status');

 /* ---------- clickable rows: native <tr>, one <button class="row-link"> ---------- */
 const INTERACTIVE='button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
 const SIGNATURE_ATTRS=['data-player','data-team','data-week','data-open-player','data-open-match','data-set-team','data-ranking-player','data-ranking-team','data-position-week','data-gamelog-week','data-usage-player'];
 function rowLabel(row){
  const own=row.getAttribute('aria-label')||row.getAttribute('title')||'';
  const text=own.replace(/;\s*double-click.*$/i,'').trim();
  if(text)return text;
  const name=row.querySelector('strong,b')?.textContent.trim()||row.cells[1]?.textContent.trim()||row.cells[0]?.textContent.trim()||'row';
  return `Open ${name}`;
 }
 function upgradeRow(row){
  if(row.dataset.rowUpgraded||!row.closest('tbody'))return;
  row.dataset.rowUpgraded='1';
  const label=rowLabel(row);
  row.removeAttribute('tabindex');
  if(row.getAttribute('role')==='button')row.removeAttribute('role');
  row.removeAttribute('aria-label');
  row.classList.add('has-row-link');
  const button=document.createElement('button');
  button.type='button';button.className='row-link';button.setAttribute('aria-label',label);
  if(row.matches('.selected,.is-current,[aria-selected="true"]'))button.setAttribute('aria-current','true');
  // Wrap the name cell's text when it holds no other control; otherwise add a
  // compact button at the start of the row. The row outline shows focus either way.
  const cells=[...row.cells];
  const named=cells.find(c=>c.querySelector('strong')&&!c.querySelector(INTERACTIVE))||cells.find((c,i)=>i===1&&!c.querySelector(INTERACTIVE)&&c.textContent.trim())||cells.find(c=>!c.querySelector(INTERACTIVE)&&c.textContent.trim());
  if(named){button.append(...named.childNodes);named.append(button);}
  else{button.classList.add('row-link-empty');button.textContent='›';(cells[0]||row).prepend(button);}
 }
 // A keyboard activation of the row button behaves exactly like a click on the row.
 document.addEventListener('click',event=>{
  const link=event.target instanceof Element&&event.target.closest('.row-link');if(!link)return;
  const row=link.closest('tr');if(!row)return;
  event.stopImmediatePropagation();event.preventDefault();
  const signature=rowSignature(row);
  row.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,detail:event.detail}));
  if(signature)restoreLater(signature,row.closest('tbody')?.id);
 },true);
 // Double-click on a row (mouse) keeps its existing meaning; the button never swallows it.
 function rowSignature(row){
  const attr=SIGNATURE_ATTRS.find(a=>row.hasAttribute(a));
  return attr?`tr[${attr}="${CSS.escape(row.getAttribute(attr))}"] .row-link`:null;
 }

 /* ---------- focus recovery after re-renders ---------- */
 let lost=null;
 function signatureFor(node){
  if(!(node instanceof Element))return null;
  if(node.matches('.row-link'))return rowSignature(node.closest('tr'));
  if(node.id)return '#'+CSS.escape(node.id);
  for(const a of node.getAttributeNames())if(a.startsWith('data-')&&a!=='data-row-upgraded')return `${node.tagName.toLowerCase()}[${a}="${CSS.escape(node.getAttribute(a))}"]`;
  return null;
 }
 const usable=node=>node&&node.isConnected&&!node.disabled&&node.getClientRects().length>0&&!node.closest('[hidden],[inert]');
 function recover(signature){
  const active=document.activeElement;
  if(active&&active!==document.body&&active.isConnected)return;
  const target=signature&&[...document.querySelectorAll(signature)].find(usable);
  if(target){target.focus({preventScroll:true});return;}
  if(document.body.dataset.layout==='tabbed'&&$('explore-dialog')?.open){const title=$('explore-title');title.tabIndex=-1;title.focus({preventScroll:true});}
 }
 function restoreLater(signature){requestAnimationFrame(()=>requestAnimationFrame(()=>recover(signature)));setTimeout(()=>recover(signature),250);}
 document.addEventListener('focusout',event=>{
  if(event.relatedTarget)return;
  const node=event.target;lost={node,signature:signatureFor(node)};
  requestAnimationFrame(()=>{if(lost?.node===node&&!node.isConnected)restoreLater(lost.signature);});
 });

 /* ---------- dashboard windows: one focus target each ---------- */
 const titleCase=s=>String(s||'').toLowerCase().replace(/(^|[\s\/&-])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\s+\/\s+/g,' / ');
 function upgradeWindow(win){
  if(win.dataset.winUpgraded)return;
  const chrome=win.querySelector(':scope > .title-bar .chrome');if(!chrome)return;
  win.dataset.winUpgraded='1';
  const title=win.querySelector(':scope > .title-bar h2')?.textContent.trim();
  // The section stays programmatically focusable so code that restores focus to
  // a window still works; focusin hands that focus on to the open button.
  if(win.matches('.window-grid .win.expandable')){win.setAttribute('tabindex','-1');win.removeAttribute('aria-label');}
  const label=win.matches('.dossier-window')?`Open ${title?.split(' · ')[0]||'player'} player file`:`Open ${titleCase(title)} report`;
  chrome.setAttribute('aria-label',label);chrome.title=label;
 }
 let pointer=false;
 document.addEventListener('pointerdown',()=>{pointer=true;},true);
 document.addEventListener('pointerup',()=>{setTimeout(()=>{pointer=false;});},true);
 document.addEventListener('focusin',event=>{
  const win=event.target;
  if(!pointer&&win instanceof Element&&win.matches('.win[data-win-upgraded]'))win.querySelector(':scope > .title-bar .chrome')?.focus({preventScroll:true});
 });

 /* ---------- overflowing scroll containers are keyboard reachable ---------- */
 function regionLabel(box){
  const panel=box.closest('.lab-panel,.win,section');
  const heading=panel?.querySelector('h4,h3,h2');
  return `${(heading?.textContent||'Table').trim().replace(/\s+/g,' ').slice(0,80)}, scrollable`;
 }
 function syncScrollRegion(box){
  const overflow=box.scrollWidth>box.clientWidth+2||box.scrollHeight>box.clientHeight+2;
  if(overflow&&!box.hasAttribute('tabindex')){box.tabIndex=0;box.setAttribute('role','region');box.setAttribute('aria-label',regionLabel(box));box.dataset.scrollRegion='1';}
  else if(!overflow&&box.dataset.scrollRegion){box.removeAttribute('tabindex');box.removeAttribute('role');box.removeAttribute('aria-label');delete box.dataset.scrollRegion;}
 }
 let regionFrame=0;
 const syncRegions=()=>{cancelAnimationFrame(regionFrame);regionFrame=requestAnimationFrame(()=>document.querySelectorAll('.table-scroll,.lab-table-scroll,.summary-rank-scroll').forEach(syncScrollRegion));};
 window.addEventListener('resize',syncRegions);

 /* ---------- one observer applies the upgrades to anything rendered later ---------- */
 const ROWS='tbody tr[tabindex="0"]';
 function upgrade(root){
  if(!(root instanceof Element))return;
  if(root.matches(ROWS))upgradeRow(root);
  root.querySelectorAll(ROWS).forEach(upgradeRow);
  if(root.matches('.win'))upgradeWindow(root);
  root.querySelectorAll('.win').forEach(upgradeWindow);
 }
 new MutationObserver(records=>{
  let added=false;
  for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){upgrade(node);added=true;}
  if(added)syncRegions();
 }).observe(document.body,{childList:true,subtree:true});
 const start=()=>{upgrade(document.body);syncRegions();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();

 /* ---------- LOAD DATA: ARIA tabs with arrow keys ---------- */
 const tabs=[...document.querySelectorAll('#data-dialog [role="tab"][data-tab]')];
 if(tabs.length){
  for(const tab of tabs){
   const pane=$(`${tab.dataset.tab}-pane`);if(!pane)continue;
   tab.setAttribute('aria-controls',pane.id);pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',tab.id);pane.tabIndex=-1;
  }
  const syncTabs=()=>tabs.forEach(tab=>{tab.tabIndex=tab.getAttribute('aria-selected')==='true'?0:-1;});
  syncTabs();
  new MutationObserver(syncTabs).observe(tabs[0].parentElement,{attributes:true,subtree:true,attributeFilter:['aria-selected']});
  tabs[0].parentElement.addEventListener('keydown',event=>{
   const index=tabs.indexOf(event.target);if(index<0)return;
   let next=-1;
   if(event.key==='ArrowRight')next=(index+1)%tabs.length;
   else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
   else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;
   if(next<0)return;
   event.preventDefault();tabs[next].click();tabs[next].focus();
  });
 }
 // Required fields explain themselves in the dialog's own status line.
 const league=$('espn-league');
 if(league){
  league.addEventListener('invalid',event=>{
   event.preventDefault();
   league.setAttribute('aria-invalid','true');league.setAttribute('aria-describedby','dialog-message');
   const message=$('dialog-message');if(message){message.textContent='Enter your ESPN league ID to connect.';message.className='dialog-message error';}
   league.focus();
  });
  league.addEventListener('input',()=>{if(league.value.trim())league.removeAttribute('aria-invalid');});
 }
})();
