import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// A geometry adapter, reusing the existing foundation/contour generator and emitter.
const OUT=path.dirname(fileURLToPath(import.meta.url));
const ROOT=fs.existsSync(path.join(OUT,'verification/runtime/core/weft_prag_geometry.mjs'))
  ? path.join(OUT,'verification/runtime') : 'C:/Svemir/!Projekti/PI/weft';
const {generatePrag}=await import(pathToFileURL(ROOT+'/core/weft_prag_geometry.mjs'));
const TAU=Math.PI*2, R=55, RB=56.5, N=12, STEP=.4, CYCLES=60, HOLDS=1;
const round=x=>Math.round(x*1000)/1000;
const recipes=[24,30,36].flatMap(reach=>[2.4,3.2].map(gap=>({reach,gap,advance:reach/CYCLES})));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
function pen(){
  const p=[];
  function line(q){if(!p.length){p.push(q);return;}const a=p.at(-1),n=Math.max(1,Math.ceil(Math.hypot(q[0]-a[0],q[1]-a[1])/STEP));for(let i=1;i<=n;i++)p.push([a[0]+(q[0]-a[0])*i/n,a[1]+(q[1]-a[1])*i/n]);}
  function arc(r,a,b){const n=Math.max(1,Math.ceil(Math.abs(b-a)*r/STEP));line(polar(r,a));for(let i=1;i<=n;i++)line(polar(r,a+(b-a)*i/n));}
  return {p,line,arc};
}
const secData=Array.from({length:N},(_,s)=>{
  const r=recipes[s%6], width=r.gap/(RB+r.reach);
  const usable=TAU/N-.04, teeth=4, pitch=usable/teeth;
  const a0=s*TAU/N+(TAU/N-teeth*pitch)/2;
  return {sector:s+1,pairedWith:(s+6)%12+1,...r,tipArc_mm:r.gap,baseGapAtFullRadius_mm:round(pitch*(RB+r.reach)-r.gap),pitch,width,teeth,a0,a1:a0+(teeth-1)*pitch+width};
});
function terrace(j){
  const paths=[];
  if(j>0)for(const s of secData){
    const q=pen(),prev=RB+Math.min(s.reach,j*s.advance);
    q.arc(prev,s.a0,s.a1);
    paths.push({pts:q.p.map(v=>v.map(round)),role:'bridge',closed:false,speed:18,row:0,col:s.sector,
      label:`VEZ-pretie-${j}-sector-${s.sector}`,tile:'terrace',intent:'old-frontier transverse tie, no radial replay'});
  }
  // The last layer ONLY ties the final frontier: no duplicate full-reach tooth lap.
  if(j===CYCLES)return paths;
  const q=pen();q.line(polar(RB,0));
  // Keep continuity at the root between sectors; no traverse across the inner void.
  let cursor=0;
  for(const s of secData){
    const now=RB+Math.min(s.reach,(j+1)*s.advance);
    q.arc(RB,cursor,s.a0);
    for(let t=0;t<s.teeth;t++){
      const a=s.a0+t*s.pitch,b=a+s.width,c=s.a0+(t+1)*s.pitch;
      q.line(polar(now,a));q.arc(now,a,b);q.line(polar(RB,b));q.arc(RB,b,c);
    }
    cursor=s.a0+s.teeth*s.pitch;
  }
  q.arc(RB,cursor,TAU);
  const pts=q.p.map(v=>v.map(round));
  paths.push({pts,role:'bridge',closed:false,speed:18,row:1,col:0,label:`VEZ-frontier-${j}`,tile:'terrace',intent:`phase-locked closed teeth after all pre-ties; increment <=0.6mm; j=${j}`});
  return paths;
}

