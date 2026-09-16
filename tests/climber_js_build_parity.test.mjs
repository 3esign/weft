#!/usr/bin/env node
/* tests/climber_js_build_parity.test.mjs — the Node chain, fed the JavaScript-generated P2b climber
   geometry (and the V1 vase geometry) instead of the Python one, produces the same G-code and the
   same gate verdict.

   This is what `node weft.mjs build --geo P2b_penjac_3_A2L_geometry.json --machine a2l --strategy climber
   --name P2b_penjac_3_A2L --nostl --allow-experimental-membrane` does (strategy climber: core/weft_build.mjs
   layersFromClimber + climberHardRefusals; the death-cap membrane is declared experimental, so the
   contract needs the flag), run twice in-process:
     A. on the geometry climber_geometry.py writes NOW (python3 with numpy/scipy/scikit-image; falls back
        to the specimen golden, which the Python reproduces up to the documented span_mm fix and the
        membrane-contract keys, when python3 is not available),
     B. on the geometry core/weft_climber_geometry.mjs writes, serialised with its json.dump twin and
        parsed back, so the chain reads exactly what the port would write to disk.
   Compared: the thread report, the G-code after the header rewrite (SHA-256, byte for byte), the gate
   at the geometry's maxbridge (must be clean, as it was for the print), and the recorded verdicts in
   specimens/2026-09-02_P2b_penjac_3legs_A2L_physical (gate.json, report.json). The specimen's shipped
   G-code is not in the repository and its manifest records no hash (it was built by the browser builder
   make_climber.mjs); the SHA of the Node chain's file is printed for the record.
   The same for V1_vrtlog_ender (vase_geometry.py / core/weft_vase_geometry.mjs, machine ender, the
   ASSUMED bead acknowledged) against specimens/2026-09-03_V1_vrtlog_ender_physical.
   usage: node tests/climber_js_build_parity.test.mjs [--dir DIR] [--only climber|vase] */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWeftCore, layersFromClimber, climberHardRefusals, gcodeText, fixHeader, runGate, loadMachines } from '../core/weft_build.mjs';
import { validateMembraneGeometry } from '../membrane_contract.mjs';
import { generateClimber } from '../core/weft_climber_geometry.mjs';
import { generateVase } from '../core/weft_vase_geometry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const DIR = opt('dir', os.tmpdir());
const ONLY = opt('only', null);
const PY = process.env.WEFT_PYTHON || 'python3';
let fails = 0; const say = (ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++; };
const sha = b => createHash('sha256').update(b).digest('hex');
const MACHINES = loadMachines();

const TARGETS = [
  { key: 'climber', script: 'climber_geometry.py', generate: generateClimber, name: 'P2b_penjac_3_A2L', machine: 'a2l',
    extra: ['--legs', '3', '--H', '240'], args: { legs: 3, H: 240 },
    spec: 'specimens/2026-09-02_P2b_penjac_3legs_A2L_physical', golden: 'P2b_penjac_3_A2L_geometry.json.gz' },
  { key: 'vase', script: 'vase_geometry.py', generate: generateVase, name: 'V1_vrtlog_ender', machine: 'ender',
    extra: ['--turns', '0.72', '--H', '130'], args: { turns: 0.72, H: 130 },
    spec: 'specimens/2026-09-03_V1_vrtlog_ender_physical', golden: 'V1_vrtlog_ender_geometry.json.gz' },
];

