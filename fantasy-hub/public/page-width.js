/* Page width: live resizing from a small fixed-position panel.
   The panel is pinned to the viewport while open, so the page can narrow or widen
   underneath the slider without moving the control away from the pointer. */
'use strict';
(()=>{
 const toggle=document.getElementById('page-width-toggle'),panel=document.getElementById('page-width-panel');
 const slider=document.getElementById('page-width'),field=document.getElementById('page-width-value'),readout=document.getElementById('page-width-readout');
 const KEY='gridiron86-page-width';
 // Blank or non-numeric entries keep the current width instead of jumping to 100%.
 const clamp=value=>{const n=String(value??'').trim()===''?NaN:Number(value);return Math.round(Math.min(100,Math.max(60,Number.isFinite(n)?n:Number(slider.value)||100)));};
 let frame=0,pendingResize=false;
 // Layout-heavy listeners (charts) hear about the change once per animation frame.
 const announceResize=()=>{if(pendingResize)return;pendingResize=true;frame=requestAnimationFrame(()=>{pendingResize=false;window.dispatchEvent(new Event('resize'));});};
 function apply(value,{save=true,fromField=false}={}){
  const width=clamp(value);
  slider.value=String(width);
  if(!fromField)field.value=String(width);
  slider.setAttribute('aria-valuetext',`${width} percent`);
  readout.textContent=`${width}%`;
  document.documentElement.style.setProperty('--page-width',width+'%');
  for(const preset of panel.querySelectorAll('[data-width]'))preset.setAttribute('aria-pressed',String(Number(preset.dataset.width)===width));
  if(save)try{localStorage.setItem(KEY,String(width));}catch{}
  announceResize();
 }
 try{apply(localStorage.getItem(KEY)||100,{save:false});}catch{apply(100,{save:false});}

 function place(){
  const r=toggle.getBoundingClientRect(),w=panel.offsetWidth||260;
  panel.style.top=`${Math.round(r.bottom+6)}px`;
  panel.style.left=`${Math.round(Math.min(window.innerWidth-w-8,Math.max(8,r.right-w)))}px`;
 }
 function open(){panel.hidden=false;toggle.setAttribute('aria-expanded','true');place();slider.focus();}
 function close({restore=true}={}){if(panel.hidden)return;panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(restore)toggle.focus();}
 toggle.addEventListener('click',()=>panel.hidden?open():close());
 window.addEventListener('scroll',()=>{if(!panel.hidden)close({restore:false});},{passive:true});
 document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target))close({restore:false});});
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
 panel.addEventListener('focusout',event=>{if(!panel.hidden&&event.relatedTarget&&!panel.contains(event.relatedTarget)&&event.relatedTarget!==toggle)close({restore:false});});

 // Page Up/Down move a full 10% (the native step is 10% of the range, i.e. 4%).
 slider.addEventListener('keydown',event=>{if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();apply(Number(slider.value)+(event.key==='PageUp'?10:-10));}});
 // Real time: every slider movement resizes the page immediately.
 slider.addEventListener('input',()=>apply(slider.value));
 field.addEventListener('input',()=>{const n=Number(field.value);if(field.value!==''&&n>=60&&n<=100)apply(n,{fromField:true});});
 field.addEventListener('change',()=>apply(field.value));
 field.addEventListener('blur',()=>{if(field.value!==slider.value)apply(field.value);});
 field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply(field.value);}});
 for(const preset of panel.querySelectorAll('[data-width]'))preset.addEventListener('click',()=>apply(preset.dataset.width));

 // Public hooks for keyboard shortcuts.
 window.gridironPageWidth={open,close,step:delta=>apply(Number(slider.value)+delta),set:value=>apply(value),get value(){return Number(slider.value);}};
})();
