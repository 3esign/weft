#!/usr/bin/env node
/* tests/paired_js_build_parity.test.mjs — the Node chain, fed the JavaScript-generated DAH geometry
   (and the ODJEK geometry) instead of the Python one, produces the same G-code and the same gate verdict.

   This is what `node weft.mjs build --geo DAH_A2L_v1_geometry.json --machine a2l --strategy climber
   --name DAH_A2L_v1 --nostl` does (MODELS.paired: strategy climber -> core/weft_build.mjs layersFromClimber
   + climberHardRefusals; the geometry declares no membrane, so the contract needs no flag), run twice
   in-process:
     A. on the geometry paired_sculpture_geometry.py writes NOW (python3, stdlib only; falls back to the
        specimen golden, which the Python reproduces byte for byte, when python3 is not available),
     B. on the geometry core/weft_paired_geometry.mjs writes, serialised with its json.dumps twin and
        parsed back, so the chain reads exactly what the port would write to disk.
   Compared: the thread report, the G-code after the header rewrite (SHA-256, byte for byte), the gate at
   the geometry's maxbridge (10 mm, clean as it was for the admitted build), and the recorded verdicts in
   specimens/2026-09-04_DAH_A2L_v1_pending (gate.json: every statistic and the worst-gap table;
   report.json: paths, welds, length, size, overlaps). The specimen's shipped .gcode/.gcode.3mf are not in
   the repository (the README records the 3MF's SHA-256, which packs the G-code with a timestamped
   container and cannot be reproduced from the G-code alone); the SHA of the Node chain's G-code is printed
   for the record. The same for ODJEK_ENDER3V4_v1 (machine ender, the ASSUMED bead acknowledged) against
   specimens/2026-09-04_ODJEK_ENDER3V4_v1_pending.
   usage: node tests/paired_js_build_parity.test.mjs [--dir DIR] [--only dah|odjek] */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWeftCore, layersFromClimber, climberHardRefusals, gcodeText, fixHeader, runGate, loadMachines } from '../core/weft_build.mjs';
import { validateMembraneGeometry } from '../membrane_contract.mjs';
import { generatePaired, toJson } from '../core/weft_paired_geometry.mjs';

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
  { key: 'dah', name: 'DAH_A2L_v1', machine: 'a2l', extra: ['--variant', 'dah'], args: { variant: 'dah' },
    spec: 'specimens/2026-09-04_DAH_A2L_v1_pending', golden: 'DAH_A2L_v1_geometry.json' },
  { key: 'odjek', name: 'ODJEK_ENDER3V4_v1', machine: 'ender', extra: ['--variant', 'odjek', '--H', '48', '--w0', '2.8', '--w1', '3.8'], args: { variant: 'odjek', H: 48, w0: 2.8, w1: 3.8 },
    spec: 'specimens/2026-09-04_ODJEK_ENDER3V4_v1_pending', golden: 'ODJEK_ENDER3V4_v1_geometry.json' },
];

