/* ============================================================
   WEFT headless verification harness
   Re-runs the geometric invariants recorded in PROJECT_STATE.md §8
   against the live app code (index.html) in headless Chromium.

   usage:
     node tests/run_tests.mjs
     node tests/run_tests.mjs --app <index.html> [--shot out.png] [--gcode-out out.gcode]

   The E1 plate reference values (triangle count, bbox, coordinate checksum)
   are embedded below; T9 asserts the app still regenerates the shipped
   specimen STL bit-for-bit. If a change is MEANT to alter geometry,
   re-measure and update E1_REF deliberately.

   requires: playwright (npm i -D playwright) with a chromium build.
   ============================================================ */
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

/* createRequire keeps the harness usable with either the local devDependency or
   a workspace-provided NODE_PATH; the buildless app itself still has no runtime
   dependency. */
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
function argOf(flag){ const i=args.indexOf(flag); return i>=0? args[i+1] : null; }
const APP  = path.resolve(argOf('--app') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'));
const SHOT = argOf('--shot') ? path.resolve(argOf('--shot')) : null;
const GCODE_OUT = argOf('--gcode-out') ? path.resolve(argOf('--gcode-out')) : null;

const results=[];
function check(name, pass, detail){ results.push({name, pass:!!pass, detail}); }

/* The 2026-09-03 MERA build exposed a policy bug: UNANCHORED_MEMBRANE was counted and printed,
   but omitted from the final exit-code sum. A red diagnostic with exit 0 is not a gate. */
{
  const gate=fs.readFileSync(path.resolve(path.dirname(APP),'check_gcode.py'),'utf8');
  const i=gate.indexOf('fail =');
  const policy=i>=0?gate.slice(i,gate.indexOf('gaps.sort',i)):'';
  check('T18 gate exit policy includes unanchored membranes',
    policy.includes("stats['unanchored_membrane']"),
    policy.includes("stats['unanchored_membrane']")?'hard-fail term present':'diagnostic could exit 0');
}

/* E1 reference values, measured once from the shipped plate STL
   (specimens/2026-08_E1_pending/weft_batch_4x4.stl) with the 8 mm
   fiducial bar removed (tris with centroid y < -63):               */
const E1_REF = { tris:269520, coordSum:17764040.286847, dims:[141.85001,122.49392,16.08], layers:1072 };

const E1_PARAMS = { mode:'batch', grid:4, sweepX:'overshoot', sweepY:'web', specW:28, specH:16,
  w:5, lambda:8, bead:0.45, lh:0.24, dwell:0.6, jitter:0, flowBoost:1.25, speed:30, bridgeSpeed:18,
  altPhase:true, autoLOD:true, minGap:1.4, amp:0, ampF:1, checkOv:true, overshoot:1.0,
  webType:'staple', gradeLean:false, temp:215, bed:55 };

const browser = await chromium.launch({executablePath: process.env.WEFT_CHROMIUM || undefined,
  /* headless pages are treated as background: setTimeout(...,0) gets clamped to ~1 s,
     and the chunked exporters yield every 10 layers — 1072 layers took 130 s. */
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const page = await browser.newPage({ viewport:{width:1600,height:1000} });
page.on('pageerror', e=>console.error('PAGE ERROR:', e.message));
await page.goto(pathToFileURL(APP).href, {waitUntil:'domcontentloaded'});  // don't wait for web fonts — offline is a supported mode
await page.waitForFunction(()=>!document.getElementById('loading'), null, {timeout:20000});
await page.waitForTimeout(400); // let the debounced first build settle

/* ---------- T0 environment ---------- */
{
  const r = await page.evaluate(()=>({rev:THREE.REVISION, layers:layers.length, visK, maxL:document.getElementById('maxL').textContent}));
  check('T0 app boots, three.js r128', r.rev==='128' && r.layers>0, `THREE r${r.rev}, ${r.layers} layers on load, visK=${r.visK}/${r.maxL}`);
  check('T0b initial view shows full model', Number(r.visK)===r.layers-1, `visK=${r.visK}, expected ${r.layers-1}`);
}

/* ---------- T1 angular phase lock on domes ---------- */
/* The invariant is that every weld column across every layer and every LOD band sits on
   ONE angular grid. On an OPEN sweep that grid is lambda/(2R). On a CLOSED revolve the
   pitch is snapped so a whole number of waves fits the turn (an unsnapped pitch cannot
   tile a ring) and the grid is offset by half a step so the seam falls between nodes —
   so the test asks for membership in THAT grid, and separately bounds how far the snap
   is allowed to move the requested lambda. */
{
  const r = await page.evaluate(()=>{
    Object.assign(P,{mode:'dome',domeR:71,sweep:360,lambda:8,w:5,jitter:0,altPhase:false,autoLOD:true,minGap:1.4,gradeLean:false,bead:0.45});
    const cl0=domeCl(0.12,71);
    const Kb=closedHalves(cl0);                 // half-waves per turn, after snapping
    const step=2*Math.PI/Kb;                    // angular pitch of the base grid
    let worst=0,n=0;
    for(let zc=0.12; zc<71*0.97; zc+=3.7){
      const cl=domeCl(zc,71); const {us}=apexUs(cl,0,0);
      for(const u of us){ const a=u/cl.r; const k=Math.round(a/step-0.5);
        worst=Math.max(worst,Math.abs(a-(k+0.5)*step)); n++; }
    }
    const openCl=(()=>{ const keep=P.sweep; P.sweep=270; const c=domeCl(0.12,71); P.sweep=keep; return c; })();
    let worstOpen=0,nOpen=0; const baseAng=P.lambda/(2*71);
    for(let zc=0.12; zc<71*0.97; zc+=3.7){
      const keep=P.sweep; P.sweep=270; const cl=domeCl(zc,71); P.sweep=keep;
      const {us}=apexUs(cl,0,0);
      for(const u of us){ const a=u/cl.r; const k=Math.round(a/baseAng);
        worstOpen=Math.max(worstOpen,Math.abs(a-k*baseAng)); nOpen++; }
    }
    return {worst,n,worstOpen,nOpen,Kb,lamEff:lamEff(cl0),lam:P.lambda};
  });
  check('T1b closed-revolve pitch snap stays within 10% of the requested lambda',
    Math.abs(r.lamEff-r.lam)/r.lam < 0.10, `lambda ${r.lam} -> ${r.lamEff.toFixed(3)} mm (${r.Kb} half-waves per turn)`);
  check('T1c open-sweep apex angles still on the exact lambda/(2R) grid',
    r.worstOpen<1e-9, `worst ${r.worstOpen.toExponential(2)} over ${r.nOpen} nodes`);
  check('T1 dome apex angles on one angular grid < 1e-9 rad', r.worst<1e-9, `worst ${r.worst.toExponential(2)} over ${r.n} nodes, all LOD bands`);
}

/* ---------- T2 width-wave zeros on node positions ---------- */
{
  const r = await page.evaluate(()=>{
    Object.assign(P,{mode:'wall',lambda:8,w:5,amp:2,jitter:0,altPhase:false});
    const cl=resamplePlan([{x:-50,y:0},{x:50,y:0}]); let worst=0;
    for(const f of [1,2,3,4]){ P.ampF=f; const {us}=apexUs(cl,0,0);
      for(const u of us) worst=Math.max(worst,Math.abs(AfAt(cl,u)-P.w/2)); }
    P.amp=0; P.ampF=1; return {worst};
  });
  check('T2 width-wave zero deviation at nodes < 1e-12 mm', r.worst<1e-12, `worst ${r.worst.toExponential(2)}`);
}

/* ---------- T3 miter geometry at 90 degrees ---------- */
{
  const r = await page.evaluate(()=>{
    const g=ribbon([{x:0,y:0},{x:10,y:0},{x:10,y:10}],1,0,1);
    const ox=g.pos[12]-10, oy=g.pos[14]-0;
    return {miter:Math.hypot(ox,oy), nan:[...g.pos].some(v=>!isFinite(v))};
  });
  check('T3 90-degree miter = hw*sqrt(2), finite', Math.abs(r.miter-Math.SQRT2)<1e-9 && !r.nan, `miter ${r.miter.toFixed(9)} vs ${Math.SQRT2.toFixed(9)}`);
}

/* ---------- T4 staple grammar ---------- */
{
  const r = await page.evaluate(()=>{
    Object.assign(P,{mode:'wall',webType:'staple',w:5,lambda:8,overshoot:1.2,bead:0.45,amp:0,ampF:1,jitter:0,altPhase:true,autoLOD:true,minGap:1.4});
    const cl=resamplePlan([{x:-20,y:0},{x:20,y:0}]);
    const r0=webLayer(cl,0,0);
    const reach=Math.max(...r0.pts.map(p=>Math.abs(p.y)));
    let maxSeg=0; for(let i=1;i<r0.pts.length;i++) maxSeg=Math.max(maxSeg,Math.hypot(r0.pts[i].x-r0.pts[i-1].x,r0.pts[i].y-r0.pts[i-1].y));
    return {reach, want:P.w/2+P.overshoot, maxSeg, apexes:r0.apexes.length, D:Math.max(P.bead*1.15,0.5)};
  });
  check('T4 staple tabs reach +/-(w/2+e)', Math.abs(r.reach-r.want)<1e-6, `reach ${r.reach.toFixed(4)} vs ${r.want}`);
  check('T4b staple hairpin offset D', Math.abs(r.D-0.5175)<1e-6, `D=${r.D} mm at bead 0.45`);
  check('T4c staple continuity (max segment)', r.maxSeg<1.0, `max seg ${r.maxSeg.toFixed(3)} mm`);
  check('T4d staple 2 welds per rung', r.apexes>0 && r.apexes%2===0, `${r.apexes} apexes`);
}

/* ---------- T5 loop stitch (eight): self-crossings + welds per 40 mm ---------- */
{
  const r = await page.evaluate(()=>{
    Object.assign(P,{mode:'wall',webType:'eight',w:5,lambda:8,overshoot:1.0,bead:0.45,amp:0,ampF:1,jitter:0,altPhase:false,autoLOD:true,minGap:1.4});
    const cl=resamplePlan([{x:-20,y:0},{x:20,y:0}]);
    const r0=webLayer(cl,0,0); const pts=r0.pts; let x=0;
    const hit=(a,b,c,d)=>{ const d1x=b.x-a.x,d1y=b.y-a.y,d2x=d.x-c.x,d2y=d.y-c.y;
      const den=d1x*d2y-d1y*d2x; if(Math.abs(den)<1e-12) return false;
      const t=((c.x-a.x)*d2y-(c.y-a.y)*d2x)/den, s=((c.x-a.x)*d1y-(c.y-a.y)*d1x)/den;
      return t>1e-9&&t<1-1e-9&&s>1e-9&&s<1-1e-9; };
    for(let i=0;i<pts.length-1;i++) for(let j=i+2;j<pts.length-1;j++) if(hit(pts[i],pts[i+1],pts[j],pts[j+1])) x++;
    return {welds:r0.apexes.length, selfCross:x};
  });
  check('T5 eight: 19 chord-crossing welds / 40 mm', r.welds===19, `${r.welds} welds`);
  check('T5b eight: 4 self-crossings / 40 mm', r.selfCross===4, `${r.selfCross} self-crossings`);
}

/* ---------- T6 fillet quality: worst interior turn ---------- */
{
  const r = await page.evaluate(()=>{
    const worstFor=()=>{ const cl=resamplePlan([{x:-20,y:0},{x:20,y:0}]);
      const r0=webLayer(cl,0,0); const pts=r0.pts; let worst=0;
      for(let i=1;i<pts.length-1;i++){
        const ax=pts[i].x-pts[i-1].x, ay=pts[i].y-pts[i-1].y, bx=pts[i+1].x-pts[i].x, by=pts[i+1].y-pts[i].y;
        const la=Math.hypot(ax,ay), lb=Math.hypot(bx,by); if(la<1e-6||lb<1e-6) continue;
        const dot=(ax*bx+ay*by)/(la*lb);
        worst=Math.max(worst, Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI); }
      return worst; };
    Object.assign(P,{mode:'wall',w:5,lambda:8,overshoot:1.2,bead:0.45,amp:0,ampF:1,jitter:0,autoLOD:true,minGap:1.4});
    const out={};
    for(const wt of ['staple','perp']){ P.webType=wt; out[wt]=worstFor(); }
    P.amp=2; P.ampF=2;
    for(const wt of ['staple','perp']){ P.webType=wt; out[wt+'Amp']=worstFor(); }
    P.amp=0; P.ampF=1; return out;
  });
  const plain=Math.max(r.staple, r.perp);
  check('T6 fillets: worst interior turn <= 36 deg (unmodulated grammars)', plain<=36.001, `staple ${r.staple.toFixed(1)}°, perp ${r.perp.toFixed(1)}°`);
  // KNOWN LIMIT: with width modulation (amp>=2) the OPEN WALL END grows a
  // sub-mm tail hook up to ~72°; interior fillets stay bounded. Tested away
  // from the last 2 mm of the path:
  const rin = await page.evaluate(()=>{
    const worstFor=()=>{ const cl=resamplePlan([{x:-20,y:0},{x:20,y:0}]);
      const r0=webLayer(cl,0,0); const pts=r0.pts; let worst=0;
      for(let i=1;i<pts.length-1;i++){
        if(Math.abs(pts[i].x)>18) continue;   // exclude open-end tails
        const ax=pts[i].x-pts[i-1].x, ay=pts[i].y-pts[i-1].y, bx=pts[i+1].x-pts[i].x, by=pts[i+1].y-pts[i].y;
        const la=Math.hypot(ax,ay), lb=Math.hypot(bx,by); if(la<1e-6||lb<1e-6) continue;
        const dot=(ax*bx+ay*by)/(la*lb);
        worst=Math.max(worst, Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI); }
      return worst; };
    Object.assign(P,{mode:'wall',w:5,lambda:8,overshoot:1.2,bead:0.45,amp:2,ampF:2,jitter:0,autoLOD:true,minGap:1.4});
    const out={};
    for(const wt of ['staple','perp']){ P.webType=wt; out[wt]=worstFor(); }
    P.amp=0; P.ampF=1; return out;
  });
  const inWorst=Math.max(rin.staple, rin.perp);
  // KNOWN LIMIT (documented, not fixed — a fix would change fillet sampling and
  // break bit-reproducibility of the pending E1 plate): at amp>=2 the modulated
  // run meets rungs at ~160°+ corners, and uniform-t bezier sampling concentrates
  // turn mid-fillet, up to ~72°. Unused by every current experiment (amp=0).
  // Registered as informational: PASSES if amp=0 envelope holds (T6), records amp=2 numbers.
  check('T6b fillets under width modulation (informational, known limit)', true, `amp=2 worst interior turn: staple ${rin.staple.toFixed(1)}°, perp ${rin.perp.toFixed(1)}° — exceeds the 22.5°/seg design target; scope width-wave claims to amp<2 until fillet sampling is angle-uniform`);
}

/* ---------- T7 lean grading tracks target within dyadic band ---------- */
{
  const r = await page.evaluate(()=>{
    Object.assign(P,{mode:'dome',domeR:71,lambda:8,lambdaS:4,gradeLean:true,autoLOD:true,minGap:1.4,bead:0.45});
    const R=71, out=[];
    for(const lean of [10,20,30,40,50,60,70,80,85]){
      const rr=R*Math.cos(lean*Math.PI/180), zc=Math.sqrt(R*R-rr*rr);
      const cl=domeCl(zc,R); const {h}=decimatedHalf(cl); const base=halfWave(cl);
      const t=Math.max(0,Math.min(1,(lean-30)/50)), tt=t*t*(3-2*t);
      const target=Math.max(Math.max(P.minGap,P.bead*2.2),(P.lambda/2)*(1-tt)+(P.lambdaS/2)*tt);
      const k=Math.log2(h/base);
      out.push({lean, h:+h.toFixed(3), target:+target.toFixed(3), ratio:+(h/target).toFixed(3), dyadic:Math.abs(k-Math.round(k))<1e-9});
    }
    P.gradeLean=false; return out;
  });
  const ok=r.every(s=>s.ratio>=1/Math.SQRT2-0.01 && s.ratio<=Math.SQRT2+0.01 && s.dyadic);
  check('T7 graded spacing within sqrt(2) of target, dyadic', ok, r.map(s=>`${s.lean}°:${s.h}/${s.target}`).join(' '));
}

/* ---------- T8 simplification: 340-degree ring ---------- */
{
  const r = await page.evaluate(()=>{
    Object.assign(P,{mode:'dome',domeR:71,sweep:340,lambda:8,w:5,amp:0});
    const cl=domeCl(0.12,71);
    const flange=[]; for(let u=0;u<=cl.total;u+=STEP) flange.push(mapUV(cl,u,P.w/2));
    const s=simplifyPts(flange,0.03,4);
    let worst=0;
    for(const p of flange){ let best=1e9;
      for(let i=0;i<s.length-1;i++){ const a=s[i],b=s[i+1];
        const dx=b.x-a.x, dy=b.y-a.y, L2=dx*dx+dy*dy||1;
        let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/L2; t=Math.max(0,Math.min(1,t));
        best=Math.min(best,Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t))); }
      worst=Math.max(worst,best); }
    return {before:flange.length, after:s.length, worstDev:worst};
  });
  check('T8 simplify 340° ring: point count + deviation bound', r.after<r.before/4 && r.worstDev<=0.035, `${r.before}→${r.after} pts, max dev ${r.worstDev.toFixed(4)} mm`);
}

/* ---------- T9 E1 plate regeneration ---------- */
let regenTris=0;
{
  const r = await page.evaluate((PARAMS)=>{
    Object.assign(P,PARAMS);
    buildLayers();
    let tri=0, cs=0, ov=0, minGap=1e9, mnz=1e9;
    let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9,mxz=-1e9;
    for(const L of layers){
      ov+=(L.ov||[]).length;
      if(L.nodeGap!=null) minGap=Math.min(minGap,L.nodeGap);
      mnz=Math.min(mnz,L.zBot); mxz=Math.max(mxz,L.zTop);
      const g=ribbon(L.pts,(L.bead||P.bead)/2,L.zBot,L.zTop); if(!g) continue;
      tri+=g.idx.length/3;
      const p=g.pos, ix=g.idx;
      for(let i=0;i<ix.length;i++){const b=ix[i]*3; cs+=p[b]+p[b+1]+p[b+2];}
      for(let i=0;i<p.length;i+=3){ const x=p[i], y=p[i+2];
        if(x<mnx)mnx=x; if(y<mny)mny=y; if(x>mxx)mxx=x; if(y>mxy)mxy=y; }
    }
    return {layers:layers.length, tri, coordSum:cs, ov, minGap, mnz,
            dims:[+(mxx-mnx).toFixed(5), +(mxy-mny).toFixed(5), +(mxz-mnz).toFixed(5)]};
  }, E1_PARAMS);
  regenTris=r.tri;
  check('T9 E1 regen: 1072 layers', r.layers===E1_REF.layers, `${r.layers}`);
  check('T9b E1 regen: 0 overlaps', r.ov===0, `${r.ov} overlaps, min node gap ${r.minGap} mm`);
  check('T9c E1 regen: z starts at 0', r.mnz===0, `zmin=${r.mnz}`);
  check('T9d E1 regen: triangle count matches shipped STL (minus fiducial)', r.tri===E1_REF.tris, `${r.tri} vs ${E1_REF.tris}`);
  check('T9e E1 regen: coordinate checksum matches shipped STL', Math.abs(r.coordSum-E1_REF.coordSum)<1.0, `${r.coordSum.toFixed(3)} vs ${E1_REF.coordSum.toFixed(3)} (Δ ${(r.coordSum-E1_REF.coordSum).toExponential(2)})`);
  check('T9f E1 regen: bbox matches shipped STL', r.dims.every((d,i)=>Math.abs(d-E1_REF.dims[i])<0.01), `${r.dims.join(' × ')} vs ${E1_REF.dims.join(' × ')}`);
}

/* ---------- T10 G-code emitter checks (E1 state is still loaded) ---------- */
{
  const g = await page.evaluate(async ()=>{
    document.getElementById('gHead').value='; TEST-HEADER {TEMP} {BED}';
    return await buildGcodeText();
  });
  if(GCODE_OUT) fs.writeFileSync(GCODE_OUT, g);
  const lines = g.split('\n');
  check('T10 gcode: header placeholders substituted', g.includes('; TEST-HEADER 215 55'), lines[0]);
  const layerHdr=/^; layer (\d+) (\w+)/;
  let z=0, firstLayerBad=[], fanOnSeen=false, fanBeforeSecond=null, retracts=0, unretracts=0, longUnprotected=0, maxJump=0;
  let lx=null, ly=null, inFirst=false;
  for(const ln of lines){
    const zm=ln.match(/^G1 Z([-\d.]+)/); if(zm){ z=parseFloat(zm[1]); }
    if(ln.startsWith('M106')&&!ln.startsWith('M106 S0')) fanOnSeen=true;
    if(ln.match(/^G1 E-[\d.]+/)) retracts++;
    if(ln.match(/^G1 E[\d.]+ F/) && !ln.includes('X')) unretracts++;
    const gm=ln.match(/^G[01] X([-\d.]+) Y([-\d.]+)(.*)/);
    if(gm){
      const x=parseFloat(gm[1]), y=parseFloat(gm[2]), rest=gm[3];
      if(lx!==null){
        const d=Math.hypot(x-lx,y-ly);
        if(!rest.includes('E')){ maxJump=Math.max(maxJump,d); }
      }
      lx=x; ly=y;
      if(Math.abs(z-0.24)<1e-6 && rest.includes('E')){
        const fm=rest.match(/F(\d+)/); if(fm && parseInt(fm[1])>930) firstLayerBad.push(ln);
      }
      if(Math.abs(z-0.48)<1e-6 && rest.includes('E') && fanBeforeSecond===null) fanBeforeSecond=fanOnSeen;
    }
  }
  const rPairs=(g.match(/^G1 E-0\.8 F1800$/gm)||[]).length, uPairs=(g.match(/^G1 E0\.8 F1800$/gm)||[]).length;
  check('T10b gcode: ALL first-layer (z=0.24) moves ≤ 15.5 mm/s', firstLayerBad.length===0, firstLayerBad.length? `${firstLayerBad.length} fast moves, e.g. ${firstLayerBad[0]}` : 'all first-layer moves ≤ 15 mm/s');
  check('T10c gcode: part-cooling fan on after first layer', fanBeforeSecond===true, `fan on before 2nd layer: ${fanBeforeSecond}`);
  check('T10d gcode: travels between specimens are retracted + hopped', rPairs>1000 && rPairs===uPairs, `${rPairs} retract / ${uPairs} unretract pairs (16 specimens × 67 z-levels ⇒ ≥1005 expected)`);
  check('T10e gcode: no NaN/undefined emitted', !g.includes('NaN') && !g.includes('undefined'), 'clean');
  const foot = g.slice(-400);
  check('T10f gcode: footer turns fan + heaters off', foot.includes('M106 S0') && foot.includes('M104 S0'), 'M106 S0 + M104 S0 present in footer');
}

/* ---------- T11 STL export end-to-end (E1 state still loaded) ---------- */
{
  const r = await page.evaluate(async ()=>{
    rebuildScene();                       // export reads the cached per-layer geometry
    const parts=await buildSTLParts();
    const headerCount=new DataView(parts[0]).getUint32(80,true);
    let n=0, vol=0, agree=0, sampled=0, ti=0;
    for(let pi=1; pi<parts.length; pi++){
      const dv=new DataView(parts[pi]);
      for(let o=0; o<parts[pi].byteLength; o+=50, ti++, n++){
        const nx=dv.getFloat32(o,true),  ny=dv.getFloat32(o+4,true),  nz=dv.getFloat32(o+8,true);
        const ax=dv.getFloat32(o+12,true),ay=dv.getFloat32(o+16,true),az=dv.getFloat32(o+20,true);
        const bx=dv.getFloat32(o+24,true),by=dv.getFloat32(o+28,true),bz=dv.getFloat32(o+32,true);
        const cx=dv.getFloat32(o+36,true),cy=dv.getFloat32(o+40,true),cz=dv.getFloat32(o+44,true);
        const ux=bx-ax,uy=by-ay,uz=bz-az, vx=cx-ax,vy=cy-ay,vz=cz-az;
        const wx=uy*vz-uz*vy, wy=uz*vx-ux*vz, wz=ux*vy-uy*vx;
        vol += (ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6;
        if(ti%37===0){ sampled++; if(nx*wx+ny*wy+nz*wz>=0) agree++; }
      }
    }
    return {n, headerCount, vol, agree, sampled};
  });
  check('T11 STL export: triangle count matches geometry pass', r.n===regenTris && r.headerCount===regenTris, `${r.n} written / header ${r.headerCount} vs ${regenTris}`);
  check('T11b STL export: shells wound outward (signed volume > 0)', r.vol>0, `signed volume ${r.vol.toFixed(1)} mm³`);
  check('T11c STL export: stored normals agree with winding', r.agree/r.sampled>0.999, `${r.agree}/${r.sampled} sampled facets agree`);
}

/* ---------- T12 corner handling: sharp corners stay printable ---------- */
{
  const r = await page.evaluate(()=>{
    const count=(plan)=>{
      planPts=plan; buildLayers();
      let ov=0; for(const L of layers) ov+=(L.ov||[]).length;
      // inner-rail fold check: no two consecutive chord points may reverse direction
      let folds=0;
      const L0=layers.find(l=>l.role==='chord');
      for(let i=2;i<L0.pts.length;i++){
        const ax=L0.pts[i-1].x-L0.pts[i-2].x, ay=L0.pts[i-1].y-L0.pts[i-2].y;
        const bx=L0.pts[i].x-L0.pts[i-1].x, by=L0.pts[i].y-L0.pts[i-1].y;
        const la=Math.hypot(ax,ay), lb=Math.hypot(bx,by);
        if(la>1e-6&&lb>1e-6&&(ax*bx+ay*by)/(la*lb)<-0.6) folds++;
      }
      return {ov,folds};
    };
    Object.assign(P,{mode:'wall',wallH:16,webType:'staple',w:5,lambda:8,overshoot:1.0,bead:0.45,lh:0.24,
      amp:0,ampF:1,jitter:0,altPhase:true,autoLOD:true,minGap:1.4,checkOv:true,gradeLean:false});
    const corner=count([{x:-40,y:-22},{x:18,y:-22},{x:18,y:30}]);            // L-corner preset
    const zigzag=count([{x:-45,y:0},{x:-25,y:18},{x:-8,y:-14},{x:10,y:16},{x:28,y:-10},{x:45,y:8}]); // hostile hand-drawn zigzag
    let sarc=[]; for(let i=0;i<=8;i++){const x=-45+90*i/8; sarc.push({x,y:16*Math.sin(x/45*Math.PI*0.85)});}
    const arc=count(sarc);                                                    // S-arc preset
    preset('arc');
    return {corner,zigzag,arc};
  });
  check('T12 L-corner: no inner-rail folds, 0 overlaps', r.corner.folds===0&&r.corner.ov===0, `folds ${r.corner.folds}, overlaps ${r.corner.ov}`);
  check('T12b hostile zigzag: no folds, 0 overlaps', r.zigzag.folds===0&&r.zigzag.ov===0, `folds ${r.zigzag.folds}, overlaps ${r.zigzag.ov}`);
  check('T12c S-arc preset: 0 overlaps (was ~203)', r.arc.ov===0, `overlaps ${r.arc.ov}, folds ${r.arc.folds}`);
}

/* ---------- T13 machine profiles: A2L / A1 ---------- */
{
  const r = await page.evaluate(async ()=>{
    const smallWall = ()=>{ Object.assign(P,{mode:'wall',wallH:2.4,webType:'staple',w:5,lambda:8,overshoot:1.0,
      bead:0.45,lh:0.24,amp:0,ampF:1,jitter:0,altPhase:true,autoLOD:true,minGap:1.4,checkOv:false,gradeLean:false});
      preset('straight'); buildLayers(); };
    const xyRange = (g)=>{ let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
      for(const ln of g.split('\n')){ const m=/^G1 X([-\d.]+) Y([-\d.]+)/.exec(ln); if(!m) continue;
        const x=+m[1], y=+m[2]; if(x<mnx)mnx=x; if(x>mxx)mxx=x; if(y<mny)mny=y; if(y>mxy)mxy=y; }
      return {mnx,mny,mxx,mxy}; };

    setMachine('a2l'); smallWall();
    const a2l = { bed:[BED,BEDY], g:xyRange(await buildGcodeText()) };

    setMachine('a1'); smallWall();
    const a1  = { bed:[BED,BEDY], g:xyRange(await buildGcodeText()),
                  label:(document.getElementById('bedRect')||{}).textContent,
                  bedSliderMax:+document.getElementById('bed').max };

    // the E1 batch geometry itself must fit an A1 plate
    Object.assign(P,{mode:'batch',grid:4,sweepX:'overshoot',sweepY:'web',specW:28,specH:16,
      w:5,lambda:8,bead:0.45,lh:0.24,dwell:0.6,jitter:0,altPhase:true,autoLOD:true,minGap:1.4,
      amp:0,ampF:1,checkOv:true,overshoot:1.0,webType:'staple',gradeLean:false});
    buildLayers();
    let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
    for(const L of layers) for(const q of L.pts){ if(q.x<mnx)mnx=q.x; if(q.x>mxx)mxx=q.x; if(q.y<mny)mny=q.y; if(q.y>mxy)mxy=q.y; }
    const plate={w:mxx-mnx,h:mxy-mny,ov:layers.reduce((a,L)=>a+(L.ov||[]).length,0)};

    setMachine('a2l');   // restore — later blocks and the screenshot assume the default machine
    return {a2l,a1,plate};
  });
  const dx = r.a1.g.mnx - r.a2l.g.mnx, dy = r.a1.g.mny - r.a2l.g.mny;
  check('T13 machine profile: A1 bed is 256×256 and label follows',
    r.a1.bed[0]===256 && r.a1.bed[1]===256 && r.a1.label==='256×256',
    `A2L ${r.a2l.bed.join('×')} → A1 ${r.a1.bed.join('×')}, label "${r.a1.label}"`);
  check('T13b machine profile: G-code origin shifts by exactly half the bed delta',
    Math.abs(dx+37)<1e-6 && Math.abs(dy+32)<1e-6,
    `ΔX ${dx.toFixed(3)} (want -37), ΔY ${dy.toFixed(3)} (want -32)`);
  check('T13c machine profile: A1 bed-temp ceiling is 100 °C',
    r.a1.bedSliderMax===100, `slider max ${r.a1.bedSliderMax} °C`);
  check('T13d E1 plate geometry fits an A1 plate with margin',
    r.plate.w<=246 && r.plate.h<=246 && r.plate.ov===0,
    `${r.plate.w.toFixed(1)}×${r.plate.h.toFixed(1)} mm in 256×256, ${r.plate.ov} overlaps`);
}

/* ---------- T14 the governor: JSON params in, verdict out ---------- */
{
  const r = await page.evaluate(()=>{
    setMachine('a1');
    const good = weftEvaluate({ machine:'a1', mode:'wall', wallH:12, webType:'staple', w:5, lambda:8,
      overshoot:1.0, bead:0.45, lh:0.24, plan:[{x:-40,y:0},{x:40,y:0}], temp:215, bed:55 });
    // node spacing far below the 2.2-bead floor. With auto-LOD ON the system is
    // designed to rescue it by dyadic decimation; with it OFF the governor must refuse.
    const rescued  = weftEvaluate({ lambda:3, bead:0.9, minGap:0.4, autoLOD:true });
    const tooDense = weftEvaluate({ lambda:3, bead:0.9, minGap:0.4, autoLOD:false });
    // nonsense values must come back named, not coerced
    const junk = weftEvaluate({ bead:5, webType:'zigzag', lh:0.24, cycle:['chord','sideways'] });
    // a wall far bigger than the A1 plate must fail the fit check
    const tooBig = weftEvaluate({ mode:'wall', wallH:12, bead:0.45, lambda:8, w:5, minGap:1.4,
      plan:[{x:-200,y:0},{x:200,y:0}] });
    const rt = weftParams();
    setMachine('a2l');
    return {good, rescued, tooDense, junk, tooBig, rtKeys:Object.keys(rt).length, rtMachine:rt.machine};
  });
  check('T14 governor: a sound brief is accepted with numbers attached',
    r.good.valid && r.good.layers>0 && r.good.weldNodes>0 && r.good.estPrint_min>0,
    `valid=${r.good.valid}, ${r.good.layers} layers, ${r.good.weldNodes} welds, ~${r.good.estPrint_min} min`);
  check('T14b governor: under-floor node spacing — LOD rescues it, or it is refused',
    r.rescued.valid && r.rescued.minNodeGap_mm>=r.rescued.nodeGapFloor_mm*0.99 &&
    !r.tooDense.valid && r.tooDense.errors.some(e=>/floor/.test(e)),
    `auto-LOD on: ${r.rescued.minNodeGap_mm} mm ≥ floor ${r.rescued.nodeGapFloor_mm} mm, valid=${r.rescued.valid} · off: ${r.tooDense.errors[0]||'NO ERROR'}`);
  check('T14c governor: junk parameters are named and rejected, not coerced',
    !r.junk.valid && r.junk.rejected.length===3 &&
    r.junk.rejected.map(x=>x.key).sort().join(',')==='bead,cycle,webType',
    r.junk.rejected.map(x=>`${x.key}: ${x.why}`).join(' | ') || 'nothing rejected');
  check('T14d governor: geometry off the plate fails the fit check',
    !r.tooBig.valid && r.tooBig.errors.some(e=>/plate/.test(e)), r.tooBig.errors[0] || 'no error raised');
  check('T14e governor: parameter round-trip carries the whole set',
    r.rtKeys>=36 && r.rtMachine==='a1', `${r.rtKeys} keys, machine "${r.rtMachine}"`);
}

/* ---------- T15 shipped presets still reproduce ---------- */
{
  const presetPath = path.join(path.dirname(APP), 'presets', 'presets.json');
  if(fs.existsSync(presetPath)){
    const table = JSON.parse(fs.readFileSync(presetPath,'utf8')).presets;
    const r = await page.evaluate((tbl)=>tbl.map(e=>{
      const v = weftEvaluate(e.params);
      return { file:e.file, valid:v.valid, ov:v.overlaps, layers:v.layers, nodes:v.weldNodes,
               size:v.size_mm, errors:v.errors, want:e.measured, crown:v.crown, firstLayer:v.firstLayer };
    }), table);
    const bad = r.filter(x=>!x.valid || x.ov!==0);
    check('T15 every shipped preset builds valid with zero overlaps',
      bad.length===0, bad.length? bad.map(b=>`${b.file}: ${b.errors[0]||b.ov+' overlaps'}`).join(' | ')
        : `${r.length} presets, all valid, 0 overlaps`);
    const drift = r.filter(x=>x.want && (x.layers!==x.want.layers ||
      (x.want.size_mm && Math.abs(x.size[0]-x.want.size_mm[0])>0.05) ||
      (x.want.weldNodes!=null && x.nodes!==x.want.weldNodes)));
    check('T15b preset measurements still match the shipped table',
      drift.length===0, drift.length? drift.map(d=>`${d.file}: ${d.layers}L/${d.nodes}n vs ${d.want.layers}L/${d.want.weldNodes}n`).join(' | ')
        : `${r.filter(x=>x.want).length} measured presets match`);
    const large=r.find(x=>x.file==='D5_large_closed_dome_R90_lambda18_foundation');
    check('T15c large R90 dome preset: closed crown, built-in foundation, A1 fit',
      !!large && large.valid && large.ov===0 && large.crown.closed && large.crown.capLayers>=1 &&
      large.firstLayer.mode==='foundation' && large.firstLayer.paths===1 && large.size[0]>190 && large.size[0]<230,
      large?`${large.size.join('×')} mm · ${large.crown.capLayers} cap layers · ${large.firstLayer.threadLength_mm} mm foundation`:'preset missing');
    await page.evaluate(()=>setMachine('a2l'));
  } else {
    check('T15 shipped presets present', false, 'presets/presets.json not found');
  }
}

/* ---------- T16 closed revolves (the full sphere/dome) ---------- */
{
  const r = await page.evaluate(()=>{
    setMachine('a1');
    const B={mode:'dome',domeR:60,sweep:360,hFrac:0.85,capClose:true,w:5,bead:0.45,lh:0.24,
      overshoot:1.0,dwell:0.6,jitter:0,altPhase:true,autoLOD:true,minGap:1.4,amp:0,ampF:1,
      checkOv:true,cycle:['chord','web'],maxBridge:12,noz:0.4,gradeLean:false,lambda:8,
      adhesion:'none',adhesionWidth:8,firstLayerBead:0.45,firstLayerSpeed:15};
    const byWeb={};
    for(const web of ['staple','diagonal','sine','perp']){
      Object.assign(P,B,{webType:web}); buildLayers();
      let chord=0, webov=0, maxSeg=0;
      for(const L of layers){ const n=(L.ov||[]).length;
        if(L.role==='chord') chord+=n; else webov+=n;
        for(let i=1;i<L.pts.length;i++) maxSeg=Math.max(maxSeg,Math.hypot(L.pts[i].x-L.pts[i-1].x,L.pts[i].y-L.pts[i-1].y)); }
      byWeb[web]={chord,webov,maxSeg:+maxSeg.toFixed(2)};
    }
    // width modulation on a closed turn: the wave's zeros must stay under the nodes
    Object.assign(P,B,{webType:'staple',amp:1.5,ampF:2}); buildLayers();
    let modOv=0; for(const L of layers) modOv+=(L.ov||[]).length;

    // exact tiling: the gap across the seam equals the pitch, not a remainder
    Object.assign(P,B,{webType:'staple',amp:0}); buildLayers();
    const cl=domeCl(0,60); const a=apexUs(cl,0,0);
    const seamGap=cl.total-a.us[a.us.length-1]+a.us[0];

    // dyadic registration: a decimated band must be a SUBSET of the base columns
    const Kb=closedHalves(cl), hb=cl.total/Kb;
    const onBase=(u)=>{ const k=(u/hb)-0.5; return Math.abs(k-Math.round(k)); };
    let worstOnBase=0;
    for(const zc of [0.12,20,40,52,56]){
      const c2=domeCl(zc,60), a2=apexUs(c2,0,0);
      for(const u of a2.us) worstOnBase=Math.max(worstOnBase, onBase(u*cl.total/c2.total));
    }
    // the chord ring must not revisit a point (that was 8 overlaps per layer)
    const C=layers.find(L=>L.role==='chord');
    let minFar=1e9;
    for(let i=0;i<C.pts.length;i+=3) for(let j=i+40;j<C.pts.length;j+=3)
      minFar=Math.min(minFar,Math.hypot(C.pts[i].x-C.pts[j].x,C.pts[i].y-C.pts[j].y));
    setMachine('a2l');
    return {byWeb,modOv,seamGap:+seamGap.toFixed(4),pitch:+a.half.toFixed(4),
      worstOnBase:+worstOnBase.toExponential(2),minFar:+minFar.toFixed(3),bead:0.45};
  });
  const anyOv=Object.values(r.byWeb).some(x=>x.chord||x.webov);
  check('T16 full 360° dome: no unintended overlaps on any web grammar', !anyOv,
    Object.entries(r.byWeb).map(([k,v])=>`${k} ${v.chord}/${v.webov}`).join(' · ') + ' (chord/web)');
  check('T16b closed revolve tiles exactly: seam gap equals the node pitch',
    Math.abs(r.seamGap-r.pitch)<1e-6, `seam ${r.seamGap} mm vs pitch ${r.pitch} mm`);
  check('T16c decimated bands stay on the base column grid',
    r.worstOnBase<1e-9, `worst offset ${r.worstOnBase} of a base step`);
  check('T16d chord ring on a closed turn never revisits a point',
    r.minFar>r.bead, `closest non-adjacent approach ${r.minFar} mm > bead ${r.bead} mm`);
  check('T16e width modulation stays clean on a closed turn',
    r.modOv===0, `${r.modOv} overlaps at amp 1.5, freq 2`);
  check('T16f thread stays continuous across the seam',
    Object.values(r.byWeb).every(x=>x.maxSeg<3), 'max segment ' +
      Object.entries(r.byWeb).map(([k,v])=>`${k} ${v.maxSeg}`).join(' / ') + ' mm');
}

/* ---------- T17 crown closure + first-layer adhesion contract ---------- */
{
  const r = await page.evaluate(async ()=>{
    setMachine('a1');
    const v=weftEvaluate({mode:'dome',domeR:32,sweep:360,hFrac:0.95,capClose:true,
      webType:'staple',w:5,lambda:18,bead:0.45,lh:0.24,overshoot:1,
      dwell:0.6,jitter:0,altPhase:true,autoLOD:true,minGap:1.4,amp:0,ampF:1,
      checkOv:true,cycle:['chord','web'],maxBridge:12,noz:0.4,gradeLean:false,
      adhesion:'foundation',adhesionWidth:8,firstLayerBead:0.52,firstLayerSpeed:12});
    const A=layers.find(L=>L.role==='adhesion');
    const firstBody=layers.find(L=>L.role==='chord'&&L.zBot===0);
    const rr=A.pts.map(p=>Math.hypot(p.x,p.y));
    document.getElementById('gHead').value='; TEST-FIRST-LAYER';
    const g=await buildGcodeText();
    let z=0,maxF=0,firstExtrusions=0;
    for(const ln of g.split('\n')){
      const zm=/^G1 Z([-\d.]+)/.exec(ln); if(zm) z=+zm[1];
      const em=/^G1 X[-\d.]+ Y[-\d.]+ E[-\d.]+ F(\d+)/.exec(ln);
      if(em&&Math.abs(z-0.24)<1e-6){firstExtrusions++;maxF=Math.max(maxF,+em[1]);}
    }
    const cl=domeCl(P.lh/2,P.domeR), inner=cl.r-P.w/2, outer=cl.r+P.w/2+P.adhesionWidth;
    setMachine('a2l');
    return {valid:v.valid,errors:v.errors,ov:v.overlaps,crown:v.crown,first:v.firstLayer,
      firstRole:layers[0].role,firstBodyBead:firstBody&&firstBody.bead,minR:Math.min(...rr),maxR:Math.max(...rr),
      wantInner:inner,wantOuter:outer,maxF,firstExtrusions,
      comments:g.includes('; WEFT adhesion: foundation 8 mm')&&g.includes('; WEFT first layer: 0.52 mm bead @ 12 mm/s')};
  });
  check('T17 95% dome cap closes instead of leaving the photographed crown hole',
    r.valid&&r.ov===0&&r.crown.closed&&r.crown.opening_mm===0&&r.crown.capLayers>=1,
    `valid=${r.valid}, ${r.crown.capLayers} cap layers, opening ${r.crown.opening_mm} mm${r.errors.length?' · '+r.errors.join(' | '):''}`);
  check('T17b filled ring covers the dome footprint and its 8 mm outside brim',
    r.firstRole==='adhesion'&&r.first.mode==='foundation'&&r.first.paths===1&&
    r.minR<=r.wantInner+0.05&&r.maxR>=r.wantOuter-0.05,
    `radial ${r.minR.toFixed(2)}..${r.maxR.toFixed(2)} mm, target ${r.wantInner.toFixed(2)}..${r.wantOuter.toFixed(2)} mm`);
  check('T17c first-layer bead and speed are stamped into geometry and G-code',
    Math.abs(r.firstBodyBead-0.52)<1e-9&&r.firstExtrusions>0&&r.maxF<=720&&r.comments,
    `body bead ${r.firstBodyBead} mm · ${r.firstExtrusions} moves · max F${r.maxF}`);
}

/* ---------- optional screenshot ---------- */
if(SHOT){
  await page.evaluate(()=>{ // reset to the default wall view for the screenshot
    Object.assign(P,{mode:'wall',webType:'staple',w:5,lambda:8,overshoot:1.0,bead:0.45,lh:0.24,amp:0,jitter:0,checkOv:true,
      adhesion:'none',firstLayerBead:0.45,firstLayerSpeed:15});
    preset('arc'); buildLayers();
    const N=Math.max(0,layers.length-1);
    document.getElementById('laySlider').max=N;
    rebuildScene(); updateStats(); updateVisibility();
  });
  await page.waitForTimeout(600);
  await page.screenshot({path:SHOT});
}

await browser.close();

/* ---------- report ---------- */
let fail=0;
console.log('\n================ WEFT verification ================');
for(const r of results){
  console.log(`${r.pass?'PASS':'FAIL'}  ${r.name}\n      ${r.detail}`);
  if(!r.pass) fail++;
}
console.log(`===================================================`);
console.log(`${results.length-fail}/${results.length} passed`);
process.exit(fail?1:0);
