import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/workspace.js',import.meta.url),'utf8');
const explorer=readFileSync(new URL('../public/explorer.js',import.meta.url),'utf8');
// Exercise the production navigation and dialog lifecycle with a minimal DOM.
// This checks state transitions, not browser layout or native focus behavior.
function setup(saved=null,blocked=false){
 const nodes=new Map(),events=new Map(),queue=[],renders=[];let active;
 class Element{
  constructor(id){this.id=id;this.dataset={};this.attributes={};this.listeners={};this.style={};this.hidden=false;this.open=false;this.children=[];this.scrollLeft=0;this.clientWidth=600;this.offsetLeft=0;this.offsetWidth=100;}
  setAttribute(k,v){this.attributes[k]=String(v)}
  removeAttribute(k){delete this.attributes[k]}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
  fire(k,extra={}){const e={target:this,preventDefault(){this.prevented=true},...extra};for(const fn of this.listeners[k]||[])fn(e);return e}
  focus(){active=this}
  closest(){return this}
  querySelectorAll(){return this.children}
  set innerHTML(html){this.html=html;if(this.id==='workspace-tabs')this.children=[...html.matchAll(/id="([^"]+)" data-workspace="([^"]+)"/g)].map(([_,id,type],i)=>{const n=get(id);n.dataset.workspace=type;n.offsetLeft=i*100;return n})}
  show(){this.open=true;this.modal=false}
  showModal(){this.open=true;this.modal=true}
  close(){this.open=false;this.modal=false;queue.push(()=>this.fire('close'))}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)};
 const modes=['dashboard','tabbed'].map(id=>{const n=get(`mode-${id}`);n.dataset.layout=id;return n});
 const body=get('body');
 const document={body,querySelector:get,querySelectorAll:()=>modes,addEventListener(k,fn){(events.get(k)||events.set(k,[]).get(k)).push(fn)},dispatchEvent(e){for(const fn of events.get(e.type)||[])fn(e)}};
 const storage=new Map(saved?[['gridiron86-workspace-v1',JSON.stringify(saved)]]:[]);
 const XL={open:null,player:null,viewWeek:null,history:[],future:[],lineupScenarios:new Map(),free:[]};
 const context=vm.createContext({document,localStorage:{getItem(k){if(blocked)throw Error('blocked');return storage.get(k)},setItem(k,v){if(blocked)throw Error('blocked');storage.set(k,v)}},el:get,XL,currentTeamId:'1',currentPlayerId:'p1',currentWeek:6,model:{season:2026,players:{p1:{id:'p1'}}},getTeam:()=>({id:'1'}),rowsFor:()=>[{id:'p1'}],explorerClubHeader(){},renderExplorer(){renders.push(XL.open)},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}}});
 vm.runInContext(explorer.slice(explorer.indexOf('function openExplorer('),explorer.indexOf('function focusWeeklyLedger()')),context);
 // Same queued close handling as the production dialog listener.
 get('explore-dialog').addEventListener('close',()=>{if(get('explore-dialog').open)return;XL.open=null;XL.viewWeek=null;XL.history=[];XL.future=[];XL.viewTeamId=null;XL.lineupScenarios.clear()});
 vm.runInContext(source,context);
 return {get,body,XL,storage,renders,run:code=>vm.runInContext(code,context),flush(){while(queue.length)queue.shift()()},active:()=>active};
}
test('Dashboard remains default; Tabbed opens a nonmodal full report and hides tiles',()=>{
 const h=setup();assert.equal(h.body.dataset.layout,'dashboard');assert.equal(h.get('explore-dialog').open,false);
 h.get('mode-tabbed').fire('click');h.flush();
 assert.equal(h.get('.window-grid').hidden,true);assert.equal(h.get('.dossiers-section').hidden,true);
 assert.equal(h.get('explore-dialog').open,true);assert.equal(h.get('explore-dialog').modal,false);assert.equal(h.XL.open,'summary');
 assert.equal(h.get('explore-content').attributes.role,'tabpanel');
});
test('every tab renders its existing report with exactly one selected tab',()=>{
 const h=setup({layout:'tabbed',tab:'summary'});
 for(const tab of h.get('workspace-tabs').children){
  h.get('workspace-tabs').fire('click',{target:tab});
  assert.equal(h.XL.open,tab.dataset.workspace);assert.equal(h.renders.at(-1),tab.dataset.workspace);
  assert.equal(h.get('workspace-tabs').children.filter(t=>t.attributes['aria-selected']==='true').length,1);
  assert.equal(h.get('explore-content').attributes['aria-labelledby'],tab.id);
 }
});
test('rapid mode switches cannot let queued close events clear the active report',()=>{
 const h=setup({layout:'tabbed',tab:'roster'});
 h.get('mode-dashboard').fire('click');h.get('mode-tabbed').fire('click');h.flush();
 assert.equal(h.XL.open,'roster');assert.equal(h.get('explore-dialog').open,true);
 h.get('mode-dashboard').fire('click');h.flush();h.run("openExplorer('matchup')");
 assert.equal(h.get('explore-dialog').modal,true);assert.equal(h.get('.window-grid').hidden,false);
});
test('modal-to-tabbed transition removes top-layer modality',()=>{
 const h=setup();h.run("openExplorer('weekly')");assert.equal(h.get('explore-dialog').modal,true);
 h.get('mode-tabbed').fire('click');h.flush();assert.equal(h.XL.open,'weekly');assert.equal(h.get('explore-dialog').modal,false);
});
test('saved layout and report restore, invalid preferences and blocked storage are safe',()=>{
 assert.equal(setup({layout:'tabbed',tab:'agents'}).XL.open,'agents');
 assert.equal(setup({layout:'tabbed',tab:'not-a-report'}).XL.open,'summary');
 assert.equal(setup(null,true).body.dataset.layout,'dashboard');
 const h=setup(null,true);h.get('mode-tabbed').fire('click');assert.equal(h.XL.open,'summary');
});
test('arrow navigation wraps and Home/End select the first/last report',()=>{
 const h=setup({layout:'tabbed',tab:'summary'}),tabs=h.get('workspace-tabs').children;
 const press=(target,key)=>h.get('workspace-tabs').fire('keydown',{target,key});
 assert.equal(press(tabs[0],'ArrowLeft').prevented,true);assert.equal(h.XL.open,'graph');assert.equal(h.active(),tabs.at(-1));
 press(tabs.at(-1),'ArrowRight');assert.equal(h.XL.open,'summary');
 press(tabs[0],'End');assert.equal(h.XL.open,'graph');press(tabs.at(-1),'Home');assert.equal(h.XL.open,'summary');
});
test('player drilldowns synchronize the active tab and Escape leaves inline reports open',()=>{
 const h=setup({layout:'tabbed',tab:'roster'});h.run("openExplorer('profile','p1')");
 assert.equal(h.XL.player,'p1');assert.equal(h.get('workspace-tab-profile').attributes['aria-selected'],'true');
 assert.equal(h.get('explore-dialog').fire('cancel').prevented,true);
 assert.equal(JSON.parse(h.storage.get('gridiron86-workspace-v1')).tab,'profile');
});
