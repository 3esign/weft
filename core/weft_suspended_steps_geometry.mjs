/* Suspended horizontal terraces, 2026-09-19.
 * Reuses the WEFT wall engine. Terrace footprints are fixed through their thickness:
 * a returning transverse line crosses the supporting wall, projects to both sides,
 * and changes its angular phase on each layer. No longitudinal terrace rail is emitted.
 * Experimental geometry, not a mechanical simulation or an assertion of printability.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, loadMachine, rr, resample } from './weft_cube_geometry.mjs';

const TAU = Math.PI * 2, N = 256;
const mix = (a,b,t) => a+(b-a)*t;
const ease = t => t*t*(3-2*t);
const rot = ([x,y],a) => [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const mod = (a,n) => ((a%n)+n)%n;
const shape = (kind,sx,sy,cx,cy,angle) => ({kind,sx,sy,cx,cy,angle});

export const COMPOSITIONS = {
 a2l: {name:'RAZMAK_A2L_H4',title:'RAZMAK',levels:4,patternLobes:4,
  wallCounts:[300,325,325,280],terraceLayers:12,
  tiers:[
   {kind:'square',sx:250,sy:230,c0:[0,0],c1:[0,0],angles:[0,5],w:3.4,pitch:5.2,web:'staple',cycle:['chord','web']},
   {kind:'hexagon',sx:204,sy:186,c0:[20,-8],c1:[12,8],angles:[15,45],w:3.0,pitch:4.5,web:'diagonal',cycle:['chord','web']},
   {kind:'square',sx:164,sy:132,c0:[-20,12],c1:[-10,0],angles:[-12,24],w:2.8,pitch:4.0,web:'sine',cycle:['chord','web']},
   {kind:'circle',sx:88,sy:82,c0:[12,-6],c1:[0,0],angles:[10,70],w:2.6,pitch:3.2,web:'eight',cycle:['chord','web','web']}
  ]},
 ender: {name:'OBRTAJ_ENDER_H7',title:'OBRTAJ',levels:7,patternLobes:7,
  wallCounts:[160,155,150,145,135,130,128],terraceLayers:12,
  tiers:[
   {kind:'square',sx:141,sy:139,c0:[0,0],c1:[0,0],angles:[0,12],w:3.2,pitch:5.2,web:'staple',cycle:['chord','web']},
   {kind:'hexagon',sx:150,sy:146,c0:[8,0],c1:[4,4],angles:[0,30],w:2.8,pitch:4.5,web:'sine',cycle:['chord','chord','web']},
   {kind:'circle',sx:132,sy:118,c0:[-9,7],c1:[-5,0],angles:[20,-10],w:2.8,pitch:4.8,web:'diagonal',cycle:['chord','web']},
   {kind:'square',sx:118,sy:96,c0:[8,8],c1:[4,2],angles:[-15,20],w:2.6,pitch:3.6,web:'eight',cycle:['chord','web','web']},
   {kind:'hexagon',sx:104,sy:98,c0:[-7,-4],c1:[-4,0],angles:[30,0],w:2.6,pitch:4.6,web:'staple',cycle:['chord','web']},
   {kind:'circle',sx:82,sy:78,c0:[6,-2],c1:[3,0],angles:[0,60],w:2.6,pitch:4.0,web:'diagonal',cycle:['chord','web']},
   {kind:'hexagon',sx:64,sy:64,c0:[0,0],c1:[0,0],angles:[15,45],w:2.6,pitch:3.2,web:'sine',cycle:['chord','web']}
  ]}
};

function unitRadius(kind,t) {
 if(kind==='circle') return 1;
 if(kind==='square') return (Math.abs(Math.cos(t))**6+Math.abs(Math.sin(t))**6)**(-1/6);
 // A lightly rounded regular hexagon; averaging its radial function smooths the corners.
 const r = a => Math.cos(Math.PI/6)/Math.cos(mod(a+Math.PI/6,Math.PI/3)-Math.PI/6);
 return (r(t-.045)+2*r(t)+r(t+.045))/4;
}
export function point(s,t) {
 const r=unitRadius(s.kind,t),q=rot([s.sx*.5*r*Math.cos(t),s.sy*.5*r*Math.sin(t)],s.angle*Math.PI/180);
 return [q[0]+s.cx,q[1]+s.cy];
}
function normal(s,t) {const a=point(s,t-.0001),b=point(s,t+.0001),dx=b[0]-a[0],dy=b[1]-a[1],h=Math.hypot(dx,dy);return [dy/h,-dx/h];}
function offsetPoint(s,t,d) {const p=point(s,t),n=normal(s,t);return [p[0]+d*n[0],p[1]+d*n[1]];}
function contour(s,w,e,web,pitch,label,phase=0) {
 const pts=Array.from({length:N},(_,i)=>point(s,TAU*i/N)),cum=[0];
 for(let i=0;i<N;i++)cum.push(cum[i]+Math.hypot(pts[i][0]-pts[(i+1)%N][0],pts[i][1]-pts[(i+1)%N][1]));
 const P=cum[N],K=Math.max(24,Math.ceil(P/pitch/4)*4);
 const nodes=Array.from({length:K},(_,i)=>mod((i+phase)*P/K,P)).sort((a,b)=>a-b);
 return record(pts,true,nodes,w,e,web,P/4,0,label,0);
}
function inside(s,x,y) {
 const q=rot([x-s.cx,y-s.cy],-s.angle*Math.PI/180),a=q[0]/(s.sx*.5),b=q[1]/(s.sy*.5);
 return Math.hypot(a,b)<=unitRadius(s.kind,Math.atan2(b,a));
}
function ray(s,t) {
 if(!inside(s,0,0))throw Error('terrace shapes must contain the common polar origin');
 let lo=0,hi=500;const c=Math.cos(t),q=Math.sin(t);
 for(let i=0;i<30;i++){const m=(lo+hi)/2;if(inside(s,m*c,m*q))lo=m;else hi=m;}
 return (lo+hi)/2;
}
function globalRail(s,t,d) {
 const r=ray(s,t),p=[r*Math.cos(t),r*Math.sin(t)];
 // Recover the local ellipse parameter to offset along the same normal as the wall engine.
 const q=rot([p[0]-s.cx,p[1]-s.cy],-s.angle*Math.PI/180),u=Math.atan2(q[1]/s.sy,q[0]/s.sx),n=normal(s,u);
 return [p[0]+n[0]*d,p[1]+n[1]*d];
}
function addLayer(layers,LH,phase,contours=[],paths=[],extra={}) {const k=layers.length;layers.push({k,zBot:rr(k*LH,4),zTop:rr((k+1)*LH,4),phase,contours,paths,...extra});}
function wallShape(tier,t){const f=ease(t);return shape(tier.kind,tier.sx,tier.sy,mix(tier.c0[0],tier.c1[0],f),mix(tier.c0[1],tier.c1[1],f),mix(tier.angles[0],tier.angles[1],f));}

function terracePaths(previous,next,w,nextW,limit,first,machine) {
 const support=contour(previous,w,0,'staple',4.0,'support');
 const cache=new Map();
 const radii=t=>{const key=rr(mod(t,TAU),10);if(cache.has(key))return cache.get(key);
  const a=ray(previous,t),b=ray(next,t),lim=ray(limit,t);
  const inner=Math.max(5,Math.min(a-w/2,b-nextW/2)-1.1);
  const flare=machine==='a2l'?8+3*Math.cos(4*t):6+2*Math.cos(3*t);
  const outer=first?lim:Math.min(lim,Math.max(a+w/2,b+nextW/2)+flare);
  if(outer<Math.max(a+w/2,b+nextW/2)+.3)throw Error('terrace has no room for its wall');
  const result={inner,outer};cache.set(key,result);return result;
 };
 // Returning arcs need their own room at the inner edge, not just on the supporting wall.
 let innerSpeed=Infinity;
 for(let i=0;i<720;i++){const t=TAU*i/720,h=.0001,a=radii(t-h).inner,b=radii(t+h).inner;
  innerSpeed=Math.min(innerSpeed,Math.hypot(b*Math.cos(t+h)-a*Math.cos(t-h),b*Math.sin(t+h)-a*Math.sin(t-h))/(2*h));}
 const K=Math.max(24,Math.min(Math.ceil(support.total/4.0/4)*4,Math.floor(innerSpeed*TAU/2.7/4)*4));
 const make=phase=>{
  const pts=[],put=q=>pts.push(q),rad=(t,which)=>{const r=radii(t)[which];return [r*Math.cos(t),r*Math.sin(t)];};
  const turn=(t,which)=>{
   const tip=rad(t,which),a=rad(t-.0001,which),b=rad(t+.0001,which),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),T=[dx/len,dy/len],O=[T[1],-T[0]];
   const sign=which==='outer'?1:-1,r=.58,C=[tip[0]-sign*r*O[0],tip[1]-sign*r*O[1]];
   for(let j=0;j<=10;j++){const u=Math.PI*j/10;put([C[0]-r*Math.cos(u)*T[0]+sign*r*Math.sin(u)*O[0],C[1]-r*Math.cos(u)*T[1]+sign*r*Math.sin(u)*O[1]]);}
  };
  for(let j=0;j<K;j++){
   const t=TAU*(j+phase)/K,dt=TAU/K;
   if(j===0)put(globalRail(previous,t,w/2));
   turn(t+dt*.25,'inner');put(globalRail(previous,t+dt*.5,w/2));
   turn(t+dt*.75,'outer');put(globalRail(previous,t+dt,w/2));
  }
  return resample(pts,.48).map(p=>p.map(x=>rr(x,4)));
 };
 // Quarter-cell starts reach cardinal axes; a QUARTER-cell change creates crossings.
 // A half-cell change merely swaps inside/outside wedges and leaves no interior crossings.
 return {paths:[make(.25),make(.5)],cells:K,radii,support:previous,target:next};
}

// Serpentine chords connected by short walks on a closed boundary, never by a void travel.
function grid(s,w,pitch,angle,phase) {
 const rail=Array.from({length:N},(_,i)=>rot(offsetPoint(s,TAU*i/N,w/2),-angle)),cum=[0];
 for(let i=0;i<N;i++)cum.push(cum[i]+Math.hypot(rail[i][0]-rail[(i+1)%N][0],rail[i][1]-rail[(i+1)%N][1]));
 const P=cum[N];
 const at=u=>{u=mod(u,P);let i=0;while(i<N-1&&cum[i+1]<u)i++;const f=(u-cum[i])/(cum[i+1]-cum[i]);return [mix(rail[i][0],rail[(i+1)%N][0],f),mix(rail[i][1],rail[(i+1)%N][1],f)];};
 const ys=rail.map(p=>p[1]),lo=Math.min(...ys),hi=Math.max(...ys),count=Math.max(2,Math.ceil((hi-lo)/pitch));
 const pts=[];let endU=null;
 for(let j=0;j<count;j++){
  const y=lo+(hi-lo)*(j+.5+phase*.18)/(count+.18),hits=[];
  for(let i=0;i<N;i++){const a=rail[i],b=rail[(i+1)%N];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)){const t=(y-a[1])/(b[1]-a[1]);hits.push({x:mix(a[0],b[0],t),u:mix(cum[i],cum[i+1],t)});}}
  hits.sort((a,b)=>a.x-b.x);if(hits.length<2)continue;
  const from=j%2?hits.at(-1):hits[0],to=j%2?hits[0]:hits.at(-1);
  if(endU!==null){let d=mod(from.u-endU,P);if(d>P/2)d-=P;const steps=Math.ceil(Math.abs(d)/.48);for(let k=1;k<=steps;k++)pts.push(at(endU+d*k/steps));}
  pts.push(...resample([[from.x,y],[to.x,y]],.48));endU=to.u;
 }
 return resample(pts,.48).map(p=>rot(p,angle).map(x=>rr(x,4)));
}
function artPath(s,lobes) {
 const R=Math.min(s.sx,s.sy)*.36,pts=[];
 for(let i=0;i<=1800;i++){const u=i/1800,t=TAU*4*u,r=2+(R-2)*u*(.86+.14*Math.cos(lobes*t));pts.push([s.cx+r*Math.cos(t),s.cy+r*Math.sin(t)]);}
 const spaced=[pts[0]];for(let i=1;i<pts.length;i++)if(i===pts.length-1||Math.hypot(pts[i][0]-spaced.at(-1)[0],pts[i][1]-spaced.at(-1)[1])>=.25)spaced.push(pts[i]);
 return resample(spaced,.48).map(p=>p.map(x=>rr(x,4)));
}

export function generateSuspendedSteps(options={}) {
 const m=loadMachine(options.machine),V=COMPOSITIONS[m.id];if(!V)throw Error('a2l or ender required');
 if(m.beadSource!=='measured'&&!options.allowAssumedBead)throw Error('Ender requires --allow-assumed-bead');
 const LH=m.lh,margin=15,limitXY=m.plate.map(x=>x-2*margin),heightCeiling=m.maxZ-margin;
 const layers=[],events=[],terraces=[],zones=[],walls=[];
 const limit=shape(m.id==='a2l'?'square':'circle',limitXY[0]-m.bead-.08,limitXY[1]-m.bead-.08,0,0,0);
 const base=wallShape(V.tiers[0],0),fw=V.tiers[0].w,foundation=[];
 const offsets=[-fw/2-.5,...Array.from({length:9},(_,i)=>fw/2+.4+i*.5)];
 for(const d of offsets){const pts=Array.from({length:N},(_,i)=>offsetPoint(base,TAU*i/N,d).map(x=>rr(x,3)));foundation.push([...pts,pts[0]]);}
 for(let i=0;i<96;i++){const t=TAU*i/96;foundation.push([offsetPoint(base,t,offsets[0]-.25),offsetPoint(base,t,offsets.at(-1)+.25)].map(p=>p.map(x=>rr(x,3))));}
 let webIndex=0;
 V.tiers.forEach((tier,ti)=>{
  const k0=layers.length,count=V.wallCounts[ti];events.push({k:k0,z:rr(k0*LH,3),event:'wall '+(ti+1)+' begins on '+(ti?'horizontal terrace':'basal frame')});
  for(let j=0;j<count;j++){
   const s=wallShape(tier,j/(count-1)),webPhase=(webIndex%2)*.5;
   const c=contour(s,tier.w,.65,tier.web,tier.pitch,'wall-'+(ti+1),webPhase);
   c.role=(j<4||j>=count-2)?'chord':tier.cycle[j%tier.cycle.length];if(c.role==='web')webIndex++;
   addLayer(layers,LH,'wall-'+(ti+1),[c]);
  }
  const end=wallShape(tier,1);walls.push({tier:ti+1,k0,k1:layers.length-1,z0:rr(k0*LH,3),z1:rr(layers.length*LH,3),...tier});
  if(ti<V.tiers.length-1){
   const nextTier=V.tiers[ti+1],next=wallShape(nextTier,0),k=layers.length,t=terracePaths(end,next,tier.w,nextTier.w,limit,ti===0,m.id);
   for(let j=0;j<V.terraceLayers;j++)addLayer(layers,LH,'horizontal-terrace-'+(ti+1),[],[{pts:t.paths[j%2],role:'bridge',closed:true,speed:16,label:'transverse-returning-weave',tile:0,intent:'horizontal-transverse-return/v1; constant annular footprint, alternating quarter-cell phase; outside return is an experimental counterweight'}],{terrace:ti+1,phaseCell:j%2*.25});
   const desc={name:'terrace-'+(ti+1),k0:k,k1:layers.length-1,z0:rr(k*LH,3),z1:rr(layers.length*LH,3),layers:V.terraceLayers,cells:t.cells,footprintConstant:true,longitudinalRails:false,process:'horizontal-transverse-return/v1',physicalStatus:'experimental',supportWall:end,nextWall:next};
   terraces.push(desc);zones.push({name:desc.name,z0:desc.z0,z1:desc.z1+2*LH,longestChord_mm:180});events.push({k,z:desc.z0,event:desc.name+'; transverse return; alternate phase every layer'});
  }
 });
 const last=V.tiers.at(-1),top=wallShape(last,1),roofStart=layers.length;
 const pitches=[10,10,10,10,5,5,5,5,2.5,2.5,2.5,2.5,1.2,1.2,1.2,1.2,m.bead*.9,m.bead*.9];
 pitches.forEach((pitch,j)=>{
  const c=contour(top,last.w,.65,'staple',3.2,'roof-rim');c.role='chord';
  addLayer(layers,LH,'crown-grid',[c],[{pts:grid(top,last.w,pitch,(j%2)*Math.PI/2,Math.floor(j/2)%2),role:'bridge',closed:false,speed:j<4?16:24,label:'alternating-grid-'+j,tile:0,intent:'crown-woven-grid-art/v1: X/Y on every successive layer, ending in crossing dense fill'}]);
 });
 const art=artPath(top,V.patternLobes);
 for(let j=0;j<7;j++)addLayer(layers,LH,'crown-art',[],[{pts:art,role:'bridge',closed:false,speed:22,label:V.patternLobes+'-fold-wave',tile:0,intent:'raised wave drawing on the already closed woven roof'}]);
 const H=rr(layers.length*LH,4);if(H>heightCeiling+.0001)throw Error('height exceeds 15 mm top clearance');
 zones.push({name:'closed-roof-and-art',z0:rr(roofStart*LH,4),z1:H,longestChord_mm:Math.max(top.sx,top.sy)+last.w});
 const summary={name:options.name||V.name,title:V.title,generator:'core/weft_suspended_steps_geometry.mjs',machine:m.id,machineLabel:m.label,H,totalLayers:layers.length,levels:V.levels,terraces,walls,events,
  boundingContract:{margin_mm:15,allowed_mm:[...limitXY,heightCeiling],coordinates:'machine-centred XY before emitter translation; Z starts at bed; deposited bead envelope is audited after emission'},
  principle:'A single basal perimeter carries all upper walls through fixed-footprint horizontal transverse-weave terraces; no interior bed-founded tubes.',
  roof:{process:'crown-woven-grid-art/v1',physicalStatus:'experimental',k0:roofStart,gridLayers:pitches.length,artLayers:7,patternLobes:V.patternLobes,pitches,closure:'alternating spanning grid followed by two dense crossed layers; raised wave drawn above; not asserted watertight'},
  gatePolicy:{bridge_mm:180,cantilever_mm:4.8,allow_mm:.6,evidencedBridge_mm:16.2,meaning:'admission of declared experiments only; returning loops can classify as bridges while acting mechanically as cantilevers'},
  experiments:{declaredBridgeCeiling_mm:180,evidencedBridge_mm:16.2,zones,protocol:'declared gate must pass; every finding at 16.2 mm must be in one of these specific horizontal terrace or roof zones; no wall-wide exemption'},
  args:{lh:LH,bead:m.bead,firstLayerBead:m.firstLayerBead,firstLayerSpeed:12,w:3.2,r0:50,K:96,altPhase:true,cycle:['chord','web'],maxbridge:180,maxcantilever:4.8,allow:.6,minanchor:.5,maxCapRadius:20,speed:32,bridgeSpeed:16,temp:m.temp,bed:m.bed,fan:100}}
 return {summary,foundation:{kind:'rings',paths:foundation},layers};
}

if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2),get=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
 const out=get('out');if(!out)throw Error('--out required');
 const g=generateSuspendedSteps({machine:get('machine'),name:get('name'),allowAssumedBead:args.includes('--allow-assumed-bead')});
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(g));
 console.log(JSON.stringify({name:g.summary.name,layers:g.layers.length,height:g.summary.H,levels:g.summary.levels,terraces:g.summary.terraces.map(t=>[t.name,t.z0,t.z1]),roof:g.summary.roof.k0},null,2));
}
