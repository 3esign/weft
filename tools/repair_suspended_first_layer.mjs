// Comment-only migration of the two unprinted candidates. Prior receipts survive.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {loadMachines,packBambu3mf,WEFT_ROOT} from '../core/weft_build.mjs';
const input=path.resolve(process.argv[2]),dir=path.dirname(input),S=JSON.parse(fs.readFileSync(input,'utf8')).summary,m=loadMachines()[S.machine];
if(!['RAZMAK_A2L_H4','OBRTAJ_ENDER_H7'].includes(S.name))throw Error('bounded to this pair');
const archive=path.join(dir,'iterations/02_before_first_layer_guard');
if(fs.existsSync(path.join(dir,'FIRST_LAYER_REPAIR.json'))||fs.existsSync(path.join(dir,'DELIVERY_MANIFEST.json')))throw Error('repair/receipt already exists');
const oldGc=path.join(dir,S.name+'.gcode'),printStem=S.name+'_FIRST_LAYER_FIXED',gc=path.join(dir,printStem+'.gcode'),candidate=gc+'.PENDING',oldFile=fs.existsSync(oldGc)?oldGc:oldGc+'.PENDING';
const old=fs.readFileSync(oldFile,'utf8'),i=old.indexOf('; WEFT first layer:');if(i<0)throw Error('unknown WEFT boundary');
const fixed=globalThis.WEFT_CORE.wrapStartupPreview(old.slice(0,i))+
 '\n; WEFT_FIRST_LAYER_V1 Z='+m.lh.toFixed(3)+' H='+m.lh.toFixed(3)+'\n'+old.slice(i);
const audit=globalThis.WEFT_GATE.firstLayerAudit(fixed);if(!audit.PASS)throw Error(JSON.stringify(audit));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const commandHash=s=>{const h=crypto.createHash('sha256');for(const line of s.split('\n')){const cmd=line.split(';')[0].trim();if(cmd)h.update(cmd+'\n');}return h.digest('hex');};
const commands=commandHash(old);if(commands!==commandHash(fixed))throw Error('machine command changed');
fs.mkdirSync(archive,{recursive:true});
for(const n of fs.readdirSync(dir))if(fs.statSync(path.join(dir,n)).isFile()&&
 (n.includes('.gcode')||n=== 'manifest.json'||n==='FINAL_AUDIT.json'||n==='README.md'||n==='PROTOCOL.md'||n.includes('_gate')||n.includes('_report.json'))){
 const from=path.join(dir,n),to=path.join(archive,n+(n.includes('.gcode')?'.REJECTED':''));
 if(n.includes('.gcode'))fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);else fs.renameSync(from,to);
}
fs.writeFileSync(path.join(archive,'README.md'),'Superseded unprinted candidate. Archived before the shared first-layer preview correction. Printer commands are unchanged; comments are corrected and the final bytes must be gated again. Original immutable manifest is retained. Executable file extensions are suffixed REJECTED.\n');
fs.writeFileSync(candidate,fixed);
let packageHash=null;
if(m.route==='bambu3mf'){
 const three=gc+'.3mf.PENDING';packBambu3mf(fixed,path.join(WEFT_ROOT,m.containerTemplate),three,{name:S.name+'.stl',layerHeight:m.lh,thumb:path.join(dir,S.name+'_preview.png')});
 packageHash=sha(fs.readFileSync(three));
}
const receipt={at:new Date().toISOString(),printStem,oldSha256:sha(old),newSha256:sha(fixed),packageSha256:packageHash,commandsSha256:commands,commandsIdentical:true,oldAudit:globalThis.WEFT_GATE.firstLayerAudit(old),corrected:audit,meaning:'Comment-only change. Startup/purge remains executable and is shown as preparation/wipe, never as an extra model layer. Native slicer UI not operated. Old Ender file is locked in the user slicer and retained; use the distinctly named corrected file.'};
fs.writeFileSync(path.join(dir,'FIRST_LAYER_REPAIR.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({name:S.name,...receipt}));
