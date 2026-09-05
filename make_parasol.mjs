/* WEFT · P1 "Parasol" generator — a cluster of flared trunks (mushrooms) that
   weld to each other tab-to-tab at the canopy, with windows, bridges, grammar
   bands, dyadic density bands and an open oculus. Built by composing the app's
   own layer functions island-by-island (like batch mode), so every layer is
   made by the same code the tests lock, and STL/G-code stay the app's own.

   usage: node make_parasol.mjs --trunks 2 --H 240 --out specimens/P1 [--dry]
   env:   WEFT_CHROMIUM=/path/to/chromium (optional) */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';

const arg=(k,d)=>{const i=process.argv.indexOf('--'+k); return i>0?process.argv[i+1]:d;};
const TRUNKS=+arg('trunks',2), H=+arg('H',240), DRY=process.argv.includes('--dry');
const OUT=path.resolve(arg('out','specimens/2026-09-02_P1_parasol_pending'));
fs.mkdirSync(OUT,{recursive:true});

/* ---------- the design (all mm) ---------- */
const CFG={
  name:`P1_parasol_${TRUNKS}t_H${H}`, trunks:TRUNKS, H,
  machine:'a2l', lh:0.24, bead:0.45, w:5, e:1.0, r0:22, s:133, oculus:20,
  Kb:48,                       // base node count per turn (lambda ≈ 16.5 mm at the rim, like D5 λ18)
  zWin:[15,40],                // window (open sweep) band in the trunk
  zFlareEnd:150, zCanopyEnd:165,
  bandLayers:48,               // grammar / tab band = 11.5 mm
  firstLayerBead:0.52, firstLayerSpeed:12, adhesionWidth:8,
  // per-trunk experimental variables
  // shift: max lateral step per layer during the flare, as a multiple of e (the predicted cone: <=1)
  // Km:    density multiplier in flare+canopy (1 = Kb, 0.5 = 2*Kb refinement)
  // gapN:  window width in node pitches (odd, so open-arc nodes stay on the closed grid)
  variants:{
    1:[{id:'A',shift:0.8,Km:0.5,gapN:3}],
    2:[{id:'A',shift:0.6,Km:0.5,gapN:3},{id:'B',shift:1.0,Km:1,gapN:3}],
    4:[{id:'A',shift:0.6,Km:1,gapN:1},{id:'B',shift:0.6,Km:0.5,gapN:3},
       {id:'C',shift:1.0,Km:1,gapN:1},{id:'D',shift:1.0,Km:0.5,gapN:3}],
  }[TRUNKS],
  grammarCycle:['staple','diagonal','perp','sine'],
  tabCycle:[1.0,0.6,1.5,2.0],
};
if(TRUNKS===1){ CFG.r0=30; CFG.oculus=40; }

