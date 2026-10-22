// Run against a local demo server: node --test scripts/check-graph-browser.cjs
// Requires Playwright (or PLAYWRIGHT_MODULE pointing to its installed package).
const {test,before,after,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser,page;
before(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})});
after(async()=>{await browser?.close()});
beforeEach(async()=>{
 page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:8766'||route.request().method()!=='GET')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({contentType:'application/json',body:'{"active":false,"enabled":false}'});return route.continue()});
 await page.goto('http://127.0.0.1:8766');
});
afterEach(async()=>{await page?.close()});
const settle=()=>page.waitForTimeout(150);
const open=async()=>{await page.evaluate(()=>openExplorer('graph'));await settle()};
test('Tab reaches graph point without reordering or losing focus',async()=>{
 await open();const before=await page.locator('.lab-dot').evaluateAll(ns=>ns.map(n=>n.dataset.graphPoint));
 await page.locator('.graph-preset:not([disabled])').last().focus();await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.graphPoint),'0');
 assert.deepEqual(await page.locator('.lab-dot').evaluateAll(ns=>ns.map(n=>n.dataset.graphPoint)),before);
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>XL.open),'profile');
});
test('resize preserves focused graph player',async()=>{
 await open();await page.evaluate(()=>{const p=document.querySelector('[data-graph-point="0"]');p.focus();p.focus()});
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.graphPoint),'0');
 await page.setViewportSize({width:1400,height:980});await settle();
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.graphPoint),'0');
});
test('mobile graph labels retain at least 12 rendered CSS pixels',async()=>{
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setWorkspaceLayout('tabbed'));await open();
 const px=await page.locator('.lab-label').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)*n.closest('svg').getScreenCTM().a);
 assert.ok(px>=12,`Rendered label size ${px}px`);
});
test('graph opening builds SVG once after measurement settles',async()=>{
 await page.evaluate(()=>{window.svgBuilds=0;const f=scatterSVG;window.scatterSVG=function(...args){svgBuilds++;return f(...args)}});
 await open();assert.equal(await page.evaluate(()=>svgBuilds),1);
});
test('tabbed resize does not persist an unchanged preference',async()=>{
 await page.evaluate(()=>setWorkspaceLayout('tabbed'));await open();
 await page.evaluate(()=>{window.writes=0;const f=Storage.prototype.setItem;Storage.prototype.setItem=function(...args){writes++;return f.apply(this,args)}});
 await page.setViewportSize({width:1400,height:980});await settle();assert.equal(await page.evaluate(()=>writes),0);
});
test('tabbed resize does not redraw hidden home graph',async()=>{
 await page.evaluate(()=>setWorkspaceLayout('tabbed'));await open();
 await page.evaluate(()=>{window.homeRenders=0;const f=renderGraphHome;window.renderGraphHome=function(...args){homeRenders++;return f(...args)}});
 await page.setViewportSize({width:1400,height:980});await settle();assert.equal(await page.evaluate(()=>homeRenders),0);
 await page.evaluate(()=>setWorkspaceLayout('dashboard'));await settle();
 assert.equal(await page.evaluate(()=>homeRenders),1);
 assert.ok(await page.locator('.graph-home-svg').isVisible());
});
test('tablet and 200-percent-equivalent viewports keep labels and statistics inside the report',async()=>{
 for(const [width,height] of [[731,844],[960,540]])for(const mode of ['dashboard','tabbed']){
  await page.setViewportSize({width,height});await page.evaluate(mode=>setWorkspaceLayout(mode),mode);await open();
  const m=await page.evaluate(()=>{
   const label=document.querySelector('.lab-label'),grid=document.querySelector('.graph-stat-grid').getBoundingClientRect(),tools=document.querySelector('.graph-tools').getBoundingClientRect();
   return {text:parseFloat(getComputedStyle(label).fontSize)*label.closest('svg').getScreenCTM().a,gridBottom:grid.bottom,toolsTop:tools.top,width:document.documentElement.scrollWidth};
  });
  assert.ok(m.text>=12);assert.ok(m.gridBottom<=m.toolsTop);assert.equal(m.width,width);
 }
});
test('hover overlay leaves point order unchanged and keyboard navigation remains sequential',async()=>{
 await open();const order=await page.locator('.lab-dot').evaluateAll(ns=>ns.map(n=>n.dataset.graphPoint));
 await page.locator('.lab-dot circle').first().hover();
 assert.deepEqual(await page.locator('.lab-dot').evaluateAll(ns=>ns.map(n=>n.dataset.graphPoint)),order);
 assert.equal(await page.locator('.graph-point-highlight').getAttribute('aria-hidden'),'true');
 assert.equal(await page.locator('.graph-point-highlight [tabindex]').count(),0);
 await page.locator('.graph-preset:not([disabled])').last().focus();
 await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.graphPoint),'1');
 await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.graphPoint),'0');
 await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>XL.open),'profile');
});
test('filters, empty data and rapid navigation do not leave a stale graph',async()=>{
 await open();await page.selectOption('#graph-pos','WR');await settle();assert.equal(await page.locator('.lab-dot').count(),36);
 await page.locator('#graph-search').fill('NO MATCH XYZ');await page.waitForTimeout(400);
 assert.equal(await page.locator('.lab-dot').count(),0);assert.equal(await page.locator('.lab-no-data').count(),1);
 await page.evaluate(()=>{openExplorer('graph');openExplorer('weekly');openExplorer('summary')});await settle();
 assert.equal(await page.locator('.lab-scatter-svg').count(),0);
});
test('twelve modal open/history/close cycles retain the correct report',async()=>{
 for(let i=0;i<12;i++){
  await open();await page.evaluate(()=>openExplorer('roster'));await page.locator('#explore-back').click();await settle();
  assert.equal(await page.evaluate(()=>XL.open),'graph');assert.equal(await page.locator('.lab-scatter-svg').count(),1);
  await page.locator('#explore-forward').click();assert.equal(await page.evaluate(()=>XL.open),'roster');
  await page.locator('#explore-close').click();await settle();assert.equal(await page.evaluate(()=>XL.open),null);
 }
});
test('filtering out a focused point leaves focus on the live filter/search control',async()=>{
 await open();await page.locator('.lab-dot').first().focus();
 const old=await page.evaluate(()=>graphData()[0].p.pos);const filter=old==='WR'?'RB':'WR';
 await page.locator('#graph-pos').focus();await page.selectOption('#graph-pos',filter);await settle();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'graph-pos');
 assert.ok(await page.evaluate(old=>graphData().every(r=>r.p.pos!==old),old));
 await page.locator('.lab-dot').first().focus();await page.locator('#graph-search').fill('ZZZ NO MATCH');await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'graph-search');assert.equal(await page.locator('.lab-dot').count(),0);
 assert.equal(await page.locator('#graph-search').evaluate(n=>n.selectionStart),12);
});
test('same-size resize storms do not rebuild; real resizes preserve focus and final dimensions',async()=>{
 await open();await page.locator('.lab-dot').first().focus();
 await page.evaluate(()=>{window.builds=0;const f=scatterSVG;window.scatterSVG=(...args)=>{builds++;return f(...args)};for(let i=0;i<120;i++)window.dispatchEvent(new Event('resize'))});await settle();
 assert.equal(await page.evaluate(()=>builds),0);
 for(let i=0;i<20;i++)await page.setViewportSize({width:1000+i*13,height:800+i*3});await settle();
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.graphPoint),'0');
 const d=await page.evaluate(()=>{const p=document.querySelector('.graph-plot').getBoundingClientRect(),v=document.querySelector('.lab-scatter-svg').viewBox.baseVal;return {w:Math.round(p.width),h:Math.round(p.height),sw:v.width,sh:v.height,builds}});
 assert.equal(d.w,d.sw);assert.equal(d.h,d.sh);assert.ok(d.builds<=20);
});
test('hidden/visible transitions and table/graph switches keep one live chart',async()=>{
 for(let i=0;i<8;i++){
  await page.evaluate(()=>{setWorkspaceLayout('tabbed');activateWorkspace('graph')});await settle();
  await page.evaluate(()=>activateWorkspace('roster'));assert.equal(await page.locator('.lab-scatter-svg').count(),0);
  await page.evaluate(()=>activateWorkspace('graph'));await settle();assert.equal(await page.locator('.lab-scatter-svg').count(),1);
  await page.evaluate(()=>setWorkspaceLayout('dashboard'));await settle();assert.ok(await page.locator('.graph-home-svg').isVisible());
 }
});
test('workspace layout and selected report survive reload',async()=>{
 await page.evaluate(()=>{setWorkspaceLayout('tabbed');activateWorkspace('graph')});await settle();await page.reload();await settle();
 assert.equal(await page.evaluate(()=>document.body.dataset.layout),'tabbed');assert.equal(await page.evaluate(()=>XL.open),'graph');
 assert.equal(await page.locator('.lab-scatter-svg').count(),1);
 await page.evaluate(()=>setWorkspaceLayout('dashboard'));await page.reload();await settle();
 assert.equal(await page.evaluate(()=>document.body.dataset.layout),'dashboard');assert.equal(await page.evaluate(()=>XL.open),null);
 await page.evaluate(()=>setWorkspaceLayout('tabbed'));await settle();assert.equal(await page.evaluate(()=>XL.open),'graph');
});
test('pending graph search cannot replace a destination table or lose its focus',async()=>{
 await open();await page.locator('#graph-search').fill('Jordan');
 await page.evaluate(()=>{openExplorer('roster');window.destination=document.querySelector('#explore-content table');destination.tabIndex=-1;destination.focus()});
 await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>destination.isConnected),true);
 assert.equal(await page.evaluate(()=>document.activeElement===destination),true);
});
test('pending search from a closed graph cannot replace or focus the reopened graph',async()=>{
 await open();await page.locator('#graph-search').fill('Jordan');
 await page.evaluate(()=>{document.getElementById('explore-dialog').close();openExplorer('graph')});
 await page.locator('.lab-dot').first().waitFor();await page.locator('.lab-dot').first().focus();
 await page.evaluate(()=>window.reopenedPoint=document.activeElement);await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>reopenedPoint.isConnected),true);
 assert.equal(await page.evaluate(()=>document.activeElement===reopenedPoint),true);
});
test('integrated home graph stat cards explain in place and chart headings keep their new destinations',async()=>{
 await page.locator('#graph-teaser [data-home-stat]').first().scrollIntoViewIfNeeded();await settle();
 await page.locator('#graph-teaser [data-home-stat]').first().click();
 assert.equal(await page.evaluate(()=>XL.open),null);assert.equal(await page.locator('.metric-popover').count(),1);
 await page.keyboard.press('Escape');
 await page.locator('.home-points-history .window-topline').click();assert.equal(await page.evaluate(()=>XL.open),'positions');
 await page.locator('#explore-close').click();await settle();
 await page.locator('.home-share-history .share-history-link').click();assert.equal(await page.evaluate(()=>XL.open),'opportunity');
 await page.locator('#explore-close').click();await settle();
 for(const type of ['outlook','opportunity','trade']){
  await page.locator(`.expandable[data-explore="${type}"] .title-bar`).click();assert.equal(await page.evaluate(()=>XL.open),type);
  await page.locator('#explore-close').click();await settle();
 }
});
for(const [report,search,control] of [['graph','graph-search','graph-pos'],['agents','agent-search','agent-sort']]){
 test(report+' pending search preserves a newly focused control',async()=>{
  await page.evaluate(report=>openExplorer(report),report);await settle();
  await page.locator('#'+search).fill('a');await page.locator('#'+control).focus();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement.id),control);
 });
 test(report+' pending search leaves focus outside report alone',async()=>{
  await page.evaluate(report=>{setWorkspaceLayout('tabbed');openExplorer(report)},report);await settle();
  await page.locator('#'+search).fill('a');await page.locator('#workspace-tab-graph').focus();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'workspace-tab-graph');
 });
}
test('delayed graph filtering preserves a surviving focused player rather than its old index',async()=>{
 await open();const id=await page.evaluate(()=>String(graphData().find(r=>r.p.name.toLowerCase().includes('a')).p.id));
 await page.locator('#graph-search').fill('a');await page.locator(`[data-graph-player=${JSON.stringify(id)}]`).focus();await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.graphPlayer),id);
});
test('delayed search preserves a preset and an active text selection',async()=>{
 await open();await page.locator('#graph-search').fill('a');await page.locator('[data-preset="avg,std"]').focus();await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.preset),'avg,std');
 await page.locator('#graph-search').fill('Jordan');await page.locator('#graph-search').evaluate(n=>n.setSelectionRange(1,4,'backward'));await page.waitForTimeout(300);
 assert.deepEqual(await page.locator('#graph-search').evaluate(n=>[n.selectionStart,n.selectionEnd,n.selectionDirection]),[1,4,'backward']);
});
test('pending Free agents search cannot replace a newly opened roster',async()=>{
 await page.evaluate(()=>openExplorer('agents'));await settle();await page.locator('#agent-search').fill('a');
 await page.evaluate(()=>{openExplorer('roster');window.agentDestination=document.querySelector('#explore-content table');agentDestination.tabIndex=-1;agentDestination.focus()});await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>agentDestination.isConnected&&document.activeElement===agentDestination),true);
});
test('Player Terminal Weekly Points opens Position Allocation by click and keyboard',async()=>{
 for(const activation of ['click','Enter','Space']){
  await page.evaluate(()=>openExplorer('profile',currentPlayerId));await settle();
  const chart=page.locator('.player-weekly-panel[data-chart-surface]');
  if(activation==='click')await chart.locator('h4').click();else{await chart.focus();await page.keyboard.press(activation)}
  assert.equal(await page.evaluate(()=>XL.open),'positions');
 }
});
test('Complete Statistical File retains its separate Player Stat Archive destination',async()=>{
 await page.evaluate(()=>openExplorer('profile',currentPlayerId));await settle();
 await page.locator('[data-open-player-analytics] h4').click();
 assert.equal(await page.evaluate(()=>XL.open),'player-analytics');
});
test('global active week synchronizes Matchup and strategy analysis',async()=>{
 await page.selectOption('#header-current-week','3');
 assert.equal(await page.locator('#week-select').inputValue(),'3');
 assert.equal(await page.evaluate(()=>strategyWeek()),3);
 await page.locator('.expandable[data-explore="matchup"] .title-bar h2').click();
 assert.equal(await page.evaluate(()=>XL.open),'matchup');
 assert.equal(await page.locator('#lab-match-week').inputValue(),'3');
 await page.locator('#explore-close').click();await settle();
 await page.selectOption('#week-select','4');
 assert.equal(await page.locator('#header-current-week').inputValue(),'4');
 assert.equal(await page.evaluate(()=>strategyWeek()),4);
});
test('home AI button routes its selected player without opening the parent tile',async()=>{
 // Demo omits paid AI controls. Inject a fixture control and stub generation;
 // this exercises event routing only, without any provider request.
 const expected=await page.evaluate(()=>{
  const id=String(getPool()[0].id),button=document.createElement('button');button.dataset.matchupAi=id;button.id='fixture-ai';button.textContent='Fixture AI';
  document.querySelector('.expandable[data-explore="outlook"] .win-inner').append(button);
  window.aiCalls=[];window.generateMatchupAI=p=>aiCalls.push(String(p.id));return id;
 });
 await page.locator('#fixture-ai').click();
 assert.deepEqual(await page.evaluate(()=>aiCalls),[expected]);assert.equal(await page.evaluate(()=>XL.open),null);
});
for(const opened of [false,true])test('home graph resize preserves metric identity after '+(opened?'card dismissal':'direct focus'),async()=>{
 const metric=page.locator('#graph-teaser [data-home-stat="r2"]');await metric.scrollIntoViewIfNeeded();await settle();
 if(opened)await metric.click();else await metric.focus();
 await page.setViewportSize({width:1400,height:980});await settle();
 assert.equal(await page.locator('.metric-popover').count(),0);
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.homeStat),'r2');
 assert.equal(await metric.evaluate(n=>n===document.activeElement),true);
});
test('home graph resize never reclaims focus moved to another control',async()=>{
 const metric=page.locator('#graph-teaser [data-home-stat="r2"]');await metric.scrollIntoViewIfNeeded();await settle();await metric.click();
 await page.locator('#about-button').focus();await page.setViewportSize({width:1400,height:980});await settle();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'about-button');
 assert.equal(await page.locator('.metric-popover').count(),0);
});