/* the chain, as weft.mjs cmdBuild runs it for --geo with strategy climber */
async function chain(text, label, T, m){
  const geo = JSON.parse(text);
  const W = createWeftCore();
  validateMembraneGeometry(geo, { rootDir: ROOT, allowExperimental: true, machine: T.machine });
  const t0 = Date.now();
  const report = layersFromClimber(W, geo, { name: T.name, bx: m.plate[0], by: m.plate[1], machine: T.machine, allowExperimental: true });
  const hard = climberHardRefusals(report);
  const tThread = Date.now() - t0;
  const txt = await gcodeText(W, path.join(ROOT, m.start), path.join(ROOT, m.end));
  const fixed = fixHeader(txt);
  const A = geo.summary.args;
  const gateOpts = { bead: m.bead, maxbridge: A.maxbridge, maxcantilever: 3, allow: 0.6, minanchor: 0.5, maxCapRadius: 36, maxislands: 1, file: `${T.name}.gcode` };
  const t1 = Date.now();
  const gate = runGate(txt, gateOpts);                    // the gate on the final text, as cmdBuild does before the header rewrite
  const tGate = Date.now() - t1;
  console.log(`  [${label}] thread ${report.layers} paths, ${report.weldNodes} welds, ${report.threadLength_m} m, ${report.size_mm.join('x')} mm, overlaps ${report.unintendedOverlaps}, hard refusals ${hard.length} (${tThread} ms); gcode ${fixed.text.length} bytes sha256 ${sha(fixed.text)}; gate@${A.maxbridge} ${gate.PASS ? 'PASS' : 'FAIL'} ${gate.problem_count} problems / ${gate.stats.checked_points} points / ${gate.layers} layers, first layer ${gate.stats.first_layer_islands} island(s) (${tGate} ms)`);
  return { report, hard, text: fixed.text, gate, maxbridge: A.maxbridge };
}

