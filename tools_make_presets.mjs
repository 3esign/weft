/* Headless preset generator — exports the print files for the 3-day A1 program.
   Every file is produced by the app itself (same code path as the UI buttons),
   so what the team prints is exactly what WEFT synthesises. */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';
const OUT = path.resolve(process.argv[2] || '../presets');
fs.mkdirSync(OUT,{recursive:true});
const APP = path.resolve('index.html');
const browser = await chromium.launch({executablePath: process.env.WEFT_CHROMIUM || undefined,
  /* headless pages are treated as background: setTimeout(...,0) gets clamped to ~1 s,
     and the chunked exporters yield every 10 layers — 1072 layers took 130 s. */
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const page = await browser.newPage({viewport:{width:1400,height:900}, acceptDownloads:true});
page.on('pageerror',e=>console.error('PAGE ERROR:',e.message));
await page.goto(pathToFileURL(APP).href,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:20000});
await page.waitForTimeout(300);

const BASE = { mode:'wall', webType:'staple', w:5, lambda:8, bead:0.45, lh:0.24, dwell:0.6,
  jitter:0, flowBoost:1.25, speed:30, bridgeSpeed:18, temp:215, bed:55, fan:100,
  altPhase:true, autoLOD:true, minGap:1.4, amp:0, ampF:1, checkOv:true, overshoot:1.0,
  gradeLean:false, cycle:['chord','web'], maxBridge:12, specW:28, specH:16, grid:4 };

const PRESETS = [
 { file:'C1_calibration_ladder', kind:'stl', day:1,
   note:'Bead calibration, run FIRST on every machine. Chord-only cycle = pure single-line rails, no webs. 3 beads x 3 spans. Measure the rail width with calipers; that number is the bead for everything else.',
   p:{...BASE, mode:'batch', cycle:['chord'], grid:3, sweepX:'bead', sweepY:'w', specW:28, specH:12} },

 { file:'E1_web_x_overhang', kind:'stl', day:1,
   note:'THE FORK. Rows = web type (diagonal/perp/staple/sine), cols = overhang e (0/0.6/1.2/1.8). Run on TWO machines — the pair is the between-machine replication.',
   p:{...BASE, mode:'batch', grid:4, sweepX:'overshoot', sweepY:'web', specW:28, specH:16} },

 { file:'P2_lambda_x_web', kind:'stl', day:1,
   note:'Density x grammar. Cols = node spacing lambda (5/7/9/12 mm), rows = web type.',
   p:{...BASE, mode:'batch', grid:4, sweepX:'lambda', sweepY:'web', specW:28, specH:16} },

 { file:'P3_span_x_overhang', kind:'stl', day:1,
   note:'Geometry scaling. Cols = wall span w (3/5/7/10 mm), rows = overhang e. Shorter specimens to keep the file slicer-friendly.',
   p:{...BASE, mode:'batch', grid:4, sweepX:'w', sweepY:'overshoot', specW:30, specH:12} },

 { file:'R1_coupon_routeA', kind:'stl', day:2,
   note:'Route A twin — same coupon through Bambu Studio/Arachne. Print 3 of these.',
   p:{...BASE, mode:'wall', wallH:16, webType:'staple', overshoot:1.2, plan:'straight'} },

 { file:'R1_coupon_routeB', kind:'gcode', day:2,
   note:'Route B twin — motion-only G-code WITH per-node flow boost. PASTE A HARVESTED A1 HEADER before printing. The A/B pair isolates the flow boost.',
   p:{...BASE, mode:'wall', wallH:16, webType:'staple', overshoot:1.2, plan:'straight'} },

 { file:'D2_dome_lambda08', kind:'stl', day:2,
   note:'Overhang-vs-density ladder, reference rung. 270 deg dome (NOT 360 — see the seam limitation), R60, auto-LOD on. Machines run lambda 6/8/12/16 in parallel; the failure lean as a function of lambda is the result.',
   p:{...BASE, mode:'dome', domeR:60, sweep:270, hFrac:0.85, capClose:true, lambda:8, webType:'staple'} },

 { file:'X1_spiral', kind:'stl', day:3,
   note:'Exhibition specimen: an Archimedean spiral wall — one continuous thread made visible as a continuous form. 0 overlaps verified.',
   p:{...BASE, mode:'wall', wallH:24, webType:'eight', lambda:7, overshoot:1.0, plan:'spiral'} },

 { file:'X2_letter_C', kind:'stl', day:3,
   note:'Exhibition specimen: a single-stroke letter as the plan curve — language woven into a lattice wall. 0 overlaps verified.',
   p:{...BASE, mode:'wall', wallH:24, webType:'staple', lambda:7, overshoot:1.0, plan:'letterC'} }
];

const rows=[];
for(const preset of PRESETS){
  const stats = await page.evaluate(async (cfg)=>{
    setMachine('a1');
    const {plan, ...pp} = cfg;
    Object.assign(P, pp);
    if(plan==='straight') planPts=[{x:-45,y:0},{x:45,y:0}];
    else if(plan==='spiral'){ // pitch 13 mm > wall width 7 mm, so the turns never touch
      const pts=[], turns=2.4, pitch=13;
      for(let i=0;i<=260;i++){ const t=i/260*turns*2*Math.PI, r=9+pitch*t/(2*Math.PI);
        pts.push({x:r*Math.cos(t), y:r*Math.sin(t)}); }
      planPts=pts;
    }
    else if(plan==='letterC'){ // single-stroke C, radius 34 mm — every radius far above w/2+e+bead
      const a=34, pts=[];
      for(let i=0;i<=80;i++){ const th=Math.PI*(-0.72+1.44*i/80); pts.push({x:a*Math.cos(th), y:a*Math.sin(th)}); }
      planPts=pts;
    }
    buildLayers();
    /* geometry pass only — rebuildScene() also builds one THREE.Mesh per layer,
       which crawls in headless software GL (1072 layers = minutes). The STL
       exporter reads L.geo, and this is the same call that fills it. */
    for(const L of layers){ const g=ribbon(L.pts,(L.bead||P.bead)/2,L.zBot,L.zTop); if(g) L.geo=g; }
    updateStats();
    const txt=id=>(document.getElementById(id)||{}).textContent;
    let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9,nodes=0,ov=0,zmax=0;
    for(const L of layers){ ov+=(L.ov||[]).length; nodes+=(L.nodes||[]).length; zmax=Math.max(zmax,L.zBot||0);
      for(const q of L.pts){ if(q.x<mnx)mnx=q.x; if(q.x>mxx)mxx=q.x; if(q.y<mny)mny=q.y; if(q.y>mxy)mxy=q.y; } }
    return { layers:layers.length, nodes:txt('s_nodes'), len:txt('s_len'), time:txt('s_time'),
      stl:txt('s_stl'), fit:txt('s_fit'), gap:txt('s_gap'), webspan:txt('s_webspan'),
      w:+(mxx-mnx).toFixed(1), h:+(mxy-mny).toFixed(1), z:+zmax.toFixed(1), ov };
  }, preset.p);

  const out = path.join(OUT, preset.file + (preset.kind==='stl' ? '.stl' : '.gcode'));
  /* No browser download plumbing: build in the page, stream the bytes out in
     chunks. A 13 MB blob through the download path stalled headless Chromium. */
  const total = await page.evaluate(async (k)=>{
    let bytes;
    if(k==='stl'){ const parts=await buildSTLParts(); bytes=new Uint8Array(await new Blob(parts).arrayBuffer()); }
    else { bytes=new TextEncoder().encode(await buildGcodeText()); }
    window.__out=bytes; return bytes.length;
  }, preset.kind);
  const fd = fs.openSync(out,'w'); const CH=1<<20;
  for(let off=0; off<total; off+=CH){
    const b64 = await page.evaluate(([o,n])=>{
      const u=window.__out.subarray(o,o+n); let s='';
      for(let i=0;i<u.length;i+=8192) s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));
      return btoa(s);
    },[off,Math.min(CH,total-off)]);
    fs.writeSync(fd, Buffer.from(b64,'base64'));
  }
  fs.closeSync(fd);
  await page.evaluate(()=>{ window.__out=null; });
  const bytes = fs.statSync(out).size;
  rows.push({...preset, stats, bytes});
  console.log(`${preset.file.padEnd(24)} ${String(stats.layers).padStart(5)} layers  ${String(stats.time).padStart(8)}  ${stats.w}x${stats.h}x${stats.z} mm  ov=${stats.ov}  ${(bytes/1e6).toFixed(1)} MB`);
}
fs.writeFileSync(path.join(OUT,'_index.json'), JSON.stringify(rows,null,2));
await browser.close();
