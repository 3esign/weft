// Recover a tool-session interruption without regenerating the final candidate bytes.
// Parent discards the large geometry before independent workers allocate their gate grids.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {Worker} from 'node:worker_threads';
import {loadMachines,fixHeader,createWeftCore} from '../core/weft_build.mjs';
const input=path.resolve(process.argv[2]),dir=path.dirname(input);let G=JSON.parse(fs.readFileSync(input,'utf8'));const S=G.summary;G=null;
const repairFile=path.join(dir,'FIRST_LAYER_REPAIR.json'),stem=fs.existsSync(repairFile)?(JSON.parse(fs.readFileSync(repairFile,'utf8')).printStem||S.name):S.name;
const m=loadMachines()[S.machine],gc=path.join(dir,stem+'.gcode'),candidate=gc+'.PENDING',three=path.join(dir,stem+'.gcode.3mf'),packageCandidate=three+'.PENDING';
if(fs.existsSync(path.join(dir,'manifest.json')))throw Error('existing receipt; do not replace');
const hashFile=async file=>{const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const hash=await hashFile(candidate),hasPackage=m.route==='bambu3mf',packageHash=hasPackage?await hashFile(packageCandidate):null;
const opts={bead:m.bead,maxbridge:180,maxcantilever:4.8,allow:.6,minanchor:.5,maxCapRadius:20,maxislands:1};
const jobs=[{name:'declared',input:candidate,finalPath:gc,output:path.join(dir,S.name+'_gate.json'),options:opts},{name:'evidenced',input:candidate,finalPath:gc,output:path.join(dir,S.name+'_gate_at_16.2mm.json'),options:{...opts,maxbridge:16.2}}];
if(hasPackage)jobs.push({name:'package',input:packageCandidate,finalPath:three,output:path.join(dir,S.name+'_package_gate.json'),options:opts,package:true});
global.gc?.();const started=Date.now();console.log(JSON.stringify({stage:'resume',name:S.name,hash,packageHash,at:new Date().toISOString()}));
await Promise.all(jobs.map(job=>new Promise((resolve,reject)=>{
 if(fs.existsSync(job.output))try{const old=JSON.parse(fs.readFileSync(job.output,'utf8'));if(old.inputSha256===(job.package?packageHash:hash)&&Object.entries(job.options).every(([k,v])=>old.params[k]===v||['minanchor','maxCapRadius'].includes(k))&&old.problems.length===old.problem_count){console.log('reused complete byte-bound '+job.name);resolve();return;}}catch{}
 const worker=new Worker(new URL('./gate_file_worker.mjs',import.meta.url),{workerData:job,resourceLimits:{maxOldGenerationSizeMb:2048}});let delivered=false;
 worker.on('message',r=>{delivered=true;console.log(JSON.stringify({stage:'gate',name:job.name,...r,seconds:Math.round((Date.now()-started)/1000)}));});worker.on('error',reject);worker.on('exit',code=>code||!delivered?reject(Error('worker '+job.name+' exited '+code)):resolve());
})));
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),gate=read(jobs[0].output),evidenced=read(jobs[1].output),packed=hasPackage?read(jobs[2].output):null;
if(await hashFile(candidate)!==hash||(hasPackage&&await hashFile(packageCandidate)!==packageHash))throw Error('candidate changed during check');
if(evidenced.problems.length!==evidenced.problem_count)throw Error('truncated findings');
const byZone={},outside=[];for(const p of evidenced.problems){const z=S.experiments.zones.find(z=>p.z>=z.z0-.01&&p.z<=z.z1+.01);if(z)byZone[z.name]=(byZone[z.name]||0)+1;else outside.push(p);}
let text=fs.readFileSync(candidate,'utf8');const full={file:gc,bodySha256:sha(text.replace(/^;.*$/gm,'').replace(/^M73 .*$/gm,'')),meaning:'Complete independent evidenced gate, resumed on immutable candidate bytes after a tool-session interruption.',findings:evidenced.problem_count,byZone,outsideDeclaredZones:outside.length,outside,gate:evidenced};
fs.writeFileSync(path.join(dir,S.name+'_gate_at_16.2mm_full.json'),JSON.stringify(full,null,2));
if(!gate.PASS||outside.length||(packed&&!packed.PASS))throw Error('refused; candidates stay PENDING');
const header=fixHeader(text).stats;text=null;fs.renameSync(candidate,gc);if(hasPackage)fs.renameSync(packageCandidate,three);
const report=read(path.join(dir,'THREAD_AUDIT.json')).report,reportName=S.name+'_report.json';
fs.writeFileSync(path.join(dir,reportName),JSON.stringify({report:{...report,gateAtEvidencedCeiling:{maxbridge_mm:16.2,findings:full.findings,byZone,outsideDeclaredZones:0}},geometry:S,builder:'tools/build_suspended_steps.mjs; tools/resume_suspended_steps.mjs completed independent gates on unchanged pending bytes',gate:opts,header},null,2));
const shipped=[path.basename(gc),...(hasPackage?[path.basename(three)]:[])];
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({name:S.name,model:'suspended-horizontal-steps',built:new Date().toISOString(),machine:{id:S.machine,...m},geometry:path.basename(input),shipped,gate:path.basename(jobs[0].output),report:reportName,builder:'tools/build_suspended_steps.mjs + tools/resume_suspended_steps.mjs',core:createWeftCore().version,outcome:'NOT PRINTED / EXPERIMENTAL',seed:null,hashes:{[path.basename(gc)]:hash,...(hasPackage?{[path.basename(three)]:packageHash}:{})}},null,2));
console.log(JSON.stringify({stage:'done',name:S.name,shipped,findings:full.findings,byZone,outside:0,header}));
