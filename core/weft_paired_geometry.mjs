#!/usr/bin/env node
/* core/weft_paired_geometry.mjs — JavaScript port of paired_sculpture_geometry.py (DAH, the three-lobed
 * clockwise breath for the Bambu A2L, and ODJEK, the four-lobed counter-clockwise echo for the
 * Ender-3 V4: one persistent closed contour per global Z level, a connected annular foundation,
 * short staple reaches, dense weld columns, no cap).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same refusals (the four up-front ones and the three measured ones), the same JSON shape, key order
 * and rounding, the same preview SVG and the same stdout. The Python is stdlib-only (math + json), so
 * the numeric twins it needs are in core/weft_geom_ext.js (CPython's math.hypot, round() keeping -0.0,
 * repr(float), f"{x:.nf}"), core/weft_geom_ext2.js (the libm names, a path-aware json.dumps) and
 * core/weft_geom_ext4.js (float ** 2, pathlib, the argparse twin). Parity with the Python output is
 * measured by tests/paired_geom_parity.test.mjs for both variants and for off-default flags.
 *
 *   import { generatePaired, toJson } from './core/weft_paired_geometry.mjs';
 *   generatePaired({ variant: 'dah', lh: 0.24, bead: 0.45, plate: [330, 320] })
 *       -> { payload, summary, svg(), stdout(previewPath), args, ... }        (throws "REFUSED: ..." like the script)
 *   node core/weft_paired_geometry.mjs --variant dah --lh 0.24 --bead 0.45 --plate 330 320 --out FILE
 *
 * Where a line of the Python has a non-obvious meaning (int/float in the JSON, Python's half-to-even
 * round(), evaluation order of a float expression, a set of floats) the comment on the JavaScript
 * says so. Repo-relative names only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pyRound } from './weft_geom.js';
import { pyHypot, pyRoundNSigned, pyFloatRepr, pyFormatFixed } from './weft_geom_ext.js';
import { libmSin, libmCos, pyJsonDumpsPath } from './weft_geom_ext2.js';
import { pySquare, pyPathStem, pyPathWithName, makeArgparse } from './weft_geom_ext4.js';

/* ---------------- argparse twin: same flags, same defaults, same types, same Namespace order ---------------- */
export const ARG_DEFAULTS = [
  ['variant', 'choice', null, ['dah', 'odjek']], ['H', 'float', 52.8], ['lh', 'float', null], ['bead', 'float', null],
  ['turns', 'float', null], ['w0', 'float', 3.0], ['w1', 'float', 4.2], ['K', 'int', 16], ['foundation', 'float', 7.0],
  ['maxbridge', 'float', 10.0], ['plate', 'float2', null], ['out', 'str', null],
];
export const parseArgs = makeArgparse(ARG_DEFAULTS, { required: ['variant', 'lh', 'bead', 'plate', 'out'] });

/* ---------------- int/float bookkeeping for json.dumps ---------------- */
/** Every number the Python writes is a float (rr() results, argparse floats, literal floats) except the
 *  values on these key paths, which are Python ints: the layer index k, the node count K (the argparse
 *  int and the doubled nk), N, the literal speeds / temperatures, lobes, caps, rings, islandsExpected —
 *  and "paths" only under summary.foundation (the top-level foundation.paths hold float coordinates). */
const INT_LEAF = new Set(['k', 'K', 'N', 'firstLayerSpeed', 'speed', 'bridgeSpeed', 'temp', 'bed', 'fan', 'lobes', 'caps', 'rings', 'islandsExpected']);
function isIntPath(p){
  const leaf = p[p.length - 1];
  if(leaf === 'paths') return p.length >= 2 && p[p.length - 2] === 'foundation' && p[0] === 'summary';
  return INT_LEAF.has(leaf);
}
/** json.dumps(payload, separators=(",", ":")) — the geometry file's exact text. */
export function toJson(payload){ return pyJsonDumpsPath(payload, { isInt: isIntPath }); }
/** json.dumps(summary, indent=2) — the first thing the script prints. */
export function summaryJson(summary){ return pyJsonDumpsPath(summary, { indent: 2, isInt: isIntPath, rootPath: ['summary'] }); }

const PI = Math.PI;
const rr = (v, n = 4) => pyRoundNSigned(+v, n);            // round(float(v), n), keeping -0.0 like Python

/** The generator. Returns { payload, summary, svg(), stdout(previewPath), args, N, H, ... }: payload exactly
 *  as the Python writes it, svg() the preview text, stdout(previewPath) the printed lines. Throws an Error
 *  whose message is the Python's SystemExit text ("REFUSED: ...") for every refusal, up-front or measured. */
