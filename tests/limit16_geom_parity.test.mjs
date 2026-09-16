#!/usr/bin/env node
/* tests/limit16_geom_parity.test.mjs — the JavaScript port of limit16_geometry.py reproduces the Python.
 *
 *   node tests/limit16_geom_parity.test.mjs [--tol 0.02] [--dir DIR] [--no-golden]
 *
 * For each machine the printed specimens were made for (a2l; ender with --allow-assumed-bead) the
 * test runs limit16_geometry.py NOW (python3, stdlib only) into DIR (default: the OS temp dir),
 * runs core/weft_limit16_geometry.mjs with the same flags, and compares:
 *   bytes   : the JSON file the port writes (its json.dumps twin) against the Python file, and the
 *             plan SVG against the Python SVG;
 *   geometry: through tests/geom_compare.mjs — layer count, contour count per layer, node count per
 *             contour, symmetric Hausdorff of every contour and foundation path, node positions,
 *             summary key set, all distances <= --tol mm (default 0.02);
 *   tree    : both JSON trees walked, every number compared bit for bit (typed paths, caps and the
 *             summary included — geom_compare only looks at contours, nodes and foundation), key
 *             order and structure checked everywhere.
 * With the printed goldens present (specimens/2026-09-04_LIMIT16_*_physical) the port is also
 * compared with them; the goldens predate the membrane-contract keys (process / physicalStatus /
 * evidence) that the script now writes, so that comparison expects exactly those extra keys and
 * no other difference.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateLimit16, toJson } from '../core/weft_limit16_geometry.mjs';
import { compareGeometry, formatReport } from './geom_compare.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const TOL = +opt('tol', 0.02);
const DIR = opt('dir', os.tmpdir());
const PY = process.env.WEFT_PYTHON || 'python3';
const NO_GOLDEN = argv.includes('--no-golden');

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/** Walk two JSON trees: count numbers, numbers that differ, structural differences. `ignore` is a
 *  list of path predicates for differences that are expected (the goldens' missing cap keys). */
