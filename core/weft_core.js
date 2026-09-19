/* ============================================================
   WEFT core — the level-3 engine, extracted from index.html on 2026-09-08
   so that the thread, the STL and the G-code can be made WITHOUT a browser
   (Node) and WITHOUT a model (a human with presets or a parameter file).

   Rules that carried over unchanged (see PROJECT_STATE.md §4/§8/§12):
   - everything is synthesised in (u, lateral) parameter space, then mapped to 3D;
   - every density change stays on the dyadic grid;
   - the jitter seed resets per build (seed 1337) so a manifest reproduces geometry;
   - bead and layer height are properties of the machine (machines.json), not of a design.

   This file is a classic script on purpose: it has no import/export, so the SAME bytes run
   as <script src="core/weft_core.js"> in index.html and as `import './core/weft_core.js'`
   in Node (where it registers globalThis.WEFT_CORE). One source of truth, no build step.

   createWeftCore() returns an object whose properties are LIVE accessors onto the engine's
   state (P, layers, planPts, seed, MACHINE, BED, BEDY, MESH) and onto every function, so a
   builder can still override apexUs / widthPhase at runtime exactly as make_suma.mjs does.
   ============================================================ */
(function(root){
'use strict';
const WEFT_CORE_VERSION='core-2026-09-19-first-layer';
function createWeftCore(){
const hooks={onMachineChange:null,onMeshInfo:null,fullBuild:null};
let gcodeHead='', gcodeFoot='';
const MACHINES={
  a2l:{id:'a2l', label:'Bambu A2L', bx:330, by:320, bedMax:80,  hotMax:300},
  a1 :{id:'a1',  label:'Bambu A1',  bx:256, by:256, bedMax:100, hotMax:300},
  ender:{id:'ender', label:'Creality Ender-3 V4', bx:220, by:220, bedMax:110, hotMax:300}
};
let MACHINE='a2l', BED=MACHINES.a2l.bx, BEDY=MACHINES.a2l.by;
function setMachine(id){
  const m=MACHINES[id]; if(!m) return;
  MACHINE=id; BED=m.bx; BEDY=m.by;
  if(P.bed>m.bedMax) P.bed=m.bedMax;
  if(hooks.onMachineChange) hooks.onMachineChange(m);
}
const P={
  mode:'wall', wallH:28, domeR:45, sweep:270, hFrac:0.8, capClose:true,
  noz:0.4, bead:0.45, lh:0.24,
  webType:'staple', cycle:['chord','web'], w:5, lambda:8, amp:0, ampF:1, altPhase:true,
  autoLOD:true, minGap:1.4, gradeLean:false, lambdaS:4,
  overshoot:1.0, dwell:0.6, jitter:0, flowBoost:1.25,
  maxBridge:12, checkOv:true,
  speed:30, bridgeSpeed:18, temp:215, bed:55, fan:100,
  firstLayerBead:0.45, firstLayerSpeed:15, adhesion:'none', adhesionWidth:8,
  // batch
  grid:3, sweepX:'lambda', sweepY:'web', specW:28, specH:16
};
const STEP=0.7, FIL_AREA=Math.PI*Math.pow(1.75/2,2);
let planPts=[], layers=[], visK=1e9, isolate=false;  // visK starts huge → first build clamps it to the top layer (whole model visible on load)
let seed=1337; function rnd(){ seed=(seed*1664525+1013904223)&0x7fffffff; return seed/0x7fffffff; }

/* ---------- plan presets ---------- */
function preset(n){
  if(n==='straight') planPts=[{x:-45,y:0},{x:45,y:0}];
  else if(n==='corner') planPts=[{x:-40,y:-22},{x:18,y:-22},{x:18,y:30}];
  else { planPts=[]; for(let i=0;i<=8;i++){const x=-45+90*i/8; planPts.push({x,y:16*Math.sin(x/45*Math.PI*0.85)});} }
}
preset('arc');

/* ---------- centerlines ---------- */
/* Corner policy: a plan corner sharper than the wall can physically make
   (inner flange radius <= 0) used to fold the inner rail over itself.
   Every interior corner is now replaced by an arc with radius >= the wall's
   lateral reach (w/2 + e + bead), clamped to 45% of each adjacent edge.
   Straight plans pass through UNCHANGED (bit-identical E1 geometry). */
function roundPlanCorners(src){
  const rMin=P.w/2+P.overshoot+P.bead;
  const out=[src[0]];
  for(let i=1;i<src.length-1;i++){
    const A=src[i-1],C=src[i],B=src[i+1];
    const v1x=C.x-A.x,v1y=C.y-A.y,l1=Math.hypot(v1x,v1y);
    const v2x=B.x-C.x,v2y=B.y-C.y,l2=Math.hypot(v2x,v2y);
    if(l1<1e-6||l2<1e-6){out.push(C);continue;}
    const u1x=v1x/l1,u1y=v1y/l1,u2x=v2x/l2,u2y=v2y/l2;
    const dot=Math.max(-1,Math.min(1,u1x*u2x+u1y*u2y));
    const th=Math.acos(dot);
    if(th<0.09){out.push(C);continue;}          // < ~5 deg: treat as straight
    const tanH=Math.tan(th/2);
    const t=Math.min(rMin*tanH, 0.45*l1, 0.45*l2);
    const r=t/tanH;                              // effective radius after clamp
    const p1={x:C.x-u1x*t,y:C.y-u1y*t}, p2={x:C.x+u2x*t,y:C.y+u2y*t};
    const bx=u2x-u1x,by=u2y-u1y,bl=Math.hypot(bx,by)||1;
    const d=r/Math.cos(th/2);
    const cx=C.x+bx/bl*d, cy=C.y+by/bl*d;
    const a1=Math.atan2(p1.y-cy,p1.x-cx), a2=Math.atan2(p2.y-cy,p2.x-cx);
    let da=a2-a1; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
    const n=Math.max(2,Math.ceil(Math.abs(da)*r/STEP));
    out.push(p1);
    for(let k=1;k<n;k++){const a=a1+da*k/n; out.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});}
    out.push(p2);
  }
  out.push(src[src.length-1]);
  return out;
}
function resamplePlan(src){
  if(src.length<2) return null;
  src=roundPlanCorners(src);
  const acc=[src[0]];
  for(let i=1;i<src.length;i++){const a=src[i-1],b=src[i],d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.round(d/STEP));
    for(let j=1;j<=n;j++) acc.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n});}
  const pts=[],nrm=[],cum=[0];
  for(let i=0;i<acc.length;i++){const p0=acc[Math.max(0,i-1)],p1=acc[Math.min(acc.length-1,i+1)];
    let tx=p1.x-p0.x,ty=p1.y-p0.y;const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;
    pts.push(acc[i]);nrm.push({x:-ty,y:tx});
    if(i>0) cum.push(cum[i-1]+Math.hypot(acc[i].x-acc[i-1].x,acc[i].y-acc[i-1].y));}
  return {pts,nrm,cum,total:cum[cum.length-1],kind:'wall'};
}
function domeCl(zc,R){const r=Math.sqrt(Math.max(1e-4,R*R-zc*zc));
  const sw=P.sweep*Math.PI/180,arc=r*sw,n=Math.max(10,Math.ceil(arc/STEP));const pts=[],nrm=[],cum=[0];
  for(let i=0;i<=n;i++){const a=i/n*sw-sw/2;pts.push({x:r*Math.cos(a),y:r*Math.sin(a)});nrm.push({x:Math.cos(a),y:Math.sin(a)});
    if(i>0)cum.push(cum[i-1]+arc/n);}
  return {pts,nrm,cum,total:arc,r,R,kind:'dome',closed:P.sweep>=359.9};}
function clSample(cl,u){u=cl.closed?((u%cl.total)+cl.total)%cl.total:Math.max(0,Math.min(cl.total,u));let lo=0,hi=cl.cum.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(cl.cum[m]<=u)lo=m;else hi=m;}
  const d=cl.cum[hi]-cl.cum[lo]||1,t=(u-cl.cum[lo])/d,p0=cl.pts[lo],p1=cl.pts[hi],n0=cl.nrm[lo],n1=cl.nrm[hi];
  let nx=n0.x+(n1.x-n0.x)*t,ny=n0.y+(n1.y-n0.y)*t;const nl=Math.hypot(nx,ny)||1;
  return {x:p0.x+(p1.x-p0.x)*t,y:p0.y+(p1.y-p0.y)*t,nx:nx/nl,ny:ny/nl};}
function mapUV(cl,u,lat){const s=clSample(cl,u);return {x:s.x+s.nx*lat,y:s.y+s.ny*lat};}
/* On a CLOSED revolve the pattern meets itself at u=0, so the node pitch has to be
   commensurate with the circumference or the last wave lands on the first. The wave
   count around the equator is 4*pi*R/lambda and is independent of the slice radius,
   so one global snap fixes every layer at once. It is rounded to a multiple of 16 so
   that dyadic LOD (m = 2,4,8,16) keeps dividing it exactly and weld columns stay
   stacked through every decimation band. Open sweeps and walls are untouched. */
function closedHalves(cl){
  const n=4*Math.PI*cl.R/P.lambda;
  return Math.max(16, Math.round(n/16)*16);
}
function lamEff(cl){ return cl.closed ? 4*Math.PI*cl.R/closedHalves(cl) : P.lambda; }
function phaseAt(cl,u){return cl.kind==='wall'?2*Math.PI*u/P.lambda:2*Math.PI*(u/cl.r)/(lamEff(cl)/cl.R);}
function halfWave(cl){return cl.kind==='wall'?P.lambda/2:(lamEff(cl)/(2*cl.R))*cl.r;}
/* auto density: when physical node spacing shrinks below the floor (tight dome
   radii), DOUBLE the spacing dyadically — knitting decreases. Powers of two keep
   surviving node columns exactly on the base angular grid, so vertical weld
   registration survives every decimation boundary. */
