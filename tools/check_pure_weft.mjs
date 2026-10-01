/* Measure the pure-weft promise in the SHIPPED G-code, not in the generator: split extrusion runs on
   travel (any move with no positive E), not on FEATURE markers — the markers merge rim and core into
   one run and would have hidden a closed rim. A run whose end lands within 0.44 mm of its own start
   is a wall. Brim is exempt: the foundation rings are closed on purpose. */
import fs from 'node:fs';
import path from 'node:path';
const near = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
let bad = 0;
for(const file of process.argv.slice(2)){
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const pos = { x: null, y: null }; let z = 0, feature = '', run = [], runLine = 0, runZ = 0;
  const runs = []; let total = 0;
  const flush = () => { if(run.length > 2) runs.push({ pts: run, line: runLine, z: runZ, feature }); run = []; };
  for(let i = 0; i < lines.length; i++){
    const l = lines[i];
    const f = /^; FEATURE: (.+)$/.exec(l); if(f){ flush(); feature = f[1]; continue; }
    if(!/^G[01] /.test(l)) continue;
    const X = /X(-?[\d.]+)/.exec(l), Y = /Y(-?[\d.]+)/.exec(l), E = /E(-?[\d.]+)/.exec(l), Z = /Z(-?[\d.]+)/.exec(l);
    if(Z) z = +Z[1];
    const ext = E && +E[1] > 0 && (X || Y);
    if(X) pos.x = +X[1]; if(Y) pos.y = +Y[1];
    if(!ext){ flush(); continue; }
    if(!run.length){ runLine = i + 1; runZ = z; }
    run.push([pos.x, pos.y]);
  }
  flush();
  const body = runs.filter(r => !/brim|skirt/i.test(r.feature));
  const closed = [];
  for(const r of body){
    const d = near(r.pts[0], r.pts.at(-1));
    total += r.pts.slice(1).reduce((s, q, i) => s + near(r.pts[i], q), 0);
    if(d < 0.44) closed.push({ z: r.z, line: r.line, feature: r.feature, closure_mm: +d.toFixed(3), pts: r.pts.length });
  }
    const name = path.basename(file);
  console.log(`${name}: ${body.length} body runs, ${runs.length - body.length} brim/skirt · thread ${(total / 1000).toFixed(1)} m · CLOSED ${closed.length}`);
  for(const c of closed.slice(0, 8)) console.log(`   z=${c.z} line ${c.line} "${c.feature}" ${c.pts} pts, closes within ${c.closure_mm} mm`);
  if(closed.length) bad++;
}
if(bad){ console.error(`REFUSED: ${bad} file(s) still carry a closed body path — that is a wall`); process.exit(1); }
console.log('pure weft: no closed body path in any file');
