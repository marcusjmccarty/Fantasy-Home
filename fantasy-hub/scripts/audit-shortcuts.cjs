const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SHORTCUTS_BASE_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const context=await browser.newContext();
 await context.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(base+'/'))return route.abort();if(url.includes('/api/'))return route.fulfill({json:{active:false,enabled:false}});return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);
 const routes=await page.evaluate(()=>WORKSPACE_TABS.map(([id])=>id));
 const search={agents:'agent-search',opportunity:'usage-search',graph:'graph-search'};
 for(const mode of ['dashboard','tabbed']){
  await page.locator('#mode-'+mode).click();
  for(const route of routes){
   // Exercise real select change handlers; the report help button is visible in both modes.
   if(mode==='dashboard')await page.locator('#home-go-to').selectOption('summary');
   if(mode==='dashboard')await page.locator('#explore-jump').selectOption(route);
   else await page.locator('#workspace-tab-'+route).click();
   const helpButton=page.locator('#explore-dialog [data-shortcuts-help]');await helpButton.focus();
   await page.keyboard.press('g');assert.equal(await page.evaluate(()=>document.activeElement.id),mode==='tabbed'?'workspace-tab-'+route:'explore-jump');
   await page.keyboard.press('/');assert.equal(await page.evaluate(()=>document.activeElement.id),mode==='tabbed'?(search[route]||'workspace-tab-'+route):'explore-jump','G then / respects selects and tab scope');
   await helpButton.focus();await page.keyboard.press('/');
   if(search[route]){
    assert.equal(await page.evaluate(()=>document.activeElement.id),search[route]);
    await page.keyboard.type('g/?');assert.equal(await page.locator('#'+search[route]).inputValue(),'g/?');
    await page.locator('#'+search[route]).fill('');
   }else assert.equal(await helpButton.evaluate(n=>n===document.activeElement),true,route+' has no search');
   await helpButton.focus();await page.keyboard.press('?');await page.keyboard.press('Escape');
   assert.equal(await helpButton.evaluate(n=>n===document.activeElement),true,route+' help returns focus');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),mode==='tabbed',route+' Escape respects layout');
   console.log('PASS',mode,route);
  }
 }
 // Opt-out should survive reload without touching workspace preferences.
 await page.locator('[data-shortcuts-help]').first().click();
 const workspace=await page.evaluate(()=>localStorage.getItem('gridiron86-workspace-v2'));
 await page.locator('#shortcuts-enabled').uncheck();
 assert.equal(await page.evaluate(()=>localStorage.getItem('gridiron86-workspace-v2')),workspace);
 await page.reload();assert.equal(await page.locator('#shortcuts-enabled').isChecked(),false,'opt-out survives reload');
 await page.locator('#about-button').focus();await page.keyboard.press('?');await page.keyboard.press('g');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'about-button');
 await page.locator('[data-shortcuts-help]').first().click();await page.locator('#shortcuts-enabled').check();await page.reload();
 assert.equal(await page.locator('#shortcuts-enabled').isChecked(),true);
 console.log('PASS opt-out, reload, re-enable, workspace storage isolation');
 // A real report rerender can remove the opener while native help stays open.
 await page.locator('#workspace-tab-summary').click();
 await page.locator('.summary-rank-trigger').first().focus();await page.keyboard.press('?');
 await page.evaluate(()=>renderExplorer());await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.activeElement.matches('#explore-dialog [data-shortcuts-help]'));
 console.log('PASS focus fallback after report rerender');
 // Debounced results must not reclaim focus after a user moves to another control.
 await page.locator('#workspace-tab-opportunity').click();
 await page.evaluate(()=>{const input=document.getElementById('usage-search');input.focus();input.value='a';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#explore-dialog [data-shortcuts-help]').focus();});
 await page.waitForFunction(()=>STRATEGY.search==='a');
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,250))); // exceeds the 170ms input debounce
 assert.equal(await page.locator('#explore-dialog [data-shortcuts-help]').evaluate(n=>n===document.activeElement),true);
 await page.locator('#usage-search').fill('Josh');
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,250)));
 assert.equal(await page.evaluate(()=>document.activeElement.id),'usage-search');
 assert.equal(await page.locator('#usage-search').inputValue(),'Josh');
 console.log('PASS usage results preserve active search and respect moved focus');

 assert.deepEqual(errors,[]);
 // Privacy-restricted storage still permits a page-local opt-out.
 const restricted=await context.newPage();restricted.on('pageerror',error=>errors.push(error.message));
 await restricted.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
 await restricted.goto(base);await restricted.locator('[data-shortcuts-help]').first().click();await restricted.locator('#shortcuts-enabled').uncheck();await restricted.keyboard.press('Escape');
 await restricted.locator('#about-button').focus();await restricted.keyboard.press('g');assert.equal(await restricted.evaluate(()=>document.activeElement.id),'about-button');
 console.log('PASS blocked storage fallback');
 // Held Escape dismisses one layer per physical press, not the entire stack.
 await page.locator('#mode-dashboard').click();await page.locator('#home-go-to').selectOption('summary');
 await page.locator('#explore-dialog [data-shortcuts-help]').click();
 await page.keyboard.down('Escape');await page.keyboard.down('Escape');await page.keyboard.up('Escape');
 assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.open),false);
 assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),false);
 // Metric-card capture must honor the same modifier/composition exclusions.
 await page.locator('[data-stat-help]').first().click();
 for(const options of [{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{isComposing:true},{repeat:true},{keyCode:229},{modifierAltGraph:true}]){
  const result=await page.evaluate(options=>{const e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,...options});document.activeElement.dispatchEvent(e);return{prevented:e.defaultPrevented,open:!!document.querySelector('.metric-popover')}},options);
  assert.deepEqual(result,{prevented:false,open:true});
 }
 await page.keyboard.press('Escape');assert.equal(await page.locator('.metric-popover').count(),0);
 for(const key of ['g','/','?']){
  await page.locator('#about-button').focus();
  const result=await page.evaluate(key=>{const e=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,modifierAltGraph:true});document.activeElement.dispatchEvent(e);return e.defaultPrevented},key);
  assert.equal(result,false);assert.equal(await page.evaluate(()=>document.activeElement.id),'about-button');
 }
 console.log('PASS held Escape, metric modifiers/composition, AltGraph');
 assert.deepEqual(errors,[]);

 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
