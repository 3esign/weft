/* ============================================================
   WEFT gate — JavaScript port of check_gcode.py (2026-09-08).

   The gate reads the FINAL G-code and refuses: nothing that is emitted may be laid where nothing
   supports it. Per layer k: rasterise layer k-1's extruded centrelines, take the exact Euclidean
   distance transform, and classify every extruding point of layer k as supported (within
   bead/2 + allow of material below), part of a bridge (unsupported run with supported ends,
   arc length <= maxbridge), LONG_BRIDGE, CANTILEVER (a run touching a free end, over
   maxcantilever), or FLOATING (a whole path over air). A path emitted as a CAP is judged by the
   rule that makes a filled spiral self-supporting: at least `minanchor` of its OUTERMOST turn must
   land on material, and its turns must be no more than a bead apart. The first layer must be one
   connected piece when `maxislands` is 1.

   This port exists so the veto runs where the thread is made: in Node without Python/scipy, and
   in the browser inside index.html. It reproduces check_gcode.py to the number — the same grid,
   the same rounding (Python's round-half-to-even, not Math.round), the same classification and
   the same report shape — and tests/gate_parity.test.mjs holds it to that on the regression
   fixture and on a printed specimen. The Python file remains the reference; if the two ever
   disagree, the disagreement is a bug in one of them, never a feature.

   Classic script: no import/export. Registers globalThis.WEFT_GATE = { checkGcode, parseGcode }.
   ============================================================ */
