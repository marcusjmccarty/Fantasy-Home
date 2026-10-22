/* Keyboard routing only: report renderers and workspace preferences remain owners
   of navigation/state. Loaded last, after metric-card Escape capture handling. */
'use strict';
(() => {
 const help=document.getElementById('shortcuts-dialog');
 const enabled=document.getElementById('shortcuts-enabled');
 const report=document.getElementById('explore-dialog');
 // Separate from workspace state; write only on an explicit preference change.
 const preferenceKey='gridiron86-keyboard-shortcuts-v1';
 try{enabled.checked=localStorage.getItem(preferenceKey)!=='off';}catch{/* Page-local choice still works when storage is blocked. */}
 enabled.addEventListener('change',()=>{
  try{localStorage.setItem(preferenceKey,enabled.checked?'on':'off');}catch{}
 });
 const visible=node=>node&&!node.disabled&&node.getClientRects().length>0&&!node.closest('[hidden]');
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
  if(help.open||document.activeElement!==document.body&&!help.contains(document.activeElement))return;
  const top=modal();if(top&&top!==report)return;
  const fallback=(report.open?report:document).querySelector('[data-shortcuts-help]');
  if(visible(fallback))fallback.focus({preventScroll:true});
 });
 document.querySelectorAll('[data-shortcuts-help]').forEach(button=>button.addEventListener('click',showHelp));
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
  const top=modal();
  // Native dialogs own Escape and focus restoration. Only intercept an inner
  // ranking card when no higher modal is covering its report.
  if(event.key==='Escape'){
   if(event.shiftKey||editing(event.target)||(top&&top!==report))return;
   if(dismissRanking()){event.preventDefault();event.stopImmediatePropagation();}
   return;
  }
  if(!enabled.checked||editing(event.target)||event.shiftKey&&event.key!=='?')return;
  if(document.querySelector('.metric-popover'))return;
  if(top&&top!==report)return;
  let target;
  if(event.key==='?'){
   event.preventDefault();showHelp();return;
  }
  if(event.key.toLowerCase()==='g'){
   target=report.open&&document.body.dataset.layout==='tabbed'
    ?document.querySelector('#workspace-tabs [aria-selected="true"]')
    :document.getElementById(report.open?'explore-jump':'home-go-to');
  }
  if(event.key==='/'){
   const scope=report.open?report:document.querySelector('main');
   target=[...scope.querySelectorAll('input[type="search"],#agent-search,#graph-search')].find(visible);
  }
  if(!visible(target))return;
  event.preventDefault();target.focus();
 },true);
})();
