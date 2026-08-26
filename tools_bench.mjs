/* Pilot of E5: the same briefs across models, three repair attempts, everything logged.
   Runs the real loop the team will run — the app's own governor decides valid/invalid. */
import { chromium } from 'playwright';
const BRIEFS=[
 {id:'B1', text:'a 90 mm straight wall, dense weave, nothing bridging more than 8 mm, printable on the A1'},
 {id:'B2', text:'a full dome about 100 mm across that can be printed with no supports at all'},
 {id:'B3', text:'the lightest wall you can make that still stacks weld columns vertically — as few welds as possible without breaking any printability rule'}
];
const MODELS=['haiku','sonnet'];
const b=await chromium.launch({executablePath:process.env.WEFT_CHROMIUM,args:['--disable-background-timer-throttling']});
const page=await b.newPage({viewport:{width:1500,height:1000}});
page.on('pageerror',e=>console.error('PAGE ERROR:',e.message));
await page.goto('http://127.0.0.1:8787/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:20000});
await page.waitForFunction(()=>document.getElementById('secAI').style.display==='block',null,{timeout:15000});
const rows=[];
for(const m of MODELS) for(const br of BRIEFS){
  await page.selectOption('#aiModel',m);
  await page.evaluate(t=>document.getElementById('aiBrief').value=t, br.text);
  await page.evaluate(()=>{document.getElementById('aiTries').value=3;document.getElementById('aiOut').innerHTML='';});
  const t0=Date.now();
  await page.evaluate(()=>document.getElementById('aiGo').click());
  try{
    await page.waitForFunction(()=>/accepted|no valid|unreachable|CLI failed/.test(document.getElementById('aiOut').innerText),null,{timeout:900000});
  }catch(e){ console.log(`${m} ${br.id} TIMEOUT`); }
  const out=await page.evaluate(()=>document.getElementById('aiOut').innerText);
  const v=await page.evaluate(()=>{const r=validityReport();
    return {valid:r.valid,layers:r.layers,welds:r.weldNodes,size:r.size_mm,min:r.estPrint_min,
      p:{mode:P.mode,webType:P.webType,w:P.w,lambda:P.lambda,e:P.overshoot,wallH:P.wallH,domeR:P.domeR,sweep:P.sweep}};});
  await page.evaluate(()=>document.getElementById('aiSave').click());
  await page.waitForTimeout(1200);
  const tries=(out.match(/▸ attempt/g)||[]).length;
  const extracted=/JSON needed extracting/.test(out);
  rows.push({model:m,brief:br.id,valid:/✓ VALID/.test(out),tries,extracted,s:+((Date.now()-t0)/1000).toFixed(1),v});
  console.log(`${m.padEnd(7)} ${br.id}  ${/✓ VALID/.test(out)?'VALID  ':'INVALID'} tries=${tries} ${((Date.now()-t0)/1000).toFixed(0)}s  ${v.p.mode} ${v.p.webType} w=${v.p.w} λ=${v.p.lambda} e=${v.p.e} → ${v.welds} welds, ${v.min} min`);
}
console.log('\nJSON '+JSON.stringify(rows));
await b.close();
