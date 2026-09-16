#!/usr/bin/env node
/* core/weft_limit16_geometry.mjs — JavaScript port of limit16_geometry.py (the 4x4 limit plate for a
 * registered WEFT machine: four bridges, four cantilevers, three line widths, a long reversal path,
 * two native WEFT leans, one membrane and one mixed-height body on one connected first layer).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same machines.json lookup, the same refusal on an ASSUMED bead, the same JSON shape, key order and
 * rounding, the same SVG plan and the same stdout summary. The Python is stdlib-only (math + json),
 * so the numeric twins it needs are in core/weft_geom_ext.js: CPython's own math.hypot (not the C
 * library's), round() keeping -0.0, repr(float) and json.dumps. Parity with the Python output is
 * measured by tests/limit16_geom_parity.test.mjs and, for the printed A2L plate, by
 * tests/limit16_js_build_parity.test.mjs through the Node build chain.
 *
 *   import { generateLimit16, toJson } from './core/weft_limit16_geometry.mjs';
 *   generateLimit16({ machine: 'a2l' })                 -> the payload object (summary/foundation/layers)
 *   node core/weft_limit16_geometry.mjs --machine a2l --out FILE [--svg FILE --height 9.6 --allow-assumed-bead]
 *
 * Where a line of the Python has a non-obvious meaning (int/float distinction in the JSON, Python's
 * half-to-even round(), evaluation order of a float expression) the comment on the JavaScript says so.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pyRound } from './weft_geom.js';
import { pyHypot, pyRoundNSigned, pyFloatRepr, pyFormatFixed, pyJsonDumps } from './weft_geom_ext.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** ROOT = Path(__file__).resolve().parent in the Python; the script sits one level above core/. */
export const ROOT = path.resolve(HERE, '..');

/* ---------------- argparse twin: same flags, same defaults, same types ---------------- */
export const ARG_DEFAULTS = [
  ['machine', 'choice', null, ['a2l', 'ender']], ['out', 'str', null], ['svg', 'str', null],
  ['height', 'float', 9.6], ['allow_assumed_bead', 'flag', false],
];
function convert(def, v){
  const [name, type, , choices] = def;
  if(type === 'float'){ const f = Number(v); if(String(v).trim() === '' || Number.isNaN(f)) throw new Error(`argument --${name}: invalid float value: '${v}'`); return f; }
  if(type === 'choice'){ if(!choices.includes(v)) throw new Error(`argument --${name}: invalid choice: '${v}' (choose from ${choices.map(c => `'${c}'`).join(', ')})`); return v; }
  if(type === 'flag') return !!v;
  return String(v);
}
/** Build the args object (same key order as argparse's Namespace) from a partial object or argv.
 *  Flags may be given with underscores or dashes in the object form; `out` is only required on the
 *  command line (the generator itself never writes a file). */
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
      const name = a.slice(2).replace(/-/g, '_');
      const def = ARG_DEFAULTS.find(d => d[0] === name);
      if(!def) throw new Error(`unrecognized arguments: ${a}`);
      if(def[1] === 'flag'){ if(eq >= 0) throw new Error(`argument ${a}: ignored explicit argument '${val}'`); args[name] = true; continue; }
      if(eq < 0){ val = input[++i]; if(val === undefined) throw new Error(`argument ${a}: expected one argument`); }
      args[name] = convert(def, val);
    }
    if(args.machine === null) throw new Error('the following arguments are required: --machine' + (args.out === null ? ', --out' : ''));
    if(args.out === null) throw new Error('the following arguments are required: --out');
  } else if(input && typeof input === 'object'){
    for(const [k0, v] of Object.entries(input)){
      const k = k0.replace(/-/g, '_');
      const def = ARG_DEFAULTS.find(d => d[0] === k);
      if(!def) throw new Error(`unknown argument ${k0}`);
      args[k] = v === null || v === undefined ? def[2] : convert(def, v);
    }
    if(args.machine === null) throw new Error('the following arguments are required: --machine');
    if(requireOut && args.out === null) throw new Error('the following arguments are required: --out');
  }
  return args;
}