function decimatedHalf(cl){
  const base=halfWave(cl);
  const smin=Math.max(P.minGap, P.bead*2.2);
  let h=base, m=1;
  if(P.gradeLean && cl.kind==='dome'){
    /* density POLICY: physical node spacing follows the lean angle instead of
       accidentally tracking radius. Spacing eases at gentle lean (your lambda),
       tightens toward lambda_steep above ~30 deg (smoothstep to ~80 deg) —
       overhang capability earned by densification, made explicit.
       Quantized to the dyadic grid (refinement to 4x allowed), so existing weld
       columns stay stacked and new columns begin cleanly on the chords. */
    const lean=Math.asin(Math.min(1,Math.sqrt(Math.max(0,1-(cl.r/cl.R)**2))))*180/Math.PI;
    const t=Math.max(0,Math.min(1,(lean-30)/50)), tt=t*t*(3-2*t);
    const sDes=Math.max(smin, (P.lambda/2)*(1-tt) + (P.lambdaS/2)*tt);
    let k=Math.round(Math.log2(sDes/base));
    k=Math.max(-2, Math.min(6, k));
    h=base*Math.pow(2,k); m=Math.pow(2,k);
  }
  let innerRatio = 1.0;
  if(cl.kind === 'dome' && cl.r > 1e-4) {
    const A = Math.min(P.w/2, cl.r * 0.85);
    innerRatio = Math.max(0.1, (cl.r - A) / cl.r);
  }
  if(P.autoLOD){ while(h*innerRatio < smin && m<64){ h*=2; m*=2; } }
  return {h,m};
}
function apexUs(cl,webIdx,jit){
  const {h:h0,m}=decimatedHalf(cl);
  if(cl.closed){
    /* EXACT tiling: K half-waves fit the turn with no remainder, and the last apex
       stops one pitch short of the first instead of landing next to it. Measured
       before this: K=95 with the final apex 0.99 mm from the first against a 4 mm
       pitch — the crowding that showed up as seam overlaps on every web layer. */
    const Kb=closedHalves(cl), hb=cl.total/Kb;      // the BASE grid for this revolve
    let K=Math.max(2,Math.round(Kb/m)); if(K%2) K++;
    const half=cl.total/K;
    /* The offset is half of the BASE half-wave, not of this layer's decimated one.
       That matters: anchoring it to the base grid keeps every decimation band a strict
       SUBSET of {hb/2 + i*hb}, so weld columns still stack exactly through every LOD
       transition (anchoring it to the layer's own pitch put m=2 columns precisely
       between the m=1 columns — caught by the phase-lock test). The half-step itself
       is what keeps the seam at u=0 sitting on a plain run instead of inside a rung.
       altPhase cannot move the apex SET on a perfectly tiled ring — shifting by one
       half-wave maps it onto itself — so on a closed turn it flips the side pattern,
       which is what alternating phase means on a ring. */
    const s0=(P.altPhase&&webIdx%2===1)?1:0;
    const us=[],sides=[];
    for(let j=0;j<K;j++){ let u=hb*0.5+j*half;
      if(jit) u+=(rnd()-0.5)*half*jit;
      us.push(Math.max(0,Math.min(cl.total,u))); sides.push((j+s0)%2===0?1:-1); }
    return {us,sides,half,m,K};
  }
  const half=h0;
  const off=(P.altPhase&&webIdx%2===1)?half:0;
  const us=[],sides=[];let j=0;
  while(true){let u=off+j*half; if(u>cl.total+1e-6) break;
    if(jit&&j>0&&u<cl.total-half*0.5) u+=(rnd()-0.5)*half*jit;
    us.push(Math.max(0,Math.min(cl.total,u))); sides.push(j%2===0?1:-1); j++; }
  return {us,sides,half,m};
}

/* ---------- one layer's paths (role + web type) ---------- */
function chordLayer(cl,zBot,off){
  const A=halfWidthFor(cl), pts=[];
  if(cl.closed){
    /* A closed revolve has no far end to turn around at: u=0 and u=total are the same
       place, so the wall's racetrack puts BOTH cross-connectors at the same angle, one
       exactly on top of the other. Measured: 8 overlaps per chord layer, 799 per dome,
       all at +/-180 deg. Here the layer is drawn as outer turn -> ONE radial crossover
       -> inner turn, each turn stopping one step short of its own start, so no point on
       the path is ever revisited and the ring needs no closure exclusion at all. */
    /* WEFT-06: the ring is opened AT A WELD COLUMN. The seam is the one place a chord ring has two
       free ends, and a free end over air is a cantilever — the gate counted twenty of them, 3 to 7 mm
       each. At a weld column the web below crossed between the rails, so BOTH ends land on material.
       Anywhere else is a coin toss. */
    const uS=(cl.nodes&&cl.nodes.length)?cl.nodes[0]:0;
    const WR=(u)=>{const t=u%cl.total; return t<0?t+cl.total:t;};
    const lat=(u,s)=>s*(A+P.amp*Math.sin(widthPhase(cl,WR(u))+off));
    const uX=cl.total-STEP;                       // the crossover angle
    for(let u=0;u<uX-1e-9;u+=STEP) pts.push(mapUV(cl,WR(uS+u),lat(uS+u,1)));
    const lX=lat(uS+uX,1);
    for(let t=0;t<=4;t++) pts.push(mapUV(cl,WR(uS+uX), lX-(2*lX)*t/4));
    for(let u=uX-STEP;u>1e-9;u-=STEP) pts.push(mapUV(cl,WR(uS+u),lat(uS+u,-1)));
    pts.push(mapUV(cl,WR(uS),lat(uS,-1)));
    /* and CLOSE it: a second radial crossover at the seam brings the thread back to where it
       started. The ring used to be left open here, which put two free ends on every chord layer —
       and a free end over air is a cantilever, not a bridge. The two crossovers sit a whole turn
       apart, so no point is revisited. */
    const lS=lat(uS,1);
    for(let t=1;t<=4;t++) pts.push(mapUV(cl,WR(uS), -lS+(2*lS)*t/4));
    return {pts, apexes:[], closed:true};
  }
  for(let u=0;u<=cl.total;u+=STEP) pts.push(mapUV(cl,u, A+P.amp*Math.sin(widthPhase(cl,u)+off)));
  pts.push(mapUV(cl,cl.total, A+P.amp*Math.sin(widthPhase(cl,cl.total)+off)));
  const l1=A+P.amp*Math.sin(widthPhase(cl,cl.total)+off);
  for(let t=1;t<=4;t++) pts.push(mapUV(cl,cl.total, l1-(2*l1)*t/4));
  for(let u=cl.total;u>=0;u-=STEP) pts.push(mapUV(cl,u, -(A+P.amp*Math.sin(widthPhase(cl,u)+off))));
  pts.push(mapUV(cl,0, -(A+P.amp*Math.sin(widthPhase(cl,0)+off))));
  const l0=A+P.amp*Math.sin(widthPhase(cl,0)+off);
  for(let t=1;t<=4;t++) pts.push(mapUV(cl,0, -l0+(2*l0)*t/4));
  return {pts, apexes:[], closed:true};
}
function filletParam(v,r){
  /* corner rounding via quadratic-bezier fillets: trims min(r, 45% of each edge)
     around every real corner (>~20 deg), independent of sample density */
  if(v.length<3) return v;
  const out=[v[0]];
  for(let i=1;i<v.length-1;i++){
    const Pm=v[i-1],C=v[i],Pn=v[i+1];
    const d1=Math.hypot(C[0]-Pm[0],C[1]-Pm[1]), d2=Math.hypot(Pn[0]-C[0],Pn[1]-C[1]);
    if(d1<1e-6||d2<1e-6){ out.push(C); continue; }
    const a1=[(C[0]-Pm[0])/d1,(C[1]-Pm[1])/d1], a2=[(Pn[0]-C[0])/d2,(Pn[1]-C[1])/d2];
    if(a1[0]*a2[0]+a1[1]*a2[1]>0.94){ out.push(C); continue; }
    const d=Math.min(r, d1*0.45, d2*0.45);
    const p0=[C[0]-a1[0]*d, C[1]-a1[1]*d], p2=[C[0]+a2[0]*d, C[1]+a2[1]*d];
    // adaptive: enough bezier segments that no interior turn exceeds ~22 deg
    const ang=Math.acos(Math.max(-1,Math.min(1,a1[0]*a2[0]+a1[1]*a2[1])));
    const n=Math.max(3, Math.ceil(ang/(Math.PI/8)));
    for(let t=0;t<=n;t++){const s=t/n, q=1-s;
      out.push([q*q*p0[0]+2*q*s*C[0]+s*s*p2[0], q*q*p0[1]+2*q*s*C[1]+s*s*p2[1]]);}
  }
  out.push(v[v.length-1]);
  return out;
}
function emitParam(cl,v,pts){
  const cu=u=>cl.closed?u:Math.max(0,Math.min(cl.total,u));
  pts.push(mapUV(cl,cu(v[0][0]),v[0][1]));
  for(let i=0;i<v.length-1;i++){const a=v[i],b=v[i+1];
    const m=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))/STEP));
    for(let j=1;j<=m;j++){const t=j/m; pts.push(mapUV(cl,cu(a[0]+(b[0]-a[0])*t),a[1]+(b[1]-a[1])*t));}}
}
/* breathing chord line: width modulation amp + integer freq keeps zeros at node
   positions, so weld registration survives the modulation */
/* The width wave's zeros must land ON the node columns — that is what keeps
   registration exact through modulation. On a closed revolve the apex grid sits at
   (j+1/2) half-waves (so the seam falls between nodes), which puts the nodes on the
   wave's EXTREMA instead of its zeros: the flanges pinch to w/2-amp exactly where the
   rungs cross, and at amp>=1 they collide (measured 13 overlaps at amp 1.0, 7873 at
   1.5 — while 180 deg and 270 deg domes and every wall stayed clean). Shifting the wave
   by a quarter period on closed turns puts the zeros back under the nodes. */
function widthPhase(cl,u){ return P.ampF*(phaseAt(cl,u) - (cl.closed?Math.PI/2:0)); }
/* Half web amplitude for a centerline. Dome slices shrink the amplitude near
   the crown so the web never crosses the axis; every other centerline (wall,
   batch specimen, open sweep) has no radius and keeps the full P.w/2. Without
   this guard cl.r is undefined there and the whole layer collapses to NaN. */
function halfWidthFor(cl){ return (cl&&cl.kind==='dome'&&cl.r>1e-4) ? Math.min(P.w/2, cl.r*0.85) : P.w/2; }
function AfAt(cl,u){ return halfWidthFor(cl) + P.amp*Math.sin(widthPhase(cl,u)); }

