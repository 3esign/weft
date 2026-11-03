/* Read-only independent LIRA artifact audit. No generation and no canonical gate runs.
   Usage: node audit.mjs FULL_geometry.json PACKAGE_DIR PROBE_geometry.json PROBE_PACKAGE_DIR
   Optional --probe-self-check allows the same completed probe in both positions, solely to
   exercise this auditor; that result never establishes completion of a full chair. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';

const argv=process.argv.slice(2),self=argv.includes('--probe-self-check');
const args=argv.filter(a=>!a.startsWith('--'));
if(args.length!==4){console.error('Usage: node audit.mjs FULL_geometry.json PACKAGE_DIR PROBE_geometry.json PROBE_PACKAGE_DIR [--probe-self-check]');process.exit(2);}
const [geoPath,packageDir,probePath,probeDir]=args.map(p=>path.resolve(p));
const missing=[geoPath,probePath,path.join(packageDir,'manifest.json'),path.join(probeDir,'manifest.json')].filter(p=>!fs.existsSync(p));
if(missing.length){console.log(JSON.stringify({status:'MISSING_PREREQUISITES',missing},null,2));process.exit(2);}
const failures=[],warnings=[];
const check=(ok,message)=>{if(!ok)failures.push(message);return ok;};
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const geo=json(geoPath),probe=json(probePath);
const manifest=json(path.join(packageDir,'manifest.json')),probeManifest=json(path.join(probeDir,'manifest.json'));
const round=(n,d=4)=>+n.toFixed(d);

function unzip(buf){
  const eocd=buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(eocd<0)throw new Error('ZIP end record missing');
  const out=new Map();let off=buf.readUInt32LE(eocd+16);
  for(let i=0,n=buf.readUInt16LE(eocd+10);i<n;i++){
    if(buf.readUInt32LE(off)!==0x02014b50)throw new Error('Invalid ZIP directory');
    const method=buf.readUInt16LE(off+10),cs=buf.readUInt32LE(off+20),us=buf.readUInt32LE(off+24);
    const nl=buf.readUInt16LE(off+28),el=buf.readUInt16LE(off+30),cl=buf.readUInt16LE(off+32),lo=buf.readUInt32LE(off+42);
    const name=buf.toString('utf8',off+46,off+46+nl),start=lo+30+buf.readUInt16LE(lo+26)+buf.readUInt16LE(lo+28);
    const b=buf.subarray(start,start+cs),data=method===0?b:method===8?zlib.inflateRawSync(b):null;
    if(!data||data.length!==us)throw new Error('Unsupported or invalid ZIP entry '+name);
    out.set(name,data);off+=46+nl+el+cl;
  }
  return out;
}
function files(dir,m){
  const raw=m.shipped.find(s=>s.endsWith('.gcode')),zip=m.shipped.find(s=>s.endsWith('.gcode.3mf'));
  if(!raw||!zip)throw new Error('Manifest must name raw G-code and sliced 3MF');
  const rawFile=path.join(dir,raw),zipFile=path.join(dir,zip);
  const rawBuffer=fs.readFileSync(rawFile),zipBuffer=fs.readFileSync(zipFile),entries=unzip(zipBuffer);
  const gc=entries.get('Metadata/plate_1.gcode');if(!gc)throw new Error('Sliced G-code absent from 3MF');
  const settingsBuffer=entries.get('Metadata/project_settings.config');
  if(!settingsBuffer)throw new Error('Printer settings absent from 3MF');
  return {raw:rawBuffer.toString('utf8'),packed:gc.toString('utf8'),entries,settings:JSON.parse(settingsBuffer.toString('utf8')),
    hashes:{raw:{file:rawFile,sha256:hash(rawBuffer),bytes:rawBuffer.length},container:{file:zipFile,sha256:hash(zipBuffer),bytes:zipBuffer.length}}};
}
const full=files(packageDir,manifest),pre=files(probeDir,probeManifest);
for(const [label,m,s] of [['full',manifest,full.settings],['probe',probeManifest,pre.settings]]){
  check(m.machine?.id==='a2l',label+' manifest machine is not a2l');
  check(JSON.stringify(m.machine?.plate)==='[330,320]',label+' plate is not 330 x 320');
  check(s.printer_model==='Bambu Lab A2L',label+' container printer_model is not Bambu Lab A2L');
  check(JSON.stringify(s.printer_settings_id).includes('A2L'),label+' printer_settings_id lacks A2L');
}
check(geo.summary.machine==='a2l','Geometry machine is not a2l');
check((geo.summary.violations||[]).length===0,'Geometry summary contains violations');
check(geo.layers.length>0&&probe.layers.length>0,'Empty geometry is not an audit pass');
if(!self){check(geo.layers.length===900,'Full LIRA must have 900 layers');check(Math.abs(geo.layers.at(-1).zTop-216)<0.001,'Full LIRA must end at 216 mm');}
else warnings.push('PROBE SELF CHECK ONLY: does not establish that the full chair exists or passes.');
const physicalLayer=L=>({k:L.k,zBot:L.zBot,zTop:L.zTop,paths:(L.paths||[]).map(p=>({pts:p.pts,role:p.role,bead:p.bead,speed:p.speed,closed:p.closed,tile:p.tile})),contours:L.contours,caps:L.caps});
const prefixMismatch=[];
for(let i=0;i<probe.layers.length;i++)if(JSON.stringify(physicalLayer(geo.layers[i]||{}))!==JSON.stringify(physicalLayer(probe.layers[i])))prefixMismatch.push(i);
check(prefixMismatch.length===0,'Probe geometry is not an exact physical prefix of full geometry');
check(JSON.stringify(geo.foundation)===JSON.stringify(probe.foundation),'Probe and full foundations differ');

const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
function hull(pts){
  const sorted=[...new Map(pts.map(p=>[p[0]+','+p[1],p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const lo=[],hi=[];
  for(const p of sorted){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
  for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}
  return lo.slice(0,-1).concat(hi.slice(0,-1));
}
const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],mom=[0,0,0],contact=[];
let volume=0,length=0,invalid=0,closed=0,priorIslands=-1;
const transitions=[];
for(const L of geo.layers){
  const islands=(L.silhouettes||[]).length;
  if(islands!==priorIslands){transitions.push({k:L.k,z:L.zBot,islands});priorIslands=islands;}
  for(const p of L.paths||[]){
    if(p.closed)closed++;
    const h=L.zTop-L.zBot,w=p.bead||geo.summary.args.bead,area=h*(w-h)+Math.PI*h*h/4;
    for(let i=0;i<p.pts.length;i++){
      const q=p.pts[i];if(!Number.isFinite(q[0])||!Number.isFinite(q[1])){invalid++;continue;}
      bounds[0]=Math.min(bounds[0],q[0]);bounds[1]=Math.min(bounds[1],q[1]);bounds[2]=Math.min(bounds[2],L.zBot);
      bounds[3]=Math.max(bounds[3],q[0]);bounds[4]=Math.max(bounds[4],q[1]);bounds[5]=Math.max(bounds[5],L.zTop);
      if(L.k===0)contact.push(q);
      if(i){const a=p.pts[i-1],dl=Math.hypot(q[0]-a[0],q[1]-a[1]),dv=dl*area;
        length+=dl;volume+=dv;mom[0]+=(q[0]+a[0])/2*dv;mom[1]+=(q[1]+a[1])/2*dv;mom[2]+=(L.zBot+L.zTop)/2*dv;}
    }
  }
}
check(invalid===0,'Non-finite geometry coordinates');check(closed===0,'Geometry has declared closed body paths');
check(transitions[0]?.islands===4,'First layer does not have four islands');
if(!self){check(transitions.some(t=>t.islands===2),'No two-island phase');check(transitions.at(-1)?.islands===1,'Crown does not rejoin as one island');}
const com=mom.map(n=>n/volume),footHull=hull(contact);
const hullArea=Math.abs(footHull.reduce((a,p,i)=>{const q=footHull[(i+1)%footHull.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2);
const margin=Math.min(...footHull.map((p,i)=>{const q=footHull[(i+1)%footHull.length];return cross(p,q,com)/Math.hypot(q[0]-p[0],q[1]-p[1]);}));
function inside(p,ring){
  let yes=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
function distanceToSegment(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
let growthDiagnostic=null;
const growthAt=geo.summary.field?.worstOutwardGrowthAt;
if(growthAt?.k>0&&geo.layers[growthAt.k]){
  const now=geo.layers[growthAt.k].silhouettes,previous=geo.layers[growthAt.k-1].silhouettes;
  let max=0,atXY=null,outsideVertices=0;
  for(const ring of now)for(const p of ring){
    if(previous.some(q=>inside(p,q)))continue;outsideVertices++;
    let d=Infinity;for(const q of previous)for(let i=0;i<q.length;i++)d=Math.min(d,distanceToSegment(p,q[i],q[(i+1)%q.length]));
    if(d>max){max=d;atXY=p;}
  }
  growthDiagnostic={...growthAt,fieldGradientEstimate_mm:geo.summary.field.worstOutwardGrowth_mm,
    maxOutwardSilhouetteStep_mm:round(max),atXY,outsideVertices,
    meaning:'Current boundary vertices outside the previous silhouettes, measured to the nearest previous boundary segment. This is not bead support, a swept extrusion length, or a strength test.'};
}

function gcodeAudit(text,label,limitZ=Infinity){
  const lines=text.split(/\r?\n/),start=lines.findIndex(s=>/^; layer \d+ /.test(s));
  let end=-1;for(let i=lines.length-1;i>=0;i--)if(/^;=+ A2L end gcode/.test(lines[i])){end=i;break;}
  check(start>=0&&end>start,label+': model or footer delimiter missing');
  if(start<0||end<=start)throw new Error(label+': cannot isolate model');
  const head=lines.slice(0,start),footer=lines.slice(end).join('\n');
  check(head.some(s=>/^M83(?:\s|;|$)/.test(s)),label+': no relative E mode before model');
  check(head.some(s=>/^G90(?:\s|;|$)/.test(s)),label+': no absolute XYZ mode before model');
  const headerLayers=Number(/^; total layer number:\s*(\d+)/m.exec(text)?.[1]);
  const headerZ=Number(/^; max_z_height:\s*([\d.]+)/m.exec(text)?.[1]);
  let x=NaN,y=NaN,z=NaN,feature='',count=0,filament=0;
  let declaredZ=Number([...head.join('\n').matchAll(/^; Z_HEIGHT:\s*([\d.]+)/gm)].at(-1)?.[1]);
  const modelBounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],zs=new Set(),moves=createHash('sha256'),prefixMoves=createHash('sha256');
  for(let i=start;i<end;i++){
    const ln=lines[i].trim(),fm=/^; FEATURE: (.*)$/.exec(ln);if(fm){feature=fm[1];continue;}
    const zm=/^; Z_HEIGHT:\s*([\d.]+)/.exec(ln);if(zm){declaredZ=+zm[1];continue;}
    if(/^(?:G91|M82)(?:\s|;|$)/.test(ln))failures.push(label+': unsupported model motion mode at '+(i+1));
    if(!/^G[01](?:\s|$)/.test(ln))continue;
    const code=ln.split(';')[0].trim(),d={};for(const m of code.matchAll(/([XYZEF])(-?\d*\.?\d+)/g))d[m[1]]=+m[2];
    if('X'in d)x=d.X;if('Y'in d)y=d.Y;if('Z'in d)z=d.Z;
    const rec=code+'\n';moves.update(rec);if(declaredZ<=limitZ+1e-6)prefixMoves.update(rec);
    if((d.E||0)>0&&('X'in d||'Y'in d)&&!/brim|skirt/i.test(feature)){
      count++;filament+=d.E;zs.add(z.toFixed(4));
      modelBounds[0]=Math.min(modelBounds[0],x);modelBounds[1]=Math.min(modelBounds[1],y);modelBounds[2]=Math.min(modelBounds[2],z);
      modelBounds[3]=Math.max(modelBounds[3],x);modelBounds[4]=Math.max(modelBounds[4],y);modelBounds[5]=Math.max(modelBounds[5],z);
    }
  }
  check(count>0,label+': no model extrusion measured');
  check(headerLayers===zs.size,label+': header layer count disagrees with model');
  check(Math.abs(headerZ-modelBounds[5])<0.011,label+': max_z header disagrees with model');
  const footZ=[...footer.matchAll(/^G1 Z([\d.]+) F900\s*; lower z a little/gm)].map(m=>+m[1]);
  check(footZ.length===1&&Math.abs(footZ[0]-modelBounds[5]-.4)<.011,label+': footer Z does not equal model top + 0.4');
  check(/^M104 S0(?:\s|;|$)/m.test(footer)&&/^M140 S0(?:\s|;|$)/m.test(footer),label+': heater shutdown missing');
  check(modelBounds[0]>8&&modelBounds[1]>8&&modelBounds[3]<322&&modelBounds[4]<312&&modelBounds[5]<=325,label+': model outside A2L conservative print region');
  return {extrusionMoves:count,layers:zs.size,headerLayers,headerZ,modelBounds_mm:modelBounds.map(n=>round(n)),footerZ:footZ,
    bodyMotionSha256:moves.digest('hex'),prefixMotionSha256:prefixMoves.digest('hex'),modelFilament_mm:round(filament)};
}
const prefixZ=probe.layers.at(-1).zTop;
const raw=gcodeAudit(full.raw,'full raw',prefixZ),packed=gcodeAudit(full.packed,'full container',prefixZ),pr=gcodeAudit(pre.raw,'probe raw',prefixZ);
check(raw.bodyMotionSha256===packed.bodyMotionSha256,'Container executable G0/G1 body differs from raw G-code');
check(raw.prefixMotionSha256===pr.prefixMotionSha256,'Probe G0/G1 prefix is not the exact beginning of full G-code');
check(raw.layers===geo.layers.length,'Geometry and final G-code layer counts differ');
const expected=[bounds[0]+165,bounds[1]+160,bounds[3]+165,bounds[4]+160],actual=[raw.modelBounds_mm[0],raw.modelBounds_mm[1],raw.modelBounds_mm[3],raw.modelBounds_mm[4]];
check(expected.every((v,i)=>Math.abs(v-actual[i])<0.035),'Model origin transform differs from expected plate-center shift (165,160)');
warnings.push('Centroid is a uniform-deposition estimate from path lengths and stadium bead sections; intersections are double-counted. Hull is a first-layer centerline hull, not actual contact area. Neither estimates strength, adhesion, dynamics, or physical success.');
warnings.push('Canonical gates are not rerun here. This audit checks identity, prefix fidelity and artifact consistency only.');
const result={status:failures.length?'FAIL':self?'PROBE_SELF_CHECK_PASS':'PASS',failures,warnings,
  hashes:{geometry:{file:geoPath,sha256:hash(fs.readFileSync(geoPath))},probeGeometry:{file:probePath,sha256:hash(fs.readFileSync(probePath))},...full.hashes},
  prefix:{layers:probe.layers.length,top_mm:prefixZ,geometryMatches:prefixMismatch.length===0,mismatchingLayerIndices:prefixMismatch.slice(0,12),gcodeMatches:raw.prefixMotionSha256===pr.prefixMotionSha256},
  topologyTransitions:transitions,geometryBounds_mm:bounds.map(n=>round(n)),growthDiagnostic,
  modelOnly:{thread_m:round(length/1000,2),estimatedDepositedVolume_mm3:round(volume,1),estimatedCentroid_mm:com.map(n=>round(n,3)),firstLayerCenterlineHullArea_mm2:round(hullArea,1),centroidProjectionHullMargin_mm:round(margin,2)},
  raw,container:packed,machine:{manifest:manifest.machine.id,printer_model:full.settings.printer_model,printer_settings_id:full.settings.printer_settings_id}};
console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
