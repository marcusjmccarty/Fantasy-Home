/* Task finder. Report history, trade checkbox handlers, and renderers remain the
   owners of application state; this surface only selects their existing actions. */
'use strict';
(() => {
 const dialog=document.getElementById('finder-dialog'),input=document.getElementById('finder-query');
 const list=document.getElementById('finder-results'),status=document.getElementById('finder-status');
 const scope=document.getElementById('finder-scope'),actions=document.getElementById('finder-actions');
 const report=document.getElementById('explore-dialog'),content=document.getElementById('explore-content');
 const weekPicker=document.getElementById('finder-week'),weekly=document.getElementById('finder-weekly');
 let inspectedWeek=null;
 const memories=new Map();let mode='reports',rows=[],selected=0,opener=null,navigating=false,origin=null,revision=0;
 const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const usable=node=>node?.isConnected&&!node.disabled&&!node.closest('[hidden],[inert]')&&node.getClientRects().length&&getComputedStyle(node).visibility==='visible';
 const player=()=>rows[selected]?.player;
 function frame(){return {focus:document.activeElement,id:document.activeElement?.id,scroll:content.scrollTop,dialogScroll:report.scrollTop,windowY:window.scrollY};}
 function restore(saved){
  const token=++revision,route=XL.open;
  requestAnimationFrame(()=>{
   if(token!==revision||XL.open!==route||dialog.open)return;
   const target=usable(saved?.focus)?saved.focus:saved?.id?document.getElementById(saved.id):null;
   if(usable(target))target.focus({preventScroll:true});else if(report.open){content.tabIndex=-1;content.focus({preventScroll:true});}
   if(saved){content.scrollTop=saved.scroll;report.scrollTop=saved.dialogScroll;window.scrollTo({top:saved.windowY});}
  });
 }
 function save(){memories.set(mode,{query:input.value,index:selected,scroll:list.scrollTop});}
 function tradeSide(){return mode==='give'||mode==='get';}
 function entries(){
  if(mode==='reports')return WORKSPACE_TABS.map(([id,label,detail])=>({id,label,detail}));
  let pool=getPool();
  if(tradeSide()){
   const team=model.teams.find(t=>String(t.id)===String(mode==='give'?STRATEGY.trade.team:STRATEGY.trade.partner));
   pool=tradeRoster(team);
  }
  return pool.map(p=>({id:String(p.id),player:p,label:p.name,detail:`${p.pos} · ${p.nfl||'—'} · ${teamForPlayer(p)?teamName(teamForPlayer(p)):'Free agent'}`}));
 }
 function paint(){
  const query=normalize(input.value).split(' ').filter(Boolean);
  rows=entries().filter(row=>query.every(word=>normalize(`${row.label} ${row.detail}`).includes(word)));
  selected=Math.min(Math.max(0,selected),Math.max(0,rows.length-1));
  list.replaceChildren();
  // All matching loaded players remain reachable; render a small window around
  // the active result rather than truncating the searchable data set.
  const start=Math.max(0,selected-10),end=Math.min(rows.length,start+30);
  rows.slice(start,end).forEach((row,offset)=>{
   const index=start+offset,node=document.createElement('div');node.id=`finder-result-${index}`;node.setAttribute('role','option');node.setAttribute('aria-selected',String(index===selected));
   node.dataset.index=index;const name=document.createElement('strong'),detail=document.createElement('span');name.textContent=row.label;
   const checked=tradeSide()&&STRATEGY.trade[mode].includes(row.id);
   detail.textContent=`${checked?'Selected · ':''}${row.detail}`;node.append(name,detail);list.append(node);
  });
  if(rows.length)input.setAttribute('aria-activedescendant',`finder-result-${selected}`);else input.removeAttribute('aria-activedescendant');
  status.textContent=rows.length?`${rows.length} matches. ${selected+1} of ${rows.length}. ${tradeSide()?'Enter adds or removes the highlighted player.':'Enter opens the highlighted result.'}`:'No matching loaded players or reports.';
  actions.hidden=mode==='reports'||tradeSide()||!player();
  document.getElementById('finder-player-name').textContent=player()?.name||'';
  const p=player(),week=Number(weekPicker.value);
  const actual=labNum(p?.scores?.[week]);
  const projected=labNum(p?.projections?.[week])??(week===Number(model.currentWeek||model.liveWeek)?labNum(p?.espnProj):null);
  weekly.textContent=p?`Week ${week} · Recorded points: ${actual===null?'Not supplied':actual} · Provider projection: ${projected===null?'Not supplied':projected}`:'';
 }
 function changeMode(next){save();mode=next;scope.value=mode;const memory=memories.get(mode);input.value=memory?.query||'';selected=memory?.index||0;paint();list.scrollTop=memory?.scroll||0;input.focus();input.select();}
 function closeForNavigation(){save();navigating=true;dialog.close();revision++;}
 function navigate(type,p){
  const saved=origin;closeForNavigation();
  const week=XL.viewWeek;
  openExplorer(type,p?.id??null,week==null?{}:{week});
  if(XL.history.length)XL.history.at(-1).finderReturn=saved;
  const route=XL.open,token=++revision;
  requestAnimationFrame(()=>{
   if(token!==revision||XL.open!==route||dialog.open)return;
   const target=content.querySelector('input[type="search"],select,button');
   content.tabIndex=-1;(usable(target)?target:content).focus({preventScroll:true});
  });
 }
 function execute(){
  const row=rows[selected];if(!row)return;
  if(mode==='reports'){navigate(row.id);return;}
  if(tradeSide()){
   // Re-resolve against the current rendered roster. Never change franchises,
   // clear packages, or guess a trade side from a global player search.
   const checkbox=content.querySelector(`input[data-trade-side="${mode}"][value="${CSS.escape(row.id)}"]`);
   if(!checkbox){status.textContent='Roster changed. Reopen the finder to select from the current trade teams.';return;}
   checkbox.click();paint();input.focus();return;
  }
  navigate('profile',row.player);
 }
 function history(direction){
  const stack=direction==='back'?XL.history:XL.future;if(!report.open||!stack.length)return false;
  const saved=stack.at(-1).finderReturn;if(!saved)return false;const current=frame();revision++;
  if(direction==='back')exploreBack();else exploreForward();
  (direction==='back'?XL.future:XL.history).at(-1).finderReturn=current;restore(saved);return true;
 }
 function open(requested){
  if(dialog.open)return;
  opener=document.activeElement;origin=frame();navigating=false;
  if(inspectedWeek===null)inspectedWeek=Number(XL.viewWeek||currentWeek);
  weekPicker.value=String(inspectedWeek);
  const isTrade=report.open&&XL.open==='trade';
  scope.querySelectorAll('[data-trade-scope]').forEach(option=>{option.hidden=!isTrade;option.disabled=!isTrade;});
  if(isTrade){
   scope.querySelector('[value="give"]').textContent=`Team A sends · ${teamName(tradeTeam())}`;
   const partner=model.teams.find(t=>String(t.id)===String(STRATEGY.trade.partner));
   scope.querySelector('[value="get"]').textContent=`Team B sends · ${teamName(partner)}`;
  }
  mode=requested==='players'&&isTrade?'give':requested;
  const memory=memories.get(mode);scope.value=mode;input.value=memory?.query||'';selected=memory?.index||0;
  paint();dialog.showModal();input.focus();input.select();list.scrollTop=memory?.scroll||0;
 }
 weekPicker.addEventListener('change',()=>{inspectedWeek=Number(weekPicker.value);paint();});
 scope.addEventListener('change',()=>changeMode(scope.value));
 input.addEventListener('input',()=>{selected=0;paint();});
 input.addEventListener('keydown',event=>{
  if(event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();selected=Math.max(0,Math.min(rows.length-1,selected+(event.key==='ArrowDown'?1:-1)));paint();document.getElementById(`finder-result-${selected}`)?.scrollIntoView({block:'nearest'});
  }else if(event.key==='Enter'&&!event.repeat){event.preventDefault();execute();}
 });
 list.addEventListener('click',event=>{const option=event.target.closest('[data-index]');if(!option)return;selected=Number(option.dataset.index);execute();});
 actions.addEventListener('click',event=>{
  const action=event.target.closest('[data-finder-action]')?.dataset.finderAction,p=player();if(!action||!p)return;
  if(action==='compare'){
   XL.positionComparisonPool='ALL';XL.positionComparePos=p.pos==='D/ST'?'DEF':p.pos;XL.positionComparisonView='position';
   if(XL.viewWeek!=null)XL.positionCompareWeek=String(XL.viewWeek);
   navigate('position-compare',p);
  }else navigate(action,p);
 });
 dialog.addEventListener('cancel',()=>save());
 dialog.addEventListener('close',()=>{
  if(navigating||dialog.open)return;
  save();if(usable(opener))opener.focus({preventScroll:true});else restore(origin);
 });
 document.querySelectorAll('[data-finder-open]').forEach(button=>button.addEventListener('click',()=>open('reports')));
 // Existing history buttons keep the report history engine; only restoration
 // metadata is added for finder-origin views. No renderer interception.
 for(const direction of ['back','forward'])document.getElementById(`explore-${direction}`).addEventListener('click',event=>{
  if(history(direction))event.stopImmediatePropagation();
 },true);
 window.FantasyFinder={open,history};
})();