function webLayer(cl,zBot,webIdx){
  const A=halfWidthFor(cl), e=P.overshoot, Aw=A+e;
  const {us,sides,half}=apexUs(cl,webIdx, P.jitter);
  const pts=[], apexes=[]; webLayer._lastGap=half;
  /* WEFT-02 telemetry, read by the builders: how many crossings this layer failed to
     place, and the longest arc a chord rail above will have to span unsupported.
     sine / diagonal / eight cross at every node, so their rail run is the node gap;
     staple and perp overwrite both with what they actually emitted. */
  webLayer._skipped=0; webLayer._plain=0;
  webLayer._maxRail = us.length? Math.max(us[0], cl.total-us[us.length-1],
    ...us.slice(1).map((u,j)=>u-us[j])) : cl.total;
  if(us.length<2){ /* no node grid: a bare centreline, touching neither rail and welding nothing */
    webLayer._skipped=Math.max(1,us.length); webLayer._maxRail=cl.total;
    for(let u=0;u<=cl.total;u+=STEP) pts.push(mapUV(cl,u,0)); return {pts,apexes,closed:false}; }
  const runV=(v,u0,u1,latFn)=>{ const m=Math.max(1,Math.ceil(Math.abs(u1-u0)/STEP));
    for(let j=1;j<=m;j++){const uu=u0+(u1-u0)*j/m; v.push([uu,latFn(uu)]);} };

  if(P.webType==='staple'){
    /* Runs sit ON the chord rails (they stack on the rails below); every node gets a
       staple rung that crosses to the opposite rail, with symmetric overhang tabs.

       WEFT-02 (2026-09-02). The rung half-step D used to be sized ONCE, from the
       curvature at the MIDDLE of the contour, and then every rung was tested against
       its OWN local curvature. On any contour that is not a perfect circle the test
       therefore failed wherever the curve is tighter than its midpoint, and the rung
       was dropped in silence. Measured on P2 Penjac: 38% of all rungs dropped, and on
       half the web layers every single rung went - a "woven" layer with no welds at
       all, and the chord rail above it hanging in the air for up to 65 mm. Exactly the
       WEFT-01 class of fault: one global number deciding a local question.

       D is now chosen from the curvature where the rung actually lands, and a rung that
       is still too tight gives up its overhang tab (reach shrinks toward w/2) BEFORE it
       is ever allowed to be dropped: the tab is decoration, the rung is structure. A
       rung is skipped only when the corner cannot carry a crossing at any tab length,
       and the count and the worst rail run are published so a caller can refuse. */
    const Dmin=Math.max(P.bead*1.15,0.5);
    /* WEFT-03: the ceiling on a staple's half-step is 0.45 of the gap to the NEXT column, and that
       gap is local. Using the smallest gap anywhere on the ring — which is what `half` is — let one
       tight pair of columns shrink every staple on the contour and drop the ones that no longer fit
       (measured: 143 rungs, a 19.3 mm unwelded rail). Same fault as WEFT-01 and WEFT-02, one level
       further down: a global number answering a local question. */
    const gapAfter=(i)=>{ const n=us.length;
      if(i<n-1) return us[i+1]-us[i];
      return cl.closed ? (cl.total-us[n-1]+us[0]) : (cl.total-us[n-1]); };
    const Dfor=(u,rch,cap)=>{ const k=Math.abs(curvAt(cl,u));
      let d=Dmin; if(k>1e-4 && 1-rch*k>0) d=Math.max(d,(P.bead*1.05)/(1-rch*k));
      return Math.min(d,cap); };
    /* the crossing lands at u0+D and D depends on the curvature there: one refinement
       is enough, since D moves the sample by less than a bead. */
    const solveRung=(u0,cap)=>{
      for(let s=0;s<=4;s++){
        const et=e*(1-s/4), rch=AfAt(cl,u0)+et;
        let d=Dfor(u0,rch,cap); d=Dfor(u0+d,rch,cap);
        if(d>=P.bead*1.05 && rungFits(cl,u0+d,d,rch)) return {d,e:et};
      }
      return null;
    };
    let skipped=0, plain=0, maxRail=0, lastRung=0;
    const v=[]; let cs=sides[0], uc=0;
    v.push([0, cs*AfAt(cl,0)]);
    const clampU=(u,D)=>cl.closed? u : Math.min(u, cl.total-2*D);   // a ring has no end to clamp to
    for(let i=0;i<us.length;i++){
      if(us[i]<uc-1e-6){ skipped++; continue; }        // the previous staple already ran past this node
      const cap=Math.max(Dmin, 0.45*Math.max(gapAfter(i), 1e-6));
      const sol=solveRung(Math.max(uc, clampU(us[i],Dmin)), cap);
      if(!sol){
        /* WEFT-03: a corner too tight for a staple still gets a CROSSING. A plain radial crossing
           has no longitudinal legs, so there is nothing that can converge and fuse — it is always
           printable, it welds both rails, and it costs one segment. Dropping the weld instead is
           how a chord rail ended up running 19.5 mm with nothing under it. */
        const u0=Math.max(uc, clampU(us[i],Dmin));
        if(u0<uc-1e-6){ skipped++; continue; }
        runV(v,uc,u0,(uu)=>cs*AfAt(cl,uu));
        const a0=AfAt(cl,u0);
        v.push([u0, cs*a0], [u0, -cs*a0]);
        apexes.push(objAt(cl,u0, a0, zBot), objAt(cl,u0, -a0, zBot));
        maxRail=Math.max(maxRail, u0-lastRung); lastRung=u0;
        cs=-cs; uc=u0; plain++; continue;
      }
      const D=sol.d, et=sol.e;
      const u0=Math.max(uc, clampU(us[i],D));
      runV(v,uc,u0,(uu)=>cs*AfAt(cl,uu));
      const a0=AfAt(cl,u0), a1=AfAt(cl,u0+D), a2=AfAt(cl,u0+2*D);
      v.push([u0, cs*(a0+et)]);
      v.push([u0+D, cs*(a1+et)], [u0+D, -cs*(a1+et)]);
      v.push([u0+2*D, -cs*(a2+et)], [u0+2*D, -cs*a2]);
      apexes.push(objAt(cl,u0+D, a1, zBot), objAt(cl,u0+D, -a1, zBot));
      maxRail=Math.max(maxRail, u0-lastRung); lastRung=u0+2*D;
      cs=-cs; uc=u0+2*D;
    }
    if(uc<cl.total-1e-6) runV(v,uc,cl.total,(uu)=>cs*AfAt(cl,uu));
    maxRail=Math.max(maxRail, cl.total-lastRung);
    webLayer._skipped=skipped; webLayer._maxRail=maxRail; webLayer._plain=plain;
    emitParam(cl, filletParam(v,Math.max(P.bead*0.8,0.45)), pts);

  } else if(P.webType==='perp'){
    /* Regular square wave: one straight rung crosses both chords at each weld column, and the runs
       between them rest ON the rails.
       WEFT-06 (2026-09-02): the runs used to sit a tab BEYOND the rails, deliberately, so as never
       to stack on the longitudinal lines below. The intent was clean crossings; the effect was that
       the only part of the layer touching anything was the instant a rung swept past a rail, and
       wherever the body had moved a millimetre those instants were missed — 12 to 14 mm of run in
       the air. The tab is now a spike at the column; the run rests on the rail. */
    /* WEFT-02: a crossing that will not fit gives up its tab before it gives up the
       weld — the same rule as the staple rung. Only a corner that cannot carry the
       crossing at zero tab is skipped, and the skip is counted. */
    const tabAt=(u0)=>{
      for(let s=0;s<=4;s++){ const ee=e*(1-s/4);
        if(rungFits(cl,u0,half,AfAt(cl,u0)+ee)) return ee; }
      return null; };
    const v=[]; let cs=sides[0], uc=0, skipped=0, plain=0, maxRail=0, lastRung=0;
    v.push([0, cs*AfAt(cl,0)]);
    for(let i=0;i<us.length;i++){
      const u0=Math.max(uc, us[i]); if(us[i]<uc-1e-6){ skipped++; continue; }
      let et=tabAt(u0);
      if(et===null){ et=0; plain++; }   // too tight even at zero tab: cross flat rather than not at all
      runV(v,uc,u0,(uu)=>cs*AfAt(cl,uu));
      const a0=AfAt(cl,u0);
      if(et>0.02) v.push([u0, cs*(a0+et)]);       // the tab, a spike at the column
      v.push([u0, -cs*(a0+et)]);
      if(et>0.02) v.push([u0, -cs*a0]);           // and back down onto the far rail
      apexes.push(objAt(cl,u0, a0, zBot), objAt(cl,u0, -a0, zBot));
      maxRail=Math.max(maxRail,u0-lastRung); lastRung=u0;
      cs=-cs; uc=u0;
    }
    if(uc<cl.total-1e-6) runV(v,uc,cl.total,(uu)=>cs*AfAt(cl,uu));
    maxRail=Math.max(maxRail, cl.total-lastRung);
    webLayer._skipped=skipped; webLayer._maxRail=maxRail; webLayer._plain=plain;
    emitParam(cl, filletParam(v,Math.max(P.bead*0.8,0.45)), pts);

  } else if(P.webType==='sine'){
    /* WEFT-06: the wave's crests ride ON the rails. Swinging a tab further put the only part of the
       curve that dwells (the crest, where the derivative is zero) outside the material below, and a
       sine that never rests on a rail is one long bridge. */
    const dense=Math.max(us.length*8, Math.ceil(cl.total/STEP));
    const shift=(P.altPhase&&webIdx%2)?Math.PI:0;
    for(let k=0;k<=dense;k++){ const u=cl.total*k/dense;
      pts.push(mapUV(cl,u,AfAt(cl,u)*Math.sin(phaseAt(cl,u)+shift))); }
    us.forEach((u,i)=>{ apexes.push(objAt(cl,u,sides[i]*AfAt(cl,u),zBot)); });

  } else if(P.webType==='eight'){
    /* loop stitch (prolate cycloid): lat=-(Af+e)cos(ph), u=c(ph-k*sin(ph)), k>1
       -> u-progress reverses at alternating apexes, so the thread loops back over
       itself AND hooks around the chord below: mechanical interlock, knit logic.
       altPhase flips which flange gets the loops each web layer.
       Self-crossings are intentional; overlap detection skips these layers. */
    const kap=1.8, c=(2*half)/(2*Math.PI);
    const shift=(P.altPhase&&webIdx%2)?Math.PI:0;
    let ph=0, guard=0, pu=null, pl=null, pa=null;
    while(guard++<40000){
      const u=c*(ph - kap*Math.sin(ph));
      if(u>cl.total) break;
      const uu=Math.max(0,Math.min(cl.total,u));
      /* WEFT-06: the loop rides the rails. Reaching a tab past them left the stitch touching
         nothing on a layer whose body had shifted; the hook is the loop's own reversal in u, not
         the tab. */
      const Au=AfAt(cl,uu), lat=-Au*Math.cos(ph+shift);
      pts.push(mapUV(cl,uu,lat));
      pu=uu; pl=lat; pa=Au; ph+=Math.PI/24;
    }
    /* The weld is the EXTREME of the loop, where it rests on a rail — cos(ph+shift) = +/-1.
       It used to be found by watching for a sign change of (lat -/+ A), which only worked while the
       loop reached a tab PAST the rail. Riding the rail makes that a tangency, not a crossing, and
       the detector silently returned no welds at all: 170 layers reported as unwoven. Solve for the
       extremes instead — they are exactly where the stitch touches. */
    for(let m=0;;m++){
      const phm=m*Math.PI - shift;
      if(phm<0) continue;
      const um=c*(phm - kap*Math.sin(phm));
      if(um>cl.total) break;
      const uu=Math.max(0,Math.min(cl.total,um));
      apexes.push(objAt(cl,uu,-Math.cos(phm+shift)*AfAt(cl,uu),zBot));
      if(m>40000) break;
    }
    webLayer._maxRail = us.length>1 ? Math.max(...us.slice(1).map((u,j)=>u-us[j]),
                                               us[0], cl.total-us[us.length-1]) : cl.total;

  } else { /* diagonal truss */
    /* WEFT-06 (2026-09-02). The dwell used to sit at +/-(A+e) — a tab BEYOND the rail. A truss
       member is a bridge, and a bridge needs its ends on something: the material under this layer is
       the two chord rails at +/-A, and the dwell was the one part of the path that could land on
       them. Sitting a tab outside meant the apex touched nothing, and wherever the body had moved a
       millimetre sideways the whole zigzag came away from the layer below — the gate measured a
       22.8 mm member hanging in air where the geometry had promised 6.5 mm.
       The dwell is now ON the rail, and the tab is a spike beyond it: contact first, ornament after. */
    const dw2=Math.min(P.dwell/2, half*0.3);
    const via=[];
    const node=(u,sgn,arr)=>{ const a0=AfAt(cl,u);
      if(dw2>0.02){ arr.push([u-dw2,sgn*a0]);
                    if(e>0.02) arr.push([u,sgn*(a0+e)]);
                    arr.push([u+dw2,sgn*a0]); }
      else arr.push([u,sgn*a0]); };
    for(let i=0;i<us.length;i++){
      const interior = cl.closed || (i>0 && i<us.length-1);   // a ring has no end apexes
      if(interior) node(us[i],sides[i],via);
      else via.push([us[i],sides[i]*AfAt(cl,us[i])]);
    }
    /* on a closed turn the truss has to cross the seam too: repeat the first apex one
       turn later so the last member is drawn, then let emitParam wrap u back */
    if(cl.closed) node(us[0]+cl.total,sides[0],via);
    for(let i=0;i<via.length-1;i++){
      const u0=via[i][0],l0=via[i][1],u1=via[i+1][0],l1=via[i+1][1];
      const m=Math.max(1,Math.ceil(Math.max(Math.abs(u1-u0),Math.abs(l1-l0))/STEP));
      for(let j=(i===0?0:1);j<=m;j++){const t=j/m; pts.push(mapUV(cl,u0+(u1-u0)*t,l0+(l1-l0)*t));}
    }
    /* the welds are where the dwell rests on the rail, which is now exactly +/-A at the node */
    us.forEach((u,i)=>{ apexes.push(objAt(cl,u,sides[i]*AfAt(cl,u),zBot)); });
    webLayer._maxRail = us.length>1 ? Math.max(...us.slice(1).map((u,j)=>u-us[j]),
                                               us[0], cl.total-us[us.length-1]) : cl.total;
  }
  return {pts,apexes,closed:!!cl.closed};
}
function objAt(cl,u,lat,z){const p=mapUV(cl,u,lat);return {x:p.x,y:p.y,z};}
/* signed centerline curvature at u (rad/mm); + = turning toward +lateral side */
function curvAt(cl,u){
  const d=Math.min(1.5, cl.total/4);
  const u0=Math.max(0,u-d), u1=Math.min(cl.total,u+d);
  if(u1-u0<1e-6) return 0;
  const a=clSample(cl,u0), b=clSample(cl,u1);
  const dot=Math.max(-1,Math.min(1,a.nx*b.nx+a.ny*b.ny));
  const cross=a.nx*b.ny-a.ny*b.nx;
  return (cross>=0?1:-1)*Math.acos(dot)/(u1-u0);
}
/* A crossing is printable only if, on the inner side of the curve, its legs still
   land >= one bead apart. WEFT-02 (2026-09-02): this used to be called with a global
   reach (P.w/2+P.overshoot) and a global spacing, and a failure meant the rung was
   dropped. Both branches of webLayer now solve for the local reach and spacing
   themselves and shrink the tab before they will drop a weld, so this helper is kept
   only as the shared statement of the criterion — pass the LOCAL reach and spacing. */
