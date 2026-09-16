#!/usr/bin/env node
/* core/weft_sculpture_geometry.mjs — JavaScript port of sculpture_geometry.py (OBLAK for the Bambu
 * A2L and GORA for the Creality Ender-3 V4: the two big sculptures of 2026-09-05, one instrument
 * language, two bodies — lintels, horns, the woven-iris crown, the grammar bands, the twist and the
 * breathing wall).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same refusal (--maxbridge below the widest lintel), the same JSON shape, key order and rounding,
 * the same preview SVG and the same stdout summary. The Python is stdlib-only (math + json), so the
 * numeric twins it needs are in core/weft_geom_ext.js (CPython's math.hypot, round() keeping -0.0,
 * repr(float), json.dumps) and core/weft_geom_ext2.js (libm names, math.radians, sum(), list repr,
 * a path-aware json.dumps). Parity with the Python output is measured by
 * tests/sculpture_geom_parity.test.mjs for both variants.
 *
 *   import { generateSculpture, toJson } from './core/weft_sculpture_geometry.mjs';
 *   generateSculpture({ variant: 'gora', bead: 0.42, lh: 0.2, plate: [220, 220] })
 *       -> { payload, summary, violations, svg(), stdout(), args }
 *   node core/weft_sculpture_geometry.mjs --variant gora --bead 0.42 --lh 0.2 --plate 220 220 --out FILE
 *
 * Where a line of the Python has a non-obvious meaning (int/float in the JSON, Python's half-to-even
 * round(), float modulo, evaluation order of a float expression, a sequential sum()) the comment on
 * the JavaScript says so. Repo-relative names only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pyRound, pyMod } from './weft_geom.js';
import { pyHypot, pyRoundNSigned, pyFloatRepr, pyFormatFixed, pyJsonDumps } from './weft_geom_ext.js';
import { libmSin, libmCos, libmAtan2, libmAtan, libmPow, libmSqrt, pyRadians, pyDegrees, pySum, pyListRepr, pyJsonDumpsPath } from './weft_geom_ext2.js';

/* ---------------- argparse twin: same flags, same defaults, same types ---------------- */
export const ARG_DEFAULTS = [
  ['variant', 'choice', null, ['oblak', 'gora']], ['bead', 'float', null], ['lh', 'float', null], ['plate', 'float2', null],
  ['out', 'str', null], ['R', 'float', null], ['H', 'float', null], ['turns', 'float', null],
  ['lintels', 'str', '30,40,50'], ['fins', 'str', '30,40,50'], ['fin_rate', 'float', 0.8], ['maxbridge', 'float', 60.0],
  ['safe_bridge', 'float', 16.0], ['relief', 'float', 1.0], ['K', 'int', null],
  ['no_crown', 'flag', false], ['no_fins', 'flag', false], ['no_windows', 'flag', false],
];
const REQUIRED = ['variant', 'bead', 'lh', 'plate', 'out'];
function toFloat(name, v){ const f = Number(v); if(typeof v !== 'number' && (String(v).trim() === '' || Number.isNaN(f))) throw new Error(`argument --${name}: invalid float value: '${v}'`); return f; }
function convert(def, v){
  const [name, type, , choices] = def;
  if(type === 'float') return toFloat(name, v);
  if(type === 'int'){ if(!/^[+-]?\d+$/.test(String(v).trim())) throw new Error(`argument --${name}: invalid int value: '${v}'`); return parseInt(v, 10); }
  if(type === 'float2'){ if(!Array.isArray(v) || v.length !== 2) throw new Error(`argument --${name}: expected 2 arguments`); return v.map(x => toFloat(name, x)); }
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
      if(def[1] === 'float2'){
        const v2 = [];
        while(v2.length < 2 && i + 1 < input.length && !(input[i + 1].startsWith('--') && Number.isNaN(Number(input[i + 1])))) v2.push(input[++i]);
        if(v2.length !== 2) throw new Error(`argument ${a}: expected 2 arguments`);
        args[name] = convert(def, v2); continue;
      }
      if(eq < 0){ val = input[++i]; if(val === undefined) throw new Error(`argument ${a}: expected one argument`); }
      args[name] = convert(def, val);
    }
    const missing = REQUIRED.filter(n => args[n] === null);
    if(missing.length) throw new Error(`the following arguments are required: ${missing.map(n => '--' + n).join(', ')}`);
  } else if(input && typeof input === 'object'){
    for(const [k0, v] of Object.entries(input)){
      const k = k0.replace(/-/g, '_');
      const def = ARG_DEFAULTS.find(d => d[0] === k);
      if(!def) throw new Error(`unknown argument ${k0}`);
      args[k] = v === null || v === undefined ? def[2] : convert(def, v);
    }
    const missing = REQUIRED.filter(n => n !== 'out' && args[n] === null);
    if(missing.length) throw new Error(`the following arguments are required: ${missing.map(n => '--' + n).join(', ')}`);
    if(requireOut && args.out === null) throw new Error('the following arguments are required: --out');
  }
  return args;
}

/* ---------------- int/float bookkeeping for json.dumps ---------------- */
/** Every number the Python writes is a float (rr() results, argparse floats, literal floats) except
 *  the values on these key paths, which are Python ints: layer indices and node counts, the integer
 *  args, counts in the summary. The path is the list of object keys from the root (array indices
 *  omitted). "paths" is an int only under summary.foundation; the top-level foundation.paths hold
 *  float coordinates, which is why the decision looks at the whole path. */
const INT_LEAF = new Set(['k', 'K', 'N', 'firstLayerSpeed', 'maxCapRadius', 'temp', 'bed', 'fan', 'caps', 'atLayer', 'crownAtLayer', 'ladder', 'rings', 'spokes', 'islandsExpected']);
function isIntPath(p){
  const leaf = p[p.length - 1];
  if(leaf === 'layers') return p.length >= 2 && p[p.length - 2] === 'crown';          // summary.experiments.crown.layers
  if(leaf === 'paths') return p.length >= 2 && p[p.length - 2] === 'foundation' && p[0] === 'summary';
  return INT_LEAF.has(leaf);
}
/** json.dumps(payload, separators=(",", ":")) — the geometry file's exact text. */
export function toJson(payload){ return pyJsonDumpsPath(payload, { isInt: isIntPath }); }
/** json.dumps(summary, indent=1) — what the script prints (and writes to the .rejected file). */
export function summaryJson(summary){ return pyJsonDumpsPath(summary, { indent: 1, isInt: isIntPath, rootPath: ['summary'] }); }

