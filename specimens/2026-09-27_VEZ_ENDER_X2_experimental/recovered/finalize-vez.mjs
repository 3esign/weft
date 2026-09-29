import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const HOME=path.dirname(fileURLToPath(import.meta.url));
const R=path.join(HOME,'verification/runtime');
const B=await import(pathToFileURL(path.join(R,'core/weft_build.mjs')));
const PNG=await import(pathToFileURL(path.join(R,'core/weft_bambu_thumbnails.mjs')));
const machine=process.argv[2];assert.ok(['ender','a2l'].includes(machine));
const name=`VEZ_${machine.toUpperCase()}_X2`,dir=path.join(HOME,name),file=path.join(dir,name+'.gcode');
const sha=x=>createHash('sha256').update(x).digest('hex');
const original=fs.readFileSync(file,'utf8'),start=original.indexOf('; layer 0 '),end=original.indexOf('; ---- WEFT end ----');
assert.ok(start>0&&end>start,'explicit emitted-model range');
const rawPath=path.join(dir,name+'_before_travel_lift.gcode.txt');
if(!fs.existsSync(rawPath))fs.writeFileSync(rawPath,original);
const before=original.slice(0,start),body=original.slice(start,end),after=original.slice(end);
let hops=0;
const edited=body.replace(/(G1 E-0\.8 F1800\r?\
  assert.ok(Math.abs((+up)-(+down)-.4)<.0011,'only inherited 0.4mm travel hop');hops++;
  return retract+`G1 Z${(+down+1.2).toFixed(3)} F600`+tail;
});
assert.ok(hops>=720,'all instrument-zone transfers expected');
const deposition=s=>s.split(/\r?\
assert.equal(sha(deposition(body)),sha(deposition(edited)),'extrusion paths exactly preserved');
assert.equal(sha(before),sha(original.slice(0,start)));assert.equal(sha(after),sha(original.slice(end)));
const fixed=B.fixHeader(before+edited+after);
fs.writeFileSync(file,fixed.text);
console.log(`HOPS ${hops}; all existing retract/hop transfers now1.2mm; deposition unchanged`);

function segments(text){
  let x=0,y=0,z=0,active=false,role='',segs=[];
  for(const l of text.split(/\r?\
    if(l.startsWith('; layer ')){active=true;role=l.split(' ').at(-1);}
    if(l.startsWith('; ---- WEFT end'))active=false;
    if(!/^G[01] /.test(l))continue;
    const v=Object.fromEntries([...l.matchAll(/([XYZEF])(-?[\d.]+)/g)].map(a=>[a[1],+a[2]]));
    const nx=v.X??x,ny=v.Y??y,nz=v.Z??z;
    if(active&&v.E>0&&(nx!==x||ny!==y))segs.push({a:[x,y,z],b:[nx,ny,nz],role});
    x=nx;y=ny;z=nz;
  }
  return segs;
}
const segs=segments(fixed.text),m=B.loadMachines()[machine],geo=JSON.parse(fs.readFileSync(path.join(dir,name+'_geometry.json')));
function render(iso){
  const w=iso?1400:1100,h=iso?980:1100,rgba=Buffer.alloc(w*h*4);
  for(let i=0;i<rgba.length;i+=4){rgba[i]=246;rgba[i+1]=245;rgba[i+2]=240;rgba[i+3]=255;}
  const project=p=>{const x=p[0]-m.plate[0]/2,y=p[1]-m.plate[1]/2;return iso?[x-y,(x+y)*.46-p[2]*1.6]:[x,-y];};
  let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
  for(const s of segs)for(const p of[s.a,s.b]){const [x,y]=project(p);minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}
  const scale=Math.min((w-110)/(maxx-minx),(h-100)/(maxy-miny));
  const screen=p=>{const [x,y]=project(p);return[(x-(minx+maxx)/2)*scale+w/2,(y-(miny+maxy)/2)*scale+h/2];};
  const palette=[[17,108,113],[65,145,134],[169,112,47],[205,153,72],[137,53,99],[191,87,123]];
  for(const s of segs){
    const [ax,ay]=screen(s.a),[bx,by]=screen(s.b),n=Math.ceil(Math.hypot(bx-ax,by-ay));
    const ang=(Math.atan2((s.a[1]+s.b[1])/2-m.plate[1]/2,(s.a[0]+s.b[0])/2-m.plate[0]/2)+Math.PI*2)%(Math.PI*2);
    const color=s.role==='adhesion'?[175,175,164]:s.role==='bridge'?palette[Math.floor(ang/(Math.PI/6))%6]:[75,84,89];
    const alpha=s.role==='bridge'?.54:.32;
    for(let j=0;j<=n;j++){const x=Math.round(ax+(bx-ax)*j/Math.max(1,n)),y=Math.round(ay+(by-ay)*j/Math.max(1,n));if(x<0||x>=w||y<0||y>=h)continue;const k=(y*w+x)*4;for(let c=0;c<3;c++)rgba[k+c]=Math.round(rgba[k+c]*(1-alpha)+color[c]*alpha);}
  }
  const f=path.join(dir,name+(iso?'_isometric':'_top')+'.png');fs.writeFileSync(f,PNG.encodeRgbaPng(w,h,rgba));return f;
}
const top=render(false);render(true);
const opts={bead:m.bead,maxbridge:16.2,maxcantilever:1,allow:.6,minanchor:.5,maxCapRadius:20,maxislands:1,file};
const standard=B.runGate(fixed.text,opts);
fs.writeFileSync(path.join(dir,'FINAL_support_gate.json'),JSON.stringify(standard,null,2));assert.equal(standard.PASS,true,'final standard support gate');
console.log('FINAL S1 PASS '+standard.stats.checked_points+' checked points');
const strict=B.runGate(fixed.text,{...opts,allow:.1});
fs.writeFileSync(path.join(dir,'FINAL_tight_tolerance_probe.json'),JSON.stringify(strict,null,2));
console.log(`TIGHT tolerance0.1 PASS=${strict.PASS} problems=${strict.problem_count}`);
const layered=B.runGateLayers(fixed.text,{bead:m.bead,allow:.6,firstLayerBead:m.firstLayerBead,evidencedBridge:16.2,zones:[],file});
fs.writeFileSync(path.join(dir,'FINAL_layered_gate.json'),JSON.stringify(layered,null,2));assert.equal(layered.refuse,false,'layered gate without zone exemptions');
console.log('FINAL '+layered.vector);
let pack=null,containerHash=null;
if(machine==='a2l'){
  const three=path.join(dir,name+'.gcode.3mf');
  pack=B.packBambu3mf(fixed.text,path.join(R,m.containerTemplate),three,{name:name+'.stl',layerHeight:m.lh,thumb:top});
  const buffer=fs.readFileSync(three),inside=B.gcodeFrom3mf(buffer);
  const insideText=typeof inside==='string'?inside:inside.text||inside.gcode;
  assert.equal(sha(deposition(insideText)),sha(deposition(fixed.text)),'packaging preserves deposited segments');
  const pg=B.runGate(three,{...opts,file:three});assert.equal(pg.PASS,true,'delivered container gate');
  fs.writeFileSync(path.join(dir,'FINAL_package_gate.json'),JSON.stringify(pg,null,2));
  containerHash=sha(buffer);console.log('PACKAGE PASS '+JSON.stringify(pack));
}
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
manifest.finalization={at:new Date().toISOString(),process:'existing model-only retract/hop sequence raised0.4->1.2; no change to any deposition or printer start/end',hops,sourceSha256:sha(original),gcodeSha256:sha(fs.readFileSync(file)),containerSha256:containerHash,depositionSha256:sha(deposition(fixed.text))};
manifest.gate='FINAL_support_gate.json';manifest.gateLayers='FINAL_layered_gate.json';manifest.finalPackageGate=pack?'FINAL_package_gate.json':null;manifest.outcome='NOT PRINTED; digital verification only';
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
const result={name,machine,at:new Date().toISOString(),physicalStatus:'NOT PRINTED',standard:{pass:standard.PASS,problems:standard.problem_count,firstLayer:standard.firstLayer,checkedPoints:standard.stats.checked_points,islands:standard.stats.first_layer_islands},strict:{pass:strict.PASS,problemCount:strict.problem_count,meaning:'sensitivity probe at0.1mm instead of0.6mm support allowance, not physical calibration'},layered:{vector:layered.vector,refuse:layered.refuse,findings:layered.finding_count,declaredZones:0},stats:fixed.stats,package:pack,travelLift_mm:1.2,hops,dimensions_mm:geo.summary.size_mm,finalization:manifest.finalization};
fs.writeFileSync(path.join(dir,'DELIVERY.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));