function rungFits(cl,u,spacing,reach){
  const k=Math.abs(curvAt(cl,u));
  if(k<1e-4) return spacing>=P.bead;
  return (1-reach*k)*spacing >= P.bead;
}

/* A cap has to engage before the final sampled ring disappears. The old fixed
   3.6 mm trigger missed large hemispheres because their last layer can still
   have a 7-9 mm radius. maxBridge is the explicit physical bound; the square-
   root term guarantees at least one cap layer even at the largest supported R. */
function domeCapStartRadius(R){
  return Math.max(P.maxBridge, P.w/2+P.bead*2, P.bead*8, Math.sqrt(2*R*P.lh*1.5));
}

/* One continuous Archimedean spiral, sampled by angle. Used for the crown and
   for the first-layer annulus. pitch <= bead means the ribbons overlap slightly
   instead of leaving the unprintable gaps produced by the old 2*bead cap pitch. */
function radialSpiral(rOuter,rInner,pitch,startAngle=-Math.PI){
  rOuter=Math.max(0,rOuter); rInner=Math.max(0,Math.min(rOuter,rInner));
  const span=rOuter-rInner, turns=Math.max(0.75,span/Math.max(0.05,pitch));
  const n=Math.max(48,Math.ceil(turns*64)), pts=[];
  for(let i=0;i<=n;i++){
    const t=i/n, a=startAngle+t*turns*2*Math.PI, r=rOuter-span*t;
    pts.push({x:r*Math.cos(a),y:r*Math.sin(a)});
  }
  return pts;
}

/* Built-in first-layer adhesion for a closed dome. Brim is an outside spiral;
   foundation fills the complete annular footprint and continues outward as a
   brim. It is model geometry, so Route A and Route B receive the same support. */
function buildDomeAdhesion(){
  if(P.mode!=='dome'||P.adhesion==='none'||P.sweep<359.9) return [];
  const cl=domeCl(P.lh/2,P.domeR), pitch=P.firstLayerBead*0.82;
  const baseOuter=cl.r+P.w/2;
  const rOuter=baseOuter+P.adhesionWidth;
  const rInner=P.adhesion==='foundation'
    ? Math.max(P.firstLayerBead,cl.r-P.w/2)
    : baseOuter+pitch*0.82;
  const pts=radialSpiral(rOuter,rInner,pitch);
  const L={role:'adhesion',adhesion:P.adhesion,pts,apexes:[],zBot:0,zTop:P.lh,
    closed:false,cl,bead:P.firstLayerBead,speed:P.firstLayerSpeed,
    wSpan:P.w,ovh:P.overshoot,nodeGap:null};
  L.len=plen(pts); L.ov=[];
  return [L];
}

/* ---------- assemble a wall/dome from a centerline factory ---------- */
function buildFrom(clFor, N, ox, oy){
  const out=[];
  let webCount=0;
  for(let k=0;k<N;k++){
    const zBot=k*P.lh, zTop=(k+1)*P.lh, zc=zBot+P.lh/2;
    const cl=clFor(zc); if(!cl) continue;
    // dome spiral-cap closure: take over once the slice arc can't hold the pattern
    // (either too few wavelengths, OR flanges converging) — this is what actually closes the top
    if(P.mode==='dome'&&P.capClose&&cl.kind==='dome'){
      // trigger on RADIUS: cap the top few mm where the slice is too tight for the pattern.
      // absolute floor (a handful of node-spacings or bead widths) closes the dome reliably;
      // wide sweeps keep long arcs at small r, so an arc test would miss this.
      const minR = Math.max(P.autoLOD?0:P.lambda*0.75, domeCapStartRadius(cl.R));
      if(cl.r < minR){
        const rr0=Math.max(cl.r, P.w/2+P.bead);
        const pts=radialSpiral(rr0,0,P.bead*0.82);
        const L={role:'cap',pts:offsetPts(pts,ox,oy),apexes:[],zBot,zTop,closed:false,cl,
                 bead:P.bead, speed:P.speed, wSpan:P.w, ovh:P.overshoot};
        L.len=plen(L.pts); out.push(L);
        continue;
      }
    }
    if(cl.total<P.lambda*0.6) continue;
    const role=P.cycle[k%P.cycle.length];
    let r;
    if(role==='chord'){ const off=(P.amp>0? (k%2? Math.PI:0):0); r=chordLayer(cl,zBot,off); }
    else { r=webLayer(cl,zBot,webCount++); }
    const nodeGap = role==='web' ? webLayer._lastGap : null;
    const skipped = role==='web' ? webLayer._skipped : null;
    const maxRail = role==='web' ? webLayer._maxRail : null;   // WEFT-02: what the chord above must span
    const layerBead=zBot===0?P.firstLayerBead:P.bead;
    const L={role, pts:offsetPts(r.pts,ox,oy), apexes:r.apexes.map(a=>({x:a.x+ox,y:a.y+oy,z:a.z})),
             zBot,zTop,closed:r.closed,cl,
             bead:layerBead, speed:zBot===0?P.firstLayerSpeed:P.speed,
             wSpan:P.w, ovh:P.overshoot, webType:P.webType, nodeGap, skipped, maxRail};
    L.len=plen(L.pts); out.push(L);
  }
  return out;
}
function offsetPts(pts,ox,oy){ return (ox||oy)? pts.map(p=>({x:p.x+ox,y:p.y+oy})) : pts; }
function plen(pts){let s=0;for(let i=1;i<pts.length;i++)s+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return s;}

/* ---------- batch specimen array ---------- */
const SWEEP_VALS={
  lambda:[5,7,9,12,16,20], overshoot:[0,0.6,1.2,1.8,2.5,3.2], w:[3,5,7,10,13,16],
  web:['diagonal','perp','staple','sine','eight','staple'], speed:[20,35,50,70,90,110], bead:[0.35,0.45,0.6,0.75,0.9,1.1]
};
function buildBatch(){
  layers=[]; seed=1337;
  const g=P.grid;
  const maxPitch=(BED-20)/g;
  const gap=Math.min(P.specW*0.35, Math.max(6,maxPitch-P.specW));
  let pitch=P.specW+Math.max(6,gap);
  if(pitch*g>BED-16) pitch=(BED-16)/g;
  const span=(g-1)*pitch, x0=-span/2, y0=-span/2;
  const saved={lambda:P.lambda,overshoot:P.overshoot,w:P.w,webType:P.webType,speed:P.speed,bead:P.bead};
  const N=Math.max(1,Math.round(P.specH/P.lh));
  for(let gy=0;gy<g;gy++) for(let gx=0;gx<g;gx++){
    const vx=SWEEP_VALS[P.sweepX][gx%6], vy=SWEEP_VALS[P.sweepY][gy%6];
    applySweep(P.sweepX,vx); applySweep(P.sweepY,vy);
    const ox=x0+gx*pitch, oy=y0+gy*pitch;
    const clFor=(zc)=>{const c=resamplePlan([{x:-P.specW/2,y:0},{x:P.specW/2,y:0}]); return c;};
    const specLayers=buildFrom(clFor,N,ox,oy);
    specLayers.forEach(L=>{L.spec={gx,gy,vx,vy}; layers.push(L);});
  }
  Object.assign(P,saved);
  // sort by z so layer slider + continuity behave
  layers.sort((a,b)=>a.zBot-b.zBot);
}
function applySweep(axis,v){ if(axis==='web') P.webType=v; else P[axis]=v; }