const TAU = 2 * Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** smooth(t) = clamp then t*t*(3-2t); Python evaluates (3 - 2 * t) with int 3 and 2 — same doubles. */
const smooth = (t) => { t = clamp(t, 0.0, 1.0); return t * t * (3 - 2 * t); };
const rr = (v, n = 3) => pyRoundNSigned(+v, n);            // round(float(v), n), keeping -0.0 like Python
const lerp = (a0, a1, t) => a0 + (a1 - a0) * t;
const pyOr = (v, d) => (v === null || v === undefined || v === 0 || v === false) ? d : v;   // `a.R or 127.0`

/** The generator. Returns { payload, summary, violations, svg(), stdout(), args }: payload exactly
 *  as the Python writes it, violations the list that makes the Python refuse (exit 1 with the
 *  summary written to a .rejected file — the caller decides), svg() the preview text, stdout() the
 *  printed summary. Throws the Python's SystemExit message for the --maxbridge refusal. */
export function generateSculpture(argsIn, opts = {}){
  const a = parseArgs(argsIn);
  const note = opts.note || (() => {});
  const BEAD = a.bead, LH = a.lh;
  const IS_SPHERE = a.variant === 'oblak';
  const ALLOW = 0.6;
  const REACH = BEAD / 2 + ALLOW;
  let LINTELS = a.lintels.split(',').filter(v => v.trim() !== '').map(v => toFloat('lintels', v));
  let FINS = a.fins.split(',').filter(v => v.trim() !== '').map(v => toFloat('fins', v));
  const FIN_RATE = a.fin_rate;
  const SAFE = a.safe_bridge;
  const GAP_MAX = 9.5;

  if(a.maxbridge < Math.max(...LINTELS, SAFE))
    throw new Error(`REFUSED: --maxbridge ${pyFloatRepr(a.maxbridge)} is below the widest lintel ${pyFloatRepr(Math.max(...LINTELS))} mm; declare the ceiling you are actually testing`);
  if(FIN_RATE > REACH + 0.0)
    note(`note: fin rate ${pyFloatRepr(FIN_RATE)} > continuous-support reach ${pyFormatFixed(REACH, 3)}; rails will bridge between tabs`);

  /* ---------------- the body ---------------- */
  let R, ZC, R_CROWN, Z_TOP, N_BODY, H_BODY, TURNS, K_MAX, W_FOOT, W_BODY, W_TOP, SPEED, BRIDGE_SPEED, TEMP, BED, FOUNDATION, WIN_AZ, FIN_AZ, Z_LINTEL_FRAC, FIN_Z0_FRAC;
  let S0, S_TOP, H_BODY_REQ, CORNER;
  if(IS_SPHERE){
    R = pyOr(a.R, 127.0);
    const BASE_LEAN = pyRadians(30.0);
    ZC = R * libmSin(BASE_LEAN);
    R_CROWN = 16.0;
    Z_TOP = ZC + libmSqrt(R * R - R_CROWN * R_CROWN);
    N_BODY = Math.floor(Z_TOP / LH);
    H_BODY = N_BODY * LH;
    TURNS = a.turns !== null ? a.turns : 0.35;
    K_MAX = pyOr(a.K, 96);
    W_FOOT = 3.6; W_BODY = 2.8; W_TOP = 2.4;
    SPEED = 30.0; BRIDGE_SPEED = 18.0;
    TEMP = 220; BED = 55;
    FOUNDATION = 8.0;
    WIN_AZ = [30.0, 150.0, 270.0];
    FIN_AZ = [90.0, 210.0, 330.0];
    Z_LINTEL_FRAC = 0.66;
    FIN_Z0_FRAC = [0.66, 0.71, 0.77];
  } else {
    S0 = pyOr(a.R, 67.0);
    S_TOP = 14.0;
    H_BODY_REQ = pyOr(a.H, 190.0);
    N_BODY = pyRound(H_BODY_REQ / LH);                       // int(round(x)): half to even
    H_BODY = N_BODY * LH;
    CORNER = 12.0;
    TURNS = a.turns !== null ? a.turns : 0.20;
    K_MAX = pyOr(a.K, 96);
    W_FOOT = 3.2; W_BODY = 2.6; W_TOP = 2.2;
    SPEED = 26.0; BRIDGE_SPEED = 15.0;
    TEMP = 220; BED = 60;
    FOUNDATION = 6.0;
    WIN_AZ = [0.0, 90.0, 180.0, 270.0];
    FIN_AZ = [0.0, 90.0, 180.0, 270.0];
    Z_LINTEL_FRAC = 0.44;
    FIN_Z0_FRAC = [0.55, 0.62, 0.69, 0.76];
    if(LINTELS.length === 3) LINTELS = [20.0].concat(LINTELS);
    if(FINS.length === 3) FINS = [20.0].concat(FINS);
  }
  if(a.no_windows) LINTELS = [];
  if(a.no_fins) FINS = [];

  /** twist of the material frame at height z (radians): ((TAU * TURNS) * z) / H_BODY */
  const tw = (z) => TAU * TURNS * z / H_BODY;

  function ring_radius(z){
    if(IS_SPHERE){ const dz = z - ZC; return libmSqrt(Math.max(1e-6, R * R - dz * dz)); }
    return S0 - (S0 - S_TOP) * (z / H_BODY);
  }

  function relief_env(z, rs){
    if(IS_SPHERE){
      const foot = lerp(0.35, 1.0, smooth(z / 28.0));
      const crown = libmPow(smooth((rs - 30.0) / 40.0), 1.5);   // float ** float is C pow()
      return a.relief * foot * crown;
    }
    const foot = lerp(0.4, 1.0, smooth(z / 25.0));
    const crown = smooth((rs - 18.0) / 22.0);
    return a.relief * foot * crown;
  }

  function relief(psi, z, rs){
    const env = relief_env(z, rs);
    if(env <= 0) return 0.0;
    const t = tw(z);
    if(IS_SPHERE){
      const lobes = 6.0 * libmSin(3 * psi - Math.PI / 2);
      const five = 2.5 * libmSin(5 * psi + 1.9 - 1.4 * t) * (0.55 + 0.45 * libmSin(TAU * z / H_BODY * 1.3));
      const seven = 2.0 * libmSin(7 * psi + 0.9) * libmSin(TAU * 1.7 * z / H_BODY + 0.3);
      const corr = 1.5 * libmPow(rs / R, 3) * libmSin(24 * psi + 2.0 * t);      // (rs / R) ** 3 is pow(x, 3.0)
      return env * (lobes + five + seven + corr);
    }
    const faces = 4.0 * libmSin(4 * psi - Math.PI / 2) * libmSin(TAU * z / H_BODY * 0.9 + 0.4);
    const six = 2.0 * libmSin(6 * psi + 1.1 - 1.2 * t);
    const corr = 1.2 * libmPow(rs / S0, 2) * libmSin(20 * psi + 1.6 * t);       // (rs / S0) ** 2 is pow(x, 2.0)
    return env * (faces + six + corr);
  }

  /** the un-relieved section point (local frame, before twist) and its outward unit normal */
  function base_point(psi, z, rs){
    if(IS_SPHERE) return [rs * libmCos(psi), rs * libmSin(psi), libmCos(psi), libmSin(psi)];
    let c = CORNER * (0.35 + 0.65 * rs / S0);
    c = Math.min(c, rs - 1.0);
    const cx = (rs - c) * (libmCos(psi) >= 0 ? 1 : -1);
    const cy = (rs - c) * (libmSin(psi) >= 0 ? 1 : -1);
    const dx = libmCos(psi), dy = libmSin(psi);
    let best = null;
    for(const [nx, ny, off] of [[1, 0, rs], [-1, 0, rs], [0, 1, rs], [0, -1, rs]]){
      const den = nx * dx + ny * dy;
      if(den <= 1e-9) continue;
      const tt = off / den;
      const px = tt * dx, py = tt * dy;
      const along = nx ? Math.abs(py) : Math.abs(px);
      if(along <= rs - c + 1e-9){ best = [px, py, nx, ny]; break; }
    }
    if(best === null){
      const b = -2 * (dx * cx + dy * cy), cc = cx * cx + cy * cy - c * c;
      const disc = Math.max(0.0, b * b - 4 * cc);
      const tt = (-b + libmSqrt(disc)) / 2;
      const px = tt * dx, py = tt * dy;
      const nx = (px - cx) / c, ny = (py - cy) / c;
      best = [px, py, nx, ny];
    }
    return best;
  }

  /** radial addition of the horns at this layer (material frame) */
  function horn_bump(psi, z, rs, fins_here){
    let add = 0.0;
    for(const [psi_f, d, half] of fins_here){
      const dpsi = pyMod(psi - psi_f + Math.PI, TAU) - Math.PI;     // Python float %: result has the divisor's sign
      if(Math.abs(dpsi) < half) add += d * (0.5 + 0.5 * libmCos(Math.PI * dpsi / half));
    }
    return add;
  }

  /** world-frame closed polyline (CCW, start at material psi=0) and the material azimuth list */
  function section(z, k, fins_here, nphi){
    const rs = ring_radius(z);
    const t = tw(z);
    const pts = [], psis = [];
    for(let i = 0; i < nphi; i++){
      const psi = TAU * i / nphi;                                   // (TAU * i) / nphi
      const [bx, by, nx, ny] = base_point(psi, z, rs);
      const d = relief(psi, z, rs) + horn_bump(psi, z, rs, fins_here);
      const px = bx + nx * d, py = by + ny * d;
      const c = libmCos(t), s = libmSin(t);
      pts.push([px * c - py * s, px * s + py * c]);
      psis.push(psi);
    }
    return [pts, psis, rs];
  }

  /* ---------------- contour records ---------------- */
  function record(pts, closed, nodes_u, w, e, web, lam, amp, label, tile = null){
    const q = pts.slice();
    const n = q.length;
    const q_closed = closed ? q.concat([q[0]]) : q;
    let normals = [];
    for(let i = 0; i < n; i++){
      let p0, p1;
      if(closed){ p0 = q[(i - 1 + n) % n]; p1 = q[(i + 1) % n]; }
      else { p0 = q[Math.max(0, i - 1)]; p1 = q[Math.min(n - 1, i + 1)]; }
      const tx = p1[0] - p0[0], ty = p1[1] - p0[1];
      const dd = pyHypot(tx, ty) || 1.0;
      normals.push([ty / dd, -tx / dd]);                            // -0.0 survives into the JSON as "-0.0"
    }
    if(closed) normals = normals.concat([normals[0]]);
    const cum = [0.0];
    for(let i = 0; i + 1 < q_closed.length; i++){ const p0 = q_closed[i], p1 = q_closed[i + 1]; cum.push(cum[cum.length - 1] + pyHypot(p1[0] - p0[0], p1[1] - p0[1])); }
    const total = cum[cum.length - 1];
    // sorted(set(rr(clamp(u, 0.0, total), 4) ...)): a set of floats, ascending
    const nodes = [...new Set(nodes_u.map(u => rr(clamp(u, 0.0, total), 4)))].sort((x, y) => x - y);
    const gaps = [];
    for(let j = 0; j + 1 < nodes.length; j++) gaps.push(nodes[j + 1] - nodes[j]);
    if(closed && nodes.length) gaps.push(total - nodes[nodes.length - 1] + nodes[0]);
    const rec = {
      pts: q_closed.map(([x, y]) => [rr(x, 2), rr(y, 2)]),
      nrm: normals.map(([x, y]) => [rr(x, 4), rr(y, 4)]),
      cum: cum.map(v => rr(v, 3)),
      total: rr(total, 3),
      nodes, K: nodes.length,
      maxNodeGap: rr(gaps.length ? Math.max(...gaps) : total, 3),
      closed: !!closed,
      w: rr(w, 3), e: rr(e, 3), web, label,
    };
    if(lam) rec.breath = rr(lam, 3);                                // `if lam:` — None or a non-zero float
    if(amp) rec.amp = rr(amp, 3);                                   // `if amp:` — 0.0 is false
    if(web === 'sine' && gaps.length) rec.lambda = rr(2 * pySum(gaps) / gaps.length, 3);   // (2 * sum) / len
    if(tile !== null) rec.tile = tile;
    return rec;
  }

  /** insert midpoints wherever two weld columns are further apart than gap_max (horn flanks) */
  function densify_nodes(nodes, total, closed, gap_max){
    let out = nodes.slice().sort((x, y) => x - y);
    let changed = true;
    while(changed){
      changed = false;
      const nxt = [];
      for(let j = 0; j < out.length; j++){
        const u = out[j];
        nxt.push(u);
        if(j + 1 < out.length){
          const g = out[j + 1] - u;
          if(g > gap_max){ nxt.push(u + g / 2); changed = true; }
        }
      }
      if(closed && out.length > 1){
        const g = total - out[out.length - 1] + out[0];
        if(g > gap_max){
          const last = out[out.length - 1];
          nxt.push(last + g / 2 < total ? last + g / 2 : (last + g / 2) - total);
          changed = true;
        }
      }
      out = [...new Set(nxt)].sort((x, y) => x - y);
    }
    return out;
  }

  /** dyadic ladder of weld columns: never closer than 3 mm, as many as the ladder allows */
  function k_for(circ){
    let k = K_MAX;
    while(k > 12 && circ / k < 3.0) k = Math.floor(k / 2);        // k //= 2 on an int
    return k;
  }

  /* ---------------- height programme: wall, tab, grammar bands ---------------- */
  function wall_nominal(z, rs){
    const f = z / H_BODY;
    let w;
    if(IS_SPHERE){
      w = z < 14 ? W_FOOT : lerp(W_FOOT, W_BODY, smooth((z - 14) / 22));
      if(f > 0.62) w = lerp(W_BODY, W_TOP, smooth((f - 0.62) / 0.22));
      if(rs < 45) w = lerp(w, 1.8, smooth((45 - rs) / 25));
    } else {
      w = z < 12 ? W_FOOT : lerp(W_FOOT, W_BODY, smooth((z - 12) / 20));
      if(f > 0.60) w = lerp(W_BODY, W_TOP, smooth((f - 0.60) / 0.25));
      if(rs < 26) w = lerp(w, 1.8, smooth((26 - rs) / 10));
    }
    return w;
  }

  function tab_nominal(z, rs){
    const f = z / H_BODY;
    let e = 0.7;
    if(f > 0.48) e = lerp(0.7, 0.9, smooth((f - 0.48) / 0.08));
    if(IS_SPHERE && rs < 45) e = lerp(e, 1.4, smooth((45 - rs) / 25));
    if(!IS_SPHERE && rs < 26) e = lerp(e, 1.3, smooth((26 - rs) / 10));
    return e;
  }

  const BANDS = IS_SPHERE
    ? [[0.00, 0.11, 'staple', 'foot'], [0.11, 0.20, 'perp', 'belly'], [0.20, 0.29, 'sine', 'wave'],
       [0.29, 0.36, 'eight', 'knot'], [0.36, 0.42, 'diagonal', 'truss'], [0.42, 1.01, 'staple', 'instruments']]
    : [[0.00, 0.08, 'staple', 'foot'], [0.08, 0.14, 'perp', 'belly'], [0.14, 0.20, 'sine', 'wave'],
       [0.20, 0.46, 'staple', 'windows'], [0.46, 0.51, 'eight', 'knot'], [0.51, 0.55, 'diagonal', 'truss'],
       [0.55, 1.01, 'staple', 'instruments']];

  function grammar_at(z){
    const f = z / H_BODY;
    for(const [lo, hi, g, name] of BANDS) if(lo <= f && f < hi) return [g, name];
    return ['staple', 'instruments'];
  }

  /* ---------------- instruments: windows (flat lintels) and horns ---------------- */
  let K_LINTEL = pyRound(Z_LINTEL_FRAC * N_BODY);
  if(K_LINTEL % 2) K_LINTEL += 1;
  const windows = [];            // [psi_center, W, k_bottom, k_lintel]
  for(let i = 0; i < Math.min(WIN_AZ.length, LINTELS.length); i++){
    const az = WIN_AZ[i], W = LINTELS[i];
    const h = 0.9 * W;
    windows.push([pyRadians(az), W, K_LINTEL - pyRound(h / LH), K_LINTEL]);
  }
  const horns = [];              // [psi_center, P, k0, n_rise, n_hold, n_fall]
  for(let i = 0; i < Math.min(FIN_AZ.length, FINS.length, FIN_Z0_FRAC.length); i++){
    const az = FIN_AZ[i], P = FINS[i], zf = FIN_Z0_FRAC[i];
    const n_rise = Math.ceil(P / FIN_RATE);
    horns.push([pyRadians(az), P, pyRound(zf * N_BODY), n_rise, 4, n_rise]);
  }

  function horns_at(k, rs){
    const out = [];
    for(const [psi_f, P, k0, n_rise, n_hold, n_fall] of horns){
      const j = k - k0;
      if(j < 0 || j >= n_rise + n_hold + n_fall) continue;
      let d;
      if(j < n_rise) d = Math.min(P, FIN_RATE * (j + 1));
      else if(j < n_rise + n_hold) d = P;
      else d = Math.max(0.0, P - FIN_RATE * (j - n_rise - n_hold + 1));
      if(d <= 0) continue;
      let half = (0.6 * P) / Math.max(rs, 20.0);
      half = Math.min(half, pyRadians(40));
      out.push([psi_f, d, half]);
    }
    return out;
  }

  /** the wall-depth wave fades out over 12 layers before any window or horn and returns after it */
  function amp_env(k){
    let f = 1.0;
    const zones = windows.map(([, , kb, kl]) => [kb, kl]).concat(horns.map(([, , k0, nr, nh, nf]) => [k0, k0 + nr + nh + nf]));
    for(const [k0, k1] of zones){
      if(k0 - 12 <= k && k < k0) f = Math.min(f, smooth((k0 - k) / 12.0));
      else if(k0 <= k && k < k1) f = 0.0;
      else if(k1 <= k && k < k1 + 12) f = Math.min(f, smooth((k - k1) / 12.0));
    }
    return f;
  }

  function windows_at(k, rs){
    const out = [];
    for(const [psi_w, W, kb, kl] of windows){
      if(kb <= k && k < kl){
        const half = IS_SPHERE ? (W / 2) / Math.max(rs, 20.0) : libmAtan((W / 2) / Math.max(rs, 20.0));
        out.push([psi_w, half, W]);
      }
    }
    return out;
  }

  /* ---------------- build the layers ---------------- */
  const layers = [];
  let prev_pts = null;
  let prev_had_fins = false;
  let worst_body_move = 0.0, worst_move_layer = null;
  let worst_crown_move = 0.0, worst_crown_layer = null;
  let max_gap_body = 0.0;
  const lintel_spans = new Map();
  const horn_tip_radius = [];
  const motion_log = [];
  const events = [];
  let last_ring_pts = null, last_ring_rs = null;   // eslint-disable-line no-unused-vars

  for(let k = 0; k < N_BODY; k++){
    const z = k * LH;
    const zmid = (k + 0.5) * LH;
    const rs = ring_radius(zmid);
    const circ_est = IS_SPHERE ? TAU * rs : 8 * rs;
    let K = k_for(circ_est);
    const [web_now] = grammar_at(zmid);
    if((web_now === 'sine' || web_now === 'eight' || web_now === 'diagonal') && circ_est / (2 * K) >= 2.3) K *= 2;
    const m = clamp(pyRound(circ_est / (K * 1.05)), 4, 12);        // int(clamp(round(x), 4, 12)): round() half to even
    const nphi = K * m;
    const fins_here = horns_at(k, rs);
    const [pts] = section(zmid, k, fins_here, nphi);
    const w = wall_nominal(zmid, rs);
    let e = tab_nominal(zmid, rs);
    const [web, band] = grammar_at(zmid);
    if(web === 'perp') e = 0.0;
    const lobes_n = IS_SPHERE ? 3 : 4;
    const amp = 0.25 * w * relief_env(zmid, rs) * amp_env(k);
    const wins = windows_at(k, rs);
    const node_idx = []; for(let j = 0; j < K; j++) node_idx.push(j * m);
    const contours = [];
    if(!wins.length){
      const rec_pts = pts;
      const cum = [0.0];
      const cl = rec_pts.concat([rec_pts[0]]);
      for(let i = 0; i + 1 < cl.length; i++){ const p0 = cl[i], p1 = cl[i + 1]; cum.push(cum[cum.length - 1] + pyHypot(p1[0] - p0[0], p1[1] - p0[1])); }
      const total = cum[cum.length - 1];
      let nodes_u = node_idx.map(i => cum[i]);
      nodes_u = densify_nodes(nodes_u, total, true, GAP_MAX);
      contours.push(record(rec_pts, true, nodes_u, w, e, web, total / lobes_n, amp, `${a.variant}-ring`));
      max_gap_body = Math.max(max_gap_body, contours[contours.length - 1].maxNodeGap);
      last_ring_pts = pts; last_ring_rs = rs;
    } else {
      const cuts = [];
      for(const [psi_w, half, W] of wins){
        const i0 = pyRound(pyMod(psi_w - half, TAU) / TAU * nphi) % nphi;   // int(round(((psi_w - half) % TAU) / TAU * nphi)) % nphi
        const i1 = pyRound(pyMod(psi_w + half, TAU) / TAU * nphi) % nphi;
        cuts.push([i0, i1, W]);
      }
      cuts.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);   // tuple order
      for(let j = 0; j < cuts.length; j++){
        const i_start = cuts[j][1];
        const i_end = cuts[(j + 1) % cuts.length][0];
        const idx = [];
        let i = i_start;
        for(;;){ idx.push(i); if(i === i_end) break; i = (i + 1) % nphi; }
        const arc = idx.map(ii => pts[ii]);
        const cum = [0.0];
        for(let t = 0; t + 1 < arc.length; t++){ const p0 = arc[t], p1 = arc[t + 1]; cum.push(cum[cum.length - 1] + pyHypot(p1[0] - p0[0], p1[1] - p0[1])); }
        const total = cum[cum.length - 1];
        let nodes_u = [];
        idx.forEach((ii, n) => { if(ii % m === 0 && 3.5 < cum[n] && cum[n] < total - 3.5) nodes_u.push(cum[n]); });
        if(total > 8.0) nodes_u = [2.5].concat(nodes_u, [total - 2.5]);
        nodes_u = densify_nodes(nodes_u, total, false, GAP_MAX);
        contours.push(record(arc, false, nodes_u, w, e, web, null, 0.0, `${a.variant}-arc-${j}`));
      }
      if(k === K_LINTEL - 1){
        for(const [i0, i1, W] of cuts){
          const p0 = pts[i0], p1 = pts[i1];
          lintel_spans.set(W, rr(pyHypot(p1[0] - p0[0], p1[1] - p0[1]), 1));
        }
      }
    }
    // motion telemetry (body only, outside horn layers)
    if(prev_pts !== null && prev_pts.length === pts.length && !fins_here.length && !prev_had_fins){
      let mv = -Infinity;
      for(let i = 0; i < pts.length; i++){ const v = pyHypot(pts[i][0] - prev_pts[i][0], pts[i][1] - prev_pts[i][1]); if(v > mv) mv = v; }
      const crown_zone = IS_SPHERE && rs < 45;
      if(crown_zone){
        if(mv > worst_crown_move){ worst_crown_move = mv; worst_crown_layer = k; }
        if(mv > REACH + e) motion_log.push([k, rr(mv, 3), rr(REACH + e, 3)]);
      } else {
        if(mv > worst_body_move){ worst_body_move = mv; worst_move_layer = k; }
      }
    }
    prev_pts = pts;
    prev_had_fins = fins_here.length > 0;
    if(fins_here.length){
      let mx = -Infinity;
      for(const p of pts){ const v = pyHypot(p[0], p[1]); if(v > mx) mx = v; }
      horn_tip_radius.push(mx);
    }
    let phase = band;
    if(wins.length) phase = 'windows';
    if(fins_here.length) phase = 'horns';
    if(IS_SPHERE && rs < 45) phase = 'crown-approach';
    layers.push({ k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: rr(w, 3), tab: rr(e, 3), web, phase, contours });
    if(k > 0 && layers[layers.length - 2].phase !== phase)
      events.push({ z: rr(z, 2), k, event: `${layers[layers.length - 2].phase} -> ${phase}` });
  }

  /* ---------------- crown: the woven iris ---------------- */
  const crown_layers = [];
  const IRIS_PROCESS = 'crown-woven-iris/v1';
  let crown_info = null;
  let plan = [];
  if(!a.no_crown && last_ring_pts !== null){
    const ring_r_mean = pySum(last_ring_pts.map(p => pyHypot(p[0], p[1]))) / last_ring_pts.length;   // sum() sequential (3.11)
    const w_c = 1.8, e_c = 1.4;
    /** radius of the last ring in a given world direction (nearest sample; first minimum wins) */
    function ring_r_at(angle){
      let best = 1e9, br = ring_r_mean;
      for(const p of last_ring_pts){
        const d = Math.abs(pyMod(libmAtan2(p[1], p[0]) - angle + Math.PI, TAU) - Math.PI);
        if(d < best){ best = d; br = pyHypot(p[0], p[1]); }
      }
      return br;
    }
    /** straight chord at signed distance `offset` from the centre, direction `angle` */
    function chord(offset, angle){
      const ca = libmCos(angle), sa = libmSin(angle);
      const ends = [];
      for(const sgn of [-1, 1]){
        let s = 0.0;
        for(let it = 0; it < 12; it++){
          const x = s * ca - offset * sa, y = s * sa + offset * ca;
          const rr_here = ring_r_at(libmAtan2(y, x)) + w_c / 2 + 0.8;
          s = sgn * libmSqrt(Math.max(0.0, rr_here * rr_here - offset * offset));
        }
        ends.push(s);
      }
      const [s0, s1] = ends;
      const n = Math.max(4, Math.ceil((s1 - s0) / 0.5));
      const out = [];
      for(let i = 0; i <= n; i++){
        const s = s0 + (s1 - s0) * i / n;                            // s0 + (((s1 - s0) * i) / n)
        out.push([rr(s * ca - offset * sa, 3), rr(s * sa + offset * ca, 3)]);
      }
      return out;
    }
    const d1 = 0.40 * ring_r_mean;
    const d2 = 0.29 * ring_r_mean;
    plan = [
      [[+d1, 0.0], [-d1, 0.0]],
      [[+d1, Math.PI / 2], [-d1, Math.PI / 2]],
      [[+d2, Math.PI / 4], [-d2, Math.PI / 4]],
      [[+d2, 3 * Math.PI / 4], [-d2, 3 * Math.PI / 4]],
      [[0.0, 0.0], [0.0, Math.PI / 2]],
      [[0.0, Math.PI / 4], [0.0, 3 * Math.PI / 4]],
    ];
    const inner_rail = ring_r_mean - w_c / 2;
    const span1 = 2 * libmSqrt(Math.max(0.0, libmPow(inner_rail, 2) - libmPow(d1, 2)));   // ** 2 is pow(x, 2.0)
    for(let j = 0; j < plan.length; j++){
      const chords = plan[j];
      const k = N_BODY + j;
      const z = k * LH;
      const cum = [0.0];
      const ring = last_ring_pts;
      const cl = ring.concat([ring[0]]);
      for(let i = 0; i + 1 < cl.length; i++){ const p0 = cl[i], p1 = cl[i + 1]; cum.push(cum[cum.length - 1] + pyHypot(p1[0] - p0[0], p1[1] - p0[1])); }
      const total = cum[cum.length - 1];
      const Kc = k_for(total);
      const mc = Math.floor(ring.length / Kc);
      const nodes_u = []; for(let i = 0; i < Kc; i++) nodes_u.push(cum[i * mc]);
      const rec = record(ring, true, nodes_u, w_c, e_c, 'staple', null, 0.0, 'crown-ring');
      const paths = [];
      chords.forEach(([off, ang], ci) => {
        paths.push({ pts: chord(off, ang), role: 'bridge', closed: false, speed: BRIDGE_SPEED,
          label: `iris-${j + 1}-${ci}`, tile: 'crown', intent: `${IRIS_PROCESS}: layer ${j + 1} of ${plan.length}` });
      });
      crown_layers.push({ k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: w_c, tab: e_c, web: 'staple', phase: 'crown-iris', contours: [rec], paths });
    }
    events.push({ z: rr(N_BODY * LH, 2), k: N_BODY, event: `crown-approach -> crown-iris (${IRIS_PROCESS})` });
    crown_info = { process: IRIS_PROCESS, physicalStatus: 'experimental', hole_diameter_mm: rr(2 * ring_r_mean, 1),
      layers: plan.length, firstLayerFreeSpan_mm: rr(span1, 1),
      laterLayersMaxFreeSpan_mm: rr(2 * d1, 1),
      evidenceBasis: 'LIMIT16 2026-09-04: bridges to 16 mm continuous on both machines; the single-layer inward spiral (limit16-18mm-v1) FAILED on both and is not used here',
      expected: 'first-layer chords sag; later grids land on them; a woven disc with ~5-8 mm openings' };
  }

  const all_layers = layers.concat(crown_layers);
  const H_TOTAL = all_layers[all_layers.length - 1].zTop;

  /* ---------------- foundation: rings around the base section, joined by spokes ---------------- */
  const [base_pts] = section(0.5 * LH, 0, [], layers[0].contours[0].K * 8);
  function offset_ring(d){
    const n = base_pts.length;
    const out = [];
    for(let i = 0; i < n; i++){
      const [x0, y0] = base_pts[(i - 1 + n) % n], [x1, y1] = base_pts[(i + 1) % n];
      const tx = x1 - x0, ty = y1 - y0;
      const dd = pyHypot(tx, ty) || 1.0;
      const nx = ty / dd, ny = -tx / dd;
      const [px, py] = base_pts[i];
      out.push([rr(px + nx * d, 2), rr(py + ny * d, 2)]);
    }
    out.push(out[0]);
    return out;
  }
  const foundation_paths = [];
  const w0 = layers[0].w;
  const ring_offsets = [-(w0 / 2 + 1.0), -(w0 / 2 + 2.0)];
  for(let i = 0; i < Math.trunc(FOUNDATION); i++) ring_offsets.push(w0 / 2 + 1.0 + 1.0 * i);
  for(const d of ring_offsets) foundation_paths.push(offset_ring(d));
  const n_sp = 48;
  const nb = base_pts.length;
  for(let s = 0; s < n_sp; s++){
    const i = pyRound(s * nb / n_sp) % nb;                            // int(round((s * nb) / n_sp)) % nb
    const [x0, y0] = base_pts[(i - 1 + nb) % nb], [x1, y1] = base_pts[(i + 1) % nb];
    const tx = x1 - x0, ty = y1 - y0;
    const dd = pyHypot(tx, ty) || 1.0;
    const nx = ty / dd, ny = -tx / dd;
    const [px, py] = base_pts[i];
    const din = ring_offsets[1] - 0.6, dout = ring_offsets[ring_offsets.length - 1] + 0.6;
    foundation_paths.push([[rr(px + nx * din, 2), rr(py + ny * din, 2)], [rr(px + nx * dout, 2), rr(py + ny * dout, 2)]]);
  }

  /* ---------------- checks that refuse ---------------- */
  const violations = [], warnings = [];
  const xs = [], ys = [];
  for(const lay of all_layers){
    for(const c of lay.contours) for(const p of c.pts){ xs.push(p[0]); ys.push(p[1]); }
    for(const p of (lay.paths || [])) for(const q of p.pts){ xs.push(q[0]); ys.push(q[1]); }
  }
  for(const pth of foundation_paths) for(const p of pth){ xs.push(p[0]); ys.push(p[1]); }
  const minOf = (arr) => { let v = Infinity; for(const x of arr) if(x < v) v = x; return v; };
  const maxOf = (arr) => { let v = -Infinity; for(const x of arr) if(x > v) v = x; return v; };
  const size = [maxOf(xs) - minOf(xs) + W_FOOT, maxOf(ys) - minOf(ys) + W_FOOT, H_TOTAL];
  if(size[0] > a.plate[0] - 16 || size[1] > a.plate[1] - 16)
    violations.push(`${pyFormatFixed(size[0], 1)} x ${pyFormatFixed(size[1], 1)} mm misses the 8 mm plate margin on ${pyListRepr(a.plate)}`);
  if(IS_SPHERE){
    let mx = -Infinity; for(let i = 0; i < xs.length; i++){ const v = pyHypot(xs[i], ys[i]); if(v > mx) mx = v; }
    if(mx > 141.0) violations.push('a point of the body lies beyond the 28 cm envelope');
  }
  if(worst_body_move > REACH)
    violations.push(`body contour moves ${pyFormatFixed(worst_body_move, 2)} mm between layers ${worst_move_layer - 1}->${worst_move_layer}, over the continuous-support reach ${pyFormatFixed(REACH, 3)}`);
  for(const [kk, mv, lim] of motion_log)
    violations.push(`crown approach: ring steps ${pyFloatRepr(mv)} mm at layer ${kk}, beyond tab + reach ${pyFloatRepr(lim)}`);
  for(const [, P, k0] of horns){
    if(FIN_RATE > REACH + tab_nominal((k0 + 1) * LH, ring_radius((k0 + 1) * LH)))
      violations.push(`horn ${pyFloatRepr(P)} mm grows ${pyFloatRepr(FIN_RATE)} mm/layer, beyond tab + reach - even the tabs cannot catch it`);
  }
  for(const [, P, k0, n_rise, n_hold, n_fall] of horns){
    const k_end = k0 + n_rise + n_hold + n_fall;
    if(k_end > N_BODY - 30) violations.push(`horn ${pyFloatRepr(P)} mm ends at layer ${k_end}, inside the crown approach (body ends at ${N_BODY})`);
  }
  let gmax = -Infinity;
  for(const lay of all_layers) for(const c of lay.contours) if(c.maxNodeGap > gmax) gmax = c.maxNodeGap;
  if(gmax > SAFE) violations.push(`a weld-column gap of ${pyFormatFixed(gmax, 1)} mm exceeds the evidenced bridge ${pyFloatRepr(SAFE)} mm`);
  /** concave curvature vs the wall: turning angle per arc on the ROUNDED points */
  function min_concave_radius(pts, closed){
    const n = pts.length; let best = 1e9;
    const lo = closed ? 0 : 1, hi = closed ? n : n - 1;
    for(let i = lo; i < hi; i++){
      const [x0, y0] = pts[(i - 1 + n) % n], [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
      const ax = x1 - x0, ay = y1 - y0, bx = x2 - x1, by = y2 - y1;
      const la = pyHypot(ax, ay), lb = pyHypot(bx, by);
      if(la < 1e-9 || lb < 1e-9) continue;
      const cross = ax * by - ay * bx;
      const dot = ax * bx + ay * by;
      const ang = libmAtan2(cross, dot);
      if(ang < -1e-6){
        const rad = (la + lb) / 2 / Math.abs(ang);
        best = Math.min(best, rad);
      }
    }
    return best;
  }
  let worst_concave = 1e9;
  for(let li = 0; li < all_layers.length; li += 10){
    const lay = all_layers[li];
    for(const c of lay.contours){
      const pp = c.closed ? c.pts.slice(0, -1) : c.pts;
      const rc = min_concave_radius(pp, c.closed);
      const need = c.w / 2 + c.e + BEAD;
      if(rc < need) violations.push(`layer ${lay.k} z=${pyFloatRepr(lay.zBot)}: concave radius ${pyFormatFixed(rc, 2)} < w/2+e+bead ${pyFormatFixed(need, 2)}`);
      worst_concave = Math.min(worst_concave, rc);
    }
  }

  const summary = {
    name: `${a.variant.toUpperCase()} X1`, variant: a.variant, N: all_layers.length, H: rr(H_TOTAL, 2),
    args: {
      lh: LH, bead: BEAD, firstLayerBead: rr(BEAD + 0.07, 3), firstLayerSpeed: 12,
      w: rr(W_BODY, 2), r0: rr(ring_radius(0.5 * LH), 2), K: K_MAX, foundation: FOUNDATION,
      maxbridge: a.maxbridge, maxcantilever: 4.8, allow: ALLOW, minanchor: 0.5, maxCapRadius: 36,
      speed: SPEED, bridgeSpeed: BRIDGE_SPEED, temp: TEMP, bed: BED, fan: 100,
      turns: TURNS,
    },
    design: {
      family: 'OBLAK / GORA - the two big sculptures (2026-09-05)',
      shape: IS_SPHERE
        ? `truncated sphere R${pyFormatFixed(R, 0)}, base lean 30 deg, 3 lobes + 5/7-fold drift + 24-fold corrugation, twist ${pyFormatFixed(TURNS, 2)} turns`
        : `twisted rounded-square pyramid, base ${pyFormatFixed(2 * S0, 0)} mm, top ${pyFormatFixed(2 * S_TOP, 0)} mm, twist ${pyFormatFixed(TURNS, 2)} turns`,
      wallDepth: `breathes with the lobes (amp 25% of w), foot ${pyFormatFixed(W_FOOT, 1)} -> body ${pyFormatFixed(W_BODY, 1)} -> top ${pyFormatFixed(W_TOP, 1)} -> crown 1.8`,
      grammarBands: BANDS.map(([lo, hi, g, nm]) => ({ from: lo, to: hi, web: g, name: nm })),
      openCrown: crown_info === null, caps: 0,
      compiler: 'analytic surface -> WEFT level-2 layers (contours, open arcs, typed bridge paths)',
      physicalBasis: 'specimens/LIMIT16_2026-09-04_RESULTS.md; D5 R140 dome; Suma; MERA; Vrtlog',
      experimental: true,
    },
    experiments: {
      declaredBridgeCeiling_mm: a.maxbridge, evidencedBridge_mm: SAFE,
      lintels: windows.map(([psi_w, W, kb, kl]) => ({ W_mm: W, azimuth_deg: rr(pyDegrees(psi_w), 1), zBottom: rr(kb * LH, 2), zLintel: rr(kl * LH, 2),
        measuredChord_mm: lintel_spans.has(W) ? lintel_spans.get(W) : null })),
      horns: horns.map(([psi_f, P, k0, n_rise, n_hold, n_fall]) => ({ P_mm: P, azimuth_deg: rr(pyDegrees(psi_f), 1), rate_mm_per_layer: FIN_RATE,
        zStart: rr(k0 * LH, 2), zEnd: rr((k0 + n_rise + n_hold + n_fall) * LH, 2) })),
      crown: crown_info,
      twist: { turns: TURNS, tangentialMove_mm_per_layer_at_widest: rr(TAU * (IS_SPHERE ? R : S0) * TURNS / N_BODY, 3) },
      protocol: 'gate at the declared ceiling must be clean; gate at the evidenced ceiling must attribute every finding to one of the zones above (z ranges), otherwise the build is refused',
    },
    supportCheck: { reach_mm: rr(REACH, 3), worstBodyMove_mm: rr(worst_body_move, 3), atLayer: worst_move_layer,
      worstCrownApproachMove_mm: rr(worst_crown_move, 3), crownAtLayer: worst_crown_layer,
      crownReachWithTab_mm: rr(REACH + 1.4, 3), hornRate_mm_per_layer: FIN_RATE },
    nodeDensity: { maxNodeGap_mm: rr(gmax, 2), limit_mm: SAFE, ladder: [K_MAX, Math.floor(K_MAX / 2), Math.floor(K_MAX / 4), Math.floor(K_MAX / 8)] },
    geometry: { minConcaveRadius_mm: rr(worst_concave, 2),
      maxHornTipRadius_mm: horn_tip_radius.length ? rr(maxOf(horn_tip_radius), 1) : null },
    foundation: { paths: foundation_paths.length, rings: ring_offsets.length, spokes: n_sp, islandsExpected: 1 },
    wallWidth: { min: rr(minOf(all_layers.map(l => l.w)), 2), max: rr(maxOf(all_layers.map(l => l.w)), 2) },
    bbox_mm: [rr(minOf(xs), 2), rr(minOf(ys), 2), rr(maxOf(xs), 2), rr(maxOf(ys), 2)],
    size_mm: size.map(v => rr(v, 1)),
    events,
    violations,
    warnings: warnings.concat(['PRINTABILITY UNPROVEN', LINTELS.length
      ? `lintels ${pyListRepr(LINTELS)} mm are ${pyFormatFixed(maxOf(LINTELS) / SAFE, 1)}x over the evidenced bridge` : 'no lintels']),
  };

  const payload = { summary, foundation: { kind: 'rings+spokes', paths: foundation_paths }, layers: all_layers };

  /** preview: plan cuts + elevation silhouette (SVG), f-string for f-string; every interpolated
   *  number is a Python float printed with repr() except the layer index. */
  function svg(){
    const F = pyFloatRepr;
    const Wv = 620, Hv = 720;
    const els = [];
    const COL = { staple: '#f6ff78', perp: '#79f79b', sine: '#45d9c0', eight: '#ff9f6b', diagonal: '#78a7ff' };
    for(let li = 0; li < all_layers.length; li += 6){
      const lay = all_layers[li];
      const z = lay.zBot;
      for(const c of lay.contours){
        const pts = c.pts.map(p => `${F(rr(160 + p[0] * 1.0, 1))},${F(rr(700 - z * 1.0 - p[1] * 0.35, 1))}`).join(' ');
        const col = COL[c.web] || '#fff';
        els.push(`<polyline points="${pts}" fill="none" stroke="${col}" stroke-width=".5" opacity=".75"/>`);
      }
      for(const p of (lay.paths || [])){
        const pts = p.pts.map(q => `${F(rr(160 + q[0], 1))},${F(rr(700 - z - q[1] * 0.35, 1))}`).join(' ');
        els.push(`<polyline points="${pts}" fill="none" stroke="#ff4d6d" stroke-width=".8"/>`);
      }
    }
    const picks = [0, Math.trunc(0.3 * N_BODY), Math.trunc(0.55 * N_BODY), Math.trunc(0.75 * N_BODY), N_BODY - 1];
    picks.forEach((kk, n) => {
      const lay = all_layers[kk];
      for(const c of lay.contours){
        const pts = c.pts.map(p => `${F(rr(470 + p[0] * 0.5, 1))},${F(rr(80 + n * 130 - p[1] * 0.5, 1))}`).join(' ');
        els.push(`<polyline points="${pts}" fill="none" stroke="#c9ff42" stroke-width=".7"/>`);
      }
      els.push(`<text x="400" y="${80 + n * 130}" fill="#9bb0c8" font-family="sans-serif" font-size="9">z=${F(lay.zBot)}</text>`);
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>`
      + els.join('')
      + `<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="12">${summary.name} - ${pyFormatFixed(size[0], 0)} x ${pyFormatFixed(size[1], 0)} x ${pyFormatFixed(size[2], 0)} mm, ${all_layers.length} layers</text></svg>`;
  }

  /** print(json.dumps(summary, indent=1)) */
  const stdout = () => summaryJson(summary);

  return { payload, summary, violations, svg, stdout, args: a };
}

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv, { requireOut: true }); }
  catch(e){ console.error(`usage: weft_sculpture_geometry.mjs --variant {oblak,gora} --bead BEAD --lh LH --plate PLATE PLATE --out OUT [--R R] [--H H] [--turns TURNS] [--lintels LINTELS] [--fins FINS] [--fin-rate FIN_RATE] [--maxbridge MAXBRIDGE] [--safe-bridge SAFE_BRIDGE] [--relief RELIEF] [--K K] [--no-crown] [--no-fins] [--no-windows]\nerror: ${e.message}`); process.exit(2); }
  let g;
  try { g = generateSculpture(args, { note: (s) => console.log(s) }); }
  catch(e){ if(e.message.startsWith('REFUSED:')){ console.error(e.message); process.exit(1); } throw e; }
  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if(g.violations.length){
    fs.writeFileSync(outPath.replace(/\.[^./\\]*$/, '') + '.rejected', g.stdout());
    console.log(g.stdout());
    console.error('\nREFUSED:');
    for(const v of g.violations) console.error('  * ' + v);
    process.exit(1);
  }
  fs.writeFileSync(outPath, toJson(g.payload));
  const preview = path.join(path.dirname(outPath), path.basename(outPath).replace(/\.[^.]*$/, '').replace('_geometry', '') + '_preview.svg');
  fs.writeFileSync(preview, g.svg());
  console.log(g.stdout());
  console.log(`PREVIEW ${preview}`);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
