/* WEFT gate parity — core/weft_gate.js (JavaScript) must agree with check_gcode.py (Python, the
   reference) on the same files with the same parameters: every stat, every problem (kind, role,
   z, line, length), every membrane anchoring number, the island count and the verdict.

   Two files are held to it:
   - specimens/_regression/FIXTURE_bad_floating.gcode — the P2 with five discs in mid-air. MUST FAIL,
     in both gates, for the same reasons (4 FLOATING + 2 UNANCHORED_MEMBRANE + long bridges +
     cantilevers + 2 first-layer islands).
   - specimens/2026-09-04_LIMIT16_A2L_physical/LIMIT16_A2L_v1_routeB.gcode — a printed specimen that
     PASSED at its experimental ceilings (16.2 / 4.8). The recorded gate JSON beside it is the
     third witness.

   usage: node tests/gate_parity.test.mjs [--no-python]   (Python + numpy/scipy needed for the
   reference half; with --no-python the recorded JSONs are the only reference). */
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(pathToFileURL(path.join(ROOT, 'core', 'weft_gate.js')).href);
const { checkGcode } = globalThis.WEFT_GATE;
const NOPY = process.argv.includes('--no-python');
const PY = process.env.WEFT_PYTHON || 'python3';

const CASES = [
  { file: 'specimens/_regression/FIXTURE_bad_floating.gcode', opt: { bead: 0.42, maxislands: 1 }, expectPass: false,
    recorded: null },
  { file: 'specimens/2026-09-04_LIMIT16_A2L_physical/LIMIT16_A2L_v1_routeB.gcode',
    opt: { bead: 0.45, maxbridge: 16.2, maxcantilever: 4.8, allow: 0.6, minanchor: 0.5, maxCapRadius: 20, maxislands: 1 }, expectPass: true,
    recorded: 'specimens/2026-09-04_LIMIT16_A2L_physical/LIMIT16_A2L_v1_gate.json' },
];
let fails = 0;
const say = (ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++; };
const near = (a, b, tol) => (a == null && b == null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol);

for (const c of CASES) {
  const abs = path.join(ROOT, c.file);
  if (!fs.existsSync(abs)) { say(false, c.file, 'missing'); continue; }
  const t0 = Date.now();
  const js = checkGcode(fs.readFileSync(abs, 'utf8'), Object.assign({ file: c.file }, c.opt));
  const jsMs = Date.now() - t0;
  say(js.PASS === c.expectPass, `${path.basename(c.file)}: JS verdict PASS=${js.PASS} (expected ${c.expectPass})`,
    `${js.problem_count} problems, ${js.stats.checked_points} points, ${js.layers} layers, ${jsMs} ms`);
  let ref = null;
  if (!NOPY) {
    const out = path.join(ROOT, 'exports', `_gate_ref_${path.basename(c.file)}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const args = [path.join(ROOT, 'check_gcode.py'), abs, '--json', out, '--quiet'];
    for (const [k, v] of Object.entries(c.opt)) args.push('--' + (k === 'maxCapRadius' ? 'max-cap-radius' : k), String(v));
    try { execFileSync(PY, args, { stdio: 'ignore' }); } catch (e) { /* exit 1 is the fixture's job */ }
    if (fs.existsSync(out)) ref = JSON.parse(fs.readFileSync(out, 'utf8'));
    else say(false, 'python reference', 'check_gcode.py produced no JSON (numpy/scipy missing?) — use --no-python to skip');
  } else if (c.recorded) ref = JSON.parse(fs.readFileSync(path.join(ROOT, c.recorded), 'utf8'));
  if (!ref) continue;
  const label = NOPY ? 'recorded gate JSON' : 'check_gcode.py';
  say(ref.PASS === js.PASS, `verdict agrees with ${label}`, `PASS ${ref.PASS} / ${js.PASS}`);
  say(ref.layers === js.layers, 'layer count', `${ref.layers} / ${js.layers}`);
  for (const k of Object.keys(ref.stats)) say(ref.stats[k] === js.stats[k], `stats.${k}`, `${ref.stats[k]} / ${js.stats[k]}`);
  say(ref.problem_count === js.problem_count, 'problem_count', `${ref.problem_count} / ${js.problem_count}`);
  // problems: same multiset of (kind, role, z, line); lengths within 0.02 mm
  const key = p => `${p.kind}|${p.role}|${p.z}|${p.line}`;
  const rm = new Map(ref.problems.map(p => [key(p), p])), jm = new Map(js.problems.map(p => [key(p), p]));
  let miss = 0, extra = 0, lenBad = 0;
  for (const [k, p] of rm) { const q = jm.get(k); if (!q) miss++; else if (p.length_mm != null && !near(p.length_mm, q.length_mm, 0.02)) lenBad++; }
  for (const k of jm.keys()) if (!rm.has(k)) extra++;
  say(!miss && !extra && !lenBad, 'problem list identical (kind, role, z, line, length)', `${ref.problems.length} ref / ${js.problems.length} js · missing ${miss} · extra ${extra} · length mismatches ${lenBad}`);
  // membranes: anchoring fractions within 0.005, gaps within 0.02
  let mb = 0; for (let i = 0; i < Math.max(ref.membranes.length, js.membranes.length); i++) {
    const a = ref.membranes[i], b = js.membranes[i];
    if (!a || !b || !near(a.anchoredFrac, b.anchoredFrac, 0.005) || !near(a.turnGap_mm, b.turnGap_mm, 0.02) || !near(a.radius_mm, b.radius_mm, 0.02) || !near(a.outerTurnGap_mm, b.outerTurnGap_mm, 0.02) || a.points !== b.points) mb++; }
  say(!mb && ref.membranes.length === js.membranes.length, 'membranes identical (anchoring, turn gap, radius, outer gap)', `${ref.membranes.length} / ${js.membranes.length}, ${mb} mismatches`);
  // worst gaps: same top entries within 0.02
  let wg = 0; for (let i = 0; i < Math.min(15, ref.worstGaps.length); i++) { const a = ref.worstGaps[i], b = js.worstGaps[i]; if (!b || a[0] !== b[0] || a[1] !== b[1] || !near(a[2], b[2], 0.02) || !near(a[3], b[3], 0.02)) wg++; }
  say(!wg, 'worst gaps identical', `${wg} of ${Math.min(15, ref.worstGaps.length)} rows differ`);
}
console.log(fails ? `\n${fails} check(s) FAILED` : '\nall gate parity checks passed');
process.exit(fails ? 1 : 0);
