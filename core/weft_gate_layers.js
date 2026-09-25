/* ============================================================
   WEFT gate, layers S2–S8 — what KRAK taught the gate (2026-09-25).

   On 2026-09-24 two copies of KRAK were printed and both were destroyed, and the support gate
   (core/weft_gate.js, layer S1 here) had said PASS with zero problems for both files. Measured
   afterwards over the bytes of the shipped G-code: 47 m of the A2L object's 279 m of thread is laid
   with nothing under it, terrace K1 alone holds 512 continuous free runs longer than 10 mm inside a
   band 2.88 mm tall, and the tips of those runs are never tied by anything laid later. In the
   photographs those tips stand up as curled hairpins, the nozzle — printing, not travelling —
   passes through the space they now occupy, catches one and drags; on the A2L the object sheared
   at the terrace-to-wall joint (the ring above the terrace rests on tooth roots, on points), on the
   Ender the whole object left the plate.

   S1 answers one question: "is there material under this point". The object died of questions S1
   does not ask. Each layer below asks ONE of them, measures ONE quantity over the final G-code, and
   judges it against the printed record. The layers are not ranks: every layer may refuse on its
   own, no layer can overrule another, and the result is a VECTOR of verdicts, not one PASS.

     S2 · quantity     how much thread hangs — free metres, free runs > 10 mm, longest run, per layer
     S3 · free tips    how far a returning hairpin or free end reaches, and whether it is ever tied
     S4 · overflight   extrusion passing over a still-loose tip of an earlier band (the hook the nozzle meets)
     S5 · plate        what holds the object against what is built above it (Ender KRAK left the plate)
     S7 · joint        a layer carried on points: the shear plane the A2L KRAK broke along
     S8 · stacking     a layer laid onto itself (no crossings, no nodes) and the A-B-A-B repeat; crossing angles

   Material that stands only on loose material is loose: a hairpin laid on a hairpin laid in air is a
   cantilever pile, however many layers tall, and every layer of it registers its tips (S1 sees each layer
   resting on the last and is blind to that, which is how every K1 layer of KRAK after the first passed).
   A pile `pileLayers` deep (12: the terraces that printed flat on OBRTAJ are 12 layers of hairpins) is
   taken as consolidated — an assumption drawn from one held object, not a measurement.

   Every limit below carries its evidence. A value inside the printed-and-held bracket is GREEN;
   a value at or beyond a printed failure is RED; a value between the two is UNKNOWN and is
   refused outside a declared experiment zone — exactly the rule the evidenced 16.2 mm bridge
   ceiling already imposes on S1. The zone mechanism is the same: a zone may declare which layers
   it knowingly exceeds, and only findings inside such a zone are counted as declared.

   Classic script (no import/export) so index.html and Node share one file: registers
   globalThis.WEFT_GATE_LAYERS = { analyse, LIMITS, HEAD, version }. Needs weft_gate.js first
   (parseGcode, edt, pyround are reused verbatim so the grid is the S1 grid).
   ============================================================ */
