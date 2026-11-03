// Replace thumbnail entries only; demonstrate that every non-image byte is unchanged.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {root} from './design.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const {zipRead,zipWrite}=await import(pathToFileURL(path.join(root,'core/weft_build.mjs')));
const {makeBambuThumbnails,auditBambuThumbnails}=await import(pathToFileURL(path.join(root,'core/weft_bambu_thumbnails.mjs')));
const dir=path.join(here,'package'),file=path.join(dir,'LIRA_A2L.gcode.3mf');
const json=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const gate=json('LIRA_A2L_gate.json'),layers=json('LIRA_A2L_gate_layers.json'),pkg=json('LIRA_A2L_package_gate.json');
if(gate.PASS!==true||gate.problem_count!==0||layers.refuse!==false||layers.finding_count!==0||pkg.PASS!==true||pkg.problem_count!==0)throw Error('Refusing incomplete or failed package.');
const before=zipRead(fs.readFileSync(file)),replace=makeBambuThumbnails(fs.readFileSync(path.join(here,'thumbnail.png')));
const entries=before.map(e=>({...e,data:replace[e.name]||e.data}));
for(const [name,data]of Object.entries(replace))if(!entries.some(e=>e.name===name))entries.push({name,data});
const checked=auditBambuThumbnails(entries);if(!checked.PASS)throw Error(JSON.stringify(checked));
const packed=zipWrite(entries),after=zipRead(packed),changed=[];
for(const e of before){const b=after.find(x=>x.name===e.name);if(!b)throw Error('Lost '+e.name);if(!b.data.equals(e.data)){if(!replace[e.name])throw Error('Unexpected change '+e.name);changed.push(e.name);}}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync(file,packed);
const result={at:new Date().toISOString(),PASS:true,onlyThumbnailEntriesChanged:changed,nonImageEntriesByteIdentical:true,thumbnails:checked,packageSha256:sha(packed),gcodeSha256:sha(after.find(e=>e.name==='Metadata/plate_1.gcode').data)};
fs.writeFileSync(path.join(dir,'thumbnail-receipt.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
