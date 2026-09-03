/* WEFT · P0 "Šuma" builder — takes the per-layer merged contours + registered weld nodes
   produced by suma_geometry.py (levels 1–2) and lets the app's own chord/web/ribbon/STL/G-code
   code (level 3) make the thread. Nothing in index.html is modified; two functions are
   overridden at runtime: apexUs (nodes come from the geometry file) and decimatedHalf (unused
   for these layers, kept for safety).

   Since 2026-09-03 this builder REFUSES: the G-code it writes is handed straight to check_gcode.py,
   and if the gate fails the output is deleted and the process exits non-zero.

   usage: node make_suma.mjs --geo /tmp/suma_2x2.json --out specimens/P0 --name P0_suma_2x2
          [--head exports/a2l_start_block_template.gcode --foot exports/a2l_end_block.gcode]
          [--maxislands N] [--keep] [--nostl] [--dry]
   env:   WEFT_CHROMIUM */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k); return i>0?process.argv[i+1]:d;};
const GEO=arg('geo','/tmp/suma.json'), NAME=arg('name','P0_suma'), DRY=process.argv.includes('--dry');
const OUT=path.resolve(arg('out','specimens/2026-09-02_P0_suma_pending')); fs.mkdirSync(OUT,{recursive:true});
const HEAD=arg('head',null), FOOT=arg('foot',null), NOSTL=process.argv.includes('--nostl');
const PYTHON=process.env.WEFT_PYTHON||'python3';
const geo=JSON.parse(fs.readFileSync(GEO,'utf8'));
const grammar=arg('web','staple'), tab=+arg('e',1.0), machine=arg('machine','a2l');
const KEEP=process.argv.includes('--keep');       // diagnosis only: leave a failed build on disk
const MAXISLANDS=+arg('maxislands',1);            // Suma's merged brims may legitimately leave several
                                                  // feet, but that has to be declared, not discovered

