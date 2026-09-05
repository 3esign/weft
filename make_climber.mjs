/* WEFT · P2 "Penjač" builder — feeds the per-layer contours, weld nodes, wall width, grammar/tab rhythm
   and closure caps from climber_geometry.py into the app's own chord/web/ribbon/STL/G-code code.
   Nothing in index.html is modified; apexUs is overridden so the nodes come from the geometry file,
   and P.w / P.webType / P.overshoot are set per layer (variable wall thickness + rhythm bands).

   WEFT-01: this builder refuses. The G-code it writes is handed straight to check_gcode.py, and if
   the gate fails the output is deleted and the process exits non-zero. Nothing ships unchecked.

   usage: node make_climber.mjs --geo /tmp/climber.json --name P2_penjac --out DIR
                                [--head ender_start.gcode --foot ender_end.gcode]
                                [--allow-experimental-membrane] [--nostl] [--dry]  */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';
import { freshReportPath, validateMembraneGeometry, writeJsonAtomic } from './membrane_contract.mjs';
const WEFT_ROOT=path.dirname(fileURLToPath(import.meta.url));
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k); return i>0?process.argv[i+1]:d;};
const GEO=arg('geo','/tmp/climber.json'), NAME=arg('name','P2_penjac');
const DRY=process.argv.includes('--dry'), NOSTL=process.argv.includes('--nostl');
const KEEP=process.argv.includes('--keep');   // diagnosis only: leave a failed build on disk to look at
const ALLOW_EXPERIMENTAL_MEMBRANE=process.argv.includes('--allow-experimental-membrane');
const PYTHON=process.env.WEFT_PYTHON||'python3';
const OUT=path.resolve(arg('out','/tmp/P2'));
const HEAD=arg('head',null), FOOT=arg('foot',null);
const BX=+arg('bx',220), BY=+arg('by',220), MACH=arg('machine','ender');
const geo=JSON.parse(fs.readFileSync(GEO,'utf8'));
validateMembraneGeometry(geo,{rootDir:WEFT_ROOT,allowExperimental:ALLOW_EXPERIMENTAL_MEMBRANE,machine:MACH});
const REPORT_PATH=freshReportPath(OUT,NAME);
fs.mkdirSync(OUT,{recursive:true});

