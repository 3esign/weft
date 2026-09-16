#!/usr/bin/env node
/* tests/climber_geom_parity.test.mjs — the JavaScript port of climber_geometry.py reproduces the Python.
 *
 *   node tests/climber_geom_parity.test.mjs [--tol 0.02] [--dir DIR] [--no-golden] [--quick] [--no-sensitivity] [--only NAME]
 *
 * For each run — the printed specimen's command (P2b_penjac_3_A2L: --legs 3 --H 240 on the A2L's
 * measured bead 0.45 / 0.24, as `weft.py build climber --machine a2l --H 240 --legs 3` invokes it),
 * the pending Ender tripod (--legs 3 --H 168 on 0.42 / 0.20), a 200 mm tripod with every design flag
 * off its default (K, w0, w1, foundation, rib, res), a two-legged figure with the same flags that the
 * script REFUSES (a reach outruns maxBridge), and a 12 mm figure it refuses at once — the test runs climber_geometry.py NOW (python3 with numpy/scipy/scikit-image) into DIR
 * (default: the OS temp dir), runs core/weft_climber_geometry.mjs with the same flags in-process, and
 * compares:
 *   bytes   : the geometry JSON the port writes (its json.dump twin, the Python's --out path carried in
 *             summary.args.out) against the Python file, byte for byte; for a refused run the .rejected
 *             file, the REFUSED lines on stderr and the absence of a geometry file; the two printed
 *             stdout lines (the summary cut at 1900 characters, PHASES) and the raster / progress lines
 *             on stderr;
 *   geometry: through tests/geom_compare.mjs — layer count, contour count per layer, node count per
 *             contour, symmetric Hausdorff of every contour and foundation path, node positions,
 *             summary key set, all distances <= --tol mm (default 0.02);
 *   tree    : both JSON trees walked, every number compared bit for bit (caps, foundation and the
 *             summary included), key order and structure checked everywhere; on a difference the first
 *             differing number is named with the Python line that writes it.
 * With the specimen golden present (specimens/2026-09-02_P2b_penjac_3legs_A2L_physical, gzipped) the
 * port is also compared with it: the golden predates two changes of the script — caps then carried
 * span_mm = pitch (the field now holds the membrane's diameter) and had no membrane-contract keys
 * (process / physicalStatus / evidence) — so that comparison expects exactly those differences.
 * The script leans on the C library's sin / cos / atan2 / acos / pow, which V8 computes differently in
 * the last bit for a few percent of arguments (core/weft_geom_ext2.js); the last check of the specimen
 * run measures the port's sensitivity: the same generator with every sin / cos / atan2 / acos result
 * moved by one ulp on a deterministic 3% of calls must still write the same bytes.
 * --quick runs the specimen command only; --only NAME one case; --no-sensitivity skips the perturbation run.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateClimber } from '../core/weft_climber_geometry.mjs';
import { setLibm } from '../core/weft_geom_ext2.js';
import { setLibmAcos } from '../core/weft_geom_ext3.js';
import { compareGeometry, formatReport } from './geom_compare.mjs';
import { treeWalk } from './limit16_geom_parity.test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Which line of the Python writes the number at this JSON path. `lineOffset` is the constant shift
 *  of the shared engine between the two scripts (vase_geometry.py = climber_geometry.py - 62). */
