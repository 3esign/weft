// Stream the existing core's exact ribbon facets, avoiding a second all-model mesh in memory.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWeftCore,layersFromGeometry} from '../core/weft_build.mjs';
export async function streamStl(W,out){
 const all=W.layers,fd=fs.openSync(out,'w'),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 let triangles=0;fs.writeSync(fd,Buffer.alloc(84));
 try{for(const L of all){L.geo=W.ribbon(L.pts,(L.bead||W.P.bead)/2,L.zBot,L.zTop);if(!L.geo)continue;
  for(let i=0;i<L.geo.pos.length;i+=3){const q=[L.geo.pos[i],L.geo.pos[i+2],L.geo.pos[i+1]];for(let j=0;j<3;j++){min[j]=Math.min(min[j],q[j]);max[j]=Math.max(max[j],q[j]);}}
  W.layers=[L];const parts=await W.buildSTLParts();triangles+=new DataView(parts[0]).getUint32(80,true);for(const p of parts.slice(1))fs.writeSync(fd,Buffer.from(p));delete L.geo;
 }const head=Buffer.alloc(84);head.writeUInt32LE(triangles,80);fs.writeSync(fd,head,0,84,0);
 }finally{fs.closeSync(fd);W.layers=all;}
 const bytes=fs.statSync(out).size;if(bytes!==84+50*triangles)throw Error('STL facet count/length mismatch');
 return {triangles,bytes,bounds:{min,max},method:'Unmodified WEFT ribbon and buildSTLParts, streamed one emitted path at a time. Nominal bead geometry, not a Boolean-unioned solid. STL is a reference; ordered WEFT printing uses the provided G-code.'};
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
 const input=path.resolve(process.argv[2]),G=JSON.parse(fs.readFileSync(input,'utf8')),W=createWeftCore();layersFromGeometry(W,G,{machine:G.summary.machine,name:G.summary.name});
 const out=path.join(path.dirname(input),G.summary.name+'_reference.stl'),result=await streamStl(W,out);fs.writeFileSync(path.join(path.dirname(input),'STL_AUDIT.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({out,...result}));
}
