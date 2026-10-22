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
