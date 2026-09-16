#!/usr/bin/env node
/* tests/aero_geom_parity.test.mjs — the JavaScript port of aero_tower_geometry.py reproduces the Python,
 * for both towers.
 *
 *   node tests/aero_geom_parity.test.mjs [--tol 0.02] [--dir DIR] [--no-golden] [--quick] [--no-sensitivity] [--only NAME]
 *
 * For each run — the two specimen commands (RASEP on the A2L's measured bead 0.45 / 0.24 at --H 91.2
 * with every design flag at its default; VEO on the Ender's bead 0.42 / 0.20 at --H 78 --w0 1.25
 * --w1 1.55, the flags weft.mjs `build aero` passed), a VEO with every design flag off its default
 * (accepted), a RASEP the script refuses after measuring (the plate margin) and one it refuses up
 * front (--maxbridge above the 16 mm LIMIT16 evidence) — the test runs aero_tower_geometry.py NOW
 * (python3, stdlib only) into DIR (default: the OS temp dir), runs core/weft_aero_geometry.mjs with the
 * same flags in-process (and once through its CLI), and compares:
 *   bytes   : the geometry JSON the port writes (its json.dumps twin) against the Python file, the
 *             preview SVG and the c3d-intent file against the Python's, the printed summary against
 *             the Python stdout, and for a refused run the REFUSED line on stderr, the exit status and
 *             the absence of a file;
 *   geometry: through tests/geom_compare.mjs — layer count, contour count per layer, node count per
 *             contour, symmetric Hausdorff of every contour and foundation path, node positions,
 *             summary key set, all distances <= --tol mm (default 0.02);
 *   tree    : both JSON trees walked, every number compared bit for bit (summary and foundation
 *             included), key order and structure checked everywhere; on a difference the first
 *             differing number is named with the Python line that writes it.
 * With the specimen goldens present (specimens/2026-09-04_RASEP_A2L_X1_experimental,
 * specimens/2026-09-04_VEO_ENDER3V4_X1_experimental) the port is also compared with them byte for byte
 * (the golden c3d-intent files carry the CRLF line endings of the Windows build that wrote them; they
 * are compared with those normalised), and the Python-now file with the golden (drift since the build).
 * The script leans on the C library's sin / cos and on pow(x, 2.0) for `** 2`, which V8 computes
 * differently in the last bit for ~3.5% (sin/cos) and 0.09% (pow) of arguments (core/weft_geom_ext2.js,
 * core/weft_geom_ext4.js). The last check of each accepted run measures the port's sensitivity: the
 * same generator with every sin / cos result moved by one ulp on a deterministic 3% of calls, and every
 * pow result on 0.1%, must still write the same bytes.
 * --quick runs the two specimen commands only; --only NAME one case; --no-sensitivity skips the perturbation.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateAero, toJson, previewPathFor, c3dPathFor } from '../core/weft_aero_geometry.mjs';
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
const NO_SENS = argv.includes('--no-sensitivity');
const ONLY = opt('only', null);

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/** Which line of aero_tower_geometry.py writes the number at this JSON path (for localising a difference). */
export function pyLineFor(p){
  const m = /^\$\.(\w+)(?:\[\d+\])?(?:\.(\w+))?(?:\[\d+\])?(?:\.(\w+))?/.exec(p) || [];
  const top = m[1], k2 = m[2], k3 = m[3];
  if(top === 'layers'){
    if(k2 === 'contours') return { pts: 'contour_record(): line 130 (loop_points 97-109, rib_center 78-94)', nrm: 'contour_record(): line 131 (normals 115-121)', cum: 'contour_record(): line 132 (122-124)',
      total: 'contour_record(): line 133', nodes: 'contour_record(): line 134', K: 'contour_record(): line 135 (126-128)', maxNodeGap: 'contour_record(): line 136',
      w: 'contour_record(): line 138', e: 'contour_record(): line 138' }[k3] || 'contour_record(): lines 129-139';
    return { k: 'line 166', zBot: 'line 166', zTop: 'line 166', w: 'line 167 (wall_at 66-67)', tab: 'line 167' }[k2] || 'lines 165-169';
  }
  if(top === 'foundation') return 'rings: lines 177-178 / spokes: line 183 (base_centers 173, outer 174)';
  if(top === 'summary') return { N: 'line 197 (43)', H: 'line 197 (44)', args: 'lines 198-204', design: 'lines 205-215', supportCheck: 'lines 216-219 (160-162, 193)',
    nodeDensity: 'line 220', foundation: 'line 221', wallWidth: 'line 222', bbox_mm: 'line 223 (187-188)', size_mm: 'line 224 (189)' }[k2] || 'summary: lines 195-227';
  return '?';
}

