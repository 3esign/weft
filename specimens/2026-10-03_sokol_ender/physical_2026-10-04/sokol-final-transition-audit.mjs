import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const project=process.argv[2],out=process.argv[3];
const file=path.join(project,'ZA_STAMPU/CREALITY_Ender3V4/SOKOL_V2c/SOKOL_V2_ENDER.gcode');
const target=[121.2,121.4,121.6],layers=new Map(target.map((z,i)=>[z,{k:605+i,zTop:z,paths:[],lineFirst:null,lineLast:null}]));
const hash=crypto.createHash('sha256'),stream=fs.createReadStream(file);stream.on('data',b=>hash.update(b));
let pos={X:0,Y:0,Z:0,E:0,F:600},relativeE=true,absolute=true,active=null,lineNo=0;
for await(const line of readline.createInterface({input:stream,crlfDelay:Infinity})){
 lineNo++;if(line==='G90')absolute=true;if(line==='G91')absolute=false;if(line==='M83')relativeE=true;if(line==='M82')relativeE=false;
 if(!/^G(?:0|1|92)\b/.test(line))continue;
 const v={};for(const m of line.split(';')[0].matchAll(/([XYZEF])\s*([-+\d.]+)/g))v[m[1]]=Number(m[2]);
 if(line.startsWith('G92')){Object.assign(pos,v);continue;}
 const next={...pos};for(const a of ['X','Y','Z'])if(v[a]!==undefined)next[a]=absolute?v[a]:pos[a]+v[a];if(v.F!==undefined)next.F=v.F;
 const de=v.E===undefined?0:relativeE?v.E:v.E-pos.E;next.E=relativeE?pos.E+de:(v.E??pos.E);
 const len=Math.hypot(next.X-pos.X,next.Y-pos.Y),l=layers.get(next.Z);
 if(l&&de>0&&len>1e-7&&next.Z===pos.Z){
  if(!active||active.layer!==l){const p={pts:[[pos.X,pos.Y]],lines:[],bead:.42,speed:next.F/60,role:'bridge'};l.paths.push(p);active={layer:l,path:p};}
  active.path.pts.push([next.X,next.Y]);active.path.lines.push(lineNo);l.lineFirst??=lineNo;l.lineLast=lineNo;
 }else if(len>1e-7||de<0||next.Z!==pos.Z)active=null;
 pos=next;
}
const geometry={summary:{args:{bead:.42,bridgeSpeed:18,maxbridge:12}},layers:[...layers.values()]};
const {auditPaths}=await import(pathToFileURL(path.join(project,'private-studio/engine/path-audit.mjs')));
const measured=auditPaths(geometry);
const distance=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],d=x*x+y*y,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/d)):0;return Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-y*t);};
const previous=geometry.layers[0],current=geometry.layers[1],grid=new Map();
for(const p of previous.paths)for(let i=1;i<p.pts.length;i++){const a=p.pts[i-1],b=p.pts[i],s={a,b,line:p.lines[i-1]};for(let x=Math.floor(Math.min(a[0],b[0])/2);x<=Math.floor(Math.max(a[0],b[0])/2);x++)for(let y=Math.floor(Math.min(a[1],b[1])/2);y<=Math.floor(Math.max(a[1],b[1])/2);y++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(s);}}
const near=p=>{let d=Infinity,line=null;const seen=new Set();for(let x=Math.floor((p[0]-.52)/2);x<=Math.floor((p[0]+.52)/2);x++)for(let y=Math.floor((p[1]-.52)/2);y<=Math.floor((p[1]+.52)/2);y++)for(const s of grid.get(x+','+y)||[])if(!seen.has(s)){seen.add(s);const n=distance(p,s.a,s.b);if(n<d){d=n;line=s.line;}}return {distance:d,line};};
const problems=[];
for(const p of current.paths){let run=0,first=null,last=null,firstSeg=null,lastSeg=null,leftAnchor=null,anchorSeen=false;
 const finish=(atEnd,rightAnchor)=>{const floating=!anchorSeen&&atEnd&&run>0,limit=floating?0:(!anchorSeen||atEnd)?3:12;if(floating||run>limit+.01)problems.push({kind:floating?'FLOATING':(!anchorSeen||atEnd)?'NOMINAL_CANTILEVER':'NOMINAL_BRIDGE',run_mm:+run.toFixed(3),limit_mm:limit,startLine:firstSeg?.line,endLine:lastSeg?.line,startXY:first,endXY:last,firstSegment:firstSeg,lastSegment:lastSeg,leftAnchor,rightAnchor});run=0;first=null;firstSeg=null;};
 for(let i=1;i<p.pts.length;i++){const a=p.pts[i-1],b=p.pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(len/.35));for(let j=0;j<n;j++){const t=(j+.5)/n,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],d=near(q);if(d.distance<=.4200001){const anchor={line:p.lines[i-1],XY:q,previousLayerLine:d.line,distance_mm:d.distance};finish(false,anchor);anchorSeen=true;leftAnchor=anchor;}else{run+=len/n;first??=q;last=q;firstSeg??={line:p.lines[i-1],a,b};lastSeg={line:p.lines[i-1],a,b};}}}
 finish(true,null);
}
const result={at:new Date().toISOString(),file,sha256:hash.digest('hex'),method:'Exact parsed final G0/G1 XY segments with relative/absolute E and positions. Nominal contact at midpoint samples <=0.35mm apart requires previous-Z segment within0.42mm (sum of half-beads), no0.6mm allowance. This does not measure real welds or prove photographed onset.',assumptions:{bead_mm:.42,beadSource:'ASSUMED inherited Ender profile',maxBridge_mm:12,maxCantilever_mm:3},layers:geometry.layers.map(l=>({k:l.k,z:l.zTop,pathCount:l.paths.length,segments:l.paths.reduce((s,p)=>s+p.pts.length-1,0),lineFirst:l.lineFirst,lineLast:l.lineLast})),nominal:measured,criticalLayer:{z:121.4,problemCount:problems.length,firstThree:problems.slice(0,3),longest:problems.slice().sort((a,b)=>b.run_mm-a.run_mm).slice(0,3)}};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({file:out,sha256:result.sha256,layers:result.layers,rows:measured.rows,findings:measured.findings.length,critical:result.criticalLayer},null,2));