/* ---------- OBJ import ---------- */
let MESH=null, RAWV=null, objAxis='z';
function parseOBJ(txt){
  RAWV=[]; const tris=[];
  for(const ln of txt.split('\n')){
    const t=ln.trim().split(/\s+/);
    if(t[0]==='v') RAWV.push([+t[1],+t[2],+t[3]]);
    else if(t[0]==='f'){
      const ids=t.slice(1).map(s=>{let i=parseInt(s.split('/')[0]); return i<0?RAWV.length+i:i-1;});
      for(let i=1;i<ids.length-1;i++) tris.push([ids[0],ids[i],ids[i+1]]);
    }
  }
  MESH={tris}; normalizeMesh();
}
function normalizeMesh(){
  if(!RAWV||!MESH) return;
  const v=RAWV.map(p=>objAxis==='y'?[p[0],-p[2],p[1]]:[p[0],p[1],p[2]]);
  let mnx=1e9,mny=1e9,mnz=1e9,mxx=-1e9,mxy=-1e9,mxz=-1e9;
  for(const p of v){mnx=Math.min(mnx,p[0]);mny=Math.min(mny,p[1]);mnz=Math.min(mnz,p[2]);
    mxx=Math.max(mxx,p[0]);mxy=Math.max(mxy,p[1]);mxz=Math.max(mxz,p[2]);}
  const cx=(mnx+mxx)/2, cy=(mny+mxy)/2;
  MESH.v=v.map(p=>[p[0]-cx,p[1]-cy,p[2]-mnz]);
  MESH.zMax=mxz-mnz;
  const nb=Math.max(1,Math.ceil(MESH.zMax)+1);
  MESH.bins=Array.from({length:nb},()=>[]);
  MESH.tris.forEach((t,ti)=>{
    const zs=[MESH.v[t[0]][2],MESH.v[t[1]][2],MESH.v[t[2]][2]];
    const z0=Math.min(zs[0],zs[1],zs[2]), z1=Math.max(zs[0],zs[1],zs[2]);
    for(let b=Math.max(0,Math.floor(z0));b<=Math.min(nb-1,Math.floor(z1));b++) MESH.bins[b].push(ti);
  });
  if(hooks.onMeshInfo) hooks.onMeshInfo(MESH.tris.length+' tris · '+MESH.zMax.toFixed(1)+' mm tall · centered on bed');
}
function meshSlice(zc){
  if(!MESH||!MESH.v||zc>=MESH.zMax) return null;
  const z=zc+1e-4;
  const bin=MESH.bins[Math.min(MESH.bins.length-1,Math.max(0,Math.floor(z)))]||[];
  const segs=[];
  for(const ti of bin){
    const T=MESH.tris[ti], a=MESH.v[T[0]], b=MESH.v[T[1]], c=MESH.v[T[2]];
    const cr=[];
    for(const [p,q] of [[a,b],[b,c],[c,a]]){
      const d1=p[2]-z, d2=q[2]-z;
      if(d1*d2<0){const t=d1/(d1-d2); cr.push([p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]);}
    }
    if(cr.length===2) segs.push(cr);
  }
  if(!segs.length) return null;
  const key=p=>Math.round(p[0]*40)+'_'+Math.round(p[1]*40);
  const adj=new Map();
  segs.forEach((s,i)=>{for(const e of [0,1]){const k=key(s[e]);
    if(!adj.has(k)) adj.set(k,[]); adj.get(k).push([i,e]);}});
  const used=new Array(segs.length).fill(false);
  let best=null, bestLen=0;
  const starts=[];
  for(const lst of adj.values()) if(lst.length===1) starts.push(lst[0]);
  segs.forEach((s,i)=>starts.push([i,0]));
  for(const [si,se] of starts){
    if(used[si]) continue;
    let p0=segs[si][se], p1=segs[si][1-se];
    const chain=[p0,p1]; used[si]=true;
    let len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);
    while(true){
      const lst=(adj.get(key(p1))||[]).filter(x=>!used[x[0]]);
      if(!lst.length) break;
      const ni=lst[0][0], ne=lst[0][1];
      used[ni]=true;
      const nx=segs[ni][1-ne];
      len+=Math.hypot(nx[0]-p1[0],nx[1]-p1[1]);
      chain.push(nx); p1=nx;
    }
    if(len>bestLen){bestLen=len; best=chain;}
  }
  if(!best||best.length<2) return null;
  return resamplePlan(best.map(p=>({x:p[0],y:p[1]})));
}

/* ---------- top-level build ---------- */
function buildLayers(){
  seed=1337;   // deterministic jitter for EVERY build — a manifest's jitter_seed must reproduce the geometry (batch already did this; walls/domes drifted per rebuild)
  if(P.mode==='batch'){ buildBatch(); if(P.checkOv) detectOverlaps(); return; }
  if(P.mode==='import'){
    if(!MESH||!MESH.v){ layers=[]; return; }
    const N=Math.max(1,Math.floor(MESH.zMax/P.lh));
    layers=buildFrom((zc)=>meshSlice(zc), N, 0,0);
    if(P.checkOv) detectOverlaps(); return;
  }
  if(P.mode==='wall'){
    const base=resamplePlan(planPts); if(!base) { layers=[]; return; }
    const N=Math.max(1,Math.round(P.wallH/P.lh));
    layers=buildFrom(()=>base, N, 0,0);
  } else {
    const N=Math.max(1,Math.floor(P.domeR*P.hFrac/P.lh));
    const body=buildFrom((zc)=>domeCl(zc,P.domeR), N, 0,0);
    layers=buildDomeAdhesion().concat(body);
  }
  if(P.checkOv) detectOverlaps();
}
function detectOverlaps(){
  for(const L of layers){
    if(L.role==='adhesion'||L.role==='cap'){ L.ov=[]; continue; } // deliberate same-layer fill
    if(L.role==='web'&&L.webType==='eight'){ L.ov=[]; continue; }  // self-crossings are the point
    const lb=L.bead||P.bead, lw=L.wSpan||P.w, lo=(L.ovh!=null?L.ovh:P.overshoot);
    const minD=lb*0.95, cell=Math.max(minD,0.5);
    // skipGap must cover the perp rung+tab excursion (A+Aw+e ≈ w+2e) so deliberate
    // weld tabs aren't flagged as overlaps. Uses the layer's STAMPED overshoot —
    // in batch sweeps P.overshoot is already restored by the time we run.
    const skipGap=Math.ceil(Math.max(lw+2*lo+2, 3*lb)/STEP)+2;
    L.ov=[]; const map=new Map(); const key=(a,b)=>a+'_'+b;
    L.pts.forEach((p,i)=>{const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const bk=map.get(key(cx+dx,cy+dy));if(!bk)continue;
        for(const j of bk){const gap=Math.abs(i-j);if(gap<skipGap)continue;if(L.closed&&gap>L.pts.length-skipGap)continue;
          const q=L.pts[j];if(Math.hypot(p.x-q.x,p.y-q.y)<minD){L.ov.push({x:p.x,y:p.y,z:L.zBot+P.lh/2});break;}}}
      const kk=key(cx,cy);if(!map.has(kk))map.set(kk,[]);map.get(kk).push(i);});
    if(L.ov.length>120) L.ov=L.ov.filter((_,i)=>i%Math.ceil(L.ov.length/120)===0);
  }
}

/* ---------- ribbon geometry ---------- */
function simplifyPts(pts,tol,maxSeg){
  if(pts.length<3) return pts;
  const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){
    const a=out[out.length-1], b=pts[i+1], p=pts[i];
    const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy)||1;
    const d=Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)/L;
    if(d>tol || Math.hypot(p.x-a.x,p.y-a.y)>maxSeg) out.push(p);
  }
  out.push(pts[pts.length-1]);
  return out;
}
function ribbon(pts,hw,z0,z1){
  // dedupe consecutive duplicates (tabs/landings can emit repeats; slicer-safe)
  const q=[pts[0]];
  for(let i=1;i<pts.length;i++){const p=pts[i],l=q[q.length-1];
    if(Math.hypot(p.x-l.x,p.y-l.y)>1e-6) q.push(p);}
  const q2=simplifyPts(q,0.03,4);
  const n=q2.length; if(n<2) return null;
  // per-segment unit normals, then MITERED joins (clamped) so 90-degree turns
  // keep constant bead width instead of self-intersecting
  const sn=[];
  for(let i=0;i<n-1;i++){let tx=q2[i+1].x-q2[i].x,ty=q2[i+1].y-q2[i].y;const l=Math.hypot(tx,ty)||1;
    sn.push({x:-ty/l,y:tx/l});}
  const pos=new Float32Array(n*12), idx=[];
  for(let i=0;i<n;i++){
    const nA=sn[Math.max(0,i-1)], nB=sn[Math.min(n-2,i)];
    let mx=nA.x+nB.x, my=nA.y+nB.y, ml=Math.hypot(mx,my), ox,oy;
    if(ml<1e-4){ ox=nB.x*hw; oy=nB.y*hw; }              // 180-degree reversal fallback
    else{ mx/=ml; my/=ml;
      const s=Math.min(2.0, 1/Math.max(0.5, mx*nB.x+my*nB.y)); // miter, clamped
      ox=mx*hw*s; oy=my*hw*s; }
    const p=q2[i], b=i*12;
    pos[b]=p.x+ox;pos[b+1]=z0;pos[b+2]=p.y+oy; pos[b+3]=p.x-ox;pos[b+4]=z0;pos[b+5]=p.y-oy;
    pos[b+6]=p.x+ox;pos[b+7]=z1;pos[b+8]=p.y+oy; pos[b+9]=p.x-ox;pos[b+10]=z1;pos[b+11]=p.y-oy;}
  for(let i=0;i<n-1;i++){const a=i*4,c=(i+1)*4;
    idx.push(a+2,c+2,c+3,a+2,c+3,a+3, a,c+1,c,a,a+1,c+1, a,c,c+2,a,c+2,a+2, a+1,c+3,c+1,a+1,a+3,c+3);}
  idx.push(0,1,3,0,3,2);const e=(n-1)*4;idx.push(e,e+3,e+1,e,e+2,e+3);
  return {pos,idx:new Uint32Array(idx)};
}