(function(root){
'use strict';
const VERSION = 'gate-layers-2026-09-25-krak';
const G = root.WEFT_GATE;
if(!G) throw new Error('weft_gate_layers.js needs weft_gate.js loaded first');

/* ---------- the record the limits come from ------------------------------------------------
   hold  = printed and stood (OBRTAJ_ENDER_H7, 2026-09-23: six flat terraces of returning hairpins)
   fail  = printed and did not (RAZMAK_A2L_H4 stopped at terrace 1, 2026-09-23; KRAK both machines, 2026-09-24)
   Values are what FINDINGS_2026-09-23_terrace_measurement.md and journal/2026-09-25_KRAK_* measured
   from the delivered geometry and G-code. A limit is the HOLD value; anything past it is unevidenced. */
const LIMITS = {
  /* Every number below was measured by THIS instrument (analyse) over the shipped G-code of the printed
     objects, so hold and fail are comparable. OBRTAJ_ENDER_H7 (2026-09-23) is the only returning-hairpin
     terrace object that printed and stood; RAZMAK_A2L_H4 (2026-09-23, stopped at terrace 1, nests) and
     KRAK (2026-09-24, both machines, stopped by Semir when the nozzle dragged) are the failures. */
  S2: { runs10PerLayer: { hold:203, fail:33, unit:'free runs > 10 mm in one layer',
          evidence:'OBRTAJ terrace-1 layer 0: 203 runs, 6.9 m free thread in ONE layer, 36 % of the whole object free — held flat. KRAK K1 layer 0: 33 runs, 1.25 m — destroyed. The quantity of hanging thread does NOT decide; S2 reports, S3 refuses' } },
  S3: { median:  { hold:17.6, fail:22.6, unit:'mm, median free reach (to solid material) of the loose tips of one layer',
          evidence:'OBRTAJ: 66 terrace layers, medians 6–17.6, held flat; KRAK K1: twelve layers at 22.6–24.5, destroyed on both machines; RAZMAK terrace-1: 30.7, nested and stopped. One statistic separates the printed record' },
        max:     { hold:37.6, fail:73.8, unit:'mm, longest free reach in one layer (reported, not refused: KRAK failed at 24.6, far below the OBRTAJ maximum — the longest tip alone does not decide)',
          evidence:'OBRTAJ terrace-1 max 37.6 held; RAZMAK terrace-1 max 73.8 nested' },
        min:     { hold:3.4,  fail:12.4, unit:'mm, shortest tip of a layer that has long tips (reported, not refused: the median alone separates the printed record, and a bracket built on one comparison must not refuse)',
          evidence:'OBRTAJ every terrace min 2.0–3.4 held (short tips among long ones); RAZMAK terrace-1 min 12.4 nested; KRAK K1 min 21.7 destroyed' },
        longTip: 8.0 },
  S4: { clearance: { hold:null, fail:5.28, unit:'mm of Z between a still-loose tip and extrusion passing over it',
          evidence:'KRAK: K2 castle legs pass 5.3–8.6 mm above K1 tips that nothing ever tied, K3 over K2 likewise — destroyed. OBRTAJ: zero such passes (its steps go inward, nothing flies over a fringe) — held. Refused at any clearance ≤ 12 mm: the margin above the evidenced failure is ASSUMED' },
        refuseBelow: 12.0 },
  S5: { ratio: { hold:0.343, fail:null, unit:'mm² of first-layer contact per (mm height × mm lever)',
          evidence:'OBRTAJ 0.343 held on the Ender plate; KRAK A2L 0.352 held on the A2L plate while the object broke above it; KRAK Ender left the plate at its value — a plate number is per machine and per plate state; reported, refused only when given --s5fail' } },
  S7: { carried: { hold:0.118, fail:null, unit:'fraction of a layer laid on material, layers with ≥ 20 layers above',
          evidence:'OBRTAJ terrace-1 layer 0: 11.8 % carried with 939 layers above — held. The fraction alone cannot refuse; reported so the joint the drag will find is known' },
        minAbove:20 },
  S8: { selfStack: { hold:0.983, fail:null, unit:'fraction of a layer within a quarter bead of the layer below',
          evidence:'OBRTAJ foundation and crown layers at 0.976–0.983 printed; the weave rule (Semir, 2026-09-18: every layer must cross the one below) is a GENERATOR rule — here it is reported per layer, not refused' },
        periodTwo: { note:'A-B-A-B (layer k = layer k+2) is reported, not refused: OBRTAJ printed flat with 114 such layers' } },
};

/* the head that meets a risen tip: the nozzle cone above the tip. ASSUMED from the Bambu A1-series /
   Creality Ender-3 V4 hotends (tip ~1.2 mm flat, widening ~0.7 mm per mm up to the ~8 mm wide cone).
   The heater block and silicone sock above the cone are wider still but are deliberately NOT modelled:
   the only evidenced collision (KRAK) is extrusion passing straight over loose tips 5–8 mm below, and
   a block-width envelope would also flag the next-tier walls of the ziggurat that printed and held.
   Not measured; per machine later. */
const HEAD = { tipRadius:0.6, coneSlope:0.7, coneHeight:2.0 };
/* the envelope is capped at 2.0 mm laterally: every evidenced overflight on KRAK (K2 castle legs over the
   never-tied K1 hairpin tips, 5–9 mm below) lies within 1.5 mm of the tip; the 3–4 mm passes of a wall
   beside corbel lips have no evidence either way and are NOT flagged */
function headRadius(h){ return HEAD.tipRadius+HEAD.coneSlope*Math.min(h,HEAD.coneHeight); }

const pyround=G.pyround;
function pct(arr,p){ if(!arr.length) return NaN; const a=Float64Array.from(arr).sort(); const i=(a.length-1)*p/100, lo=Math.floor(i), hi=Math.ceil(i); return a[lo]+(a[hi]-a[lo])*(i-lo); }
const r1=v=>Math.round(v*10)/10, r2=v=>Math.round(v*100)/100, r3=v=>Math.round(v*1000)/1000;

/* resample a polyline at a fixed arc step; returns [{x,y,s}] including both ends */
function resample(pts, step){
  const out=[]; let acc=0, s=0;
  out.push({x:pts[0][0],y:pts[0][1],s:0});
  for(let i=0;i<pts.length-1;i++){
    const ax=pts[i][0],ay=pts[i][1],bx=pts[i+1][0],by=pts[i+1][1]; const L=Math.hypot(bx-ax,by-ay); if(L<1e-9) continue;
    let t=step-acc;
    while(t<=L){ const u=t/L; out.push({x:ax+(bx-ax)*u,y:ay+(by-ay)*u,s:s+t}); t+=step; }
    acc=(acc+L)%step; s+=L;
  }
  const last=pts[pts.length-1]; if(out[out.length-1].s<s-1e-6) out.push({x:last[0],y:last[1],s});
  return out;
}

/* segment intersections between two layers on a coarse grid: returns angles (deg, 0..90) */
function crossings(pathsA, pathsB, cell){
  const segs=[]; for(const pa of pathsB){ const p=pa.pts; for(let i=0;i<p.length-1;i++) segs.push([p[i][0],p[i][1],p[i+1][0],p[i+1][1]]); }
  const bx=new Map(); const key=(cx,cy)=>cx*100003+cy;
  for(let i=0;i<segs.length;i++){ const s=segs[i]; const x0=Math.floor(Math.min(s[0],s[2])/cell), x1=Math.floor(Math.max(s[0],s[2])/cell), y0=Math.floor(Math.min(s[1],s[3])/cell), y1=Math.floor(Math.max(s[1],s[3])/cell);
    for(let cx=x0;cx<=x1;cx++) for(let cy=y0;cy<=y1;cy++){ const k=key(cx,cy); let b=bx.get(k); if(!b){b=[];bx.set(k,b);} b.push(i); } }
  const angles=[]; let count=0;
  for(const pa of pathsA){ const p=pa.pts; for(let i=0;i<p.length-1;i++){
    const ax=p[i][0],ay=p[i][1],bxx=p[i+1][0],by=p[i+1][1];
    const x0=Math.floor(Math.min(ax,bxx)/cell), x1=Math.floor(Math.max(ax,bxx)/cell), y0=Math.floor(Math.min(ay,by)/cell), y1=Math.floor(Math.max(ay,by)/cell);
    const seen=new Set();
    for(let cx=x0;cx<=x1;cx++) for(let cy=y0;cy<=y1;cy++){ const b=bx.get(key(cx,cy)); if(!b) continue;
      for(const j of b){ if(seen.has(j)) continue; seen.add(j); const s=segs[j];
        const dx1=bxx-ax, dy1=by-ay, dx2=s[2]-s[0], dy2=s[3]-s[1]; const den=dx1*dy2-dy1*dx2; if(Math.abs(den)<1e-12) continue;
        const t=((s[0]-ax)*dy2-(s[1]-ay)*dx2)/den, u=((s[0]-ax)*dy1-(s[1]-ay)*dx1)/den;
        if(t<0||t>1||u<0||u>1) continue;
        const L1=Math.hypot(dx1,dy1), L2=Math.hypot(dx2,dy2); if(L1<1e-9||L2<1e-9) continue;
        let c=Math.abs((dx1*dx2+dy1*dy2)/(L1*L2)); if(c>1)c=1; angles.push(Math.acos(c)*180/Math.PI); count++;
        if(count>200000) return {count,angles};
      } }
  } }
  return {count,angles};
}

/* connected components of a boolean grid (8-neighbour); returns per component the cell count and bbox */
function components(grid,W,H){
  const lab=new Int32Array(W*H); const stack=new Int32Array(W*H); const comps=[]; let nl=0;
  for(let s=0;s<W*H;s++){ if(!grid[s]||lab[s]) continue; nl++; let sp=0; stack[sp++]=s; lab[s]=nl; let n=0,minr=1e9,maxr=-1,minc=1e9,maxc=-1;
    while(sp){ const q=stack[--sp]; const r=Math.floor(q/W), c=q-r*W; n++; if(r<minr)minr=r; if(r>maxr)maxr=r; if(c<minc)minc=c; if(c>maxc)maxc=c;
      for(let dr=-1;dr<=1;dr++){ const rr=r+dr; if(rr<0||rr>=H) continue; for(let dc=-1;dc<=1;dc++){ const cc=c+dc; if(cc<0||cc>=W) continue; const t=rr*W+cc; if(grid[t]&&!lab[t]){ lab[t]=nl; stack[sp++]=t; } } } }
    comps.push({n,extent:Math.hypot(maxr-minr,maxc-minc)}); }
  return comps;
}

function analyse(text, options){
  const o=Object.assign({bead:0.42, allow:0.6, res:0.2, zmerge:0.02, bedz:0.5, step:0.5, lh:null, evidencedBridge:16.2, capRoles:'cap',
    zones:[], zoneNames:null, crossingsEvery:1, maxFindings:400, aboveRisk_mm:1.0, pileLayers:12, tieRadius:1.5, file:'(text)'}, options||{});
  const CAP_ROLES=new Set(String(o.capRoles).split(',').map(s=>s.trim()).filter(Boolean));
  const t0=Date.now();
  const layers=G.parseGcode(text,o);
  const keys=[...layers.keys()].sort((a,b)=>a-b);
  if(!keys.length) return {error:'no extruding moves found', version:VERSION};
  let minx=1e30,miny=1e30,maxx=-1e30,maxy=-1e30;
  for(const k of keys) for(const pa of layers.get(k).paths) for(const p of pa.pts){ if(p[0]<minx)minx=p[0]; if(p[0]>maxx)maxx=p[0]; if(p[1]<miny)miny=p[1]; if(p[1]>maxy)maxy=p[1]; }
  const x0=minx-3, y0=miny-3, res=o.res, W=Math.ceil((maxx+3-x0)/res)+1, H=Math.ceil((maxy+3-y0)/res)+1;
  const raster=(paths)=>{ const g=new Uint8Array(W*H);
    for(const pa of paths){ const p=pa.pts; for(let i=0;i<p.length-1;i++){ const ax=p[i][0],ay=p[i][1],bx=p[i+1][0],by=p[i+1][1];
      const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(res*0.7)));
      for(let t=0;t<=n;t++){ const px=ax+(bx-ax)*t/n, py=ay+(by-ay)*t/n; const c=pyround((px-x0)/res), r=pyround((py-y0)/res); if(r>=0&&r<H&&c>=0&&c<W) g[r*W+c]=1; } } }
    return g; };
  const cellOf=(x,y)=>{ const c=pyround((x-x0)/res), r=pyround((y-y0)/res); return (r>=0&&r<H&&c>=0&&c<W)?r*W+c:-1; };
  const nearMaterial=(g,x,y,radius)=>{ const cr=Math.ceil(radius/res); const c0=pyround((x-x0)/res), r0=pyround((y-y0)/res);
    for(let dr=-cr;dr<=cr;dr++){ const r=r0+dr; if(r<0||r>=H) continue; for(let dc=-cr;dc<=cr;dc++){ const c=c0+dc; if(c<0||c>=W) continue; if(dr*dr+dc*dc>cr*cr) continue; if(g[r*W+c]) return true; } } return false; };
  const supTol=o.bead/2+o.allow, stackTol=Math.max(res*0.75, o.bead/4);
  const PILE=o.pileLayers;   // a pile this deep counts as consolidated (see header)

  const dbg={};
  const per=[];                 // per-layer record
  const findings=[];            // every refusing/declared finding
  const loose=[];               // tips not yet tied: {x,y,z,k,reach,kind,tiedAt:null,over:[]}
  const tipHash=new Map(); const TC=5.0; const tkey=(x,y)=>Math.floor(x/TC)*100003+Math.floor(y/TC);
  const addTip=(t)=>{ loose.push(t); const k=tkey(t.x,t.y); let b=tipHash.get(k); if(!b){b=[];tipHash.set(k,b);} b.push(t); };
  /* prevRaster: all material of the layer below. prevSolid: the part of it that stands on solid material
     (depth 0). prevDepth: per cell, how many layers of loose material lie between that cell and something
     solid (0 = solid, 1 = a hairpin laid in air, 2 = a hairpin on that hairpin, …). A pile of hairpins
     is a cantilever however tall it is; the support gate sees each layer resting on the last and is blind
     to that, and so was every K1 layer of KRAK after the first. */
  let prevRaster=null, prevSolid=null, prevDepth=null, prevDist=null, prevPaths=null, firstRaster=null, firstLen=0, firstZ=null, exempt=0;
  let solidRef=null, solidDist=null;
  let maxZ=0, totalLen=0, totalFree=0;
  let cx=0,cy=0,cn=0;
  /* depth of the material this sample lands on: the depth of the NEAREST material cell below (ties -> the
     smaller depth), not the minimum over the whole support neighbourhood, so solidity does not creep up a
     pile by one neighbourhood radius per layer */
  const depthBelow=(g,x,y,radius)=>{ const cr=Math.ceil(radius/res); const c0=pyround((x-x0)/res), r0=pyround((y-y0)/res); let best=32767, bd=1e9;
    for(let dr=-cr;dr<=cr;dr++){ const r=r0+dr; if(r<0||r>=H) continue; for(let dc=-cr;dc<=cr;dc++){ const c=c0+dc; if(c<0||c>=W) continue; const q=dr*dr+dc*dc; if(q>cr*cr) continue; const v=g[r*W+c]; if(v<0) continue; if(q<bd||(q===bd&&v<best)){ bd=q; best=v; } } } return best; };
  for(let ki=0;ki<keys.length;ki++){
    const lay=layers.get(keys[ki]); const z=lay.z; if(z>maxZ) maxZ=z;
    const startblock=lay.paths.every(p=>p.role==='startblock');
    const rec={k:ki,z:r3(z),len:0,free:0,runs10:0,longest:0,sup:0,solid:0,samples:0,tips:[],selfStack:null,periodTwo:null,cross:null,comps:null,carried:null,onSolid:null,pileMax:0,roles:{}};
    for(const pa of lay.paths){ let L=0; for(let i=0;i<pa.pts.length-1;i++) L+=Math.hypot(pa.pts[i+1][0]-pa.pts[i][0],pa.pts[i+1][1]-pa.pts[i][1]); rec.len+=L; rec.roles[pa.role]=(rec.roles[pa.role]||0)+L; }
    totalLen+=rec.len;
    if(z<=o.bedz||startblock||prevRaster===null){
      const r=raster(lay.paths);
      if(firstRaster===null&&!startblock){ firstRaster=r; firstLen=rec.len; firstZ=z; for(const pa of lay.paths) for(const p of pa.pts){cx+=p[0];cy+=p[1];cn++;} }
      if(prevRaster===null) prevRaster=r.slice(); else for(let i=0;i<prevRaster.length;i++) if(r[i]) prevRaster[i]=1;
      prevSolid=prevRaster.slice(); prevDepth=new Int16Array(W*H).fill(-1); for(let i=0;i<W*H;i++) if(prevRaster[i]) prevDepth[i]=0;
      prevPaths=lay.paths; exempt++; rec.exempt=true; per.push(rec); continue;
    }
    const dist=G.edt(prevRaster,W,H);          // to any material below (support, as S1 sees it)
    let anySolid=false; for(let q=0;q<W*H;q++) if(prevSolid[q]){ anySolid=true; break; }
    /* reach is measured to SOLID material. A layer laid wholly on a pile has no solid under it (RAZMAK's
       terrace layers carry no ring); its tips are then measured to the last solid material below the pile. */
    if(anySolid){ solidRef=prevSolid; solidDist=G.edt(prevSolid,W,H); }
    const distSolid=solidDist||dist;
    const cur=raster(lay.paths);
    /* ties: a loose tip is tied when the NEXT layer or the one after lays material within a bead of it.
       Material laid higher than that over the same XY is not a tie — it is laid in air above a loose tip
       (KRAK: K2 lands 9 mm above K1's tips at the same XY; that is the overflight, not a weld). */
    /* the tie radius is 1.5 mm around the apex: a thread crossing the loop's legs that close to the apex is a
       weld on the tip (OBRTAJ: the next tier's wall lands 0.5–1.3 mm beside the inner tips and the object
       held); at 5 mm and more of clearance the same pass is an overflight whatever its lateral distance */
    for(const t of loose){ if(t.tiedAt===null&&ki-t.k<=2&&nearMaterial(cur,t.x,t.y,o.tieRadius)){ t.tiedAt=ki; t.tiedZ=r3(z); } }
    const supGrid=new Uint8Array(W*H); const curDepth=new Int16Array(W*H).fill(-1);
    let onTop1=0, onTop2=0;
    const paint=(ax,ay,bx,by,depth)=>{ const m=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(res*0.7))); for(let t=0;t<=m;t++){ const cc=cellOf(ax+(bx-ax)*t/m,ay+(by-ay)*t/m); if(cc>=0){ if(curDepth[cc]<0||depth<curDepth[cc]) curDepth[cc]=depth; if(depth===0) supGrid[cc]=1; } } };
    for(const pa of lay.paths){
      if(pa.pts.length<2) continue;
      const S=resample(pa.pts,o.step); const n=S.length; rec.samples+=n;
      const d=new Float64Array(n), ds=new Float64Array(n), sup=new Uint8Array(n), dep=new Int16Array(n);
      for(let i=0;i<n;i++){ const c=cellOf(S[i].x,S[i].y); const v=c>=0?dist[c]*res:1e9; d[i]=v; ds[i]=c>=0?distSolid[c]*res:1e9; sup[i]=v<=supTol?1:0;
        if(sup[i]){ rec.sup++; const db=depthBelow(prevDepth,S[i].x,S[i].y,supTol); dep[i]=(db===0)?0:Math.min(32000,db+1); if(dep[i]>=PILE) dep[i]=0; } else dep[i]=-1;
        if(v<=stackTol) onTop1++;
        if(prevDist){ const pc=c>=0?prevDist[c]*res:1e9; if(pc<=stackTol) onTop2++; } }
      const closed=Math.hypot(pa.pts[0][0]-pa.pts[pa.pts.length-1][0],pa.pts[0][1]-pa.pts[pa.pts.length-1][1])<o.bead;
      const isCap=CAP_ROLES.has(pa.role);
      /* loose = laid in air, or laid on loose material (a pile): both are judged as free thread */
      const lo=new Uint8Array(n); for(let i=0;i<n;i++) lo[i]=(dep[i]!==0)?1:0;
      let i=0;
      while(i<n){
        if(!lo[i]){ i++; continue; }
        let j=i; while(j<n&&lo[j]) j++;
        const a=Math.max(0,i-1), b=Math.min(n-1,j);      // include the solid ends
        const arc=S[b].s-S[a].s; const freeArc=S[Math.min(j,n-1)].s-S[i].s;
        const freeEnd=(i===0||j>=n)&&!closed;
        const chord=Math.hypot(S[b].x-S[a].x,S[b].y-S[a].y);
        const folded=arc>4&&chord<0.5*arc;
        let inAir=true; for(let t=i;t<j;t++) if(sup[t]){ inAir=false; break; }
        /* three kinds of loose run:
           bridge — laid in air between solid ends, not folded, inside the evidenced ceiling: S1's business and itself
                    solid (LIMIT16 printed 8–16 mm spans and held; every woven wall is such V's crossing);
           fabric — a run that is neither folded nor free-ended, touching loose material somewhere
                    (a woven V that crosses a loose leg): depth 0, it is weave, not a pile — letting it inherit depth
                    turned the woven walls of OBRTAJ (printed, held) into piles in the first version of this instrument;
           loose  — folded (a returning hairpin, or a whole comb laid in air) or free-ended (a cantilever):
                    depth ≥ 1, and its point of greatest reach is a tip. A long straight span in air is S1's
                    LONG_BRIDGE, judged against its own ceiling; it is not a pile. */
        const bridge=!freeEnd&&inAir&&!folded&&freeArc<=o.evidencedBridge;
        if(bridge){ for(let t=i;t<j;t++) dep[t]=0; i=j; continue; }
        const looseKind=folded||freeEnd;   // a long straight span in air is S1's LONG_BRIDGE, judged by its own ceiling; it is not a pile
        if(!looseKind){ for(let t=i;t<j;t++) dep[t]=0; i=j; continue; }
        for(let t=i;t<j;t++) if(dep[t]<0) dep[t]=1;
        let pm=0; for(let t=i;t<j;t++) if(dep[t]>pm) pm=dep[t]; if(pm>rec.pileMax) rec.pileMax=pm;
        if(!isCap){ rec.free+=freeArc; if(freeArc>10) rec.runs10++; if(freeArc>rec.longest) rec.longest=freeArc; }
        /* the tip of the run: its point of greatest reach to solid material (one per loose run — a hairpin's apex, a
           cantilever's end). A comb laid wholly in air with no ring in the layer (RAZMAK's terrace layers) is one run
           and registers one tip per layer after the first; its first layer, split by the ring below, carries the
           per-tooth statistics that refuse it. Known limit of this instrument, recorded in docs/GATE_LAYERS. */
        let im=i, dm=0; for(let t=i;t<j;t++) if(ds[t]>dm){dm=ds[t];im=t;}
        if(dm>=2.0) rec.tips.push({x:S[im].x,y:S[im].y,z:r3(z),k:ki,reach:r2(dm),kind:freeEnd?'cantilever':'hairpin',arc:r1(freeArc),pile:pm,tiedAt:null,tiedZ:null,over:[]});
        i=j;
      }
      if(o.debugLayer===ki){ const runs=[]; let q=0; while(q<n){ if(dep[q]===0){q++;continue;} let e=q; while(e<n&&dep[e]!==0) e++; runs.push([q,e]); q=e; } const prof=[]; for(let t=0;t<n;t+=Math.max(1,Math.floor(n/400))) prof.push(+ds[t].toFixed(1)); (dbg.layers=dbg.layers||[]).push({path:pa.role,n,runs:runs.length,runSpans:runs.slice(0,6),closedPath:closed,tips:rec.tips.length,prof}); }
      for(let q=0;q<n;q++) if(dep[q]===0) rec.solid++;
      for(let q=0;q<n-1;q++){ const mx=(S[q].x+S[q+1].x)/2, my=(S[q].y+S[q+1].y)/2; paint(S[q].x,S[q].y,mx,my,dep[q]); paint(mx,my,S[q+1].x,S[q+1].y,dep[q+1]); }   // each half-segment carries its own sample's depth: no erosion or creep of the solid zone
      /* S4 · overflight: this layer's extrusion over a tip laid ≥ 2 layers below that is still loose */
      for(let q=0;q<n;q++){ const sx=S[q].x, sy=S[q].y; const gx=Math.floor(sx/TC), gy=Math.floor(sy/TC);
        for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){ const bkt=tipHash.get((gx+dx)*100003+(gy+dy)); if(!bkt) continue;
          for(const t of bkt){ if(t.k>=ki-1) continue; if(t.tiedAt!==null&&t.tiedAt<=ki) continue; /* the layer that lands on a tip ties it: that is the weld, not a collision */ const h=z-t.z; const rr=Math.hypot(sx-t.x,sy-t.y); if(rr<=headRadius(h)){ const last=t.over[t.over.length-1]; if(!last||last.k!==ki) t.over.push({k:ki,z:r3(z),clearance:r2(h),r:r2(rr)}); else if(rr<last.r) last.r=r2(rr); } } } }
    }
    for(const t of rec.tips) addTip(t);
    totalFree+=rec.free;
    rec.selfStack=rec.samples?r3(onTop1/rec.samples):0; rec.periodTwo=(prevDist&&rec.samples)?r3(onTop2/rec.samples):null;
    rec.carried=rec.samples?r3(rec.sup/rec.samples):0; rec.onSolid=rec.samples?r3(rec.solid/rec.samples):0;
    /* S7 · what the layer stands on: components of its SOLID material */
    { const cs=components(supGrid,W,H).sort((a,b)=>b.n-a.n); rec.comps={solid:cs.length,largestExtent_mm:cs.length?r1(cs[0].extent*res):0}; }
    /* S8 · crossing angles with the layer below */
    if(prevPaths&&(ki%o.crossingsEvery===0)){ const c=crossings(lay.paths,prevPaths,2.0); rec.cross={count:c.count,median:c.angles.length?r1(pct(c.angles,50)):null,p10:c.angles.length?r1(pct(c.angles,10)):null,below10:c.angles.filter(a=>a<10).length}; }
    per.push(rec);
    const solid=new Uint8Array(W*H); for(let q=0;q<W*H;q++) if(curDepth[q]===0) solid[q]=1;
    prevDist=dist; prevRaster=cur; prevSolid=solid; prevDepth=curDepth; prevPaths=lay.paths;
  }
  const nLayers=per.length;

  /* ---------------- verdicts ---------------- */
  const zones=(o.zones||[]).map(zn=>({name:zn.name,z0:+zn.z0-0.01,z1:+zn.z1+0.01,declares:new Set(zn.declares||['S2','S3','S4','S7'])}));
  const inZone=(z,layerId)=>{ for(const zn of zones) if(z>=zn.z0&&z<=zn.z1&&zn.declares.has(layerId)) return zn.name; return null; };
  const note=(layerId,rec,why,extra)=>{ const zone=inZone(rec.z,layerId); findings.push(Object.assign({layer:layerId,k:rec.k,z:rec.z,why,declared:zone||null},extra||{})); return zone; };
  const result={S2:{},S3:{},S4:{},S5:{},S7:{},S8:{}};

  /* S2 */ { let refusing=0, declared=0, worst=null;
    for(const r of per){ if(r.exempt) continue; if(r.runs10>LIMITS.S2.runs10PerLayer.hold){ refusing++; }
      if(!worst||r.runs10>worst.runs10) worst={k:r.k,z:r.z,runs10:r.runs10,free_mm:r1(r.free),longest_mm:r1(r.longest)}; }
    result.S2={question:'how much thread hangs', verdict:'INFO', refusing:0, declared:0, overHold:refusing+declared, worst, free_m:r2(totalFree/1000), thread_m:r2(totalLen/1000), free_pct:r1(100*totalFree/Math.max(1,totalLen)), limit:LIMITS.S2.runs10PerLayer}; }

  /* S3 */ { let refusing=0, declared=0; const rows=[]; let untied=0, tipsAll=0;
    for(const r of per){ if(r.exempt) continue; const reach=r.tips.map(t=>t.reach); if(!reach.length) continue; tipsAll+=reach.length;
      const long=reach.filter(v=>v>LIMITS.S3.longTip); if(!long.length) continue;
      const st={k:r.k,z:r.z,tips:reach.length,min:r1(Math.min(...reach)),median:r1(pct(reach,50)),p90:r1(pct(reach,90)),max:r1(Math.max(...reach))};
      const bad=[]; if(st.median>LIMITS.S3.median.hold) bad.push(`median ${st.median} > ${LIMITS.S3.median.hold} held`);
      st.notes=[]; if(st.max>LIMITS.S3.max.hold) st.notes.push(`max ${st.max} > ${LIMITS.S3.max.hold} held (reported)`); if(st.min>LIMITS.S3.min.hold) st.notes.push(`min ${st.min} > ${LIMITS.S3.min.hold} held: no short tip among the long ones (reported)`);
      st.color=bad.length?(st.median>=LIMITS.S3.median.fail?'RED':'UNKNOWN'):'GREEN';
      if(bad.length){ const zn=note('S3',r,`free reach of ${reach.length} tips: `+bad.join('; '),st); if(zn) declared++; else refusing++; }
      rows.push(st); }
    for(const t of loose) if(t.tiedAt===null) untied++;
    result.S3={question:'how far a free tip reaches, and whether it is ever tied', verdict:refusing?'FAIL':(declared?'DECLARED':(untied?'WARN':'PASS')), neverTiedNote:untied?`${untied} tips are never tied by anything laid later (OBRTAJ: 0; KRAK: 279)`:null, refusing, declared, layersWithLongTips:rows.length, tips:tipsAll, neverTied:untied, worst:rows.slice().sort((a,b)=>b.median-a.median)[0]||null, limits:{median:LIMITS.S3.median,max:LIMITS.S3.max,min:LIMITS.S3.min,longTip_mm:LIMITS.S3.longTip}}; }

  /* S4 */ { let refusing=0, declared=0; const evs=[];
    for(const t of loose){ for(const ov of t.over){ if(ov.clearance<=LIMITS.S4.refuseBelow){ const rec=per[ov.k]; const zn=note('S4',rec,`extrusion passes ${ov.r} mm from a loose ${t.kind} tip laid ${ov.clearance} mm below (tip z ${t.z}, reach ${t.reach}; evidence: 5.04 mm destroyed KRAK; ≤ ${LIMITS.S4.refuseBelow} refused, assumed margin)`,{tip:{x:r2(t.x),y:r2(t.y),z:t.z,reach:t.reach,tied:t.tiedAt!==null},clearance:ov.clearance,r:ov.r}); if(zn) declared++; else refusing++; evs.push({tipZ:t.z,overZ:ov.z,clearance:ov.clearance,r:ov.r}); } } }
    evs.sort((a,b)=>a.clearance-b.clearance);
    result.S4={question:'does extrusion pass over a tip that is still loose', verdict:refusing?'FAIL':(declared?'DECLARED':'PASS'), refusing, declared, overflights:evs.length, closest:evs[0]||null, head:HEAD, limit:LIMITS.S4.clearance, refuseBelow_mm:LIMITS.S4.refuseBelow}; }

  /* S5 */ { let outreach=0; if(cn){ cx/=cn; cy/=cn; for(const k of keys) for(const pa of layers.get(k).paths) for(const p of pa.pts){ const d=Math.hypot(p[0]-cx,p[1]-cy); if(d>outreach) outreach=d; } }
    let footR=0; if(firstRaster){ for(let i=0;i<firstRaster.length;i++) if(firstRaster[i]){ const r=Math.floor(i/W), c=i-r*W; const d=Math.hypot(x0+c*res-cx,y0+r*res-cy); if(d>footR) footR=d; } }
    const contact=firstLen*(o.firstLayerBead||o.bead*1.15); const lever=Math.max(1,outreach-footR); const ratio=contact/Math.max(1,(maxZ-(firstZ||0))*lever);
    const fail=o.S5fail!=null?+o.S5fail:null; const verdict=(fail!=null&&ratio<=fail)?'FAIL':'INFO';
    if(verdict==='FAIL') note('S5',per[0],`first-layer contact ${r1(contact)} mm² against ${r1(maxZ)} mm height and ${r1(lever)} mm lever: ratio ${r3(ratio)} ≤ ${fail} (a printed failure)`,{ratio:r3(ratio)});
    result.S5={question:'what holds the object against what is built above it', verdict, contact_mm2:r1(contact), firstLayer_mm:r1(firstLen), height_mm:r1(maxZ), footprintRadius_mm:r1(footR), outreach_mm:r1(outreach), lever_mm:r1(lever), ratio:r3(ratio), failAtOrBelow:fail, limit:LIMITS.S5.ratio}; }

  /* S7 */ { let refusing=0, declared=0; const rows=[]; const th=o.S7carried!=null?+o.S7carried:null;
    for(const r of per){ if(r.exempt) continue; const above=nLayers-1-r.k; if(above<LIMITS.S7.minAbove) continue;
      rows.push({k:r.k,z:r.z,carried:r.carried,onSolid:r.onSolid,pileMax:r.pileMax,solidComponents:r.comps.solid,largestSolidExtent_mm:r.comps.largestExtent_mm,above});
      if(th!=null&&r.carried<=th){ const zn=note('S7',r,`only ${Math.round(100*r.carried)}% of this layer lands on material and ${above} layers stand on it (evidence: KRAK A2L sheared at such a joint)`,{carried:r.carried,onSolid:r.onSolid,solidComponents:r.comps.solid}); if(zn) declared++; else refusing++; } }
    rows.sort((a,b)=>a.carried-b.carried);
    result.S7={question:'is a layer that carries the object laid on points', verdict:th==null?'INFO':(refusing?'FAIL':(declared?'DECLARED':'PASS')), refusing, declared, weakest:rows.slice(0,5), failAtOrBelow:th, limit:LIMITS.S7.carried}; }

  /* S8 */ { let refusing=0; let p2=0; const angles=[]; let low=0, cnt=0; let worst=null;
    for(const r of per){ if(r.exempt) continue; if(r.selfStack>=0.98) refusing++;
      if(r.periodTwo!=null&&r.periodTwo>=0.9) p2++;
      if(r.cross){ cnt+=r.cross.count; low+=r.cross.below10; if(r.cross.median!=null) angles.push(r.cross.median); }
      if(!worst||r.selfStack>worst.selfStack) worst={k:r.k,z:r.z,selfStack:r.selfStack}; }
    result.S8={question:'does every layer cross the one below', verdict:(refusing||p2)?'WARN':'PASS', refusing:0, selfStackedLayers:refusing, periodTwoLayers:p2, crossings:cnt, crossingsBelow10deg:low, medianOfLayerMedians_deg:angles.length?r1(pct(angles,50)):null, worst, limit:LIMITS.S8.selfStack, note:LIMITS.S8.periodTwo.note}; }

  /* ORDER · a declared risk band must be the last thing printed. KRAK (2026-09-24) put its riskiest
     terrace at the bottom; when it tangled it took every layer above it, including the bands that
     might have held, and four of six predictions were never tested. So a zone that absorbed findings
     may have nothing undeclared above it except a closing pass of at most aboveRisk_mm. */
  const absorbed=new Set(findings.filter(f=>f.declared).map(f=>f.declared));
  let order={verdict:absorbed.size?'PASS':'N/A', aboveRisk_mm:o.aboveRisk_mm, zonesWithFindings:[...absorbed]};
  for(const zn of zones){ if(!absorbed.has(zn.name)) continue;
    const above=per.filter(r=>!r.exempt&&r.z>zn.z1+o.aboveRisk_mm&&!zones.some(z2=>r.z>=z2.z0&&r.z<=z2.z1));
    if(above.length){ order={verdict:'FAIL', aboveRisk_mm:o.aboveRisk_mm, zone:zn.name, undeclaredLayersAbove:above.length, fromZ:above[0].z, toZ:above[above.length-1].z,
      why:`${above.length} undeclared layers (z ${above[0].z}–${above[above.length-1].z}) stand on the declared risk band "${zn.name}"; the object could not die from the top (KRAK, 2026-09-24)`}; findings.push({layer:'ORDER',k:above[0].k,z:above[0].z,why:order.why,declared:null}); break; } }
  result.ORDER=order;
  const ids=['S2','S3','S4','S5','S7','S8','ORDER'];
  const vector=ids.map(id=>`${id} ${result[id].verdict}`).join(' · ');
  const refusedBy=ids.filter(id=>result[id].verdict==='FAIL');
  return { version:VERSION, file:o.file, params:{bead:o.bead,allow:o.allow,res:o.res,step:o.step,zones:zones.map(z=>({name:z.name,z0:r2(z.z0),z1:r2(z.z1),declares:[...z.declares]}))},
    layersChecked:nLayers-exempt, exempt, thread_m:r2(totalLen/1000), maxZ:r2(maxZ), ms:Date.now()-t0,
    vector, refuse:refusedBy.length>0, refusedBy, layers:result,
    _tips:o.debugTips?loose:undefined, _debug:o.debugLayer!=null?dbg:undefined,
    findings:[...findings.filter(f=>!f.declared),...findings.filter(f=>f.declared)].slice(0,o.maxFindings), finding_count:findings.length, undeclared_count:findings.filter(f=>!f.declared).length,
    perLayer:o.perLayer?per.map(r=>({k:r.k,z:r.z,len_mm:r1(r.len),free_mm:r1(r.free),runs10:r.runs10,longest_mm:r1(r.longest),carried:r.carried,onSolid:r.onSolid,pileMax:r.pileMax,selfStack:r.selfStack,periodTwo:r.periodTwo,tips:r.tips.length,cross:r.cross,comps:r.comps,roles:Object.fromEntries(Object.entries(r.roles).map(([a,b])=>[a,r1(b)]))})):undefined };
}

root.WEFT_GATE_LAYERS={analyse,LIMITS,HEAD,headRadius,version:VERSION};
})(typeof globalThis!=='undefined'?globalThis:this);
