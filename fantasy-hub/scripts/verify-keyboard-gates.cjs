const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SHORTCUTS_BASE_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage();page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>!r.request().url().startsWith(base+'/')?r.abort():r.request().url().includes('/api/')?r.fulfill({json:{active:false,enabled:false}}):r.continue());
 await page.goto(base);
 for(const mode of ['dashboard','tabbed']){
  await page.locator('#mode-'+mode).click();
  for(const [route,trigger,host] of [['summary','.summary-rank-trigger','#summary-ranking-host'],['profile','.player-rank-trigger','#player-ranking-host'],['positions','.position-rank-trigger','#position-ranking-host']]){
   if(mode==='dashboard')await page.locator('#home-go-to').selectOption(route);else await page.locator('#workspace-tab-'+route).click();
   const opener=page.locator(trigger).first();await opener.click();await page.keyboard.press('?');await page.keyboard.press('Escape');
   assert.equal(await page.locator(host).evaluate(n=>n.hidden),false);
   await page.keyboard.press('Escape');assert.equal(await page.locator(host).evaluate(n=>n.hidden),true);
   assert.equal(await opener.evaluate(n=>n===document.activeElement),true);
   assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),true);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),mode==='tabbed');
  }
 }
 console.log('PASS all three rankings, help stacking, both layouts');
 await page.locator('#mode-dashboard').click();
 for(const id of ['data','about']){
  await page.locator(id==='data'?'#open-data':'#about-button').click();
  const opener=page.locator('#'+id+'-dialog [data-close-dialog]').first();await opener.focus();
  await page.keyboard.press('g');assert.equal(await opener.evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('?');assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.open),true);
  await page.keyboard.down('Escape');await page.keyboard.down('Escape');await page.keyboard.up('Escape');
  assert.equal(await page.locator('#'+id+'-dialog').evaluate(n=>n.open),true);assert.equal(await opener.evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('?');await opener.evaluate(n=>n.inert=true);await page.keyboard.press('Escape');
  await page.waitForFunction(id=>{const n=document.activeElement;return document.getElementById(id+'-dialog').contains(n)&&!n.closest('[inert]')},id);
  await opener.evaluate(n=>n.inert=false);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#'+id+'-dialog').evaluate(n=>n.open),false);
 }
 console.log('PASS help over Data/About, navigation suppression, held Escape');
 for(const state of ['hidden','inert','detached','visibility']){
  await page.reload();await page.locator('#home-go-to').selectOption('summary');
  await page.locator('#explore-dialog [data-shortcuts-help]').click();
  await page.evaluate(state=>{const n=document.querySelector('#explore-dialog [data-shortcuts-help]');if(state==='detached')n.remove();else if(state==='visibility')n.style.visibility='hidden';else n[state]=true},state);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>{const n=document.activeElement;return document.getElementById('explore-dialog').contains(n)&&n.getClientRects().length>0&&!n.closest('[hidden],[inert]')&&getComputedStyle(n).visibility==='visible'});
 }
 console.log('PASS hidden/inert/detached/CSS-hidden help opener recovery');
 await page.reload();await page.locator('#home-go-to').selectOption('opportunity');
 await page.evaluate(()=>{const n=document.getElementById('usage-search');n.value='Josh';n.focus();n.setSelectionRange(2,2);n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('explore-dialog').close();openExplorer('opportunity');const next=document.getElementById('usage-search');next.focus();next.setSelectionRange(0,0)});
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,250)));
 assert.equal(await page.locator('#usage-search').evaluate(n=>n.selectionStart),0);
 console.log('PASS stale usage callback after same-report close/reopen');
 await page.locator('#explore-close').click();
 await page.evaluate(()=>{for(let i=0;i<10;i++){setWorkspaceLayout('dashboard');setWorkspaceLayout('tabbed')}});
 await page.waitForFunction(()=>document.body.dataset.layout==='tabbed'&&document.getElementById('explore-dialog').open&&XL.open==='opportunity');
 await page.locator('#mode-dashboard').click();
 await page.evaluate(()=>{window.openEvents=0;document.addEventListener('workspace:opened',()=>window.openEvents++)});
 for(const key of ['Enter','Space']){
  await page.locator('.summary-window.expandable').focus();await page.keyboard.press(key);
  assert.equal(await page.evaluate(()=>window.openEvents),1);await page.locator('#explore-close').click();await page.evaluate(()=>window.openEvents=0);
 }
 console.log('PASS rapid layouts/queued close, one Enter/Space activation');
 // G is a direct focus action, not a pending multi-key sequence.
 await page.locator('#about-button').focus();await page.keyboard.press('g');await page.locator('[data-shortcuts-help]').first().click();
 await page.locator('#shortcuts-enabled').uncheck();await page.keyboard.press('Escape');await page.locator('#about-button').focus();await page.keyboard.press('/');await page.keyboard.press('g');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'about-button');await page.reload();assert.equal(await page.locator('#shortcuts-enabled').isChecked(),false);
 assert.deepEqual(errors,[]);console.log('PASS opt-out after G/reload; no page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
