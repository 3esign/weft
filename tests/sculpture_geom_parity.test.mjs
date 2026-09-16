#!/usr/bin/env node
/* tests/sculpture_geom_parity.test.mjs — the JavaScript port of sculpture_geometry.py reproduces the
 * Python, for both bodies.
 *
 *   node tests/sculpture_geom_parity.test.mjs [--tol 0.02] [--dir DIR] [--no-golden] [--quick]
 *
 * For each run (the two specimen commands — GORA on the Ender bead, OBLAK on the A2L bead — plus one
 * accepted and one refused parameter set off the goldens) the test runs sculpture_geometry.py NOW
 * (python3, stdlib only) into DIR (default: the OS temp dir), runs core/weft_sculpture_geometry.mjs
 * with the same flags, and compares:
 *   bytes   : the geometry JSON the port writes (its json.dumps twin) against the Python file, the
 *             preview SVG against the Python SVG, the printed summary against the Python stdout, and
 *             for a refused run the .rejected file and the REFUSED lines on stderr;
 *   geometry: through tests/geom_compare.mjs — layer count, contour count per layer, node count per
 *             contour, symmetric Hausdorff of every contour and foundation path, node positions,
 *             summary key set, all distances <= --tol mm (default 0.02);
 *   tree    : both JSON trees walked, every number compared bit for bit (typed paths, the crown and
 *             the summary included — geom_compare only looks at contours, nodes and foundation), key
 *             order and structure checked everywhere; on a difference the first differing number is
 *             named with the Python line that writes it.
 * With the specimen goldens present (specimens/2026-09-05_GORA_ENDER3V4_X1_experimental,
 * specimens/2026-09-05_OBLAK_A2L_X1_experimental, the latter gzipped) the port is also compared with
 * them byte for byte.
 * The script leans on the C library's sin/cos/atan2/pow, which V8 computes differently in the last
 * bit for ~3% of arguments (core/weft_geom_ext2.js). The last check measures the port's sensitivity:
 * the same generator with every sin/cos result moved by one ulp on a deterministic 3% of calls must
 * still write the same bytes — the 2-4 decimal rounding of the script absorbs the last bit.
 * --quick skips the extra parameter sets.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateSculpture, toJson } from '../core/weft_sculpture_geometry.mjs';
import { setLibm } from '../core/weft_geom_ext2.js';
import { compareGeometry, formatReport } from './geom_compare.mjs';
import { treeWalk } from './limit16_geom_parity.test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const TOL = +opt('tol', 0.02);
const DIR = opt('dir', os.tmpdir());
const PY = process.env.WEFT_PYTHON || 'python3';
const NO_GOLDEN = argv.includes('--no-golden');
const QUICK = argv.includes('--quick');

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/** Which line of sculpture_geometry.py writes the number at this JSON path (for localising a difference). */
function pyLineFor(p){
  const m = /^\$\.(\w+)(?:\[\d+\])?(?:\.(\w+))?(?:\[\d+\])?(?:\.(\w+))?/.exec(p) || [];
  const top = m[1], k2 = m[2], k3 = m[3];
  if(top === 'layers'){
    if(k2 === 'contours'){
      const key = k3;
      return { pts: 'record(): line 269', nrm: 'record(): line 270', cum: 'record(): line 271', total: 'record(): line 272',
        nodes: 'record(): line 265', K: 'record(): line 273', maxNodeGap: 'record(): line 274', w: 'record(): line 276', e: 'record(): line 276',
        breath: 'record(): line 278', amp: 'record(): line 279', lambda: 'record(): line 282' }[key] || 'record(): lines 268-284';
    }
    if(k2 === 'paths') return 'chord(): lines 562-567 (iris chords)';
    return { zBot: 'line 527', zTop: 'line 527', w: 'line 527 (wall_nominal 320-330)', tab: 'line 527 (tab_nominal 333-339)', k: 'line 527' }[k2] || 'lines 527-528 / 599-600';
  }
  if(top === 'foundation') return 'offset_ring(): line 627 / spokes: line 646';
  if(top === 'summary') return { H: 'line 711', args: 'lines 713-717', experiments: 'lines 732-739', supportCheck: 'lines 743-745', nodeDensity: 'line 746',
    geometry: 'lines 747-748', wallWidth: 'line 750', bbox_mm: 'line 751', size_mm: 'line 752', events: 'lines 531 / 601' }[k2] || 'summary: lines 710-757';
  return '?';
}

