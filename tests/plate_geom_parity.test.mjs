#!/usr/bin/env node
/* tests/plate_geom_parity.test.mjs — the JavaScript port of plate_geometry.py (MERA 4x4) reproduces the Python.
 *
 *   node tests/plate_geom_parity.test.mjs [--tol 0.02] [--dir DIR] [--no-golden]
 *
 * Runs plate_geometry.py NOW (python3, stdlib only) with the flags the printed MERA plate was made
 * with (`--machine a2l`, every other flag at its default: lh 0.24, bead 0.45, w 5, e 1, height 22.08)
 * into DIR (default: the OS temp dir), runs core/weft_plate_geometry.mjs with the same flags, and
 * compares:
 *   bytes   : the JSON file the port writes (its json.dumps twin) against the Python file, and the
 *             plan SVG against the Python SVG;
 *   geometry: through tests/geom_compare.mjs — layer count, contour count per layer, node count per
 *             contour, symmetric Hausdorff of every contour and foundation path, node positions,
 *             summary key set, all distances <= --tol mm (default 0.02);
 *   tree    : both JSON trees walked, every number compared bit for bit (caps and summary included),
 *             key order and structure checked everywhere.
 * With the printed golden present (specimens/2026-09-03_MERA_A2L_4x4_v1_physical) the port is also
 * compared with it; the golden predates the membrane-contract keys (process / physicalStatus /
 * evidence) that the script now writes, so that comparison expects exactly those extra keys and no
 * other difference.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generatePlate, toJson } from '../core/weft_plate_geometry.mjs';
import { compareGeometry, formatReport } from './geom_compare.mjs';
import { treeWalk } from './limit16_geom_parity.test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const TOL = +opt('tol', 0.02);
const DIR = opt('dir', os.tmpdir());
const PY = process.env.WEFT_PYTHON || 'python3';
const NO_GOLDEN = argv.includes('--no-golden');
const GOLDEN = 'specimens/2026-09-03_MERA_A2L_4x4_v1_physical/MERA_A2L_4x4_v1_geometry.json';

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const REF = path.join(DIR, 'plate_py_a2l.json'), REFSVG = path.join(DIR, 'plate_py_a2l.svg');
const OUT = path.join(DIR, 'plate_js_a2l.json'), OUTSVG = path.join(DIR, 'plate_js_a2l.svg');

/* 1. the Python reference, produced now */
const pyArgs = [path.join(ROOT, 'plate_geometry.py'), '--machine', 'a2l', '--out', REF, '--svg', REFSVG];
const t0 = process.hrtime.bigint();
const r = spawnSync(PY, pyArgs, { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
const tPy = Number(process.hrtime.bigint() - t0) / 1e9;
if(r.error || r.status !== 0 || !fs.existsSync(REF)){
  console.error(`cannot produce the Python reference (${r.error ? r.error.message : 'exit ' + r.status}). Run: ${PY} ${pyArgs.join(' ')}`);
  process.exit(2);
}
const refText = fs.readFileSync(REF, 'utf8');
const ref = JSON.parse(refText);
console.log(`Python generator: ${tPy.toFixed(2)} s (process), ${ref.layers.length} layers -> ${REF}`);

/* 2. the JavaScript generator, same flags */
const t1 = process.hrtime.bigint();
const g = generatePlate({ machine: 'a2l' });
const jsText = toJson(g.payload);
const tJs = Number(process.hrtime.bigint() - t1) / 1e9;
fs.writeFileSync(OUT, jsText); fs.writeFileSync(OUTSVG, g.svg());
console.log(`JS generator: ${tJs.toFixed(3)} s (in-process, generate + serialise), ${g.payload.layers.length} layers -> ${OUT}`);
const js = JSON.parse(fs.readFileSync(OUT, 'utf8'));   // compare what is on disk, as the builder will read it

/* 3. bytes */
const svgSame = fs.readFileSync(REFSVG, 'utf8') === fs.readFileSync(OUTSVG, 'utf8');
let firstDiff = -1; if(jsText !== refText){ const n = Math.min(jsText.length, refText.length); for(let i = 0; i < n; i++) if(jsText[i] !== refText[i]){ firstDiff = i; break; } if(firstDiff < 0) firstDiff = n; }
check('MERA: geometry JSON byte-identical to the Python file', jsText === refText, jsText === refText ? `${jsText.length} bytes` : `first difference at byte ${firstDiff}: ...${JSON.stringify(refText.slice(Math.max(0, firstDiff - 30), firstDiff + 30))} vs ...${JSON.stringify(jsText.slice(Math.max(0, firstDiff - 30), firstDiff + 30))}`);
check('MERA: plan SVG byte-identical to the Python file', svgSame);

/* 4. geometry through the comparer */
const cmp = compareGeometry(ref, js, { tol: TOL });
console.log(formatReport(cmp, true));
check('MERA: layer count equal', ref.layers.length === js.layers.length, `${ref.layers.length} vs ${js.layers.length}`);
check('MERA: contour count per layer equal', cmp.layers.every(l => l.contoursA === l.contoursB));
check('MERA: node count per contour equal', cmp.layers.every(l => !l.nodeCountMismatch) && !cmp.problems.some(p => /node count/.test(p)));
check(`MERA: contour Hausdorff <= ${TOL} mm`, cmp.overall.maxHausdorff <= TOL, `max ${cmp.overall.maxHausdorff.toFixed(5)} mm`);
check(`MERA: node position distance <= ${TOL} mm`, cmp.overall.maxNodeDist <= TOL, `max ${cmp.overall.maxNodeDist.toFixed(5)} mm`);
check('MERA: foundation path count equal', cmp.overall.foundationPathsA === cmp.overall.foundationPathsB, `${cmp.overall.foundationPathsA} vs ${cmp.overall.foundationPathsB}`);
check(`MERA: foundation path Hausdorff <= ${TOL} mm`, cmp.overall.maxFoundationHausdorff <= TOL, `max ${cmp.overall.maxFoundationHausdorff.toFixed(5)} mm`);
check('MERA: summary key set equal', JSON.stringify(Object.keys(ref.summary)) === JSON.stringify(Object.keys(js.summary)));
check('MERA: geom_compare verdict', cmp.pass, cmp.pass ? 'PASS' : cmp.problems.slice(0, 5).join('; '));

/* 5. bit-level walk over the whole tree (caps and summary included) */
const st = treeWalk(ref, js);
console.log(`bit-level walk: ${st.numbers} numbers compared, ${st.differing} differ (worst ${st.worst} at ${st.worstPath || '-'}), ${st.structural.length} structural differences`);
check('MERA: same key order and structure everywhere', st.structural.length === 0, st.structural.slice(0, 3).join('; '));
check('MERA: numbers bit-identical to the Python output', st.differing === 0, `${st.differing} of ${st.numbers} differ${st.examples.length ? '; e.g. ' + st.examples.join('; ') : ''}`);

/* 6. the printed golden */
const goldenFile = path.join(ROOT, GOLDEN);
if(!NO_GOLDEN && fs.existsSync(goldenFile)){
  const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8'));
  const capKey = (p) => /\.caps\[\d+\]\.(process|physicalStatus|evidence)$/.test(p);
  const sg = treeWalk(golden, js, [capKey]);
  const cg = compareGeometry(golden, js, { tol: TOL });
  console.log(`vs golden ${GOLDEN}: ${sg.numbers} numbers, ${sg.differing} differ, ${sg.structural.length} structural differences beyond the membrane-contract keys; comparer max Hausdorff ${cg.overall.maxHausdorff.toFixed(5)} mm, max node ${cg.overall.maxNodeDist.toFixed(5)} mm, ${cg.pass ? 'PASS' : 'FAIL'}`);
  check('MERA: golden geometry reproduced (numbers bit-identical, only the newer cap keys added)', sg.differing === 0 && sg.structural.length === 0 && cg.pass, sg.structural.slice(0, 3).join('; ') || cg.problems.slice(0, 3).join('; '));
} else console.log(`golden ${GOLDEN} ${NO_GOLDEN ? 'skipped' : 'not present'}`);

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (tolerance ${TOL} mm)`);
process.exit(failed.length ? 1 : 0);
