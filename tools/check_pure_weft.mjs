/* Measure the pure-weft promise in the SHIPPED G-code, not in the generator: split extrusion runs on
   travel (any move with no positive E), not on FEATURE markers — the markers merge rim and core into
   one run and would have hidden a closed rim. Brim is exempt: the foundation rings are closed on purpose.

   What makes a run a WALL is not that it ends near its start. In pure-weft/v2 the rim and the core are
   ONE line, so a run ends wherever the fill happened to finish — four of 1198 runs in the chair end
   within half a bead of their own beginning purely by chance, and none of them is a wall. A wall is a
   run that comes home AND did nothing but go round: its length is barely more than the perimeter of
   the region it encloses. So closure is measured against the run's own convex hull, and a run that is
   longer than 1.8 x that hull has visibly been inside the section, not around it. Both numbers are
   printed, so the judgement is visible and arguable rather than hidden in a threshold. */
import fs from 'node:fs';
import path from 'node:path';
const near = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/* monotone chain, then the hull's perimeter: how long a pure loop around this run would have been */
function hullPerimeter(pts){
  const p2 = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for(const q of p2){ while(lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for(let i = p2.length - 1; i >= 0; i--){ const q = p2[i]; while(upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  const h = lower.slice(0, -1).concat(upper.slice(0, -1));
  if(h.length < 3) return 0;
  let per = 0; for(let i = 0; i < h.length; i++) per += near(h[i], h[(i + 1) % h.length]);
  return per;
}
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
  const closed = [], homing = [];
  for(const r of body){
    const d = near(r.pts[0], r.pts.at(-1));
    const len = r.pts.slice(1).reduce((s, q, i) => s + near(r.pts[i], q), 0);
    total += len;
    if(d >= 0.44) continue;
    const hull = hullPerimeter(r.pts);
    const rec = { z: r.z, line: r.line, feature: r.feature, closure_mm: +d.toFixed(3), pts: r.pts.length,
      len_mm: +len.toFixed(1), hull_mm: +hull.toFixed(1), ratio: +(len / (hull || 1)).toFixed(2) };
    (len < 1.8 * hull ? closed : homing).push(rec);
  }
    const name = path.basename(file);
  console.log(`${name}: ${body.length} body runs, ${runs.length - body.length} brim/skirt · thread ${(total / 1000).toFixed(1)} m · WALLS ${closed.length} · runs ending near their start ${homing.length}`);
  for(const c of closed.slice(0, 8)) console.log(`   WALL  z=${c.z} line ${c.line} "${c.feature}" ${c.pts} pts, closes within ${c.closure_mm} mm, length ${c.len_mm} mm vs hull ${c.hull_mm} mm (x${c.ratio})`);
  for(const c of homing.slice(0, 8)) console.log(`   note  z=${c.z} line ${c.line} ends ${c.closure_mm} mm from its start, but ran ${c.ratio}x its own hull — a filled run, not a wall`);
  if(closed.length) bad++;
}
if(bad){ console.error(`REFUSED: ${bad} file(s) still carry a closed body path — that is a wall`); process.exit(1); }
console.log('pure weft: no closed body path in any file');
