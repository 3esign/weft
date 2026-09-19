// Independent, streaming check of the final object's deposited envelope and planar layers.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import {loadMachines,zipRead} from '../core/weft_build.mjs';
import {makeBambuThumbnails,auditBambuThumbnails} from '../core/weft_bambu_thumbnails.mjs';
const input=path.resolve(process.argv[2]),G=JSON.parse(fs.readFileSync(input,'utf8')),S=G.summary,dir=path.dirname(input),m=loadMachines()[S.machine];
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),file=path.join(dir,manifest.shipped.find(n=>n.endsWith('.gcode')));
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],phases={},zs=new Set(),issues=[];
const firstLayer=globalThis.WEFT_GATE.firstLayerAudit(fs.readFileSync(file,'utf8'));
if(!firstLayer.PASS)issues.push({kind:'first-layer',audit:firstLayer});
let X=0,Y=0,Z=0,E=0,F=1,absolute=true,absE=true,active=false,done=false,width=m.bead,filament=0,seconds=0,moves=0,peakTravelZ=0,role=null,lineNo=0;
for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){
 lineNo++;if(/^;\s*layer\s+\d+\s+/.test(line)){active=true;role=line.trim().split(/\s+/).at(-1);}
 if(active&&/^;.*(?:A2L end gcode|WEFT end)/.test(line)){active=false;done=true;}
 const wm=line.match(/^; LINE_WIDTH: ([\d.]+)/);if(wm)width=+wm[1];
 const code=line.split(';')[0].trim(),cmd=code.split(/\s+/)[0],d={};for(const p of code.matchAll(/([XYZEF])(-?\d*\.?\d+)/g))d[p[1]]=+p[2];
 if(cmd==='G90')absolute=true;if(cmd==='G91')absolute=false;if(cmd==='M82')absE=true;if(cmd==='M83')absE=false;
 if(cmd==='G92'){if(d.E!==undefined)E=d.E;continue;}
 if(cmd!=='G0'&&cmd!=='G1')continue;
 const x=d.X===undefined?X:absolute?d.X:X+d.X,y=d.Y===undefined?Y:absolute?d.Y:Y+d.Y,z=d.Z===undefined?Z:absolute?d.Z:Z+d.Z;
 const de=d.E===undefined?0:absE?d.E-E:d.E;if(d.E!==undefined)E=absE?d.E:E+d.E;if(d.F!==undefined)F=d.F;
 if(active){peakTravelZ=Math.max(peakTravelZ,z);seconds+=Math.hypot(x-X,y-Y,z-Z)/(F/60);
  if(de>0&&Math.hypot(x-X,y-Y)>1e-6){moves++;filament+=de;zs.add(z.toFixed(3));
   if(Math.abs(z-Z)>.0001)issues.push({kind:'nonplanar-extrusion',lineNo,Z,z});
   const k=Math.round(z/m.lh)-1,l=G.layers[k];if(!l||Math.abs(l.zTop-z)>.0006)issues.push({kind:'unexpected-Z',lineNo,z});
   const group=phases[l?.phase||'unknown']??={moves:0,zMin:Infinity,zMax:-Infinity};group.moves++;group.zMin=Math.min(group.zMin,z);group.zMax=Math.max(group.zMax,z);
   for(const p of [[X,Y],[x,y]]){min[0]=Math.min(min[0],p[0]-width/2);min[1]=Math.min(min[1],p[1]-width/2);max[0]=Math.max(max[0],p[0]+width/2);max[1]=Math.max(max[1],p[1]+width/2);}min[2]=Math.min(min[2],z-m.lh);max[2]=Math.max(max[2],z);
  }
 }
 X=x;Y=y;Z=z;
}
const margins={left:min[0],right:m.plate[0]-max[0],front:min[1],back:m.plate[1]-max[1],above:m.maxZ-max[2]};
if(Object.values(margins).some(x=>x<14.999))issues.push({kind:'15-mm-margin',margins});
if(zs.size!==G.layers.length)issues.push({kind:'layer-count',actual:zs.size,expected:G.layers.length});
if(peakTravelZ>m.maxZ)issues.push({kind:'travel-Z',peakTravelZ});
if(!done)issues.push({kind:'end-marker-missing'});
const expectedFooterZ=S.H+(S.machine==='a2l'?.4:5);
if(Math.abs(Z-expectedFooterZ)>.001||Z>m.maxZ)issues.push({kind:'footer-explicit-Z',actual:Z,expected:expectedFooterZ});
const thread=JSON.parse(fs.readFileSync(path.join(dir,'THREAD_AUDIT.json'),'utf8'));
for(const [phase,row] of Object.entries(thread.phases))if(phase!=='crown-grid'&&row.overlaps)issues.push({kind:'unexpected-self-overlap',phase,count:row.overlaps});
const stl=JSON.parse(fs.readFileSync(path.join(dir,'STL_AUDIT.json'),'utf8'));
for(let i=0;i<2;i++)if(stl.bounds.min[i]<-S.boundingContract.allowed_mm[i]/2-.001||stl.bounds.max[i]>S.boundingContract.allowed_mm[i]/2+.001)issues.push({kind:'STL-margin',axis:i});
const hash=async p=>{const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(p))h.update(b);return h.digest('hex');};
const fullPath=path.join(dir,S.name+'_gate_at_16.2mm_full.json');let exhaustive=null;
if(fs.existsSync(fullPath)){
 const f=JSON.parse(fs.readFileSync(fullPath,'utf8')),txt=fs.readFileSync(file,'utf8');
 const bodySha256=crypto.createHash('sha256').update(txt.replace(/^;.*$/gm,'').replace(/^M73 .*$/gm,'')).digest('hex');
 if(f.bodySha256!==bodySha256||f.findings!==f.gate.problems.length||f.outsideDeclaredZones!==0)issues.push({kind:'exhaustive-gate-identity-or-zones'});
 exhaustive={bodySha256,findings:f.findings,byZone:f.byZone,outside:f.outsideDeclaredZones};
}
const packageFile=path.join(dir,manifest.shipped.find(n=>n.endsWith('.gcode.3mf'))||'NO_PACKAGE');let packaged=null;
if(fs.existsSync(packageFile)){
 const entries=zipRead(fs.readFileSync(packageFile)),gc=entries.find(e=>e.name==='Metadata/plate_1.gcode'),md5=entries.find(e=>e.name==='Metadata/plate_1.gcode.md5');
 const digest=crypto.createHash('md5').update(gc.data).digest('hex');if(md5.data.toString().trim().toLowerCase()!==digest)issues.push({kind:'package-MD5'});
 const thumbs=makeBambuThumbnails(fs.readFileSync(path.join(dir,S.name+'_preview.png')));const previews=entries.filter(e=>/^Metadata\/(plate_1|plate_1_small|plate_no_light_1|top_1|pick_1)\.png$/.test(e.name));
 if(previews.length!==5||previews.some(e=>!e.data.equals(thumbs[e.name])))issues.push({kind:'stale-package-thumbnail'});
 const thumbnailAudit=auditBambuThumbnails(entries);if(!thumbnailAudit.PASS)issues.push({kind:'package-thumbnail-contract',audit:thumbnailAudit});
 const end=JSON.parse(fs.readFileSync(path.join(dir,'end-block.json'),'utf8'));if(!gc.data.toString().includes('G1 Z'+end.newZ+' F900 ; lower z a little'))issues.push({kind:'package-end-Z'});
 const packedFirstLayer=globalThis.WEFT_GATE.firstLayerAudit(gc.data.toString('utf8'));if(!packedFirstLayer.PASS)issues.push({kind:'package-first-layer',audit:packedFirstLayer});
 packaged={md5:digest,thumbnailEntries:previews.length,footerZ:end.newZ,sha256:await hash(packageFile),firstLayer:packedFirstLayer};
}
const result={PASS:issues.length===0,name:S.name,scope:'Object moves after the first WEFT layer marker and before the harvested footer. Printer preparation and opaque firmware macros are outside this geometric envelope audit.',boundingBox_mm:{min,max},margins_mm:margins,layers:zs.size,extrudingMoves:moves,peakObjectTravelZ_mm:peakTravelZ,objectFilament_m:+(filament/1000).toFixed(3),objectEstimatedMass_g:+(filament*Math.PI*(1.75/2)**2*1.26/1000).toFixed(2),objectKinematicTime_h:+(seconds/3600).toFixed(3),estimateCaveat:'1.75 mm filament, assumed 1.26 g/cm3; no acceleration/heating/macros/wait time or physical weighing. Time is only a kinematic lower bound.',phases,sameLayerOverlapReading:{wallTerraceArt:0,denseCrownFill:thread.phases['crown-grid'].overlaps,meaning:'Only the final two dense roof fill layers have intentionally adjacent overlapping beads; raw engine report calls these unintendedOverlaps. No overlap findings hidden.'},stlBounds:stl.bounds,sha256:await hash(file),packaged,exhaustive,issues};
result.lastExplicitNozzleZ_mm=Z;
result.firstLayer=firstLayer;
fs.writeFileSync(path.join(dir,'FINAL_AUDIT.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(issues.length)process.exitCode=1;