function generate(machine){
  const name=`VEZ_${machine.toUpperCase()}_X2`;
  const base=generatePrag({variant:'kuka',machine,radius:R,wallMm:6,reach:22,adv:2.5,allowAssumedBead:true,name});
  assert.equal(base.violations.length,0,base.violations.join(';'));
  const p=base.payload, lh=p.summary.layerHeight_mm;
  const walls=p.layers.filter(l=>l.phase==='wall-1');
  const template=p.layers.find(l=>l.phase==='terrace');
  for(const l of walls){
    const dense=l.k<4||l.k>=walls.length-4;
    l.web='staple';
    for(const c of l.contours){c.web='staple';if(!dense)c.nodes=c.nodes.filter((_,i)=>i%2===0);}
  }
  // No inherited ring 0.7mm beyond the wall: a true wall rail is the seat.
  // Strict tolerance probe caught the old 359mm seat ring as floating.
  delete walls.at(-1).paths;
  for(const c of walls.at(-1).contours){c.role='chord';c.w=3.0;}
  const layers=walls;
  for(let j=0;j<CYCLES+HOLDS;j++){
    const k=layers.length,l=structuredClone(template);l.k=k;l.zBot=round(k*lh);l.zTop=round((k+1)*lh);l.phase='terrace';l.web='staple';
    // The drum ends at6mm. Above the rail seat, the registered tooth roots carry
    // themselves; continuing a drum would reprint the same root arcs and waste time.
    l.contours=[];
    l.paths=terrace(j);layers.push(l);
  }
  p.layers=layers;
  const A={...p.summary.args,K:96,maxbridge:16.2,maxcantilever:1,bridgeSpeed:18};
  const height=layers.at(-1).zTop;
  // walls was reused as layers; compute the stable count from the known machine clock.
  const wallCount=Math.round(6/lh),wallTop=round(wallCount*lh);
  const minPitchNodes=Math.min(...layers.flatMap(l=>l.contours.map(c=>c.nodes.length)));
  let maxSegment=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,totalRaw=0;
  for(const l of layers)for(const pp of l.paths||[])for(let i=0;i<pp.pts.length;i++){
    const v=pp.pts[i];minX=Math.min(minX,v[0]);maxX=Math.max(maxX,v[0]);minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);
    if(i){const d=Math.hypot(v[0]-pp.pts[i-1][0],v[1]-pp.pts[i-1][1]);maxSegment=Math.max(maxSegment,d);totalRaw+=d;}
  }
  const bx=machine==='ender'?220:330,by=machine==='ender'?220:320;
  const bead=A.bead;
  const margin=Math.min(bx/2+minX,bx/2-maxX,by/2+minY,by/2-maxY)-bead/2;
  assert.ok(margin>=15,`margin ${margin}`);assert.ok(maxSegment<=.55);assert.equal(wallCount,layers.findIndex(l=>l.phase==='terrace'));
  const zones=[]; // No gate exemption: the new process must pass S3/S4 without declared overrides.
  p.summary={name,generator:'generate-vez.mjs',process:'pre-tied-closed-corbel/v1',physicalStatus:'NOT PRINTED',machine,
    machineQualification:base.payload.summary.machineQualification,
    H:height,size_mm:[round(maxX-minX+bead),round(maxY-minY+bead),height],height_mm:height,
    layerHeight_mm:lh,bead_mm:bead,totalLayers:layers.length,drumHeight_mm:wallTop,drumLayers:wallCount,
    terraceLayers:CYCLES+HOLDS,collarLayers:0,wallRadius_mm:R,rootRadius_mm:RB,sectors:12,
    sectorRecipes:secData,reach_mm:[24,30,36],maxNewAdvance_mm:.6,maxTipGrowthExcursionDesign_mm:4.4,maxTransverseBridgeDesign_mm:Math.max(...secData.map(s=>s.baseGapAtFullRadius_mm)),
    hypotheses:['smaller growth step plus narrow closed tips reduce loose fringe','transverse tie before growth distributes pull across previous tips; it is not a second grounded support','shorter sparse drum saves non-instrument time'],
    limits:['36mm total cantilever reach is unprinted','height and growth rate covary with reach; this is screening, not an isolated causal test','180-degree twins expose direction dependence but cannot uniquely identify fan causation','gate cannot predict hot plastic sag, bond strength, curl, or bed release'],
    args:A,experiments:{declaredBridgeCeiling_mm:16.2,evidencedBridge_mm:16.2,gateCantilever_mm:1,zones},
    events:[{k:wallCount,z:wallTop,event:'short woven drum -> terrace: watch from here'}],
    foundation:{...base.payload.summary.foundation},
    metrics:{maxTypedSegment_mm:round(maxSegment),typedThread_m:round(totalRaw/1000),minimumCentrelinePlateMargin_mm:round(margin+bead/2),minimumBeadEdgePlateMargin_mm:round(margin),sparseNodes:minPitchNodes,denseNodes:96},
    source:{generator:ROOT+'/core/weft_prag_geometry.mjs',sha256:sha(ROOT+'/core/weft_prag_geometry.mjs'),machinesSha256:sha(ROOT+'/machines.json'),adapted:'in memory; source unchanged'},
    violations:[],warnings:['Experimental geometry; physical outcome pending. Ender bead assumed; A2L width completion-validated, not caliper-measured.']};
  const dir=path.join(OUT,name);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,`${name}_geometry.json`),JSON.stringify(p));
  fs.writeFileSync(path.join(dir,'zones.json'),JSON.stringify(zones,null,2));
  fs.writeFileSync(path.join(dir,'design.json'),JSON.stringify(p.summary,null,2));
  return p;
}
function svg(p){
  const colors=['#1e6a72','#4ba49c','#bd823f','#e0b168','#9e4870','#dc749a'];
  const out=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="920" viewBox="0 0 1200 920"><rect width="1200" height="920" fill="#faf8f2"/>'];
  out.push('<g font-family="Arial" fill="#24262b"><text x="42" y="54" font-size="28">VEZ 02 · 12 sektora / 6 parova</text><text x="42" y="86" font-size="17">Ukupni domet 24 / 30 / 36 mm · zatvoreni vrh 2.4 / 3.2 mm</text></g>');
  const ox=435,oy=473,scale=3.35;
  const plot=(pts,color,width)=>`<polyline points="${pts.map(v=>`${(ox+v[0]*scale).toFixed(1)},${(oy-v[1]*scale).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  for(const s of secData){const q=pen(),rt=RB+s.reach;for(let i=0;i<s.teeth;i++){const a=s.a0+i*s.pitch,b=a+s.width;q.line(polar(RB,a));q.line(polar(rt,a));q.arc(rt,a,b);q.line(polar(RB,b));}
    out.push(plot(q.p,colors[(s.sector-1)%6],.9));const mid=((s.sector-.5)*TAU/12);out.push(`<text x="${ox+107*scale*Math.cos(mid)}" y="${oy-107*scale*Math.sin(mid)}" font-family="Arial" font-size="15" text-anchor="middle">${s.sector}</text>`);}
  out.push(`<circle cx="${ox}" cy="${oy}" r="${RB*scale}" fill="none" stroke="#30343d" stroke-width="1.4"/>`);
  out.push('<g font-family="Arial" font-size="17" fill="#24262b">');
  recipes.forEach((s,i)=>out.push(`<rect x="850" y="${210+i*57}" width="18" height="18" fill="${colors[i]}"/><text x="884" y="${225+i*57}">${i+1} + ${i+7}: ${s.reach} / ${s.gap} mm</text>`));
  out.push('<text x="850" y="606">Stub 6 mm</text><text x="850" y="635">Rast 0.4–0.6 mm/sloj</text><text x="850" y="664">Veza pre sledećeg rasta</text><text x="850" y="713">+X je desno · +Y gore</text><text x="850" y="742">Sektori su CCW odozgo</text><text x="42" y="872" font-size="16">EKSPERIMENT · digitalna provera nije potvrda fizičke štampe · nacrt poslednjeg sloja</text></g></svg>');
  fs.writeFileSync(path.join(OUT,'VEZ_02_plan.svg'),out.join(''));
}
if(process.argv.includes('--generate')){for(const m of ['ender','a2l']){const p=generate(m);svg(p);console.log(JSON.stringify(p.summary.metrics));}}
export {generate,secData,terrace};