/* ribbons for every layer (the UI does this while building meshes; headless callers ask for it) */
function buildRibbons(){ for(const L of layers){ const g=ribbon(L.pts,(L.bead||P.bead)/2,L.zBot,L.zTop); if(g) L.geo=g; } return layers.reduce((s,L)=>s+(L.geo?L.geo.idx.length/3:0),0); }

function bbox(){let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;for(const L of layers)for(const p of L.pts){
  if(p.x<mnx)mnx=p.x;if(p.y<mny)mny=p.y;if(p.x>mxx)mxx=p.x;if(p.y>mxy)mxy=p.y;}return {w:mxx-mnx,h:mxy-mny};}
function domeClosureState(){
  if(P.mode!=='dome') return {applicable:false,requested:false,closed:false,capLayers:0,opening_mm:null};
  const caps=layers.filter(L=>L.role==='cap');
  const last=[...layers].reverse().find(L=>L.cl&&L.cl.kind==='dome');
  const opening=caps.length?0:(last?Math.max(0,2*(last.cl.r-P.w/2)):null);
  return {applicable:true,requested:!!P.capClose,closed:caps.length>0,capLayers:caps.length,
    opening_mm:opening==null?null:+opening.toFixed(1),startRadius_mm:+domeCapStartRadius(P.domeR).toFixed(1)};
}
const PARAM_KEYS=['mode','wallH','domeR','sweep','hFrac','capClose','noz','bead','lh','webType',
  'cycle','w','lambda','amp','ampF','altPhase','autoLOD','minGap','gradeLean','lambdaS','overshoot',
  'dwell','jitter','flowBoost','maxBridge','checkOv','speed','bridgeSpeed','temp','bed','fan',
  'firstLayerBead','firstLayerSpeed','adhesion','adhesionWidth',
  'grid','sweepX','sweepY','specW','specH'];
const PARAM_RANGE={bead:[0.2,1.2],lh:[0.08,0.4],w:[2,40],lambda:[3,40],overshoot:[0,6],dwell:[0,3],
  jitter:[0,1],flowBoost:[1,2],speed:[5,200],bridgeSpeed:[3,80],temp:[180,300],bed:[0,100],fan:[0,100],
  firstLayerBead:[0.3,1.4],firstLayerSpeed:[5,30],adhesionWidth:[2,20],
  wallH:[1,300],domeR:[10,160],sweep:[10,360],hFrac:[0.1,1],amp:[0,8],ampF:[0,8],minGap:[0.4,10],
  lambdaS:[1,20],maxBridge:[2,60],grid:[2,6],specW:[8,120],specH:[4,120],noz:[0.2,0.8]};
const ENUMS={mode:['wall','dome','import','batch'],webType:['diagonal','perp','staple','sine','eight'],
  adhesion:['none','brim','foundation'],
  sweepX:['lambda','overshoot','w','web','speed','bead'],sweepY:['lambda','overshoot','w','web','speed','bead']};

function weftParams(){
  const o={machine:MACHINE};
  for(const k of PARAM_KEYS) o[k]=Array.isArray(P[k])?P[k].slice():P[k];
  if(P.mode==='wall') o.plan=planPts.map(q=>({x:+q.x.toFixed(3),y:+q.y.toFixed(3)}));
  return o;
}
/* Returns {applied:[], rejected:[{key,value,why}]} — a bad key is REFUSED and
   reported, never silently coerced: a repair loop needs to know what was wrong. */
function applyWeftParams(o){
  const applied=[], rejected=[];
  if(o.machine && MACHINES[o.machine]){ setMachine(o.machine); applied.push('machine'); }
  for(const k of PARAM_KEYS){
    if(!(k in o)) continue;
    let v=o[k];
    if(ENUMS[k] && !ENUMS[k].includes(v)){ rejected.push({key:k,value:v,why:'not one of '+ENUMS[k].join('|')}); continue; }
    if(k==='cycle'){
      if(!Array.isArray(v)||!v.length||!v.every(r=>['chord','web'].includes(r))){ rejected.push({key:k,value:v,why:'cycle must be a non-empty array of "chord"/"web"'}); continue; }
    } else if(PARAM_RANGE[k]){
      const n=+v, [lo,hi]=PARAM_RANGE[k];
      if(!isFinite(n)||n<lo||n>hi){ rejected.push({key:k,value:v,why:`out of range ${lo}..${hi}`}); continue; }
      v=n;
    }
    P[k]=Array.isArray(v)?v.slice():v; applied.push(k);
  }
  if(Array.isArray(o.plan)&&o.plan.length>=2){
    const pl=o.plan.filter(q=>isFinite(+q.x)&&isFinite(+q.y)).map(q=>({x:+q.x,y:+q.y}));
    if(pl.length>=2){ planPts=pl; applied.push('plan'); } else rejected.push({key:'plan',value:'…',why:'needs >=2 finite points'});
  }
  return {applied,rejected};
}
/* The verdict. errors = will not print / not the method; warnings = printable but
   outside the design intent. Numbers are the same ones the status panel shows. */
function validityReport(){
  const errors=[], warnings=[];
  /* same aggregation as updateStats — one source of truth for the numbers the
     UI shows and the numbers a model is answered with */
  let len=0,nodes=0,ov=0,t=0,minGap=1e9,zmax=0;
  for(const L of layers){
    len+=L.len; nodes+=L.apexes.length; ov+=(L.ov?L.ov.length:0);
    zmax=Math.max(zmax,(L.zBot||0)+P.lh);
    if(L.nodeGap!=null) minGap=Math.min(minGap,L.nodeGap);
    const base=L.speed||P.speed;
    const spd=L.zBot===0?base:(L.role==='chord'?Math.min(P.bridgeSpeed,base):base);
    t+=L.len/spd+0.6;
  }
  const AwS=P.w/2+P.overshoot; let webSpan, chordSpan;
  if(P.webType==='staple'){ webSpan=P.w+2*P.overshoot; chordSpan=P.lambda/2; }
  else if(P.webType==='perp'){ webSpan=Math.max(P.w+2*P.overshoot, P.lambda/2); chordSpan=P.lambda/2; }
  else { webSpan=Math.hypot(P.lambda/2, 2*AwS); chordSpan=P.lambda; }
  /* WEFT-02: the chord span is not P.lambda/2 — it is the longest arc the web actually
     left without a crossing. A parameter cannot answer this; only the emitted layer can. */
  let railMax=0, skippedRungs=0, deadWebs=0;
  for(const L of layers){ if(L.role!=='web') continue;
    if(L.maxRail!=null) railMax=Math.max(railMax,L.maxRail);
    skippedRungs+=(L.skipped||0);
    if(!L.apexes.length) deadWebs++; }
  if(railMax>0) chordSpan=Math.max(chordSpan, railMax);
  const bb=bbox(), gapFloor=Math.max(P.minGap,P.bead*2.2);
  const fits=bb.w<=BED-10&&bb.h<=BEDY-10;
  let tris=0; for(const L of layers) if(L.geo) tris+=L.geo.idx.length/3;

  if(!layers.length) errors.push('no geometry: the build produced zero layers');
  if(!fits) errors.push(`does not fit the ${MACHINES[MACHINE].label} plate: ${bb.w.toFixed(0)}×${bb.h.toFixed(0)} mm in ${BED}×${BEDY}`);
  if(ov) errors.push(`${ov} unintended same-layer overlaps — threads would fuse where they should cross`);
  if(minGap<1e8&&minGap<gapFloor*0.99) errors.push(`weld nodes ${minGap.toFixed(2)} mm apart, below the ${gapFloor.toFixed(2)} mm floor (2.2 beads)`);
  if(P.temp>MACHINES[MACHINE].hotMax) errors.push(`nozzle ${P.temp} °C exceeds the ${MACHINES[MACHINE].label} limit of ${MACHINES[MACHINE].hotMax} °C`);
  if(P.bed>MACHINES[MACHINE].bedMax) errors.push(`bed ${P.bed} °C exceeds the ${MACHINES[MACHINE].label} limit of ${MACHINES[MACHINE].bedMax} °C`);
  const adhesionPaths=layers.filter(L=>L.role==='adhesion');
  if(P.adhesion!=='none'&&(P.mode!=='dome'||P.sweep<359.9)) errors.push('built-in adhesion currently requires a closed 360° dome');
  if(P.adhesion!=='none'&&!adhesionPaths.length) errors.push(`adhesion ${P.adhesion} was requested but no first-layer path was generated`);
  if(P.firstLayerBead<P.bead) warnings.push(`first-layer bead ${P.firstLayerBead} mm is narrower than the ${P.bead} mm body bead`);
  if(P.firstLayerBead<P.noz*0.9||P.firstLayerBead>P.noz*2.2) warnings.push(`first-layer bead ${P.firstLayerBead} mm is outside the single-line range of a ${P.noz} mm nozzle`);
  const crown=domeClosureState();
  if(crown.applicable&&crown.requested&&!crown.closed){
    const msg=`cap closure did not engage: a ${crown.opening_mm} mm crown opening remains at this height`;
    if(P.hFrac>=0.99) errors.push(msg); else warnings.push(msg+' (partial dome)');
  }
  if(webSpan>P.maxBridge) warnings.push(`web bridges ${webSpan.toFixed(1)} mm, over the ${P.maxBridge} mm limit — expect droop`);
  if(chordSpan>P.maxBridge) errors.push(`chord spans ${chordSpan.toFixed(1)} mm between welds, over the ${P.maxBridge} mm limit`);
  if(deadWebs) errors.push(`${deadWebs} web layers placed no crossing at all — the chord above them is unsupported for a whole turn`);
  if(skippedRungs) warnings.push(`${skippedRungs} rungs could not be placed (corner too tight even at zero tab)`);
  if(P.bead<P.noz*0.9||P.bead>P.noz*2.2) warnings.push(`bead ${P.bead} mm is outside the single-line range of a ${P.noz} mm nozzle`);
  if(P.lh>P.bead*0.8) warnings.push(`layer ${P.lh} mm against bead ${P.bead} mm: too little squish for reliable welds`);
  if(P.mode==='batch') warnings.push('batch mode: span figures describe the restored parameter set, not each swept cell');

  return { valid:errors.length===0, errors, warnings,
    machine:MACHINES[MACHINE].label, bed:[BED,BEDY],
    layers:layers.length, weldNodes:nodes, threadLength_mm:+len.toFixed(0),
    size_mm:[+bb.w.toFixed(1),+bb.h.toFixed(1),+zmax.toFixed(1)], bedFit:fits,
    overlaps:ov, minNodeGap_mm:minGap<1e8?+minGap.toFixed(2):null, nodeGapFloor_mm:+gapFloor.toFixed(2),
    skippedRungs, deadWebLayers:deadWebs,
    maxWebSpan_mm:+webSpan.toFixed(1), maxChordSpan_mm:+chordSpan.toFixed(1),
    wallWidth_mm:+(P.w+2*Math.max(0,P.overshoot)).toFixed(2),
    firstLayer:{mode:P.adhesion,bead_mm:P.firstLayerBead,speed_mm_s:P.firstLayerSpeed,
      width_mm:P.adhesion==='none'?0:P.adhesionWidth,paths:adhesionPaths.length,
      threadLength_mm:+adhesionPaths.reduce((s,L)=>s+L.len,0).toFixed(0)},
    crown,
    estPrint_min:Math.round(t/60), triangles:tris };
}
/* one call for the harness: params in → build → verdict out */
function weftEvaluate(o){
  const r=applyWeftParams(o||{});
  if(hooks.fullBuild) hooks.fullBuild(); else { buildLayers(); buildRibbons(); }
  const v=validityReport();
  if(r.rejected.length) v.errors=r.rejected.map(x=>`parameter "${x.key}"=${JSON.stringify(x.value)} rejected: ${x.why}`).concat(v.errors), v.valid=false;
  return {...v, applied:r.applied, rejected:r.rejected, params:weftParams()};
}
/* pure builder: returns the binary STL as an array of ArrayBuffers.
   Kept free of DOM/download concerns so the headless test suite can call it. */
