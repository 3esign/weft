#!/usr/bin/env node
/* core/weft_aero_geometry.mjs — JavaScript port of aero_tower_geometry.py (the experimental porous
 * towers of 2026-09-04: RASEP, five skeletal ribbons with staggered radial cantilevers and a strong
 * clockwise twist, for the Bambu A2L; VEO, four ribbons with paired lateral sails and a counter-
 * clockwise twist, for the Ender-3 V4 — C3D-style deformation intent compiled into WEFT layers,
 * deliberately near the lateral-support limit, no membrane, no cap).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same refusals, the same JSON shape, key order and rounding, the same two-panel preview SVG, the same
 * c3d-intent handoff file and the same stdout. The Python is stdlib-only (math + json), so the numeric
 * twins it needs are in core/weft_geom_ext.js (CPython's math.hypot, round() keeping -0.0, repr(float),
 * f"{x:.nf}"), core/weft_geom_ext2.js (the libm names, a path-aware json.dumps) and
 * core/weft_geom_ext4.js (float ** 2, pathlib, the argparse twin). Parity with the Python output is
 * measured by tests/aero_geom_parity.test.mjs for both variants and for off-default flags.
 *
 *   import { generateAero, toJson } from './core/weft_aero_geometry.mjs';
 *   generateAero({ variant: 'rasep', H: 91.2, lh: 0.24, bead: 0.45, plate: [330, 320] })
 *       -> { payload, summary, svg(), c3dJson(), stdout(previewPath, c3dPath), args, ... }   (throws "REFUSED: ...")
 *   node core/weft_aero_geometry.mjs --variant rasep --H 91.2 --lh 0.24 --bead 0.45 --plate 330 320 --out FILE
 *
 * Where a line of the Python has a non-obvious meaning (int/float in the JSON, Python's half-to-even
 * round(), evaluation order of a float expression) the comment on the JavaScript says so.
 * Repo-relative names only.
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
  ['variant', 'choice', null, ['rasep', 'veo']], ['H', 'float', null], ['lh', 'float', null], ['bead', 'float', null],
  ['turns', 'float', null], ['w0', 'float', 1.30], ['w1', 'float', 1.65], ['K', 'int', 8], ['foundation', 'float', 7.0],
  ['maxbridge', 'float', 16.0], ['plate', 'float2', null], ['out', 'str', null],
];
export const parseArgs = makeArgparse(ARG_DEFAULTS, { required: ['variant', 'H', 'lh', 'bead', 'plate', 'out'] });

/* ---------------- int/float bookkeeping for json.dumps ---------------- */
/** Python ints in the geometry file: the layer index k, the node count K (argparse int, doubled), N, the
 *  literal speeds / temperatures, ribs, caps, rings, spokes, islandsExpected — and "paths" only under
 *  summary.foundation (the top-level foundation.paths hold float coordinates, 0.0 included). The
 *  c3d-intent file has its own two ints (primitive.count and the cantilever-field count). */
const INT_LEAF = new Set(['k', 'K', 'N', 'firstLayerSpeed', 'speed', 'bridgeSpeed', 'temp', 'bed', 'fan', 'ribs', 'caps', 'rings', 'spokes', 'islandsExpected']);
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

/** The generator. Returns { payload, summary, svg(), c3dJson(), stdout(previewPath, c3dPath), args, ... }.
 *  Throws an Error whose message is the Python's SystemExit text ("REFUSED: ...") for every refusal. */
