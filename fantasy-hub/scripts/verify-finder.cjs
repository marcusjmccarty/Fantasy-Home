const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SHORTCUTS_BASE_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>!r.request().url().startsWith(base+'/')?r.abort():r.request().url().includes('/api/')?r.fulfill({json:{active:false,enabled:false}}):r.continue());
 await page.goto(base);await page.waitForSelector('#team-select option',{state:'attached'});
 const open=async()=>{await page.locator('#explore-content').evaluate(n=>{n.tabIndex=-1;n.focus()});await page.keyboard.press('/');};
 let reachable=0;
 for(const layout of ['dashboard','tabbed']){
  if(await page.locator('#explore-dialog').evaluate(n=>n.open))await page.locator('#explore-close').click();
  await page.locator('#mode-'+layout).click();
  const reports=await page.evaluate(()=>WORKSPACE_TABS.map(x=>x[0]));
  for(const type of reports){await page.evaluate(t=>openExplorer(t),type);await open();assert(await page.locator('#finder-dialog').evaluate(n=>n.open));reachable++;await page.keyboard.press('Escape');}
  await page.evaluate(()=>openExplorer('roster',null,{week:3}));
  await open();await page.locator('#finder-scope').selectOption('players');
  const fixture=await page.evaluate(()=>{const p=getPool().find(p=>!teamForPlayer(p));return {id:String(p.id),name:p.name,points:p.scores?.[3]};});
  await page.locator('#finder-query').fill(fixture.name);
  // Names are not unique: identify the highlighted free agent by its roster label.
  while(!(await page.locator('#finder-results [aria-selected=true]').innerText()).includes('Free agent'))await page.keyboard.press('ArrowDown');
  await page.locator('#finder-week').selectOption('3');
  assert((await page.locator('#finder-weekly').innerText()).includes(String(fixture.points)));
  const highlight=await page.locator('#finder-query').getAttribute('aria-activedescendant');
  await page.locator('#finder-query').focus();await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(()=>[XL.open,String(XL.player)]),['profile',fixture.id]);
  await page.locator('#explore-back').click();await page.waitForTimeout(50);
  assert.deepEqual(await page.evaluate(()=>[XL.open,XL.viewWeek,document.activeElement.id]),['roster',3,'explore-content']);
  await open();assert.equal(await page.locator('#finder-query').inputValue(),fixture.name);assert.equal(await page.locator('#finder-query').getAttribute('aria-activedescendant'),highlight);assert.equal(await page.locator('#finder-week').inputValue(),'3');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{openExplorer('trade');STRATEGY.trade.give=[];STRATEGY.trade.get=[];renderExplorer();});await open();
  await page.locator('#finder-query').fill('');
  for(let i=0;i<3;i++){await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');}
  await page.locator('#finder-scope').selectOption('get');await page.locator('#finder-query').fill('');await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(()=>[STRATEGY.trade.give.length,STRATEGY.trade.get.length]),[3,1]);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'explore-content');
 }
 await page.locator('#explore-content').evaluate(n=>{n.tabIndex=-1;n.focus()});await page.keyboard.press('/');await page.locator('#finder-scope').selectOption('players');await page.locator('#finder-query').fill('');
 await page.screenshot({path:'/tmp/finder-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/finder-mobile.png'});
 assert(await page.locator('#finder-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));
 await page.keyboard.press('Escape');
 await page.locator('#explore-content').evaluate(n=>{n.tabIndex=-1;n.focus()});
 for(const key of ['Control+/', 'Meta+/', 'Alt+/']){await page.keyboard.press(key);assert.equal(await page.locator('#finder-dialog').evaluate(n=>n.open),false);}
 await page.locator('#explore-content').dispatchEvent('keydown',{key:'/',isComposing:true});assert.equal(await page.locator('#finder-dialog').evaluate(n=>n.open),false);
 await page.keyboard.press('?');await page.locator('#shortcuts-enabled').uncheck();await page.keyboard.press('Escape');await page.keyboard.press('/');assert.equal(await page.locator('#finder-dialog').evaluate(n=>n.open),false);
 await page.locator('#explore-dialog [data-finder-open]').click();assert(await page.locator('#finder-dialog').evaluate(n=>n.open));
 await page.locator('#finder-query').fill('/g?');assert.equal(await page.locator('#finder-query').inputValue(),'/g?');assert.equal(await page.locator('#shortcuts-dialog').evaluate(n=>n.open),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({reachableReports:reachable,layouts:2,weeklyInspectReturn:2,threeForOnePackages:2,pageErrors:errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