async function buildSTLParts(onProgress){
    let tris=0; for(const L of layers) if(L.geo) tris+=L.geo.idx.length/3;
    const head=new ArrayBuffer(84); new DataView(head).setUint32(80,tris,true);
    const parts=[head];
    const a={x:0,y:0,z:0},b={x:0,y:0,z:0},c={x:0,y:0,z:0},n={x:0,y:0,z:0};
    const from=(o,p,i)=>{o.x=p[i];o.y=p[i+1];o.z=p[i+2];};
    for(let li=0; li<layers.length; li++){
      const L=layers[li]; if(!L.geo) continue;
      const p=L.geo.pos, ix=L.geo.idx;
      const buf=new ArrayBuffer((ix.length/3)*50), dv=new DataView(buf); let off=0;
      for(let i=0;i<ix.length;i+=3){
        // vertex order reversed (a,c,b): scene coords are y-up, the STL is z-up,
        // and that axis swap mirrors chirality — reversing the winding keeps
        // every facet outward (earlier exports sliced inside-out). The normal is
        // (c-a)×(b-a): equal to the file-space winding normal after the y/z swap.
        from(a,p,ix[i]*3); from(b,p,ix[i+2]*3); from(c,p,ix[i+1]*3);
        { const ux=c.x-a.x,uy=c.y-a.y,uz=c.z-a.z, vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z;
          n.x=uy*vz-uz*vy; n.y=uz*vx-ux*vz; n.z=ux*vy-uy*vx;
          const nl=Math.hypot(n.x,n.y,n.z); if(nl>0){ n.x/=nl; n.y/=nl; n.z/=nl; } }
        dv.setFloat32(off,n.x,true);dv.setFloat32(off+4,n.z,true);dv.setFloat32(off+8,n.y,true);
        dv.setFloat32(off+12,a.x,true);dv.setFloat32(off+16,a.z,true);dv.setFloat32(off+20,a.y,true);
        dv.setFloat32(off+24,b.x,true);dv.setFloat32(off+28,b.z,true);dv.setFloat32(off+32,b.y,true);
        dv.setFloat32(off+36,c.x,true);dv.setFloat32(off+40,c.z,true);dv.setFloat32(off+44,c.y,true);
        dv.setUint16(off+48,0,true); off+=50;
      }
      parts.push(buf);
      if(li%10===0){ onProgress&&onProgress(Math.round(100*li/layers.length));
        await new Promise(r=>setTimeout(r,0)); }
    }
    return parts;
}
const FOOT_DEF=`; --- WEFT end ---
M106 S0
G1 E-2 F1800
M104 S0
M140 S0
G91
G1 Z10 F600
G90
M84`;
const HEAD_HINT=`; ⚠ PASTE YOUR A2L START BLOCK HERE
; In Bambu Studio: slice any object for the A2L, export G-code,
; and copy everything up to the first extruding G1 ...E... move.
; That block homes, meshes the bed and sets temps correctly.
; Until you paste it, this file uses a minimal generic start:
M83
G21
G90
M140 S{BED}
M104 S{TEMP}
G28
M190 S{BED}
M109 S{TEMP}
G1 Z2 F600`;
/* pure builder: returns the full G-code as one string (reads header/footer
   from the two textareas). DOM/download handling lives in exportGcode. */