function firstByteDiff(a, b){ const n = Math.min(a.length, b.length); for(let i = 0; i < n; i++) if(a[i] !== b[i]) return i; return a.length === b.length ? -1 : n; }
const around = (s, i) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 30));

export const RUNS = [
  { tag: 'GORA (ender bead)', name: 'gora', flags: ['--variant', 'gora', '--bead', '0.42', '--lh', '0.2', '--plate', '220', '220'],
    args: { variant: 'gora', bead: 0.42, lh: 0.2, plate: [220, 220] },
    golden: 'specimens/2026-09-05_GORA_ENDER3V4_X1_experimental/GORA_ENDER3V4_X1_geometry.json',
    goldenSvg: 'specimens/2026-09-05_GORA_ENDER3V4_X1_experimental/GORA_ENDER3V4_X1_preview.svg' },
  { tag: 'OBLAK (a2l bead)', name: 'oblak', flags: ['--variant', 'oblak', '--bead', '0.45', '--lh', '0.24', '--plate', '330', '320'],
    args: { variant: 'oblak', bead: 0.45, lh: 0.24, plate: [330, 320] },
    golden: 'specimens/2026-09-05_OBLAK_A2L_X1_experimental/OBLAK_A2L_X1_geometry.json.gz',
    goldenSvg: 'specimens/2026-09-05_OBLAK_A2L_X1_experimental/OBLAK_A2L_X1_preview.svg' },
  /* off the goldens: a smaller, more twisted GORA with its own lintels and horns (accepted) */
  { tag: 'GORA variant (accepted)', name: 'gora_v', extra: true,
    flags: ['--variant', 'gora', '--bead', '0.45', '--lh', '0.24', '--plate', '256', '256', '--H', '170', '--turns', '0.3', '--relief', '1.2', '--lintels', '25,35,45', '--fins', '18,26,34', '--fin-rate', '0.7'],
    args: { variant: 'gora', bead: 0.45, lh: 0.24, plate: [256, 256], H: 170, turns: 0.3, relief: 1.2, lintels: '25,35,45', fins: '18,26,34', fin_rate: 0.7 } },
  /* off the goldens: an OBLAK the script REFUSES (a concave radius below w/2+e+bead) — the refusal path */
  { tag: 'OBLAK variant (refused)', name: 'oblak_r', extra: true, refused: true,
    flags: ['--variant', 'oblak', '--bead', '0.45', '--lh', '0.24', '--plate', '330', '320', '--R', '120', '--turns', '0.25', '--relief', '0.8'],
    args: { variant: 'oblak', bead: 0.45, lh: 0.24, plate: [330, 320], R: 120, turns: 0.25, relief: 0.8 } },
];

