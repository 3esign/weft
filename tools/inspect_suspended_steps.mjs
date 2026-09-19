import fs from 'node:fs';
import path from 'node:path';
import {createWeftCore,layersFromGeometry} from '../core/weft_build.mjs';
const input=process.argv[2];if(!input)throw Error('geometry file required');
const G=JSON.parse(fs.readFileSync(input,'utf8')),W=createWeftCore();
const report=layersFromGeometry(W,G,{machine:G.summary.machine,name:G.summary.name});
const byPhase={};let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(const L of W.layers){
 const phase=G.layers.find(l=>Math.abs(l.zBot-L.zBot)<.00001)?.phase||'foundation';
 const group=byPhase[phase]??={paths:0,overlaps:0,samples:[]};group.paths++;group.overlaps+=L.ov.length;
 if(L.ov.length&&group.samples.length<3)group.samples.push({z:L.zBot,web:L.webType,role:L.role,ov:L.ov.length,points:L.ov.slice(0,2)});
 const r=L.bead/2;for(const p of L.pts){min[0]=Math.min(min[0],p.x-r);min[1]=Math.min(min[1],p.y-r);max[0]=Math.max(max[0],p.x+r);max[1]=Math.max(max[1],p.y+r);}min[2]=Math.min(min[2],L.zBot);max[2]=Math.max(max[2],L.zTop);
}
const out={name:G.summary.name,report,bounds:{min,max},phases:byPhase};
fs.writeFileSync(path.join(path.dirname(input),'THREAD_AUDIT.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify({name:out.name,bounds:out.bounds,overlaps:report.unintendedOverlaps,phases:byPhase},null,2));
const layers=W.layers.filter((L,i)=>L.source==='raw'||L.role==='adhesion'||Math.round(L.zBot/G.summary.args.lh)%8===0).map(L=>{
 const pts=[];let last=null;for(let i=0;i<L.pts.length;i++){const p=L.pts[i];if(!last||i===L.pts.length-1||Math.hypot(p.x-last.x,p.y-last.y)>=.8){pts.push([+p.x.toFixed(2),+p.y.toFixed(2)]);last=p;}}
 return {z:L.zTop,role:L.role,phase:G.layers.find(g=>Math.abs(g.zBot-L.zBot)<.00001)?.phase||'foundation',pts};
});
fs.writeFileSync(path.join(path.dirname(input),'preview-paths.json'),JSON.stringify({name:G.summary.name,height:G.summary.H,limits:G.summary.boundingContract.allowed_mm,terraces:G.summary.terraces.map(t=>({name:t.name,z0:t.z0,z1:t.z1})),scope:'Actual emitted XY paths, visual sampling of walls every eighth layer and points at approximately 0.8 mm; not a physical image.',layers}));
