#!/usr/bin/env node
/* core/weft_suma_geometry.mjs — JavaScript port of suma_geometry.py (P0 'Šuma', WEFT level 2).
 *
 * Function by function the same as the Python script, with the same argument defaults, the same
 * JSON shape and key order, and the same rounding. The numeric primitives (distance transform,
 * marching squares, labelling, numpy's summation and rounding rules) live in core/weft_geom.js.
 * Parity with the Python output is proven by tests/suma_geom_parity.test.mjs.
 *
 *   import { generateSuma } from './core/weft_suma_geometry.mjs';  generateSuma({cols:2, rows:2})
 *   node core/weft_suma_geometry.mjs --cols 2 --rows 2 --out FILE
 *
 * Where a line of the Python has a non-obvious meaning (numpy broadcasting, a first-index tie
 * rule, Python's modulo or rounding) the comment on the JavaScript says so.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  npArange, pairwiseSum, hypot, pyRound, pyRoundN, pyMod, pyFloorDiv, smoothstep,
  edt, edtLE, edtGT, not, anyOf, countOf, label4, fillHoles, erodeCross, argmax, maxOf,
  findContours, polygonArea, polylineLength, resampleClosed, outwardNormals, searchsortedLeft,
  maxNearestDistance, minNearestOtherDistance,
} from './weft_geom.js';

/* ---------------- argparse twin: same flags, same defaults, same types ---------------- */
export const ARG_DEFAULTS = [
  ['cols', 'int', 2], ['rows', 'int', 2], ['r0', 'float', 8.0], ['s1', 'float', 26.0], ['s2', 'float', 40.0],
  ['s3', 'float', 54.0], ['lh', 'float', 0.24], ['w', 'float', 5.0], ['e', 'float', 1.0], ['bead', 'float', 0.45],
  ['K', 'int', 16], ['res', 'float', 0.2], ['out', 'str', '/tmp/suma.json'], ['step', 'float', 0.35],
  ['hold', 'float', 6.0], ['foundation', 'float', 6.0],
];
function convert(type, v, name){
  if(type === 'int'){ if(!/^[+-]?\d+$/.test(String(v).trim())) throw new Error(`argument --${name}: invalid int value: '${v}'`); return parseInt(v, 10); }
  if(type === 'float'){ const f = Number(v); if(String(v).trim() === '' || Number.isNaN(f)) throw new Error(`argument --${name}: invalid float value: '${v}'`); return f; }
  return String(v);
}
/** Build the args object (same key order as argparse's Namespace) from a partial object or argv. */
export function parseArgs(input){
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
      args[name] = convert(def[1], val, name);
    }
  } else if(input && typeof input === 'object'){
    for(const [k, v] of Object.entries(input)){
      const def = ARG_DEFAULTS.find(d => d[0] === k);
      if(!def) throw new Error(`unknown argument ${k}`);
      args[k] = convert(def[1], v, k);
    }
  }
  return args;
}

/* ---------------- column layout: pairs at s1, pairs separated by s2 (dyadic) ---------------- */
function positions(n, s1, s2){
  const xs = [0.0];
  for(let i = 1; i < n; i++) xs.push(xs[xs.length - 1] + (i % 2 === 1 ? s1 : s2));
  const c = (xs[0] + xs[xs.length - 1]) / 2;
  return xs.map(x => x - c);
}

