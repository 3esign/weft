import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const STATUSES=new Set(['qualified','experimental','failed']);

function inside(root,target){
  const rel=path.relative(root,target);
  return rel===''||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));
}

function regularInside(root,value,label){
  if(typeof value!=='string'||!value.trim())
    throw new Error(`${label} path is missing`);
  const logical=path.resolve(root,value);
  let real;
  try{ real=fs.realpathSync(logical); }
  catch{ throw new Error(`${label} is not an existing regular file: ${logical}`); }
  if(!inside(root,real))
    throw new Error(`${label} must stay inside WEFT root: ${real}`);
  if(!fs.statSync(real).isFile())
    throw new Error(`${label} is not an existing regular file: ${real}`);
  return real;
}

function sha256File(file){
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function membranePathSha256(points){
  if(!Array.isArray(points)||points.length<2||
     points.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(+p[0])||!Number.isFinite(+p[1])))
    throw new Error('membrane cap requires at least two finite XY points');
  const canonical=points.map(p=>[+p[0],+p[1]]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function validateQualificationReceipt(cp,geometry,{root,machine,processName,span,pathSha}){
  const receiptPath=regularInside(root,cp.evidence,'qualified membrane evidence');
  let receipt;
  try{ receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8')); }
  catch{ throw new Error(`qualified membrane evidence is not valid JSON: ${receiptPath}`); }
  const args=geometry.summary&&geometry.summary.args||{};
  const bead=Number(args.bead), layer=Number(args.lh);
  const machineId=machine||geometry.summary&&geometry.summary.machine;
  const mismatch=[];
  if(receipt.schema!=='weft.membrane-qualification.v1') mismatch.push('schema');
  if(receipt.decision!=='qualified'||receipt.observed!=='pass') mismatch.push('physical decision');
  if(receipt.process!==processName) mismatch.push('process');
  if(Math.abs(Number(receipt.span_mm)-span)>1e-9) mismatch.push('span_mm');
  if(receipt.path_sha256!==pathSha) mismatch.push('path_sha256');
  if(!machineId||receipt.machine!==machineId) mismatch.push('machine');
  if(!Number.isFinite(bead)||Math.abs(Number(receipt.bead_mm)-bead)>1e-9) mismatch.push('bead_mm');
  if(!Number.isFinite(layer)||Math.abs(Number(receipt.layer_height_mm)-layer)>1e-9) mismatch.push('layer_height_mm');
  if(mismatch.length)
    throw new Error(`qualified membrane receipt does not bind this cap: ${mismatch.join(', ')}`);
  if(!/^[0-9a-f]{64}$/i.test(receipt.artifact_sha256||''))
    throw new Error('qualified membrane receipt has no valid artifact_sha256');
  const artifact=regularInside(root,receipt.artifact,'qualified membrane artifact');
  const actual=sha256File(artifact);
  if(actual.toLowerCase()!==receipt.artifact_sha256.toLowerCase())
    throw new Error(`qualified membrane artifact hash mismatch: ${actual}`);
  regularInside(root,receipt.photos_manifest,'qualified membrane photo manifest');
}

export function validateMembraneGeometry(geometry,{rootDir,allowExperimental=false,machine}={}){
  if(!geometry||!Array.isArray(geometry.layers))
    throw new Error('membrane contract requires geometry.layers');
  const root=fs.realpathSync(path.resolve(rootDir||process.cwd()));
  const caps=[];
  for(const layer of geometry.layers){
    for(const contour of (layer.contours||[])){
      if(contour&&contour.role==='cap')
        throw new Error(`cap role at geometry layer ${layer.k} must use layer.caps and the membrane contract`);
    }
    for(const raw of (layer.paths||[])){
      if(raw&&raw.role==='cap')
        throw new Error(`cap role at geometry layer ${layer.k} must use layer.caps and the membrane contract`);
    }
    for(const cp of (layer.caps||[])){
      const z=layer.zBot;
      const processName=typeof cp.process==='string'?cp.process.trim():'';
      const status=cp.physicalStatus;
      const span=Number(cp.span_mm);
      const pathSha=membranePathSha256(cp.pts);
      if(!processName||!STATUSES.has(status)||!Number.isFinite(span)||span<=0)
        throw new Error(`membrane contract missing at z ${z}: require process, positive span_mm and physicalStatus (qualified|experimental|failed)`);
      if(status==='failed')
        throw new Error(`membrane process ${processName} at z ${z} / span ${span} mm is physically failed; evidence: ${cp.evidence||'not recorded'}`);
      if(status==='qualified'){
        if(typeof cp.evidence!=='string'||!cp.evidence.trim())
          throw new Error(`qualified membrane ${processName} at z ${z} has no evidence receipt`);
        validateQualificationReceipt(cp,geometry,{root,machine,processName,span,pathSha});
      }
      if(status==='experimental'&&!allowExperimental)
        throw new Error(`experimental membrane ${processName} at z ${z} requires --allow-experimental-membrane`);
      caps.push({z,span_mm:span,path_sha256:pathSha,process:processName,
        physicalStatus:status,evidence:cp.evidence??null});
    }
  }
  return caps;
}

export function freshReportPath(outDir,name){
  const report=path.join(path.resolve(outDir),`${name}_report.json`);
  if(fs.existsSync(report))
    throw new Error(`refusing to overwrite existing build report: ${report}; use a fresh specimen name`);
  return report;
}

export function writeJsonAtomic(file,value){
  const tmp=`${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp,JSON.stringify(value,null,2));
  fs.renameSync(tmp,file);
}