export function pyLineFor(p, lineOffset = 0){
  const L = (n) => n - lineOffset;
  const m = /^\$\.(\w+)(?:\[\d+\])?(?:\.(\w+))?(?:\[\d+\])?(?:\.(\w+))?/.exec(p) || [];
  const top = m[1], k2 = m[2], k3 = m[3];
  if(top === 'layers'){
    if(k2 === 'contours') return { pts: `line ${L(676)} (resample ${L(290)}-${L(297)})`, nrm: `line ${L(676)} (normals ${L(299)}-${L(302)})`, cum: `line ${L(677)}`, total: `line ${L(677)}`,
      nodes: `line ${L(677)} (nodes_for ${L(338)}-${L(380)}, split ${L(618)}-${L(632)})`, K: `line ${L(677)}`, minTipGap: `line ${L(731)} (restated) / ${L(678)}`, maxNodeGap: `line ${L(680)}` }[k3] || `lines ${L(676)}-${L(680)}`;
    if(k2 === 'caps') return { pts: `spiral(): lines ${L(264)}-${L(268)}`, pitch_mm: `line ${L(466)} / ${L(493)}`, r_mm: `line ${L(466)} / ${L(493)}`, c: `line ${L(467)} / ${L(494)}`, span_mm: `line ${L(468)} / ${L(495)}` }[k3] || `lines ${L(465)}-${L(497)}`;
    return { k: `line ${L(533)}`, zBot: `line ${L(533)}`, zTop: `line ${L(533)}`, w: `line ${L(721)} (rate limit ${L(714)}-${L(718)}; solve ${L(660)})`, tab: `line ${L(721)} (rate limit; solve ${L(660)})`,
      wScale: `line ${L(661)}`, reachCap: `line ${L(661)} (reach_bound ${L(317)}-${L(336)}, curv_at ${L(304)}-${L(315)})`, railGap: `line ${L(665)} (railgap ${L(555)}-${L(577)})`, minTipGap: `line ${L(733)} / ${L(683)}`,
      maxStep: `line ${L(691)}`, allow: `line ${L(691)}`, wCeil: `line ${L(721)}`, overAir_mm: `line ${L(761)} (${L(742)}-${L(760)})` }[k2] || `lines ${L(533)}-${L(698)}`;
  }
  if(top === 'foundation') return { paths: `build_foundation(): lines ${L(419)}/${L(422)} (rings ${L(407)}-${L(414)}, tour ${L(423)}-${L(432)})`, zTop: `line ${L(433)}` }[k2] || `build_foundation(): lines ${L(433)}-${L(435)}`;
  if(top === 'summary') return { N: `line ${L(825)}`, RHO_max: `line ${L(826)}`, contourCounts: `line ${L(824)}`, events: `lines ${L(451)}, ${L(498)}, ${L(519)}-${L(530)}`, phases: `line ${L(828)}`,
    singleThread: `line ${L(829)}`, railMotion: `lines ${L(831)}-${L(834)} (${L(762)})`, wallRate: `line ${L(835)} (${L(722)})`, nodeDensity: `lines ${L(837)}-${L(839)}`, supportCheck: `lines ${L(840)}-${L(844)} (${L(692)})`,
    tipCrowding: `lines ${L(845)}-${L(846)}`, railSelfApproach: `lines ${L(847)}-${L(848)} (${L(666)})`, openEnds: `lines ${L(849)}-${L(850)} (${L(515)})`, caps: `lines ${L(851)}-${L(854)}`, foundation: `line ${L(855)}`,
    wallWidth: `lines ${L(856)}-${L(858)}`, bbox_mm: `line ${L(859)} (${L(765)}-${L(775)})`, size_mm: `line ${L(819)}` }[k2] || `summary: lines ${L(825)}-${L(859)}`;
  return '?';
}

function firstByteDiff(a, b){ const n = Math.min(a.length, b.length); for(let i = 0; i < n; i++) if(a[i] !== b[i]) return i; return a.length === b.length ? -1 : n; }
const around = (s, i) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 30));

export const RUNS = [
  { tag: 'P2b tripod, A2L (the printed specimen)', name: 'P2b_a2l', specimen: true,
    flags: ['--bead', '0.45', '--lh', '0.24', '--plate', '330', '320', '--legs', '3', '--H', '240'],
    args: { bead: 0.45, lh: 0.24, plate: [330, 320], legs: 3, H: 240 },
    golden: 'specimens/2026-09-02_P2b_penjac_3legs_A2L_physical/P2b_penjac_3_A2L_geometry.json.gz' },
  { tag: 'P2b tripod, Ender (pending specimen)', name: 'P2b_ender', extra: true,
    flags: ['--bead', '0.42', '--lh', '0.2', '--plate', '220', '220', '--legs', '3', '--H', '168'],
    args: { bead: 0.42, lh: 0.2, plate: [220, 220], legs: 3, H: 168 },
    golden: 'specimens/2026-09-02_P2b_penjac_3legs_pending/P2b_penjac_3_geometry.json.gz', goldenInformational: true },
  { tag: 'tripod at 200 mm, every design flag off its default', name: 'legs3_custom', extra: true,
    flags: ['--bead', '0.45', '--lh', '0.24', '--plate', '256', '256', '--legs', '3', '--H', '200', '--K', '8', '--w0', '2.8', '--w1', '8.0', '--maxbridge', '12', '--foundation', '6', '--rib', '2.2', '--res', '0.3'],
    args: { bead: 0.45, lh: 0.24, plate: [256, 256], legs: 3, H: 200, K: 8, w0: 2.8, w1: 8.0, maxbridge: 12, foundation: 6, rib: 2.2, res: 0.3 } },
  { tag: 'two legs at 150 mm, every design flag off its default (refused: a reach outruns maxBridge)', name: 'legs2_custom', extra: true, refused: true,
    flags: ['--bead', '0.45', '--lh', '0.24', '--plate', '256', '256', '--legs', '2', '--H', '150', '--K', '8', '--w0', '2.8', '--w1', '8.0', '--maxbridge', '10', '--foundation', '6', '--rib', '2.2', '--res', '0.3'],
    args: { bead: 0.45, lh: 0.24, plate: [256, 256], legs: 2, H: 150, K: 8, w0: 2.8, w1: 8.0, maxbridge: 10, foundation: 6, rib: 2.2, res: 0.3 } },
  { tag: 'a 12 mm figure (refused)', name: 'refused12', extra: true, refused: true,
    flags: ['--bead', '0.45', '--lh', '0.24', '--plate', '330', '320', '--legs', '3', '--H', '12'],
    args: { bead: 0.45, lh: 0.24, plate: [330, 320], legs: 3, H: 12 } },
];