const browser=await chromium.launch({executablePath:process.env.WEFT_CHROMIUM||undefined,
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const page=await browser.newPage({viewport:{width:1400,height:900}});
page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
await page.goto(pathToFileURL(path.resolve('index.html')).href,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:20000});

const report=await page.evaluate(async ([G,web,e,machine,name])=>{
  const A=G.summary.args;
  setMachine(machine);
  Object.assign(P,{mode:'wall',lh:A.lh,bead:A.bead,w:A.w,overshoot:e,webType:web,cycle:['chord','web'],amp:0,ampF:1,
    altPhase:false,autoLOD:true,minGap:1.4,gradeLean:false,dwell:0.6,jitter:0,flowBoost:1.25,maxBridge:12,checkOv:true,
    speed:30,bridgeSpeed:18,temp:A.temp??215,bed:A.bed??55,fan:100,firstLayerBead:0.52,firstLayerSpeed:12,adhesion:'foundation',adhesionWidth:A.foundation});
  P.lambda=2*Math.PI*A.r0/A.K*2;   // nominal; nodes are supplied per contour anyway
  seed=1337;
  /* nodes from the geometry file: apexUs(cl, webIdx, jit) -> {us, sides, half, m} */
  const _apexUs=apexUs;
  apexUs=function(cl,webIdx,jit){
    if(!cl.nodes) return _apexUs(cl,webIdx,jit);
    const us=cl.nodes.slice(), sides=us.map((_,j)=>j%2===0?1:-1);
    let half=us.length>1? Math.min(...us.slice(1).map((u,j)=>u-us[j])) : cl.total;
    half=Math.max(half, P.bead*2.2);
    return {us,sides,half,m:1,K:us.length};
  };
  const out=[]; let webCount=0; const perLayer=[];
  /* foundation (z=0): the slab's linked offset rings */
  if(G.foundation){ const F=G.foundation; const paths=F.paths||[F.pts];
    for(const pth of paths){ const pts=pth.map(p=>({x:p[0],y:p[1]}));
      const L={role:'adhesion',adhesion:'foundation',pts,apexes:[],zBot:0,zTop:A.lh,closed:false,cl:null,bead:0.52,speed:12,wSpan:A.w,ovh:e,nodeGap:null};
      L.len=plen(pts); L.ov=[]; out.push(L); } }
  for(const lay of G.layers){
    const k=lay.k, layRole=P.cycle[k%P.cycle.length];
    let ci=0;
    for(const c of lay.contours){
      /* PER-CONTOUR OVERRIDES (added 2026-09-03 for the MERA plate). Until now one grammar, one wall
         width and one tab applied to the whole build, which is fine for one object and useless for a
         plate whose whole purpose is that tile 5 and tile 6 differ. A contour may now carry its own
         `web` (grammar), `w`, `e`, `lambda` and `role`; anything it does not carry falls back to the
         build's value, so every existing geometry file behaves exactly as before. */
      const role = c.role || layRole;
      const keep = {webType:P.webType, w:P.w, overshoot:P.overshoot, lambda:P.lambda};
      if(c.web!=null)    P.webType   = c.web;
      if(c.w!=null)      P.w         = c.w;
      if(c.e!=null)      P.overshoot = c.e;
      if(c.lambda!=null) P.lambda    = c.lambda;
      const cl={pts:c.pts.map(p=>({x:p[0],y:p[1]})),nrm:c.nrm.map(p=>({x:p[0],y:p[1]})),cum:c.cum,total:c.total,closed:true,kind:'wall',nodes:c.nodes,r:undefined,R:undefined};
      const g= role==='chord' ? chordLayer(cl,lay.zBot,0) : webLayer(cl,lay.zBot,webCount);
      const L={role,pts:g.pts,apexes:g.apexes,zBot:lay.zBot,zTop:lay.zTop,closed:g.closed,cl,bead:c.bead||A.bead,
        speed:lay.zBot===0?12:(c.speed||P.speed),
        wSpan:(c.w!=null?c.w:A.w),ovh:(c.e!=null?c.e:e),webType:P.webType,tile:c.tile,
        nodeGap:role==='web'?webLayer._lastGap:null,contour:ci++,nContours:lay.contours.length};
      L.len=plen(L.pts); out.push(L);
      Object.assign(P, keep);
    }
    /* hole caps: a filled spiral membrane closing a hole that got too small to be walled.
       Same role/handling as the app's dome cap — deliberate same-layer fill, excluded from overlap detection. */
    if(lay.caps) for(const cp of lay.caps){
      const pts=cp.pts.map(p=>({x:p[0],y:p[1]}));
      const L={role:'cap',pts,apexes:[],zBot:lay.zBot,zTop:lay.zTop,closed:false,cl:null,bead:A.bead,speed:P.bridgeSpeed,
        wSpan:A.w,ovh:e,nodeGap:null,capSpan:cp.span_mm};
      L.len=plen(pts); out.push(L);
    }
    if(layRole==='web') webCount++;
    perLayer.push({k,z:lay.zBot,contours:lay.contours.length,a:lay.a,b:lay.b,rho:lay.rho,nodes:lay.contours.reduce((s,c)=>s+c.nodes.length,0)});
  }
  /* Sixteen specimens are not sixteen sequential prints. They share one global Z clock: first all
     contours at z=0, then all at z=lh, and so on. This is the same contour-tree principle used by
     Penjac when several legs exist at one height. Stable sorting preserves each layer's tile order. */
  layers=out.sort((a,b)=>a.zBot-b.zBot);
  for(let i=1;i<layers.length;i++) if(layers[i].zBot<layers[i-1].zBot-1e-6)
    throw new Error(`global Z order violated: ${layers[i].zBot} after ${layers[i-1].zBot}`);
  const globalZLevels=new Set(layers.map(L=>L.zBot.toFixed(4))).size;
  const expectedZLevels=G.layers.filter(l=>l.contours.length||(l.caps&&l.caps.length)).length;
  if(globalZLevels!==expectedZLevels)
    throw new Error(`global Z level mismatch: emitted ${globalZLevels}, geometry ${expectedZLevels}`);
  detectOverlaps();
  let seamOv=0;
  for(const L of layers){ if(L.role!=='chord'||!L.cl||!L.ov.length) continue;
    const sx=clSample(L.cl,L.cl.total-STEP); const keep=[];
    for(const o of L.ov){ if(Math.hypot(o.x-sx.x,o.y-sx.y)<L.wSpan/2+1.2) seamOv++; else keep.push(o); }
    L.ov=keep; }
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9; for(const L of layers) for(const p of L.pts){ if(p.x<mnx)mnx=p.x;if(p.x>mxx)mxx=p.x;if(p.y<mny)mny=p.y;if(p.y>mxy)mxy=p.y; }
  const totalLen=layers.reduce((s,L)=>s+L.len,0), nodes=layers.reduce((s,L)=>s+L.apexes.length,0), ov=layers.reduce((s,L)=>s+L.ov.length,0);
  const ovLayers=layers.filter(L=>L.ov.length).slice(0,12).map(L=>({z:+L.zBot.toFixed(2),role:L.role,ov:L.ov.length,contour:L.contour}));
  const grammarCounts={}; for(const L of layers) if(L.role==='web') grammarCounts[L.webType]=(grammarCounts[L.webType]||0)+1;
  return {name,machine:MACHINES[MACHINE].label,bed_mm:[BED,BEDY],layers:layers.length,
    globalZLevels,expectedZLevels,maxBodiesPerZ:Math.max(...G.layers.map(l=>l.contours.length)),
    size_mm:[+(mxx-mnx+A.bead).toFixed(1),+(mxy-mny+A.bead).toFixed(1),G.summary.H],
    plate_mm:[+(mnx+BED/2).toFixed(1),+(mny+BEDY/2).toFixed(1),+(mxx+BED/2).toFixed(1),+(mxy+BEDY/2).toFixed(1)],
    fitsPlate:(mnx+BED/2)>8&&(mny+BEDY/2)>8&&(mxx+BED/2)<BED-8&&(mxy+BEDY/2)<BEDY-8,
    grammarCounts,
    threadLength_m:+(totalLen/1000).toFixed(1),weldNodes:nodes,unintendedOverlaps:ov,seamClosures:seamOv,overlapSamples:ovLayers,
    kinematic_h:+(totalLen/30/3600).toFixed(2),routeA_estimate_h:+((totalLen/1000)/366.4*32).toFixed(1),
    caps:layers.filter(L=>L.role==='cap').map(L=>({z:+L.zBot.toFixed(2),span:L.capSpan,len:Math.round(L.len)})),
    events:G.summary.events,contourCounts:perLayer.filter((p,i)=>i===0||p.contours!==perLayer[i-1].contours).map(p=>[p.z,p.contours]),
    perLayerSample:perLayer.filter((_,i)=>i%40===0)};
},[geo,grammar,tab,machine,NAME]);
console.log(JSON.stringify(report,null,1));
fs.writeFileSync(path.join(OUT,`${NAME}_report.json`),JSON.stringify({report,geometry:geo.summary},null,2));

if(!report.fitsPlate){
  console.error(`REFUSED — ${report.plate_mm.join(', ')} does not fit ${report.bed_mm.join(' × ')} mm with an 8 mm margin.`);
  await browser.close(); process.exit(1);
}

if(!DRY&&!NOSTL){
  // STL (Route A)
  const total=await page.evaluate(async ()=>{ for(const L of layers){ const g=ribbon(L.pts,(L.bead||P.bead)/2,L.zBot,L.zTop); if(g) L.geo=g; }
    const parts=await buildSTLParts(); window.__out=new Uint8Array(await new Blob(parts).arrayBuffer()); return window.__out.length; });
  const stl=path.join(OUT,`${NAME}.stl`), fd=fs.openSync(stl,'w'), CH=1<<20;
  for(let off=0;off<total;off+=CH){ const b64=await page.evaluate(([o,n])=>{const u=window.__out.subarray(o,o+n);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s);},[off,Math.min(CH,total-off)]); fs.writeSync(fd,Buffer.from(b64,'base64')); }
  fs.closeSync(fd); console.log('STL',stl,total,'bytes');
}
if(!DRY){
  // G-code (Route B) with the harvested A2L start/end blocks
  if(HEAD){
    const head=fs.readFileSync(HEAD,'utf8'), foot=FOOT?fs.readFileSync(FOOT,'utf8'):null;
    const txt=await page.evaluate(async ([head,foot])=>{ document.getElementById('gHead').value=head; if(foot) document.getElementById('gFoot').value=foot; return await buildGcodeText(); },[head,foot]);
    const gc=path.join(OUT,`${NAME}_routeB.gcode`); fs.writeFileSync(gc,txt); console.log('GCODE',gc,txt.length,'bytes',txt.split('\n').length,'lines');

    /* THE GATE. Added 2026-09-03, after the Šuma 4×4 v2 was printed and photographed: this builder
       had no gate at all, and the object it shipped carried twelve membranes laid over open air —
       the same failure as WEFT-01, in plastic this time. The G-code goes straight to check_gcode.py
       and if the gate refuses, the output is deleted. Nothing that fails the gate is allowed to exist. */
    const A=geo.summary.args;
    const gateArgs=[path.resolve('check_gcode.py'), gc, '--bead',String(A.bead),
      '--maxbridge',String(A.maxbridge||12), '--maxislands',String(MAXISLANDS),
      '--json',path.join(OUT,`${NAME}_gate.json`), '--max-report','20'];
    try{
      execFileSync(PYTHON, gateArgs, {stdio:'inherit'});
      console.log('GATE passed');
      /* the harvested start block carries the statistics of the print it came from; rewrite them
         from this file's own moves before anything downstream reads them. */
      try{ execFileSync(PYTHON,[path.resolve('fix_header.py'),gc],{stdio:'inherit'}); }
      catch(e){ console.error('header rewrite failed (not fatal):',e.message); }

      /* BELIEF vs MEASUREMENT. The 4x4's generator believed its membranes were 0.82 anchored while
         they hung six to twenty-nine millimetres above nothing; nobody compared the two numbers until
         after the object was in plastic. A disagreement is not a warning - it means one of the two is
         modelling a machine that does not exist - so a build that passes the gate but disagrees with
         it is refused exactly like one that fails. */
      const gate=JSON.parse(fs.readFileSync(path.join(OUT,`${NAME}_gate.json`),'utf8'));
      const declared=[];
      for(const lay of geo.layers) if(lay.caps) for(const c of lay.caps)
        declared.push({z:lay.zBot,cx:c.cx+report.bed_mm[0]/2,cy:c.cy+report.bed_mm[1]/2,
                       believed:c.anchoredFrac});
      const TOL=0.10; const rows=[];
      for(const mm of (gate.membranes||[])){
        let best=null,bd=1e9;
        for(const d of declared){ const q=Math.hypot(d.cx-mm.at[0],d.cy-mm.at[1]); if(q<bd){bd=q;best=d;} }
        rows.push({z:mm.z,at:mm.at,measured:mm.anchoredFrac,
                   believed:(bd<=3.0&&best&&best.believed!=null)?best.believed:null,dist:+bd.toFixed(2)});
      }
      const undeclared=rows.filter(r=>r.believed===null);
      const diverged=rows.filter(r=>r.believed!==null&&Math.abs(r.believed-r.measured)>TOL);
      console.log(`membranes: ${rows.length} emitted, ${undeclared.length} undeclared, ${diverged.length} divergent (tol ${TOL})`);
      for(const r of rows) console.log(`   z ${r.z}  at [${r.at}]  believed ${r.believed===null?'—':r.believed.toFixed(3)}  measured ${r.measured.toFixed(3)}`);
      if(undeclared.length||diverged.length){
        console.error('BELIEF/MEASUREMENT DIVERGENCE — the generator and the gate do not describe the same object.');
        throw new Error('membrane anchoring: generator and gate disagree');
      }
    }catch(err){
      console.error('GATE FAILED — deleting the output. Nothing that fails the gate is allowed to exist.');
      if(KEEP){ fs.renameSync(gc, gc+'.REJECTED'); console.error('  (--keep: left as '+gc+'.REJECTED for diagnosis)'); }
      else for(const f of [gc, path.join(OUT,`${NAME}.stl`)]) if(fs.existsSync(f)) fs.unlinkSync(f);
      await browser.close(); process.exit(1);
    }
  } else {
    console.error('NOTE: no --head given, so no G-code was written and the gate did not run.');
  }
}
await browser.close();
