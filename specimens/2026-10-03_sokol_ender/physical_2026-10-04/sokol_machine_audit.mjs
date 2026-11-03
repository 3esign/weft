import fs from 'node:fs';
import crypto from 'node:crypto';
const file=process.argv[2];
if(!file)throw new Error('Expected final .gcode path');
const bytes=fs.readFileSync(file),text=bytes.toString('utf8');
let absolute=true,relativeE=false,units=1,pos={X:null,Y:null,Z:null,E:0},feed=0,model=false,seconds=0,dwell=0,extrudeMm=0,moves=0,retracts=0,bodySeconds=0;
const bbox={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},bodyBox={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},unknown=new Set(),modeTrace=[],temp=[],layers=new Set(),fan=[],layerStats=new Map();
let lineNo=0,maxExtrudingSpeed=0,maxVolumetric=0;
for(const raw of text.split(/\r?\n/)){
 lineNo++;if(raw.startsWith('; WEFT_FIRST_LAYER_V1'))model=true;if(raw.startsWith('; WEFT_MODEL_END'))model=false;
 const line=raw.split(';')[0].trim();if(!line)continue;
 const token=line.split(/\s+/)[0].toUpperCase(),d={};for(const match of line.matchAll(/(?:^|\s)([XYZEFSP])([-+]?\d*\.?\d+)/g))d[match[1]]=Number(match[2]);
 if(['G20','G21','G90','G91','M82','M83'].includes(token))modeTrace.push({line:lineNo,command:token,model});
 if(token==='G20'){units=25.4;continue;}if(token==='G21'){units=1;continue;}if(token==='G90'){absolute=true;continue;}if(token==='G91'){absolute=false;continue;}if(token==='M82'){relativeE=false;continue;}if(token==='M83'){relativeE=true;continue;}
 if(token==='G92'){for(const a of ['X','Y','Z','E'])if(a in d)pos[a]=d[a]*units;continue;}
 if(['M104','M109','M140','M190'].includes(token)){temp.push({line:lineNo,command:token,value:d.S});continue;}
 if(['M106','M107'].includes(token)){fan.push({line:lineNo,command:token,value:d.S});continue;}
 if(token==='G4'||token==='G04'){const t='S'in d?d.S:(d.P||0)/1000;dwell+=t;seconds+=t;if(model)bodySeconds+=t;continue;}
 if(!['G0','G00','G1','G01'].includes(token)){if(!/^[GM]\d+$/.test(token)&&!token.startsWith('SET_PRINT_STATS_INFO'))unknown.add(token);continue;}
 if('F'in d)feed=d.F*units;
 const next={...pos};for(const a of ['X','Y','Z'])if(a in d)next[a]=absolute?d[a]*units:(pos[a]??0)+d[a]*units;
 const de='E'in d?(relativeE?d.E*units:d.E*units-pos.E):0;next.E=pos.E+de;
 const xyz=['X','Y','Z'],known=xyz.every(a=>Number.isFinite(pos[a])&&Number.isFinite(next[a]));
 const length=known?Math.hypot(...xyz.map(a=>next[a]-pos[a])):0;
 const planar=known?Math.hypot(next.X-pos.X,next.Y-pos.Y):0;
 const distance=length>0?length:Math.abs(de),t=feed>0?distance/(feed/60):0;
 seconds+=t;if(model)bodySeconds+=t;moves++;
 if(de<0)retracts++;
 for(let i=0;i<3;i++)if(Number.isFinite(next[xyz[i]])){bbox.min[i]=Math.min(bbox.min[i],next[xyz[i]]);bbox.max[i]=Math.max(bbox.max[i],next[xyz[i]]);}
 if(model&&de>0&&planar>0){extrudeMm+=de;layers.add(next.Z);maxExtrudingSpeed=Math.max(maxExtrudingSpeed,feed/60);maxVolumetric=Math.max(maxVolumetric,de*Math.PI*(1.75/2)**2/(t||Infinity));for(let i=0;i<3;i++){bodyBox.min[i]=Math.min(bodyBox.min[i],next[xyz[i]]);bodyBox.max[i]=Math.max(bodyBox.max[i],next[xyz[i]]);}const l=layerStats.get(next.Z)||{z:next.Z,extrusionPath_mm:0,filament_mm:0,extrusionSeconds:0,segments:0};l.extrusionPath_mm+=length;l.filament_mm+=de;l.extrusionSeconds+=t;l.segments++;layerStats.set(next.Z,l);}
 pos=next;
}
const layerSummaries=[...layerStats.values()].sort((a,b)=>a.z-b.z);
const layerSpikes=layerSummaries.slice(1).flatMap((l,j)=>{const previous=layerSummaries[j],ratio=l.extrusionPath_mm/previous.extrusionPath_mm;return ratio>3&&l.extrusionSeconds>30?[{z:l.z,previousZ:previous.z,pathRatio:ratio,extrusionSeconds:l.extrusionSeconds,meaning:'Inspection heuristic, not an automatic physical-failure certificate.'}]:[];});
const result={schema:1,file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,commands:moves,firstLayerZ:Math.min(...layers),lastLayerZ:Math.max(...layers),physicalLayers:layers.size,modeTrace,temperatures:temp,fanCommands:fan,bodyBox,commandedBox:bbox,commandedIdealSeconds:seconds,bodyIdealSeconds:bodySeconds,dwellSeconds:dwell,extrudingFilament_mm:extrudeMm,estimatedModelMass_g_atAssumedDensity1_26:extrudeMm*Math.PI*(1.75/2)**2*.00126,maxExtrudingSpeed_mm_s:maxExtrudingSpeed,maxVolumetric_mm3_s:maxVolumetric,retractions:retracts,opaqueCommands:[...unknown],layerSummaries,layerSpikes,limitations:['Commanded ideal time omits acceleration, queue throughput, heating, homing and opaque macro internals. It includes literal dwell and E-only moves.','XY/Z bounds audit only visible literal commands, not firmware macros. Mass uses assumed 1.26 g/cm3 and commanded 1.75 mm filament.'],boundsPass:bbox.min[0]>=0&&bbox.min[1]>=0&&bbox.min[2]>=0&&bbox.max[0]<=220&&bbox.max[1]<=220&&bbox.max[2]<=235};
if(process.argv[3]){fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({file:result.file,sha256:result.sha256,boundsPass:result.boundsPass,idealMinutes:result.commandedIdealSeconds/60,physicalLayers:result.physicalLayers,bodyBox:result.bodyBox,layerSpikes:result.layerSpikes},null,2));}else console.log(JSON.stringify(result,null,2));
