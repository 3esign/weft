#!/usr/bin/env node
/* core/weft_c1_calibration.mjs — JavaScript port of c1_calibration.py (C1, the bead-calibration coupon:
 * five single-wall rounded-square tubes, each COMMANDED at a different line width, each on a solid
 * pad, ascending in height with width so the plate cannot be read the wrong way round; the extrusion
 * computed here from the stadium cross-section WEFT itself uses, nothing sliced).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same refusal (the row misses the bed margin), the same G-code text line for line (the machine's
 * start / end blocks read with universal newlines, {TEMP} / {BED} substituted, rstrip()ped), the same
 * printed lines. The script writes no JSON; its output IS the G-code, so parity is byte identity of
 * the .gcode and of stdout (tests/c1_geom_parity.test.mjs). The Python is stdlib-only (math), so the
 * numeric twins it needs are in core/weft_geom_ext.js (CPython's math.hypot, f"{x:.nf}"),
 * core/weft_geom_ext2.js (the libm names) and core/weft_geom_ext4.js (float ** 2, str.rstrip(),
 * text-mode reads, float(str), the argparse twin).
 *
 *   import { generateC1 } from './core/weft_c1_calibration.mjs';
 *   generateC1({ bx: 256, by: 256, temp: 220, bed: 55 }, { cwd: WEFT_ROOT })
 *       -> { text, lines, stdout(), towers, minx, maxx, maxlayer, total_len, args }   (throws "REFUSED: ...")
 *   node core/weft_c1_calibration.mjs [--out C1_ender.gcode] [--head exports/ender_start.gcode] [--foot ...]
 *
 * Where a line of the Python has a non-obvious meaning (int truncation, an f-string's rounding, the
 * evaluation order of a float expression, the newline the file gets) the comment on the JavaScript
 * says so. Repo-relative names only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pyRound } from './weft_geom.js';
import { pyHypot, pyFormatFixed, pyInt } from './weft_geom_ext.js';
import { libmSin, libmCos } from './weft_geom_ext2.js';
import { pySquare, pyRstrip, pyReadText, pyFloat, makeArgparse } from './weft_geom_ext4.js';

/* ---------------- argparse twin: same flags, same defaults, same types, same Namespace order ----------------
 * (--temp/--bed/--bx/--by have int literals as defaults; argparse leaves a non-string default untouched,
 *  so a.temp is the int 215 unless given — numerically the same double here) */
export const ARG_DEFAULTS = [
  ['out', 'str', 'C1_ender.gcode'], ['head', 'str', 'exports/ender_start.gcode'], ['foot', 'str', 'exports/ender_end.gcode'],
  ['widths', 'str', '0.36,0.40,0.44,0.48,0.52'], ['side', 'float', 18.0], ['corner', 'float', 3.0], ['pitch', 'float', 32.0],
  ['lh', 'float', 0.20], ['lh1', 'float', 0.30], ['pad', 'float', 26.0], ['padw', 'float', 0.48], ['h0', 'float', 8.0],
  ['dh', 'float', 1.0], ['speed', 'float', 15.0], ['speed1', 'float', 12.0],
  ['temp', 'float', 215], ['bed', 'float', 60], ['bx', 'float', 220], ['by', 'float', 220],
];
export const parseArgs = makeArgparse(ARG_DEFAULTS);

const PI = Math.PI;
const FIL = PI * pySquare(1.75 / 2);                          // math.pi * (1.75 / 2) ** 2  (0.875 ** 2 is exact)

/** stadium cross-section — the same model printllm and WEFT both use: (h*(w-h) + pi*(h/2)**2) / FIL */
export function e_per_mm(w, h){ return (h * (w - h) + PI * pySquare(h / 2)) / FIL; }

/** one closed loop, corners rounded so the nozzle never has to stop dead */
export function rounded_square(cx, cy, side, r, n = 8){
  const h = side / 2 - r;
  const pts = [];
  for(const [sx, sy, a0] of [[+1, +1, 0.0], [-1, +1, PI / 2], [-1, -1, PI], [+1, -1, 3 * PI / 2]]){
    for(let k = 0; k <= n; k++){
      const t = a0 + (PI / 2) * k / n;                        // a0 + (((pi / 2) * k) / n)
      pts.push([cx + sx * h + r * libmCos(t), cy + sy * h + r * libmSin(t)]);   // (cx + sx*h) + r*cos(t)
    }
  }
  pts.push(pts[0]);
  return pts;
}

/** A FILLED base, not a ring: concentric rounded squares from the outside in, spaced 0.92 of a line. */
export function solid_pad(cx, cy, side, r, w){
  const loops = [];
  const step = w * 0.92;
  let half = side / 2;
  let rr = r;
  while(half > step){
    loops.push(rounded_square(cx, cy, 2 * half, Math.min(rr, half - 0.01)));
    half -= step;
    rr = Math.max(0.2, rr - step);
  }
  return loops;
}

/** The generator. opts.cwd is where the --head / --foot paths are resolved (the Python opens them
 *  relative to the process's working directory); opts.readFile(path) may replace the file read.
 *  Returns { text, lines, stdout(), towers, minx, maxx, maxlayer, total_len, args }; text is the exact
 *  content of the G-code file ("\n".join(out): the Python writes it in text mode, which on the Linux
 *  that produced the baseline keeps "\n"). Throws an Error with the Python's SystemExit text for the
 *  bed-margin refusal. */
