/* Page width: a simple always-visible slider in the title bar, like a word
   processor's zoom control. It resizes the page live while dragging. The title
   bar spans the full window and does not change width, so the slider never
   moves out from under the pointer. */
'use strict';
(()=>{
 const slider=document.getElementById('page-width'),readout=document.getElementById('page-width-readout');
 const down=document.getElementById('page-width-down'),up=document.getElementById('page-width-up');
 const KEY='gridiron86-page-width',MIN=60,MAX=100,STEP=5;
 const clamp=value=>{const n=Number(value);return Math.round(Math.min(MAX,Math.max(MIN,Number.isFinite(n)?n:MAX)));};
 let frame=0;
 // Layout-heavy listeners (charts) hear about the change once per animation frame.
 const announceResize=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;window.dispatchEvent(new Event('resize'));});};
 let saveTimer=0;
 function apply(value,{save=true}={}){
  const width=clamp(value);
  slider.value=String(width);
  slider.setAttribute('aria-valuetext',`${width} percent`);
  slider.style.setProperty('--fill',`${(width-MIN)/(MAX-MIN)*100}%`);
  readout.textContent=`${width}%`;
  readout.setAttribute('aria-label',`Page width ${width} percent. Reset to full width`);
  down.disabled=width<=MIN;up.disabled=width>=MAX;
  document.documentElement.style.setProperty('--page-width',width+'%');
  if(save){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,String(width));}catch{}},150);}
  announceResize();
 }
 let saved=null;try{saved=localStorage.getItem(KEY);}catch{}
 apply(saved??MAX,{save:false});
 slider.addEventListener('input',()=>apply(slider.value));
 // Page Up/Down move 10% (the native step would be 10% of the range, i.e. 4%).
 slider.addEventListener('keydown',event=>{
  if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();apply(Number(slider.value)+(event.key==='PageUp'?10:-10));}
 });
 down.addEventListener('click',()=>apply(Number(slider.value)-STEP));
 up.addEventListener('click',()=>apply(Number(slider.value)+STEP));
 readout.addEventListener('click',()=>apply(MAX));
 // Public hooks for keyboard shortcuts (w focuses the slider; - and = step it).
 window.gridironPageWidth={open:()=>slider.focus(),close(){},step:delta=>apply(Number(slider.value)+delta),set:value=>apply(value),get value(){return Number(slider.value);}};
})();
