/* The layered gate S2–S8 + ORDER (core/weft_gate_layers.js, 2026-09-25) held to what KRAK taught it.

   Three synthetic objects, written here as G-code so the test needs nothing on disk:
     HOLD   a woven drum with one returning-hairpin terrace whose tips are mostly short (median under the
            OBRTAJ 14.2 mm) and which is the last thing printed  -> every refusing layer PASS
     KRAK   the same drum, but every tip 24 mm (KRAK K1), a wall on top of the terrace and a second, wider
            terrace flying over the first one's loose tips 5 mm higher  -> S3 FAIL, S4 FAIL
     DECL   the KRAK object with its terraces declared as experiment zones  -> S3/S4 DECLARED but ORDER FAIL,
            because undeclared wall stands on the declared risk band (the object cannot die from the top)
   and the printed LIMIT16 A2L package, which must pass every refusing layer (it printed and held). */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
await import(pathToFileURL(path.join(ROOT, 'core', 'weft_gate.js')).href);
await import(pathToFileURL(path.join(ROOT, 'core', 'weft_gate_layers.js')).href);
const L = globalThis.WEFT_GATE_LAYERS;
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok    ' : 'FAIL  ') + msg); if(!cond) failed++; };

/* --- a tiny G-code writer: one continuous extruding polyline per layer, WEFT layer labels --- */
function gcode(layersSpec, lh){
  const out = ['; synthetic WEFT test object', 'G90', 'M83'];
  let k = 0;
  for(const lay of layersSpec){
    const z = +((k + 1) * lh).toFixed(3); out.push(`; layer ${k} ${lay.role}`); out.push(`G0 Z${z}`);
    for(const path of lay.paths){ out.push(`G0 X${path[0][0].toFixed(3)} Y${path[0][1].toFixed(3)}`); for(let i = 1; i < path.length; i++) out.push(`G1 X${path[i][0].toFixed(3)} Y${path[i][1].toFixed(3)} E0.01`); }
    k++;
  }
  return out.join('\n') + '\n';
}
const TAU = 2 * Math.PI, R = 30, N = 96, CX = 100, CY = 100;
const ring = (r, phase = 0) => { const p = []; for(let i = 0; i <= N; i++){ const a = phase + TAU * i / N; p.push([CX + r * Math.cos(a), CY + r * Math.sin(a)]); } return p; };
/* a woven wall layer: the ring plus a zigzag web crossing it (so consecutive layers cross, S8 quiet) */
const wall = (k) => { const p = []; for(let i = 0; i <= N; i++){ const a = TAU * i / N; const rr = R + ((i + k) % 2 ? 1.2 : -1.2); p.push([CX + rr * Math.cos(a), CY + rr * Math.sin(a)]); } return [p]; };
/* a terrace layer: the ring with returning hairpins of reach `reach(i)` at every cell */
const terrace = (reach, cells = 48) => { const p = []; for(let i = 0; i <= cells; i++){ const a = TAU * i / cells, a2 = TAU * (i + 0.5) / cells; p.push([CX + R * Math.cos(a), CY + R * Math.sin(a)]); const rr = R + reach(i); p.push([CX + rr * Math.cos(a2 - 0.01), CY + rr * Math.sin(a2 - 0.01)]); p.push([CX + rr * Math.cos(a2 + 0.01), CY + rr * Math.sin(a2 + 0.01)]); } p.push([CX + R, CY]); return [p]; };
const lh = 0.24;
const base = [{ role:'adhesion', paths:[ring(R - 2), ring(R), ring(R + 2)] }, { role:'adhesion', paths:[ring(R - 1), ring(R + 1)] }, { role:'adhesion', paths:[ring(R)] }];
const wallLayers = (n, k0 = 0) => Array.from({ length:n }, (_, i) => ({ role:'web', paths:wall(k0 + i) }));

