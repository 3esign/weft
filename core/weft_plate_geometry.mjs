#!/usr/bin/env node
/* core/weft_plate_geometry.mjs — JavaScript port of plate_geometry.py (MERA: sixteen shallow, open
 * WEFT instruments on one A2L plate — four radial leans, four weave grammars, four rim-anchored
 * membranes, four contour shapes — on a 60 mm grid with one connected first layer).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same analytic contours, normals, weld nodes and membrane paths, the same JSON shape, key order and
 * rounding, the same SVG plan and the same stdout summary. The Python is stdlib-only (math + json),
 * so the numeric twins it needs are in core/weft_geom_ext.js: CPython's own math.hypot (not the C
 * library's), round() keeping -0.0, repr(float) and json.dumps. Parity with the Python output is
 * measured by tests/plate_geom_parity.test.mjs.
 *
 *   import { generatePlate, toJson } from './core/weft_plate_geometry.mjs';
 *   generatePlate({})                                   -> the payload object (summary/foundation/layers)
 *   node core/weft_plate_geometry.mjs --out FILE [--svg FILE --machine a2l --lh 0.24 --bead 0.45 --w 5 --e 1 --height 22.08]
 *
 * Where a line of the Python has a non-obvious meaning (int/float distinction in the JSON, Python's
 * half-to-even round(), int() truncation, evaluation order of a float expression) the comment on
 * the JavaScript says so.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pyRound } from './weft_geom.js';
import { pyHypot, pyRoundNSigned, pyFloatRepr, pyJsonDumps } from './weft_geom_ext.js';

/* ---------------- argparse twin: same flags, same defaults, same types ---------------- */
export const ARG_DEFAULTS = [
  ['out', 'str', null], ['svg', 'str', null], ['machine', 'choice', 'a2l', ['a2l']],
  ['lh', 'float', 0.24], ['bead', 'float', 0.45], ['w', 'float', 5.0], ['e', 'float', 1.0], ['height', 'float', 22.08],
];
function convert(def, v){
  const [name, type, , choices] = def;
  if(type === 'float'){ const f = Number(v); if(String(v).trim() === '' || Number.isNaN(f)) throw new Error(`argument --${name}: invalid float value: '${v}'`); return f; }
  if(type === 'choice'){ if(!choices.includes(v)) throw new Error(`argument --${name}: invalid choice: '${v}' (choose from ${choices.map(c => `'${c}'`).join(', ')})`); return v; }
  return String(v);
}
/** Build the args object (same key order as argparse's Namespace) from a partial object or argv.
 *  `out` is only required on the command line (the generator itself never writes a file). */
export function parseArgs(input, { requireOut = false } = {}){
  const args = {};
  for(const [name, , dflt] of ARG_DEFAULTS) args[name] = dflt;
  if(Array.isArray(input)){
    for(let i = 0; i < input.length; i++){
      let a = input[i];
      if(!a.startsWith('--')) throw new Error(`unrecognized arguments: ${a}`);
      let val;
      const eq = a.indexOf('=');
      if(eq >= 0){ val = a.slice(eq + 1); a = a.slice(0, eq); }
      else { val = input[++i]; if(val === undefined) throw new Error(`argument ${a}: expected one argument`); }
      const name = a.slice(2);
      const def = ARG_DEFAULTS.find(d => d[0] === name);
      if(!def) throw new Error(`unrecognized arguments: ${a}`);
      args[name] = convert(def, val);
    }
    if(args.out === null) throw new Error('the following arguments are required: --out');
  } else if(input && typeof input === 'object'){
    for(const [k, v] of Object.entries(input)){
      const def = ARG_DEFAULTS.find(d => d[0] === k);
      if(!def) throw new Error(`unknown argument ${k}`);
      args[k] = v === null || v === undefined ? def[2] : convert(def, v);
    }
    if(requireOut && args.out === null) throw new Error('the following arguments are required: --out');
  }
  return args;
}