export function generateC1(argsIn, opts = {}){
  const a = parseArgs(argsIn);
  const cwd = opts.cwd || process.cwd();
  const readFile = opts.readFile || ((p) => pyReadText(fs.readFileSync(path.resolve(cwd, p))));

  const widths = a.widths.split(',').map(v => pyFloat(v));    // float(v) for every comma-separated field
  const N = widths.length;
  const cx0 = a.bx / 2 - (N - 1) * a.pitch / 2;               // (bx / 2) - (((N - 1) * pitch) / 2)
  const towers = widths.map((w, i) => ({
    w, cx: cx0 + i * a.pitch, cy: a.by / 2,
    H: a.h0 + i * a.dh,
    layers: pyRound((a.h0 + i * a.dh - a.lh1) / a.lh) + 1,    // int(round(x)) + 1: half to even
  }));

  /* plate fit */
  let minx = Infinity, maxx = -Infinity;
  for(const t of towers){ if(t.cx < minx) minx = t.cx; if(t.cx > maxx) maxx = t.cx; }
  minx = minx - a.pad / 2 - 2;
  maxx = maxx + a.pad / 2 + 2;
  if(minx < 8 || maxx > a.bx - 8)
    throw new Error(`REFUSED: the row spans ${pyFormatFixed(minx, 1)}..${pyFormatFixed(maxx, 1)} mm on a ${pyFormatFixed(a.bx, 0)} mm bed`);

  const subst = (s) => s.split('{TEMP}').join(String(pyInt(a.temp))).split('{BED}').join(String(pyInt(a.bed)));   // str.replace: every occurrence; int(): truncation
  const head = subst(readFile(a.head));
  const foot = subst(readFile(a.foot));

  const out = [pyRstrip(head), '',
    '; ===== C1 bead calibration =====',
    `; five single-wall tubes, commanded width ${widths.map(w => pyFormatFixed(w, 2)).join(', ')} mm`,
    `; each stands on a SOLID ${pyFormatFixed(a.pad, 0)} x ${pyFormatFixed(a.pad, 0)} mm pad, first layer ${pyFormatFixed(a.lh1, 2)} mm at ${pyFormatFixed(a.padw, 2)} mm`,
    '; SHORTEST tower = NARROWEST commanded width. Measure each wall with calipers.',
    '; extrusion from A = h(w-h) + pi(h/2)^2, filament 1.75 mm — no slicer decided anything here',
    ''];

  let total_len = 0.0;
  let maxlayer = -Infinity; for(const t of towers) if(t.layers > maxlayer) maxlayer = t.layers;
  for(let li = 0; li < maxlayer; li++){
    const z = li ? a.lh1 + li * a.lh : a.lh1;
    const first = (li === 0);
    const h = first ? a.lh1 : a.lh;
    const spd = first ? a.speed1 : a.speed;
    const live = towers.filter(t => li < t.layers);
    if(!live.length) break;
    out.push(`; layer ${li} wall`);
    out.push(`G1 Z${pyFormatFixed(z, 3)} F600`);
    for(const t of live){
      const w = first ? a.padw : t.w;
      const epm = e_per_mm(w, h);
      const loops = first ? solid_pad(t.cx, t.cy, a.pad, 5.0, a.padw) : [rounded_square(t.cx, t.cy, a.side, a.corner)];
      for(const lp of loops){
        out.push(`G0 X${pyFormatFixed(lp[0][0], 3)} Y${pyFormatFixed(lp[0][1], 3)} F9000`);
        out.push('G1 E0.6 F1800');
        let px = lp[0][0], py = lp[0][1];
        for(let i = 1; i < lp.length; i++){
          const qx = lp[i][0], qy = lp[i][1];
          const d = pyHypot(qx - px, qy - py);
          total_len += d;
          out.push(`G1 X${pyFormatFixed(qx, 3)} Y${pyFormatFixed(qy, 3)} E${pyFormatFixed(d * epm, 5)} F${pyFormatFixed(spd * 60, 0)}`);
          px = qx; py = qy;
        }
        out.push('G1 E-0.6 F1800');
      }
    }
  }

  out.push('', `; total extruded path ${pyFormatFixed(total_len / 1000, 1)} m`, '', pyRstrip(foot), '');
  const text = out.join('\n');

  /** the printed lines, exactly */
  const stdout = () => {
    const lines = [`${a.out}: ${out.length} lines, ${maxlayer} layers, ${pyFormatFixed(total_len / 1000, 1)} m of thread`];
    for(const t of towers) lines.push(`  commanded ${pyFormatFixed(t.w, 2)} mm   x=${pyFormatFixed(t.cx, 1)}   height ${pyFormatFixed(t.H, 1)} mm   ${t.layers} layers`);
    lines.push(`  base: solid ${pyFormatFixed(a.pad, 0)}x${pyFormatFixed(a.pad, 0)} mm pad per tower, first layer ${pyFormatFixed(a.lh1, 2)} mm`);
    lines.push(`  row spans ${pyFormatFixed(minx, 1)}..${pyFormatFixed(maxx, 1)} mm on a ${pyFormatFixed(a.bx, 0)} mm bed`);
    return lines.join('\n') + '\n';
  };

  return { text, lines: out, stdout, towers, minx, maxx, maxlayer, total_len, widths, args: a };
}

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv); }
  catch(e){ console.error(`usage: weft_c1_calibration.mjs [--out OUT] [--head HEAD] [--foot FOOT] [--widths WIDTHS] [--side SIDE] [--corner CORNER] [--pitch PITCH] [--lh LH] [--lh1 LH1] [--pad PAD] [--padw PADW] [--h0 H0] [--dh DH] [--speed SPEED] [--speed1 SPEED1] [--temp TEMP] [--bed BED] [--bx BX] [--by BY]\nerror: ${e.message}`); process.exit(2); }
  let g;
  try { g = generateC1(args); }
  catch(e){ if(e.message.startsWith('REFUSED:')){ console.error(e.message); process.exit(1); } throw e; }
  fs.writeFileSync(args.out, g.text);
  process.stdout.write(g.stdout());
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
