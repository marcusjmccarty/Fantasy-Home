const {chromium}=require('playwright');
const assert=require('node:assert/strict');
// Run against a local static public/ server; provider requests are blocked.
const base=process.env.SHORTCUTS_BASE_URL||'http://127.0.0.1:8765';
const browserPath=process.env.CHROMIUM_PATH||'/usr/bin/chromium';
(async()=>{
 const browser=await chromium.launch({executablePath:browserPath,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(base+'/'))return route.abort();if(url.includes('/api/'))return route.fulfill({json:{active:false,enabled:false}});return route.continue();});
 await page.goto(base);
 await page.waitForSelector('#team-select option',{state:'attached'});
 page.setDefaultTimeout(6000);
 const focus=()=>page.evaluate(()=>document.activeElement.id);
 await page.locator('#about-button').focus();
 await page.keyboard.press('g');assert.equal(await focus(),'home-go-to');
 // Selects keep their own native typeahead and keys.
 await page.keyboard.press('?');assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.open),false);
 await page.locator('#about-button').focus();await page.keyboard.press('?');
 assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.open),true);
 await page.screenshot({path:'/tmp/shortcuts-desktop.png'});
 await page.keyboard.press('Escape');assert.equal(await focus(),'about-button');
 await page.keyboard.press('g');await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.waitForSelector('#explore-dialog[open]');
 await page.locator('#explore-close').focus();await page.keyboard.press('?');
 await page.keyboard.press('Tab');assert.equal(await focus(),'shortcuts-enabled');await page.keyboard.press('Tab');assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.contains(document.activeElement)||document.activeElement===document.body),true);
 await page.keyboard.press('Escape');assert.equal(await focus(),'explore-close');assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),true);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),false);assert.equal(await focus(),'home-go-to');
 // Repeat navigation across reports uses existing report state and modal lifecycle.
 for(const type of ['agents','roster','agents']){
  await page.locator('#about-button').focus();await page.keyboard.press('g');await page.locator('#home-go-to').selectOption(type);
  await page.locator('#explore-close').focus();await page.keyboard.press('g');assert.equal(await focus(),'explore-jump');
  if(type==='agents'){
   await page.locator('#explore-close').focus();await page.keyboard.press('/');assert.equal(await focus(),'agent-search');
   await page.keyboard.type('g/?');assert.equal(await page.locator('#agent-search').inputValue(),'g/?');
   await page.locator('#agent-search').fill('');
  }
  await page.locator('#explore-close').focus();await page.keyboard.press('Escape');
 }
 await page.locator('#about-button').focus();
 for(const options of [{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{isComposing:true},{repeat:true},{keyCode:229}]){
  const prevented=await page.evaluate(opts=>{const e=new KeyboardEvent('keydown',{key:'g',bubbles:true,cancelable:true,...opts});document.activeElement.dispatchEvent(e);return e.defaultPrevented},options);
  assert.equal(prevented,false);assert.equal(await focus(),'about-button');
 }
 await page.evaluate(()=>{const node=document.createElement('div');node.id='editable-test';node.contentEditable='true';document.body.append(node);node.focus()});
 await page.keyboard.type('g/?');assert.equal(await page.locator('#editable-test').textContent(),'g/?');await page.locator('#editable-test').evaluate(n=>n.remove());
 await page.locator('#open-data').click();await page.locator('#espn-league').fill('g/?');assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.open),false);
 await page.keyboard.press('Escape');assert.equal(await focus(),'open-data');
 // Disable character shortcuts; visible help remains available.
 await page.locator('[data-shortcuts-help]').first().click();await page.locator('#shortcuts-enabled').uncheck();await page.keyboard.press('Escape');
 await page.locator('#about-button').focus();await page.keyboard.press('g');assert.equal(await focus(),'about-button');await page.keyboard.press('?');assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.open),false);
 await page.locator('[data-shortcuts-help]').first().click();await page.locator('#shortcuts-enabled').check();await page.keyboard.press('Escape');
 // Inline tab navigation and Escape preserve the active report.
 await page.locator('#mode-tabbed').click();await page.locator('#workspace-tab-summary').focus();await page.keyboard.press('ArrowRight');assert.equal(await focus(),'workspace-tab-matchup');await page.keyboard.press('Escape');assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),true);
 await page.keyboard.press('End');assert.equal(await focus(),'workspace-tab-graph');await page.keyboard.press('Home');assert.equal(await focus(),'workspace-tab-summary');
 // Ranking card dismisses before the report and restores its trigger.
 const rank=page.locator('.summary-rank-trigger').first();await rank.click();
 await page.keyboard.press('?');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#summary-ranking-host').evaluate(n=>n.hidden),false);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#summary-ranking-host').evaluate(n=>n.hidden),true);assert.equal(await rank.evaluate(n=>document.activeElement===n),true);
 await page.locator('#mode-dashboard').click();
 // Native modal cancel also dismisses the ranking first from a form control.
 await page.locator('#home-go-to').selectOption('summary');
 await page.locator('.summary-rank-trigger').first().click();
 await page.locator('#explore-jump').focus();await page.keyboard.press('Escape');
 assert.equal(await page.locator('#summary-ranking-host').evaluate(n=>n.hidden),true);
 assert.equal(await page.locator('#explore-dialog').evaluate(n=>n.open),true);
 await page.keyboard.press('Escape');
 // Existing metric cards retain their first-Escape/focus contract.
 const metric=page.locator('[data-stat-help]').first();await metric.click();
 await page.keyboard.press('Escape');assert.equal(await page.locator('.metric-popover').count(),0);
 assert.equal(await metric.evaluate(n=>document.activeElement===n),true);

 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-shortcuts-help]').first().click();await page.screenshot({path:'/tmp/shortcuts-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}),true);
 await page.keyboard.press('Escape');
 // Touch-enabled mobile context as well as the responsive desktop viewport.
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const phone=await mobile.newPage();
 phone.on('pageerror',e=>errors.push(e.message));
 await phone.route('**/*',route=>{const url=route.request().url();if(!url.startsWith(base+'/'))return route.abort();if(url.includes('/api/'))return route.fulfill({json:{active:false,enabled:false}});return route.continue();});
 await phone.goto(base);await phone.locator('[data-shortcuts-help]').first().tap();
 assert.equal(await phone.locator('#shortcuts-dialog').evaluate(n=>n.open),true);
 await phone.screenshot({path:'/tmp/shortcuts-mobile.png'});
 await phone.locator('#shortcuts-dialog [data-close-dialog]').tap();
 assert.equal(await phone.locator('#shortcuts-dialog').evaluate(n=>n.open),false);
 await mobile.close();
 assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: desktop/mobile, native keyboard navigation, repeated reports, nested help, Escape/focus, typing, modifiers, IME, repeat, opt-out, tab strip, rankings; no page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