/** Run the parity protocol for one script/port pair. `cfg`: { script, generate, prefix, lineOffset, goldenNotes }. */
export function runParity(cfg, RUNS, argv){
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const TOL = +opt('tol', 0.02);
  const DIR = opt('dir', os.tmpdir());
  const PY = process.env.WEFT_PYTHON || 'python3';
  const NO_GOLDEN = argv.includes('--no-golden'), QUICK = argv.includes('--quick'), NO_SENS = argv.includes('--no-sensitivity');
  const ONLY = opt('only', null);                          // --only NAME runs one case (its `name`)
  const results = [];
  const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
  const timings = [];
  const goldenIgnore = [(p) => /\.caps\[\d+\]\.(process|physicalStatus|evidence)$/.test(p), (p) => p === '$.summary.args.out'];

  for(const run of RUNS){
    if(QUICK && run.extra) continue;
    if(ONLY && run.name !== ONLY) continue;
    const tag = run.tag;
    const REF = path.join(DIR, `${cfg.prefix}_py_${run.name}_geometry.json`), REFREJ = REF + '.rejected';
    const OUT = path.join(DIR, `${cfg.prefix}_js_${run.name}_geometry.json`), OUTREJ = OUT + '.rejected';
    for(const f of [REF, REFREJ, OUT, OUTREJ]) if(fs.existsSync(f)) fs.unlinkSync(f);
    console.log(`\n===== ${tag} =====\n$ ${PY} ${cfg.script} ${run.flags.join(' ')} --out ${REF}`);

    /* 1. the Python reference, produced now */
    const t0 = process.hrtime.bigint();
    const r = spawnSync(PY, [path.join(ROOT, cfg.script), ...run.flags, '--out', REF], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const tPy = Number(process.hrtime.bigint() - t0) / 1e9;
    const pyRefused = r.status === 1 && fs.existsSync(REFREJ);
    if(r.error || !(r.status === 0 && fs.existsSync(REF) || pyRefused)){
      console.error(`cannot produce the Python reference (${r.error ? r.error.message : 'exit ' + r.status}).\n${r.stderr}`);
      process.exit(2);
    }
    const pyStderr = r.stderr.split('\n').filter(l => l.length);

    /* 2. the JavaScript generator, same flags (and the same --out string, which the file carries in summary.args.out) */
    const t1 = process.hrtime.bigint();
    const g = cfg.generate(Object.assign({}, run.args, { out: REF }));
    const jsText = g.violations.length ? g.rejectedJson() : g.toJson();
    const tJs = Number(process.hrtime.bigint() - t1) / 1e9;
    timings.push({ tag, python_s: tPy, js_s: tJs, layers: g.payload.layers.length });
    fs.writeFileSync(g.violations.length ? OUTREJ : OUT, jsText);
    console.log(`Python: ${tPy.toFixed(1)} s (process)${pyRefused ? ', REFUSED' : ''}; JS: ${tJs.toFixed(1)} s (in-process, generate + serialise), ${g.payload.layers.length} layers${g.violations.length ? ', REFUSED' : ''}`);

    /* stderr: the raster line and the progress lines */
    const jsStderr = g.stderrLines.slice();
    if(g.violations.length){ jsStderr.push('REFUSED — the geometry did not pass its own checks:'); for(const v of g.violations) jsStderr.push('  * ' + v); }
    check(`${tag}: stderr lines identical (raster, progress${g.violations.length ? ', REFUSED' : ''})`, pyStderr.join('\n') === jsStderr.join('\n'),
      pyStderr.join('\n') === jsStderr.join('\n') ? `${pyStderr.length} lines` : `python ${JSON.stringify(pyStderr.find((l, i) => l !== jsStderr[i]))} vs js ${JSON.stringify(jsStderr.find((l, i) => l !== pyStderr[i]))}`);

    if(run.refused || pyRefused || g.violations.length){
      check(`${tag}: both refuse`, pyRefused && g.violations.length > 0, `python exit ${r.status}, JS violations ${g.violations.length}`);
      const rej = fs.existsSync(REFREJ) ? fs.readFileSync(REFREJ, 'utf8') : '';
      const fd = firstByteDiff(jsText, rej);
      check(`${tag}: .rejected file byte-identical`, fd < 0, fd < 0 ? `${rej.length} bytes` : `first difference at byte ${fd}: python ...${around(rej, fd)} vs js ...${around(jsText, fd)}`);
      check(`${tag}: nothing on stdout, no geometry file`, r.stdout === '' && !fs.existsSync(REF));
      if(rej){
        const st = treeWalk(JSON.parse(rej), JSON.parse(jsText));
        check(`${tag}: .rejected numbers bit-identical`, st.differing === 0 && st.structural.length === 0, `${st.numbers} numbers${st.differing ? `; first ${st.examples[0]} — ${cfg.script} ${pyLineFor(st.examples[0].split(':')[0], cfg.lineOffset)}` : ''}`);
      }
      continue;
    }

    const refText = fs.readFileSync(REF, 'utf8');
    const ref = JSON.parse(refText);
    const js = JSON.parse(fs.readFileSync(OUT, 'utf8'));   // compare what is on disk, as the builder will read it

    /* 3. bytes */
    const fd = firstByteDiff(jsText, refText);
    check(`${tag}: geometry JSON byte-identical to the Python file`, fd < 0, fd < 0 ? `${jsText.length} bytes` : `first difference at byte ${fd}: python ...${around(refText, fd)} vs js ...${around(jsText, fd)}`);
    check(`${tag}: printed summary + PHASES lines byte-identical`, r.stdout === g.stdoutText(), r.stdout === g.stdoutText() ? `${r.stdout.length} chars` : `python ${JSON.stringify(r.stdout.slice(0, 80))}... vs js ${JSON.stringify(g.stdoutText().slice(0, 80))}...`);

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
    check(`${tag}: event list equal (types, z to 1e-6)`, cmp.overall.eventsA === cmp.overall.eventsB && cmp.overall.maxEventDz <= 1e-6 && !cmp.problems.some(p => /^event/.test(p)), `${cmp.overall.eventsA} events`);
    check(`${tag}: summary key set equal`, JSON.stringify(Object.keys(ref.summary)) === JSON.stringify(Object.keys(js.summary)));
    check(`${tag}: geom_compare verdict`, cmp.pass, cmp.pass ? 'PASS' : cmp.problems.slice(0, 5).join('; '));

    /* 5. bit-level walk over the whole tree */
    const st = treeWalk(ref, js);
    console.log(`bit-level walk: ${st.numbers} numbers compared, ${st.differing} differ (worst ${st.worst} at ${st.worstPath || '-'}), ${st.structural.length} structural differences`);
    check(`${tag}: same key order and structure everywhere`, st.structural.length === 0, st.structural.slice(0, 3).join('; '));
    check(`${tag}: numbers bit-identical to the Python output`, st.differing === 0,
      st.differing === 0 ? `${st.numbers} numbers` : `${st.differing} of ${st.numbers} differ; first: ${st.examples[0]} — written by ${cfg.script} ${pyLineFor(st.examples[0].split(':')[0], cfg.lineOffset)}`);

    /* 6. the specimen golden */
    const goldenFile = run.golden && path.join(ROOT, run.golden);
    if(!NO_GOLDEN && goldenFile && fs.existsSync(goldenFile)){
      const raw = fs.readFileSync(goldenFile);
      const goldenText = goldenFile.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8');
      const golden = JSON.parse(goldenText);
      const sg = treeWalk(golden, js, goldenIgnore);
      const cg = compareGeometry(golden, js, { tol: TOL });
      const allDiffs = []; (function walk(a, b, p){ if(typeof a === 'number' && typeof b === 'number'){ if(a !== b) allDiffs.push(p); return; } if(Array.isArray(a) && Array.isArray(b)){ for(let i = 0; i < Math.min(a.length, b.length); i++) walk(a[i], b[i], `${p}[${i}]`); return; } if(a && b && typeof a === 'object' && typeof b === 'object'){ for(const k of Object.keys(a)) if(k in b) walk(a[k], b[k], `${p}.${k}`); } })(golden, js, '$');
      const onlySpan = allDiffs.every(p => /\.caps\[\d+\]\.span_mm$/.test(p));
      console.log(`vs golden ${run.golden}: ${sg.numbers} numbers, ${sg.differing} differ (${allDiffs.length ? allDiffs.slice(0, 4).join(', ') + (allDiffs.length > 4 ? `, ... ${allDiffs.length - 4} more` : '') : 'none'}), ${sg.structural.length} structural differences beyond args.out and the membrane-contract keys; comparer max Hausdorff ${cg.overall.maxHausdorff.toFixed(5)} mm, max node ${cg.overall.maxNodeDist.toFixed(5)} mm, ${cg.pass ? 'PASS' : 'FAIL'}`);
      const ok = sg.structural.length === 0 && cg.pass && onlySpan;
      if(run.goldenInformational) console.log(`${ok ? 'PASS' : 'INFO'}  ${tag}: golden reproduced except the documented drift (span_mm fix, membrane keys)${ok ? '' : ' — the pending golden was built by an earlier script; differences are informational'}`);
      else check(`${tag}: golden geometry reproduced (numbers bit-identical except the caps' span_mm fix; only the membrane-contract keys added)`, ok, ok ? `${allDiffs.length} span_mm value(s) changed by the fix` : (sg.structural.slice(0, 3).join('; ') || allDiffs.slice(0, 3).join(', ') || cg.problems.slice(0, 3).join('; ')));
      /* has the Python drifted since the build, beyond those two documented changes? */
      const sp = treeWalk(golden, ref, goldenIgnore);
      const pyOk = sp.structural.length === 0 && sp.examples.every(e => /\.caps\[\d+\]\.span_mm:/.test(e));
      if(run.goldenInformational) console.log(`${pyOk ? 'PASS' : 'INFO'}  ${tag}: Python-now reproduces its golden up to the documented changes \u2014 ${sp.differing} number(s) differ, ${sp.structural.length} structural${pyOk ? '' : ' (the script moved on after that pending build; the port follows the script, not the golden)'}`);
      else check(`${tag}: Python-now reproduces its golden up to the documented changes`, pyOk, `${sp.differing} number(s) differ, ${sp.structural.length} structural`);
    } else console.log(`golden ${run.golden || '-'} ${NO_GOLDEN ? 'skipped' : 'not present'}`);

    /* 7. sensitivity to the C library's last bit */
    if(run.specimen && !NO_SENS){
      const ulp = (x) => { const b = new Float64Array([x]); const u = new BigUint64Array(b.buffer); u[0] += (u[0] & 1n) ? 1n : -1n; return b[0]; };
      let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const pert = (f) => (...a) => { const v = f(...a); return (v !== 0 && Number.isFinite(v) && rnd() < 0.03) ? ulp(v) : v; };
      const prev = setLibm({ sin: pert(Math.sin), cos: pert(Math.cos), atan2: pert(Math.atan2) }); const prevAcos = setLibmAcos(pert(Math.acos));
      let pText; const t2 = process.hrtime.bigint();
      try { const gp = cfg.generate(Object.assign({}, run.args, { out: REF })); pText = gp.violations.length ? gp.rejectedJson() : gp.toJson(); } finally { setLibm(prev); setLibmAcos(prevAcos); }
      const pfd = firstByteDiff(pText, refText);
      const sp = treeWalk(ref, JSON.parse(pText));
      check(`${tag}: one-ulp perturbation of 3% of sin/cos/atan2/acos calls leaves the JSON byte-identical`, pfd < 0,
        pfd < 0 ? `the 2-4 decimal rounding absorbs the last bit (${(Number(process.hrtime.bigint() - t2) / 1e9).toFixed(1)} s)` : `${sp.differing} of ${sp.numbers} numbers move (first ${sp.examples[0]}); the port is sensitive there to the libm implementation`);
    }
  }

  console.log('\ntimings:'); for(const t of timings) console.log(`  ${t.tag.padEnd(48)} python ${t.python_s.toFixed(1).padStart(6)} s (process)   js ${t.js_s.toFixed(1).padStart(6)} s (in-process)   ${t.layers} layers`);
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed (tolerance ${TOL} mm)`);
  return failed.length;
}

function main(){
  const failed = runParity({ script: 'climber_geometry.py', generate: generateClimber, prefix: 'climber', lineOffset: 0 }, RUNS, process.argv.slice(2));
  process.exit(failed ? 1 : 0);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