function firstByteDiff(a, b){ const n = Math.min(a.length, b.length); for(let i = 0; i < n; i++) if(a[i] !== b[i]) return i; return a.length === b.length ? -1 : n; }
const around = (s, i) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 30));

export const RUNS = [
  { tag: 'RASEP (a2l)', name: 'rasep', flags: ['--variant', 'rasep', '--H', '91.2', '--bead', '0.45', '--lh', '0.24', '--plate', '330', '320'],
    args: { variant: 'rasep', H: 91.2, bead: 0.45, lh: 0.24, plate: [330, 320] },
    golden: 'specimens/2026-09-04_RASEP_A2L_X1_experimental/RASEP_A2L_X1_geometry.json', goldenSvg: 'specimens/2026-09-04_RASEP_A2L_X1_experimental/RASEP_A2L_X1_preview.svg',
    goldenC3d: 'specimens/2026-09-04_RASEP_A2L_X1_experimental/RASEP_A2L_X1_c3d_intent.json', cli: true },
  { tag: 'VEO (ender)', name: 'veo', flags: ['--variant', 'veo', '--H', '78', '--bead', '0.42', '--lh', '0.2', '--plate', '220', '220', '--w0', '1.25', '--w1', '1.55'],
    args: { variant: 'veo', H: 78, bead: 0.42, lh: 0.2, plate: [220, 220], w0: 1.25, w1: 1.55 },
    golden: 'specimens/2026-09-04_VEO_ENDER3V4_X1_experimental/VEO_ENDER3V4_X1_geometry.json', goldenSvg: 'specimens/2026-09-04_VEO_ENDER3V4_X1_experimental/VEO_ENDER3V4_X1_preview.svg',
    goldenC3d: 'specimens/2026-09-04_VEO_ENDER3V4_X1_experimental/VEO_ENDER3V4_X1_c3d_intent.json' },
  /* off the goldens: a VEO with every design flag away from its default, on the A1's plate and bead (accepted, risk "extreme") */
  { tag: 'VEO variant (accepted)', name: 'veo_v', extra: true,
    flags: ['--variant', 'veo', '--H', '60', '--bead', '0.45', '--lh', '0.24', '--plate', '256', '256', '--turns', '0.3', '--w0', '1.4', '--w1', '1.9', '--K', '12', '--foundation', '8', '--maxbridge', '12'],
    args: { variant: 'veo', H: 60, bead: 0.45, lh: 0.24, plate: [256, 256], turns: 0.3, w0: 1.4, w1: 1.9, K: 12, foundation: 8, maxbridge: 12 } },
  /* off the goldens: a RASEP the script REFUSES after measuring — the plate margin */
  { tag: 'RASEP variant (refused: measured)', name: 'rasep_r', extra: true, refused: true,
    flags: ['--variant', 'rasep', '--H', '91.2', '--bead', '0.45', '--lh', '0.24', '--plate', '80', '80'],
    args: { variant: 'rasep', H: 91.2, bead: 0.45, lh: 0.24, plate: [80, 80] } },
  /* off the goldens: a RASEP refused up front (--maxbridge above the LIMIT16 evidence) */
  { tag: 'RASEP variant (refused: up front)', name: 'rasep_u', extra: true, refused: true,
    flags: ['--variant', 'rasep', '--H', '91.2', '--bead', '0.45', '--lh', '0.24', '--plate', '330', '320', '--maxbridge', '20'],
    args: { variant: 'rasep', H: 91.2, bead: 0.45, lh: 0.24, plate: [330, 320], maxbridge: 20 } },
];