for(const T of TARGETS){
  if(ONLY && ONLY !== T.key) continue;
  const m = MACHINES[T.machine];
  const SPEC = path.join(ROOT, T.spec);
  console.log(`\n===== ${T.name} (${T.script} -> strategy climber, machine ${T.machine}) =====`);

  /* A. the Python-now geometry */
  const REF = path.join(DIR, `${T.key}_build_py_${T.name}_geometry.json`);
  if (fs.existsSync(REF)) fs.unlinkSync(REF);
  let pyText = null, pySource;
  const tp = Date.now();
  const r = spawnSync(PY, [path.join(ROOT, T.script), '--bead', String(m.bead), '--lh', String(m.lh), '--plate', String(m.plate[0]), String(m.plate[1]), ...T.extra, '--out', REF], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  if (!r.error && r.status === 0 && fs.existsSync(REF)) { pyText = fs.readFileSync(REF, 'utf8'); pySource = `${T.script} now (${Date.now() - tp} ms)`; }
  else {
    const golden = path.join(SPEC, T.golden);
    if (!fs.existsSync(golden)) { say(false, 'Python-now geometry', 'python3 failed and the specimen golden is missing'); process.exit(1); }
    pyText = zlib.gunzipSync(fs.readFileSync(golden)).toString('utf8'); pySource = 'specimen golden (python3 not available)';
  }
  say(true, `${T.name}: Python geometry`, `${pySource}, ${pyText.length} bytes`);

  /* B. the JavaScript geometry: generated here, not read from the specimen */
  const tg = Date.now();
  const g = T.generate(Object.assign({ bead: m.bead, lh: m.lh, plate: m.plate, out: REF }, T.args));
  const jsText = g.toJson();
  say(jsText.length > 0 && !g.violations.length, `${T.name}: geometry generated by the JavaScript port`, `${jsText.length} bytes, ${Date.now() - tg} ms, ${g.violations.length} violations`);
  say(jsText === pyText, `${T.name}: JS geometry byte-identical to the Python geometry`, jsText === pyText ? '' : `${jsText.length} vs ${pyText.length} bytes`);

  const P = await chain(pyText, 'python geometry', T, m);
  const J = await chain(jsText, 'js geometry', T, m);

  /* the two chains agree */
  const rep = (x) => JSON.stringify({ layers: x.report.layers, weldNodes: x.report.weldNodes, threadLength_m: x.report.threadLength_m, size_mm: x.report.size_mm, unintendedOverlaps: x.report.unintendedOverlaps, seamClosures: x.report.seamClosures, hard: x.hard });
  say(rep(P) === rep(J), `${T.name}: thread report identical (paths, welds, length, size, overlaps, seam closures, hard refusals)`, rep(J));
  say(J.hard.length === 0, `${T.name}: the weave passes climberHardRefusals on the JS geometry`, J.hard.join('; '));
  const same = P.text === J.text;
  let detail = `sha256 ${sha(J.text)} (${J.text.length} bytes)`;
  if (!same) { const a = J.text.split('\n'), b = P.text.split('\n'); let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; detail += `; first differing line ${i + 1}: js ${JSON.stringify(a[i] ?? '<EOF>')} vs python ${JSON.stringify(b[i] ?? '<EOF>')}`; }
  say(same, `${T.name}: G-code byte-identical from the JS geometry and from the Python geometry (after the header rewrite)`, detail);
  say(JSON.stringify(P.gate.stats) === JSON.stringify(J.gate.stats) && P.gate.PASS === J.gate.PASS && P.gate.problem_count === J.gate.problem_count, `${T.name}: gate at ${J.maxbridge} mm: same verdict and statistics`, `PASS=${J.gate.PASS}, ${J.gate.problem_count} problems, ${J.gate.stats.checked_points} points, ${J.gate.stats.bridges} bridges`);
  say(J.gate.PASS && J.gate.problem_count === 0, `${T.name}: gate at ${J.maxbridge} mm is clean on the JS geometry (the verdict the print was admitted on)`, `PASS=${J.gate.PASS}, ${J.gate.problem_count} problems`);

  /* the recorded verdicts of the specimen */
  const gateFile = path.join(SPEC, `${T.name}_gate.json`), repFile = path.join(SPEC, `${T.name}_report.json`), manFile = path.join(SPEC, 'manifest.json');
  if (fs.existsSync(gateFile)) {
    const rg = JSON.parse(fs.readFileSync(gateFile, 'utf8'));
    /* every statistic the specimen gate recorded (the gate has since added unanchored_membrane) and its worst-gap table */
    const statDiff = Object.keys(rg.stats).filter(k => rg.stats[k] !== J.gate.stats[k]);
    const sameGaps = JSON.stringify(rg.worstGaps || null) === JSON.stringify((J.gate.worstGaps || []).slice(0, (rg.worstGaps || []).length));
    say(rg.PASS === J.gate.PASS && rg.problem_count === J.gate.problem_count && statDiff.length === 0 && sameGaps, `${T.name}: gate verdict, every recorded statistic and the worst-gap table match the recorded specimen gate`, `recorded PASS=${rg.PASS}, ${rg.problem_count} problems, ${rg.stats.checked_points} points / ${rg.stats.checked_paths} paths / ${rg.stats.bridges} bridges${statDiff.length ? '; differing: ' + statDiff.join(', ') : ''}${sameGaps ? '' : '; worst gaps differ'}`);
  }
  if (fs.existsSync(repFile)) {
    const rr = JSON.parse(fs.readFileSync(repFile, 'utf8')).report;
    say(rr.layers === J.report.layers && rr.weldNodes === J.report.weldNodes && rr.threadLength_m === J.report.threadLength_m && JSON.stringify(rr.size_mm) === JSON.stringify(J.report.size_mm) && rr.unintendedOverlaps === J.report.unintendedOverlaps, `${T.name}: thread report matches the recorded specimen report`, `recorded ${rr.layers} paths, ${rr.weldNodes} welds, ${rr.threadLength_m} m, ${rr.size_mm.join('x')} mm, overlaps ${rr.unintendedOverlaps}; here ${J.report.layers} paths, ${J.report.weldNodes} welds, ${J.report.threadLength_m} m, ${J.report.size_mm.join('x')} mm`);
  }
  if (fs.existsSync(manFile)) {
    const man = JSON.parse(fs.readFileSync(manFile, 'utf8'));
    const recorded = man.sha256 && (man.sha256[`${T.name}.gcode`] || man.sha256[`${T.name}_routeB.gcode`]);
    console.log(`  manifest sha256 of the shipped ${T.name}.gcode: ${recorded || 'not recorded (built by the browser builder make_climber.mjs; the file is not in the repository)'}\n  Node chain sha256 of the G-code built here from the JS geometry: ${sha(J.text)}${recorded ? (recorded === sha(J.text) ? '  (identical)' : '  (different builder path)') : ''}`);
  }
  const out = path.join(DIR, `${T.key}_build_js_${T.name}.gcode`);
  fs.writeFileSync(out, J.text);
  console.log(`  G-code from the JS geometry left at ${out}`);
}
console.log(fails ? `\n${fails} check(s) FAILED` : '\nall JS-geometry build parity checks passed');
process.exit(fails ? 1 : 0);
