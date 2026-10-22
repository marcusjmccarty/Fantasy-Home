/* Keyboard routing only: report renderers and workspace preferences remain owners
   of navigation/state. Loaded last, after metric-card Escape capture handling. */
'use strict';
(() => {
 const help=document.getElementById('shortcuts-dialog');
 const enabled=document.getElementById('shortcuts-enabled');
 const report=document.getElementById('explore-dialog');
 const helpButtons=[...document.querySelectorAll('[data-shortcuts-help]')];
 function syncHelpButtons(){
  for(const button of helpButtons){
   button.textContent=enabled.checked?'KEYS ?':'KEYS';
   button.title=enabled.checked?'Keyboard shortcuts (?)':'Keyboard shortcuts (single-key shortcuts off)';
   button.setAttribute('aria-label',enabled.checked?'Keyboard shortcuts':'Keyboard shortcuts (single-key shortcuts off)');
   button.setAttribute('aria-controls',help.id);
  }
 }
 // Separate from workspace state; write only on an explicit preference change.
 const preferenceKey='gridiron86-keyboard-shortcuts-v1';
 try{enabled.checked=localStorage.getItem(preferenceKey)!=='off';}catch{/* Page-local choice still works when storage is blocked. */}
 syncHelpButtons();
 enabled.addEventListener('change',()=>{
  syncHelpButtons();
  try{localStorage.setItem(preferenceKey,enabled.checked?'on':'off');}catch{}
 });
 const visible=node=>node&&!node.disabled&&node.getClientRects().length>0&&!node.closest('[hidden],[inert]')&&getComputedStyle(node).visibility==='visible';
 const editing=target=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="slider"]');
 function dismissRanking(){
   for(const [id,selector] of [['player-ranking-host','.player-rank-trigger'],['summary-ranking-host','.summary-rank-trigger'],['position-ranking-host','.position-rank-trigger']]){
    const host=document.getElementById(id);if(!visible(host))continue;
    const trigger=report.querySelector(`${selector}[aria-expanded="true"]`);
    dismissRankHost(host,selector);
    if(visible(trigger))trigger.focus({preventScroll:true});
    return true;
   }
  return false;
 }
 // Native cancel fires after a select's own Escape handling. It also covers
 // Escape from text fields without treating typing as a global shortcut.
 report.addEventListener('cancel',event=>{if(dismissRanking())event.preventDefault();});
 const modal=()=>[...document.querySelectorAll('dialog:modal')].at(-1);
 function showHelp(){if(!help.open)help.showModal();}
 // Native restoration is sufficient unless an asynchronous report update has
 // removed its opener. Recover only stranded focus, never override a new modal.
 help.addEventListener('close',()=>{
  const active=document.activeElement;
  if(help.open||active!==document.body&&!help.contains(active)&&visible(active))return;
  const scope=modal()||(report.open?report:document);
  const fallback=[...scope.querySelectorAll('[data-shortcuts-help]'),...scope.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].find(visible);
  fallback?.focus({preventScroll:true});
 });
 helpButtons.forEach(button=>button.addEventListener('click',showHelp));
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey||event.getModifierState('AltGraph'))return;
  const top=modal();
  // A held Escape must not cascade through a stack of native dialogs.
  if(event.repeat){if(event.key==='Escape'&&top)event.preventDefault();return;}
  // Native dialogs own Escape and focus restoration. Only intercept an inner
  // ranking card when no higher modal is covering its report.
  if(event.key==='Escape'){
   if(event.shiftKey||editing(event.target)||(top&&top!==report))return;
   if(dismissRanking()){event.preventDefault();event.stopImmediatePropagation();}
   return;
  }
  if(!enabled.checked||editing(event.target)||event.shiftKey&&event.key!=='?')return;
  if(document.querySelector('.metric-popover'))return;
  if(top===help)return;
  if(event.key==='?'){
   event.preventDefault();showHelp();return;
  }
  if(top&&top!==report)return;
  if(event.key.toLowerCase()==='g'||event.key==='/'){
   event.preventDefault();FantasyFinder.open(event.key==='/'?'players':'reports');return;
  }
 },true);
})();
