import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/workspace.js',import.meta.url),'utf8');
const explorer=readFileSync(new URL('../public/explorer.js',import.meta.url),'utf8');
// Exercise the production navigation and report lifecycle with a minimal DOM.
// This checks state transitions, not browser layout or native focus behaviour.
function setup(hash=''){
 const nodes=new Map(),winEvents=new Map(),docEvents=new Map(),queue=[],renders=[],entries=[];let active=null,scrollY=0;
 class Element{
  constructor(id){this.id=id;this.dataset={};this.attributes={};this.listeners={};this.style={};this.hidden=false;this.open=false;this.modal=false;this.children=[];this.scrollLeft=0;this.scrollWidth=600;this.clientWidth=600;this.offsetLeft=0;this.offsetWidth=100;this.tabIndex=0;this.isConnected=true;}
  setAttribute(k,v){this.attributes[k]=String(v)}
  removeAttribute(k){delete this.attributes[k]}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
  fire(k,extra={}){const e={target:this,prevented:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){},...extra};for(const fn of this.listeners[k]||[])fn(e);return e}
  focus(){active=this}
  closest(sel){return sel==='[data-workspace]'?(this.dataset.workspace?this:null):sel==='.win'?null:this}
  matches(sel){return sel===':modal'?this.modal:false}
  getBoundingClientRect(){return {top:200-scrollY}}
  querySelectorAll(){return this.children}
  querySelector(sel){return get(sel)}
  insertBefore(node){node.parentElement=this;return node}
  get classList(){const el=this;return this._cl??={set:new Set(),add(c){this.set.add(c)},remove(c){this.set.delete(c)},contains(c){return this.set.has(c)},toggle(c,f){(f??!this.set.has(c))?this.set.add(c):this.set.delete(c)}}}
  set innerHTML(html){this.html=html;if(this.id==='workspace-tabs')this.children=[...html.matchAll(/id="([^"]+)" data-workspace="([^"]+)"/g)].map(([_,id,type],i)=>{const n=get(id);n.dataset.workspace=type;n.offsetLeft=i*100;return n})}
  show(){this.open=true;this.modal=false}
  showModal(){this.open=true;this.modal=true}
  close(){this.open=false;this.modal=false;queue.push(()=>this.fire('close'))}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)};
 const body=get('body');body.dataset.layout='dashboard';
 const location={href:'https://hub.example/'+hash,get hash(){return new URL(this.href).hash}};
 const history={state:null,
  pushState(state,_,url){entries.splice(this.index+1);entries.push({state,url:String(url)});this.index=entries.length-1;this.state=state;location.href=String(url)},
  replaceState(state,_,url){entries[this.index]={state,url:String(url)};this.state=state;location.href=String(url)},
  go(step){const i=this.index+step;if(i<0||i>=entries.length)return;this.index=i;this.state=entries[i].state;location.href=entries[i].url;for(const fn of winEvents.get('popstate')||[])fn({state:this.state})},
  index:0};
 entries.push({state:null,url:location.href});
 const document={body,get activeElement(){return active||body},querySelector:get,addEventListener(k,fn){(docEvents.get(k)||docEvents.set(k,[]).get(k)).push(fn)},dispatchEvent(e){for(const fn of docEvents.get(e.type)||[])fn(e)}};
 const window={addEventListener(k,fn){(winEvents.get(k)||winEvents.set(k,[]).get(k)).push(fn)},scrollTo(_,y){scrollY=y},get scrollY(){return scrollY}};
 const XL={open:null,player:null,viewWeek:null,history:[],future:[],lineupScenarios:new Map(),free:[]};
 const context=vm.createContext({ResizeObserver:class{observe(){}},document,window,location,history,URL,el:get,XL,currentTeamId:'1',currentPlayerId:'p1',currentWeek:6,model:{season:2026,teams:[{id:'1'},{id:'2'},{id:'3'}],players:{p1:{id:'p1'}}},findTeam:id=>({id:String(id)}),updateUI(){},getTeam:()=>({id:'1'}),rowsFor:()=>[{id:'p1'}],explorerClubHeader(){},renderExplorer(){renders.push(XL.open)},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}}});
 vm.runInContext(explorer.slice(explorer.indexOf('function openExplorer('),explorer.indexOf('function focusWeeklyLedger()')),context);
 vm.runInContext(explorer.slice(explorer.indexOf('function exploreBack('),explorer.indexOf('function refreshMatchupHeader(')),context);
 vm.runInContext(explorer.slice(explorer.indexOf("el('explore-club').addEventListener('change'"),explorer.indexOf("el('explore-content').addEventListener('change'",explorer.indexOf("el('explore-club').addEventListener('change'"))),context);
 // Same queued close handling as the production dialog listener.
 get('explore-dialog').addEventListener('close',()=>{if(get('explore-dialog').open)return;XL.open=null;XL.viewWeek=null;XL.history=[];XL.future=[];XL.viewTeamId=null;XL.lineupScenarios.clear()});
 vm.runInContext(source,context);
 const tab=id=>get(`workspace-tab-${id}`);
 return {get,body,XL,renders,history,location,tab,run:code=>vm.runInContext(code,context),flush(){while(queue.length)queue.shift()()},active:()=>active,click:id=>get('workspace-tabs').fire('click',{target:tab(id)})};
}
const current=h=>h.get('workspace-tabs').children.filter(t=>t.attributes['aria-current']==='page').map(t=>t.dataset.workspace);

