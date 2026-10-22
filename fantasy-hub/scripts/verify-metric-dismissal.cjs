const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.SHORTCUTS_BASE_URL||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',r=>!r.request().url().startsWith(base+'/')?r.abort():r.request().url().includes('/api/')?r.fulfill({json:{active:false,enabled:false}}):r.continue());
 for(const moved of [false,true]){
  await page.goto(base);
  const result=await page.evaluate(async moved=>{
   const trigger=document.querySelector('[data-stat-help]');
   // Queue an actual browser scroll event, then open the card in the same task.
   // This exposes the ordering hidden by Playwright's normal actionability wait.
   const scrolled=new Promise(resolve=>document.addEventListener('scroll',resolve,{once:true,capture:true}));
   trigger.scrollIntoView({behavior:'instant'});trigger.click();
   const card=document.querySelector('.metric-popover');const initiallyFocused=card===document.activeElement;
   const next=document.getElementById('about-button');if(moved)next.focus({preventScroll:true});
   await scrolled;
   return{initiallyFocused,cardClosed:!document.querySelector('.metric-popover'),focusReturned:document.activeElement===trigger,focusPreserved:document.activeElement===next,triggerConnected:trigger.isConnected};
  },moved);
  assert.equal(result.initiallyFocused,true);assert.equal(result.triggerConnected,true);assert.equal(result.cardClosed,true);
  assert.equal(moved?result.focusPreserved:result.focusReturned,true,JSON.stringify({moved,...result}));
 }
 console.log('PASS real queued scroll restores owned card focus and preserves moved focus');
 // Check viewport dismissal on a stable report metric. Home graph-chip redraw
 // and focus after that redraw belong to the separate performance work.
 for(const moved of [false,true]){
  await page.goto(base);await page.locator('#home-go-to').selectOption('opportunity');
  await page.locator('#explore-dialog [data-stat-help]').first().click();
  await page.waitForSelector('.metric-popover');
  if(moved)await page.locator('#explore-dialog [data-shortcuts-help]').evaluate(n=>n.focus({preventScroll:true}));
  await page.setViewportSize({width:moved?1420:1430,height:1000});
  await page.waitForFunction(()=>!document.querySelector('.metric-popover'));
  assert.equal(await page.evaluate(moved=>document.activeElement===(moved?document.querySelector('#explore-dialog [data-shortcuts-help]'):document.querySelector('#explore-dialog [data-stat-help]')),moved),true);
 }
 console.log('PASS resize restores owned card focus and preserves moved focus');
 assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
