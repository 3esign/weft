import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createWeftCore,writeStl} from '../core/weft_build.mjs';
import {streamStl} from '../tools/export_suspended_steps_stl.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weft-stream-stl-')),a=path.join(dir,'a.stl'),b=path.join(dir,'b.stl'),W=createWeftCore();
W.layers=[{pts:[{x:0,y:0},{x:4,y:0},{x:4,y:5}],bead:.45,zBot:0,zTop:.24},{pts:[{x:4,y:5},{x:2,y:2},{x:0,y:0}],bead:.45,zBot:.24,zTop:.48}];
try{await writeStl(W,a);const r=await streamStl(W,b);assert.deepEqual(fs.readFileSync(a),fs.readFileSync(b));assert.equal(r.bytes,84+r.triangles*50);assert.equal(W.layers.length,2);console.log('PASS streamed STL byte-identical to core exporter, including winding and layer order');}finally{for(const f of [a,b])if(fs.existsSync(f))fs.unlinkSync(f);fs.rmdirSync(dir);}
