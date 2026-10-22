/* Floating metric cards. They cover their trigger without changing the layout. */
'use strict';
function statHelpTile(label,value,description,classes='',direction='down'){
 return `<button type="button" class="stat-help-trigger ${classes}" data-stat-title="${esc(label)}" data-stat-help="${esc(description)}" data-stat-direction="${direction}" aria-expanded="false"><span>${esc(label)}</span><strong>${value}</strong></button>`;
}
let openMetricHelp=null;
function closeStatHelp(restore=false){
 if(!openMetricHelp)return;const {card,trigger}=openMetricHelp;openMetricHelp=null;card.remove();trigger.setAttribute('aria-expanded','false');if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});
}
function showStatHelp(trigger){
 closeStatHelp();const rect=trigger.getBoundingClientRect(),card=document.createElement('section'),margin=12;
 card.className='metric-popover';card.setAttribute('role','dialog');card.setAttribute('aria-label',trigger.dataset.statTitle);card.tabIndex=-1;
 card.innerHTML=`<header>${esc(trigger.dataset.statTitle)}</header><strong>${esc(trigger.querySelector('strong,b')?.textContent||'')}</strong><p>${esc(trigger.dataset.statHelp)}</p>`;
 card.style.setProperty('--metric-accent',getComputedStyle(trigger).getPropertyValue('--metric-accent')||getComputedStyle(trigger).borderTopColor);
 const width=Math.min(Math.max(rect.width,260),innerWidth-margin*2);card.style.width=width+'px';card.style.minHeight=rect.height+'px';card.style.left=Math.max(margin,Math.min(rect.left,innerWidth-margin-width))+'px';
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
document.addEventListener('keydown',event=>{if(openMetricHelp&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeStatHelp(true);}},true);
document.addEventListener('scroll',event=>{if(openMetricHelp&&!openMetricHelp.card.contains(event.target))closeStatHelp();},true);
window.addEventListener('resize',()=>closeStatHelp());