function main(){
const timings = [];
for(const run of RUNS){
  if(QUICK && run.extra) continue;
  const tag = run.tag;
  const REF = path.join(DIR, `sculpture_py_${run.name}_geometry.json`), REFSVG = path.join(DIR, `sculpture_py_${run.name}_preview.svg`), REFREJ = path.join(DIR, `sculpture_py_${run.name}_geometry.rejected`);
  const OUT = path.join(DIR, `sculpture_js_${run.name}_geometry.json`), OUTSVG = path.join(DIR, `sculpture_js_${run.name}_preview.svg`);
  for(const f of [REF, REFSVG, REFREJ, OUT, OUTSVG]) if(fs.existsSync(f)) fs.unlinkSync(f);
  console.log(`\n===== ${tag} =====`);

  /* 1. the Python reference, produced now */
  const pyArgs = [path.join(ROOT, 'sculpture_geometry.py'), ...run.flags, '--out', REF];
  const t0 = process.hrtime.bigint();
  const r = spawnSync(PY, pyArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const tPy = Number(process.hrtime.bigint() - t0) / 1e9;
  if(r.error || (run.refused ? r.status !== 1 : (r.status !== 0 || !fs.existsSync(REF)))){
    console.error(`cannot produce the Python reference (${r.error ? r.error.message : 'exit ' + r.status}). Run: ${PY} ${pyArgs.join(' ')}\n${r.stderr}`);
    process.exit(2);
  }
  const pyStdoutLines = r.stdout.split('\n').filter(l => !l.startsWith('PREVIEW '));
  const pyPreviewLine = r.stdout.split('\n').find(l => l.startsWith('PREVIEW ')) || '';

  /* 2. the JavaScript generator, same flags */
  const t1 = process.hrtime.bigint();
  const g = generateSculpture(run.args);
  const jsText = g.violations.length ? null : toJson(g.payload);
  const tJs = Number(process.hrtime.bigint() - t1) / 1e9;
  timings.push({ tag, python_s: tPy, js_s: tJs });

  if(run.refused){
    /* the refusal path: the same violations, the same .rejected file, the same stdout */
    const rej = fs.existsSync(REFREJ) ? fs.readFileSync(REFREJ, 'utf8') : null;
    console.log(`Python: refused in ${tPy.toFixed(2)} s; JS: refused in ${tJs.toFixed(3)} s (${g.violations.length} violation(s))`);
    check(`${tag}: both refuse`, r.status === 1 && g.violations.length > 0, `python exit ${r.status}, JS violations ${g.violations.length}`);
    check(`${tag}: REFUSED lines identical`, r.stderr.trim() === ('REFUSED:\n' + g.violations.map(v => '  * ' + v).join('\n')).trim(), r.stderr.trim().split('\n').slice(0, 3).join(' | '));
    check(`${tag}: .rejected summary byte-identical`, rej !== null && rej === g.stdout(), rej === null ? 'no .rejected written by Python' : `${rej.length} bytes`);
    check(`${tag}: printed summary byte-identical`, pyStdoutLines.join('\n') === g.stdout() + '\n' || pyStdoutLines.join('\n').trim() === g.stdout().trim());
    check(`${tag}: no geometry file written`, !fs.existsSync(REF) && jsText === null);
    continue;
  }

  const refText = fs.readFileSync(REF, 'utf8');
  const ref = JSON.parse(refText);
  console.log(`Python generator: ${tPy.toFixed(2)} s (process), ${ref.layers.length} layers, ${refText.length} bytes -> ${REF}`);
  fs.writeFileSync(OUT, jsText); fs.writeFileSync(OUTSVG, g.svg());
  console.log(`JS generator: ${tJs.toFixed(3)} s (in-process, generate + serialise), ${g.payload.layers.length} layers -> ${OUT}`);
  const js = JSON.parse(fs.readFileSync(OUT, 'utf8'));   // compare what is on disk, as the builder will read it

  /* 3. bytes */
  const svgSame = fs.readFileSync(REFSVG, 'utf8') === fs.readFileSync(OUTSVG, 'utf8');
  const fd = firstByteDiff(jsText, refText);
  check(`${tag}: geometry JSON byte-identical to the Python file`, fd < 0, fd < 0 ? `${jsText.length} bytes` : `first difference at byte ${fd}: python ...${around(refText, fd)} vs js ...${around(jsText, fd)}`);
  check(`${tag}: preview SVG byte-identical to the Python file`, svgSame);
  const stdoutSame = pyStdoutLines.join('\n').trim() === g.stdout().trim();
  check(`${tag}: printed summary byte-identical`, stdoutSame, stdoutSame ? '' : 'differs');
  check(`${tag}: preview file named like the Python`, path.basename(pyPreviewLine.slice(8)) === path.basename(REF).replace('_geometry.json', '_preview.svg'), pyPreviewLine);

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

  /* 5. bit-level walk over the whole tree (paths, crown, summary included) */
  const st = treeWalk(ref, js);
  console.log(`bit-level walk: ${st.numbers} numbers compared, ${st.differing} differ (worst ${st.worst} at ${st.worstPath || '-'}), ${st.structural.length} structural differences`);
  check(`${tag}: same key order and structure everywhere`, st.structural.length === 0, st.structural.slice(0, 3).join('; '));
  check(`${tag}: numbers bit-identical to the Python output`, st.differing === 0,
    st.differing === 0 ? `${st.numbers} numbers` : `${st.differing} of ${st.numbers} differ; first: ${st.examples[0]} — written by sculpture_geometry.py ${pyLineFor(st.examples[0].split(':')[0])}`);

  /* 6. the specimen golden (the Python's drift since the build, and a check on the port) */
  const goldenFile = run.golden && path.join(ROOT, run.golden);
  if(!NO_GOLDEN && goldenFile && fs.existsSync(goldenFile)){
    const raw = fs.readFileSync(goldenFile);
    const goldenText = goldenFile.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    const golden = JSON.parse(goldenText);
    const sg = treeWalk(golden, js);
    const cg = compareGeometry(golden, js, { tol: TOL });
    const gfd = firstByteDiff(jsText, goldenText);
    console.log(`vs golden ${run.golden}: ${sg.numbers} numbers, ${sg.differing} differ, ${sg.structural.length} structural differences; comparer max Hausdorff ${cg.overall.maxHausdorff.toFixed(5)} mm, max node ${cg.overall.maxNodeDist.toFixed(5)} mm, ${cg.pass ? 'PASS' : 'FAIL'}`);
    check(`${tag}: golden geometry reproduced byte for byte`, gfd < 0 && sg.differing === 0 && sg.structural.length === 0 && cg.pass,
      gfd < 0 ? `${goldenText.length} bytes` : `first difference at byte ${gfd}: golden ...${around(goldenText, gfd)} vs js ...${around(jsText, gfd)}`);
    const gsvg = run.goldenSvg && path.join(ROOT, run.goldenSvg);
    if(gsvg && fs.existsSync(gsvg)){
      /* the specimen SVGs carry a C2PA content-credentials manifest (7774 bytes) that the tool which
         saved them injected after the script wrote the file; the script's own text is what is under it */
      const raw2 = fs.readFileSync(gsvg, 'utf8');
      const stripped = raw2.replace(/ xmlns:c2pa="[^"]*"/, '').replace(/<metadata><c2pa:manifest>[^<]*<\/c2pa:manifest><\/metadata>/, '');
      check(`${tag}: golden preview SVG reproduced byte for byte (C2PA manifest stripped)`, stripped === g.svg(), raw2.length !== stripped.length ? `${raw2.length - stripped.length} bytes of injected manifest ignored` : '');
    }
    /* the golden was written by python-now's twin: say whether the Python has drifted since the build */
    check(`${tag}: Python-now still reproduces its golden (no drift since the build)`, goldenText === refText);
  } else console.log(`golden ${run.golden || '-'} ${NO_GOLDEN ? 'skipped' : 'not present'}`);

  /* 7. sensitivity to the C library's last bit: move a deterministic 3% of sin/cos results by one ulp */
  {
    const ulp = (x) => { const b = new Float64Array([x]); const u = new BigUint64Array(b.buffer); u[0] += (u[0] & 1n) ? 1n : -1n; return b[0]; };
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pert = (f) => (x) => { const v = f(x); return (v !== 0 && rnd() < 0.03) ? ulp(v) : v; };
    const prev = setLibm({ sin: pert(Math.sin), cos: pert(Math.cos) });
    let pText;
    try { pText = toJson(generateSculpture(run.args).payload); } finally { setLibm(prev); }
    const pfd = firstByteDiff(pText, refText);
    check(`${tag}: one-ulp perturbation of 3% of sin/cos calls leaves the JSON byte-identical`, pfd < 0, pfd < 0 ? 'the 2-4 decimal rounding absorbs the last bit' : `first difference at byte ${pfd}: ...${around(refText, pfd)} vs ...${around(pText, pfd)}`);
  }
}

console.log('\ntimings:'); for(const t of timings) console.log(`  ${t.tag.padEnd(28)} python ${t.python_s.toFixed(2)} s (process)   js ${t.js_s.toFixed(3)} s (in-process)`);
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (tolerance ${TOL} mm)`);
process.exit(failed.length ? 1 : 0);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