/* the chain, as weft.mjs cmdBuild runs it for --geo with strategy climber */
async function chain(text, label, T, m){
  const geo = JSON.parse(text);
  const W = createWeftCore();
  validateMembraneGeometry(geo, { rootDir: ROOT, allowExperimental: false, machine: T.machine });
  const t0 = Date.now();
  const report = layersFromClimber(W, geo, { name: T.name, bx: m.plate[0], by: m.plate[1], machine: T.machine, allowExperimental: false });
  const hard = climberHardRefusals(report);
  const tThread = Date.now() - t0;
  const txt = await gcodeText(W, path.join(ROOT, m.start), path.join(ROOT, m.end));
  const fixed = fixHeader(txt);
  const A = geo.summary.args;
  /* cmdBuild's gate options for a geometry whose args carry no maxcantilever / allow / minanchor / maxCapRadius: the bounded defaults */
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
  console.log(`\n===== ${T.name} (paired_sculpture_geometry.py -> strategy climber, machine ${T.machine}) =====`);

  /* A. the Python-now geometry */
  const REF = path.join(DIR, `paired_build_py_${T.name}_geometry.json`);
  if (fs.existsSync(REF)) fs.unlinkSync(REF);
  let pyText = null, pySource;
  const tp = Date.now();
  const r = spawnSync(PY, [path.join(ROOT, 'paired_sculpture_geometry.py'), '--bead', String(m.bead), '--lh', String(m.lh), '--plate', String(m.plate[0]), String(m.plate[1]), ...T.extra, '--out', REF], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  if (!r.error && r.status === 0 && fs.existsSync(REF)) { pyText = fs.readFileSync(REF, 'utf8'); pySource = `paired_sculpture_geometry.py now (${Date.now() - tp} ms)`; }
  else {
    const golden = path.join(SPEC, T.golden);
    if (!fs.existsSync(golden)) { say(false, 'Python-now geometry', 'python3 failed and the specimen golden is missing'); process.exit(1); }
    pyText = fs.readFileSync(golden, 'utf8'); pySource = 'specimen golden (python3 not available)';
  }
  say(true, `${T.name}: Python geometry`, `${pySource}, ${pyText.length} bytes`);
  const goldenFile = path.join(SPEC, T.golden);
  if (fs.existsSync(goldenFile)) say(fs.readFileSync(goldenFile, 'utf8') === pyText, `${T.name}: Python geometry byte-identical to the specimen golden`);

  /* B. the JavaScript geometry: generated here, not read from the specimen */
  const tg = Date.now();
  const g = generatePaired(Object.assign({ bead: m.bead, lh: m.lh, plate: m.plate, out: REF }, T.args));
  const jsText = toJson(g.payload);
  say(jsText.length > 0, `${T.name}: geometry generated by the JavaScript port`, `${jsText.length} bytes, ${Date.now() - tg} ms`);
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
  say(J.gate.PASS && J.gate.problem_count === 0, `${T.name}: gate at ${J.maxbridge} mm is clean on the JS geometry (the verdict the build was admitted on)`, `PASS=${J.gate.PASS}, ${J.gate.problem_count} problems`);

  /* the recorded verdicts of the specimen */
  const gateFile = path.join(SPEC, `${T.name}_gate.json`), repFile = path.join(SPEC, `${T.name}_report.json`), readme = path.join(SPEC, 'README.md');
  if (fs.existsSync(gateFile)) {
    const rg = JSON.parse(fs.readFileSync(gateFile, 'utf8'));
    const statDiff = Object.keys(rg.stats).filter(k => rg.stats[k] !== J.gate.stats[k]);
    const sameGaps = JSON.stringify(rg.worstGaps || null) === JSON.stringify((J.gate.worstGaps || []).slice(0, (rg.worstGaps || []).length));
    const sameParams = ['bead', 'allow', 'maxbridge', 'maxcantilever', 'maxislands'].every(k => rg.params[k] === J.gate.params[k]);
    say(rg.PASS === J.gate.PASS && rg.problem_count === J.gate.problem_count && rg.layers === J.gate.layers && statDiff.length === 0 && sameGaps && sameParams, `${T.name}: gate verdict, layer count, parameters, every recorded statistic and the worst-gap table match the recorded specimen gate`, `recorded PASS=${rg.PASS}, ${rg.problem_count} problems, ${rg.layers} layers, ${rg.stats.checked_points} points / ${rg.stats.checked_paths} paths / ${rg.stats.bridges} bridges${statDiff.length ? '; differing: ' + statDiff.map(k => `${k} ${rg.stats[k]} vs ${J.gate.stats[k]}`).join(', ') : ''}${sameGaps ? '' : '; worst gaps differ'}${sameParams ? '' : '; params differ'}`);
  }
  if (fs.existsSync(repFile)) {
    const rr = JSON.parse(fs.readFileSync(repFile, 'utf8')).report;
    say(rr.layers === J.report.layers && rr.weldNodes === J.report.weldNodes && rr.threadLength_m === J.report.threadLength_m && JSON.stringify(rr.size_mm) === JSON.stringify(J.report.size_mm) && rr.unintendedOverlaps === J.report.unintendedOverlaps && rr.seamClosures === J.report.seamClosures, `${T.name}: thread report matches the recorded specimen report`, `recorded ${rr.layers} paths, ${rr.weldNodes} welds, ${rr.threadLength_m} m, ${rr.size_mm.join('x')} mm, overlaps ${rr.unintendedOverlaps}; here ${J.report.layers} paths, ${J.report.weldNodes} welds, ${J.report.threadLength_m} m, ${J.report.size_mm.join('x')} mm`);
  }
  if (fs.existsSync(readme)) {
    const mm = /SHA-256:\s*`([0-9A-Fa-f]{64})`/.exec(fs.readFileSync(readme, 'utf8'));
    console.log(`  README sha256 of the shipped ${T.machine === 'a2l' ? T.name + '.gcode.3mf (the container, not the G-code)' : T.name + '.gcode'}: ${mm ? mm[1] : 'not recorded'}\n  Node chain sha256 of the G-code built here from the JS geometry: ${sha(J.text)}${mm && mm[1].toLowerCase() === sha(J.text) ? '  (identical)' : mm ? '  (a different artefact: the shipped file is not in the repository)' : ''}`);
  }
  const out = path.join(DIR, `paired_build_js_${T.name}.gcode`);
  fs.writeFileSync(out, J.text);
  console.log(`  G-code from the JS geometry left at ${out}`);
}
console.log(fails ? `\n${fails} check(s) FAILED` : '\nall JS-geometry build parity checks passed');
process.exit(fails ? 1 : 0);
