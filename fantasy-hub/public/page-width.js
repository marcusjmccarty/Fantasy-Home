/* Page margins remain independent of the browser's native zoom. */
'use strict';
(()=>{
 const input=document.getElementById('page-width'),output=document.getElementById('page-width-value');
 const apply=value=>{const width=Math.min(100,Math.max(60,Number(value)||100));input.value=String(width);output.textContent=width+'%';document.documentElement.style.setProperty('--page-width',width+'%');window.dispatchEvent(new Event('resize'));};
 try{apply(localStorage.getItem('gridiron86-page-width')||100);}catch{apply(100);}
 input.addEventListener('input',()=>apply(input.value));
 input.addEventListener('change',()=>{try{localStorage.setItem('gridiron86-page-width',input.value);}catch{}});
})();
