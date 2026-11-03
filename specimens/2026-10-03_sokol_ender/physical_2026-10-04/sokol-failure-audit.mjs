import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import {pathToFileURL} from 'node:url';

const project=process.argv[2],out=process.argv[3];
if(!project||!out)throw Error('Usage: node audit.mjs project output.json');
const source=path.join(project,'specimens/2026-10-03_sokol_ender/sokol_v2c_geometry.json');
const file=path.join(project,'ZA_STAMPU/CREALITY_Ender3V4/SOKOL_V2c/SOKOL_V2_ENDER.gcode');
const data=JSON.parse(fs.readFileSync(source));
const rr=(n,p=3)=>Number(n.toFixed(p));
const polygonArea=ps=>ps.reduce((s,a,i)=>{const b=ps[(i+1)%ps.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
const bounds=pts=>{const x=pts.map(p=>p[0]),y=pts.map(p=>p[1]);return [rr(Math.min(...x)),rr(Math.min(...y)),rr(Math.max(...x)),rr(Math.max(...y))];};
const rows=data.layers.map(l=>{
 const paths=l.paths.map(p=>{let length=0;for(let i=1;i<p.pts.length;i++)length+=Math.hypot(p.pts[i][0]-p.pts[i-1][0],p.pts[i][1]-p.pts[i-1][1]);return {label:p.label,role:p.role,angle:Number(p.intent.match(/@ ([-\d.]+)deg/)?.[1]),points:p.pts.length,length_mm:rr(length),bounds:bounds(p.pts),speed:p.speed};});
 return {k:l.k,z:l.zTop,phase:l.phase,paths,islands:new Set(l.paths.map(p=>p.tile)).size,loops:(l.silhouettes||[]).map(ps=>({signedArea:rr(polygonArea(ps)),bounds:bounds(ps)})),length_mm:rr(paths.reduce((s,p)=>s+p.length_mm,0))};
});
console.log('Geometry summarized',rows.length);
const transitions=[];for(let i=1;i<rows.length;i++){const p=rows[i-1],r=rows[i];if(r.phase!==p.phase||r.islands!==p.islands||r.loops.length!==p.loops.length)transitions.push({k:r.k,z:r.z,from:[p.phase,p.islands,p.loops.length],to:[r.phase,r.islands,r.loops.length],parts:r.paths.map(p=>p.label)});}
const motion=new Map(),speeds=new Map(),fan=[],temperature=[],dwells=[],other=[],hash=crypto.createHash('sha256');
const stream=fs.createReadStream(file);stream.on('data',b=>hash.update(b));
let pos={X:0,Y:0,Z:0,E:0,F:600},model=false,absolute=true,relativeE=true,lineNo=0,lastLayer=null;
for await(const line of readline.createInterface({input:stream,crlfDelay:Infinity})){
 lineNo++;
 if(line.startsWith('; WEFT_FIRST_LAYER_V1'))model=true;
 if(line.startsWith('; WEFT_MODEL_END'))model=false;
 if(line.startsWith('M106')||line.startsWith('M107'))fan.push({line:lineNo,z:pos.Z,command:line});
 if(/^M(104|109|140|190)\b/.test(line))temperature.push({line:lineNo,z:pos.Z,command:line});
 if(/^G4\b/.test(line)){dwells.push({line:lineNo,z:pos.Z,command:line});continue;}
 if(line==='G90'){absolute=true;continue;}if(line==='G91'){absolute=false;continue;}
 if(line==='M83'){relativeE=true;continue;}if(line==='M82'){relativeE=false;continue;}
 if(!/^G(?:0|1|92)\b/.test(line))continue;
 const v={};for(const m of line.split(';')[0].matchAll(/([XYZEF])\s*([-+\d.]+)/g))v[m[1]]=Number(m[2]);
 if(line.startsWith('G92')){Object.assign(pos,v);continue;}
 const next={...pos};for(const a of ['X','Y','Z'])if(v[a]!==undefined)next[a]=absolute?v[a]:pos[a]+v[a];if(v.F!==undefined)next.F=v.F;
 const de=v.E===undefined?0:relativeE?v.E:v.E-pos.E;next.E=relativeE?pos.E+de:(v.E??pos.E);
 const dist=Math.hypot(next.X-pos.X,next.Y-pos.Y,next.Z-pos.Z),xy=Math.hypot(next.X-pos.X,next.Y-pos.Y);
 if(model){
  const key=rr(next.Z);if(de>0&&xy>0.00001){
   const r=motion.get(key)||{z:key,segments:0,length_mm:0,filament_mm:0,extrusionSeconds:0,travelSeconds:0,minSpeed:Infinity,maxSpeed:0,feedLengths:{},bounds:[Infinity,Infinity,-Infinity,-Infinity]};
   r.segments++;r.length_mm+=dist;r.filament_mm+=de;r.extrusionSeconds+=dist/(next.F/60);r.minSpeed=Math.min(r.minSpeed,next.F/60);r.maxSpeed=Math.max(r.maxSpeed,next.F/60);r.feedLengths[next.F/60]=(r.feedLengths[next.F/60]||0)+dist;
   for(const p of [pos,next]){r.bounds[0]=Math.min(r.bounds[0],p.X);r.bounds[1]=Math.min(r.bounds[1],p.Y);r.bounds[2]=Math.max(r.bounds[2],p.X);r.bounds[3]=Math.max(r.bounds[3],p.Y);}
   motion.set(key,r);lastLayer=r;speeds.set(next.F/60,(speeds.get(next.F/60)||0)+dist);
  }else if(lastLayer){lastLayer.travelSeconds+=Math.max(dist,Math.abs(de))/(next.F/60);}
 }
 pos=next;
}
const gcodeRows=[...motion.values()].sort((a,b)=>a.z-b.z).map(r=>({...r,length_mm:rr(r.length_mm),filament_mm:rr(r.filament_mm),extrusionSeconds:rr(r.extrusionSeconds),travelSeconds:rr(r.travelSeconds),feedLengths:Object.fromEntries(Object.entries(r.feedLengths).map(([k,v])=>[k,rr(v)]))}));
console.log('Gcode parsed',gcodeRows.length,'layers',lineNo,'lines');
const stage=path.join(project,'private-studio');
const {auditPaths}=await import(pathToFileURL(path.join(stage,'engine/path-audit.mjs')));
const lower=Number(process.argv[4]||128),selected=data.layers.filter(l=>l.zTop>=lower-.2);
console.log('Bounded nominal audit starts',selected[0].zTop,selected.at(-1).zTop,selected.length);
const nominal=auditPaths({...data,layers:selected});
const result={at:new Date().toISOString(),source,file,sha256:hash.digest('hex'),scope:{nominalRange_mm:[selected[1].zTop,selected.at(-1).zTop],nominalMethod:nominal.definition,timing:'Commanded feed-limited lower bounds; excludes acceleration, firmware lookahead and heat-up. Travel/retraction time assigned to preceding extrusion layer. Actual completed print timing is unbound.',physical:'User reports latest Ender physical failure; photos not calibrated to Z and executed file hash unbound.'},summary:data.summary,transitions,geometry:rows,gcode:{rows:gcodeRows,speedLengths:Object.fromEntries([...speeds].map(([k,v])=>[k,rr(v)])),fan,temperature,dwells,totalExtrusionHours:rr(gcodeRows.reduce((s,r)=>s+r.extrusionSeconds,0)/3600),totalCommandedMotionHours:rr(gcodeRows.reduce((s,r)=>s+r.extrusionSeconds+r.travelSeconds,0)/3600),shortest:gcodeRows.slice().sort((a,b)=>a.extrusionSeconds+a.travelSeconds-b.extrusionSeconds-b.travelSeconds).slice(0,20)},nominal};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:out,sha256:result.sha256,transitions,extrusionHours:result.gcode.totalExtrusionHours,motionHours:result.gcode.totalCommandedMotionHours,shortest:result.gcode.shortest.slice(0,6),nominal:{PASS:nominal.PASS,findings:nominal.findings.length,first:nominal.findings.slice(0,8),worst:nominal.findings.slice().sort((a,b)=>b.run_mm-a.run_mm).slice(0,8)}}));