export function generateAero(argsIn){
  const a = parseArgs(argsIn);

  if(a.H < 50 || a.lh <= 0 || a.bead <= 0) throw new Error('REFUSED: invalid tower height, layer height or bead');
  if(a.w0 < 2.15 * a.bead || a.w1 < a.w0) throw new Error('REFUSED: ribbon wall cannot carry two WEFT rails');
  if(a.K < 6 || a.K % 2) throw new Error('REFUSED: K must be an even integer >= 6');
  if(a.maxbridge > 16) throw new Error('REFUSED: LIMIT16 evidence does not justify more than 16 mm');

  const IS_RASEP = a.variant === 'rasep';
  const RIBS = IS_RASEP ? 5 : 4;
  const TURNS = a.turns !== null ? a.turns : (IS_RASEP ? 0.58 : -0.44);
  const N = Math.max(180, pyRound(a.H / a.lh));              // int(round(x)): half to even
  const H = rr(N * a.lh, 4);
  const COUNT = 48;
  const TAB = IS_RASEP ? 0.78 : 0.68;
  const FIRST_BEAD = a.bead + 0.06;

  const smooth = (t) => { t = Math.max(0.0, Math.min(1.0, t)); return t * t * (3.0 - 2.0 * t); };
  function bell(t, center, width){
    const x = (t - center) / width + 0.5;
    if(x <= 0.0 || x >= 1.0) return 0.0;
    return pySquare(libmSin(PI * x));                         // sin(pi x) ** 2 is pow(x, 2.0)
  }
  const wall_at = (t) => a.w0 + (a.w1 - a.w0) * pySquare(libmSin(PI * t));

  function axis_at(t){
    if(IS_RASEP)
      return [13.0 * smooth(t) + 4.5 * libmSin(2 * PI * t) * pySquare(libmSin(PI * t)),   // (4.5 * sin) * sin**2
              7.0 * pySquare(libmSin(PI * t))];
    return [-10.0 * pySquare(libmSin(PI * t)),
            12.0 * smooth(t) - 4.0 * libmSin(2 * PI * t) * libmSin(PI * t)];
  }

  const CENTERS = IS_RASEP ? [0.27, 0.40, 0.53, 0.66, 0.79] : [0.34, 0.48, 0.62, 0.76];
  const REACH = IS_RASEP ? [25.0, 20.0, 27.0, 21.0, 24.0] : [20.0, 25.0, 20.0, 24.0];
  function rib_center(t, j){
    const [ax, ay] = axis_at(t);
    const phase = 2 * PI * TURNS * smooth(t);                 // ((2 * pi) * TURNS) * smooth(t)
    const theta = 2 * PI * j / RIBS + phase;                  // (((2 * pi) * j) / RIBS) + phase
    const base_r = IS_RASEP ? (18.5 - 4.5 * t) : (17.0 - 3.5 * t);
    let arm, crown;
    if(IS_RASEP){
      arm = REACH[j] * bell(t, CENTERS[j], 0.205);
      crown = (j === 0 || j === 2 || j === 4 ? 8.0 : 3.0) * smooth((t - 0.76) / 0.24);
    } else {
      arm = REACH[j] * bell(t, CENTERS[j], 0.19);
      crown = (j === 1 || j === 3 ? 7.0 : 2.5) * smooth((t - 0.74) / 0.26);
    }
    const radius = base_r + arm + crown;
    return [ax + radius * libmCos(theta), ay + radius * libmSin(theta), theta];
  }

  function loop_points(t, j){
    const [cx, cy, theta] = rib_center(t, j);
    const radial = IS_RASEP ? 2.65 : 2.55;
    const tangent = IS_RASEP ? 1.85 : 1.75;
    const swell = 1.0 + 0.12 * pySquare(libmSin(PI * t));
    const ct = libmCos(theta), st = libmSin(theta);
    const pts = new Array(COUNT);
    for(let i = 0; i < COUNT; i++){
      const q = 2 * PI * i / COUNT;                           // ((2 * pi) * i) / COUNT
      const dr = radial * swell * libmCos(q);                 // (radial * swell) * cos(q)
      const dt = tangent * libmSin(q);
      pts[i] = [cx + dr * ct - dt * st, cy + dr * st + dt * ct];   // (cx + dr*cos) - dt*sin ; (cy + dr*sin) + dt*cos
    }
    return pts;
  }

  function contour_record(t, j, wall){
    const q = loop_points(t, j);
    const closed = q.concat([q[0]]);
    const normals = new Array(COUNT);
    for(let i = 0; i < COUNT; i++){
      const [x0, y0] = q[(i - 1 + COUNT) % COUNT], [x1, y1] = q[(i + 1) % COUNT];
      const tx = x1 - x0, ty = y1 - y0;
      const d = pyHypot(tx, ty) || 1.0;
      normals[i] = [ty / d, -tx / d];                         // -0.0 survives into the JSON as "-0.0"
    }
    const cum = [0.0];
    for(let i = 0; i + 1 < closed.length; i++){ const p0 = closed[i], p1 = closed[i + 1]; cum.push(cum[cum.length - 1] + pyHypot(p1[0] - p0[0], p1[1] - p0[1])); }
    const total = cum[cum.length - 1];
    let nk = a.K;
    while(total / nk > 0.42 * a.maxbridge) nk *= 2;
    const nodes = []; for(let j2 = 0; j2 < nk; j2++) nodes.push(rr((j2 + 0.5) * total / nk, 4));   // ((j2 + 0.5) * total) / nk
    return {
      pts: closed.map(([x, y]) => [rr(x, 3), rr(y, 3)]),
      nrm: normals.concat([normals[0]]).map(([x, y]) => [rr(x, 5), rr(y, 5)]),
      cum: cum.map(v => rr(v, 4)),
      total: rr(total, 4),
      nodes,
      K: nk,
      maxNodeGap: rr(total / nk, 4),
      label: `${a.variant}-rib-${j + 1}`,
      w: rr(wall, 3), e: rr(TAB, 3), web: 'staple',
    };
  }

  const layers = [];
  const tracks = []; for(let j = 0; j < RIBS; j++) tracks.push([]);
  const all_points = [];                                      // rounded contour points, then the rounded foundation paths
  let prev = null;
  let worst_move = 0.0, max_node_gap = 0.0;
  for(let k = 0; k < N; k++){
    const t = (k + 0.5) / N;
    const wall = wall_at(t);
    const contours = []; for(let j = 0; j < RIBS; j++) contours.push(contour_record(t, j, wall));
    const current = [];
    for(let j = 0; j < RIBS; j++){
      const q = contours[j].pts.slice(0, -1);                 // the ROUNDED points: the move is measured on what is written
      current.push(q);
      for(const p of q) all_points.push(p);
      const c = rib_center(t, j); tracks[j].push([c[0], c[1]]);
      max_node_gap = Math.max(max_node_gap, contours[j].maxNodeGap);
    }
    if(prev !== null){
      let mv = -Infinity;
      for(let j = 0; j < RIBS; j++){ const rib = current[j], old = prev[j]; for(let i = 0; i < rib.length; i++){ const v = pyHypot(rib[i][0] - old[i][0], rib[i][1] - old[i][1]); if(v > mv) mv = v; } }
      worst_move = Math.max(worst_move, mv);
    }
    prev = current;
    const phase = t < 0.22 ? 'rise' : (t < 0.82 ? 'cantilever-field' : 'forked-crown');
    layers.push({ k, zBot: rr(k * a.lh), zTop: rr((k + 1) * a.lh), w: rr(wall, 3), tab: rr(TAB, 3), web: 'staple', phase, contours });
  }

  /* One center-connected radial star pierces every first rib and two annular rails. */
  const t0 = 0.5 / N;
  const base_centers = []; for(let j = 0; j < RIBS; j++) base_centers.push(rib_center(t0, j));
  let outer = -Infinity; for(const [x, y] of base_centers){ const v = pyHypot(x, y); if(v > outer) outer = v; }
  outer += 5.5;
  const foundation_paths = [];
  for(const rad of [Math.max(6.0, outer - 9.0), outer]){
    const ring = [];
    for(let i = 0; i < 145; i++) ring.push([rr(rad * libmCos(2 * PI * i / 144), 3), rr(rad * libmSin(2 * PI * i / 144), 3)]);   // ((2 * pi) * i) / 144
    foundation_paths.push(ring);
    for(const p of ring) all_points.push(p);
  }
  for(const [x, y] of base_centers){
    const d = pyHypot(x, y) || 1.0;
    const spoke = [[0.0, 0.0], [rr((outer + 1.0) * x / d, 3), rr((outer + 1.0) * y / d, 3)]];   // ((outer + 1.0) * x) / d
    foundation_paths.push(spoke);
    for(const p of spoke) all_points.push(p);
  }

  let min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;
  for(const p of all_points){ if(p[0] < min_x) min_x = p[0]; if(p[0] > max_x) max_x = p[0]; if(p[1] < min_y) min_y = p[1]; if(p[1] > max_y) max_y = p[1]; }
  const size = [max_x - min_x + a.w1, max_y - min_y + a.w1, H];
  if(size[0] > a.plate[0] - 16 || size[1] > a.plate[1] - 16)
    throw new Error(`REFUSED: ${pyFormatFixed(size[0], 1)}x${pyFormatFixed(size[1], 1)} mm misses plate margin`);

  const allowance = TAB + a.bead / 2;
  const risk = worst_move > allowance ? 'extreme' : 'high';
  const summary = {
    name: `aero-tower-${a.variant}-x1`,
    variant: a.variant, N, H,
    args: {
      lh: a.lh, bead: a.bead, firstLayerBead: FIRST_BEAD,
      firstLayerSpeed: 10, w0: a.w0, w1: a.w1, K: a.K,
      foundation: a.foundation, maxbridge: a.maxbridge,
      speed: IS_RASEP ? 24 : 22, bridgeSpeed: 13,
      temp: 220, bed: IS_RASEP ? 55 : 60, fan: 100,
    },
    design: {
      family: 'RASEP / VEO porous aero-towers', ribs: RIBS,
      turns: TURNS, openCrown: true, caps: 0,
      voidStrategy: 'separated continuous skeletal ribbons; no membrane',
      grammar: 'staple only',
      compiler: 'C3D parametric surface/deform intent -> WEFT manufacturing layers',
      physicalBasis: 'LIMIT16_2026-09-04_RESULTS.md',
      experimental: true,
      risk,
      expectedFailureModes: ['outward cantilever curl', 'branch vibration', 'stringing across voids', 'rib detachment'],
    },
    supportCheck: { allowance_mm: rr(allowance), worstContourMove_mm: rr(worst_move), ratio: rr(worst_move / allowance, 3) },
    nodeDensity: { maxNodeGap_mm: rr(max_node_gap), limit_mm: rr(0.42 * a.maxbridge) },
    foundation: { paths: foundation_paths.length, rings: 2, spokes: RIBS, islandsExpected: 1 },
    wallWidth: { min: a.w0, max: a.w1 },
    bbox_mm: [rr(min_x, 2), rr(min_y, 2), rr(max_x, 2), rr(max_y, 2)],
    size_mm: size.map(v => rr(v, 1)),
    violations: [],
    warnings: ['PRINTABILITY UNPROVEN', 'deliberately near the lateral-support limit'],
  };
  const payload = { summary, foundation: { kind: 'annular-star', paths: foundation_paths }, layers };

  /** Fast two-panel SVG, f-string for f-string: an isometric layer cage (every 10th layer, the ROUNDED
   *  contour points; the rib tracks unrounded) and five plan cuts. Every interpolated number is a
   *  Python float printed with repr(): rr(...) results, `110 + cx`, `18 + n * 24 + cy * .32`, `H + 20`. */
  function svg(){
    const F = pyFloatRepr;
    const colors = ['#f6ff78', '#c9ff42', '#79f79b', '#45d9c0', '#78a7ff'];
    const iso = [];
    for(let k = 0; k < N; k += 10){
      const z = (k + 1) * a.lh;
      layers[k].contours.forEach((contour, j) => {
        const pts = contour.pts.map(([x, y]) => `${F(rr(x - .42 * y, 2))},${F(rr(H - z + .20 * x + .10 * y, 2))}`).join(' ');   // ((H - z) + .2x) + .1y
        iso.push(`<polyline points="${pts}" fill="none" stroke="${colors[j % colors.length]}" stroke-width=".38" opacity=".72"/>`);
      });
    }
    tracks.forEach((track, j) => {
      const den = Math.max(1, N - 1);
      const pts = track.map(([x, y], i) => `${F(rr(x - .42 * y, 2))},${F(rr(H - i * H / den + .20 * x + .10 * y, 2))}`).join(' ');   // ((H - ((i*H)/den)) + .2x) + .1y
      iso.push(`<polyline points="${pts}" fill="none" stroke="${colors[j % colors.length]}" stroke-width=".65" opacity=".9"/>`);
    });
    const cuts = [];
    [0.05, 0.28, 0.50, 0.72, 0.94].forEach((t, n) => {
      for(let j = 0; j < RIBS; j++){
        const [cx, cy] = rib_center(t, j);
        cuts.push(`<circle cx="${F(110 + cx)}" cy="${F(18 + n * 24 + cy * .32)}" r="2" fill="none" stroke="${colors[j % colors.length]}" stroke-width=".7"/>`);
      }
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -8 220 ${F(H + 20)}">`
      + '<rect x="-60" y="-8" width="220" height="180" fill="#070a12"/>'
      + iso.join('') + cuts.join('')
      + `<text x="-56" y="0" fill="#fff" font-family="sans-serif" font-size="5">${a.variant.toUpperCase()} · EXPERIMENT X1</text>`
      + '<text x="92" y="0" fill="#9bb0c8" font-family="sans-serif" font-size="4">PLAN CUTS</text></svg>';
  }
  /** the typed C3D intent handoff: json.dumps({...}, indent=2); `count` is an int, height / turns floats */
  const c3dJson = () => pyJsonDumpsPath({
    schema: 'c3d-design-intent/v1', status: 'intent-only; WEFT is the executed backend',
    primitive: { type: 'profile-array', count: RIBS, profile: 'ellipse' },
    operations: [
      { op: 'loft', along: 'Z', height: H },
      { op: 'twist', turns: TURNS },
      { op: 'bend', axis: 'centerline' },
      { op: 'radial-cantilever-fields', count: RIBS },
      { op: 'preserve-voids-between-ribs' },
    ],
    manufacturingBackend: 'WEFT alternating chord/web layers',
  }, { indent: 2, isInt: (p) => p[p.length - 1] === 'count' });
  /** print(json.dumps(summary, indent=2)); print(f"PREVIEW {preview}"); print(f"C3D_INTENT {c3d}") */
  const stdout = (previewPath, c3dPath) => summaryJson(summary) + '\n' + (previewPath != null ? `PREVIEW ${previewPath}\n` : '') + (c3dPath != null ? `C3D_INTENT ${c3dPath}\n` : '');

  return { payload, summary, svg, c3dJson, stdout, args: a, N, H, RIBS, TURNS, tracks, violations: [] };
}

/** out_path.with_name(out_path.stem.replace("_geometry", "") + "_preview.svg") and the same for "_c3d_intent.json" */
export function previewPathFor(out){ return pyPathWithName(out, pyPathStem(out).split('_geometry').join('') + '_preview.svg'); }
export function c3dPathFor(out){ return pyPathWithName(out, pyPathStem(out).split('_geometry').join('') + '_c3d_intent.json'); }

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv, { requireOut: true }); }
  catch(e){ console.error(`usage: weft_aero_geometry.mjs --variant {rasep,veo} --H H --lh LH --bead BEAD [--turns TURNS] [--w0 W0] [--w1 W1] [--K K] [--foundation FOUNDATION] [--maxbridge MAXBRIDGE] --plate PLATE PLATE --out OUT\nerror: ${e.message}`); process.exit(2); }
  let g;
  try { g = generateAero(args); }
  catch(e){ if(e.message.startsWith('REFUSED:')){ console.error(e.message); process.exit(1); } throw e; }
  const outPath = args.out;
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, toJson(g.payload));
  const preview = previewPathFor(outPath);
  fs.writeFileSync(preview, g.svg());
  const c3d = c3dPathFor(outPath);
  fs.writeFileSync(c3d, g.c3dJson());
  process.stdout.write(g.stdout(preview, c3d));
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