export function generatePaired(argsIn){
  const a = parseArgs(argsIn);

  if(a.H <= 8 || a.lh <= 0 || a.bead <= 0) throw new Error('REFUSED: invalid height, layer height or bead');
  if(a.w0 < 2 * a.bead || a.w1 < a.w0) throw new Error('REFUSED: wall range cannot carry two rails');
  if(a.K < 8 || a.K % 2) throw new Error('REFUSED: K must be an even integer >= 8');
  if(a.maxbridge > 12) throw new Error('REFUSED: paired sculptures keep the pre-LIMIT16 12 mm bridge ceiling');

  const N = Math.max(40, pyRound(a.H / a.lh));               // int(round(x)): half to even
  const H = rr(N * a.lh, 4);
  const IS_DAH = a.variant === 'dah';
  const LOBES = IS_DAH ? 3 : 4;
  const TURNS = a.turns !== null ? a.turns : (IS_DAH ? 0.32 : -0.24);
  const TAB = IS_DAH ? 0.70 : 0.55;
  const COUNT = IS_DAH ? 216 : 192;
  const FIRST_BEAD = a.bead + 0.06;
  const SECONDARY = IS_DAH ? 0.55 : 0.40;

  const sm = (t) => { t = Math.max(0.0, Math.min(1.0, t)); return t * t * (3.0 - 2.0 * t); };
  const wall_at = (t) => a.w0 + (a.w1 - a.w0) * pySquare(libmSin(PI * t));          // sin(pi t) ** 2 is pow(x, 2.0)

  function body_params(t){
    const breath = pySquare(libmSin(PI * t));
    const flare = sm((t - 0.72) / 0.28);
    let base, amp, cx, cy;
    if(IS_DAH){
      base = 29.5 - 3.8 * breath + 4.0 * flare;
      amp = 4.1 + 1.3 * breath;
      cx = 2.4 * pySquare(libmSin(PI * t));
      cy = 1.5 * libmSin(2.0 * PI * t);
    } else {
      base = 26.5 - 3.0 * breath + 3.2 * flare;
      amp = 3.4 + 1.0 * breath;
      cx = -1.8 * pySquare(libmSin(PI * t));
      cy = 1.2 * libmSin(2.0 * PI * t + 0.45);
    }
    const phase = 2.0 * PI * TURNS * sm(t);                   // ((2.0 * pi) * TURNS) * sm(t)
    return [base, amp, cx, cy, phase];
  }

  function contour_xy(t, offset = 0.0){
    const [base, amp, cx, cy, phase] = body_params(t);
    const pts = new Array(COUNT);
    for(let i = 0; i < COUNT; i++){
      const th = 2.0 * PI * i / COUNT;                        // ((2.0 * pi) * i) / COUNT
      const secondary = SECONDARY * libmSin((LOBES + 1) * th - 0.45 * phase);
      const radius = base + offset + amp * libmCos(LOBES * th + phase) + secondary;   // ((base + offset) + amp*cos) + secondary
      pts[i] = [cx + radius * libmCos(th), cy + radius * libmSin(th)];
    }
    return pts;
  }

  function contour_record(t, wall){
    const q = contour_xy(t);
    const closed = q.concat([q[0]]);
    const normals = new Array(COUNT);
    for(let i = 0; i < COUNT; i++){
      const [x0, y0] = q[(i - 1 + COUNT) % COUNT], [x1, y1] = q[(i + 1) % COUNT];
      const tx = x1 - x0, ty = y1 - y0;
      const length = pyHypot(tx, ty) || 1.0;
      normals[i] = [ty / length, -tx / length];               // -0.0 survives into the JSON as "-0.0"
    }
    const cum = [0.0];
    for(let i = 0; i + 1 < closed.length; i++){ const p0 = closed[i], p1 = closed[i + 1]; cum.push(cum[cum.length - 1] + pyHypot(p1[0] - p0[0], p1[1] - p0[1])); }
    const total = cum[cum.length - 1];
    let nk = a.K;
    const need = total / Math.max(0.42 * a.maxbridge, 1e-6);
    while(nk < need) nk *= 2;
    const nodes = []; for(let j = 0; j < nk; j++) nodes.push((j + 0.5) * total / nk);   // ((j + 0.5) * total) / nk
    return {
      pts: closed.map(([x, y]) => [rr(x, 3), rr(y, 3)]),
      nrm: normals.concat([normals[0]]).map(([x, y]) => [rr(x, 5), rr(y, 5)]),
      cum: cum.map(v => rr(v, 4)),
      total: rr(total, 4),
      nodes: nodes.map(v => rr(v, 4)),
      K: nk,
      maxNodeGap: rr(total / nk, 4),
      label: a.variant,
      w: rr(wall, 3),
      e: rr(TAB, 3),
      web: 'staple',
    };
  }

  const layers = [];
  let worst_step = 0.0, worst_rail_move = 0.0, max_node_gap = 0.0;
  let previous = null, previous_wall = null;
  const all_points = [];                                      // rounded contour points, then the UNROUNDED foundation rings
  for(let k = 0; k < N; k++){
    const z_bot = k * a.lh, z_top = (k + 1) * a.lh;
    const t = (k + 0.5) / N;
    const wall = wall_at(t);
    const contour = contour_record(t, wall);
    const q = contour.pts.slice(0, -1);                       // the ROUNDED points: the step is measured on what is written
    if(previous !== null){
      let step = -Infinity;
      for(let i = 0; i < q.length; i++){ const v = pyHypot(q[i][0] - previous[i][0], q[i][1] - previous[i][1]); if(v > step) step = v; }
      const rail_move = step + Math.abs(wall - previous_wall) / 2.0;
      worst_step = Math.max(worst_step, step);
      worst_rail_move = Math.max(worst_rail_move, rail_move);
    }
    previous = q; previous_wall = wall;
    max_node_gap = Math.max(max_node_gap, contour.maxNodeGap);
    for(const p of q) all_points.push(p);
    const phase = t < 0.34 ? 'inhale' : (t < 0.72 ? 'turn' : 'release');
    layers.push({ k, zBot: rr(z_bot, 4), zTop: rr(z_top, 4), w: rr(wall, 3), tab: rr(TAB, 3), web: 'staple', phase, contours: [contour] });
  }

  /* Foundation rings align with both first-layer chord rails. One radial rib intersects every ring at
     theta 0, making the whole first layer one island. */
  const t0 = 0.5 / N;
  const wall0 = wall_at(t0);
  const ring_set = new Set([-wall0 / 2.0, 0.0, wall0 / 2.0]);   // a Python set of floats: equal values collapse, the first kept
  const pitch = Math.max(0.80, FIRST_BEAD * 1.65);
  let offset = wall0 / 2.0 + pitch;
  while(offset < a.foundation){ ring_set.add(offset); offset += pitch; }
  ring_set.add(a.foundation);
  const ring_offsets = [...ring_set].sort((x, y) => x - y);    // sorted(set): ascending
  const foundation_paths = [];
  for(const off of ring_offsets){
    const q = contour_xy(t0, off);
    const pth = q.concat([q[0]]);
    foundation_paths.push(pth.map(([x, y]) => [rr(x, 3), rr(y, 3)]));
    for(const p of pth) all_points.push(p);                   // unrounded, as the script extends all_points with `path`
  }
  {
    const [base, amp, cx, cy, phase] = body_params(t0);
    const th = 0.0;
    const secondary = SECONDARY * libmSin((LOBES + 1) * th - 0.45 * phase);
    const r0 = base + amp * libmCos(phase) + secondary;
    foundation_paths.push([
      [rr(cx + r0 + ring_offsets[0], 3), rr(cy, 3)],
      [rr(cx + r0 + ring_offsets[ring_offsets.length - 1], 3), rr(cy, 3)],
    ]);
  }

  let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;
  for(const p of all_points){ if(p[0] < min_x) min_x = p[0]; if(p[1] < min_y) min_y = p[1]; if(p[0] > max_x) max_x = p[0]; if(p[1] > max_y) max_y = p[1]; }
  const size = [max_x - min_x + a.w1, max_y - min_y + a.w1, H];
  const support_allowance = TAB + a.bead / 2.0;
  const violations = [];
  if(worst_rail_move > support_allowance)
    violations.push(`rail moves ${pyFormatFixed(worst_rail_move, 3)} mm per layer, above ${pyFormatFixed(support_allowance, 3)} mm support`);
  if(max_node_gap > 0.45 * a.maxbridge)
    violations.push(`weld gap ${pyFormatFixed(max_node_gap, 3)} mm exceeds conservative bridge fraction`);
  if(size[0] > a.plate[0] - 16 || size[1] > a.plate[1] - 16)
    violations.push(`${pyFormatFixed(size[0], 1)}x${pyFormatFixed(size[1], 1)} mm does not fit ${pyFormatFixed(a.plate[0], 0)}x${pyFormatFixed(a.plate[1], 0)}`);
  if(violations.length) throw new Error('REFUSED: ' + violations.join('; '));

  const summary = {
    name: `paired-sculpture-${a.variant}-v1`,
    variant: a.variant,
    N, H,
    args: {
      lh: a.lh, bead: a.bead, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12,
      w0: a.w0, w1: a.w1, K: a.K, foundation: a.foundation, maxbridge: a.maxbridge,
      speed: IS_DAH ? 26 : 24, bridgeSpeed: 15, temp: 220, bed: IS_DAH ? 55 : 60, fan: 100,
    },
    design: {
      family: 'Dah / Odjek', lobes: LOBES, turns: TURNS, openCrown: true, caps: 0,
      membrane: 'none; failed LIMIT16 inward spiral deliberately excluded',
      grammar: 'staple only', physicalBasis: 'LIMIT16_2026-09-04_RESULTS.md',
    },
    supportCheck: { allowance_mm: rr(support_allowance, 4), worstContourStep_mm: rr(worst_step, 4), worstRailMove_mm: rr(worst_rail_move, 4) },
    nodeDensity: { maxNodeGap_mm: rr(max_node_gap, 4), limit_mm: rr(0.45 * a.maxbridge, 4) },
    foundation: { paths: foundation_paths.length, rings: ring_offsets.length, connectedBy: 'one radial rib', islandsExpected: 1 },
    bbox_mm: [rr(min_x, 2), rr(min_y, 2), rr(max_x, 2), rr(max_y, 2)],
    size_mm: size.map(v => rr(v, 1)),
    violations: [],
  };
  const payload = { summary, foundation: { kind: 'connected-lobed-rings', paths: foundation_paths }, layers };

  /** the tiny top-view storyboard, f-string for f-string: every interpolated number is a Python float
   *  printed with repr() except the lobe count and the two :.2f fields */
  function svg(){
    const F = pyFloatRepr;
    const colors = ['#92f5c1', '#5ee5ad', '#34c98d', '#1fa774', '#137a58'];
    const paths = [];
    [0.0, 0.25, 0.5, 0.75, 1.0].forEach((t, idx) => {
      const q = contour_xy(t);
      const d = 'M ' + q.map(([x, y]) => `${F(rr(x, 2))} ${F(rr(-y, 2))}`).join(' L ') + ' Z';
      paths.push(`<path d="${d}" fill="none" stroke="${colors[idx]}" stroke-width="0.7" opacity="${pyFormatFixed(0.35 + idx * 0.13, 2)}"/>`);
    });
    const pad = 10;
    const view_x = min_x - pad, view_y = -max_y - pad;
    const view_w = max_x - min_x + 2 * pad, view_h = max_y - min_y + 2 * pad;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${F(rr(view_x, 2))} ${F(rr(view_y, 2))} ${F(rr(view_w, 2))} ${F(rr(view_h, 2))}">`
      + '<rect x="-100" y="-100" width="200" height="200" fill="#07110d"/>'
      + paths.join('')
      + `<text x="${F(rr(view_x + 3, 2))}" y="${F(rr(view_y + 7, 2))}" fill="#d9ffe9" font-family="sans-serif" font-size="4">${a.variant.toUpperCase()} · ${LOBES} lobes · ${pyFormatFixed(TURNS, 2)} turn</text>`
      + '</svg>';
  }
  /** print(json.dumps(summary, indent=2)); print(f"PREVIEW {preview_path}") */
  const stdout = (previewPath) => summaryJson(summary) + '\n' + (previewPath != null ? `PREVIEW ${previewPath}\n` : '');

  return { payload, summary, svg, stdout, args: a, N, H, LOBES, TURNS, COUNT, violations: [] };
}

/** out_path.with_name(out_path.stem.replace("_geometry", "") + "_preview.svg") */
export function previewPathFor(out){ return pyPathWithName(out, pyPathStem(out).split('_geometry').join('') + '_preview.svg'); }

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv, { requireOut: true }); }
  catch(e){ console.error(`usage: weft_paired_geometry.mjs --variant {dah,odjek} [--H H] --lh LH --bead BEAD [--turns TURNS] [--w0 W0] [--w1 W1] [--K K] [--foundation FOUNDATION] [--maxbridge MAXBRIDGE] --plate PLATE PLATE --out OUT\nerror: ${e.message}`); process.exit(2); }
  let g;
  try { g = generatePaired(args); }
  catch(e){ if(e.message.startsWith('REFUSED:')){ console.error(e.message); process.exit(1); } throw e; }
  const outPath = args.out;
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, toJson(g.payload));
  const preview = previewPathFor(outPath);
  fs.writeFileSync(preview, g.svg());
  process.stdout.write(g.stdout(preview));
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