async function buildGcodeText(onProgress,headText,footText){
  if(headText==null) headText=gcodeHead; if(footText==null) footText=gcodeFoot;
  // An empty/raised first path must never be turned into a downloadable print.
  // Check the bed group itself: a startup purge cannot satisfy this contract.
  if(!layers.length) throw new Error('WEFT first layer: no model paths');
  const firstZ=layers[0].zTop, firstH=firstZ-layers[0].zBot;
  if(!Number.isFinite(firstZ)||firstZ<=0||Math.abs(layers[0].zBot)>1e-6||Math.abs(firstH-P.lh)>1e-6)
    throw new Error('WEFT first layer must start on the bed at the machine layer height');
  for(const [i,L] of layers.entries()){
    if(!Number.isFinite(L.zBot)||!Number.isFinite(L.zTop)||L.zTop<=L.zBot||!Array.isArray(L.pts)||L.pts.length<2||
       L.pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||
       !L.pts.some((p,j)=>j&&Math.hypot(p.x-L.pts[j-1].x,p.y-L.pts[j-1].y)>0.001))
      throw new Error(`WEFT empty or invalid model path ${i}`);
    if(Math.abs(L.zTop-firstZ)<1e-6&&Math.abs(L.zBot)>1e-6)
      throw new Error('WEFT first layer contains a raised path');
  }
  const rawHead=String(headText).replace(/\{TEMP\}/g,P.temp).replace(/\{BED\}/g,P.bed);
  // Slicer preview-only preparation scope. WIPE moves are not deposition layers,
  // even when a purge is above the model's first Z. Keep EVERY machine command.
  // Insert after config/header comments so the harvested file signature stays first.
  const head=wrapStartupPreview(rawHead);
  const out=[head,
    `; WEFT_FIRST_LAYER_V1 Z=${firstZ.toFixed(3)} H=${firstH.toFixed(3)}`,
    `; WEFT first layer: ${P.firstLayerBead} mm bead @ ${P.firstLayerSpeed} mm/s`,
    `; WEFT adhesion: ${P.adhesion}${P.adhesion==='none'?'':` ${P.adhesionWidth} mm`}`,
    '; Slicer Route A: elephant-foot compensation 0; XY contour compensation 0; do not add a second brim when built-in adhesion is on'];
  let cur=null, lastSpec=null, fanOn=false;
  const nodeR=Math.max(1.0,P.bead*2), RETRACT=0.8, HOP=0.4;
  // the model frame is bed-CENTERED; the A2L (like most printers) puts G-code
  // origin at the FRONT-LEFT corner. Without this shift the print lands half
  // off the plate — caught on the first real harvested-header dry run.
  const OX=BED/2, OY=BEDY/2;
  let gcZ=null, gcLayer=0;
  for(let k=0;k<layers.length;k++){
    const L=layers[k];
    /* A build with many bodies is still one printer timeline. Every body at z=N must be emitted
       before any body at z=N+1; otherwise the nozzle later descends into already-built material.
       Equal Z values are intentional (one pass per body), decreasing Z is never intentional. */
    if(gcZ!==null&&L.zTop<gcZ-1e-6){
      throw new Error(`WEFT global Z order violated at path ${k}: ${L.zTop.toFixed(3)} after ${gcZ.toFixed(3)}`);
    }
    let pts=L.preservePoints?L.pts:simplifyPts(L.pts,0.02,2);
    if(cur){
      if(L.closed){let best=0,bd=1e9;for(let i=0;i<pts.length;i++){const d=Math.hypot(pts[i].x-cur.x,pts[i].y-cur.y);if(d<bd){bd=d;best=i;}}
        pts=pts.slice(best).concat(pts.slice(0,best));pts=pts.concat([pts[0]]);}
      else{const dS=Math.hypot(pts[0].x-cur.x,pts[0].y-cur.y),dE=Math.hypot(pts[pts.length-1].x-cur.x,pts[pts.length-1].y-cur.y);if(dE<dS)pts=[...pts].reverse();}
    }
    const first=L.zBot===0;   // TRUE bed layer — by height, not array position (batch interleaves 16 first layers)
    /* Bambu Studio's preview does not infer layers from Z moves. Its G-code dialect requires the
       spaced CHANGE_LAYER / Z_HEIGHT / LAYER_HEIGHT comments used by a real Studio export. The
       Cura-style LAYER_CHANGE / Z / HEIGHT spelling flattens the preview into layer 1 and reports
       model time as zero. Comments only: they change nothing that is printed. */
    if(gcZ===null||Math.abs(L.zTop-gcZ)>1e-6){
      out.push('; CHANGE_LAYER', `; Z_HEIGHT: ${L.zTop.toFixed(3)}`,
        `; LAYER_HEIGHT: ${(L.zTop-L.zBot).toFixed(3)}`);
      gcZ=L.zTop; gcLayer++;
    }
    /* The harvested Bambu start block ends in `FEATURE: Custom`. Bambu Studio keeps that role
       until another FEATURE tag appears; while it is active, every G1 is classified as startup
       motion, its displayed Z is forced to the first-layer height, and model time stays zero.
       Repeat the role and width for every emitted body/path, exactly as the earlier annotated
       Route-B pilot did. This is preview metadata only; it does not change machine motion. */
    const previewRole=L.role==='adhesion'?'Brim':L.role==='bridge'?'Bridge':'Outer wall';
    const previewWidth=L.bead||P.bead;
    out.push(`; layer ${k} ${L.role}`, `; FEATURE: ${previewRole}`,
      `; LINE_WIDTH: ${previewWidth.toFixed(3)}`);
    // part cooling: off while anything is still printing on the bed, on above it
    if(!first&&!fanOn){ out.push(`M106 S${Math.round(P.fan*2.55)}`); fanOn=true; }
    const p0=pts[0];
    const travel=cur?Math.hypot(p0.x-cur.x,p0.y-cur.y):0;
    const lw=L.wSpan||P.w, lo=(L.ovh!=null?L.ovh:P.overshoot);
    const spec=L.spec||null;
    const crossSpec=!!(spec&&lastSpec&&(spec.gx!==lastSpec.gx||spec.gy!==lastSpec.gy));
    // within one object the thread stays wet and unretracted (continuity is the
    // method); hops between separate specimens get retract + z-hop so the nozzle
    // neither strings across the plate nor ploughs through fresh lattice
    if(cur&&(crossSpec||travel>Math.max(6,lw+2*lo+2))){
      out.push(`G1 E-${RETRACT} F1800`);
      out.push(`G1 Z${(L.zTop+HOP).toFixed(3)} F600`);
      out.push(`G0 X${(p0.x+OX).toFixed(3)} Y${(p0.y+OY).toFixed(3)} F9000`);
      out.push(`G1 Z${L.zTop.toFixed(3)} F600`);
      out.push(`G1 E${RETRACT} F1800`);
    } else {
      out.push(`G1 Z${L.zTop.toFixed(3)} F600`);
      if(!cur||travel>0.4) out.push(`G0 X${(p0.x+OX).toFixed(3)} Y${(p0.y+OY).toFixed(3)} F9000`);
    }
    const bridge=L.role==='bridge'||(L.role==='chord'&&L.zBot>0); // explicit bridges + woven chords on discrete nodes
    const apx=L.apexes.length?L.apexes:(k>0&&layers[k-1]?layers[k-1].apexes:[]);
    const lb=previewWidth;
    // slicer-standard stadium cross-section (w−h)·h + π(h/2)² — matches what
    // Arachne assumes on Route A, so Route B lays the same volume per mm
    const bArea=lb>P.lh ? (lb-P.lh)*P.lh+Math.PI*P.lh*P.lh/4 : Math.PI*lb*lb/4;
    let prev=p0;
    for(let i=1;i<pts.length;i++){const p=pts[i],d=Math.hypot(p.x-prev.x,p.y-prev.y);if(d<1e-5){prev=p;continue;}
      const baseSpd=L.speed||P.speed;
      let flow=1,spd=first?baseSpd:(bridge?Math.min(P.bridgeSpeed,baseSpd):baseSpd);
      if(apx.length){const mx=(p.x+prev.x)/2,my=(p.y+prev.y)/2;
        for(const A of apx){if(Math.hypot(A.x-mx,A.y-my)<nodeR){flow=P.flowBoost;spd*=0.65;break;}}}
      const e=d*bArea/FIL_AREA*flow;
      out.push(`G1 X${(p.x+OX).toFixed(3)} Y${(p.y+OY).toFixed(3)} E${e.toFixed(5)} F${Math.round(spd*60)}`);
      prev=p;}
    cur=prev; if(spec) lastSpec=spec;
    if(k%10===0){ onProgress&&onProgress(Math.round(100*k/layers.length));
      await new Promise(r=>setTimeout(r,0)); }
  }
  out.push(String(footText));
  const text=out.join('\n');
  // Pure Node users of the core get the same refusal as browser/CLI exports.
  if(!root.WEFT_GATE) await import('./weft_gate.js');
  const firstLayer=root.WEFT_GATE.firstLayerAudit(text);
  if(!firstLayer.PASS) throw new Error('WEFT first-layer export refused: '+JSON.stringify(firstLayer.issues));
  return text;
}
gcodeFoot=FOOT_DEF; gcodeHead=HEAD_HINT;
const api={};
Object.defineProperties(api,{
    AfAt:{get:()=>AfAt,set:v=>{AfAt=v;},enumerable:true},
    apexUs:{get:()=>apexUs,set:v=>{apexUs=v;},enumerable:true},
    applySweep:{get:()=>applySweep,set:v=>{applySweep=v;},enumerable:true},
    applyWeftParams:{get:()=>applyWeftParams,set:v=>{applyWeftParams=v;},enumerable:true},
    bbox:{get:()=>bbox,set:v=>{bbox=v;},enumerable:true},
    buildBatch:{get:()=>buildBatch,set:v=>{buildBatch=v;},enumerable:true},
    buildDomeAdhesion:{get:()=>buildDomeAdhesion,set:v=>{buildDomeAdhesion=v;},enumerable:true},
    buildFrom:{get:()=>buildFrom,set:v=>{buildFrom=v;},enumerable:true},
    buildGcodeText:{get:()=>buildGcodeText,set:v=>{buildGcodeText=v;},enumerable:true},
    buildLayers:{get:()=>buildLayers,set:v=>{buildLayers=v;},enumerable:true},
    buildRibbons:{get:()=>buildRibbons,set:v=>{buildRibbons=v;},enumerable:true},
    buildSTLParts:{get:()=>buildSTLParts,set:v=>{buildSTLParts=v;},enumerable:true},
    chordLayer:{get:()=>chordLayer,set:v=>{chordLayer=v;},enumerable:true},
    clSample:{get:()=>clSample,set:v=>{clSample=v;},enumerable:true},
    closedHalves:{get:()=>closedHalves,set:v=>{closedHalves=v;},enumerable:true},
    curvAt:{get:()=>curvAt,set:v=>{curvAt=v;},enumerable:true},
    decimatedHalf:{get:()=>decimatedHalf,set:v=>{decimatedHalf=v;},enumerable:true},
    detectOverlaps:{get:()=>detectOverlaps,set:v=>{detectOverlaps=v;},enumerable:true},
    domeCapStartRadius:{get:()=>domeCapStartRadius,set:v=>{domeCapStartRadius=v;},enumerable:true},
    domeCl:{get:()=>domeCl,set:v=>{domeCl=v;},enumerable:true},
    domeClosureState:{get:()=>domeClosureState,set:v=>{domeClosureState=v;},enumerable:true},
    emitParam:{get:()=>emitParam,set:v=>{emitParam=v;},enumerable:true},
    filletParam:{get:()=>filletParam,set:v=>{filletParam=v;},enumerable:true},
    halfWave:{get:()=>halfWave,set:v=>{halfWave=v;},enumerable:true},
    halfWidthFor:{get:()=>halfWidthFor,set:v=>{halfWidthFor=v;},enumerable:true},
    lamEff:{get:()=>lamEff,set:v=>{lamEff=v;},enumerable:true},
    mapUV:{get:()=>mapUV,set:v=>{mapUV=v;},enumerable:true},
    meshSlice:{get:()=>meshSlice,set:v=>{meshSlice=v;},enumerable:true},
    normalizeMesh:{get:()=>normalizeMesh,set:v=>{normalizeMesh=v;},enumerable:true},
    objAt:{get:()=>objAt,set:v=>{objAt=v;},enumerable:true},
    offsetPts:{get:()=>offsetPts,set:v=>{offsetPts=v;},enumerable:true},
    parseOBJ:{get:()=>parseOBJ,set:v=>{parseOBJ=v;},enumerable:true},
    phaseAt:{get:()=>phaseAt,set:v=>{phaseAt=v;},enumerable:true},
    plen:{get:()=>plen,set:v=>{plen=v;},enumerable:true},
    preset:{get:()=>preset,set:v=>{preset=v;},enumerable:true},
    radialSpiral:{get:()=>radialSpiral,set:v=>{radialSpiral=v;},enumerable:true},
    resamplePlan:{get:()=>resamplePlan,set:v=>{resamplePlan=v;},enumerable:true},
    ribbon:{get:()=>ribbon,set:v=>{ribbon=v;},enumerable:true},
    roundPlanCorners:{get:()=>roundPlanCorners,set:v=>{roundPlanCorners=v;},enumerable:true},
    rungFits:{get:()=>rungFits,set:v=>{rungFits=v;},enumerable:true},
    setMachine:{get:()=>setMachine,set:v=>{setMachine=v;},enumerable:true},
    simplifyPts:{get:()=>simplifyPts,set:v=>{simplifyPts=v;},enumerable:true},
    validityReport:{get:()=>validityReport,set:v=>{validityReport=v;},enumerable:true},
    webLayer:{get:()=>webLayer,set:v=>{webLayer=v;},enumerable:true},
    weftEvaluate:{get:()=>weftEvaluate,set:v=>{weftEvaluate=v;},enumerable:true},
    weftParams:{get:()=>weftParams,set:v=>{weftParams=v;},enumerable:true},
    widthPhase:{get:()=>widthPhase,set:v=>{widthPhase=v;},enumerable:true},
    MACHINES:{get:()=>MACHINES,enumerable:true},
    STEP:{get:()=>STEP,enumerable:true},
    FIL_AREA:{get:()=>FIL_AREA,enumerable:true},
    PARAM_KEYS:{get:()=>PARAM_KEYS,enumerable:true},
    PARAM_RANGE:{get:()=>PARAM_RANGE,enumerable:true},
    ENUMS:{get:()=>ENUMS,enumerable:true},
    SWEEP_VALS:{get:()=>SWEEP_VALS,enumerable:true},
    FOOT_DEF:{get:()=>FOOT_DEF,enumerable:true},
    HEAD_HINT:{get:()=>HEAD_HINT,enumerable:true},
    MACHINE:{get:()=>MACHINE,set:v=>{MACHINE=v;},enumerable:true},
    BED:{get:()=>BED,set:v=>{BED=v;},enumerable:true},
    BEDY:{get:()=>BEDY,set:v=>{BEDY=v;},enumerable:true},
    planPts:{get:()=>planPts,set:v=>{planPts=v;},enumerable:true},
    layers:{get:()=>layers,set:v=>{layers=v;},enumerable:true},
    seed:{get:()=>seed,set:v=>{seed=v;},enumerable:true},
    MESH:{get:()=>MESH,set:v=>{MESH=v;},enumerable:true},
    RAWV:{get:()=>RAWV,set:v=>{RAWV=v;},enumerable:true},
    objAxis:{get:()=>objAxis,set:v=>{objAxis=v;},enumerable:true},
    exporting:{get:()=>exporting,set:v=>{exporting=v;},enumerable:true},
    gcodeHead:{get:()=>gcodeHead,set:v=>{gcodeHead=v;},enumerable:true},
    gcodeFoot:{get:()=>gcodeFoot,set:v=>{gcodeFoot=v;},enumerable:true},
    P:{get:()=>P,enumerable:true},
    hooks:{get:()=>hooks,enumerable:true}
});
api.version=WEFT_CORE_VERSION;
return api;
}
function wrapStartupPreview(head){
  if(/; WEFT_STARTUP_PREVIEW_BEGIN/.test(head)) throw new Error('startup already wrapped');
  const lines=String(head).split('\n'), i=lines.findIndex(s=>s.trim()&&!s.trimStart().startsWith(';'));
  const at=i<0?lines.length:i;
  lines.splice(at,0,'; WEFT_STARTUP_PREVIEW_BEGIN','; WIPE_START');
  // A slicer-owned inner wipe end must not expose a later preparation extrusion.
  for(let j=at+2;j<lines.length;j++)if(/^;\s*WIPE_END\s*$/.test(lines[j]))lines.splice(++j,0,'; WIPE_START');
  lines.push('; WIPE_END','; WEFT_STARTUP_PREVIEW_END');
  return lines.join('\n');
}
root.WEFT_CORE={createWeftCore,wrapStartupPreview,version:WEFT_CORE_VERSION};
})(typeof globalThis!=='undefined'?globalThis:this);