/* ---------------- int/float bookkeeping for json.dumps ---------------- */
/** Every number the Python writes is a float (round() results, CENTERS, the float args, the tile
 *  radii, -110.0 ...) except the values under these keys, which are Python ints: counts, ids, the
 *  literal K/temp/bed and plateIntent_mm = [240, 240]. */
const INT_KEYS = new Set(['N', 'tileCount', 'K', 'temp', 'bed', 'id', 'tile', 'k', 'plateIntent_mm']);
const isIntKey = (k) => INT_KEYS.has(k);
/** json.dumps(payload, separators=(",", ":")) — the geometry file's exact text. */
export function toJson(payload){ return pyJsonDumps(payload, { isInt: isIntKey }); }

const sgn = (v) => v < 0 ? -1.0 : 1.0;

/** A small family of non-self-intersecting, photographically distinct contours. */
function xy_shape(kind, t, rx, ry = null){
  ry = ry === null ? rx : ry;
  const c = Math.cos(t), s = Math.sin(t);
  if(kind === 'circle') return [rx * c, ry * s];
  if(kind === 'ellipse') return [rx * c, ry * s];
  if(kind === 'square'){                                        // rounded superellipse
    const power = 0.5;
    // abs(c) ** 0.5 is C pow(|c|, 0.5); Math.pow matches it bit for bit on every angle used here
    return [rx * sgn(c) * Math.pow(Math.abs(c), power), ry * sgn(s) * Math.pow(Math.abs(s), power)];
  }
  if(kind === 'peanut'){ const r = rx * (1.0 + 0.22 * Math.cos(2.0 * t)); return [r * c, r * s]; }
  if(kind === 'clover'){ const r = rx * (1.0 + 0.15 * Math.cos(4.0 * t)); return [r * c, r * s]; }
  throw new Error(kind);
}

/** The generator. Returns { payload, svg(), stdout } — payload exactly as the Python writes it with
 *  json.dumps; svg() the plan SVG text; stdout the JSON summary the script prints. */