const browser=await chromium.launch({executablePath:process.env.WEFT_CHROMIUM||undefined,
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const page=await browser.newPage({viewport:{width:1400,height:900}});
page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
await page.goto(pathToFileURL(path.resolve('index.html')).href,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:20000});

const report=await page.evaluate(async (C)=>{
  const D2R=Math.PI/180, smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  setMachine(C.machine);
  Object.assign(P,{mode:'dome',lh:C.lh,bead:C.bead,w:C.w,overshoot:C.e,webType:'staple',
    cycle:['chord','web'],amp:0,ampF:1,altPhase:true,autoLOD:true,minGap:1.4,gradeLean:false,
    dwell:0.6,jitter:0,flowBoost:1.25,maxBridge:12,checkOv:true,speed:30,bridgeSpeed:18,
    temp:215,bed:55,fan:100,firstLayerBead:C.firstLayerBead,firstLayerSpeed:C.firstLayerSpeed,
    adhesion:'foundation',adhesionWidth:C.adhesionWidth,capClose:false,hFrac:1,sweep:360});
  seed=1337;

  /* island layout */
  const n=C.trunks, cx=[], cy=[], face=[], nbr=[];   // face: window direction (deg), nbr: neighbour directions
  if(n===1){ cx.push(0);cy.push(0);face.push(180);nbr.push([]); }
  if(n===2){ cx.push(-C.s/2,C.s/2);cy.push(0,0);face.push(180,0);nbr.push([0],[180]); }
  if(n===4){ const h=C.s/2; cx.push(-h,h,h,-h);cy.push(-h,-h,h,h);face.push(225,315,45,135);
    nbr.push([0,90],[180,90],[180,270],[0,270]); }
  /* rim radius: tab tips of neighbours overlap by 0.6 mm (rails stay 2e-0.6 apart) */
  const R = n===1 ? 130 : (C.s - C.w - 2*C.e + 0.6)/2;

  /* one revolve centerline: circle of radius r, sweep sw (deg) centred on angle a0 (deg),
     R = the trunk's rim radius so closedHalves() is constant through the whole trunk */
  function revCl(r,sw,a0,Rref){
    const swr=sw*D2R, arc=r*swr, m=Math.max(10,Math.ceil(arc/STEP)), pts=[],nrm=[],cum=[0];
    for(let i=0;i<=m;i++){const a=a0*D2R+i/m*swr-swr/2;pts.push({x:r*Math.cos(a),y:r*Math.sin(a)});nrm.push({x:Math.cos(a),y:Math.sin(a)});
      if(i>0)cum.push(cum[i-1]+arc/m);}
    return {pts,nrm,cum,total:arc,r,R:Rref,kind:'dome',closed:sw>=359.9};
  }
  /* density policy override: dyadic multiplier from the band map, then the app's own LOD floor */
  let BAND_M=1;
  decimatedHalf=function(cl){
    const base=halfWave(cl), smin=Math.max(P.minGap,P.bead*2.2);
    let h=base*BAND_M, m=BAND_M;
    let innerRatio=1; if(cl.kind==='dome'&&cl.r>1e-4){const A=Math.min(P.w/2,cl.r*0.85);innerRatio=Math.max(0.1,(cl.r-A)/cl.r);}
    if(P.autoLOD){ while(h*innerRatio<smin&&m<64){h*=2;m*=2;} }
    return {h,m};
  };

  const N=Math.round(C.H/C.lh), out=[], perTrunk=[];
  const lam=4*Math.PI*R/C.Kb;          // makes closedHalves() == Kb exactly
  P.lambda=lam;
  const dNode=360/C.Kb;                // node pitch in degrees on the base grid

  for(let t=0;t<n;t++){
    const V=C.variants[t], ox=cx[t], oy=cy[t];
    const dz=1.5*(R-C.r0)*C.lh/(V.shift*C.e);            // flare height for this cone step
    const zF0=C.zFlareEnd-dz;
    const rOf=z=> z<zF0 ? C.r0
      : z<C.zFlareEnd ? C.r0+(R-C.r0)*smooth((z-zF0)/dz)
      : z<C.zCanopyEnd ? R
      : R-(R-C.oculus)*smooth((z-C.zCanopyEnd)/(C.H-C.zCanopyEnd));
    /* window: gap = gapN node pitches, centred on face[t]; seam of closed rings sits opposite */
    const gapDeg=V.gapN*dNode, aWin=face[t]+dNode/2, aSeam=aWin+180;
    const info={id:V.id,cx:ox,cy:oy,R:+R.toFixed(3),r0:C.r0,flare:{z0:+zF0.toFixed(2),z1:C.zFlareEnd,height:+dz.toFixed(2),
      maxStepPerLayer:+(V.shift*C.e).toFixed(3),maxLeanDeg:+(Math.atan(V.shift*C.e/C.lh)/D2R).toFixed(1)},
      window:{z:C.zWin,gapDeg:+gapDeg.toFixed(3),chord_mm:+(2*C.r0*Math.sin(gapDeg/2*D2R)).toFixed(2),faceDeg:aWin},
      Km:V.Km,bands:[],threadLength_mm:0,nodes:0,layers:0,overlaps:0,maxStepSeen:0};
    /* foundation annulus (same recipe as the app's dome foundation) */
    { const pitch=C.firstLayerBead*0.82, baseOuter=C.r0+C.w/2, rOuter=baseOuter+C.adhesionWidth, rInner=Math.max(C.firstLayerBead,C.r0-C.w/2);
      const pts=radialSpiral(rOuter,rInner,pitch).map(p=>({x:p.x+ox,y:p.y+oy}));
      const L={role:'adhesion',adhesion:'foundation',pts,apexes:[],zBot:0,zTop:C.lh,closed:false,cl:null,
        bead:C.firstLayerBead,speed:C.firstLayerSpeed,wSpan:C.w,ovh:C.e,nodeGap:null,trunk:V.id};
      L.len=plen(pts); L.ov=[]; out.push(L); info.threadLength_mm+=L.len; }
    let webCount=0, prevR=null, lastBand=null;
    for(let k=0;k<N;k++){
      const zBot=k*C.lh, zTop=zBot+C.lh, zc=zBot+C.lh/2, r=rOf(zc);
      const inWin=zc>=C.zWin[0]&&zc<C.zWin[1], inFlare=zc>=zF0&&zc<C.zFlareEnd, inCanopy=zc>=C.zFlareEnd&&zc<C.zCanopyEnd, inCurl=zc>=C.zCanopyEnd;
      /* bands: grammar + tab length by 48-layer band, forced staple/e where structure is tested */
      const b=Math.floor(k/C.bandLayers);
      let web=C.grammarCycle[b%4], e=C.tabCycle[b%4];
      if(k<12||inWin||inFlare||inCanopy){ web='staple'; e=C.e; }
      if(inCurl){ web=['sine','perp','diagonal','staple'][b%4]; e=[1.0,1.5,1.0,0.6][b%4]; }
      /* density: refinement (Km) in the outer flare + canopy, base elsewhere; LOD floor handles the oculus */
      BAND_M = ((inFlare&&r>0.7*R)||inCanopy) ? V.Km : 1;
      P.webType=web; P.overshoot=e; P.altPhase=!inWin;
      const sw=inWin?360-gapDeg:360, cl=revCl(r,sw,inWin?aWin:aSeam,R);
      const role=P.cycle[k%P.cycle.length];
      const g= role==='chord' ? chordLayer(cl,zBot,0) : webLayer(cl,zBot,webCount++);
      const L={role,pts:g.pts.map(p=>({x:p.x+ox,y:p.y+oy})),apexes:g.apexes.map(a=>({x:a.x+ox,y:a.y+oy,z:a.z})),
        zBot,zTop,closed:g.closed,cl,bead:C.bead,speed:zBot===0?C.firstLayerSpeed:P.speed,wSpan:C.w,ovh:e,webType:web,
        nodeGap: role==='web'?webLayer._lastGap:null, trunk:V.id, band:{web,e,m:BAND_M,open:inWin}};
      L.len=plen(L.pts); out.push(L);
      info.threadLength_mm+=L.len; info.nodes+=L.apexes.length; info.layers++;
      if(prevR!=null) info.maxStepSeen=Math.max(info.maxStepSeen,Math.abs(r-prevR)); prevR=r;
      const key=`${web}|e${e}|m${BAND_M}|${inWin?'open':'closed'}`;
      if(key!==lastBand){ info.bands.push({fromZ:+zBot.toFixed(2),web,e,m:BAND_M,open:inWin}); lastBand=key; }
    }
    info.maxStepSeen=+info.maxStepSeen.toFixed(3); info.threadLength_mm=Math.round(info.threadLength_mm);
    perTrunk.push(info);
  }
  layers=out.sort((a,b)=>a.zBot-b.zBot||0);
  detectOverlaps();
  for(const L of layers){ const t=perTrunk.find(x=>x.id===L.trunk); if(t) t.overlaps+=L.ov.length; }
  /* bbox incl. bead */
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9; for(const L of layers) for(const p of L.pts){ if(p.x<mnx)mnx=p.x;if(p.x>mxx)mxx=p.x;if(p.y<mny)mny=p.y;if(p.y>mxy)mxy=p.y; }
  const size=[+(mxx-mnx+C.bead).toFixed(1),+(mxy-mny+C.bead).toFixed(1),+(N*C.lh).toFixed(1)];
  /* inter-island proximity at the canopy: rail-to-rail and tab-to-tab (nearest points between islands on the same z) */
  const prox=[]; if(n>1){
    const zs=[C.zFlareEnd+2, C.zCanopyEnd-2];
    for(const z of zs){ const Ls=layers.filter(L=>L.zBot<=z&&L.zTop>z&&L.role!=='adhesion');
      for(let i=0;i<Ls.length;i++)for(let j=i+1;j<Ls.length;j++){ let best=1e9;
        for(const p of Ls[i].pts){ for(const q of Ls[j].pts){ const d=Math.hypot(p.x-q.x,p.y-q.y); if(d<best)best=d; } }
        prox.push({z:+z.toFixed(1),role:Ls[i].role,pair:Ls[i].trunk+Ls[j].trunk,minDist_mm:+best.toFixed(2)}); } }
  }
  const totalLen=layers.reduce((s,L)=>s+L.len,0), totalNodes=layers.reduce((s,L)=>s+L.apexes.length,0), totalOv=layers.reduce((s,L)=>s+L.ov.length,0);
  return {name:C.name,machine:MACHINES[MACHINE].label,bed:[BED,BEDY],R:+R.toFixed(3),lambda_mm:+lam.toFixed(3),Kb:C.Kb,
    layers:layers.length,bodyLayers:N,size_mm:size,bedFit:size[0]<=BED&&size[1]<=BEDY,
    threadLength_m:+(totalLen/1000).toFixed(1),weldNodes:totalNodes,unintendedOverlaps:totalOv,
    kinematicEstimate_h:+(totalLen/P.speed/3600).toFixed(1),
    d5ScaledEstimate_h:+((totalLen/1000)/366.4*32).toFixed(0),   // D5 R140: 366 m of thread took ~32 h through Bambu Studio
    perTrunk,proximity:prox};
},CFG);

console.log(JSON.stringify(report,null,1));
fs.writeFileSync(path.join(OUT,`${CFG.name}_report.json`),JSON.stringify({config:CFG,report},null,2));
const DUMP=arg('dump',null);
if(DUMP){
  const d=await page.evaluate(()=>layers.filter((L,i)=>L.role==='adhesion'||i%3===0).map(L=>({z:+L.zBot.toFixed(2),role:L.role,t:L.trunk,web:L.webType||null,
    pts:simplifyPts(L.pts,0.15,6).map(p=>[+p.x.toFixed(2),+p.y.toFixed(2)])})));
  fs.writeFileSync(DUMP,JSON.stringify(d)); console.log('dump',DUMP,d.length,'layers');
}
if(!DRY){
  const total=await page.evaluate(async ()=>{
    for(const L of layers){ const g=ribbon(L.pts,(L.bead||P.bead)/2,L.zBot,L.zTop); if(g) L.geo=g; }
    const parts=await buildSTLParts(); window.__out=new Uint8Array(await new Blob(parts).arrayBuffer()); return window.__out.length; });
  const outStl=path.join(OUT,`${CFG.name}.stl`), fd=fs.openSync(outStl,'w'), CH=1<<20;
  for(let off=0;off<total;off+=CH){
    const b64=await page.evaluate(([o,n])=>{const u=window.__out.subarray(o,o+n);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s);},[off,Math.min(CH,total-off)]);
    fs.writeSync(fd,Buffer.from(b64,'base64')); }
  fs.closeSync(fd); console.log('STL',outStl,total,'bytes');
}
await browser.close();
