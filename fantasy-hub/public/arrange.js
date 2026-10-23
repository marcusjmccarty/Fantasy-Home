/* Arrange the dashboard like a phone home screen.
   - Mouse / pen: drag a window by its title bar; the other windows slide out of
     the way while you move, and the order is saved when you let go.
   - Touch: press and hold a title bar for a moment, then drag.
   - Keyboard: every window has a move handle (the square at the left of its
     title bar). Press Space or Enter to pick the window up, arrow keys to move
     it, Space/Enter to drop it, Escape to put it back where it was.
   The order is remembered in this browser; "Reset layout" restores the default. */
'use strict';
(()=>{
 const grid=document.querySelector('.window-grid');
 if(!grid)return;
 const KEY='gridiron86-tile-order-v1';
 const HOLD_MS=380,MOVE_SLOP=6,ANIM_MS=180;
 const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const tiles=()=>[...grid.children].filter(node=>node.matches('.win[data-explore]'));
 const idOf=tile=>tile.dataset.explore;
 const nameOf=tile=>{
  const raw=tile.querySelector('.title-bar h2')?.textContent||idOf(tile);
  return raw.split('/')[0].trim().toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
 };
 const DEFAULT_ORDER=tiles().map(idOf);

 /* ---------- live region ---------- */
 const live=document.createElement('div');
 live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','assertive');
 document.body.append(live);
 const say=text=>{live.textContent='';requestAnimationFrame(()=>{live.textContent=text;});};

 /* ---------- persistence ---------- */
 function saveOrder(){
  const order=tiles().map(idOf);
  try{
   if(order.join()===DEFAULT_ORDER.join())localStorage.removeItem(KEY);
   else localStorage.setItem(KEY,JSON.stringify(order));
  }catch{/* Storage may be unavailable; the order still applies to this page. */}
  syncReset();
 }
 function applyOrder(order){
  const byId=new Map(tiles().map(tile=>[idOf(tile),tile]));
  const known=order.filter(id=>byId.has(id));
  // New windows added in a later version keep their default position at the end.
  for(const id of DEFAULT_ORDER)if(!known.includes(id))known.push(id);
  for(const id of known)grid.append(byId.get(id));
 }
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(Array.isArray(saved))applyOrder(saved);}catch{}

 /* ---------- reset control (shown only when the layout is customised) ---------- */
 const bar=document.createElement('div');
 bar.className='arrange-bar';
 bar.innerHTML='<span class="arrange-hint">Drag a window by its title bar to rearrange the dashboard.</span><button type="button" class="arrange-reset">↺ Reset layout</button>';
 grid.after(bar);
 const resetButton=bar.querySelector('.arrange-reset');
 function syncReset(){
  const custom=tiles().map(idOf).join()!==DEFAULT_ORDER.join();
  resetButton.hidden=!custom;bar.classList.toggle('is-custom',custom);
 }
 function resetLayout(){
  const before=snapshot();
  applyOrder(DEFAULT_ORDER);animateFrom(before);saveOrder();
  say('Dashboard layout reset to the default order');
 }
 resetButton.addEventListener('click',resetLayout);
 syncReset();
 // Re-fit after load, whenever the column count changes, and when fonts settle.
 let lastCols=0;
 const refit=()=>{const c=columns();if(c!==lastCols){lastCols=c;}fitRows();};
 new ResizeObserver(()=>{const c=columns();if(c!==lastCols)refit();}).observe(grid);
 requestAnimationFrame(refit);document.fonts?.ready.then(refit);

 /* ---------- No holes: rows always fill the width ----------
    Some windows are wide (Variable Lab spans two columns, Roster the full row,
    Standings the full row on medium screens). When a wide window doesn't fit
    after the one before it, CSS grid would leave an empty gap. Instead, the
    window before the gap widens to fill its row, as does the last window. Your
    order is never changed. */
 function naturalSpan(tile,cols){
  const cs=getComputedStyle(tile),start=cs.gridColumnStart,end=cs.gridColumnEnd;
  if(start==='1'&&end==='-1')return cols;
  const m=/span\s+(\d+)/.exec(start)||/span\s+(\d+)/.exec(end);
  return Math.min(cols,m?Number(m[1]):1);
 }
 function fitRows(){
  const list=tiles();
  for(const tile of list){tile.style.gridColumn='';tile.classList.remove('is-stretched');}
  const cols=columns();
  if(cols<2)return;
  const spans=list.map(tile=>naturalSpan(tile,cols)),widen=new Map();
  let used=0,last=-1;
  const close=()=>{if(last>=0&&used>0&&used<cols)widen.set(last,spans[last]+cols-used);used=0;last=-1;};
  list.forEach((tile,i)=>{
   if(used+spans[i]>cols)close();
   used+=spans[i];last=i;
   if(used===cols)close();
  });
  close();
  for(const [i,span] of widen){list[i].style.gridColumn=`span ${span}`;list[i].classList.add('is-stretched');}
 }

 /* ---------- FLIP animation: windows glide to their new places ---------- */
 function snapshot(){return new Map(tiles().map(tile=>[tile,tile.getBoundingClientRect()]));}
 function animateFrom(before,skip=null){
  fitRows();
  if(reduceMotion.matches)return;
  for(const [tile,old] of before){
   if(tile===skip)continue;
   const now=tile.getBoundingClientRect();
   const dx=old.left-now.left,dy=old.top-now.top;
   if(!dx&&!dy)continue;
   tile.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:ANIM_MS,easing:'cubic-bezier(.2,.7,.2,1)'});
  }
 }

 /* ---------- move handles (keyboard and screen readers) ---------- */
 for(const tile of tiles()){
  const ornament=tile.querySelector('.title-bar .box-ornament');
  const handle=document.createElement('button');
  handle.type='button';
  handle.className='box-ornament tile-handle';
  handle.setAttribute('aria-label',`Move ${nameOf(tile)} window`);
  handle.setAttribute('aria-describedby','arrange-help');
  handle.title='Drag to move · or press Space, then arrow keys';
  if(ornament)ornament.replaceWith(handle);else tile.querySelector('.title-bar')?.prepend(handle);
 }
 const help=document.createElement('p');
 help.id='arrange-help';help.className='sr-only';
 help.textContent='Press Space or Enter to pick up the window, arrow keys to move it, then Space or Enter to drop it. Escape cancels.';
 document.body.append(help);

 let held=null,moving=false; // keyboard pick-up state: {tile, startIndex}
 function columns(){
  const style=getComputedStyle(grid).gridTemplateColumns;
  return Math.max(1,style.split(' ').filter(Boolean).length);
 }
 function moveHeld(delta){
  const list=tiles(),index=list.indexOf(held.tile);
  const target=Math.max(0,Math.min(list.length-1,index+delta));
  if(target===index){say(index===0?'Already first':'Already last');return;}
  const before=snapshot();
  const ref=list[target];
  moving=true;
  if(target>index)ref.after(held.tile);else ref.before(held.tile);
  moving=false;
  animateFrom(before);
  held.tile.querySelector('.tile-handle').focus({preventScroll:true});
  held.tile.scrollIntoView({block:'nearest',behavior:reduceMotion.matches?'auto':'smooth'});
  const now=tiles();
  say(`${nameOf(held.tile)}: position ${target+1} of ${now.length}${now[target-1]?`, after ${nameOf(now[target-1])}`:''}`);
 }
 function pickUp(tile){
  held={tile,startIndex:tiles().indexOf(tile)};
  tile.classList.add('is-held');document.body.classList.add('is-arranging');
  say(`${nameOf(tile)} picked up. Position ${held.startIndex+1} of ${tiles().length}. Use arrow keys to move, Space to drop, Escape to cancel.`);
 }
 function drop({cancel=false}={}){
  if(!held)return;
  const {tile,startIndex}=held;held=null;
  if(cancel){
   const before=snapshot(),list=tiles().filter(t=>t!==tile);
   moving=true;
   if(startIndex>=list.length)grid.insertBefore(tile,list.at(-1)?.nextSibling||null);else list[startIndex].before(tile);
   moving=false;
   animateFrom(before);
  }
  tile.classList.remove('is-held');document.body.classList.remove('is-arranging');
  tile.querySelector('.tile-handle')?.focus({preventScroll:true});
  saveOrder();
  say(cancel?`Move cancelled. ${nameOf(tile)} is back at position ${startIndex+1}.`:`${nameOf(tile)} dropped at position ${tiles().indexOf(tile)+1} of ${tiles().length}.`);
 }
 grid.addEventListener('click',event=>{
  const handle=event.target.closest('.tile-handle');if(!handle)return;
  // The handle never opens the report; a click (without dragging) toggles keyboard pick-up.
  event.preventDefault();event.stopPropagation();
  if(dragJustEnded)return;
  const tile=handle.closest('.win');
  if(held?.tile===tile)drop();else{if(held)drop();pickUp(tile);}
 },true);
 // Window-level capture so held windows own the arrow keys before any global shortcut.
 window.addEventListener('keydown',event=>{
  if(!held)return;
  if(!event.target.closest?.('.tile-handle')){drop();return;}
  const cols=columns();
  const map={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols,Home:-999,End:999};
  if(event.key in map){event.preventDefault();event.stopImmediatePropagation();moveHeld(map[event.key]);}
  else if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();drop({cancel:true});}
  else if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();drop();}
  else if(event.key==='Tab'){drop();}
 },true);
 grid.addEventListener('focusout',event=>{
  // Moving a node in the DOM briefly drops focus; that is not the user leaving.
  if(moving)return;
  if(held&&!held.tile.contains(event.relatedTarget))drop();
 });

 /* ---------- pointer dragging ---------- */
 let drag=null,dragJustEnded=false;
 const INTERACTIVE='select,input,textarea,label,a,.chrome,[data-stat-help],[contenteditable]';
 grid.addEventListener('pointerdown',event=>{
  if(event.button!==0||held)return;
  const bar=event.target.closest('.title-bar');if(!bar)return;
  const tile=bar.closest('.window-grid>.win');if(!tile)return;
  if(event.target.closest(INTERACTIVE))return;
  drag={tile,pointerId:event.pointerId,type:event.pointerType,x0:event.clientX,y0:event.clientY,x:event.clientX,y:event.clientY,lifted:false,timer:0};
  if(event.pointerType==='touch'){
   // Touch must hold still briefly so ordinary scrolling still works.
   drag.timer=setTimeout(()=>{if(drag&&!drag.lifted)lift();},HOLD_MS);
  }
 });
 function lift(){
  const {tile}=drag;
  const rect=tile.getBoundingClientRect();
  drag.lifted=true;
  drag.grabX=drag.x-rect.left;drag.grabY=drag.y-rect.top;
  tile.classList.add('is-lifted');document.body.classList.add('is-arranging','is-dragging');
  try{tile.querySelector('.title-bar').setPointerCapture?.(drag.pointerId);}catch{}
  navigator.vibrate?.(10);
  follow();
 }
 function follow(){
  const {tile}=drag;
  // Where would the window sit with no transform? Compute from its layout box.
  tile.style.transform='none';
  const base=tile.getBoundingClientRect();
  tile.style.transform=`translate(${drag.x-drag.grabX-base.left}px,${drag.y-drag.grabY-base.top}px) scale(1.02)`;
 }
 function reorderUnderPointer(){
  const {tile}=drag;
  const others=tiles().filter(t=>t!==tile);
  // Hit-test against layout boxes, not on-screen boxes: windows that are still
  // gliding to a new slot would otherwise be "hit" at their old position.
  const g=grid.getBoundingClientRect();
  const box=t=>({left:g.left+t.offsetLeft,top:g.top+t.offsetTop,width:t.offsetWidth,height:t.offsetHeight});
  let target=null,r=null;
  for(const other of others){
   const b=box(other);
   if(drag.x>=b.left&&drag.x<=b.left+b.width&&drag.y>=b.top&&drag.y<=b.top+b.height){target=other;r=b;break;}
  }
  if(!target)return;
  const list=tiles(),from=list.indexOf(tile),to=list.indexOf(target);
  // Only commit once the pointer passes the middle of the window it is over, so tiles don't flicker.
  const right=r.left+r.width,bottom=r.top+r.height;
  const pastMiddle=from<to?(drag.x>r.left+r.width*.5||drag.y>r.top+r.height*.6):(drag.x<right-r.width*.5||drag.y<bottom-r.height*.6);
  if(!pastMiddle)return;
  const before=snapshot();
  if(from<to)target.after(tile);else target.before(tile);
  animateFrom(before,tile);
 }
 let autoScroll=0;
 function scrollLoop(){
  if(!drag?.lifted){autoScroll=0;return;}
  const edge=70,y=drag.y,h=window.innerHeight;
  const speed=y<edge?-(edge-y)/3:y>h-edge?(y-(h-edge))/3:0;
  if(speed){window.scrollBy(0,speed);follow();}
  autoScroll=requestAnimationFrame(scrollLoop);
 }
 window.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  drag.x=event.clientX;drag.y=event.clientY;
  const moved=Math.hypot(drag.x-drag.x0,drag.y-drag.y0);
  if(!drag.lifted){
   if(drag.type==='touch'){if(moved>MOVE_SLOP*2){clearTimeout(drag.timer);drag=null;}return;}
   if(moved<MOVE_SLOP)return;
   lift();
   if(!autoScroll)autoScroll=requestAnimationFrame(scrollLoop);
  }
  event.preventDefault();
  if(!autoScroll)autoScroll=requestAnimationFrame(scrollLoop);
  reorderUnderPointer();follow();
 },{passive:false});
 // While a window is lifted on a touch screen, stop the page from scrolling under the finger.
 document.addEventListener('touchmove',event=>{if(drag?.lifted)event.preventDefault();},{passive:false});
 function endDrag(cancelled=false){
  if(!drag)return;
  clearTimeout(drag.timer);
  const {tile,lifted}=drag;drag=null;
  cancelAnimationFrame(autoScroll);autoScroll=0;
  if(!lifted)return;
  // Glide from the pointer position into the window's new slot.
  const from=tile.getBoundingClientRect();
  tile.style.transform='';
  tile.classList.remove('is-lifted');document.body.classList.remove('is-arranging','is-dragging');
  const to=tile.getBoundingClientRect();
  if(!reduceMotion.matches)tile.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px)`},{transform:'none'}],{duration:ANIM_MS,easing:'cubic-bezier(.2,.7,.2,1)'});
  dragJustEnded=true;setTimeout(()=>{dragJustEnded=false;},0);
  if(!cancelled){saveOrder();say(`${nameOf(tile)} moved to position ${tiles().indexOf(tile)+1} of ${tiles().length}.`);}
 }
 window.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointerId)endDrag();});
 window.addEventListener('pointercancel',event=>{if(drag&&event.pointerId===drag.pointerId)endDrag();});
 // A completed drag must not also count as a click that opens the report.
 grid.addEventListener('click',event=>{if(dragJustEnded){event.preventDefault();event.stopImmediatePropagation();}},true);
 grid.addEventListener('contextmenu',event=>{if(drag?.type==='touch')event.preventDefault();});

 window.gridironArrange={fit:fitRows,reset:resetLayout,get order(){return tiles().map(idOf);},DEFAULT_ORDER};
})();
