import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// The pure half of shortcuts.js (registry, router, fuzzy match, spatial picking)
// runs without a DOM; the page wiring exits early when there is no document.
const source=readFileSync(new URL('../public/shortcuts.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../public/workspace.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source,context);
const K=context.GridironKeys;
const key=(k,mods={})=>({key:k,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,keyCode:0,getModifierState:()=>false,...mods});
const on={enabled:true,editing:false,pending:null,modal:null};
const r=(k,mods,ctx)=>{const out=K.route(key(k,mods),{...on,...ctx});return out&&JSON.parse(JSON.stringify(out));};

test('every report in the report bar has exactly one go-to letter',()=>{
 const ids=[...workspace.matchAll(/\['([a-z-]+)','[^']+','[^']+'\]/g)].map(m=>m[1]);
 assert.ok(ids.length>=16);
 const mapped=K.REPORT_KEYS.map(([,id])=>id);
 assert.deepEqual([...mapped].sort(),[...ids].sort(),'go-to letters cover the report bar, nothing more');
 const letters=K.REPORT_KEYS.map(([l])=>l);
 assert.equal(new Set(letters).size,letters.length,'letters are unique');
 for(const [letter] of K.REPORT_KEYS)assert.match(letter,/^[a-z]$/);
});
test('the registry is the single source: unique single keys, known groups, labels for all',()=>{
 const singles=K.SHORTCUTS.filter(s=>s.key).map(s=>s.key);
 assert.equal(new Set(singles).size,singles.length,'no single key is bound twice');
 assert.ok(!singles.includes('g'),'g is reserved for sequences');
 for(const s of K.SHORTCUTS){
  assert.ok(K.GROUPS.includes(s.group),`${s.id} has a known group`);
  assert.ok(s.label&&s.keys?.length,`${s.id} is documented`);
 }
 const help=K.helpModel('');
 assert.deepEqual(help.map(g=>g.group),K.GROUPS);
 assert.equal(help.reduce((n,g)=>n+g.items.length,0),K.SHORTCUTS.length,'help lists every registered shortcut');
});
test('the help filter narrows the documented list',()=>{
 const week=K.helpModel('week').flatMap(g=>g.items.map(i=>i.label));
 assert.ok(week.includes('Previous week')&&week.includes('Next week'));
 assert.ok(!week.includes('Trades'));
 assert.equal(K.helpModel('zzzz-nothing').length,0);
});
test('single keys and go-to sequences route to commands',()=>{
 assert.deepEqual(r('?'),{id:'help'});
 assert.deepEqual(r('/'),{id:'search'});
 assert.deepEqual(r('['),{id:'prev-report'});
 assert.deepEqual(r(']'),{id:'next-report'});
 assert.deepEqual(r(','),{id:'prev-week'});
 assert.deepEqual(r('.'),{id:'next-week'});
 assert.deepEqual(r('t'),{id:'team'});
 assert.deepEqual(r('w'),{id:'width'});
 assert.deepEqual(r('g'),{pending:'g'});
 assert.deepEqual(r('m',{},{pending:'g'}),{id:'goto',arg:'matchup'});
 assert.deepEqual(r('d',{},{pending:'g'}),{id:'goto',arg:'dashboard'});
 assert.deepEqual(r('x',{},{pending:'g'}),{id:'goto',arg:'trade'});
 assert.deepEqual(r('9',{},{pending:'g'}),{id:'cancel-pending'});
 assert.deepEqual(r('G',{},{}),{pending:'g'},'Caps Lock still works');
 assert.equal(r('q'),null,'unbound keys pass through');
});
test('Ctrl/Cmd+K always opens the palette; other chords are left to the browser',()=>{
 assert.deepEqual(r('k',{ctrlKey:true}),{id:'palette'});
 assert.deepEqual(r('k',{metaKey:true}),{id:'palette'});
 assert.deepEqual(r('k',{ctrlKey:true},{enabled:false}),{id:'palette'},'works when single keys are off');
 assert.deepEqual(r('k',{ctrlKey:true},{editing:true}),{id:'palette'},'works from a text field');
 assert.deepEqual(r('k',{metaKey:true},{modal:'palette'}),{id:'palette'},'toggles the palette');
 assert.equal(r('k',{ctrlKey:true},{modal:'other'}),null,'does not stack over another dialog');
 for(const [k,mods] of [['l',{metaKey:true}],['ArrowLeft',{altKey:true}],['ArrowRight',{altKey:true}],['g',{ctrlKey:true}],['?',{altKey:true}],['k',{ctrlKey:true,shiftKey:true}]])assert.equal(r(k,mods),null,`${k} with modifiers is native`);
 assert.equal(r('Tab'),null);
 assert.equal(r('Shift',{shiftKey:true}),null);
});
test('typing, the off switch and open dialogs suppress single keys but not Escape',()=>{
 for(const k of ['g','?','/','t',',','[']){
  assert.equal(r(k,{},{editing:true}),null,`${k} while typing`);
  assert.equal(r(k,{},{enabled:false}),null,`${k} while off`);
  assert.equal(r(k,{},{modal:'other'}),null,`${k} under a dialog`);
 }
 assert.deepEqual(r('Escape',{},{editing:true}),{id:'escape'});
 assert.deepEqual(r('Escape',{},{enabled:false}),{id:'escape'});
 assert.deepEqual(r('?',{},{modal:'help'}),{id:'help'},'? closes help again');
 assert.equal(r('m',{},{pending:'g',editing:true}),null);
 assert.equal(r('a',{isComposing:true}),null,'IME composition is never intercepted');
});
test('fuzzy matching ranks prefixes, word starts, then subsequences',()=>{
 const s=K.fuzzyScore;
 assert.ok(s('mat','Matchup')>s('mat','Automatic'));
 assert.ok(s('mc','Christian McCaffrey')>0);
 assert.ok(s('cmc','Christian McCaffrey')>0,'initials match as a subsequence');
 assert.ok(s('allen','Josh Allen')>s('allen','Gallen Smith'));
 assert.equal(s('xyz','Matchup'),0);
 assert.equal(s('josh','Jaden Vickers HOU Sunday Strikers',{subsequence:false}),0,'detail text needs real substrings');
 assert.ok(s('week 3','Week 3')>s('week 3','Week 13'));
 assert.equal(s('','anything'),1);
});
test('spatial navigation picks the nearest window in the arrow direction',()=>{
 const R=(l,t,w=100,h=100)=>({left:l,top:t,right:l+w,bottom:t+h});
 // 3x2 grid plus a wide item spanning the bottom.
 const rects=[R(0,0),R(110,0),R(220,0),R(0,110),R(110,110),R(220,110),R(0,220,320,60)];
 assert.equal(K.pickInDirection(rects[0],rects,'right'),1);
 assert.equal(K.pickInDirection(rects[1],rects,'down'),4);
 assert.equal(K.pickInDirection(rects[4],rects,'left'),3);
 assert.equal(K.pickInDirection(rects[5],rects,'up'),2);
 assert.equal(K.pickInDirection(rects[4],rects,'down'),6,'wide window below');
 assert.equal(K.pickInDirection(rects[6],rects,'up'),4,'back up to the aligned centre');
 assert.equal(K.pickInDirection(rects[2],rects,'right'),-1,'edge stays put');
 assert.equal(K.pickInDirection(rects[0],rects,'up'),-1);
});
test('row movement clamps at the ends and supports j/k, Home/End and paging',()=>{
 const n=K.nextIndex;
 assert.equal(n(0,5,'ArrowDown'),1);assert.equal(n(4,5,'ArrowDown'),4);
 assert.equal(n(0,5,'ArrowUp'),0);assert.equal(n(2,5,'k'),1);assert.equal(n(2,5,'j'),3);
 assert.equal(n(3,5,'Home'),0);assert.equal(n(0,5,'End'),4);
 assert.equal(n(0,30,'PageDown'),10);assert.equal(n(5,30,'PageUp'),0);
 assert.equal(n(-1,5,'ArrowDown'),0);assert.equal(n(-1,5,'ArrowUp'),4);
 assert.equal(n(0,0,'ArrowDown'),-1);assert.equal(n(0,5,'x'),-1);
});
test('display text for chords and go-to hints',()=>{
 assert.equal(K.chordText('Mod+K'),'Ctrl+K');
 assert.equal(K.chordText('Mod+K',true),'⌘K');
 assert.equal(K.goKeys('matchup'),'G then M');
 assert.equal(K.goKeys('nope'),'');
 assert.equal(K.keysText(K.SHORTCUTS.find(s=>s.id==='goto'&&s.arg==='trade')),'G then X');
});
test('the help dialog markup has a filter, a list host and the WCAG 2.1.4 switch',()=>{
 const dialog=html.slice(html.indexOf('<dialog id="shortcuts-dialog"'),html.indexOf('</dialog>',html.indexOf('<dialog id="shortcuts-dialog"')));
 for(const id of ['shortcuts-filter','shortcuts-list','shortcuts-enabled','shortcuts-count'])assert.ok(dialog.includes(`id="${id}"`),id);
 assert.ok(!/GO TO/.test(dialog),'help no longer mentions the removed GO TO menu');
 assert.ok(html.indexOf('keyboard.css')>html.indexOf('terminal.css'),'keyboard styles load last');
 assert.ok(html.indexOf('shortcuts.js')>html.indexOf('workspace.js'),'shortcuts load after the workspace');
});
