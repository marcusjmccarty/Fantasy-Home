/* Commit on release so resizing cannot move a slider underneath the pointer. */
'use strict';
(()=>{
 const slider=document.getElementById('page-width'),field=document.getElementById('page-width-value');
 const clamp=value=>Math.round(Math.min(100,Math.max(60,Number(value)||100)));
 const apply=(value,save=true)=>{const width=clamp(value);slider.value=field.value=String(width);document.documentElement.style.setProperty('--page-width',width+'%');if(save)try{localStorage.setItem('gridiron86-page-width',String(width));}catch{}window.dispatchEvent(new Event('resize'));};
 try{apply(localStorage.getItem('gridiron86-page-width')||100,false);}catch{apply(100,false);}
 slider.addEventListener('input',()=>{field.value=slider.value;});
 slider.addEventListener('change',()=>apply(slider.value));
 field.addEventListener('change',()=>apply(field.value));
 field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();apply(field.value);}});
})();
