import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWeftCore,checkGcode,loadMachines,packBambu3mf,gcodeFrom3mf} from '../core/weft_build.mjs';
const {firstLayerAudit}=globalThis.WEFT_GATE;
const {wrapStartupPreview}=globalThis.WEFT_CORE;
const startup=fs.readFileSync(new URL('../exports/ender_start.gcode',import.meta.url),'utf8');
const body=`; CHANGE_LAYER
; Z_HEIGHT: 0.200
; LAYER_HEIGHT: 0.200
; layer 0 adhesion
; FEATURE: Brim
G1 Z0.2
G0 X40 Y40
G1 X60 E1
G1 Y60 E1
G1 X40 E1
G1 Y40 E1
; CHANGE_LAYER
; Z_HEIGHT: 0.400
; LAYER_HEIGHT: 0.200
; layer 1 wall
; FEATURE: Outer wall
G1 Z0.4
G1 X60 E1`;
const old=startup+'\n'+body;
const bad=firstLayerAudit(old);
assert.equal(bad.firstPreviewZ,.3);assert.equal(bad.firstModelZ,.2);assert.equal(bad.PASS,false);
assert.equal(checkGcode(old).PASS,false,'old phantom first layer is refused before support exemptions');
assert.throws(()=>packBambu3mf(old,'unused-template','must-not-exist.3mf'),/first layer refused/,'container packing refuses before reading a template or writing');
const corrected=wrapStartupPreview(startup)+'\n; WEFT_FIRST_LAYER_V1 Z=0.200 H=0.200\n'+body;
const audit=firstLayerAudit(corrected);
assert.equal(audit.PASS,true,JSON.stringify(audit));assert.equal(audit.firstPreviewZ,.2);assert.equal(audit.segments,4);assert.equal(audit.length_mm,80);
const commands=s=>s.split('\n').map(s=>s.split(';')[0].trim()).filter(Boolean).join('\n');
assert.equal(commands(corrected),commands(old),'no startup, purge or object machine commands changed');
for(const [label,text,kind] of [
 ['empty first layer',corrected.replace(/G1 [XY][^\n]* E1\n/g,''),'EMPTY_FIRST_MODEL_LAYER'],
 ['forgot wipe end',corrected.replace('; WIPE_END','; forgotten wipe end'),'HIDDEN_FIRST_LAYER_EXTRUSION'],
 ['forgot role reset',corrected.replace('; FEATURE: Brim','; FEATURE: Custom'),'HIDDEN_FIRST_LAYER_EXTRUSION'],
 ['wrong actual Z',corrected.replace('G1 Z0.2\nG0','G1 Z0.4\nG0'),'FIRST_LAYER_NOT_ON_BED'],
 ['missing first marker',corrected.replace('; layer 0 adhesion','; layer 1 adhesion'),'FIRST_PATH_NOT_ZERO'],
 ['empty logical layer',corrected.replace('; layer 0 adhesion','; CHANGE_LAYER\n; layer 0 adhesion'),'EMPTY_FIRST_MODEL_LAYER'],
 ['unmarked Z',corrected.replace('; Z_HEIGHT: 0.200','; omitted'),'FIRST_LAYER_NOT_ON_BED']
]){const r=firstLayerAudit(text);assert.equal(r.PASS,false,label);assert.ok(r.issues.some(x=>x.kind===kind),label+JSON.stringify(r));assert.equal(checkGcode(text).PASS,false,label);}
const abs=corrected.replace('M83','M82').replace('G1 X60 E1','G92 E0\nG1 X60 E1').replace('G1 Y60 E1','G1 Y60 E2').replace('G1 X40 E1','G1 X40 E3').replace('G1 Y40 E1','G1 Y40 E4');
assert.equal(firstLayerAudit(abs).length_mm,80,'M82 and G92 are decoded');
const nested=wrapStartupPreview(startup.replace('G1 Z0.3','; WIPE_START\n; WIPE_END\nG1 Z0.3'))+'\n'+body;
assert.equal(firstLayerAudit(nested).PASS,true,'inner harvested wipe end cannot expose a later purge');
for(const machine of ['ender','a2l']){
 const W=createWeftCore();W.setMachine(machine);Object.assign(W.P,{lh:machine==='ender'?.2:.24,flowBoost:1});
 const L={zBot:0,zTop:W.P.lh,role:'adhesion',pts:[{x:0,y:0},{x:10,y:0},{x:10,y:10}],apexes:[],closed:false};W.layers=[L];
 const text=await W.buildGcodeText(null,startup,'');assert.equal(firstLayerAudit(text).PASS,true,machine);
 for(const layers of [[],[{...L,zBot:.2,zTop:.4}],[{...L,pts:[]}],[{...L,pts:[{x:0,y:0},{x:0,y:0}]}]]){W.layers=layers;await assert.rejects(W.buildGcodeText(null,startup,''),/first layer|empty|invalid/i);}
}
console.log('PASS first-layer regression: reproduced Z0.30 ghost; unchanged machine commands; bed extrusion, hidden/empty/misnumbered layers, M82/G92, nested startup and both machine exporters checked');
