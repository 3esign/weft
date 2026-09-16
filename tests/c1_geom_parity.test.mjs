#!/usr/bin/env node
/* tests/c1_geom_parity.test.mjs — the JavaScript port of c1_calibration.py (the bead-calibration coupon)
 * reproduces the Python.
 *
 *   node tests/c1_geom_parity.test.mjs [--dir DIR] [--no-sensitivity] [--only NAME]
 *
 * The coupon has never been printed and no golden exists (specimens/2026-09-03_C1_bead_ender_pending
 * holds the protocol only), so the baseline is what c1_calibration.py writes NOW. For each run — the
 * script's defaults (the Ender: exports/ender_start.gcode / exports/ender_end.gcode, 215 / 60 C, a 220 mm
 * bed, widths 0.36..0.52), an A2L-flavoured set with every flag off its default (the Bambu start / end
 * blocks, a 330 x 320 plate, four widths, a fractional --temp / --bed that int() truncates), a
 * three-width run at a coarser layer, and a row the script REFUSES (a 150 mm bed) — the test runs the
 * Python (python3, stdlib only) into DIR (default: the OS temp dir), runs core/weft_c1_calibration.mjs
 * with the same flags in-process (and once through its CLI), and compares:
 *   bytes   : the G-code the port produces against the Python file, byte for byte (the script writes
 *             no JSON — the G-code IS its output), the printed lines against the Python stdout, and for
 *             the refused run the REFUSED line on stderr, the exit status and the absence of a file;
 *   numbers : every numeric token of both files (X / Y / Z / E / F words and the comment numbers)
 *             compared one by one; on a difference the first differing line is named with the Python
 *             line that writes it.
 * The script leans on the C library's sin / cos (the rounded corners) and on pow(x, 2.0) (the stadium
 * area), which V8 computes differently in the last bit for a few percent / 0.09% of arguments; the last
 * check of each accepted run moves a deterministic 3% of sin / cos results and 0.1% of pow results by
 * one ulp and expects the same bytes (3-decimal coordinates, 5-decimal E words).
 * --only NAME runs one case; --no-sensitivity skips the perturbation.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { generateC1 } from '../core/weft_c1_calibration.mjs';
import { setLibm } from '../core/weft_geom_ext2.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const DIR = opt('dir', os.tmpdir());
const PY = process.env.WEFT_PYTHON || 'python3';
const NO_SENS = argv.includes('--no-sensitivity');
const ONLY = opt('only', null);

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

/** Which line of c1_calibration.py writes a G-code line of this shape. */
export function pyLineFor(line){
  if(/^G1 Z/.test(line)) return 'line 122 (z: line 114)';
  if(/^G0 X/.test(line)) return 'line 129 (loop start: rounded_square 74-83 / solid_pad 58-71)';
  if(/^G1 X/.test(line)) return 'line 135 (coordinates: rounded_square 74-83; E: e_per_mm 53-55; F: speed 117)';
  if(/^G1 E/.test(line)) return 'line 130 / 137';
  if(/^; layer/.test(line)) return 'line 121';
  if(/^; total/.test(line)) return 'line 139';
  if(/^; five|^; each/.test(line)) return 'lines 105-106';
  return 'head / foot: lines 100-101, 103, 139 (rstrip)';
}
const NUM = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
/** every numeric token of a text, in order */
function numbers(s){ return s.match(NUM) || []; }
function firstLineDiff(a, b){ const A = a.split('\n'), B = b.split('\n'); let i = 0; while(i < A.length && i < B.length && A[i] === B[i]) i++; return i < A.length || i < B.length ? { line: i + 1, a: A[i], b: B[i] } : null; }

