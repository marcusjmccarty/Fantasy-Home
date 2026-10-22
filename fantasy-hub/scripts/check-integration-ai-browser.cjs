// Local fictional non-demo fixtures only. No provider/network requests escape routing.
const {test,before,after,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:8766';let browser,page,requests,errors;
before(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']})});
after(async()=>{await browser?.close()});
beforeEach(async()=>{
 requests=[];errors=[];page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin!==base)return route.abort();
  if(u.pathname==='/api/ai/outlook'){assert.equal(req.method(),'POST');requests.push({route,body:req.postDataJSON()});return;}
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{active:false,enabled:false}});
  if(req.method()!=='GET')return route.abort();return route.continue();
 });
 await page.goto(base);
});
afterEach(async()=>{await page.close();assert.deepEqual(errors,[])});
async function fixture(){await page.evaluate(()=>{
 const usage=demoUsage();model.source='fixture';model.leagueId='local-fixture';strategyContext();
 STRATEGY.usage.set(Number(model.season),usage);
 for(let w=1;w<=18;w++)STRATEGY.defense.set(`${model.season}:${w}`,null);
 renderStrategyHome();
})}
const button=()=>page.locator('.expandable[data-explore="outlook"] [data-matchup-ai]');
async function calls(n){for(let i=0;i<100&&requests.length<n;i++)await page.waitForTimeout(10);assert.equal(requests.length,n)}
async function finish(index,body,status=200){await requests[index].route.fulfill({status,json:body});await page.waitForFunction(()=>STRATEGY.aiBusy.size===0)}
const result=outlook=>({outlook,provider:'Local fixture',model:'fixture'});

test('global controls synchronize while expanded matchup week remains report-local',async()=>{
 await page.selectOption('#header-current-week','3');assert.equal(await page.locator('#week-select').inputValue(),'3');
 await page.selectOption('#week-select','4');assert.equal(await page.locator('#header-current-week').inputValue(),'4');
 await page.locator('.expandable[data-explore="matchup"] h2').click();assert.equal(await page.locator('#lab-match-week').inputValue(),'4');
 await page.selectOption('#lab-match-week','2');assert.equal(await page.locator('#lab-match-week').inputValue(),'2');
 assert.deepEqual(await page.evaluate(()=>[currentWeek,strategyWeek(),el('header-current-week').value,el('week-select').value]),[4,4,'4','4']);
});
test('missing historical matchup never renders current-week fixture as fallback',async()=>{
 await fixture();
 await page.evaluate(()=>{const t=getTeam();t.currentMatchup={week:6,opponentId:model.teams.find(x=>x.id!==t.id).id,points:999,oppPoints:888};t.history=t.history.filter(h=>Number(h.week)!==2);setActiveWeek(2)});
 assert.match(await page.locator('#matchup-panel').innerText(),/NO MATCHUP ON FILE/);
 assert.doesNotMatch(await page.locator('#matchup-panel').innerText(),/999|888/);
 await page.locator('.expandable[data-explore="matchup"] h2').click();assert.equal(await page.locator('#lab-match-week').inputValue(),'2');
 assert.doesNotMatch(await page.locator('.lab-scoreboard').innerText(),/999|888/);
 assert.equal(await page.evaluate(()=>weeklyLineupData(getTeam(),2).official),null);
 assert.equal(await page.evaluate(()=>{getTeam().history=getTeam().history.filter(h=>Number(h.week)!==6);return weeklyLineupData(getTeam(),6).official}),999);
 assert.equal(await page.evaluate(()=>{model.currentWeek=2;return weeklyLineupData(getTeam(),2).official}),null);
});
for(const activation of ['click','Enter','Space'])test('non-demo AI '+activation+' makes one request and does not navigate its parent tile',async()=>{
 await fixture();const selected=await button().getAttribute('data-matchup-ai');
 if(activation==='click')await button().click();else{await button().focus();await page.keyboard.press(activation)}
 await calls(1);assert.equal(requests[0].body.player.id,selected);assert.equal(requests[0].body.player.week,6);
 assert.equal(await page.evaluate(()=>XL.open),null);assert.equal(await button().isDisabled(),true);assert.match(await button().innerText(),/Analyzing/);
 // The implementation's key guard also protects duplicate activations while busy.
 await page.evaluate(id=>{void generateMatchupAI(getPool().find(p=>String(p.id)===id))},selected);await page.waitForTimeout(30);assert.equal(requests.length,1);
 await finish(0,result('ACTIVATION FIXTURE RESULT'));assert.match(await page.locator('#outlook-preview').innerText(),/ACTIVATION FIXTURE RESULT/);
});
test('non-demo AI error clears busy state and allows one successful retry',async()=>{
 await fixture();await button().click();await calls(1);await finish(0,{error:'FIXTURE SERVICE FAILURE'},502);
 assert.match(await page.locator('#outlook-preview').innerText(),/FIXTURE SERVICE FAILURE/);assert.equal(await button().isEnabled(),true);
 await button().click();await calls(2);assert.doesNotMatch(await page.locator('#outlook-preview').innerText(),/FIXTURE SERVICE FAILURE/);
 await finish(1,result('RETRY FIXTURE SUCCESS'));assert.match(await page.locator('#outlook-preview').innerText(),/RETRY FIXTURE SUCCESS/);
});
for(const change of ['player','week'])test('delayed AI result stays out of changed '+change+' context',async()=>{
 await fixture();await button().click();await calls(1);const original=requests[0].body.player;
 if(change==='week')await page.selectOption('#header-current-week','3');else await page.evaluate(id=>{currentPlayerId=tradeRoster(getTeam()).find(p=>String(p.id)!==String(id)).id;renderStrategyHome()},original.id);
 const current=await button().getAttribute('data-matchup-ai');await page.evaluate(id=>openExplorer('outlook',id),current);
 await finish(0,result('STALE FIXTURE RESULT'));
 assert.doesNotMatch(await page.locator('#outlook-preview').innerText(),/STALE FIXTURE RESULT/);assert.doesNotMatch(await page.locator('#explore-content').innerText(),/STALE FIXTURE RESULT/);
 assert.equal(requests.length,1);
});