test('the dashboard is the default view and the report bar lists it first',()=>{
 const h=setup();
 assert.equal(h.body.dataset.layout,'dashboard');assert.equal(h.get('explore-dialog').open,false);
 assert.equal(h.get('workspace-tabs').children[0].dataset.workspace,'dashboard');
 assert.deepEqual(current(h),['dashboard']);
});
test('every report opens inline from the report bar with exactly one current item',()=>{
 const h=setup();
 for(const button of h.get('workspace-tabs').children.slice(1)){
  h.click(button.dataset.workspace);
  assert.equal(h.XL.open,button.dataset.workspace);assert.equal(h.renders.at(-1),button.dataset.workspace);
  assert.equal(h.get('explore-dialog').open,true);assert.equal(h.get('explore-dialog').modal,false);
  assert.equal(h.body.dataset.layout,'tabbed');assert.equal(h.get('.window-grid').hidden,true);
  assert.deepEqual(current(h),[button.dataset.workspace]);
 }
});
test('expanding a dashboard window opens a floating window; tabs open the inline view',()=>{
 const h=setup();h.run("openExplorer('weekly')");
 assert.equal(h.get('explore-dialog').modal,true);assert.equal(h.body.dataset.layout,'dashboard');
 assert.equal(h.location.hash,'');
 h.get('explore-dialog').close();h.flush();
 h.click('weekly');assert.equal(h.get('explore-dialog').modal,false);assert.equal(h.body.dataset.layout,'tabbed');
 assert.equal(h.location.hash,'#/weekly');
 assert.equal(h.get('workspace-navigation').parentElement,h.get('#explore-dialog .explore-title-bar'));
 h.click('dashboard');assert.equal(h.get('workspace-navigation').parentElement,h.get('.menu-bar'));
});
test('closing a report returns to the dashboard and the window grid',()=>{
 const h=setup();h.click('roster');h.get('explore-dialog').close();h.flush();
 assert.equal(h.body.dataset.layout,'dashboard');assert.equal(h.get('.window-grid').hidden,false);
 assert.equal(h.XL.open,null);assert.deepEqual(current(h),['dashboard']);assert.equal(h.location.hash,'');
 h.click('dashboard');assert.equal(h.body.dataset.layout,'dashboard');
});
test('browser Back and Forward walk reports, drilldowns and the dashboard in order',()=>{
 const h=setup();h.click('matchup');h.click('trade');h.run("openExplorer('profile','p1')");
 assert.equal(h.location.hash,'#/profile');
 h.history.go(-1);assert.equal(h.XL.open,'trade');
 h.history.go(-1);assert.equal(h.XL.open,'matchup');
 h.history.go(-1);h.flush();assert.equal(h.body.dataset.layout,'dashboard');assert.equal(h.XL.open,null);
 h.history.go(1);assert.equal(h.XL.open,'matchup');assert.equal(h.body.dataset.layout,'tabbed');
 h.history.go(1);assert.equal(h.XL.open,'trade');
});
test('a #/report address opens that report on load; unknown addresses stay on the dashboard',()=>{
 assert.equal(setup('#/standings').XL.open,'standings');
 assert.equal(setup('#/nope').body.dataset.layout,'dashboard');
});
test('arrow keys move focus along the report bar without opening reports',()=>{
 const h=setup(),tabs=h.get('workspace-tabs').children;
 const press=(target,key)=>h.get('workspace-tabs').fire('keydown',{target,key});
 assert.equal(press(tabs[0],'ArrowLeft').prevented,true);assert.equal(h.active(),tabs.at(-1));
 press(tabs.at(-1),'ArrowRight');assert.equal(h.active(),tabs[0]);
 press(tabs[0],'End');assert.equal(h.active(),tabs.at(-1));press(tabs.at(-1),'Home');assert.equal(h.active(),tabs[0]);
 assert.equal(h.XL.open,null);
});
test('the window franchise selector is independent; in tab view it changes the active franchise',()=>{
 const w=setup();w.run("openExplorer('summary')");
 w.get('explore-club').fire('change',{target:{id:'explore-team-switch',value:'2'}});
 assert.equal(w.run('currentTeamId'),'1');assert.equal(w.XL.viewTeamId,'2');
 const h=setup();h.click('summary');
 h.get('explore-club').fire('change',{target:{id:'explore-team-switch',value:'2'}});
 assert.equal(h.run('currentTeamId'),'2');assert.equal(h.XL.viewTeamId,'2');
 h.run("openExplorer('summary',null,{teamId:'3'})");assert.equal(h.run('currentTeamId'),'3');
});