/** The generator. Returns the geometry object exactly as the Python writes it with json.dump. */
export function generateSuma(argsIn, opts = {}){
  const args = parseArgs(argsIn);
  const log = opts.log || (() => {});
  const RHO_MIN = args.w / 2 + args.e + args.bead + 0.3;

  const CX = positions(args.cols, args.s1, args.s2), CY = positions(args.rows, args.s2, args.s3);
  const centers = [];
  for(const y of CY) for(const x of CX) centers.push([x, y]);   // [(x,y) for y in CY for x in CX]

  /* ---------------- height programme (stages) ---------------- */
  const grow_band = (dr) => 1.5 * Math.abs(dr) * args.lh / args.step;
  const r_col = args.r0;
  const stages_up = [];
  if(args.cols >= 2 || args.rows >= 2){
    // sorted(set(...)) — a set of floats, ascending, duplicates removed
    const sp_list = [];
    if(args.cols >= 2) sp_list.push(args.s1);
    if(args.rows >= 2) sp_list.push(args.s2);
    if(args.cols >= 4) sp_list.push(args.s2);
    if(args.rows >= 4) sp_list.push(args.s3);
    for(const sp of [...new Set(sp_list)].sort((a, b) => a - b)) stages_up.push(sp / 2 - 0.45 * RHO_MIN);
  }
  function courtyard_close_r(){
    let best = null;
    for(let i = 0; i < CX.length - 1; i++) for(let j = 0; j < CY.length - 1; j++){
      const d = hypot((CX[i + 1] - CX[i]) / 2, (CY[j + 1] - CY[j]) / 2); const rc = d - RHO_MIN + 0.4;
      best = best === null ? rc : Math.max(best, rc);
    }
    return best;
  }
  let COURT = false;
  if(stages_up.length){
    const rc = courtyard_close_r();
    if(rc !== null && rc > stages_up[stages_up.length - 1] && rc - stages_up[stages_up.length - 1] < 6){ stages_up.push(rc); COURT = true; }
  }
  let R_BIG = stages_up.length ? stages_up[stages_up.length - 1] : r_col;
  function courtyard_open_limit(){
    let lim = null;
    for(let i = 0; i < CX.length - 1; i++) for(let j = 0; j < CY.length - 1; j++){
      const d = hypot((CX[i + 1] - CX[i]) / 2, (CY[j + 1] - CY[j]) / 2); const v = d - RHO_MIN - 0.3;
      lim = lim === null ? v : Math.min(lim, v);
    }
    return lim;
  }
  const _lim = courtyard_open_limit();
  // R_BOTTOM is computed by the Python but never used afterwards; kept for fidelity
  const R_BOTTOM = Math.max(r_col, ...stages_up.filter(v => _lim === null || v <= _lim)); // eslint-disable-line no-unused-vars
  // FIX (2026-09-02) as written in the Python: COURT is reset, but the courtyard stage stays in stages_up
  COURT = false; // eslint-disable-line no-unused-vars
  R_BIG = stages_up.length ? stages_up[stages_up.length - 1] : r_col;
  let A_BIG = R_BIG, B_BIG = R_BIG;
  const HOLE_CAP_R = args.w / 2 + args.e + RHO_MIN + 1.5;

  const plan = [];   // [z0, z1, from, to]
  let z = args.lh;
  let cur = r_col;
  const Z_COL0 = z; z += args.hold + 4; const Z_COL1 = z;
  for(const t of stages_up){
    const z0 = z, z1 = z + grow_band(t - cur); plan.push([z0, z1, cur, t]); cur = t; z = z1 + args.hold;
  }
  const H = z, N = pyRound(H / args.lh), Z_SPLIT0 = args.lh, Z_SPLIT1 = Z_COL0;   // int(round(H/lh)): half-even
  A_BIG = B_BIG = R_BIG;

  function r_at(zz){
    let r = r_col;
    for(const [z0, z1, f, t] of plan){
      if(zz >= z1) r = t;
      else if(zz >= z0) r = f + (t - f) * smoothstep((zz - z0) / (z1 - z0));
    }
    return r;
  }
  const ab_at = (zz) => { const r = r_at(zz); return [r, r]; };
  const rho_at = (zz) => zz < args.lh ? RHO_MIN + args.foundation : RHO_MIN;

  /* ---------------- raster ---------------- */
  const amax = A_BIG, bmax = B_BIG;
  const xmin = Math.min(...CX) - amax - args.w - args.foundation - 6, xmax = Math.max(...CX) + amax + args.w + args.foundation + 6;
  const ymin = Math.min(...CY) - bmax - args.w - args.foundation - 6, ymax = Math.max(...CY) + bmax + args.w + args.foundation + 6;
  const res = args.res;
  const gx = npArange(xmin, xmax, res), gy = npArange(ymin, ymax, res);
  const W = gx.length, Hh = gy.length, NPX = W * Hh;   // meshgrid: X[r][c] = gx[c], Y[r][c] = gy[r]
  const gx0 = gx[0], gy0 = gy[0];

  const CAP_PITCH = args.bead * 0.55;
  const CAP_DIAG = { why: null };

  const _plen = (pts) => polylineLength(pts);

  /* A membrane that follows the hole it closes (see the Python docstring). */
  function cap_path(m, prev_closed){
    const { labels: lab } = label4(not(prev_closed), Hh, W);
    // vals = lab[m]; vals = vals[vals>0]; bincount.argmax -> the label with most pixels under m, lowest label on ties
    const counts = new Map(); let nvals = 0;
    for(let i = 0; i < NPX; i++) if(m[i] && lab[i] > 0){ counts.set(lab[i], (counts.get(lab[i]) || 0) + 1); nvals++; }
    if(nvals === 0){ CAP_DIAG.why = 'nothing open below'; return [null, 0.0, 0.0]; }
    let hid = 0, hc = -1;
    for(const [k, v] of counts) if(v > hc || (v === hc && k < hid)){ hc = v; hid = k; }
    const prev_hole = new Uint8Array(NPX); for(let i = 0; i < NPX; i++) prev_hole[i] = lab[i] === hid ? 1 : 0;
    let touches = false;
    for(let c = 0; c < W && !touches; c++) if(prev_hole[c] || prev_hole[(Hh - 1) * W + c]) touches = true;
    for(let r = 0; r < Hh && !touches; r++) if(prev_hole[r * W] || prev_hole[r * W + W - 1]) touches = true;
    if(touches){ CAP_DIAG.why = 'open to the outside below, not a hole'; return [null, 0.0, 0.0]; }
    const er = Math.max(1, pyRound((args.w / 2) / res));
    const voidM = erodeCross(prev_hole, Hh, W, er);
    if(!anyOf(voidM)){ CAP_DIAG.why = 'the void below is narrower than the wall'; return [null, 0.0, 0.0]; }
    const d = edt(voidM, Hh, W); for(let i = 0; i < NPX; i++) d[i] *= res;
    const dmax = maxOf(d);
    const lvl0 = CAP_PITCH / 2;
    if(dmax < lvl0){ CAP_DIAG.why = `void below only ${dmax.toFixed(2)} mm deep`; return [null, 0.0, 0.0]; }
    const rings = []; let lvl = lvl0, last = lvl;
    while(lvl <= dmax){                                   // lvl accumulates by repeated addition, as in Python
      for(const c of findContours(d, Hh, W, lvl)){
        const pts = c.map(p => [gx0 + p[1] * res, gy0 + p[0] * res]);
        if(hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) > res * 2) continue;
        if(_plen(pts) < 2.0) continue;
        rings.push(pts); last = lvl;
      }
      lvl += CAP_PITCH;
    }
    if(!rings.length){ CAP_DIAG.why = 'no traceable ring'; return [null, 0.0, 0.0]; }
    const order = []; let rest = rings.map((_, i) => i); let curp = null; let jump = 0.0;
    const minDistTo = (ring, p) => { let b = Infinity; for(const q of ring){ const v = hypot(q[0] - p[0], q[1] - p[1]); if(v < b) b = v; } return b; };
    while(rest.length){
      let j;
      if(curp === null) j = rest[0];
      else { let bv = Infinity; for(const k of rest){ const v = minDistTo(rings[k], curp); if(v < bv){ bv = v; j = k; } } }   // min(): first minimum
      const r = rings[j]; rest = rest.filter(k => k !== j);
      let i0;
      if(curp === null) i0 = 0;
      else {
        i0 = 0; let bv = Infinity;
        for(let k = 0; k < r.length; k++){ const v = hypot(r[k][0] - curp[0], r[k][1] - curp[1]); if(v < bv){ bv = v; i0 = k; } }   // argmin: first
        jump = Math.max(jump, hypot(r[i0][0] - curp[0], r[i0][1] - curp[1]));
      }
      const body = r.slice(0, r.length - 1);                                      // r[:-1]
      const rr = body.slice(i0).concat(body.slice(0, i0)); rr.push(rr[0]);        // np.roll(-i0) then close
      order.push(rr); curp = rr[rr.length - 1];
    }
    let pts = [].concat(...order);
    const core = dmax - last;
    if(core > args.bead * 0.5){
      const im = argmax(d); const iy = Math.floor(im / W), ix = im - iy * W;
      const cxx = gx0 + ix * res, cyy = gy0 + iy * res;
      pts = pts.concat([[cxx - core, cyy], [cxx + core, cyy]]);
    }
    const dp_out = edt(not(prev_closed), Hh, W), dp_in = edt(prev_closed, Hh, W);
    const o = rings[0];
    let sum = 0;
    for(const p of o){
      // ((o-gx0)/res).astype(int) truncates towards zero, then np.clip
      let col = Math.trunc((p[0] - gx0) / res), row = Math.trunc((p[1] - gy0) / res);
      col = Math.min(Math.max(col, 0), W - 1); row = Math.min(Math.max(row, 0), Hh - 1);
      const i = row * W + col;
      if((dp_out[i] * res + dp_in[i] * res) <= args.w / 2) sum += 1;   // wall band of the layer below
    }
    return [pts.map(p => [pyRoundN(p[0], 3), pyRoundN(p[1], 3)]), sum / o.length, jump];
  }

  function field(zz, capinfo, prev_closed){
    const [a, b] = ab_at(zz);
    const f = new Float64Array(NPX).fill(1e9);
    for(const [cx, cy] of centers){
      for(let r = 0; r < Hh; r++){
        const yy = (gy[r] - cy) / b; const yy2 = yy * yy;
        for(let c = 0; c < W; c++){
          const xx = (gx[c] - cx) / a;
          const v = Math.sqrt(xx * xx + yy2) - 1.0;         // ((X-cx)/a)**2: numpy squares as x*x
          const i = r * W + c; if(v < f[i]) f[i] = v;
        }
      }
    }
    const inside = new Uint8Array(NPX); for(let i = 0; i < NPX; i++) inside[i] = f[i] <= 0 ? 1 : 0;
    const rho = rho_at(zz), rp = rho / res;
    const dil = edtLE(not(inside), Hh, W, rp);
    let closed = edtGT(dil, Hh, W, rp);
    const ro = RHO_MIN / res;
    const eroded = edtGT(closed, Hh, W, ro);
    closed = edtLE(not(eroded), Hh, W, ro);          // opening: convex cusps rounded to RHO_MIN too
    const filled = fillHoles(closed, Hh, W);
    const holes = new Uint8Array(NPX); for(let i = 0; i < NPX; i++) holes[i] = filled[i] && !closed[i] ? 1 : 0;
    const { labels: hl, n: nh } = label4(holes, Hh, W);
    for(let hid = 1; hid <= nh; hid++){
      const m = new Uint8Array(NPX); let msum = 0; for(let i = 0; i < NPX; i++) if(hl[i] === hid){ m[i] = 1; msum++; }
      const dist = edt(m, Hh, W); for(let i = 0; i < NPX; i++) dist[i] *= res;
      const r_ins = maxOf(dist);
      if(r_ins < HOLE_CAP_R){
        if(prev_closed === null){ for(let i = 0; i < NPX; i++) if(m[i]) closed[i] = 1; continue; }
        let ob = 0; for(let i = 0; i < NPX; i++) if(m[i] && !prev_closed[i]) ob++;
        const open_below = ob / Math.max(1, msum);
        if(open_below < 0.5){
          for(let i = 0; i < NPX; i++) if(m[i]) closed[i] = 1;
          if(capinfo) capinfo.push({ kind: 'born', r_ins: pyRoundN(r_ins, 3) });
          continue;
        }
        CAP_DIAG.why = null;
        const [pts, anchor, jump] = cap_path(m, prev_closed);
        if(pts === null && CAP_DIAG.why === 'open to the outside below, not a hole'){
          if(capinfo) capinfo.push({ kind: 'notyet', r_ins: pyRoundN(r_ins, 3) });
          continue;
        }
        for(let i = 0; i < NPX; i++) if(m[i]) closed[i] = 1;
        if(pts === null || anchor < 0.6){
          if(capinfo) capinfo.push({ kind: 'unanchorable', r_ins: pyRoundN(r_ins, 3), why: CAP_DIAG.why, anchoredFrac: pyRoundN(anchor, 3) });
          continue;
        }
        if(capinfo){
          // np.argmax(dist*m): dist is 0 outside m already; first maximum in raster order
          const im = argmax(dist); const iy = Math.floor(im / W), ix = im - iy * W;
          capinfo.push({ kind: 'cap', pts, cx: gx0 + ix * res, cy: gy0 + iy * res, r_ins: pyRoundN(r_ins, 3),
            span_mm: pyRoundN(2 * Math.max(0.0, r_ins - args.w / 2 - args.e), 2), anchoredFrac: pyRoundN(anchor, 3),
            maxJump_mm: pyRoundN(jump, 2), len_mm: pyRoundN(_plen(pts), 1) });
        }
      }
    }
    const dOut = edt(not(closed), Hh, W), dIn = edt(closed, Hh, W);
    const sdf = new Float64Array(NPX); for(let i = 0; i < NPX; i++) sdf[i] = (dOut[i] - dIn[i]) * res;
    return [closed, sdf, [a, b, rho]];
  }

  /** closed iso-lines of the SDF: outer boundaries CCW, holes CW (see the Python docstring). */
  function contours_of(sdf, mask){
    const cs = findContours(sdf, Hh, W, 0.0);
    const out = [];
    for(const c of cs){
      let pts = c.map(p => [gx0 + p[1] * res, gy0 + p[0] * res]);
      if(hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) > res * 2) continue;
      const area = polygonArea(pts);
      if(Math.abs(area) < 2.0) continue;
      if(area < 0) pts = pts.slice().reverse();
      const n = pts.length, i = Math.floor(n / 3);
      const p1 = pts[(i + 1) % n], p0 = pts[(i - 1 + n) % n];        // pts[i-1] with Python's negative index
      const t = [p1[0] - p0[0], p1[1] - p0[1]];
      let nn = [t[1], -t[0]]; const l = hypot(nn[0], nn[1]) + 1e-12; nn = [nn[0] / l, nn[1] / l];
      const q = [pts[i][0] + nn[0] * 1.0, pts[i][1] + nn[1] * 1.0];
      const col = pyRound((q[0] - gx0) / res), row = pyRound((q[1] - gy0) / res);     // int(round()) — half to even
      const inside = row >= 0 && row < Hh && col >= 0 && col < W && !!mask[row * W + col];
      if(inside) pts = pts.slice().reverse();
      out.push(pts);
    }
    return out;
  }

  function owners(q){
    const own = new Int32Array(q.length);
    for(let i = 0; i < q.length; i++){
      let bi = 0, bv = Infinity;
      for(let c = 0; c < centers.length; c++){ const v = hypot(q[i][0] - centers[c][0], q[i][1] - centers[c][1]); if(v < bv){ bv = v; bi = c; } }   // argmin: first
      own[i] = bi;
    }
    return own;
  }

  function nodes_for(q, cum, L, zz){
    const own = owners(q), n = q.length;
    const p0 = 2 * Math.PI * args.r0 / args.K;
    const us = [];
    const [a, b] = ab_at(zz);
    const per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    let m = 0;
    while(per / (args.K * Math.pow(2, m)) > 2 * p0 && m < 4) m++;
    const Keff = args.K * Math.pow(2, m), dth = 2 * Math.PI / Keff;
    let start = 0;
    for(let i = 0; i < n; i++){ if(own[i] !== own[(i - 1 + n) % n]){ start = i; break; } }   // own[i-1], i=0 wraps to the last
    const idx = new Int32Array(n); for(let i = 0; i < n; i++) idx[i] = (start + i) % n;
    const ang = (i, c) => Math.atan2(q[i][1] - centers[c][1], q[i][0] - centers[c][0]);
    for(let k = 0; k < n; k++){
      const i = idx[k], j = idx[(k + 1) % n], c = own[i];
      if(own[j] !== c) continue;
      const th0 = ang(i, c), th1 = ang(j, c); let dd = th1 - th0;
      if(dd > Math.PI) dd -= 2 * Math.PI;
      if(dd < -Math.PI) dd += 2 * Math.PI;
      if(Math.abs(dd) < 1e-9) continue;
      const g0 = Math.floor((th0 / dth) - 0.5), g1 = Math.floor((th1 / dth) - 0.5);
      for(let g = Math.min(g0, g1) + 1; g <= Math.max(g0, g1); g++){
        let tg = (g + 0.5) * dth;
        while(tg - th0 > Math.PI) tg -= 2 * Math.PI;
        while(tg - th0 < -Math.PI) tg += 2 * Math.PI;
        const f = (tg - th0) / dd;
        if(0 <= f && f <= 1){
          const u = cum[i] + f * (j > i ? (cum[j] - cum[i]) : (L - cum[i] + cum[j]));
          us.push(pyMod(u, L));
        }
      }
    }
    us.sort((x, y) => x - y);
    const filled = [];
    for(let k = 0; k < us.length; k++){
      const u = us[k];
      filled.push(u);
      const nu = us.length ? us[(k + 1) % us.length] : u;
      const gap = us.length > 1 ? pyMod(nu - u, L) : L;          // Python's %: result has the sign of L
      if(gap > 1.6 * p0){
        const cnt = pyFloorDiv(gap, p0);                          // int(gap//p0)
        for(let t = 1; t < cnt; t++) filled.push(pyMod(u + gap * t / cnt, L));
      }
    }
    filled.sort((x, y) => x - y);
    const MINSP = Math.max(2.4, 0.7 * p0);
    const keep = [];
    for(const u of filled){ if(!keep.length || u - keep[keep.length - 1] >= MINSP) keep.push(u); }
    if(keep.length > 1 && (L - keep[keep.length - 1] + keep[0]) < MINSP) keep.pop();
    return [keep, Keff, p0];
  }

  /* ---------------- run ---------------- */
  const layers = [], events = [];
  let prev_labels = null;
  function match_events(zi, labels, nlab, prevLabels, prevN){
    const ev = [];
    if(prevLabels === null){
      for(let lab = 1; lab <= nlab; lab++) ev.push({ z: pyRoundN(zi, 3), type: 'birth', id: lab, onFoundation: zi <= args.lh * 1.5 });
      return ev;
    }
    const cur_n = nlab, prev_n = prevN;
    const ov = new Int32Array((prev_n + 1) * (cur_n + 1));
    for(let i = 0; i < NPX; i++) if(labels[i] > 0 && prevLabels[i] > 0) ov[prevLabels[i] * (cur_n + 1) + labels[i]]++;
    for(let c = 1; c <= cur_n; c++){
      const parents = []; for(let p = 1; p <= prev_n; p++) if(ov[p * (cur_n + 1) + c] > 0) parents.push(p);
      if(parents.length === 0) ev.push({ z: pyRoundN(zi, 3), type: 'birth', id: c, onFoundation: false, IN_AIR: true });
      else if(parents.length > 1) ev.push({ z: pyRoundN(zi, 3), type: 'merge', id: c, from: parents });
    }
    for(let p = 1; p <= prev_n; p++){
      const kids = []; for(let c = 1; c <= cur_n; c++) if(ov[p * (cur_n + 1) + c] > 0) kids.push(c);
      if(kids.length === 0) ev.push({ z: pyRoundN(zi, 3), type: 'death', id: p });
      else if(kids.length > 1) ev.push({ z: pyRoundN(zi, 3), type: 'split', id: p, to: kids });
    }
    return ev;
  }

  let first = null;
  let prev_pts = null; const shifts = [];
  let PREV_CLOSED = null;
  let cap_born = 0;
  const cap_refused = [];
  let prev_n = 0;
  for(let k = 0; k < N; k++){
    const zb = k * args.lh, zc = zb + args.lh / 2;
    const capinfo = [];
    const [closed, sdf, [a, b, rho]] = field(zc, capinfo, PREV_CLOSED);
    const new_caps = capinfo.filter(c => c.kind === 'cap');
    for(const c of capinfo){
      if(c.kind === 'born') cap_born++;
      else if(c.kind === 'unanchorable') cap_refused.push({ z: pyRoundN(zc, 3), r_ins: c.r_ins, anchoredFrac: c.anchoredFrac, why: c.why === undefined ? null : c.why });
    }
    const { labels, n: nlab } = label4(closed, Hh, W);
    events.push(...match_events(zc, labels, nlab, prev_labels, prev_n)); prev_labels = labels; prev_n = nlab;
    const cs = contours_of(sdf, closed);
    const lay = { k, zBot: pyRoundN(zb, 4), zTop: pyRoundN(zb + args.lh, 4), a: pyRoundN(a, 3), b: pyRoundN(b, 3), rho: pyRoundN(rho, 3), contours: [] };
    if(new_caps.length){
      const cps = new_caps.map(c => ({ pts: c.pts, r_ins: c.r_ins, span_mm: c.span_mm, cx: pyRoundN(c.cx, 2), cy: pyRoundN(c.cy, 2),
        anchoredFrac: c.anchoredFrac, maxJump_mm: c.maxJump_mm, len_mm: c.len_mm,
        process: 'single-layer-inward-spiral/suma-legacy-v1', physicalStatus: 'experimental', evidence: null }));
      lay.caps = cps;
      events.push({ z: pyRoundN(zc, 3), type: 'hole-cap', n: cps.length, span_mm: Math.max(...new_caps.map(c => c.span_mm)),
        minAnchoredFrac: pyRoundN(Math.min(...new_caps.map(c => c.anchoredFrac)), 3), maxJump_mm: pyRoundN(Math.max(...new_caps.map(c => c.maxJump_mm)), 2) });
    }
    if(k === 0){
      // foundation = a brim around EACH column, unioned where the brims touch; interstices stay open
      const brim = new Uint8Array(NPX);
      const Rb = r_col + args.w / 2 + args.foundation;
      for(const [cx, cy] of centers) for(let r = 0; r < Hh; r++) for(let c = 0; c < W; c++){
        if(hypot(gx[c] - cx, gy[r] - cy) <= Rb) brim[r * W + c] = 1;
      }
      const bo = edt(not(brim), Hh, W), bi = edt(brim, Hh, W);
      const bsdf = new Float64Array(NPX); for(let i = 0; i < NPX; i++) bsdf[i] = (bo[i] - bi[i]) * res;
      const pitch = 0.52 * 0.82; const rings = [];
      let lvl = -pitch * 0.5;
      while(true){
        const cs_l = findContours(bsdf, Hh, W, lvl);
        if(!cs_l.length) break;
        for(const c of cs_l){
          const pts = c.map(p => [gx0 + p[1] * res, gy0 + p[0] * res]);
          if(pts.length > 6) rings.push(pts);
        }
        lvl -= pitch;
      }
      const { labels: lab } = label4(brim, Hh, W);
      const groups = new Map();                                    // dict: insertion order
      for(const r of rings){
        const cx_ = pyRound((r[0][0] - gx0) / res), cy_ = pyRound((r[0][1] - gy0) / res);
        const key = lab[Math.min(Math.max(cy_, 0), Hh - 1) * W + Math.min(Math.max(cx_, 0), W - 1)];
        if(!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }
      let paths = [];
      const emit = (path) => path.filter((_, i) => i % 2 === 0).map(p => [pyRoundN(p[0], 3), pyRoundN(p[1], 3)]);   // path[::2]
      for(const [, rs] of groups){
        let path = []; let cur_ = null;
        for(let r of rs){
          if(cur_ !== null){
            let si = 0, bv = Infinity;
            for(let i = 0; i < r.length; i++){ const v = hypot(r[i][0] - cur_[0], r[i][1] - cur_[1]); if(v < bv){ bv = v; si = i; } }
            if(bv > 3.0){ paths.push(emit(path)); path = []; }
            r = r.slice(si).concat(r.slice(0, si));                    // np.roll(r, -si)
          }
          for(const p of r) path.push(p); cur_ = r[r.length - 1];
        }
        if(path.length) paths.push(emit(path));
      }
      if(paths.length){
        let rest = paths.slice(1); const tour = [paths[0]];
        while(rest.length){
          const e = tour[tour.length - 1][tour[tour.length - 1].length - 1];
          let j = 0, bv = Infinity;
          for(let i = 0; i < rest.length; i++){
            const v = Math.min(hypot(rest[i][0][0] - e[0], rest[i][0][1] - e[1]), hypot(rest[i][rest[i].length - 1][0] - e[0], rest[i][rest[i].length - 1][1] - e[1]));
            if(v < bv){ bv = v; j = i; }
          }
          let qq = rest.splice(j, 1)[0];
          if(hypot(qq[qq.length - 1][0] - e[0], qq[qq.length - 1][1] - e[1]) < hypot(qq[0][0] - e[0], qq[0][1] - e[1])) qq = qq.slice().reverse();
          tour.push(qq);
        }
        paths = tour;
      }
      first = { zBot: 0, zTop: pyRoundN(args.lh, 4), paths, pts: [].concat(...paths), rings: rings.length, slabs: paths.length, kind: 'merged-brims-with-open-interstices' };
      lay.foundation = true;
    }
    for(const c of cs){
      const { r: q, L, cum } = resampleClosed(c);
      const nrm = outwardNormals(q);
      const [us, Keff] = nodes_for(q, cum, L, zc);
      const qq = q.concat([q[0]]), nn = nrm.concat([nrm[0]]);
      lay.contours.push({ pts: qq.map(p => [pyRoundN(p[0], 3), pyRoundN(p[1], 3)]), nrm: nn.map(p => [pyRoundN(p[0], 4), pyRoundN(p[1], 4)]),
        cum: Array.from(cum, v => pyRoundN(v, 4)), total: pyRoundN(L, 4), nodes: us.map(u => pyRoundN(u, 4)), Keff });
    }
    // tab-tip crowding, computed from the ROUNDED pts/nrm/cum/nodes as the Python does
    const reach = args.w / 2 + args.e;
    for(const c of lay.contours){
      const q = c.pts.slice(0, -1), nrm = c.nrm.slice(0, -1);
      if(c.nodes.length < 2) continue;
      const cumArr = c.cum.slice(0, -1);
      const tips = c.nodes.map(u => { const idx = searchsortedLeft(cumArr, u) % q.length; return [q[idx][0] - nrm[idx][0] * reach, q[idx][1] - nrm[idx][1] * reach]; });
      if(tips.length > 1) c.minTipGap = pyRoundN(minNearestOtherDistance(tips), 3);
    }
    const tipsVals = lay.contours.filter(c => 'minTipGap' in c).map(c => c.minTipGap);
    if(tipsVals.length) lay.minTipGap = Math.min(...tipsVals);
    let cur_pts = lay.contours.length ? [].concat(...lay.contours.map(c => c.pts)) : null;
    if(k === 0 && first) cur_pts = first.pts;
    if(prev_pts !== null && cur_pts !== null && k > 0){
      lay.maxStep = pyRoundN(maxNearestDistance(prev_pts, cur_pts), 3); shifts.push([pyRoundN(zc, 2), lay.maxStep]);
    }
    prev_pts = cur_pts;
    PREV_CLOSED = closed;
    layers.push(lay);
    if(k % 50 === 0) log(`layer ${k}/${N} z=${zc.toFixed(2)} contours=${cs.length} a=${a.toFixed(2)} b=${b.toFixed(2)} rho=${rho.toFixed(2)}`);
  }

  const withTip = layers.filter(l => 'minTipGap' in l);
  const summary = {
    N, H: pyRoundN(H, 3), centers, plan, Z_SPLIT: [Z_SPLIT0, Z_SPLIT1], Z_COL: [Z_COL0, Z_COL1],
    RHO_MIN, grid: [xmin, xmax, ymin, ymax], args: Object.assign({}, args),
    contourCounts: layers.map(l => l.contours.length), events,
    supportCheck: { rule: 'centerline step per layer vs allowed band (w/2 + e = chord must land inside the previous rung+tab span)',
      allowed_mm: args.w / 2 + args.e, maxStep_mm: shifts.length ? Math.max(...shifts.map(t => t[1])) : null,
      worstLayers: shifts.slice().sort((p, q) => (-p[1]) - (-q[1])).slice(0, 8),       // stable sort by -step, like sorted()
      violations: shifts.filter(t => t[1] > args.w / 2 + args.e) },
    tipCrowding: { rule: 'minimum distance between inner rung tips in a layer; below ~2*bead the tips fuse into a knot',
      floor_mm: pyRoundN(2 * args.bead, 3),
      worst: withTip.map(l => [pyRoundN(l.zBot, 2), l.minTipGap]).sort((p, q) => p[1] - q[1]).slice(0, 8),
      violations: layers.filter(l => ('minTipGap' in l ? l.minTipGap : 9) < 2 * args.bead).map(l => [pyRoundN(l.zBot, 2), l.minTipGap]) },
    holeRule: { minHoleRadius_mm: pyRoundN(HOLE_CAP_R, 2), maxBridge_mm: 12, pitch_mm: pyRoundN(CAP_PITCH, 3),
      policy: 'an INHERITED hole below the minimum radius is capped with a membrane that follows its own rim '
        + '(concentric inward offsets one bead pitch apart, linked into one path); a hole BORN inside solid '
        + 'is filled and never capped; a membrane whose outermost turn does not sit on the wall below is '
        + 'refused. Rewritten 2026-09-03 from the P0 4x4 print, where the circle-from-a-summary version '
        + 'put 14 of 21 membranes in mid-air.',
      minAnchoredFrac: 0.6, capsBornAndFilled: cap_born, capsRefused: cap_refused,
      caps: events.filter(e => e.type === 'hole-cap') },
  };
  return { summary, foundation: first, layers };
}

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv); }
  catch(e){ console.error(`usage: weft_suma_geometry.mjs [--cols N --rows N --r0 F --s1 F --s2 F --s3 F --lh F --w F --e F --bead F --K N --res F --out FILE --step F --hold F --foundation F]\nerror: ${e.message}`); process.exit(2); }
  const geo = generateSuma(args, { log: (s) => console.error(s) });
  fs.writeFileSync(args.out, JSON.stringify(geo));
  const s = geo.summary;
  const shown = {}; for(const [k, v] of Object.entries(s)) if(!['contourCounts', 'events', 'args'].includes(k)) shown[k] = v;
  console.log(JSON.stringify(shown));
  console.log('EVENTS:'); for(const e of s.events) console.log('  ' + JSON.stringify(e));
  const cc = s.contourCounts;
  console.log('contour counts by layer (compressed):', JSON.stringify(cc.map((c, i) => [i, c]).filter(([i, c]) => i === 0 || c !== cc[i - 1])));
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