const browser=await chromium.launch({executablePath:process.env.WEFT_CHROMIUM||undefined,
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const page=await browser.newPage({viewport:{width:1400,height:900}});
page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
await page.goto(pathToFileURL(path.join(WEFT_ROOT,'index.html')).href,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:20000});

const report=await page.evaluate(async ([G,name,bx,by,mach,allowExperimental])=>{
  const A=G.summary.args;
  MACHINES.ender={id:'ender',label:'Creality Ender-3 V4',bx,by,bedMax:100,hotMax:300};
  if(!MACHINES[mach]) throw new Error('unknown machine: '+mach);
  setMachine(mach);
  Object.assign(P,{mode:'wall',lh:A.lh,bead:A.bead,w:4,overshoot:1,webType:'staple',cycle:['chord','web'],
    amp:0,ampF:1,altPhase:false,autoLOD:true,minGap:1.2,gradeLean:false,dwell:0.55,jitter:0,flowBoost:1.2,
    maxBridge:A.maxbridge||12,checkOv:true,speed:25,bridgeSpeed:15,temp:220,bed:60,fan:100,
    firstLayerBead:A.bead+0.06,firstLayerSpeed:12,adhesion:'foundation',adhesionWidth:A.foundation});
  if(mach!=='ender'){ P.temp=220; P.bed=55; }   // the harvested Bambu block carries its own temps
  P.lambda=8; seed=1337;
  const _apexUs=apexUs;
  apexUs=function(cl,webIdx,jit){
    if(!cl.nodes) return _apexUs(cl,webIdx,jit);
    const us=cl.nodes.slice(), sides=us.map((_,j)=>j%2===0?1:-1);
    let half=us.length>1? Math.min(...us.slice(1).map((u,j)=>u-us[j])) : cl.total;
    half=Math.max(half,P.bead*2.2);
    return {us,sides,half,m:1,K:us.length};
  };
  /* centre the figure on the plate (its own bbox is off-axis: the climber traverses).
     Measured over what will actually be emitted — layers above the head carry no wall. */
  const bb=[1e9,1e9,-1e9,-1e9];
  const eat=p=>{ if(p[0]<bb[0])bb[0]=p[0]; if(p[1]<bb[1])bb[1]=p[1]; if(p[0]>bb[2])bb[2]=p[0]; if(p[1]>bb[3])bb[3]=p[1]; };
  if(G.foundation) for(const pth of G.foundation.paths) for(const p of pth) eat(p);
  for(const lay of G.layers){
    for(const c of lay.contours) for(const p of c.pts) eat(p);
    if(lay.caps) for(const cp of lay.caps) for(const p of cp.pts) eat(p); }
  const ox=-(bb[0]+bb[2])/2, oy=-(bb[1]+bb[3])/2;
  const shift=p=>({x:p[0]+ox, y:p[1]+oy});

  const bands=[]; const W_FLOOR=0.9, TAB_FLOOR=0.4, W_RATE=0.36, TAB_RATE=0.18;
  const found=[];
  if(G.foundation) for(const pth of G.foundation.paths){
    const pts=pth.map(shift);
    const L={role:'adhesion',adhesion:'foundation',pts,apexes:[],zBot:0,zTop:A.lh,closed:false,cl:null,
      bead:P.firstLayerBead,speed:P.firstLayerSpeed,wSpan:4,ovh:1,nodeGap:null,gk:-1};
    L.len=plen(pts); L.ov=[]; found.push(L);
  }
  const geoLayers=G.layers.filter(l=>l.contours.length||(l.caps&&l.caps.length));
  const webIdxOf=new Map(); { let n=0;
    for(const lay of geoLayers){ if(P.cycle[lay.k%P.cycle.length]==='web'){ webIdxOf.set(lay.k,n); n++; } } }

  /* The seam of a closed ring: the head of the path and its tail are the same place on the body.
     That meeting is the closure, not a collision. The web reaches a tab deeper than the chord, so
     the window has to include the tab. Anything outside it stays flagged. */
  let seamOv=0;
  const dropSeam=(L)=>{ if(!L.cl||!L.ov||!L.ov.length) return;
    const sx=clSample(L.cl,L.cl.total-STEP); const keep=[];
    const rad=(L.wSpan||4)/2 + (L.role==='web'?(L.ovh||0):0) + 1.2;
    for(const o of L.ov){ if(Math.hypot(o.x-sx.x,o.y-sx.y)<rad) seamOv++; else keep.push(o); }
    L.ov=keep; };

  /* Emit one geometry layer at a given scale of its wall and tab. */
  const emitOne=(lay,sc,forceSingle)=>{
    const w=W_FLOOR+sc*(lay.w-W_FLOOR), tb=TAB_FLOOR+sc*(lay.tab-TAB_FLOOR);
    P.w=w; P.webType=lay.web; P.overshoot=tb;
    const role=P.cycle[lay.k%P.cycle.length]; const made=[];
    /* Where the body is too thin to weave — the first layers of a merge, a neck a millimetre wide —
       the lattice degenerates to what it is made of: ONE thread on the centreline. Two rails cannot
       fit, so they are not forced to; the single pass ties the rails below to the rails above (they
       sit within half a floor-wall of the centreline) and nothing can touch itself. This is the
       honest bottom of the wall, not an exemption: it is reported, and the gate still judges it. */
    // the geometry declares a layer single where the neck is a sliver; the builder may also be
    // driven there by overlaps that thinning could not clear
    const single = !!forceSingle || !!lay.single;
    for(const c of lay.contours){
      const cl={pts:c.pts.map(shift),nrm:c.nrm.map(p=>({x:p[0],y:p[1]})),cum:c.cum,total:c.total,
                closed:true,kind:'wall',nodes:c.nodes};
      let g;
      if(single){
        const pts=[]; for(let u=0;u<cl.total-STEP*0.5;u+=STEP) pts.push(mapUV(cl,u,0));
        const ap=(cl.nodes||[]).map(u=>{const q=mapUV(cl,u,0); return {x:q.x,y:q.y,z:lay.zBot};});
        g={pts,apexes:ap,closed:true};
      } else {
        g= role==='chord' ? chordLayer(cl,lay.zBot,0) : webLayer(cl,lay.zBot,webIdxOf.get(lay.k)||0);
      }
      const L={role,pts:g.pts,apexes:g.apexes,zBot:lay.zBot,zTop:lay.zTop,closed:g.closed,cl,gk:lay.k,
        bead:A.bead,speed:lay.zBot===0?P.firstLayerSpeed:P.speed,wSpan:w,ovh:tb,webType:lay.web,
        nodeGap:(!single&&role==='web')?webLayer._lastGap:null,phase:lay.phase,scale:sc,single,
        /* WEFT-02 telemetry: crossings this web could not place, and the longest arc the chord
           above it has to span with nothing under it. */
        skipped:(!single&&role==='web')?webLayer._skipped:null,
        maxRail:(!single&&role==='web')?webLayer._maxRail:null};
      L.len=plen(L.pts); made.push(L);
    }
    if(lay.caps) for(const cp of lay.caps){
      const pts=cp.pts.map(shift);
      const L={role:'cap',pts,apexes:[],zBot:lay.zBot,zTop:lay.zTop,closed:false,cl:null,bead:A.bead,
        speed:P.bridgeSpeed,wSpan:w,ovh:tb,nodeGap:null,capKind:cp.kind,capSpan:cp.span_mm,gk:lay.k,
        membraneProcess:cp.process,membraneStatus:cp.physicalStatus,membraneEvidence:cp.evidence??null};
      L.len=plen(pts); made.push(L);
    }
    layers=made; detectOverlaps(); for(const L of made) dropSeam(L);
    return made;
  };

  /* THE LAST NEGOTIATION HAPPENS HERE, where the emitted thread actually is.
     The geometry file predicts self-approach from ideal offsets; the thread it gets is filleted and
     resampled, and at a sharp neck the two differ by a couple of tenths — enough to leave 40-odd
     places where the thread touches itself. Rather than widen the prediction until it is useless,
     the builder measures the real path and pulls the wall and tab down on exactly the layers that
     need it, a layer at a time, until nothing touches. A layer that still touches at the floor is
     not fixable by thinning and the build is refused. */
  const scale=new Map(); const built=new Map(); const singles=new Set();
  for(const lay of geoLayers) built.set(lay.k, emitOne(lay,1));
  let passes=0, stuck=[];
  for(;passes<40;passes++){
    const bad=[];
    for(const lay of geoLayers){
      const n=built.get(lay.k).reduce((s,L)=>s+(L.ov?L.ov.length:0),0);
      if(n) bad.push(lay);
    }
    if(!bad.length) break;
    let moved=false; stuck=[];
    for(const lay of bad){
      const s0=scale.get(lay.k)??1;
      if(s0<=0.001){                      // the floor did not save it: one thread, or nothing
        if(!singles.has(lay.k)){ singles.add(lay.k); built.set(lay.k, emitOne(lay,0,true)); moved=true; }
        else stuck.push(lay.k);
        continue; }
      const s1=Math.max(0, s0*0.78-0.03);
      scale.set(lay.k,s1); built.set(lay.k, emitOne(lay,s1)); moved=true;
    }
    if(!moved) break;
    /* WEFT-04, in the builder too: thinning one layer and leaving its neighbours thick moves the
       chord rail sideways by half the difference, and a rail that moves further than a bead starts
       in mid-air. Any layer pulled down drags its neighbours down with it, so the taper is a ramp. */
    const ks=geoLayers.map(l=>l.k);
    const wOf=k=>{const l=geoLayers.find(x=>x.k===k),sv=scale.get(k)??1;
      return [W_FLOOR+sv*(l.w-W_FLOOR), TAB_FLOOR+sv*(l.tab-TAB_FLOOR)];};
    const wArr=ks.map(k=>wOf(k)[0]), tArr=ks.map(k=>wOf(k)[1]);
    for(let i=1;i<ks.length;i++){ wArr[i]=Math.min(wArr[i],wArr[i-1]+W_RATE); tArr[i]=Math.min(tArr[i],tArr[i-1]+TAB_RATE); }
    for(let i=ks.length-2;i>=0;i--){ wArr[i]=Math.min(wArr[i],wArr[i+1]+W_RATE); tArr[i]=Math.min(tArr[i],tArr[i+1]+TAB_RATE); }
    for(let i=0;i<ks.length;i++){
      const l=geoLayers[i], denom=Math.max(1e-6,l.w-W_FLOOR);
      const sNew=Math.max(0,Math.min(1,(wArr[i]-W_FLOOR)/denom));
      const sOld=scale.get(l.k)??1;
      if(sNew<sOld-1e-4){ scale.set(l.k, sNew); built.set(l.k, emitOne(l, sNew, singles.has(l.k))); }
    }
  }
  const thinned=[...scale.entries()].filter(([,v])=>v<0.999);
  const out=found.slice(); let lastPhase=null;
  for(const lay of geoLayers){
    if(lay.phase!==lastPhase){ bands.push({z:lay.zBot,phase:lay.phase,web:lay.web,tab:lay.tab,w:lay.w}); lastPhase=lay.phase; }
    for(const L of built.get(lay.k)) out.push(L);
  }
  layers=out.sort((a,b)=>a.zBot-b.zBot);
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9,mz=0;
  for(const L of layers){ mz=Math.max(mz,L.zTop); for(const p of L.pts){
    if(p.x<mnx)mnx=p.x; if(p.x>mxx)mxx=p.x; if(p.y<mny)mny=p.y; if(p.y>mxy)mxy=p.y; } }
  const totalLen=layers.reduce((s,L)=>s+L.len,0), nodes=layers.reduce((s,L)=>s+L.apexes.length,0),
        ov=layers.reduce((s,L)=>s+L.ov.length,0);
  const caps=layers.filter(L=>L.role==='cap');
  const webs=layers.filter(L=>L.role==='web');
  const wEmit=layers.filter(L=>L.wSpan!=null&&L.cl).map(L=>L.wSpan);
  const railMax=Math.max(0,...webs.map(L=>L.maxRail||0));
  const skippedRungs=webs.reduce((s,L)=>s+(L.skipped||0),0);
  const deadWebs=webs.filter(L=>!L.apexes.length).length;
  return {name,machine:MACHINES[MACHINE].label,bed:[BED,BEDY],layers:layers.length,
    experimentalMembraneOverride:allowExperimental&&caps.some(L=>L.membraneStatus==='experimental'),
    weave:{maxUnweldedRail_mm:+railMax.toFixed(1),skippedRungs,webLayersWithNoCrossing:deadWebs,
           maxBridge_mm:P.maxBridge},
    size_mm:[+(mxx-mnx+P.bead).toFixed(1),+(mxy-mny+P.bead).toFixed(1),+mz.toFixed(1)],
    plate_mm:[+(mnx+BED/2).toFixed(1),+(mny+BEDY/2).toFixed(1),+(mxx+BED/2).toFixed(1),+(mxy+BEDY/2).toFixed(1)],
    fitsPlate: (mnx+BED/2)>8 && (mny+BEDY/2)>8 && (mxx+BED/2)<BED-8 && (mxy+BEDY/2)<BEDY-8,
    threadLength_m:+(totalLen/1000).toFixed(1),weldNodes:nodes,unintendedOverlaps:ov,seamClosures:seamOv,
    kinematic_h:+(totalLen/P.speed/3600).toFixed(2),
    caps:caps.map(L=>({z:+L.zBot.toFixed(1),kind:L.capKind,span_mm:L.capSpan,
      process:L.membraneProcess,physicalStatus:L.membraneStatus,evidence:L.membraneEvidence})),
    bands,wallWidth:{emitted_min:+Math.min(...wEmit).toFixed(2),emitted_max:+Math.max(...wEmit).toFixed(2),
      thinnedLayers:thinned.length,minScale:thinned.length?+Math.min(...thinned.map(t=>t[1])).toFixed(3):1,
      stuckAtFloor:stuck.length,passes,
      residual:geoLayers.filter(l=>built.get(l.k).reduce((s2,L)=>s2+(L.ov?L.ov.length:0),0))
        .map(l=>({z:+l.zBot.toFixed(1),phase:l.phase,web:l.web,scale:+(scale.get(l.k)??1).toFixed(3),
                  ov:built.get(l.k).reduce((s2,L)=>s2+(L.ov?L.ov.length:0),0)})),
      singleThreadLayers:[...singles].map(k=>{const l=geoLayers.find(x=>x.k===k); return l?+l.zBot.toFixed(1):k;}),
      stuckAt:stuck.map(k=>{const l=geoLayers.find(x=>x.k===k);
        return l?{z:+l.zBot.toFixed(1),phase:l.phase,web:l.web,w:+l.w.toFixed(2),tab:+l.tab.toFixed(2),
                  ov:built.get(k).reduce((s,L)=>s+(L.ov?L.ov.length:0),0),
                  at:(built.get(k).find(L=>L.ov&&L.ov.length)||{ov:[]}).ov.slice(0,3).map(o=>[+o.x.toFixed(1),+o.y.toFixed(1)])}:k;})},
    geometryWall:G.summary.wallWidth,supportCheck:G.summary.supportCheck};
},[geo,NAME,BX,BY,MACH,ALLOW_EXPERIMENTAL_MEMBRANE]);
console.log(JSON.stringify(report,null,1));

/* the weave has to hold before anything is written */
const wv=report.weave, hard=[];
if(!report.fitsPlate) hard.push(`does not fit the plate with an 8 mm margin: ${report.plate_mm}`);
if(wv.webLayersWithNoCrossing) hard.push(`${wv.webLayersWithNoCrossing} web layers placed no crossing at all`);
if(wv.maxUnweldedRail_mm>wv.maxBridge_mm) hard.push(
  `a chord rail runs ${wv.maxUnweldedRail_mm} mm with no weld under it, over the ${wv.maxBridge_mm} mm limit`);
if(report.unintendedOverlaps) hard.push(
  `${report.unintendedOverlaps} unintended same-layer overlaps survive at the wall floor `+
  `(${report.wallWidth.stuckAtFloor} layers could not be thinned any further)`);
if(hard.length){
  console.error('REFUSED — the weave did not pass:'); for(const h of hard) console.error('  * '+h);
  await browser.close(); process.exit(1);
}

if(!DRY&&!NOSTL){
  const total=await page.evaluate(async ()=>{ for(const L of layers){ const g=ribbon(L.pts,(L.bead||P.bead)/2,L.zBot,L.zTop); if(g) L.geo=g; }
    const parts=await buildSTLParts(); window.__out=new Uint8Array(await new Blob(parts).arrayBuffer()); return window.__out.length; });
  const stl=path.join(OUT,`${NAME}.stl`), fd=fs.openSync(stl,'w'), CH=1<<20;
  for(let off=0;off<total;off+=CH){ const b64=await page.evaluate(([o,n])=>{const u=window.__out.subarray(o,o+n);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s);},[off,Math.min(CH,total-off)]); fs.writeSync(fd,Buffer.from(b64,'base64')); }
  fs.closeSync(fd); console.log('STL',stl,total,'bytes');
}
if(!DRY&&HEAD){
  const head=fs.readFileSync(HEAD,'utf8'), foot=FOOT?fs.readFileSync(FOOT,'utf8'):null;
  const txt=await page.evaluate(async ([head,foot])=>{ document.getElementById('gHead').value=head;
    if(foot) document.getElementById('gFoot').value=foot; return await buildGcodeText(); },[head,foot]);
  const gc=path.join(OUT,`${NAME}.gcode`); fs.writeFileSync(gc,txt);
  console.log('GCODE',gc,txt.length,'bytes',txt.split('\n').length,'lines');
  /* THE GATE. The artifact the machine will execute is the only thing worth checking. */
  const A=geo.summary.args;
  const gateArgs=[path.join(WEFT_ROOT,'check_gcode.py'), gc, '--bead',String(A.bead),
    '--maxbridge',String(A.maxbridge||12), '--maxislands','1', '--json',path.join(OUT,`${NAME}_gate.json`),
    '--max-report','12'];
  try{
    execFileSync(PYTHON, gateArgs, {stdio:'inherit'});
    console.log('GATE passed');
    /* the harvested start block carries the statistics of the print it came from; rewrite them
       from this file's own moves before anything downstream reads them. */
    try{ execFileSync(PYTHON,[path.join(WEFT_ROOT,'fix_header.py'),gc],{stdio:'inherit'}); }
    catch(e){ console.error('header rewrite failed (not fatal):',e.message); }
  }catch(err){
    console.error('GATE FAILED — deleting the output. Nothing that fails the gate is allowed to exist.');
    if(KEEP){ fs.renameSync(gc, gc+'.REJECTED'); console.error('  (--keep: left as '+gc+'.REJECTED for diagnosis)'); }
    else for(const f of [gc, path.join(OUT,`${NAME}.stl`)]) if(fs.existsSync(f)) fs.unlinkSync(f);
    await browser.close(); process.exit(1);
  }
}
writeJsonAtomic(REPORT_PATH,{report,geometry:geo.summary});
await browser.close();