/** Reads machines.json next to the generators, like PROFILES in the Python. */
export function loadProfiles(){ return JSON.parse(fs.readFileSync(path.join(ROOT, 'machines.json'), 'utf8')); }

/* ---------------- int/float bookkeeping for json.dumps ---------------- */
/** Every number the Python writes is a float (rr() results, machine floats, CENTERS, H, ...) except
 *  the values under these keys, which are Python ints: tile ids and grid indices, counts, the
 *  integer args (temp and bed come from machines.json, where they are written as integers). */
const INT_KEYS = new Set(['id', 'value_deg', 'N', 'tileCount', 'firstLayerSpeed', 'K', 'maxCapRadius', 'temp', 'bed', 'fan',
  'first_layer_max_islands', 'k', 'tile', 'row', 'col']);
const isIntKey = (k) => INT_KEYS.has(k);
/** json.dumps(payload, separators=(",", ":")) — the geometry file's exact text. */
export function toJson(payload){ return pyJsonDumps(payload, { isInt: isIntKey }); }

/** The generator. Returns { payload, svg(), stdout } — payload exactly as the Python writes it with
 *  json.dumps; svg() the plan SVG text; stdout the JSON summary the script prints. Throws the
 *  Python's REFUSED SystemExit message on an assumed bead without --allow-assumed-bead. */
