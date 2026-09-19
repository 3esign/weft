// Exhaustive evidenced-ceiling review, including findings beyond the legacy 400-row display cap.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {checkGcode} from '../core/weft_build.mjs';
const input=path.resolve(process.argv[2]),G=JSON.parse(fs.readFileSync(input,'utf8')),S=G.summary,dir=path.dirname(input),file=path.join(dir,S.name+'.gcode'),text=fs.readFileSync(file,'utf8');
const gate=checkGcode(text,{bead:S.args.bead,maxbridge:16.2,maxcantilever:4.8,allow:.6,minanchor:.5,maxCapRadius:20,maxislands:1,allProblems:true,file});
if(gate.problems.length!==gate.problem_count)throw Error('incomplete gate findings');
const zones=S.experiments.zones,byZone={},outside=[];
for(const p of gate.problems){const z=zones.find(r=>p.z>=r.z0-.01&&p.z<=r.z1+.01);if(z)byZone[z.name]=(byZone[z.name]||0)+1;else outside.push(p);}
const result={file,bodySha256:crypto.createHash('sha256').update(text.replace(/^;.*$/gm,'').replace(/^M73 .*$/gm,'')).digest('hex'),meaning:'Exhaustive 16.2 mm gate on this final object G-code. Expected experimental findings are retained; every finding, not a display-limited prefix, is checked against the declared narrow zones.',findings:gate.problem_count,byZone,outsideDeclaredZones:outside.length,outside,gate};
fs.writeFileSync(path.join(dir,S.name+'_gate_at_16.2mm_full.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({name:S.name,findings:gate.problem_count,byZone,outside:outside.length,stats:gate.stats,worstGaps:gate.worstGaps}));if(outside.length)process.exitCode=1;