export function treeWalk(x, y, ignore = []){
  const st = { numbers: 0, differing: 0, worst: 0, worstPath: '', structural: [], examples: [] };
  const skip = (p) => ignore.some(f => f(p));
  const note = (s, p) => { if(skip(p)) return; st.structural.push(s); };
  function walk(a, b, p){
    if(typeof a === 'number' && typeof b === 'number'){
      st.numbers++;
      if(a !== b){ st.differing++; const d = Math.abs(a - b); if(d > st.worst){ st.worst = d; st.worstPath = p; } if(st.examples.length < 5) st.examples.push(`${p}: ${a} vs ${b}`); }
      return;
    }
    if(Array.isArray(a) && Array.isArray(b)){
      if(a.length !== b.length) note(`${p}: length ${a.length} vs ${b.length}`, p);
      const m = Math.min(a.length, b.length); for(let i = 0; i < m; i++) walk(a[i], b[i], `${p}[${i}]`);
      return;
    }
    if(a && b && typeof a === 'object' && typeof b === 'object'){
      const ka = Object.keys(a), kb = Object.keys(b);
      const kaf = ka.filter(k => !skip(`${p}.${k}`)), kbf = kb.filter(k => !skip(`${p}.${k}`));
      if(kaf.join() !== kbf.join()) note(`${p}: keys [${ka}] vs [${kb}]`, p);
      for(const k of ka){ if(k in b) walk(a[k], b[k], `${p}.${k}`); else note(`${p}.${k}: missing in B`, `${p}.${k}`); }
      for(const k of kb) if(!(k in a)) note(`${p}.${k}: extra in B`, `${p}.${k}`);
      return;
    }
    if(a !== b) note(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`, p);
  }
  walk(x, y, '$');
  return st;
}

export const RUNS = [
  { machine: 'a2l', flags: [], golden: 'specimens/2026-09-04_LIMIT16_A2L_physical/LIMIT16_A2L_v1_geometry.json' },
  { machine: 'ender', flags: ['--allow-assumed-bead'], golden: 'specimens/2026-09-04_LIMIT16_ENDER3V4_physical/LIMIT16_ENDER3V4_v1_geometry.json' },
];

function main(){
for(const run of RUNS){
  const tag = `LIMIT16 ${run.machine}`;
  const REF = path.join(DIR, `limit16_py_${run.machine}.json`), REFSVG = path.join(DIR, `limit16_py_${run.machine}.svg`);
  const OUT = path.join(DIR, `limit16_js_${run.machine}.json`), OUTSVG = path.join(DIR, `limit16_js_${run.machine}.svg`);
  console.log(`\n===== ${tag} =====`);

  /* 1. the Python reference, produced now */
  const pyArgs = [path.join(ROOT, 'limit16_geometry.py'), '--machine', run.machine, ...run.flags, '--out', REF, '--svg', REFSVG];
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
  const g = generateLimit16({ machine: run.machine, allow_assumed_bead: run.flags.includes('--allow-assumed-bead') });
  const jsText = toJson(g.payload);
  const tJs = Number(process.hrtime.bigint() - t1) / 1e9;
  fs.writeFileSync(OUT, jsText); fs.writeFileSync(OUTSVG, g.svg());
  console.log(`JS generator: ${tJs.toFixed(3)} s (in-process, generate + serialise), ${g.payload.layers.length} layers -> ${OUT}`);
  const js = JSON.parse(fs.readFileSync(OUT, 'utf8'));   // compare what is on disk, as the builder will read it

  /* 3. bytes */
  const svgSame = fs.readFileSync(REFSVG, 'utf8') === fs.readFileSync(OUTSVG, 'utf8');
  let firstDiff = -1; if(jsText !== refText){ const n = Math.min(jsText.length, refText.length); for(let i = 0; i < n; i++) if(jsText[i] !== refText[i]){ firstDiff = i; break; } if(firstDiff < 0) firstDiff = n; }
  check(`${tag}: geometry JSON byte-identical to the Python file`, jsText === refText, jsText === refText ? `${jsText.length} bytes` : `first difference at byte ${firstDiff}: ...${JSON.stringify(refText.slice(Math.max(0, firstDiff - 30), firstDiff + 30))} vs ...${JSON.stringify(jsText.slice(Math.max(0, firstDiff - 30), firstDiff + 30))}`);
  check(`${tag}: plan SVG byte-identical to the Python file`, svgSame);

  /* 4. geometry through the comparer */
  const cmp = compareGeometry(ref, js, { tol: TOL });
  console.log(formatReport(cmp, true));
  check(`${tag}: layer count equal`, ref.layers.length === js.layers.length, `${ref.layers.length} vs ${js.layers.length}`);
  check(`${tag}: contour count per layer equal`, cmp.layers.every(l => l.contoursA === l.contoursB));
  check(`${tag}: node count per contour equal`, cmp.layers.every(l => !l.nodeCountMismatch) && !cmp.problems.some(p => /node count/.test(p)));
  check(`${tag}: contour Hausdorff <= ${TOL} mm`, cmp.overall.maxHausdorff <= TOL, `max ${cmp.overall.maxHausdorff.toFixed(5)} mm`);
  check(`${tag}: node position distance <= ${TOL} mm`, cmp.overall.maxNodeDist <= TOL, `max ${cmp.overall.maxNodeDist.toFixed(5)} mm`);
  check(`${tag}: foundation path count equal`, cmp.overall.foundationPathsA === cmp.overall.foundationPathsB, `${cmp.overall.foundationPathsA} vs ${cmp.overall.foundationPathsB}`);
  check(`${tag}: foundation path Hausdorff <= ${TOL} mm`, cmp.overall.maxFoundationHausdorff <= TOL, `max ${cmp.overall.maxFoundationHausdorff.toFixed(5)} mm`);
  check(`${tag}: summary key set equal`, JSON.stringify(Object.keys(ref.summary)) === JSON.stringify(Object.keys(js.summary)));
  check(`${tag}: geom_compare verdict`, cmp.pass, cmp.pass ? 'PASS' : cmp.problems.slice(0, 5).join('; '));

  /* 5. bit-level walk over the whole tree (paths, caps, summary included) */
  const st = treeWalk(ref, js);
  console.log(`bit-level walk: ${st.numbers} numbers compared, ${st.differing} differ (worst ${st.worst} at ${st.worstPath || '-'}), ${st.structural.length} structural differences`);
  check(`${tag}: same key order and structure everywhere`, st.structural.length === 0, st.structural.slice(0, 3).join('; '));
  check(`${tag}: numbers bit-identical to the Python output`, st.differing === 0, `${st.differing} of ${st.numbers} differ${st.examples.length ? '; e.g. ' + st.examples.join('; ') : ''}`);

  /* 6. the printed golden (informational about the script's drift, a check on the port) */
  const goldenFile = path.join(ROOT, run.golden);
  if(!NO_GOLDEN && fs.existsSync(goldenFile)){
    const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8'));
    const capKey = (p) => /\.caps\[\d+\]\.(process|physicalStatus|evidence)$/.test(p);
    const sg = treeWalk(golden, js, [capKey]);
    const cg = compareGeometry(golden, js, { tol: TOL });
    console.log(`vs golden ${run.golden}: ${sg.numbers} numbers, ${sg.differing} differ, ${sg.structural.length} structural differences beyond the membrane-contract keys; comparer max Hausdorff ${cg.overall.maxHausdorff.toFixed(5)} mm, max node ${cg.overall.maxNodeDist.toFixed(5)} mm, ${cg.pass ? 'PASS' : 'FAIL'}`);
    check(`${tag}: golden geometry reproduced (numbers bit-identical, only the newer cap keys added)`, sg.differing === 0 && sg.structural.length === 0 && cg.pass, sg.structural.slice(0, 3).join('; ') || cg.problems.slice(0, 3).join('; '));
  } else console.log(`golden ${run.golden} ${NO_GOLDEN ? 'skipped' : 'not present'}`);
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (tolerance ${TOL} mm)`);
process.exit(failed.length ? 1 : 0);
}
// treeWalk is imported by tests/plate_geom_parity.test.mjs; the run happens only when executed directly
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
