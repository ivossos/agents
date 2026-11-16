// Records a REAL end-to-end case in the real GUI (real server, real `claude` runs).
// Writes gui/raw.webm and gui/marks.json (event times, seconds from recording start).
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'gui');fs.mkdirSync(OUT,{recursive:true});
const URL=process.env.APP_URL||'http://localhost:3000/';
const WF_FILE=path.join(__dirname,'..','examples','workflows','feedback-to-sprint.json');
const INPUT=`Early-beta feedback on Agents Control Center (7 users, this week):
- "I can't tell which agent is stuck until I open Run history."
- "Workflows are great, but I want to re-run just the failed step, not the whole chain."
- "The default dark theme is way too dark."
- "Please show the cost of each workflow run next to its name."
- "Import JSON should say clearly when an agent in the file doesn't exist."
- "I'd love a Slack ping when a long workflow finishes."
- "Let me export the final result as Markdown to paste into Notion."`;
(async()=>{
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:OUT,size:{width:1920,height:1080}}});
 const T0=Date.now();const marks={};const mark=n=>{marks[n]=+((Date.now()-T0)/1000).toFixed(2);console.log('mark',n,marks[n]);fs.writeFileSync(path.join(OUT,'marks.json'),JSON.stringify(marks,null,1))};
 await ctx.addInitScript(()=>{
  window.addEventListener('DOMContentLoaded',()=>{
   const s=document.createElement('style');s.textContent='html{zoom:1.25}.__cur{position:fixed;z-index:999999;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(196,98,13,.25);border:3px solid #c4620d;pointer-events:none;transition:transform .08s}.__rip{position:fixed;z-index:999998;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #c4620d;pointer-events:none;animation:__r .5s ease-out forwards}@keyframes __r{to{transform:scale(4);opacity:0}}';document.head.appendChild(s);
   const c=document.createElement('div');c.className='__cur';c.style.left='-50px';c.style.top='-50px';document.body.appendChild(c);
   addEventListener('mousemove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'},true);
   addEventListener('mousedown',e=>{const r=document.createElement('div');r.className='__rip';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.appendChild(r);setTimeout(()=>r.remove(),600);c.style.transform='scale(.8)'},true);
   addEventListener('mouseup',()=>{c.style.transform='scale(1)'},true);
  });
 });
 const p=await ctx.newPage();
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const click=async(loc,{pause=350}={})=>{await loc.scrollIntoViewIfNeeded();const bb=await loc.boundingBox();const x=bb.x+bb.width/2,y=bb.y+bb.height/2;await p.mouse.move(x,y,{steps:28});await sleep(200);await p.mouse.down();await sleep(70);await p.mouse.up();await sleep(pause)};
 await p.goto(URL);await p.waitForSelector('tr.row');await p.mouse.move(900,500);
 mark('overview');await sleep(4500);
 mark('go_workflows');await click(p.locator('nav a[data-v="workflows"]'));await sleep(2200);
 mark('import_start');
 await click(p.locator('#wfImp'),{pause:700});
 await p.setInputFiles('#wfFile',WF_FILE);await p.waitForSelector('.wf-card');await sleep(2500);
 mark('imported');
 await click(p.locator('.wf-card',{hasText:'Customer feedback'}).locator('[data-run]'),{pause:1000});
 mark('runform');await sleep(800);
 const ta=p.locator('#wfin');await click(ta,{pause:300});
 mark('typing_start');
 for(const ch of INPUT){await p.keyboard.type(ch,{delay:ch==='\n'?250:14})}
 mark('typing_end');await sleep(1800);
 await click(p.locator('#wfgo'),{pause:1200});
 mark('run_clicked');
 // follow the pipeline in real time
 const status=()=>p.evaluate(()=>[...document.querySelectorAll('.wf-node[data-step]')].map(n=>['running','done','failed','cancelled','skipped'].find(c=>n.classList.contains(c))||'pending'));
 let last=[],cur=-1,deadline=Date.now()+25*60000;
 while(Date.now()<deadline){
  const s=await status().catch(()=>[]);
  s.forEach((v,i)=>{if(last[i]!==v){mark(`step${i+1}_${v}`)}});
  const run=s.findIndex(v=>v==='running');
  if(run>=0&&run!==cur){cur=run;await click(p.locator(`.wf-node[data-step="${run}"]`),{pause:200});mark(`follow_step${run+1}`)}
  last=s;
  if(s.length&&s.every(v=>v==='done'||v==='failed'||v==='skipped'||v==='cancelled'))break;
  await sleep(1000);
 }
 mark('all_finished');await sleep(2500);
 // read each real result
 for(let i=0;i<4;i++){
  await click(p.locator(`.wf-node[data-step="${i}"]`),{pause:900});mark(`read_step${i+1}`);
  const out=p.locator('#wfout');const h=await out.evaluate(e=>e.scrollHeight-e.clientHeight);
  await sleep(2500);
  const bb=await out.boundingBox();await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:10});
  for(let k=0;k<6&&h>0;k++){await p.mouse.wheel(0,Math.min(h,260));await sleep(1100)}
  await sleep(1500);mark(`read_step${i+1}_end`);
 }
 // back to the runs table
 await click(p.locator('#cl'),{pause:800});await sleep(1500);mark('runs_table');await sleep(3000);
 mark('end');
 const vp=p.video();await ctx.close();await b.close();
 fs.renameSync(await vp.path(),path.join(OUT,'raw.webm'));console.log('saved raw.webm');
})().catch(e=>{console.error('FAILED',e);process.exit(1)});