(function(root){
'use strict';
const WEFT_GATE_VERSION='gate-2026-09-08';

/* Python's round(): half to even. The raster puts a point on a cell by rounding (p-x0)/res, and a
   coordinate that lands exactly on a half cell goes DOWN in Python when the integer part is even.
   Math.round would put it one cell over, and a one-cell difference is a whole bead at res 0.2. */
function pyround(v){ const f=Math.floor(v), d=v-f; if(d<0.5) return f; if(d>0.5) return f+1; return (f%2===0)?f:f+1; }

const NUM=/([XYZEF])(-?\d*\.?\d+)/g;
const LAB=/^;\s*layer\s+(\d+)\s+(\S+)/;

function parseGcode(text, opt){
  const zmerge=opt.zmerge, slicerTypes=!!opt.slicerTypes;
  let x=0,y=0,z=0, cur=null, role='?', seenLayer=false, lineNo=0;
  const layers=new Map();   // key -> {z, paths:[{key,z,pts,line,role,end}]}
  const lines=text.split('\n');
  for(let li=0; li<lines.length; li++){
    lineNo++;
    const s=lines[li].trim();
    if(!s) continue;
    if(s[0]===';'){
      const m=LAB.exec(s);
      if(m){ role=m[2]; seenLayer=true; }
      else if(slicerTypes && s.slice(1).trimStart().toUpperCase().startsWith('TYPE:')){
        role=s.split(':').slice(1).join(':').trim()||'?'; seenLayer=true; }
      continue;
    }
    if(!(s.startsWith('G0')||s.startsWith('G1'))) continue;
    const d={}; const body=s.split(';')[0]; NUM.lastIndex=0; let mm;
    while((mm=NUM.exec(body))) d[mm[1]]=parseFloat(mm[2]);
    const nx=('X' in d)?d.X:x, ny=('Y' in d)?d.Y:y, nz=('Z' in d)?d.Z:z, e=('E' in d)?d.E:0;
    const moved=Math.abs(nx-x)>1e-9||Math.abs(ny-y)>1e-9;
    if(e>0&&moved){
      const key=pyround(nz/Math.max(zmerge,1e-6));
      if(cur===null||cur.key!==key||cur.endx!==x||cur.endy!==y){
        cur={key,z:nz,pts:[[x,y]],line:lineNo,role:seenLayer?role:'startblock',endx:x,endy:y};
        if(!layers.has(key)) layers.set(key,{z:nz,paths:[]});
        layers.get(key).paths.push(cur);
      }
      cur.pts.push([nx,ny]); cur.endx=nx; cur.endy=ny;
    } else cur=null;
    x=nx; y=ny; z=nz;
  }
  return layers;
}

/* exact Euclidean distance transform (Felzenszwalb & Huttenlocher), squared, on a boolean grid:
   distance from every cell to the nearest TRUE cell. Matches scipy.ndimage.distance_transform_edt(~g). */
function edt(grid,W,H){
  const INF=1e20;
  const f=new Float64Array(W*H);
  for(let i=0;i<W*H;i++) f[i]=grid[i]?0:INF;
  const out=new Float64Array(W*H);
  const n=Math.max(W,H);
  const v=new Int32Array(n), zz=new Float64Array(n+1), fl=new Float64Array(n), dl=new Float64Array(n);
  const dt1=(len)=>{  // 1-D on fl[0..len) -> dl
    let k=0; v[0]=0; zz[0]=-INF; zz[1]=INF;
    for(let q=1;q<len;q++){
      let s=((fl[q]+q*q)-(fl[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
      while(s<=zz[k]){ k--; s=((fl[q]+q*q)-(fl[v[k]]+v[k]*v[k]))/(2*q-2*v[k]); }
      k++; v[k]=q; zz[k]=s; zz[k+1]=INF;
    }
    k=0;
    for(let q=0;q<len;q++){ while(zz[k+1]<q) k++; const dq=q-v[k]; dl[q]=dq*dq+fl[v[k]]; }
  };
  // columns first (along rows index r), then rows
  for(let c=0;c<W;c++){ for(let r=0;r<H;r++) fl[r]=f[r*W+c]; dt1(H); for(let r=0;r<H;r++) out[r*W+c]=dl[r]; }
  for(let r=0;r<H;r++){ for(let c=0;c<W;c++) fl[c]=out[r*W+c]; dt1(W); for(let c=0;c<W;c++) out[r*W+c]=dl[c]; }
  for(let i=0;i<W*H;i++) out[i]=Math.sqrt(out[i]);
  return out;
}

function percentile(arr,p){ // numpy default: linear interpolation
  const a=Array.from(arr).sort((u,v)=>u-v), n=a.length; if(!n) return NaN;
  const idx=(n-1)*p/100, lo=Math.floor(idx), hi=Math.ceil(idx), fr=idx-lo;
  return a[lo]+(a[hi]-a[lo])*fr;
}
const r2=(v)=>Math.round(v*100)/100, r3=(v)=>Math.round(v*1000)/1000, r1=(v)=>Math.round(v*10)/10;
/* Python round(x, n) is also half-to-even on the scaled value; the report values are rounded for
   display, and the tolerance in the parity test absorbs the last digit. */
function pyround_n(v,n){ const m=Math.pow(10,n); return pyround(v*m)/m; }

function checkGcode(text, options){
  const o=Object.assign({bead:0.42, allow:0.6, maxbridge:12.0, res:0.2, zmerge:0.02, bedz:0.5, maxislands:0,
    maxReport:25, capRoles:'cap', slicerTypes:false, maxCapRadius:36.0, minanchor:0.5, maxcantilever:3.0,
    file:'(text)'}, options||{});
  const layers=parseGcode(text,o);
  const keys=[...layers.keys()].sort((a,b)=>a-b);
  if(!keys.length) return {error:'no extruding moves found', PASS:false, exit:2};
  let minx=1e30,miny=1e30,maxx=-1e30,maxy=-1e30;
  for(const k of keys) for(const pa of layers.get(k).paths) for(const p of pa.pts){
    if(p[0]<minx)minx=p[0]; if(p[0]>maxx)maxx=p[0]; if(p[1]<miny)miny=p[1]; if(p[1]>maxy)maxy=p[1]; }
  const x0=minx-3, y0=miny-3, x1=maxx+3, y1=maxy+3, res=o.res;
  const W=Math.ceil((x1-x0)/res)+1, H=Math.ceil((y1-y0)/res)+1;
  const raster=(paths)=>{ const g=new Uint8Array(W*H);
    for(const pa of paths){ const p=pa.pts;
      for(let i=0;i<p.length-1;i++){ const ax=p[i][0],ay=p[i][1],bx=p[i+1][0],by=p[i+1][1];
        const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(res*0.7)));
        for(let t=0;t<=n;t++){ const px=ax+(bx-ax)*t/n, py=ay+(by-ay)*t/n;
          const c=pyround((px-x0)/res), r=pyround((py-y0)/res);
          if(r>=0&&r<H&&c>=0&&c<W) g[r*W+c]=1; } } }
    return g; };
  const sample=(dist,pts)=>{ const out=new Float64Array(pts.length);
    for(let i=0;i<pts.length;i++){ const c=pyround((pts[i][0]-x0)/res), r=pyround((pts[i][1]-y0)/res);
      out[i]=(r>=0&&r<H&&c>=0&&c<W)?dist[r*W+c]*res:1e9; } return out; };
  const CAP_ROLES=new Set(String(o.capRoles).split(',').map(s=>s.trim()).filter(Boolean));

  function spiralMetrics(pts){
    let p=pts.map(q=>[q[0],q[1]]);
    if(p.length<8) return [0.0,0.0];
    let dmax=0; for(let i=0;i<p.length-1;i++) dmax=Math.max(dmax,Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]));
    if(dmax>0.1){ const dense=[p[0]];
      for(let i=0;i<p.length-1;i++){ const d0=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]); const n=Math.max(1,Math.ceil(d0/0.1));
        for(let j=1;j<=n;j++) dense.push([p[i][0]+(p[i+1][0]-p[i][0])*(j/n), p[i][1]+(p[i+1][1]-p[i][1])*(j/n)]); }
      p=dense; }
    let cx=0,cy=0; for(const q of p){cx+=q[0];cy+=q[1];} cx/=p.length; cy/=p.length;
    let rad=0; for(const q of p) rad=Math.max(rad,Math.hypot(q[0]-cx,q[1]-cy));
    const kept=p.filter(q=>Math.hypot(q[0]-cx,q[1]-cy)>1.2);
    if(kept.length>=8) p=kept;
    const n=p.length; const seg=new Float64Array(n);
    for(let i=1;i<n;i++) seg[i]=seg[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
    const skip=3.0*o.bead;
    // grid hash for nearest-with-constraint queries
    const cell=Math.max(0.05,o.bead), bx0=Math.min(...p.map(q=>q[0]))-1, by0=Math.min(...p.map(q=>q[1]))-1;
    const gx=(q)=>Math.floor((q[0]-bx0)/cell), gy=(q)=>Math.floor((q[1]-by0)/cell);
    const buckets=new Map();
    for(let i=0;i<n;i++){ const k=gx(p[i])+'_'+gy(p[i]); let b=buckets.get(k); if(!b){b=[];buckets.set(k,b);} b.push(i); }
    let worst=0;
    for(let i=0;i<n;i++){
      const cxg=gx(p[i]), cyg=gy(p[i]); let best=Infinity;
      for(let ring=0; ring<400; ring++){
        if(best<=(ring-1)*cell) break;   // every unexamined point is >= (ring-1)*cell away: nothing closer remains
        for(let dx=-ring;dx<=ring;dx++) for(let dy=-ring;dy<=ring;dy++){
          if(Math.max(Math.abs(dx),Math.abs(dy))!==ring) continue;
          const b=buckets.get((cxg+dx)+'_'+(cyg+dy)); if(!b) continue;
          for(const j of b){ if(Math.abs(seg[j]-seg[i])>skip){ const d=Math.hypot(p[j][0]-p[i][0],p[j][1]-p[i][1]); if(d<best) best=d; } }
        }
      }
      if(best<Infinity) worst=Math.max(worst,best);
    }
    return [worst,rad];
  }
  function outermostTurn(P,rr){
    const n=P.length; const mask=new Uint8Array(n);
    if(n<12){ mask.fill(1); return mask; }
    const close=1.5*o.bead;
    const loopFrom=(head)=>{ const p0=head?P[0]:P[n-1]; let walked=0, prev=p0;
      if(head){ for(let i=1;i<n;i++){ walked+=Math.hypot(P[i][0]-prev[0],P[i][1]-prev[1]); prev=P[i];
          if(walked>3.0*close&&Math.hypot(P[i][0]-p0[0],P[i][1]-p0[1])<close) return [0,i+1]; } }
      else { for(let i=n-2;i>=0;i--){ walked+=Math.hypot(P[i][0]-prev[0],P[i][1]-prev[1]); prev=P[i];
          if(walked>3.0*close&&Math.hypot(P[i][0]-p0[0],P[i][1]-p0[1])<close) return [i,n]; } }
      return null; };
    const a=loopFrom(true), b=loopFrom(false); const cands=[a,b].filter(Boolean);
    if(!cands.length){ let mx=0; for(const v of rr) mx=Math.max(mx,v); const th=Math.max(0,mx-2.0*o.bead); for(let i=0;i<n;i++) mask[i]=rr[i]>=th?1:0; return mask; }
    let best=null,bm=-1; for(const sl of cands){ let s=0; for(let i=sl[0];i<sl[1];i++) s+=rr[i]; const m=s/(sl[1]-sl[0]); if(m>bm){bm=m;best=sl;} }
    for(let i=best[0];i<best[1];i++) mask[i]=1; return mask;
  }

  const problems=[], membranes=[];
  const stats={floating:0,long_bridge:0,cantilever:0,bridges:0,bad_membrane:0,unanchored_membrane:0,
    checked_paths:0,checked_points:0,exempt_layers:0,first_layer_islands:0};
  const byRole={}; const gaps=[];
  let prev=null, firstRaster=null;
  for(let ki=0;ki<keys.length;ki++){
    const lay=layers.get(keys[ki]);
    const startblock=lay.paths.every(p=>p.role==='startblock');
    if(lay.z<=o.bedz||startblock||prev===null){
      const r=raster(lay.paths);
      if(firstRaster===null&&!startblock) firstRaster=r;
      if(prev===null) prev=r.slice(); else { for(let i=0;i<prev.length;i++) if(r[i]) prev[i]=1; }   // copy: firstRaster must stay the layer's own raster
      stats.exempt_layers++; continue;
    }
    const dist=edt(prev,W,H);
    for(const pa of lay.paths){
      const pts=pa.pts; stats.checked_paths++; stats.checked_points+=pts.length;
      const d=sample(dist,pts);
      let dmax=0; for(const v of d) dmax=Math.max(dmax,v);
      gaps.push([pyround_n(lay.z,2),pa.role,percentile(d,99),dmax]);
      const sup=new Uint8Array(pts.length); let anySup=false; for(let i=0;i<pts.length;i++){ sup[i]=d[i]<=(o.bead/2+o.allow)?1:0; if(sup[i]) anySup=true; }
      if(CAP_ROLES.has(pa.role)){
        const [turn,rad]=spiralMetrics(pts);
        let cx=0,cy=0; for(const q of pts){cx+=q[0];cy+=q[1];} cx/=pts.length; cy/=pts.length;
        const rr=pts.map(q=>Math.hypot(q[0]-cx,q[1]-cy));
        const outer=outermostTurn(pts,rr);
        let no=0,ns=0,og=Infinity; for(let i=0;i<pts.length;i++) if(outer[i]){ no++; if(sup[i]) ns++; if(d[i]<og) og=d[i]; }
        const frac=no?ns/no:0.0; const outerGap=no?og:Infinity;
        membranes.push({z:pyround_n(lay.z,3),line:pa.line,at:[pyround_n(cx,2),pyround_n(cy,2)],radius_mm:pyround_n(rad,2),
          anchoredFrac:pyround_n(frac,3),outerTurnGap_mm:(outerGap===Infinity?null:pyround_n(outerGap,2)),turnGap_mm:pyround_n(turn,2),points:pts.length});
        const bad=[]; let kind='BAD_MEMBRANE';
        if(!anySup){ bad.push('no point of the membrane lands on the material below'); kind='FLOATING'; }
        else if(frac<o.minanchor){ bad.push(`only ${Math.round(100*frac)}% of the outermost turn lands on the material below, nearest ${outerGap.toFixed(1)} mm (needs ${Math.round(100*o.minanchor)}%)`); kind='UNANCHORED_MEMBRANE'; }
        if(rad>3.0*o.bead&&turn>o.bead*1.15) bad.push(`turns ${turn.toFixed(2)} mm apart, over the ${o.bead.toFixed(2)} mm bead`);
        if(rad>o.maxCapRadius) bad.push(`membrane radius ${rad.toFixed(1)} mm over the ${Math.round(o.maxCapRadius)} mm bound`);
        if(bad.length){
          problems.push({kind,role:pa.role,z:pyround_n(lay.z,3),line:pa.line,why:bad.join('; '),anchoredFrac:pyround_n(frac,3),
            outerTurnGap_mm:(outerGap===Infinity?null:pyround_n(outerGap,2)),turnGap_mm:pyround_n(turn,2),radius_mm:pyround_n(rad,1),
            at:[pyround_n(cx,2),pyround_n(cy,2)]});
          const key={FLOATING:'floating',UNANCHORED_MEMBRANE:'unanchored_membrane'}[kind]||'bad_membrane';
          stats[key]++;
          if(!byRole[pa.role]) byRole[pa.role]={floating:0,long_bridge:0,cantilever:0,bad_membrane:0,unanchored_membrane:0,worst_mm:0.0};
          byRole[pa.role][key]=(byRole[pa.role][key]||0)+1;
        }
        continue;
      }
      const closed=Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<o.bead;
      const note=(kind,rec)=>{ problems.push(rec); stats[kind]++;
        if(!byRole[pa.role]) byRole[pa.role]={floating:0,long_bridge:0,cantilever:0,worst_mm:0.0};
        const b=byRole[pa.role]; b[kind]=(b[kind]||0)+1; b.worst_mm=Math.max(b.worst_mm,rec.length_mm||0.0); };
      if(!anySup){
        let span=0; for(let i=0;i<pts.length-1;i++) span+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
        let dmin=Infinity; for(const v of d) dmin=Math.min(dmin,v);
        note('floating',{kind:'FLOATING',role:pa.role,z:pyround_n(lay.z,3),line:pa.line,points:pts.length,length_mm:pyround_n(span,2),
          worst_gap_mm:pyround_n(dmin,2),at:[pyround_n(pts[0][0],2),pyround_n(pts[0][1],2)]});
        continue;
      }
      let i=0; const n=pts.length;
      while(i<n){
        if(sup[i]){ i++; continue; }
        let j=i; while(j<n&&!sup[j]) j++;
        let span=0; for(let t=i;t<Math.min(j,n-1);t++) span+=Math.hypot(pts[t+1][0]-pts[t][0],pts[t+1][1]-pts[t][1]);
        const freeEnd=(i===0||j>=n)&&!closed;
        let wst=0; for(let t=i;t<j;t++) wst=Math.max(wst,d[t]); const worst=pyround_n(wst,2);
        if(freeEnd){
          if(span>o.maxcantilever) note('cantilever',{kind:'CANTILEVER',role:pa.role,z:pyround_n(lay.z,3),line:pa.line,length_mm:pyround_n(span,2),
            worst_gap_mm:worst,at:[pyround_n(pts[i][0],2),pyround_n(pts[i][1],2)]});
        } else if(span>o.maxbridge){
          note('long_bridge',{kind:'LONG_BRIDGE',role:pa.role,z:pyround_n(lay.z,3),line:pa.line,length_mm:pyround_n(span,2),limit_mm:o.maxbridge,
            worst_gap_mm:worst,at:[pyround_n(pts[i][0],2),pyround_n(pts[i][1],2)]});
        } else stats.bridges++;
        i=j;
      }
    }
    prev=raster(lay.paths);
  }
  // first layer connectedness
  let islands=0;
  if(firstRaster!==null){
    const grow=Math.max(1,pyround((o.bead/2)/res));
    let solid=firstRaster;
    for(let it=0;it<grow;it++){ const nxt=new Uint8Array(W*H);
      for(let r=0;r<H;r++) for(let c=0;c<W;c++){ if(!solid[r*W+c]) continue;
        for(let dr=-1;dr<=1;dr++){ const rr=r+dr; if(rr<0||rr>=H) continue; for(let dc=-1;dc<=1;dc++){ const cc=c+dc; if(cc<0||cc>=W) continue; nxt[rr*W+cc]=1; } } }
      solid=nxt; }
    const lab=new Int32Array(W*H); const stack=new Int32Array(W*H); let nl=0;
    for(let s=0;s<W*H;s++){ if(!solid[s]||lab[s]) continue; nl++; let sp=0; stack[sp++]=s; lab[s]=nl;
      while(sp){ const q=stack[--sp]; const r=Math.floor(q/W), c=q-r*W;
        for(let dr=-1;dr<=1;dr++){ const rr=r+dr; if(rr<0||rr>=H) continue; for(let dc=-1;dc<=1;dc++){ const cc=c+dc; if(cc<0||cc>=W) continue;
          const t=rr*W+cc; if(solid[t]&&!lab[t]){ lab[t]=nl; stack[sp++]=t; } } } } }
    islands=nl;
  }
  stats.first_layer_islands=islands;
  const islandFail=o.maxislands>0&&islands>o.maxislands;
  if(islandFail) problems.unshift({kind:'DISCONNECTED_FIRST_LAYER',role:'adhesion',z:0.0,islands,limit:o.maxislands});
  const fail=stats.floating+stats.long_bridge+stats.cantilever+stats.bad_membrane+stats.unanchored_membrane+(islandFail?1:0);
  gaps.sort((a,b)=>b[3]-a[3]);
  return {file:o.file,layers:keys.length,
    params:{bead:o.bead,allow:o.allow,maxbridge:o.maxbridge,res:o.res,bedz:o.bedz,maxislands:o.maxislands,maxcantilever:o.maxcantilever},
    stats,byRole,worstGaps:gaps.slice(0,15).map(g=>[g[0],g[1],pyround_n(g[2],2),pyround_n(g[3],2)]),
    membranes,problems:problems.slice(0,400),problem_count:problems.length,PASS:fail===0,
    _grid:{W,H,res,x0,y0}};
}

root.WEFT_GATE={checkGcode,parseGcode,edt,pyround,version:WEFT_GATE_VERSION};
})(typeof globalThis!=='undefined'?globalThis:this);
