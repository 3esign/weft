// Same WEFT emission, header, packaging and gate functions; independent gate passes run concurrently.
// Candidate files retain a .PENDING suffix until ALL checks have finished and their input hashes agree.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {createWeftCore,layersFromGeometry,gcodeText,fixHeader,packBambu3mf,loadMachines,WEFT_ROOT,restoreHarvestedEndZ} from '../core/weft_build.mjs';
import {validateMembraneGeometry} from '../membrane_contract.mjs';
const input=path.resolve(process.argv[2]),dir=path.dirname(input),G=JSON.parse(fs.readFileSync(input,'utf8')),S=G.summary,m=loadMachines()[S.machine];
if(!m||!['RAZMAK_A2L_H4','OBRTAJ_ENDER_H7'].includes(S.name))throw Error('This builder is bounded to the suspended-step pair');
if(m.beadSource!=='measured'&&!process.argv.includes('--i-know-the-bead-is-a-guess'))throw Error('assumed bead acknowledgement required');
if(fs.existsSync(path.join(dir,'manifest.json'))||fs.existsSync(path.join(dir,'DELIVERY_MANIFEST.json')))throw Error('existing receipt: archive the prior iteration or use a new folder');
if(S.args.bead!==m.bead||S.args.lh!==m.lh)throw Error('geometry must use the machine-owned bead and layer height');
validateMembraneGeometry(G,{machine:S.machine,rootDir:WEFT_ROOT});
const W=createWeftCore(),report=layersFromGeometry(W,G,{machine:S.machine,name:S.name});
if(!report.fitsPlate)throw Error('does not fit machine');
for(const L of W.layers)if(L.ov.length){const k=Math.round(L.zBot/m.lh);if(k!==S.roof.k0+16&&k!==S.roof.k0+17)throw Error('unexpected same-layer overlap outside dense roof');}
let endOptions={};if(m.route==='bambu3mf'){
 const r=restoreHarvestedEndZ(fs.readFileSync(path.join(WEFT_ROOT,m.end),'utf8'),path.join(WEFT_ROOT,m.containerTemplate),S.H,m.maxZ);endOptions.footText=r.text;fs.writeFileSync(path.join(dir,'end-block.json'),JSON.stringify(r.receipt,null,2));
}
console.log(JSON.stringify({stage:'thread',name:S.name,paths:report.layers,metres:report.threadLength_m,overlaps:report.unintendedOverlaps}));
const fixed=fixHeader(await gcodeText(W,path.join(WEFT_ROOT,m.start),path.join(WEFT_ROOT,m.end),endOptions));
const gc=path.join(dir,S.name+'.gcode'),candidate=gc+'.PENDING';fs.writeFileSync(candidate,fixed.text);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=sha(fs.readFileSync(candidate));
const opts={bead:m.bead,maxbridge:180,maxcantilever:4.8,allow:.6,minanchor:.5,maxCapRadius:20,maxislands:1};
const jobs=[{name:'declared',input:candidate,finalPath:gc,output:path.join(dir,S.name+'_gate.json'),options:opts},{name:'evidenced',input:candidate,finalPath:gc,output:path.join(dir,S.name+'_gate_at_16.2mm.json'),options:{...opts,maxbridge:16.2}}];
let pk=null,three=null,threeCandidate=null,threeHash=null;
if(m.route==='bambu3mf'){
 three=path.join(dir,S.name+'.gcode.3mf');threeCandidate=three+'.PENDING';pk=packBambu3mf(fixed.text,path.join(WEFT_ROOT,m.containerTemplate),threeCandidate,{name:S.name+'.stl',layerHeight:m.lh,thumb:path.join(dir,S.name+'_preview.png')});threeHash=sha(fs.readFileSync(threeCandidate));
 jobs.push({name:'package',input:threeCandidate,finalPath:three,output:path.join(dir,S.name+'_package_gate.json'),options:opts,package:true});
}
console.log(JSON.stringify({stage:'candidates',gcodeBytes:fs.statSync(candidate).size,packageBytes:pk?.bytes,passes:jobs.length}));
const started=Date.now();
await Promise.all(jobs.map(job=>new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./gate_file_worker.mjs',import.meta.url),{workerData:job});let result=null;
 worker.on('message',r=>{result=r;console.log(JSON.stringify({stage:'gate',name:job.name,...r,seconds:Math.round((Date.now()-started)/1000)}));});worker.on('error',reject);worker.on('exit',code=>code||!result?reject(Error('gate worker failed '+job.name+' '+code)):resolve(result));
})));
const gate=JSON.parse(fs.readFileSync(jobs[0].output,'utf8')),evidenced=JSON.parse(fs.readFileSync(jobs[1].output,'utf8')),packed=three?JSON.parse(fs.readFileSync(jobs[2].output,'utf8')):null;
if(gate.inputSha256!==hash||evidenced.inputSha256!==hash||sha(fs.readFileSync(candidate))!==hash||(three&&(packed.inputSha256!==threeHash||sha(fs.readFileSync(threeCandidate))!==threeHash)))throw Error('candidate changed during validation');
if(evidenced.problems.length!==evidenced.problem_count)throw Error('truncated evidenced findings');
const byZone={},outside=[];for(const p of evidenced.problems){const zone=S.experiments.zones.find(z=>p.z>=z.z0-.01&&p.z<=z.z1+.01);if(zone)byZone[zone.name]=(byZone[zone.name]||0)+1;else outside.push(p);}
const full={file:gc,bodySha256:sha(fixed.text.replace(/^;.*$/gm,'').replace(/^M73 .*$/gm,'')),meaning:'Complete evidenced-ceiling gate, including every finding; input SHA binds the finalized candidate bytes.',findings:evidenced.problem_count,byZone,outsideDeclaredZones:outside.length,outside,gate:evidenced};
fs.writeFileSync(path.join(dir,S.name+'_gate_at_16.2mm_full.json'),JSON.stringify(full,null,2));
if(!gate.PASS||outside.length||(packed&&!packed.PASS))throw Error('final checks refused: declared='+gate.problem_count+', outside='+outside.length+', package='+(packed?.problem_count??0)+'; candidates remain PENDING');
fs.renameSync(candidate,gc);if(three)fs.renameSync(threeCandidate,three);
const reportName=S.name+'_report.json';
fs.writeFileSync(path.join(dir,reportName),JSON.stringify({report:{...report,gateAtEvidencedCeiling:{maxbridge_mm:16.2,findings:full.findings,byZone,outsideDeclaredZones:0}},geometry:S,builder:'tools/build_suspended_steps.mjs; existing WEFT functions, concurrent independent final-byte gates',gate:opts,header:fixed.stats,package:pk},null,2));
const shipped=[path.basename(gc),...(three?[path.basename(three)]:[])];
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({name:S.name,model:'suspended-horizontal-steps',built:new Date().toISOString(),machine:{id:S.machine,...m},geometry:path.basename(input),shipped,gate:path.basename(jobs[0].output),report:reportName,builder:'tools/build_suspended_steps.mjs',core:W.version,outcome:'NOT PRINTED / EXPERIMENTAL',seed:null,hashes:{[path.basename(gc)]:hash,...(three?{[path.basename(three)]:threeHash}:{})}},null,2));
console.log(JSON.stringify({stage:'done',name:S.name,shipped,gate:gate.PASS,findings:full.findings,byZone,outside:0,header:fixed.stats}));
