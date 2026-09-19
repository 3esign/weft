// Independent read of the bytes that will ship. Reporting is never truncated.
import {parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {checkGcode,gcodeFrom3mf} from '../core/weft_build.mjs';
const bytes=fs.readFileSync(workerData.input),text=workerData.package?gcodeFrom3mf(bytes).text:bytes.toString('utf8');
const gate=checkGcode(text,{...workerData.options,allProblems:true,file:workerData.finalPath});delete gate._grid;
gate.inputSha256=crypto.createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(workerData.output,JSON.stringify(gate,null,1));
parentPort.postMessage({output:workerData.output,PASS:gate.PASS,problems:gate.problem_count,points:gate.stats.checked_points});