/* HOLD: 24 wall layers, then a terrace whose tips are 3 mm at odd cells and 14 mm at even cells, 8 layers, nothing above */
const hold = [...base, ...wallLayers(24), ...Array.from({ length:8 }, () => ({ role:'bridge', paths:terrace(i => (i % 2 ? 3 : 14)) }))];
/* KRAK: 24 wall layers, terrace at 24 mm everywhere (8 layers), 20 wall layers, then a 40 mm terrace flying over the first one */
const krak = [...base, ...wallLayers(24), ...Array.from({ length:8 }, () => ({ role:'bridge', paths:terrace(() => 24) })), ...wallLayers(20, 1),
  ...Array.from({ length:8 }, () => ({ role:'bridge', paths:terrace(() => 40) }))];
const zK1 = { z0:(3 + 24 + 1) * lh - 0.01, z1:(3 + 24 + 8) * lh + 0.01 }, zK2 = { z0:(3 + 24 + 8 + 20 + 1) * lh - 0.01, z1:(3 + 24 + 8 + 20 + 8) * lh + 0.01 };

const o = { bead:0.45, allow:0.6 };
const rh = L.analyse(gcode(hold, lh), o);
console.log('HOLD ', rh.vector);
ok(!rh.refuse, 'HOLD: the layered gate passes an object with a short-tipped terrace on top');
ok(rh.layers.S3.worst && rh.layers.S3.worst.median <= L.LIMITS.S3.median.hold, `HOLD: S3 median ${rh.layers.S3.worst && rh.layers.S3.worst.median} within the OBRTAJ ${L.LIMITS.S3.median.hold} mm`);
ok(rh.layers.S4.overflights === 0, 'HOLD: nothing flies over a loose tip');

const rk = L.analyse(gcode(krak, lh), o);
console.log('KRAK ', rk.vector);
ok(rk.refuse && rk.refusedBy.includes('S3'), `KRAK: S3 refuses (median ${rk.layers.S3.worst && rk.layers.S3.worst.median} mm, all tips long)`);
ok(rk.refusedBy.includes('S4') && rk.layers.S4.overflights > 0, `KRAK: S4 refuses — ${rk.layers.S4.overflights} passes over loose tips, closest ${rk.layers.S4.closest && rk.layers.S4.closest.clearance} mm`);
ok(rk.layers.S3.neverTied > 0, `KRAK: ${rk.layers.S3.neverTied} tips are never tied`);
ok(rk.layers.S2.verdict === 'INFO' && rk.layers.S8.verdict !== 'FAIL', 'S2 and S8 report, they do not refuse (OBRTAJ evidence)');

const rd = L.analyse(gcode(krak, lh), Object.assign({}, o, { zones:[{ name:'terrace K1', ...zK1 }, { name:'terrace K2', ...zK2 }] }));
console.log('DECL ', rd.vector);
ok(rd.layers.S3.verdict === 'DECLARED' && rd.layers.S4.verdict === 'DECLARED', 'DECL: findings inside declared zones are declared, not refusing');
ok(rd.refuse && rd.refusedBy.includes('ORDER'), `DECL: ORDER refuses — ${rd.layers.ORDER.why}`);

/* the declared object with nothing above the last terrace: ORDER passes */
const krakTop = krak.slice(0, 3 + 24 + 8);
const rt = L.analyse(gcode(krakTop, lh), Object.assign({}, o, { zones:[{ name:'terrace K1', ...zK1 }] }));
console.log('TOP  ', rt.vector);
ok(!rt.refuse && rt.layers.ORDER.verdict === 'PASS', 'TOP: a declared risk band as the last thing printed passes ORDER');

/* the printed LIMIT16 A2L package: every refusing layer must pass */
const l16 = path.join(ROOT, 'specimens', '2026-09-04_LIMIT16_A2L_physical', 'LIMIT16_A2L_v1_routeB.gcode');
if(fs.existsSync(l16)){
  const r = L.analyse(fs.readFileSync(l16, 'utf8'), Object.assign({}, o, { file:l16 }));
  console.log('L16  ', r.vector);
  ok(!r.refuse, 'LIMIT16 A2L (printed 2026-09-04, held): the layered gate does not refuse it');
} else console.log('SKIP  LIMIT16 package not on disk');

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