export const RUNS = [
  { tag: 'C1 defaults (ender)', name: 'default', flags: [], args: {}, cli: true },
  { tag: 'C1 A2L-flavoured (all flags off default)', name: 'a2l', extra: true,
    flags: ['--head', 'exports/a2l_start_block_template_2026-09-02.gcode', '--foot', 'exports/a2l_end_block_harvested_2026-09-02.gcode',
      '--bx', '330', '--by', '320', '--temp', '219.6', '--bed', '54.9', '--widths', '0.40,0.45,0.50,0.55', '--pitch', '36', '--lh', '0.24', '--lh1', '0.28',
      '--h0', '9', '--dh', '1.5', '--side', '20', '--corner', '3.5', '--speed', '18', '--speed1', '11', '--pad', '28', '--padw', '0.52'],
    args: { head: 'exports/a2l_start_block_template_2026-09-02.gcode', foot: 'exports/a2l_end_block_harvested_2026-09-02.gcode',
      bx: 330, by: 320, temp: 219.6, bed: 54.9, widths: '0.40,0.45,0.50,0.55', pitch: 36, lh: 0.24, lh1: 0.28, h0: 9, dh: 1.5, side: 20, corner: 3.5, speed: 18, speed1: 11, pad: 28, padw: 0.52 } },
  { tag: 'C1 three widths, coarse layers', name: 'three', extra: true,
    flags: ['--widths', '0.38,0.42,0.46', '--lh', '0.28', '--lh1', '0.32', '--h0', '6', '--dh', '2', '--pitch', '40'],
    args: { widths: '0.38,0.42,0.46', lh: 0.28, lh1: 0.32, h0: 6, dh: 2, pitch: 40 } },
  { tag: 'C1 refused (150 mm bed)', name: 'refused', extra: true, refused: true, flags: ['--bx', '150'], args: { bx: 150 } },
];

