// Literal XY extrusion paths from the corrected first model layer, not a CAD rendering.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {loadMachines} from '../core/weft_build.mjs';
const root=path.resolve(import.meta.dirname,'..'),names=['RAZMAK_A2L_H4','OBRTAJ_ENDER_H7'];let cards=[];
for(const name of names){
 const dir=path.join(root,'specimens','2026-09-19_'+name+'_experimental'),S=JSON.parse(fs.readFileSync(path.join(dir,name+'_geometry.json'),'utf8')).summary,m=loadMachines()[S.machine];
 const receipt=JSON.parse(fs.readFileSync(path.join(dir,'FIRST_LAYER_REPAIR.json'),'utf8')),stem=receipt.printStem||name;
 const file=path.join(dir,stem+'.gcode'),text=fs.readFileSync(fs.existsSync(file)?file:file+'.PENDING','utf8');
 const a=globalThis.WEFT_GATE.firstLayerAudit(text);if(!a.PASS)throw Error(JSON.stringify(a));
 let x=0,y=0,z=0,active=false,changes=0,segments=[];
 for(const line of text.split('\n')){
  if(line==='; CHANGE_LAYER'&&++changes===2)break;
  if(/^; layer \d+ /.test(line))active=true;
  const code=line.split(';')[0].trim();if(!/^G[01]\s/.test(code))continue;
  const d={};for(const p of code.matchAll(/([XYZE])(-?\d*\.?\d+)/g))d[p[1]]=+p[2];
  const nx=d.X??x,ny=d.Y??y,nz=d.Z??z;
  if(active&&d.E>0&&Math.hypot(nx-x,ny-y)>1e-6)segments.push(`M${x.toFixed(3)},${(m.plate[1]-y).toFixed(3)}L${nx.toFixed(3)},${(m.plate[1]-ny).toFixed(3)}`);
  x=nx;y=ny;z=nz;
 }
 cards.push(`<section><h2>${S.machine==='a2l'?'Bambu A2L · RAZMAK':'Ender · OBRTAJ'}</h2><p>First model layer <b>Z${a.firstModelZ.toFixed(2)} mm</b> · ${a.segments.toLocaleString('en-US')} extruding segments</p><svg viewBox="-5 -5 ${m.plate[0]+10} ${m.plate[1]+10}"><rect width="${m.plate[0]}" height="${m.plate[1]}" rx="3" fill="#faf9f4" stroke="#dedbd1" stroke-width=".6"/><rect x="15" y="15" width="${m.plate[0]-30}" height="${m.plate[1]-30}" fill="none" stroke="#aaa" stroke-dasharray="2 2" stroke-width=".4"/><path d="${segments.join('')}" fill="none" stroke="#235e61" stroke-width="${m.firstLayerBead||.48}" stroke-linecap="round"/><text x="${m.plate[0]/2}" y="${m.plate[1]/2}" text-anchor="middle" font-size="7" fill="#647371">OPEN CENTRE</text></svg><p class="note">Only the basal perimeter frame is on the bed.<br>Purge/preparation is separate from this model-layer drawing.</p></section>`);
}
const dossier=path.resolve(root,'../paper/03_experiments/2026-09-19_zigurat_horizontal_weft'),html=path.join(dossier,'first-layer-paths.html');
fs.writeFileSync(html,`<!doctype html><meta charset="utf-8"><title>WEFT · first-layer evidence</title><style>body{margin:0;padding:38px;background:#f3f1ea;color:#203439;font:16px Arial}h1{font-size:30px;margin:0 0 10px}header p{color:#5e6a6c}main{display:grid;grid-template-columns:1fr 1fr;gap:32px}section{padding:24px;background:white;border:1px solid #dedbd1;border-radius:12px}h2{font-size:21px;margin:0 0 9px}p{font-size:14px}svg{width:100%;height:440px}.note{line-height:1.6;color:#667174}footer{margin-top:24px;color:#566769;font-size:13px}</style><header><h1>The first layer contains the base frame</h1><p>Actual extrusion coordinates from the corrected G-code · 19 September 2026</p></header><main>${cards.join('')}</main><footer>Software evidence: no physical print or native slicer screenshot is represented here. Dashed line = 15 mm bed margin.</footer>`);
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1320,height:820},deviceScaleFactor:1});
await page.goto(pathToFileURL(html).href);await page.screenshot({path:path.join(dossier,'first-layer-paths.png'),fullPage:true});await browser.close();console.log(html);
