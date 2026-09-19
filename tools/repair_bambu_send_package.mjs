// G-668: new package revision; never regenerate or alter the validated G-code.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {zipRead,zipWrite,WEFT_ROOT} from '../core/weft_build.mjs';
import {makeBambuThumbnails,auditBambuThumbnails} from '../core/weft_bambu_thumbnails.mjs';
const dir=path.join(WEFT_ROOT,'specimens/2026-09-19_RAZMAK_A2L_H4_experimental');
const receipt=JSON.parse(fs.readFileSync(path.join(dir,'DELIVERY_MANIFEST.json')));
const source=path.join(dir,receipt.printFile),oldBytes=fs.readFileSync(source);
const sha=b=>createHash('sha256').update(b).digest('hex');
if(sha(oldBytes)!==receipt.files[receipt.printFile].sha256)throw Error('source differs from frozen delivery');
const original=zipRead(oldBytes),gc=original.find(e=>e.name==='Metadata/plate_1.gcode');
const oldGateFile=path.join(dir,'RAZMAK_A2L_H4_package_gate.json'),oldGate=JSON.parse(fs.readFileSync(oldGateFile));
if(!oldGate.PASS||oldGate.inputSha256!==sha(oldBytes))throw Error('missing final-package support gate identity');
if(sha(fs.readFileSync(oldGateFile))!==receipt.files[path.basename(oldGateFile)].sha256)throw Error('gate differs from frozen delivery');
const outputDir=path.join(dir,'SEND_PRINT_FIX'),out=path.join(outputDir,'RAZMAK_A2L_H4_SEND_FIXED.gcode.3mf');
if(fs.existsSync(out)||fs.existsSync(path.join(outputDir,'manifest.json')))throw Error('revision already exists');
fs.mkdirSync(outputDir,{recursive:true});
const reportImage=fs.readFileSync(path.join(dir,'RAZMAK_A2L_H4_preview.png')),thumbs=makeBambuThumbnails(reportImage);
const entries=original.map(e=>({...e,data:thumbs[e.name]||e.data,store:e.name.endsWith('.png')}));
const preflight=auditBambuThumbnails(entries);if(!preflight.PASS)throw Error(JSON.stringify(preflight));
const pending=out+'.PENDING';fs.writeFileSync(pending,zipWrite(entries));
const finalBytes=fs.readFileSync(pending),final=zipRead(finalBytes),changed=[];
if(final.length!==original.length)throw Error('member count changed');
for(const e of original){
  const match=final.find(x=>x.name===e.name);if(!match)throw Error('missing member '+e.name);
  if(!match.data.equals(e.data)){changed.push(e.name);if(!thumbs[e.name])throw Error('non-image bytes changed: '+e.name);}
}
const finalGc=final.find(e=>e.name==='Metadata/plate_1.gcode');
if(!gc.data.equals(finalGc.data))throw Error('executable payload changed');
const md5=createHash('md5').update(finalGc.data).digest('hex');
if(final.find(e=>e.name==='Metadata/plate_1.gcode.md5').data.toString().trim().toLowerCase()!==md5)throw Error('MD5 mismatch');
const imageAudit=auditBambuThumbnails(final),firstLayer=globalThis.WEFT_GATE.firstLayerAudit(finalGc.data.toString());
if(!imageAudit.PASS||!firstLayer.PASS)throw Error('final image/first-layer check failed');
const result={schema:'weft-bambu-send-repair/v1',date:new Date().toISOString(),status:'DIGITALLY VERIFIED / native Send Print confirmation pending',
  input:{file:path.basename(source),sha256:sha(oldBytes)},output:{file:path.basename(out),sha256:sha(finalBytes),bytes:finalBytes.length},
  changedMembers:changed,gcode:{byteIdentical:true,bytes:finalGc.data.length,sha256:sha(finalGc.data),md5},firstLayer,imageAudit,
  physicalGate:{reusedByExactExtractedPayloadIdentity:true,source:'../'+path.basename(oldGateFile),sourceSha256:sha(fs.readFileSync(oldGateFile)),PASS:oldGate.PASS,problems:oldGate.problem_count,checkedPoints:oldGate.stats.checked_points,reason:'Only five PNG members changed. All other extracted members, including every G-code byte, are identical to the independently gated original package.'},
  caveat:'No native app interaction, upload or print was performed. The safe upstream index reproduction is not a crash dump. Auxiliary slots retain the previous single-filament display-proxy convention, not semantic object-picking or inspection maps.',
  code:Object.fromEntries(['core/weft_bambu_thumbnails.mjs','core/weft_build.mjs','tools/repair_bambu_send_package.mjs'].map(p=>[p,sha(fs.readFileSync(path.join(WEFT_ROOT,p)))]))};
fs.renameSync(pending,out);
for(const n of ['plate_1.png','plate_1_small.png'])fs.writeFileSync(path.join(outputDir,n),thumbs['Metadata/'+n]);
fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