export function generatePlate(argsIn = {}){
  const a = parseArgs(argsIn);
  const PITCH = 60.0;
  const CENTERS = [];
  for(let row = 0; row < 4; row++) for(let col = 0; col < 4; col++) CENTERS.push([(col - 1.5) * PITCH, (1.5 - row) * PITCH]);
  const N = pyRound(a.height / a.lh);                           // int(round(x)): half to even
  const H = N * a.lh;
  const POINTS = 112;
  const NODE_PITCH = 5.5;
  const CAP_LAYER = 35;                 // z=8.40; previous layer is a chord layer
  const CAP_PITCH = 0.36;               // safely below 1.15 * the measured 0.45 bead

  function contour(cx, cy, kind, rx, ry = null, meta = {}){
    const q = [];
    for(let i = 0; i < POINTS; i++){ const [x, y] = xy_shape(kind, 2.0 * Math.PI * i / POINTS, rx, ry); q.push([cx + x, cy + y]); }
    // finite-difference tangent; right-hand normal of a CCW contour is outward
    const normals = [];
    for(let i = 0; i < POINTS; i++){
      const [x0, y0] = q[(i - 1 + POINTS) % POINTS], [x1, y1] = q[(i + 1) % POINTS];
      const tx = x1 - x0, ty = y1 - y0;
      const ll = pyHypot(tx, ty) || 1.0;
      normals.push([ty / ll, -tx / ll]);
    }
    const closed = q.concat([q[0]]);
    const nrms = normals.concat([normals[0]]);
    const cum = [0.0];
    for(let i = 0; i + 1 < closed.length; i++){ const p = closed[i], r = closed[i + 1]; cum.push(cum[cum.length - 1] + pyHypot(r[0] - p[0], r[1] - p[1])); }
    const total = cum[cum.length - 1];
    let nk = Math.max(12, pyRound(total / NODE_PITCH));           // int(round()) half to even
    if(nk % 2) nk += 1;
    const nodes = []; for(let j = 0; j < nk; j++) nodes.push((j + 0.5) * total / nk);
    const rec = {
      pts: closed.map(([x, y]) => [pyRoundNSigned(x, 3), pyRoundNSigned(y, 3)]),
      nrm: nrms.map(([x, y]) => [pyRoundNSigned(x, 5), pyRoundNSigned(y, 5)]),
      cum: cum.map(v => pyRoundNSigned(v, 4)),
      total: pyRoundNSigned(total, 4),
      nodes: nodes.map(v => pyRoundNSigned(v, 4)),
    };
    Object.assign(rec, meta);                                     // rec.update(meta): keys appended in order
    return rec;
  }

  /** Offset a boundary along its local normal; a radius cannot answer a clover. */
  function offset_ring(cx, cy, kind, scale, inward, n = 96){
    const q = []; for(let i = 0; i < n; i++) q.push(xy_shape(kind, 2.0 * Math.PI * i / n, scale));
    const pts = [];
    for(let i = 0; i < n; i++){
      const [x, y] = q[i];
      const [x0, y0] = q[(i - 1 + n) % n], [x1, y1] = q[(i + 1) % n];
      const tx = x1 - x0, ty = y1 - y0;
      const ll = pyHypot(tx, ty) || 1.0;
      const nx = ty / ll, ny = -tx / ll;
      pts.push([pyRoundNSigned(cx + x - nx * inward, 3), pyRoundNSigned(cy + y - ny * inward, 3)]);
    }
    pts.push(pts[0]);
    return pts;
  }

  /** One rim-first membrane anchored on the wall's inner chord rail. */
  function membrane(cx, cy, kind, outer, core){
    const path_ = [];
    let inward = a.w / 2.0;
    while(outer - inward > Math.max(core, 0.25)){
      const ring = offset_ring(cx, cy, kind, outer, inward);
      if(path_.length) path_.push(ring[0]);                       // same angle, one short radial stitch into the next turn
      for(const p of ring) path_.push(p);
      inward += CAP_PITCH;                                        // accumulates by repeated addition, as in Python
    }
    if(core <= 0.25) path_.push([pyRoundNSigned(cx, 3), pyRoundNSigned(cy, 3)]);
    else for(const p of offset_ring(cx, cy, 'circle', core, 0.0, 48)) path_.push(p);
    return path_;
  }

  // One tile, one legible question.  Rows are: lean, grammar, membrane, contour.
  const tiles = [
    { id: 1, name: 'nagib-0', kind: 'circle', r0: 15.0, r1: 15.0, web: 'staple' },
    { id: 2, name: 'nagib-8', kind: 'circle', r0: 12.0, r1: 15.0, web: 'staple' },
    { id: 3, name: 'nagib-15', kind: 'circle', r0: 9.0, r1: 15.0, web: 'staple' },
    { id: 4, name: 'nagib-22', kind: 'circle', r0: 6.0, r1: 15.0, web: 'staple' },
    { id: 5, name: 'staple', kind: 'circle', r0: 15.0, r1: 15.0, web: 'staple' },
    { id: 6, name: 'perp', kind: 'circle', r0: 15.0, r1: 15.0, web: 'perp' },
    { id: 7, name: 'diagonal', kind: 'circle', r0: 15.0, r1: 15.0, web: 'diagonal' },
    { id: 8, name: 'sine', kind: 'circle', r0: 15.0, r1: 15.0, web: 'sine' },
    { id: 9, name: 'core-0', kind: 'circle', r0: 14.0, r1: 14.0, web: 'staple', core: 0.0 },
    { id: 10, name: 'core-06', kind: 'circle', r0: 14.0, r1: 14.0, web: 'staple', core: 0.6 },
    { id: 11, name: 'peanut-cap', kind: 'peanut', r0: 12.5, r1: 12.5, web: 'staple', core: 1.2 },
    { id: 12, name: 'clover-cap', kind: 'clover', r0: 12.5, r1: 12.5, web: 'staple', core: 2.0 },
    { id: 13, name: 'ellipse', kind: 'ellipse', r0: 17.0, r1: 17.0, ry: 11.0, web: 'staple' },
    { id: 14, name: 'square', kind: 'square', r0: 14.0, r1: 14.0, web: 'staple' },
    { id: 15, name: 'peanut', kind: 'peanut', r0: 14.0, r1: 14.0, web: 'diagonal' },
    { id: 16, name: 'clover', kind: 'clover', r0: 14.0, r1: 14.0, web: 'eight' },
  ];
  const tileRy = (t) => ('ry' in t ? t.ry : null);               // tile.get('ry')

  function spiral(cx, cy, r_outer = 19.6, r_inner = 16.8, pitch = 0.46){
    const pts = [];
    const turns = (r_outer - r_inner) / pitch;
    const n = Math.max(160, Math.trunc(turns * 96));              // int(): truncation
    for(let i = 0; i <= n; i++){
      const u = i / n;
      const t = 2.0 * Math.PI * turns * u;                        // ((2*pi)*turns)*u
      const r = r_outer + (r_inner - r_outer) * u;
      pts.push([pyRoundNSigned(cx + r * Math.cos(t), 3), pyRoundNSigned(cy + r * Math.sin(t), 3)]);
    }
    return pts;
  }

  // Sixteen annular brims plus a complete grid of narrow ribs.  Intersections make one first-layer island.
  const foundation_paths = CENTERS.map(([cx, cy]) => spiral(cx, cy));
  for(let row = 0; row < 4; row++){
    const y = (1.5 - row) * PITCH;
    foundation_paths.push([[-110.0, y - 0.22], [110.0, y - 0.22]]);
    foundation_paths.push([[-110.0, y + 0.22], [110.0, y + 0.22]]);
  }
  for(let col = 0; col < 4; col++){
    const x = (col - 1.5) * PITCH;
    foundation_paths.push([[x - 0.22, -110.0], [x - 0.22, 110.0]]);
    foundation_paths.push([[x + 0.22, -110.0], [x + 0.22, 110.0]]);
  }
  // Short hash marks on the south side identify 1..16 even if a photo is separated from the plan.
  CENTERS.forEach(([cx, cy], i) => {
    const idx = i + 1;
    const marks = 1 + ((idx - 1) % 4);
    for(let m = 0; m < marks; m++){ const x = cx - 3.0 + m * 2.0; foundation_paths.push([[x, cy - 19.6], [x, cy - 23.0]]); }
  });

  const layers = [];
  const caps_summary = [];
  for(let k = 0; k < N; k++){
    const z = pyRoundNSigned(k * a.lh, 4);
    const layer = { k, zBot: z, zTop: pyRoundNSigned(z + a.lh, 4), contours: [] };
    const u = k / Math.max(1, N - 1);
    tiles.forEach((tile, i) => {
      const [cx, cy] = CENTERS[i];
      const r = tile.r0 + (tile.r1 - tile.r0) * u;
      layer.contours.push(contour(cx, cy, tile.kind, r, tileRy(tile), { web: tile.web, tile: tile.id, label: tile.name }));
    });
    if(k === CAP_LAYER){
      layer.caps = [];
      for(let i = 8; i < 12; i++){
        const tile = tiles[i], [cx, cy] = CENTERS[i];
        const pts = membrane(cx, cy, tile.kind, tile.r0, tile.core);
        const membrane_outer = tile.r0 - a.w / 2.0;
        layer.caps.push({ pts, cx, cy, r_ins: membrane_outer, span_mm: pyRoundNSigned(2.0 * membrane_outer, 2), anchoredFrac: 1.0,
          coreRadius_mm: tile.core, shape: tile.kind, tile: tile.id,
          process: 'single-layer-inward-spiral/mera-4x4-2026-09-03', physicalStatus: 'failed',
          evidence: 'specimens/2026-09-03_MERA_A2L_4x4_v1_physical/outcomes.md' });
        caps_summary.push({ tile: tile.id, z, shape: tile.kind, coreRadius_mm: tile.core, declaredAnchor: 1.0,
          process: 'single-layer-inward-spiral/mera-4x4-2026-09-03', physicalStatus: 'failed',
          evidence: 'specimens/2026-09-03_MERA_A2L_4x4_v1_physical/outcomes.md' });
      }
    }
    layers.push(layer);
  }

  const summary = {
    name: 'MERA_A2L_4x4_v1', N, H: pyRoundNSigned(H, 3), centers: CENTERS,
    plateIntent_mm: [240, 240], tilePitch_mm: PITCH, tileCount: 16,
    args: { lh: a.lh, bead: a.bead, w: a.w, e: a.e, r0: 15.0, K: 18, foundation: 3.0, maxbridge: 12.0, temp: 220, bed: 55 },
    // {k: v for k, v in t.items() if k not in ('r0', 'r1', 'ry')} — the remaining keys keep their order
    tiles: tiles.map(t => { const o = {}; for(const [k, v] of Object.entries(t)) if(!['r0', 'r1', 'ry'].includes(k)) o[k] = v; return o; }),
    caps: caps_summary,
    experiment: {
      row1: 'radial lean: 0, 8, 15, 22 degrees approximately',
      row2: 'same circle, four weave grammars',
      row3: 'four rim-anchored membranes; core and boundary shape vary',
      row4: 'ellipse, rounded square, peanut and clover contours',
      readout: 'photograph whole plate from above and rows 1/2 in raking side light',
    },
  };
  const payload = { summary, foundation: { paths: foundation_paths, kind: 'connected-grid-brims' }, layers };

  /** The plan SVG, f-string for f-string: coordinates are the rounded contour floats printed with
   *  repr() (so "-0.0" where -y is a negative zero), the labels the tile id and name. */
  function svg(){
    const F = pyFloatRepr;
    const out = ['<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="-125 -125 250 250">',
      '<rect x="-125" y="-125" width="250" height="250" fill="#f4f1e8"/>',
      '<g fill="none" stroke="#163f37" stroke-width="0.7">'];
    tiles.forEach((tile, i) => {
      const [cx, cy] = CENTERS[i];
      const q = contour(cx, cy, tile.kind, tile.r1, tileRy(tile)).pts;
      out.push('<path d="M ' + q.map(([x, y]) => `${F(x)},${F(-y)}`).join(' L ') + '"/>');
    });
    out.push('</g>', '<g font-family="sans-serif" font-size="4" fill="#163f37" text-anchor="middle">');
    tiles.forEach((tile, i) => {
      const [cx, cy] = CENTERS[i];
      out.push(`<text x="${F(cx)}" y="${F(-cy + 1)}">${String(tile.id).padStart(2, '0')}</text>`);
      out.push(`<text x="${F(cx)}" y="${F(-cy + 6)}" font-size="2.5">${tile.name}</text>`);
    });
    out.push('</g></svg>');
    return out.join('\n');
  }

  /** The script's final print(json.dumps(..., indent=2)); `out` is filled in by the CLI. */
  const stdout = (outPath) => pyJsonDumps({ out: outPath, layers: N, height_mm: H, tiles: 16, caps: caps_summary.length,
    foundation_paths: foundation_paths.length, nominal_bbox_mm: [220.0, 220.0] },
  { indent: 2, isInt: (k) => ['layers', 'tiles', 'caps', 'foundation_paths'].includes(k) });

  return { payload, svg, stdout, args: a };
}

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv, { requireOut: true }); }
  catch(e){ console.error(`usage: weft_plate_geometry.mjs --out OUT [--svg SVG] [--machine {a2l}] [--lh LH] [--bead BEAD] [--w W] [--e E] [--height HEIGHT]\nerror: ${e.message}`); process.exit(2); }
  const g = generatePlate(args);
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, toJson(g.payload));
  if(args.svg) fs.writeFileSync(args.svg, g.svg());
  console.log(g.stdout(args.out));
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
