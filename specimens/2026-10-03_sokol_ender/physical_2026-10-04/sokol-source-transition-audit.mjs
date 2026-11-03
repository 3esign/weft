import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const project=process.argv[2],out=process.argv[3];
if(!project||!out)throw Error('Usage: node audit.mjs project output.json');
const source=path.join(project,'specimens/2026-10-03_sokol_ender/sokol_v2c_geometry.json');
const g=JSON.parse(fs.readFileSync(source));
const {auditPaths}=await import(pathToFileURL(path.join(project,'private-studio/engine/path-audit.mjs')));
const result=[];
for(const [low,high] of [[35,36],[46.6,59],[87.8,89],[117.6,124.6]]){
 const layers=g.layers.filter(l=>l.zTop>=low-.201&&l.zTop<=high+.001);
 const a=auditPaths({...g,layers});
 result.push({range:[low,high],definition:a.definition,PASS:a.PASS,rows:a.rows,findings:a.findings});
}
fs.writeFileSync(out,JSON.stringify({at:new Date().toISOString(),source,note:'Bounded source geometry audit at body topology and dense-band transitions, not final G-code or physical measurement.',windows:result},null,2)+'\n');
console.log(JSON.stringify(result.map(a=>({range:a.range,findings:a.findings.length}))));