function main(){
const timings = [];
for(const run of RUNS){
  if(ONLY && ONLY !== run.name) continue;
  const tag = run.tag;
  const REF = path.join(DIR, `c1_py_${run.name}.gcode`), OUT = path.join(DIR, `c1_js_${run.name}.gcode`);
  for(const f of [REF, OUT]) if(fs.existsSync(f)) fs.unlinkSync(f);
  console.log(`\n===== ${tag} =====`);

  /* 1. the Python reference, produced now (cwd = the repo root: --head / --foot are repo-relative) */
  const pyArgs = [path.join(ROOT, 'c1_calibration.py'), ...run.flags, '--out', REF];
  const t0 = process.hrtime.bigint();
  const r = spawnSync(PY, pyArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const tPy = Number(process.hrtime.bigint() - t0) / 1e9;
  if(r.error || (run.refused ? r.status !== 1 : (r.status !== 0 || !fs.existsSync(REF)))){
    console.error(`cannot produce the Python reference (${r.error ? r.error.message : 'exit ' + r.status}). Run: ${PY} ${pyArgs.join(' ')}\n${r.stderr}`);
    process.exit(2);
  }

  /* 2. the JavaScript generator, same flags, in-process (the same --out so the printed first line matches) */
  const t1 = process.hrtime.bigint();
  let g = null, refusal = null;
  try { g = generateC1(Object.assign({ out: REF }, run.args), { cwd: ROOT }); } catch(e){ if(e.message.startsWith('REFUSED:')) refusal = e.message; else throw e; }
  const tJs = Number(process.hrtime.bigint() - t1) / 1e9;
  timings.push({ tag, python_s: tPy, js_s: tJs });

  if(run.refused){
    console.log(`Python: refused in ${tPy.toFixed(2)} s; JS: refused in ${tJs.toFixed(3)} s`);
    check(`${tag}: both refuse`, r.status === 1 && refusal !== null, `python exit ${r.status}; JS: ${refusal}`);
    check(`${tag}: REFUSED line identical`, r.stderr.trim() === (refusal || '').trim(), r.stderr.trim());
    check(`${tag}: no G-code written`, !fs.existsSync(REF) && g === null);
    check(`${tag}: nothing on stdout`, r.stdout === '');
    const c = spawnSync(process.execPath, [path.join(ROOT, 'core/weft_c1_calibration.mjs'), ...run.flags, '--out', OUT], { cwd: ROOT, encoding: 'utf8' });
    check(`${tag}: CLI exit status and stderr identical to the Python`, c.status === 1 && c.stderr.trim() === r.stderr.trim() && !fs.existsSync(OUT), `exit ${c.status}`);
    continue;
  }

  const refText = fs.readFileSync(REF, 'utf8');
  fs.writeFileSync(OUT, g.text);
  console.log(`Python: ${tPy.toFixed(2)} s (process), ${refText.split('\n').length} lines, ${refText.length} bytes -> ${REF}`);
  console.log(`JS: ${tJs.toFixed(3)} s (in-process), ${g.lines.length} out lines, ${g.maxlayer} layers, ${g.text.length} bytes -> ${OUT}`);

  /* 3. bytes */
  const same = g.text === refText;
  const ld = same ? null : firstLineDiff(g.text, refText);
  check(`${tag}: G-code byte-identical to the Python file`, same, same ? `${refText.length} bytes, sha256 ${sha(refText)}` : `first differing line ${ld.line}: python ${JSON.stringify(ld.b)} vs js ${JSON.stringify(ld.a)} — written by c1_calibration.py ${pyLineFor(ld.b || '')}`);
  check(`${tag}: printed lines byte-identical`, r.stdout === g.stdout(), r.stdout === g.stdout() ? `${r.stdout.split('\n').length - 1} lines` : `python ${JSON.stringify(r.stdout.split('\n')[0])} vs js ${JSON.stringify(g.stdout().split('\n')[0])}`);
  check(`${tag}: the file ends with the foot block and a newline`, g.text.endsWith('\n') && refText.endsWith('\n'));
  if(run.cli){
    const c = spawnSync(process.execPath, [path.join(ROOT, 'core/weft_c1_calibration.mjs'), ...run.flags, '--out', OUT], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const cliSame = c.status === 0 && fs.readFileSync(OUT, 'utf8') === refText && c.stdout === r.stdout.replace(REF, OUT);
    check(`${tag}: the CLI writes the same G-code and prints the same lines`, cliSame, `exit ${c.status}`);
  }

  /* 4. numbers: every numeric token, one by one */
  const na = numbers(refText), nb = numbers(g.text);
  let differing = 0, first = null;
  for(let i = 0; i < Math.min(na.length, nb.length); i++) if(na[i] !== nb[i]){ differing++; if(!first) first = `#${i}: python ${na[i]} vs js ${nb[i]}`; }
  console.log(`numeric walk: ${na.length} numbers in the Python file, ${nb.length} in the JS file, ${differing} differ`);
  check(`${tag}: numeric tokens identical`, na.length === nb.length && differing === 0, differing ? first : `${na.length} numbers`);
  const towers = g.towers.map(t => `${t.w}@${t.cx}:${t.layers}`).join(' ');
  console.log(`towers: ${towers}; row ${g.minx}..${g.maxx}; ${g.total_len.toFixed(3)} mm of path`);

  /* 5. sensitivity to the C library's last bit */
  if(!NO_SENS){
    const ulp = (x) => { const b = new Float64Array([x]); const u = new BigUint64Array(b.buffer); u[0] += (u[0] & 1n) ? 1n : -1n; return b[0]; };
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pert = (f, rate) => (...x) => { const v = f(...x); return (v !== 0 && rnd() < rate) ? ulp(v) : v; };
    const prev = setLibm({ sin: pert(Math.sin, 0.03), cos: pert(Math.cos, 0.03), pow: pert(Math.pow, 0.001) });
    let pText;
    try { pText = generateC1(Object.assign({ out: REF }, run.args), { cwd: ROOT }).text; } finally { setLibm(prev); }
    const pd = pText === refText ? null : firstLineDiff(pText, refText);
    check(`${tag}: one-ulp perturbation of 3% of sin/cos and 0.1% of pow calls leaves the G-code byte-identical`, pd === null, pd === null ? 'the 3-5 decimal formatting absorbs the last bit' : `first differing line ${pd.line}: ${JSON.stringify(pd.b)} vs ${JSON.stringify(pd.a)}`);
  }
}

console.log('\ntimings:'); for(const t of timings) console.log(`  ${t.tag.padEnd(44)} python ${t.python_s.toFixed(2)} s (process)   js ${t.js_s.toFixed(3)} s (in-process)`);
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
}
import { createHash } from 'crypto';
const sha = (s) => createHash('sha256').update(s).digest('hex');
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