function main(){
const timings = [];
for(const run of RUNS){
  if(QUICK && run.extra) continue;
  if(ONLY && ONLY !== run.name) continue;
  const tag = run.tag;
  const REF = path.join(DIR, `aero_py_${run.name}_geometry.json`), REFSVG = previewPathFor(REF), REFC3D = c3dPathFor(REF);
  const OUT = path.join(DIR, `aero_js_${run.name}_geometry.json`), OUTSVG = previewPathFor(OUT), OUTC3D = c3dPathFor(OUT);
  for(const f of [REF, REFSVG, REFC3D, OUT, OUTSVG, OUTC3D]) if(fs.existsSync(f)) fs.unlinkSync(f);
  console.log(`\n===== ${tag} =====`);

  /* 1. the Python reference, produced now */
  const pyArgs = [path.join(ROOT, 'aero_tower_geometry.py'), ...run.flags, '--out', REF];
  const t0 = process.hrtime.bigint();
  const r = spawnSync(PY, pyArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const tPy = Number(process.hrtime.bigint() - t0) / 1e9;
  if(r.error || (run.refused ? r.status !== 1 : (r.status !== 0 || !fs.existsSync(REF)))){
    console.error(`cannot produce the Python reference (${r.error ? r.error.message : 'exit ' + r.status}). Run: ${PY} ${pyArgs.join(' ')}\n${r.stderr}`);
    process.exit(2);
  }

  /* 2. the JavaScript generator, same flags, in-process */
  const t1 = process.hrtime.bigint();
  let g = null, refusal = null;
  try { g = generateAero(run.args); } catch(e){ if(e.message.startsWith('REFUSED:')) refusal = e.message; else throw e; }
  const jsText = g ? toJson(g.payload) : null;
  const tJs = Number(process.hrtime.bigint() - t1) / 1e9;
  timings.push({ tag, python_s: tPy, js_s: tJs });

  if(run.refused){
    console.log(`Python: refused in ${tPy.toFixed(2)} s; JS: refused in ${tJs.toFixed(3)} s`);
    check(`${tag}: both refuse`, r.status === 1 && refusal !== null, `python exit ${r.status}; JS: ${refusal}`);
    check(`${tag}: REFUSED line identical`, r.stderr.trim() === (refusal || '').trim(), r.stderr.trim());
    check(`${tag}: no geometry file written`, !fs.existsSync(REF) && jsText === null);
    check(`${tag}: nothing on stdout`, r.stdout === '');
    const c = spawnSync(process.execPath, [path.join(ROOT, 'core/weft_aero_geometry.mjs'), ...run.flags, '--out', OUT], { cwd: ROOT, encoding: 'utf8' });
    check(`${tag}: CLI exit status and stderr identical to the Python`, c.status === 1 && c.stderr.trim() === r.stderr.trim() && !fs.existsSync(OUT), `exit ${c.status}`);
    continue;
  }

  const refText = fs.readFileSync(REF, 'utf8');
  const ref = JSON.parse(refText);
  console.log(`Python generator: ${tPy.toFixed(2)} s (process), ${ref.layers.length} layers, ${refText.length} bytes -> ${REF}`);
  fs.writeFileSync(OUT, jsText); fs.writeFileSync(OUTSVG, g.svg()); fs.writeFileSync(OUTC3D, g.c3dJson());
  console.log(`JS generator: ${tJs.toFixed(3)} s (in-process, generate + serialise), ${g.payload.layers.length} layers -> ${OUT}`);
  const js = JSON.parse(fs.readFileSync(OUT, 'utf8'));   // compare what is on disk, as the builder will read it

  /* 3. bytes */
  const fd = firstByteDiff(jsText, refText);
  check(`${tag}: geometry JSON byte-identical to the Python file`, fd < 0, fd < 0 ? `${jsText.length} bytes` : `first difference at byte ${fd}: python ...${around(refText, fd)} vs js ...${around(jsText, fd)}`);
  const pySvg = fs.readFileSync(REFSVG, 'utf8');
  const sfd = firstByteDiff(g.svg(), pySvg);
  check(`${tag}: preview SVG byte-identical to the Python file`, sfd < 0, sfd < 0 ? `${pySvg.length} bytes` : `first difference at byte ${sfd}: python ...${around(pySvg, sfd)} vs js ...${around(g.svg(), sfd)}`);
  const pyC3d = fs.readFileSync(REFC3D, 'utf8');
  check(`${tag}: c3d-intent JSON byte-identical to the Python file`, g.c3dJson() === pyC3d, `${pyC3d.length} bytes`);
  const stdoutSame = r.stdout === g.stdout(REFSVG, REFC3D);
  check(`${tag}: printed summary + PREVIEW + C3D_INTENT lines byte-identical`, stdoutSame, stdoutSame ? `${r.stdout.length} bytes` : 'differs');
  if(run.cli){
    const c = spawnSync(process.execPath, [path.join(ROOT, 'core/weft_aero_geometry.mjs'), ...run.flags, '--out', OUT], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const cliSame = c.status === 0 && fs.readFileSync(OUT, 'utf8') === refText && fs.readFileSync(OUTSVG, 'utf8') === pySvg && fs.readFileSync(OUTC3D, 'utf8') === pyC3d && c.stdout === g.stdout(OUTSVG, OUTC3D);
    check(`${tag}: the CLI writes the same JSON, SVG and c3d-intent and prints the same lines`, cliSame, `exit ${c.status}`);
  }

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

  /* 5. bit-level walk over the whole tree */
  const st = treeWalk(ref, js);
  console.log(`bit-level walk: ${st.numbers} numbers compared, ${st.differing} differ (worst ${st.worst} at ${st.worstPath || '-'}), ${st.structural.length} structural differences`);
  check(`${tag}: same key order and structure everywhere`, st.structural.length === 0, st.structural.slice(0, 3).join('; '));
  check(`${tag}: numbers bit-identical to the Python output`, st.differing === 0,
    st.differing === 0 ? `${st.numbers} numbers` : `${st.differing} of ${st.numbers} differ; first: ${st.examples[0]} — written by aero_tower_geometry.py ${pyLineFor(st.examples[0].split(':')[0])}`);

  /* 6. the specimen golden */
  const goldenFile = run.golden && path.join(ROOT, run.golden);
  if(!NO_GOLDEN && goldenFile && fs.existsSync(goldenFile)){
    const goldenText = fs.readFileSync(goldenFile, 'utf8');
    const golden = JSON.parse(goldenText);
    const sg = treeWalk(golden, js);
    const cg = compareGeometry(golden, js, { tol: TOL });
    const gfd = firstByteDiff(jsText, goldenText);
    console.log(`vs golden ${run.golden}: ${sg.numbers} numbers, ${sg.differing} differ, ${sg.structural.length} structural differences; comparer max Hausdorff ${cg.overall.maxHausdorff.toFixed(5)} mm, max node ${cg.overall.maxNodeDist.toFixed(5)} mm, ${cg.pass ? 'PASS' : 'FAIL'}`);
    check(`${tag}: golden geometry reproduced byte for byte`, gfd < 0 && sg.differing === 0 && sg.structural.length === 0 && cg.pass,
      gfd < 0 ? `${goldenText.length} bytes` : `first difference at byte ${gfd}: golden ...${around(goldenText, gfd)} vs js ...${around(jsText, gfd)}`);
    const gsvg = run.goldenSvg && path.join(ROOT, run.goldenSvg);
    if(gsvg && fs.existsSync(gsvg)) check(`${tag}: golden preview SVG reproduced byte for byte`, fs.readFileSync(gsvg, 'utf8') === g.svg());
    const gc3d = run.goldenC3d && path.join(ROOT, run.goldenC3d);
    if(gc3d && fs.existsSync(gc3d)){
      const raw = fs.readFileSync(gc3d, 'utf8');
      const crlf = raw.includes('\r\n');
      check(`${tag}: golden c3d-intent reproduced${crlf ? ' (CRLF of the Windows build normalised)' : ' byte for byte'}`, raw.replace(/\r\n/g, '\n') === g.c3dJson(), crlf ? `${raw.length} bytes with CRLF vs ${g.c3dJson().length} with LF` : `${raw.length} bytes`);
    }
    const sp = treeWalk(golden, ref);
    check(`${tag}: Python-now still reproduces its golden (no drift since the build)`, goldenText === refText, goldenText === refText ? 'identical' : `${sp.differing} number(s) differ, ${sp.structural.length} structural`);
  } else console.log(`golden ${run.golden || '-'} ${NO_GOLDEN ? 'skipped' : 'not present'}`);

  /* 7. sensitivity to the C library's last bit: sin/cos on 3% of calls, pow(x, 2.0) on 0.1% */
  if(!NO_SENS){
    const ulp = (x) => { const b = new Float64Array([x]); const u = new BigUint64Array(b.buffer); u[0] += (u[0] & 1n) ? 1n : -1n; return b[0]; };
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pert = (f, rate) => (...x) => { const v = f(...x); return (v !== 0 && rnd() < rate) ? ulp(v) : v; };
    const prev = setLibm({ sin: pert(Math.sin, 0.03), cos: pert(Math.cos, 0.03), pow: pert(Math.pow, 0.001) });
    let pText;
    try { pText = toJson(generateAero(run.args).payload); } finally { setLibm(prev); }
    const pfd = firstByteDiff(pText, refText);
    check(`${tag}: one-ulp perturbation of 3% of sin/cos and 0.1% of pow calls leaves the JSON byte-identical`, pfd < 0, pfd < 0 ? 'the 3-5 decimal rounding absorbs the last bit' : `first difference at byte ${pfd}: ...${around(refText, pfd)} vs ...${around(pText, pfd)}`);
  }
}

console.log('\ntimings:'); for(const t of timings) console.log(`  ${t.tag.padEnd(36)} python ${t.python_s.toFixed(2)} s (process)   js ${t.js_s.toFixed(3)} s (in-process)`);
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (tolerance ${TOL} mm)`);
process.exit(failed.length ? 1 : 0);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
