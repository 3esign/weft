// Diagnostic windows, never written as printable G-code. Full-height final gates remain mandatory.
import fs from 'node:fs';
import path from 'node:path';
import {createWeftCore,layersFromGeometry,gcodeText,checkGcode,WEFT_ROOT,loadMachines} from '../core/weft_build.mjs';
const input=process.argv[2],G=JSON.parse(fs.readFileSync(input,'utf8')),m=loadMachines()[G.summary.machine],LH=m.lh;
const wallsOnly=process.argv.includes('--walls');
const windows=wallsOnly?G.summary.walls.slice(1).map(w=>({name:'wall-'+w.tier,start:w.k0-3,end:w.k1})):G.summary.terraces.map(t=>({name:t.name,start:t.k0-3,end:Math.min(G.layers.length-1,t.k1+7)}));
if(!wallsOnly)windows.push({name:'roof',start:G.summary.roof.k0-3,end:G.layers.length-1});
const results=[];
for(const win of windows){
 const layers=G.layers.slice(win.start,win.end+1).map((l,j)=>({...l,k:j,zBot:+(j*LH).toFixed(4),zTop:+((j+1)*LH).toFixed(4)}));
 const g={summary:{...G.summary,name:'DIAGNOSTIC_WINDOW_NOT_A_PRINT',H:layers.length*LH},layers},W=createWeftCore();
 const report=layersFromGeometry(W,g,{machine:G.summary.machine,name:g.summary.name});
 const txt=await gcodeText(W,path.join(WEFT_ROOT,m.start),path.join(WEFT_ROOT,m.end));
 const gate=checkGcode(txt,{bead:m.bead,allow:.6,maxbridge:wallsOnly?16.2:180,maxcantilever:4.8,maxislands:0,maxReport:100,allProblems:true});
 const result={...win,source_z:win.start*LH,meaning:'Actual neighboring layer XY paths rebased near the bed, no foundation; first-layer island check disabled ONLY for this non-print diagnostic. Does not replace the final full-height gates.',overlaps:report.unintendedOverlaps,gate};
 results.push(result);console.log(JSON.stringify({name:win.name,PASS:gate.PASS,problems:gate.problem_count,stats:gate.stats,samples:gate.problems.slice(0,8)}));
 fs.writeFileSync(path.join(path.dirname(input),wallsOnly?'PROBE_WALLS.json':'PROBE_REPORT.json'),JSON.stringify(results,null,2));
}