export function generateLimit16(argsIn, opts = {}){
  const a = parseArgs(argsIn);
  const PROFILES = opts.profiles || loadProfiles();
  const M = PROFILES[a.machine];
  if(M.beadSource !== 'measured' && !a.allow_assumed_bead)
    throw new Error(`REFUSED: ${a.machine} bead=${pyFloatRepr(M.bead)} mm is ${M.beadSource}; measure C1 or explicitly pass --allow-assumed-bead`);

  const LH = +M.lh, BEAD = +M.bead, FIRST_BEAD = +M.firstLayerBead;
  const N = Math.max(8, pyRound(a.height / LH));               // int(round(x)): half to even
  const H = pyRoundNSigned(N * LH, 4);
  const PITCH = 46.0;
  const CENTERS = [];
  for(let row = 0; row < 4; row++) for(let col = 0; col < 4; col++) CENTERS.push([(col - 1.5) * PITCH, (1.5 - row) * PITCH]);
  const BRIDGES = [4.0, 8.0, 12.0, 16.0];
  const CANTILEVERS = [0.8, 1.8, 3.0, 4.5];
  const THIN = pyRoundNSigned(0.85 * (+M.nozzle), 3);
  const WIDE = pyRoundNSigned(1.65 * (+M.nozzle), 3);
  const BRIDGE_SPEED = a.machine === 'a2l' ? 18.0 : 15.0;
  const PRINT_SPEED = a.machine === 'a2l' ? 30.0 : 26.0;

  const rr = (v, n = 3) => pyRoundNSigned(+v, n);

  function circle_points(cx, cy, radius, count = 72, close = false){
    const pts = [];
    // 2 * math.pi * i / count is ((2*pi)*i)/count, left to right
    for(let i = 0; i < count; i++) pts.push([rr(cx + radius * Math.cos(2 * Math.PI * i / count)), rr(cy + radius * Math.sin(2 * Math.PI * i / count))]);
    if(close) pts.push(pts[0]);
    return pts;
  }

  function dense_line(p0, p1, step = 0.4){
    const length = pyHypot(p1[0] - p0[0], p1[1] - p0[1]);
    const count = Math.max(1, Math.ceil(length / step));
    const out = [];
    // p0 + (p1 - p0) * i / count is p0 + (((p1-p0)*i)/count)
    for(let i = 0; i <= count; i++) out.push([rr(p0[0] + (p1[0] - p0[0]) * i / count), rr(p0[1] + (p1[1] - p0[1]) * i / count)]);
    return out;
  }

  function raw(tile, pts, role, label, { closed = false, bead = null, speed = null, intent = null } = {}){
    const row = Math.floor((tile - 1) / 4), col = (tile - 1) % 4;      // divmod(tile-1, 4)
    const rec = { pts: pts.map(([x, y]) => [rr(x), rr(y)]), role, label, tile, row, col, closed: !!closed };
    if(bead !== null) rec.bead = rr(bead);
    if(speed !== null) rec.speed = rr(speed);
    if(intent) rec.intent = intent;
    return rec;
  }

  function circle_contour(cx, cy, radius, tile, label, web, width = 3.0, count = 72){
    const q = circle_points(cx, cy, radius, count, false);
    const closed = q.concat([q[0]]);
    const normals = [];
    for(let i = 0; i < count; i++){
      const [x0, y0] = q[(i - 1 + count) % count], [x1, y1] = q[(i + 1) % count];
      const tx = x1 - x0, ty = y1 - y0;
      const ll = pyHypot(tx, ty) || 1.0;
      normals.push([rr(ty / ll, 5), rr(-tx / ll, 5)]);
    }
    const cum = [0.0];
    for(let i = 0; i + 1 < closed.length; i++){ const p = closed[i], r = closed[i + 1]; cum.push(cum[cum.length - 1] + pyHypot(r[0] - p[0], r[1] - p[1])); }
    const total = cum[cum.length - 1];
    let nk = Math.max(10, pyRound(total / 4.5));                  // int(round()) half to even
    if(nk % 2) nk += 1;
    const nodes = []; for(let j = 0; j < nk; j++) nodes.push((j + 0.5) * total / nk);
    const row = Math.floor((tile - 1) / 4), col = (tile - 1) % 4;
    return { pts: closed, nrm: normals.concat([normals[0]]), cum: cum.map(v => rr(v, 4)), total: rr(total, 4),
      nodes: nodes.map(v => rr(v, 4)), web, w: width, e: 0.7, tile, label, row, col };
  }

  function serpent(cx, cy){
    const pts = [];
    const ys = []; for(let i = 0; i < 13; i++) ys.push(cy - 12 + 2 * i);
    for(let i = 0; i < ys.length; i++){
      const y = ys[i], left = cx - 13, right = cx + 13;
      const run = i % 2 === 0 ? [[left, y], [right, y]] : [[right, y], [left, y]];
      if(!pts.length) pts.push(run[0], run[1]);
      else { pts.push(run[0]); pts.push(run[1]); }
    }
    return pts;
  }

  function membrane(cx, cy, radius){
    const pitch = BEAD * 0.78;
    const turns = radius / pitch;
    const count = Math.max(240, Math.ceil(turns * 72));
    const pts = [];
    for(let i = 0; i <= count; i++){
      const u = i / count;
      const t = 2 * Math.PI * turns * u;             // ((2*pi)*turns)*u
      const r = radius * (1 - u);
      pts.push([rr(cx + r * Math.cos(t)), rr(cy + r * Math.sin(t))]);
    }
    return pts;
  }

  const TILES = [
    { id: 1, code: 'B04', name: 'bridge-4', family: 'bridge', value_mm: 4.0, question: 'short bridge control', readout: 'underside straightness' },
    { id: 2, code: 'B08', name: 'bridge-8', family: 'bridge', value_mm: 8.0, question: 'medium bridge', readout: 'underside sag' },
    { id: 3, code: 'B12', name: 'bridge-12', family: 'bridge', value_mm: 12.0, question: 'current gate boundary', readout: 'sag and strand separation' },
    { id: 4, code: 'B16', name: 'bridge-16', family: 'bridge', value_mm: 16.0, question: 'deliberate bridge extension', readout: 'failure onset' },
    { id: 5, code: 'C08', name: 'cantilever-0.8', family: 'cantilever', value_mm: 0.8, question: 'short free end control', readout: 'tip curl' },
    { id: 6, code: 'C18', name: 'cantilever-1.8', family: 'cantilever', value_mm: 1.8, question: 'medium free end', readout: 'tip displacement' },
    { id: 7, code: 'C30', name: 'cantilever-3.0', family: 'cantilever', value_mm: 3.0, question: 'current gate boundary', readout: 'curl and nozzle contact' },
    { id: 8, code: 'C45', name: 'cantilever-4.5', family: 'cantilever', value_mm: 4.5, question: 'deliberate cantilever extension', readout: 'survival and curl' },
    { id: 9, code: 'W34', name: `wall-${pyFormatFixed(THIN, 2)}`, family: 'line_width', value_mm: THIN, question: 'thin single road', readout: 'continuity and measured width' },
    { id: 10, code: 'WNM', name: `wall-${pyFormatFixed(BEAD, 2)}`, family: 'line_width', value_mm: BEAD, question: 'machine bead control', readout: 'measured width' },
    { id: 11, code: 'W66', name: `wall-${pyFormatFixed(WIDE, 2)}`, family: 'line_width', value_mm: WIDE, question: 'wide road on 0.4 nozzle', readout: 'ridging and width' },
    { id: 12, code: 'LONG', name: 'long-serpent', family: 'path', value_mm: null, question: 'long uninterrupted path with 24 reversals', readout: 'flow drift and corner buildup' },
    { id: 13, code: 'L17', name: 'weft-lean-17', family: 'lean', value_deg: 17, question: 'native WEFT moderate radial lean', readout: 'side profile and welds' },
    { id: 14, code: 'L32', name: 'weft-lean-32', family: 'lean', value_deg: 32, question: 'native WEFT steep radial lean', readout: 'first degraded layer' },
    { id: 15, code: 'MEM', name: 'membrane-18', family: 'membrane', value_mm: 18.0, question: 'rim-anchored single-layer membrane', readout: 'turn fusion and center closure' },
    { id: 16, code: 'MIX', name: 'mixed-height', family: 'scheduler', value_mm: H, question: 'three bodies ending at 1/3, 2/3 and full height', readout: 'clean Z schedule and junctions' },
  ];

  /* Two annular roads around each cell plus crossing ribs make one first-layer island. */
  const foundation_paths = [];
  CENTERS.forEach(([cx, cy], idx) => {
    const tile = idx + 1;
    foundation_paths.push(circle_points(cx, cy, 19.5, 96, true));
    foundation_paths.push(circle_points(cx, cy, 18.85, 96, true));
    const row = Math.floor((tile - 1) / 4), col = (tile - 1) % 4;
    for(let mark = 0; mark <= col; mark++){ const x = cx - 3.0 + mark * 2.0; foundation_paths.push([[rr(x), rr(cy - 19.5)], [rr(x), rr(cy - 22.0)]]); }
    for(let mark = 0; mark <= row; mark++){ const y = cy - 3.0 + mark * 2.0; foundation_paths.push([[rr(cx - 19.5), rr(y)], [rr(cx - 22.0), rr(y)]]); }
  });
  const edge = 1.5 * PITCH + 19.5;
  for(let row = 0; row < 4; row++){ const y = (1.5 - row) * PITCH; foundation_paths.push([[-edge, y], [edge, y]]); }
  for(let col = 0; col < 4; col++){ const x = (col - 1.5) * PITCH; foundation_paths.push([[x, -edge], [x, edge]]); }

  const layers = [];
  const cap_summary = [];
  // round(N / 3): Python's round() on a float, half to even, returning an int
  const mixed_stops = [Math.max(2, pyRound(N / 3)), Math.max(4, pyRound(2 * N / 3)), N];
  for(let k = 0; k < N; k++){
    const z_bot = rr(k * LH, 4);
    const z_top = rr((k + 1) * LH, 4);
    const layer = { k, zBot: z_bot, zTop: z_top, contours: [], paths: [] };

    // 01-04: two persistent support rails; three genuinely unsupported top strands.
    BRIDGES.forEach((span, idx) => {
      const tile = idx + 1;
      const [cx, cy] = CENTERS[tile - 1];
      const x0 = cx - span / 2, x1 = cx + span / 2;
      layer.paths.push(raw(tile, [[x0, cy - 5.5], [x0, cy + 5.5]], 'support', TILES[tile - 1].name, { intent: 'bridge support rail' }));
      layer.paths.push(raw(tile, [[x1, cy - 5.5], [x1, cy + 5.5]], 'support', TILES[tile - 1].name, { intent: 'bridge support rail' }));
      if(k === N - 1){
        for(const dy of [-3.0, 0.0, 3.0])
          layer.paths.push(raw(tile, dense_line([x0, cy + dy], [x1, cy + dy]), 'bridge', TILES[tile - 1].name,
            { speed: BRIDGE_SPEED, intent: `unsupported span ${pyFormatFixed(span, 1)} mm` }));
      }
    });

    // 05-08: one persistent rail; three free-ended top roads.
    CANTILEVERS.forEach((length, j) => {
      const tile = 5 + j;
      const [cx, cy] = CENTERS[tile - 1];
      const x0 = cx - 5.5;
      layer.paths.push(raw(tile, [[x0, cy - 5.5], [x0, cy + 5.5]], 'support', TILES[tile - 1].name, { intent: 'cantilever root' }));
      if(k === N - 1){
        for(const dy of [-3.0, 0.0, 3.0])
          layer.paths.push(raw(tile, dense_line([x0, cy + dy], [x0 + length, cy + dy]), 'cantilever', TILES[tile - 1].name,
            { speed: BRIDGE_SPEED, intent: `free end ${pyFormatFixed(length, 1)} mm` }));
      }
    });

    // 09-11: the same wall geometry with under-, nominal- and over-wide extrusion.
    for(const [tile, width] of [[9, THIN], [10, BEAD], [11, WIDE]]){
      const [cx, cy] = CENTERS[tile - 1];
      layer.paths.push(raw(tile, circle_points(cx, cy, 8.5), 'wall', TILES[tile - 1].name,
        { closed: true, bead: width, speed: PRINT_SPEED, intent: `commanded line width ${pyFormatFixed(width, 3)} mm` }));
    }

    // 12: around 360 mm without retraction, repeated at every Z level.
    {
      const [cx, cy] = CENTERS[11];
      layer.paths.push(raw(12, serpent(cx, cy), 'wall', TILES[11].name, { speed: PRINT_SPEED, intent: 'long path, 24 sharp reversals' }));
    }

    // 13-14: native WEFT contour grammar, not raw imitation.
    const u = k / Math.max(1, N - 1);
    {
      const [cx, cy] = CENTERS[12];
      layer.contours.push(circle_contour(cx, cy, 8.0 + 3.0 * u, 13, TILES[12].name, 'staple', 3.0));
    }
    {
      const [cx, cy] = CENTERS[13];
      layer.contours.push(circle_contour(cx, cy, 5.0 + 6.0 * u, 14, TILES[13].name, 'staple', 3.0));
    }

    // 15: a wall supports a rim-first membrane only on the final global layer.
    {
      const [cx, cy] = CENTERS[14];
      layer.paths.push(raw(15, circle_points(cx, cy, 9.0), 'support', TILES[14].name, { closed: true, intent: 'membrane rim' }));
      if(k === N - 1){
        const cap = { pts: membrane(cx, cy, 9.0), cx, cy, r_ins: 9.0, span_mm: 18.0, anchoredFrac: 1.0, tile: 15, label: TILES[14].name, bead: BEAD,
          process: 'single-layer-inward-spiral/limit16-18mm-v1', physicalStatus: 'failed', evidence: 'specimens/LIMIT16_2026-09-04_RESULTS.md' };
        layer.caps = [cap];                        // inserted after "paths": dict insertion order
        cap_summary.push({ tile: 15, z: z_bot, span_mm: 18.0, declaredAnchor: 1.0, process: 'single-layer-inward-spiral/limit16-18mm-v1',
          physicalStatus: 'failed', evidence: 'specimens/LIMIT16_2026-09-04_RESULTS.md' });
      }
    }

    // 16: three independent bodies stop at different heights; small links mark each stop.
    {
      const [cx, cy] = CENTERS[15];
      const xs = [cx - 6.0, cx, cx + 6.0];
      for(let branch = 0; branch < 3; branch++){
        const x = xs[branch], stop = mixed_stops[branch];
        if(k < stop) layer.paths.push(raw(16, [[x, cy - 5.5], [x, cy + 5.5]], 'support', TILES[15].name, { intent: `branch ${branch + 1}, stop layer ${stop}` }));
        if(k === stop - 1 && branch < 2)
          layer.paths.push(raw(16, dense_line([x, cy], [xs[branch + 1], cy]), 'bridge', TILES[15].name, { speed: BRIDGE_SPEED, intent: 'six millimetre terminal link' }));
      }
      if(k === N - 1)
        layer.paths.push(raw(16, dense_line([cx + 3.0, cy], [cx + 9.0, cy]), 'cantilever', TILES[15].name, { speed: BRIDGE_SPEED, intent: 'center-anchored top junction' }));
    }
    layers.push(layer);
  }

  const summary = {
    name: `LIMIT16_${a.machine.toUpperCase()}_v1`,
    machine: a.machine,
    machineLabel: M.label,
    machineQualification: { beadSource: M.beadSource, beadEvidence: M.beadEvidence, assumedAcknowledged: !!a.allow_assumed_bead },
    N, H, tileCount: 16, tilePitch_mm: PITCH, centers: CENTERS, plateIntent_mm: [182.0, 182.0],
    args: { lh: LH, bead: BEAD, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12, w: 3.0, e: 0.7, r0: 9.0, K: 14, foundation: 1.3,
      maxbridge: 16.2, maxcantilever: 4.8, allow: 0.6, minanchor: 0.5, maxCapRadius: 20, speed: PRINT_SPEED, bridgeSpeed: BRIDGE_SPEED,
      temp: M.temp, bed: M.bed, fan: 100 },
    gatePolicy: { meaning: 'experimental admission ceiling, not a claim that every coupon will succeed', bridge_mm: 16.2, cantilever_mm: 4.8,
      membrane_min_anchor: 0.5, first_layer_max_islands: 1 },
    tiles: TILES,
    caps: cap_summary,
    experiment: {
      matrix: ['bridges: 4 / 8 / 12 / 16 mm', 'cantilevers: 0.8 / 1.8 / 3.0 / 4.5 mm',
        `roads: ${pyFormatFixed(THIN, 2)} / ${pyFormatFixed(BEAD, 2)} / ${pyFormatFixed(WIDE, 2)} mm plus long serpent`,
        'native WEFT lean 17 / 32 deg, membrane, mixed-height scheduler'],
      photo: 'photograph whole plate from above, then rows 1, 2 and 4 in low side light',
      measure: 'record pass/fail plus bridge sag, cantilever curl and actual road widths',
    },
  };
  const payload = { summary, foundation: { paths: foundation_paths, kind: 'connected-rings-and-grid' }, layers };

  /** The plan SVG, f-string for f-string. Every interpolated number is a Python float (CENTERS are
   *  floats) except the tile id, so they print with repr(): "-89.5", "-75.0". */
  function svg(){
    const F = pyFloatRepr;
    const out = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="-98 -98 196 196">',
      '<rect x="-98" y="-98" width="196" height="196" fill="#f3f0e7"/>',
      '<g fill="#fbfaf6" stroke="#173f38" stroke-width="0.55">',
    ];
    for(const [cx, cy] of CENTERS) out.push(`<rect x="${F(cx - 20.5)}" y="${F(-cy - 20.5)}" width="41" height="41" rx="3"/>`);
    out.push('</g><g stroke="#24a37a" stroke-width="1.0" fill="none">');
    for(const tile of TILES){
      const [cx, cy] = CENTERS[tile.id - 1];
      const sy = -cy;
      const fam = tile.family;
      if(fam === 'bridge'){
        const span = tile.value_mm;
        out.push(`<path d="M ${F(cx - span / 2)} ${F(sy - 6)} V ${F(sy + 6)} M ${F(cx + span / 2)} ${F(sy - 6)} V ${F(sy + 6)} M ${F(cx - span / 2)} ${F(sy)} H ${F(cx + span / 2)}"/>`);
      } else if(fam === 'cantilever'){
        const length = tile.value_mm * 2.2;
        out.push(`<path d="M ${F(cx - 5.5)} ${F(sy - 6)} V ${F(sy + 6)} M ${F(cx - 5.5)} ${F(sy)} h ${F(length)}"/>`);
      } else if(fam === 'line_width'){
        const sw = Math.max(0.5, tile.value_mm * 3);
        out.push(`<circle cx="${F(cx)}" cy="${F(sy)}" r="8.5" stroke-width="${F(sw)}"/>`);
      } else if(fam === 'path'){
        out.push(`<path d="M ${F(cx - 13)} ${F(sy - 10)} H ${F(cx + 13)} V ${F(sy - 6)} H ${F(cx - 13)} V ${F(sy - 2)} H ${F(cx + 13)} V ${F(sy + 2)} H ${F(cx - 13)} V ${F(sy + 6)} H ${F(cx + 13)}"/>`);
      } else if(fam === 'lean'){
        out.push(`<circle cx="${F(cx)}" cy="${F(sy)}" r="6"/><circle cx="${F(cx)}" cy="${F(sy)}" r="11"/>`);
      } else if(fam === 'membrane'){
        out.push(`<circle cx="${F(cx)}" cy="${F(sy)}" r="9"/><circle cx="${F(cx)}" cy="${F(sy)}" r="5"/><circle cx="${F(cx)}" cy="${F(sy)}" r="1"/>`);
      } else {
        out.push(`<path d="M ${F(cx - 6)} ${F(sy - 7)} V ${F(sy + 7)} M ${F(cx)} ${F(sy - 5)} V ${F(sy + 7)} M ${F(cx + 6)} ${F(sy - 2)} V ${F(sy + 7)} M ${F(cx - 6)} ${F(sy)} H ${F(cx + 6)}"/>`);
      }
    }
    out.push('</g><g font-family="Segoe UI,sans-serif" fill="#173f38" text-anchor="middle">');
    for(const tile of TILES){
      const [cx, cy] = CENTERS[tile.id - 1];
      const sy = -cy;
      out.push(`<text x="${F(cx)}" y="${F(sy - 14)}" font-size="3.2" font-weight="700">${String(tile.id).padStart(2, '0')} ${tile.code}</text>`);
      out.push(`<text x="${F(cx)}" y="${F(sy + 16)}" font-size="2.5">${tile.name}</text>`);
    }
    out.push(`</g><text x="0" y="96" font-family="Segoe UI,sans-serif" font-size="3" text-anchor="middle" fill="#173f38">LIMIT16 · ${M.label} · ${pyFormatFixed(H, 1)} mm</text></svg>`);
    return out.join('\n');
  }

  /** The script's final print(json.dumps(..., indent=2)); `out` is filled in by the CLI. */
  const stdout = (outPath) => pyJsonDumps({ out: outPath, machine: a.machine, bead_mm: BEAD, bead_source: M.beadSource, layers: N, height_mm: H,
    logical_cells: 16, foundation_paths: foundation_paths.length, nominal_bbox_mm: [182.0, 182.0] },
  { indent: 2, isInt: (k) => k === 'layers' || k === 'logical_cells' || k === 'foundation_paths' });

  return { payload, svg, stdout, args: a };
}

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv, { requireOut: true }); }
  catch(e){ console.error(`usage: weft_limit16_geometry.mjs --machine {a2l,ender} --out OUT [--svg SVG] [--height HEIGHT] [--allow-assumed-bead]\nerror: ${e.message}`); process.exit(2); }
  let g;
  try { g = generateLimit16(args); }
  catch(e){ if(e.message.startsWith('REFUSED:')){ console.error(e.message); process.exit(1); } throw e; }
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, toJson(g.payload));
  if(args.svg){ fs.mkdirSync(path.dirname(path.resolve(args.svg)), { recursive: true }); fs.writeFileSync(args.svg, g.svg()); }
  console.log(g.stdout(args.out));
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
