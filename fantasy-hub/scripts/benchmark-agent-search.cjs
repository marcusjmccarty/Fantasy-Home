// Serve baseline/candidate public/ directories separately. Local fixtures only.
// BASE_URL=http://127.0.0.1:8770 CANDIDATE_URL=http://127.0.0.1:8771 node scripts/benchmark-agent-search.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const urls={base:process.env.BASE_URL||'http://127.0.0.1:8770',candidate:process.env.CANDIDATE_URL||'http://127.0.0.1:8771'};
for(const url of Object.values(urls))if(new URL(url).hostname!=='127.0.0.1')throw Error('Local fixture servers required');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const measurements=[];
 try{
  for(let round=0;round<3;round++)for(const rate of [1,4])for(const size of [14,300,1000])for(const report of ['home','agents'])for(const revision of round%2?['candidate','base']:['base','candidate']){
   const base=urls[revision],context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
   await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base||r.request().method()!=='GET')return r.abort();if(u.pathname.startsWith('/api/'))return r.fulfill({json:{active:false,enabled:false}});return r.continue()});
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});await page.goto(base);
   await page.evaluate(({size,report})=>{const original=demoAgents();XL.free=Array.from({length:size},(_,i)=>({...original[i%original.length],id:'fixture'+i,name:original[i%original.length].name+' '+i}));XL.agent.search='';XL.agent.sort='projected';if(report==='agents')openExplorer('agents');else renderFreeAgentHome()},{size,report});
   await page.waitForTimeout(100);
   for(let sample=0;sample<8;sample++){
    const result=await page.evaluate(({query,report})=>new Promise(resolve=>{
     const name=report==='home'?'renderFreeAgentHome':'detailAgents',render=window[name],sum=window.summarize;let count=0;
     window.summarize=function(...args){count++;return sum(...args)};
     const input=document.getElementById(report==='home'?'home-fa-search':'agent-search');input.focus();const start=performance.now();
     window[name]=function(...args){const t=performance.now(),value=render(...args),renderMs=performance.now()-t;window[name]=render;window.summarize=sum;requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({latencyMs:performance.now()-start,renderMs,summaries:count})));return value};
     input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));
    }),{query:sample%2?'':'a',report});
    if(sample>=2)measurements.push({round,rate,size,report,revision,...result});
   }
   await context.close();fs.writeFileSync(process.env.OUTPUT||'/tmp/agent-search-paired.json',JSON.stringify(measurements,null,2));console.log(JSON.stringify({round,rate,size,report,revision}));
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
