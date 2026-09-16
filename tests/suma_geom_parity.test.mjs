#!/usr/bin/env node
/* tests/suma_geom_parity.test.mjs — the JavaScript port of suma_geometry.py reproduces the Python.
 *
 *   node tests/suma_geom_parity.test.mjs [--ref /tmp/suma_py_2x2.json] [--out /tmp/suma_js_2x2.json] [--tol 0.02]
 *
 * Runs core/weft_suma_geometry.mjs for --cols 2 --rows 2 and compares with the Python output
 * through tests/geom_compare.mjs:
 *   exact   : layer count, contour count per layer, node count per contour, Keff, event types and
 *             event z (1e-6), foundation path count, summary key set;
 *   distance: symmetric Hausdorff of every contour polyline, node positions, foundation paths,
 *             all <= --tol mm (default 0.02).
 * On top of that it walks both JSON trees and counts numbers that are not bit-identical (the
 * port aims at identical output; only summary.args.out is expected to differ).
 * The reference is produced by `python3 suma_geometry.py --cols 2 --rows 2 --out /tmp/suma_py_2x2.json`;
 * if it is missing and python3 is available the test runs that command itself.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateSuma } from '../core/weft_suma_geometry.mjs';
import { compareGeometry, formatReport } from './geom_compare.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const REF = opt('ref', '/tmp/suma_py_2x2.json');
const OUT = opt('out', '/tmp/suma_js_2x2.json');
const TOL = +opt('tol', 0.02);

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/* 1. the Python reference */
if(!fs.existsSync(REF)){
  const py = process.env.WEFT_PYTHON || 'python3';
  console.log(`reference ${REF} missing; running ${py} suma_geometry.py --cols 2 --rows 2 --out ${REF}`);
  const r = spawnSync(py, [path.join(ROOT, 'suma_geometry.py'), '--cols', '2', '--rows', '2', '--out', REF], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  if(r.error || r.status !== 0 || !fs.existsSync(REF)){
    console.error(`cannot produce the Python reference (${r.error ? r.error.message : 'exit ' + r.status}). Run: python3 suma_geometry.py --cols 2 --rows 2 --out ${REF}`);
    process.exit(2);
  }
}
const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));

/* 2. the JavaScript generator, same flags as the reference run */
const t0 = process.hrtime.bigint();
const geo = generateSuma({ cols: 2, rows: 2, out: OUT });
const dt = Number(process.hrtime.bigint() - t0) / 1e9;
fs.writeFileSync(OUT, JSON.stringify(geo));
console.log(`JS generator 2x2: ${dt.toFixed(1)} s, ${geo.layers.length} layers -> ${OUT}`);
const js = JSON.parse(fs.readFileSync(OUT, 'utf8'));   // compare what is on disk, as the builder will read it

/* 3. geometric comparison */
const cmp = compareGeometry(ref, js, { tol: TOL });
console.log(formatReport(cmp, true));
check('layer count equal', ref.layers.length === js.layers.length, `${ref.layers.length} vs ${js.layers.length}`);
check('contour count per layer equal', cmp.layers.every(l => l.contoursA === l.contoursB));
check('node count per contour equal', cmp.layers.every(l => !l.nodeCountMismatch) && !cmp.problems.some(p => /node count/.test(p)));
check(`contour Hausdorff <= ${TOL} mm`, cmp.overall.maxHausdorff <= TOL, `max ${cmp.overall.maxHausdorff.toFixed(5)} mm`);
check(`node position distance <= ${TOL} mm`, cmp.overall.maxNodeDist <= TOL, `max ${cmp.overall.maxNodeDist.toFixed(5)} mm`);
check('summary key set equal', JSON.stringify(Object.keys(ref.summary)) === JSON.stringify(Object.keys(js.summary)));
check('event list equal (types, ids, z to 1e-6)', cmp.overall.eventsA === cmp.overall.eventsB && cmp.overall.maxEventDz <= 1e-6 && !cmp.problems.some(p => /^event/.test(p)), `${cmp.overall.eventsA} events, max |dz| ${cmp.overall.maxEventDz}`);
check('foundation path count equal', cmp.overall.foundationPathsA === cmp.overall.foundationPathsB, `${cmp.overall.foundationPathsA} vs ${cmp.overall.foundationPathsB}`);
check(`foundation path Hausdorff <= ${TOL} mm`, cmp.overall.maxFoundationHausdorff <= TOL, `max ${cmp.overall.maxFoundationHausdorff.toFixed(5)} mm`);
check('geom_compare verdict', cmp.pass, cmp.pass ? 'PASS' : cmp.problems.slice(0, 5).join('; '));

/* 4. bit-level identity walk (informational, but a regression if it ever grows) */
let numbers = 0, differing = 0, worst = 0, worstPath = '';
const structural = [];
function walk(x, y, p){
  if(typeof x === 'number' && typeof y === 'number'){ numbers++; if(x !== y){ differing++; const d = Math.abs(x - y); if(d > worst){ worst = d; worstPath = p; } } return; }
  if(Array.isArray(x) && Array.isArray(y)){ if(x.length !== y.length) structural.push(`${p}: length ${x.length} vs ${y.length}`); const m = Math.min(x.length, y.length); for(let i = 0; i < m; i++) walk(x[i], y[i], `${p}[${i}]`); return; }
  if(x && y && typeof x === 'object' && typeof y === 'object'){
    const kx = Object.keys(x), ky = Object.keys(y);
    if(kx.join() !== ky.join()) structural.push(`${p}: keys ${kx.join()} vs ${ky.join()}`);
    for(const k of kx) if(k in y) walk(x[k], y[k], `${p}.${k}`);
    return;
  }
  if(x !== y && p !== '$.summary.args.out') structural.push(`${p}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
}
walk(ref, js, '$');
console.log(`bit-level walk: ${numbers} numbers compared, ${differing} differ (worst ${worst} at ${worstPath || '-'}), ${structural.length} structural differences`);
check('same key order and structure everywhere', structural.length === 0, structural.slice(0, 3).join('; '));
check('numbers bit-identical to the Python output', differing === 0, `${differing} of ${numbers} differ`);

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (tolerance ${TOL} mm)`);
process.exit(failed.length ? 1 : 0);
