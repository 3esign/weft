/* core/weft_discbody_engine.mjs — the level-2 engine that climber_geometry.py and vase_geometry.py
 * share by copy (the Python docstring of the vase says so: "Same engine as climber_geometry.py ...
 * The two files share that engine by copy"). Everything from the raster down — masks, hole and death
 * closure, the contour tree, contours, weld columns, the per-layer wall solve, the rate limit, the
 * over-air arc, the checks that refuse, the summary, the JSON and the printed lines — is here once;
 * the two ports (core/weft_climber_geometry.mjs, core/weft_vase_geometry.mjs) supply the body
 * (parts_at, phase_at), the argparse namespace and the few strings that differ.
 *
 * Statement for statement the same as lines 238-870 of climber_geometry.py (176-808 of
 * vase_geometry.py), with the same evaluation order in every float expression. The numeric twins
 * are the kernel's: numpy arange / pairwise sum / interp, glibc hypot, scipy's distance transform
 * and labelling, scikit-image's marching squares (core/weft_geom.js); CPython's math.hypot, round(),
 * repr() and json (core/weft_geom_ext.js, core/weft_geom_ext2.js); the OpenBLAS fma dot, the
 * k-nearest-neighbour query, the 8-connected labelling, the component distance transform and the
 * index-aware json.dump (core/weft_geom_ext3.js). Where a line has a non-obvious numpy/scipy meaning
 * the comment says what the Python does.
 */
import {
  npArange, pairwiseSum, hypot, pyRound, pyMod, pyFloorDiv,
  edt, edtLE, edtGT, not, label4, fillHoles, findContours, polygonArea, outwardNormals, searchsortedLeft,
  maxNearestDistance, minNearestOtherDistance,
} from './weft_geom.js';
import { pyHypot, pyRoundNSigned, pyFloatRepr, pyFormatFixed } from './weft_geom_ext.js';
import { libmSin, libmCos, libmAtan2, libmPow } from './weft_geom_ext2.js';
import {
  libmAcos, npDot2, knnGrid, nearestDistances, label8, edtMaxArg, resampleClosedPairwise,
  pyTupleListRepr, pyJsonDumpsTyped, npRound,
} from './weft_geom_ext3.js';

/* Two roundings, because the Python has two kinds of float. round(x, n) on a Python float is
 * CPython's correctly rounded decimal rounding (rr); on a numpy.float64 — every value that came
 * through a numpy array: contour points, normals, cum, node positions, cap spirals seeded from
 * gx[0], a reach bound divided by a numpy curvature — it is numpy's rint(x*10^n)/10^n (npr). The
 * two agree except at decimal ties, and the file carries both. */
const rr = (v, n) => pyRoundNSigned(v, n);                 // round(x, n) on a Python float, keeping -0.0
const npr = (v, n) => npRound(v, n);                       // round(x, n) on a numpy.float64
/** np.searchsorted(a[:len], v) (side='left'): first index with a[idx] >= v. */
function ssLeft(a, v, len){ let lo = 0, hi = len; while(lo < hi){ const mid = lo + ((hi - lo) >> 1); if(a[mid] < v) lo = mid + 1; else hi = mid; } return lo; }

/* ---------------- constants and helpers the body shares with the engine ---------------- */
export function bodyConstants(args){
  const H = args.H, LH = args.lh;
  const N = pyRound(H / LH);                                 // int(round(H/LH)): half to even
  const W_MAX = Math.max(args.w0, args.w1), W_MIN = Math.min(args.w0, args.w1);
  const sm = (t) => { t = Math.max(0.0, Math.min(1.0, t)); return t * t * (3 - 2 * t); };
  const W_FLOOR = 0.9, W_DESIGN = 1.8, TAB_FLOOR = 0.4, W_RATE = 0.24, TAB_RATE = 0.08;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  /** the breathing wall: (w0+w1)/2 + (w1-w0)/2*sin(2*pi*2.0*t - pi/2) + (w1-w0)*0.13*sin(2*pi*5.0*t + 1.1) */
  function wall_nominal(z){
    const t = z / H;
    const a = (args.w0 + args.w1) / 2 + (args.w1 - args.w0) / 2 * libmSin(2 * Math.PI * 2.0 * t - Math.PI / 2);
    return a + (args.w1 - args.w0) * 0.13 * libmSin(2 * Math.PI * 5.0 * t + 1.1);
  }
  const RAIL_MIN = args.bead * 0.95 + 0.45;
  const RHO_MORPH = W_DESIGN / 2 + TAB_FLOOR + args.bead + 0.3;
  const RHO_at = (z) => RHO_MORPH;                         // eslint-disable-line no-unused-vars
  const CAP_at = (z) => W_FLOOR / 2 + TAB_FLOOR + RHO_MORPH + 1.5;  // eslint-disable-line no-unused-vars
  const RHO_MAX = RHO_MORPH;
  return { H, LH, N, W_MAX, W_MIN, sm, W_FLOOR, W_DESIGN, TAB_FLOOR, W_RATE, TAB_RATE, lerp, wall_nominal, RAIL_MIN, RHO_MORPH, RHO_at, CAP_at, RHO_MAX };
}

/** Python's `int(x) % m` for the phase band index: a non-negative result. */
export function pyIntMod(x, m){ const r = Math.trunc(x) % m; return r < 0 ? r + m : r; }

/* ---------------- JSON typing: which numbers the Python writes as ints ---------------- */
const INT_DIRECT = new Set(['N', 'legs', 'strands', 'K', 'k', 'id', 'count', 'rings', 'islands', 'openings', 'ribs',
  'bridges', 'death', 'hole', 'notSelfSupporting', 'doubledLayers', 'contours', 'violations']);
/** isInt(path, value) for pyJsonDumpsTyped: the path carries keys and array indices. `intZero` is the
 *  set of joined paths where the Python wrote the int 0 of a `max(..., default=0)`. */
export function makeIsInt(intZero){
  return (path, value) => {
    const n = path.length, last = path[n - 1];
    if(typeof last === 'string'){
      if(INT_DIRECT.has(last)) return true;
      if(last === 'zBot' && path[n - 2] === 'foundation') return true;           // 'zBot': 0
      if(last === 'reachCap' && value === 999) return true;                     // round(min(reach_cap, 999), 3) with the int 999
      if(value === 0 && intZero.has(path.join('.'))) return true;
      return false;
    }
    // a number inside a list: from/to hold ints, contourCounts rows are [zBot, count]
    if(typeof last === 'number'){
      const key = path[n - 2];
      if(key === 'from' || key === 'to') return true;
      if(last === 1 && typeof key === 'number' && path[n - 3] === 'contourCounts') return true;
      if(value === 0 && intZero.has(path.join('.'))) return true;
    }
    return false;
  };
}

/**
 * Run the engine. cfg:
 *   args        the argparse namespace (object, argparse key order)
 *   C           bodyConstants(args)
 *   parts_at(z) -> [[x, y, r], ...]      the discs whose union is the body
 *   phase_at(z) -> [web, tab, phaseName]
 *   process     the membrane process string of the caps
 *   head(N)     the summary entries before 'args' (e.g. { N, H, legs })
 *   rasterLine(gxLen, gyLen, lim, N) -> the stderr line printed after the raster is set up
 *   log(line)   stderr sink (optional)
 * Returns { payload, summary, first, layers, violations, isInt, toJson(), rejectedJson(), stdoutText(), stderrLines }.
 */
export function runDiscBodyEngine(cfg){
  const { args, C, parts_at, phase_at, process } = cfg;
  const log = cfg.log || (() => {});
  const stderrLines = [];
  const say = (s) => { stderrLines.push(s); log(s); };
  const { H, LH, N, W_MAX, W_FLOOR, TAB_FLOOR, W_RATE, TAB_RATE, wall_nominal, RAIL_MIN, RHO_at, CAP_at, RHO_MAX } = C;

  /* ---------------- raster ---------------- */
  let lim = 0.0;
  for(let k = 0; k <= N; k++) for(const [x, y, r] of parts_at(k * LH)) lim = Math.max(lim, pyHypot(x, y) + r);   // math.hypot
  lim += W_MAX / 2 + args.foundation + args.rib + 6;
  const res = args.res;
  const gx = npArange(-lim, lim, res), gy = npArange(-lim, lim, res);
  const W = gx.length, Hh = gy.length, NPX = W * Hh;       // meshgrid: X[r][c] = gx[c], Y[r][c] = gy[r]
  const gx0 = gx[0], gy0 = gy[0];
  say(cfg.rasterLine(W, Hh, lim, N));
  const PX_MM2 = res * res;
  const MIN_AREA = 2.0;

  /** inside = min over parts of (hypot(X-cx, Y-cy) - r) <= 0, i.e. some part has hypot <= r. glibc's
   *  hypot is only evaluated where dx*dx+dy*dy sits within 1e-9 (relative) of r*r; elsewhere the
   *  comparison is decided by the squares, which cannot disagree with a hypot that is exact to a
   *  few ulp. */
  function discInside(parts){
    const inside = new Uint8Array(NPX);
    for(const [cx, cy, r] of parts){
      const r2 = r * r, lo = r2 * (1 - 1e-9), hi = r2 * (1 + 1e-9);
      for(let row = 0; row < Hh; row++){
        const dy = gy[row] - cy, dy2 = dy * dy, base = row * W;
        for(let col = 0; col < W; col++){
          if(inside[base + col]) continue;
          const dx = gx[col] - cx; const s = dx * dx + dy2;
          if(s < lo) inside[base + col] = 1;
          else if(s <= hi && hypot(dx, dy) <= r) inside[base + col] = 1;
        }
      }
    }
    return inside;
  }
  function mask_at(z){
    const inside = discInside(parts_at(z));
    const rp = RHO_at(z) / res;
    const dil = edtLE(not(inside), Hh, W, rp);
    let m = edtGT(dil, Hh, W, rp);                         // closing: necks filleted at RHO(z)
    const er = edtGT(m, Hh, W, rp);
    m = edtLE(not(er), Hh, W, rp);                         // opening: convex cusps at RHO(z) too
    return m;
  }

  function spiral(cx, cy, rrad, pitch){
    const turns = Math.max(0.75, rrad / pitch); const m = Math.max(48, Math.ceil(turns * 64)); const pts = [];
    for(let i = 0; i <= m; i++){
      const t = i / m; const a = -Math.PI + t * turns * 2 * Math.PI; const rad = rrad - rrad * t;
      pts.push([npr(cx + rad * libmCos(a), 3), npr(cy + rad * libmSin(a), 3)]);   // cx, cy are numpy scalars (gx[0] + ix*res)
    }
    return pts;
  }

  function contours_of(sdf, mask){
    const out = [];
    for(const c of findContours(sdf, Hh, W, 0.0)){
      let pts = c.map(p => [gx0 + p[1] * res, gy0 + p[0] * res]);
      if(hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) > res * 2) continue;
      const area = polygonArea(pts);                       // 0.5*np.sum(x*roll(y,-1) - roll(x,-1)*y), pairwise
      if(Math.abs(area) < MIN_AREA) continue;
      if(area < 0) pts = pts.slice().reverse();
      let votes = 0;
      const n = pts.length;
      for(const frac of [0.17, 0.33, 0.5, 0.67, 0.83]){
        const i = Math.trunc(n * frac) % n;                // int(len(pts)*frac) % len(pts)
        const p1 = pts[(i + 1) % n], p0 = pts[(i - 1 + n) % n];   // pts[i-1]: Python's negative index wraps
        const t = [p1[0] - p0[0], p1[1] - p0[1]];
        const l = hypot(t[1], -t[0]) + 1e-12;              // np.hypot(*nr) + 1e-12
        const nr = [t[1] / l, -t[0] / l];
        const q = [pts[i][0] + nr[0] * 1.0, pts[i][1] + nr[1] * 1.0];
        const col = pyRound((q[0] - gx0) / res), row = pyRound((q[1] - gy0) / res);   // int(round()): half to even
        if(row >= 0 && row < Hh && col >= 0 && col < W && mask[row * W + col]) votes++;
      }
      if(votes >= 3) pts = pts.slice().reverse();
      out.push(pts);
    }
    return out;
  }

  const resample = (pts) => resampleClosedPairwise(pts, 0.7);
  const normals = (q) => outwardNormals(q);

  /** |curvature| at each weld column: the angle between the contour normals 1.5 mm either side. */
  function curv_at(q, cum, L, us, d = 1.5){
    const n = q.length, out = new Float64Array(us.length);
    for(let t = 0; t < us.length; t++){
      const u = us[t];
      const a = pyMod(u - d, L), b = pyMod(u + d, L);
      const ia = ssLeft(cum, a, n) % n, ib = ssLeft(cum, b, n) % n;   // np.searchsorted(cum[:-1], .)
      const qa1 = q[(ia + 1) % n], qa0 = q[(ia - 1 + n) % n], qb1 = q[(ib + 1) % n], qb0 = q[(ib - 1 + n) % n];
      const ta = [qa1[0] - qa0[0], qa1[1] - qa0[1]], tb = [qb1[0] - qb0[0], qb1[1] - qb0[1]];
      const la = hypot(ta[1], -ta[0]) + 1e-12, lb = hypot(tb[1], -tb[0]) + 1e-12;
      const na = [ta[1] / la, -ta[0] / la], nb = [tb[1] / lb, -tb[0] / lb];
      let c = npDot2(na[0], na[1], nb[0], nb[1]);          // na@nb: OpenBLAS ddot = fma(na1, nb1, na0*nb0)
      c = Math.max(-1, Math.min(1, c));                    // np.clip(c, -1, 1)
      out[t] = libmAcos(c) / (2 * d);
    }
    return out;
  }

  /** returns [bound, isNumpy]: the bound is a numpy.float64 once num/k (k a numpy curvature) has
   *  replaced the Python-float 1e9, which decides how reachCap is rounded later. */
  function reach_bound(us, kk, L, bead){
    if(us.length < 2) return [1e9, false];
    const n = us.length; let best = 1e9, isNp = false;
    for(let i = 0; i < n; i++){
      const g = pyMod(us[(i + 1) % n] - us[i], L);
      if(g <= 1e-6) return [0.0, false];
      const k = kk[i];
      if(k < 1e-4) continue;
      const num = 1.0 - bead / (0.45 * g);
      if(num <= 0) return [0.0, false];
      const v = num / k;
      if(v < best){ best = v; isNp = true; }                // min(best, v): v only when strictly smaller
    }
    return [best, isNp];
  }

  /** weld columns on each part's own angular grid, mapped onto the (possibly merged) curve. */
  function nodes_for(q, cum, L, z, K){
    const pts_ = parts_at(z);
    if(!pts_.length) return [[], K, 1.0];
    const cen = pts_.map(p => [p[0], p[1]]), rad = pts_.map(p => p[2]);
    const n = q.length;
    const own = new Int32Array(n);
    for(let i = 0; i < n; i++){                            // np.argmin over the parts: first minimum
      let bi = 0, bv = Infinity;
      for(let c = 0; c < cen.length; c++){ const v = hypot(q[i][0] - cen[c][0], q[i][1] - cen[c][1]) / Math.max(rad[c], 0.1); if(v < bv){ bv = v; bi = c; } }
      own[i] = bi;
    }
    const us = [];
    const p0 = 2 * Math.PI * (pairwiseSum(Float64Array.from(rad)) / rad.length) / K;   // float(np.mean(rad))
    let start = 0;
    for(let i = 0; i < n; i++){ if(own[i] !== own[(i - 1 + n) % n]){ start = i; break; } }   // own[i-1] wraps at i=0
    const idx = new Int32Array(n); for(let i = 0; i < n; i++) idx[i] = (start + i) % n;
    const ang = (i, c) => libmAtan2(q[i][1] - cen[c][1], q[i][0] - cen[c][0]);
    for(let k = 0; k < n; k++){
      const i = idx[k], j = idx[(k + 1) % n], c = own[i];
      if(own[j] !== c) continue;
      const dth = 2 * Math.PI / K;
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
      if(us.length > 1){
        const gap = pyMod(us[(k + 1) % us.length] - u, L);
        if(gap > 1.6 * p0){
          const cnt = pyFloorDiv(gap, p0);                 // int(gap//p0)
          for(let t = 1; t < cnt; t++) filled.push(pyMod(u + gap * t / cnt, L));
        }
      }
    }
    filled.sort((x, y) => x - y);
    const MINSP = Math.max(2.4, 0.7 * p0); const keep = [];
    for(const u of filled){ if(!keep.length || u - keep[keep.length - 1] >= MINSP) keep.push(u); }
    if(keep.length > 1 && (L - keep[keep.length - 1] + keep[0]) < MINSP) keep.pop();
    return [keep, K, p0];
  }

  /* ---------------- the first layer: one connected piece, with holes between the feet ---------------- */
  function build_foundation(z0, w0_){
    const parts = parts_at(z0);
    const body = new Float64Array(NPX).fill(1e9);
    for(const [cx, cy, r] of parts){
      for(let row = 0; row < Hh; row++){ const dy = gy[row] - cy, base = row * W; for(let col = 0; col < W; col++){ const v = hypot(gx[col] - cx, dy) - r; if(v < body[base + col]) body[base + col] = v; } }
    }
    const bandLo = -(w0_ / 2 + 0.2), bandHi = w0_ / 2 + args.foundation;
    const found = new Uint8Array(NPX);
    for(let i = 0; i < NPX; i++) found[i] = (body[i] >= bandLo && body[i] <= bandHi) ? 1 : 0;   // the brim ring, per foot
    const feet = parts.map(p => [p[0], p[1]]);
    let edges = [];
    if(feet.length >= 2){
      const nf = feet.length;
      edges = nf > 2 ? feet.map((_, i) => [i, (i + 1) % nf]) : [[0, 1]];
      for(const [i, j] of edges){
        const [ax, ay] = feet[i], [bx, by] = feet[j];
        const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy; const den = Math.max(L2, 1e-9);
        const half = args.rib / 2;
        for(let row = 0; row < Hh; row++){
          const Y = gy[row], base = row * W;
          for(let col = 0; col < W; col++){
            const X = gx[col];
            let t = ((X - ax) * dx + (Y - ay) * dy) / den; t = t < 0 ? 0 : t > 1 ? 1 : t;   // np.clip(..., 0, 1)
            if(hypot(X - (ax + t * dx), Y - (ay + t * dy)) <= half) found[base + col] = 1;   // ribs |= ...
          }
        }
      }
    }
    const { n: nl } = label8(found, Hh, W);                // ndimage.label(found, structure=np.ones((3,3)))
    const filled = fillHoles(found, Hh, W);
    const holes = new Uint8Array(NPX); for(let i = 0; i < NPX; i++) holes[i] = filled[i] && !found[i] ? 1 : 0;
    const { n: nh } = label4(holes, Hh, W);
    const dOut = edt(not(found), Hh, W), dIn = edt(found, Hh, W);
    const bs = new Float64Array(NPX); for(let i = 0; i < NPX; i++) bs[i] = (dOut[i] - dIn[i]) * res;
    const pitch = (args.bead + 0.06) * 0.82; const rings = []; let lvl = -pitch * 0.5;
    for(;;){
      const cl_ = findContours(bs, Hh, W, lvl);
      if(!cl_.length) break;
      for(const c of cl_){
        const p = c.map(pt => [gx0 + pt[1] * res, gy0 + pt[0] * res]);
        if(p.length > 6) rings.push(p);
      }
      lvl -= pitch;
    }
    const emit = (path) => path.filter((_, i) => i % 2 === 0).map(p => [rr(p[0], 3), rr(p[1], 3)]);   // path[::2]
    let paths = []; let path = []; let cur = null;
    for(let rg of rings){
      if(cur !== null){
        let si = 0, bv = Infinity;
        for(let i = 0; i < rg.length; i++){ const v = hypot(rg[i][0] - cur[0], rg[i][1] - cur[1]); if(v < bv){ bv = v; si = i; } }   // np.argmin: first
        if(bv > 3.0){ paths.push(emit(path)); path = []; }
        rg = rg.slice(si).concat(rg.slice(0, si));         // np.roll(rg, -si)
      }
      for(const p of rg) path.push(p); cur = rg[rg.length - 1];
    }
    if(path.length) paths.push(emit(path));
    if(paths.length){                                      // greedy nearest-endpoint tour: fewest travels
      let rest = paths.slice(1); const tour = [paths[0]];
      while(rest.length){
        const e = tour[tour.length - 1][tour[tour.length - 1].length - 1];
        let j = 0, bv = Infinity;
        for(let i = 0; i < rest.length; i++){               // min(range(len(rest)), key=...): first minimum
          const v = Math.min(pyHypot(rest[i][0][0] - e[0], rest[i][0][1] - e[1]), pyHypot(rest[i][rest[i].length - 1][0] - e[0], rest[i][rest[i].length - 1][1] - e[1]));
          if(v < bv){ bv = v; j = i; }
        }
        let q = rest.splice(j, 1)[0];
        if(pyHypot(q[q.length - 1][0] - e[0], q[q.length - 1][1] - e[1]) < pyHypot(q[0][0] - e[0], q[0][1] - e[1])) q = q.slice().reverse();
        tour.push(q);
      }
      paths = tour;
    }
    return [{ zBot: 0, zTop: rr(LH, 4), paths, rings: rings.length, kind: 'annular brims joined by ribs', islands: nl, openings: nh,
      ribWidth_mm: args.rib, ribs: edges.length }, found];
  }

  /* ---------------- run ---------------- */
  const layers = [], events = [], shifts = [], caps_all = [], rail_worst = [], open_ends = [], rail_steps = [];
  let prev_lab = null, prev_nl = 0, prev_pts = null, prev_holes = 0, first = null, found_mask = null;
  const CAPPED = new Set();
  const K_used = []; let tip_worst = [];
  const labelCounts = (labels, n) => { const c = new Int32Array(n + 1); for(let i = 0; i < NPX; i++) c[labels[i]]++; return c; };
  const capRec = (kind, cx, cy, rad, r_mm_val) => ({ kind, pts: spiral(cx, cy, rad, args.bead * 0.82), pitch_mm: rr(args.bead * 0.82, 3), r_mm: rr(r_mm_val, 2),
    c: [cx, cy], span_mm: rr(2 * r_mm_val, 2), process, physicalStatus: 'experimental', evidence: null });

  let cur_mask = mask_at(LH / 2);
  for(let k = 0; k < N; k++){
    const zb = k * LH, zc = zb + LH / 2;
    const nxt_mask = k + 1 < N ? mask_at(zc + LH) : new Uint8Array(NPX);
    const m = new Uint8Array(cur_mask);
    let [web, tab, phase] = phase_at(zc);
    const caps = [];
    /* --- hole closure: a hole too small to be walled is capped and filled above --- */
    const fill = fillHoles(m, Hh, W);
    const holes = new Uint8Array(NPX); for(let i = 0; i < NPX; i++) holes[i] = fill[i] && !m[i] ? 1 : 0;
    const { labels: hl, n: nh } = label4(holes, Hh, W);
    if(nh > prev_holes && k) events.push({ z: rr(zc, 2), type: 'hole-birth', count: nh - prev_holes });
    prev_holes = nh;
    for(let hid = 1; hid <= nh; hid++){
      const e = edtMaxArg(hl, hid, Hh, W); const r_ins = e.max * res;   // (edt*res).max(): res > 0 keeps the order
      if(r_ins < args.bead){ for(let i = 0; i < NPX; i++) if(hl[i] === hid) m[i] = 1; continue; }   // raster noise, not an opening
      if(r_ins < CAP_at(zc)){
        for(let i = 0; i < NPX; i++) if(hl[i] === hid) m[i] = 1;
        const iy = Math.floor(e.imax / W), ix = e.imax - iy * W;        // np.unravel_index(np.argmax(dist))
        const key = `hole,${pyRound(gx0 + ix * res)},${pyRound(gy0 + iy * res)},${pyFloorDiv(zc, 8)}`;   // ('hole', round(x), round(y), int(zc//8))
        if(!CAPPED.has(key)){
          CAPPED.add(key);
          caps.push(capRec('hole', gx0 + ix * res, gy0 + iy * res, r_ins + 0.5, r_ins + 0.5));
        }
      }
    }
    /* --- the wall this layer can actually carry: measured on THIS layer's own mask --- */
    const { labels: lab, n: nl } = label4(m, Hh, W);
    let w_geo;
    if(nl){
      let minr = Infinity;
      for(let cid = 1; cid <= nl; cid++){ const v = edtMaxArg(lab, cid, Hh, W).max * res; if(v < minr) minr = v; }
      w_geo = 2 * (minr - args.e - args.bead - 0.15);
    } else w_geo = W_MAX;
    let w = Math.max(W_FLOOR, Math.min(wall_nominal(zc), w_geo));
    /* --- DEATH CLOSURE: a component with no successor on the next layer is capped here --- */
    let counts = null, nlab = null, nnl = 0;
    if(nl){
      counts = labelCounts(lab, nl);
      ({ labels: nlab, n: nnl } = label4(nxt_mask, Hh, W));
      for(let cid = 1; cid <= nl; cid++){
        if(counts[cid] * PX_MM2 < MIN_AREA) continue;      // no wall here either way
        if(nnl){
          let surv = 0; for(let i = 0; i < NPX; i++) if(lab[i] === cid && nlab[i] > 0) surv++;
          if(surv * PX_MM2 >= MIN_AREA) continue;          // it really does continue upward
        }
        const e = edtMaxArg(lab, cid, Hh, W); const r_ins = e.max * res;
        const iy = Math.floor(e.imax / W), ix = e.imax - iy * W;
        caps.push(capRec('death', gx0 + ix * res, gy0 + iy * res, Math.max(1.0, r_ins), Math.max(1.0, r_ins)));
        events.push({ z: rr(zc, 2), type: 'death-cap', r_mm: rr(r_ins, 2) });
      }
    }
    /* --- OPEN ENDS: material with nothing above it --- */
    if(nl){
      const endm = new Uint8Array(NPX); for(let i = 0; i < NPX; i++) endm[i] = m[i] && !nxt_mask[i] ? 1 : 0;
      const { labels: el, n: ne } = label4(endm, Hh, W);
      const ec = labelCounts(el, ne);
      for(let eid = 1; eid <= ne; eid++){
        if(ec[eid] * PX_MM2 < MIN_AREA) continue;
        const e = edtMaxArg(el, eid, Hh, W); const r_end = e.max * res;
        if(r_end <= w / 2 + tab + args.bead) continue;    // the wall itself covers it
        const iy = Math.floor(e.imax / W), ix = e.imax - iy * W;
        const ex = gx0 + ix * res, ey = gy0 + iy * res;
        if(caps.some(c => pyHypot(c.c[0] - ex, c.c[1] - ey) <= c.r_mm && c.r_mm >= r_end - 0.6)) continue;   // a membrane already closes it
        open_ends.push({ z: rr(zc, 2), r_mm: rr(r_end, 2), area_mm2: npr(ec[eid] * PX_MM2, 1), at: [rr(ex, 1), rr(ey, 1)] });   // em.sum() is a numpy int
      }
    }
    /* --- contour tree --- */
    if(prev_lab === null){
      for(let i = 1; i <= nl; i++) events.push({ z: rr(zc, 2), type: 'birth', id: i, onFoundation: null });
    } else {
      const pn = prev_nl;
      const ov = new Int32Array((pn + 1) * (nl + 1));
      for(let i = 0; i < NPX; i++) if(lab[i] > 0 && prev_lab[i] > 0) ov[prev_lab[i] * (nl + 1) + lab[i]]++;   // np.add.at(ov, (prev, cur), 1)
      for(let c = 1; c <= nl; c++){
        const par = []; for(let p = 1; p <= pn; p++) if(ov[p * (nl + 1) + c] * PX_MM2 >= MIN_AREA) par.push(p);
        if(!par.length) events.push({ z: rr(zc, 2), type: 'birth', id: c, IN_AIR: true });
        else if(par.length > 1) events.push({ z: rr(zc, 2), type: 'merge', id: c, from: par });
      }
      for(let p = 1; p <= pn; p++){
        const kids = []; for(let c = 1; c <= nl; c++) if(ov[p * (nl + 1) + c] * PX_MM2 >= MIN_AREA) kids.push(c);
        if(!kids.length) events.push({ z: rr(zc, 2), type: 'death', id: p });
        else if(kids.length > 1) events.push({ z: rr(zc, 2), type: 'split', id: p, to: kids });
      }
    }
    prev_lab = lab; prev_nl = nl;
    const dOut = edt(not(m), Hh, W), dIn = edt(m, Hh, W);
    const sdf = new Float64Array(NPX); for(let i = 0; i < NPX; i++) sdf[i] = (dOut[i] - dIn[i]) * res;
    const lay = { k, zBot: rr(zb, 4), zTop: rr(zb + LH, 4), w: rr(w, 3), web, tab, phase, contours: [] };
    if(k === 0){
      [first, found_mask] = build_foundation(LH / 2, w);
      // F15: assert, don't declare. Every layer-0 component has to sit on the foundation.
      const onf = [];
      for(let cid = 1; cid <= nl; cid++){ let s = 0; for(let i = 0; i < NPX; i++) if(found_mask[i] && lab[i] === cid) s++; onf.push(s * PX_MM2 >= MIN_AREA); }
      onf.forEach((ok, i0) => { const i = i0 + 1; for(const e of events) if(e.type === 'birth' && e.id === i && e.z === rr(zc, 2)) e.onFoundation = ok; });
      first.componentsOnFoundation = onf;
    }
    /* the wall and tab are SOLVED here against tip crowding, self-approach and the corner reach */
    const TIP_FLOOR = 2 * args.bead;
    const wof = (s) => W_FLOOR + s * (w - W_FLOOR);
    const tof = (s) => TAB_FLOOR + s * (tab - TAB_FLOOR);
    const offs = (s) => wof(s) / 2 + tof(s);
    function tipgap(q, nr, idx, off){
      const tips = new Array(idx.length);
      for(let t = 0; t < idx.length; t++){ const i = idx[t]; tips[t] = [q[i][0] - nr[i][0] * off, q[i][1] - nr[i][1] * off]; }
      return minNearestOtherDistance(tips);                // cKDTree(tips).query(tips, k=2)[0][:,1].min()
    }
    /** how close the thread comes to itself on one layer, at every lateral offset it uses */
    function railgap(q, nr, cum, L, ww, tt){
      const n = q.length;
      if(n < 12) return 1e9;
      const pts = new Array(4 * n); const arc = new Float64Array(4 * n);
      const o1 = ww / 2.0, o2 = ww / 2.0 + tt;
      for(let i = 0; i < n; i++){
        pts[i] = [q[i][0] + nr[i][0] * o1, q[i][1] + nr[i][1] * o1];
        pts[n + i] = [q[i][0] - nr[i][0] * o1, q[i][1] - nr[i][1] * o1];
        pts[2 * n + i] = [q[i][0] + nr[i][0] * o2, q[i][1] + nr[i][1] * o2];
        pts[3 * n + i] = [q[i][0] - nr[i][0] * o2, q[i][1] - nr[i][1] * o2];
        arc[i] = arc[n + i] = arc[2 * n + i] = arc[3 * n + i] = cum[i];
      }
      const skipmm = ww + 2 * tt + 2.0;
      const kq = Math.min(18, pts.length);
      const { d, j } = knnGrid(pts, kq);                   // cKDTree(pts).query(pts, k=min(18, len(pts)))
      let best = Infinity, any = false;
      for(let i = 0; i < pts.length; i++){
        for(let t = 0; t < kq; t++){
          const jj = j[i * kq + t];
          let da = Math.abs(arc[i] - arc[jj]); da = Math.min(da, L - da);
          if(da >= skipmm){ any = true; const dv = d[i * kq + t]; if(dv < best) best = dv; }
        }
      }
      return any ? best : 1e9;                             // float(np.min(np.where(far, d, np.inf))) if far.any() else 1e9
    }
    let ALLOW = w / 2 + tab;                               // eslint-disable-line no-unused-vars
    const built = []; let reach_cap = 1e9, reachCapNp = false;
    for(const c of contours_of(sdf, m)){
      const { r: q, L, cum } = resample(c); const nr = normals(q);
      const GAP_TARGET = 0.42 * args.maxbridge;
      const need = L / Math.max(GAP_TARGET, 1e-6);
      let Kl = args.K;
      while(Kl < need && Kl < 16 * args.K) Kl *= 2;
      if(prev_pts !== null){
        const step = maxNearestDistance(prev_pts, q);      // cKDTree(prev_pts).query(q)[0].max()
        if(step > 0.55 * (W_FLOOR / 2 + TAB_FLOOR)) Kl = 2 * Kl;
      }
      let [us] = nodes_for(q, cum, L, zc, Kl); K_used.push(Kl);
      if(web === 'diagonal' || web === 'sine' || web === 'eight')
        reach_cap = Math.min(reach_cap, 0.34 * args.maxbridge);   // w + 2*tab = 2*reach <= 0.68*maxBridge
      if(us.length > 1){
        let cap = 0.45 * args.maxbridge;
        if(web === 'diagonal' || web === 'sine' || web === 'eight'){
          const span = 2 * Math.min(reach_cap, wall_nominal(zc) / 2 + tab);
          cap = Math.min(cap, Math.max(2.6, Math.sqrt(Math.max(1.0, libmPow(0.85 * args.maxbridge, 2) - span * span))));   // ** 2 is C pow()
        }
        const out2 = [];
        for(let i2 = 0; i2 < us.length; i2++){
          const u0 = us[i2]; const g = pyMod(us[(i2 + 1) % us.length] - u0, L);
          out2.push(u0);
          if(g > cap){
            const n2 = Math.ceil(g / cap);
            for(let t2 = 1; t2 < n2; t2++) out2.push(pyMod(u0 + g * t2 / n2, L));
          }
        }
        us = [...new Set(out2.map(v => npr(v, 4)))].sort((x, y) => x - y);   // sorted(set(round(v,4) ...)): numpy scalars
      }
      if(us.length > 3){ const [rb, rbNp] = reach_bound(us, curv_at(q, cum, L, us), L, args.bead); if(rb < reach_cap){ reach_cap = rb; reachCapNp = rbNp; } }
      const idx = us.length > 1 ? us.map(u => ssLeft(cum, u, q.length) % q.length) : null;   // np.searchsorted(cum[:-1], us)
      built.push({ q, nr, cum, L, us, Kl, idx });
    }
    /* one scale for the whole layer */
    let s = 1.0, single = false;
    function ok(sv){
      if(offs(sv) > reach_cap) return false;
      let mt = 1e9;
      for(const b of built) if(b.idx !== null){ const v = tipgap(b.q, b.nr, b.idx, offs(sv)); if(v < mt) mt = v; }
      if(mt < TIP_FLOOR) return false;
      const ww = wof(sv), tt = tof(sv);
      let mr = 1e9;
      for(const b of built){ const v = railgap(b.q, b.nr, b.cum, b.L, ww, tt); if(v < mr) mr = v; if(mr < RAIL_MIN) return false; }   // min(...) >= RAIL_MIN
      return mr >= RAIL_MIN;
    }
    if(built.length){
      if(!ok(1.0)){
        let lo = 0.0, hi = 1.0;
        for(let it = 0; it < 16; it++){ const mid = (lo + hi) / 2; if(ok(mid)) lo = mid; else hi = mid; }
        s = lo;
        if(!ok(0.0)){ single = true; s = 0.0; }
      }
    }
    // round DOWN, never to nearest
    w = Math.floor((W_FLOOR + s * (w - W_FLOOR)) * 1000) / 1000; tab = Math.floor((TAB_FLOOR + s * (tab - TAB_FLOOR)) * 1000) / 1000;
    lay.w = w; lay.tab = tab; lay.wScale = rr(s, 3);
    lay.reachCap = reach_cap < 999 ? (reachCapNp ? npr(reach_cap, 3) : rr(reach_cap, 3)) : 999;   // min(reach_cap, 999) is the int 999 when nothing capped it
    if(single) lay.single = true;
    let rg = 1e9;
    for(const b of built){ const v = railgap(b.q, b.nr, b.cum, b.L, w, tab); if(v < rg) rg = v; }
    if(rg < 1e8){
      lay.railGap = rr(rg, 3);
      if(!single) rail_worst.push([rr(zc, 2), rr(rg, 3)]);
    }
    ALLOW = tab + args.bead / 2;                           // WEFT-05: the outer rail lands on the tab of the layer below
    for(const b of built){
      const { q, nr, cum, L, us, Kl, idx } = b;
      const qq = q.concat([q[0]]), nn = nr.concat([nr[0]]);
      const rec = { pts: qq.map(p => [npr(p[0], 3), npr(p[1], 3)]), nrm: nn.map(p => [npr(p[0], 4), npr(p[1], 4)]),   // numpy arrays
        cum: Array.from(cum, v => npr(v, 4)), total: rr(L, 4), nodes: us.map(u => npr(u, 4)), K: Kl };            // total is float(seg.sum())
      if(idx !== null) rec.minTipGap = rr(tipgap(q, nr, idx, w / 2 + tab), 3);
      if(us.length > 1){
        let mg = -Infinity; for(let i = 0; i < us.length; i++){ const g = pyMod(us[(i + 1) % us.length] - us[i], L); if(g > mg) mg = g; }
        rec.maxNodeGap = npr(mg, 3);                          // differences of numpy scalars
      }
      lay.contours.push(rec);
    }
    const tp = lay.contours.filter(c => 'minTipGap' in c).map(c => c.minTipGap);
    if(tp.length){ lay.minTipGap = Math.min(...tp); tip_worst.push([rr(zc, 2), Math.min(...tp)]); }
    if(caps.length && lay.contours.length){ lay.caps = caps; for(const c of caps) caps_all.push([rr(zc, 2), c]); }
    const cur_pts = lay.contours.length ? [].concat(...lay.contours.map(c => c.pts)) : null;   // the ROUNDED points, closing point included
    if(cur_pts !== null){
      if(prev_pts !== null){
        lay.maxStep = rr(maxNearestDistance(prev_pts, cur_pts), 3); lay.allow = rr(ALLOW, 3);
        shifts.push([rr(zc, 2), lay.maxStep, rr(ALLOW, 3)]);
      }
      prev_pts = cur_pts;                                  // F9: a contour-less layer must not erase the support reference
    }
    layers.push(lay);
    cur_mask = nxt_mask;
    if(k % 100 === 0) say(`  layer ${k}/${N} z=${pyFormatFixed(zc, 1)} ${phase.padEnd(10)} contours=${lay.contours.length} w=${pyFormatFixed(w, 1)} K=${K_used.length ? K_used[K_used.length - 1] : 0}`);
  }

  /* trim the empty tail: nothing above the last wall */
  let last = -1; for(let i = 0; i < layers.length; i++) if(layers[i].contours.length) last = i;
  layers.length = last + 1;

  /* ---------------- rate-limit the wall (WEFT-04) ---------------- */
  const wl = layers.map(l => l.w), tl = layers.map(l => l.tab);
  for(const [arr, rate, floor] of [[wl, W_RATE, W_FLOOR], [tl, TAB_RATE, TAB_FLOOR]]){
    for(let i = 1; i < arr.length; i++) arr[i] = Math.min(arr[i], arr[i - 1] + rate);
    for(let i = arr.length - 2; i >= 0; i--) arr[i] = Math.min(arr[i], arr[i + 1] + rate);
    for(let i = 0; i < arr.length; i++) arr[i] = Math.max(floor, Math.floor(arr[i] * 1000) / 1000);
  }
  const wall_steps = [];
  layers.forEach((l, i) => {
    l.wCeil = l.w; l.w = wl[i]; l.tab = tl[i];
    if(i) wall_steps.push([l.zBot, rr(Math.abs(wl[i] - wl[i - 1]) / 2 + Math.abs(tl[i] - tl[i - 1]), 3)]);
  });
  /* the metrics the solve reported were computed at the ceiling; restate them at what is emitted */
  for(const l of layers){
    const off = l.w / 2 + l.tab;
    for(const c of l.contours){
      if(!c.nodes.length || c.nodes.length < 2) continue;
      const q = c.pts.slice(0, -1), nr = c.nrm.slice(0, -1), cum = c.cum.slice(0, -1);   // the ROUNDED values, as written
      const tips = c.nodes.map(u => { const i = searchsortedLeft(cum, u) % q.length; return [q[i][0] - nr[i][0] * off, q[i][1] - nr[i][1] * off]; });
      c.minTipGap = rr(minNearestOtherDistance(tips), 3);
    }
    const tp = l.contours.filter(c => 'minTipGap' in c).map(c => c.minTipGap);
    if(tp.length) l.minTipGap = Math.min(...tp);
  }
  tip_worst = layers.filter(l => 'minTipGap' in l).map(l => [l.zBot, l.minTipGap]);

  /* WEFT-07: the longest contiguous arc of a rail with nothing under it, after the rate limit */
  for(let i = 1; i < layers.length; i++){
    const cur = layers[i], prv = layers[i - 1];
    if(!cur.contours.length || !prv.contours.length) continue;
    const pts_prev = [].concat(...prv.contours.map(c => c.pts.slice(0, -1)));
    const allow_prev = prv.tab + args.bead / 2;
    const extra = Math.abs(cur.w - prv.w) / 2 + Math.abs(cur.tab - prv.tab);
    let worst = 0.0, worstNp = false;
    for(const c of cur.contours){
      const qq = c.pts.slice(0, -1), cum = c.cum.slice(0, -1), Lc = c.total;
      const dd = nearestDistances(pts_prev, qq);           // tree.query(qq)[0]
      const over = new Uint8Array(qq.length); let anyOver = false, allOver = true;
      for(let t = 0; t < qq.length; t++){ over[t] = (dd[t] + extra) > allow_prev ? 1 : 0; if(over[t]) anyOver = true; else allOver = false; }
      if(!anyOver) continue;
      if(allOver){ if(Lc > worst){ worst = Lc; worstNp = false; } continue; }
      const idx = []; for(let t = 0; t < qq.length; t++) if(!over[t]) idx.push(t);   // np.where(~over)[0]
      const gaps = []; for(let t = 0; t < idx.length; t++) gaps.push((t + 1 < idx.length ? idx[t + 1] : idx[0] + qq.length) - idx[t]);
      let j = 0; for(let t = 1; t < gaps.length; t++) if(gaps[t] > gaps[j]) j = t;   // np.argmax: first
      const a0 = cum[idx[j]], a1 = cum[(idx[j] + gaps[j]) % qq.length];
      const arc = pyMod(a1 - a0, Lc); if(arc > worst){ worst = arc; worstNp = true; }   // a0, a1 come from np.array(cum)
    }
    const worstR = worstNp ? npr(worst, 2) : rr(worst, 2);
    cur.overAir_mm = worstR;
    rail_steps.push([cur.zBot, worstR, rr(allow_prev, 3)]);
  }

  /* ---------------- checks that REFUSE ---------------- */
  const bb = [1e9, 1e9, -1e9, -1e9], bbNp = [false, false, false, false];   // which extreme is a numpy scalar
  const eat = (p, isNp) => {
    if(p[0] < bb[0]){ bb[0] = p[0]; bbNp[0] = isNp; } if(p[1] < bb[1]){ bb[1] = p[1]; bbNp[1] = isNp; }   // min(bb, p): p only when strictly smaller
    if(p[0] > bb[2]){ bb[2] = p[0]; bbNp[2] = isNp; } if(p[1] > bb[3]){ bb[3] = p[1]; bbNp[3] = isNp; }
  };
  for(const l of layers){
    for(const c of l.contours) for(const p of c.pts) eat(p, true);
    for(const c of (l.caps || [])) for(const p of c.pts) eat(p, true);
  }
  if(first) for(const pth of first.paths) for(const p of pth) eat(p, false);   // rg.tolist(): Python floats

  const F = pyFloatRepr, F2 = (v) => pyFormatFixed(v, 2), F1 = (v) => pyFormatFixed(v, 1), F3 = (v) => pyFormatFixed(v, 3);
  const firstMaxBy = (arr, key) => { let b = arr[0]; for(const t of arr) if(key(t) > key(b)) b = t; return b; };   // max(arr, key=...): first maximum
  const firstMinBy = (arr, key) => { let b = arr[0]; for(const t of arr) if(key(t) < key(b)) b = t; return b; };
  const maxOf = (a) => { let v = -Infinity; for(const x of a) if(x > v) v = x; return v; };
  const minOf = (a) => { let v = Infinity; for(const x of a) if(x < v) v = x; return v; };
  const violations = [];
  const step_bad = shifts.filter(t => t[1] > Math.max(t[2], args.maxbridge));
  if(step_bad.length) violations.push(`${step_bad.length} layers step further than both the cone and maxBridge (worst ${F2(maxOf(step_bad.map(t => t[1])))} mm at z=${F(firstMaxBy(step_bad, t => t[1])[0])})`);
  const cap_bad = caps_all.filter(([, c]) => c.pitch_mm > args.bead || c.r_mm > 3 * args.maxbridge);
  if(cap_bad.length) violations.push(`${cap_bad.length} cap membranes are not self-supporting (worst pitch ${F2(maxOf(cap_bad.map(([, c]) => c.pitch_mm)))} mm / radius ${F1(maxOf(cap_bad.map(([, c]) => c.r_mm)))} mm at z=${F(cap_bad[0][0])})`);
  const gap_bad = []; for(const l of layers) for(const c of l.contours) if((c.maxNodeGap ?? 0) > 0.75 * args.maxbridge) gap_bad.push([l.zBot, c.maxNodeGap]);
  if(gap_bad.length) violations.push(`${gap_bad.length} contours leave more than maxBridge between weld columns (worst ${F1(maxOf(gap_bad.map(g => g[1])))} mm at z=${F(gap_bad[0][0])})`);
  const move_bad = rail_steps.filter(t => t[1] > args.maxbridge);
  if(move_bad.length) violations.push(`${move_bad.length} layers leave an arc longer than maxBridge with nothing under it (worst ${F1(maxOf(move_bad.map(t => t[1])))} mm at z=${F(firstMaxBy(move_bad, t => t[1])[0])})`);
  const step_bad2 = wall_steps.filter(t => t[1] > args.bead);
  if(step_bad2.length) violations.push(`${step_bad2.length} layers move a chord rail more than one bead sideways (worst ${F2(maxOf(step_bad2.map(t => t[1])))} mm at z=${F(firstMaxBy(step_bad2, t => t[1])[0])})`);
  const rail_bad = rail_worst.filter(t => t[1] < RAIL_MIN - 1e-6);
  if(rail_bad.length) violations.push(`${rail_bad.length} layers let the thread come within ${F2(RAIL_MIN)} mm of itself on one layer (worst ${F3(minOf(rail_bad.map(t => t[1])))} mm at z=${F(firstMinBy(rail_bad, t => t[1])[0])})`);
  const tip_bad = tip_worst.filter(t => t[1] < 2 * args.bead - 0.01);
  if(tip_bad.length) violations.push(`${tip_bad.length} layers crowd rung tips below ${F2(2 * args.bead)} mm (worst ${F3(minOf(tip_bad.map(t => t[1])))} mm at z=${F(firstMinBy(tip_bad, t => t[1])[0])})`);
  const oe = open_ends.filter(o => o.r_mm > 0);
  if(oe.length) violations.push(`${oe.length} layers end material with nothing above it and no closure (worst radius ${F1(maxOf(oe.map(o => o.r_mm)))} mm at z=${F(firstMaxBy(oe, o => o.r_mm).z)})`);
  const air = events.filter(e => e.IN_AIR);
  if(air.length) violations.push(`${air.length} components are born in mid-air (first at z=${F(air[0].z)})`);
  if(first){
    if(first.islands !== 1) violations.push(`first layer is ${first.islands} separate islands — the brims must be joined`);
    if(first.openings < 1) violations.push('first layer is a solid slab — the brims must leave openings between the feet');
    if(!first.componentsOnFoundation.every(x => x)) violations.push('a first-layer component does not sit on the foundation');
  } else violations.push('no foundation was generated');
  const intZero = new Set();
  const rnd = (v, isNp, n) => isNp ? npr(v, n) : rr(v, n);
  const size = [rnd(bb[2] - bb[0] + W_MAX, bbNp[2] || bbNp[0], 1), rnd(bb[3] - bb[1] + W_MAX, bbNp[3] || bbNp[1], 1), layers.length ? rr(maxOf(layers.map(l => l.zTop)), 1) : 0];
  if(!layers.length) intZero.add('summary.size_mm.2');    // round(max(..., default=0), 1) is the int 0
  if(size[0] > args.plate[0] - 16 || size[1] > args.plate[1] - 16)
    violations.push(`${F(size[0])}x${F(size[1])} mm does not fit the ${pyFormatFixed(args.plate[0], 0)}x${pyFormatFixed(args.plate[1], 0)} plate`);

  const cc = []; layers.forEach((l, i) => { if(i === 0 || l.contours.length !== layers[i - 1].contours.length) cc.push([l.zBot, l.contours.length]); });
  const sortedBy = (arr, key) => arr.slice().sort((a, b) => key(a) - key(b));   // sorted(): stable, ascending key
  const maxNodeGapAll = []; for(const l of layers) for(const c of l.contours) if('maxNodeGap' in c) maxNodeGapAll.push(c.maxNodeGap);
  if(!wall_steps.length) intZero.add('summary.wallRate.worst_rail_step_mm');
  if(!maxNodeGapAll.length) intZero.add('summary.nodeDensity.maxNodeGap_mm');
  if(!caps_all.length){ intZero.add('summary.caps.maxRadius_mm'); intZero.add('summary.caps.pitch_mm'); }
  const summary = Object.assign(cfg.head(layers.length), { args: Object.assign({}, args),
    RHO_note: 'per layer: w_nominal(z)/2 + e + bead + 0.3', RHO_max: rr(RHO_MAX, 2),
    contourCounts: cc, events,
    phases: layers.filter((l, i) => i === 0 || l.phase !== layers[i - 1].phase).map(l => [l.zBot, l.phase, l.web, l.tab, l.w]),
    singleThread: { layers: layers.filter(l => l.single).map(l => l.zBot),
      why: 'the neck at that instant is a sliver: one thread on the centreline instead of two rails' },
    railMotion: { rule: 'longest contiguous arc whose distance to the layer below exceeds tab(below) + bead/2 — the bridge the rail actually has to make',
      limit_mm: args.maxbridge, worst: sortedBy(rail_steps, t => -t[1]).slice(0, 6), violations: move_bad.length },
    wallRate: { limit_mm_per_layer: W_RATE, worst_rail_step_mm: wall_steps.length ? maxOf(wall_steps.map(t => t[1])) : 0,
      note: 'a rail moves (dw/2 + dtab) sideways per layer; over a bead it lands on air' },
    nodeDensity: { K: args.K, doubledLayers: K_used.filter(v => v > args.K).length, contours: K_used.length,
      maxNodeGap_mm: maxNodeGapAll.length ? maxOf(maxNodeGapAll) : 0,
      note: 'columns are doubled dyadically until the weld gap is inside maxBridge; the wall then takes what the corners allow' },
    supportCheck: { rule: 'each layer steps within its OWN cone (w(z)/2 + tab(z)) or bridges <= maxBridge',
      maxStep_mm: shifts.length ? maxOf(shifts.map(t => t[1])) : null,
      worst: sortedBy(shifts, t => -t[1]).slice(0, 8),
      bridges: shifts.filter(t => t[2] < t[1] && t[1] <= args.maxbridge).length,
      violations: step_bad },
    tipCrowding: { floor_mm: rr(2 * args.bead, 3), worst: sortedBy(tip_worst, t => t[1]).slice(0, 6), violations: tip_bad.length },
    railSelfApproach: { floor_mm: rr(RAIL_MIN, 3), appFloor_mm: rr(args.bead * 0.95, 3), worst: sortedBy(rail_worst, t => t[1]).slice(0, 6), violations: rail_bad.length },
    openEnds: { rule: 'material with no successor, wider than the wall that would cover it', count: open_ends.length, worst: sortedBy(open_ends, o => -o.r_mm).slice(0, 6) },
    caps: { death: events.filter(e => e.type === 'death-cap').length, hole: caps_all.filter(([, c]) => c.kind === 'hole').length,
      maxRadius_mm: caps_all.length ? maxOf(caps_all.map(([, c]) => c.r_mm)) : 0,
      pitch_mm: caps_all.length ? maxOf(caps_all.map(([, c]) => c.pitch_mm)) : 0, notSelfSupporting: cap_bad.length },
    foundation: Object.fromEntries(Object.entries(first || {}).filter(([k]) => k !== 'paths')),
    wallWidth: { nominal: [args.w0, args.w1], emitted_min: layers.length ? minOf(layers.map(l => l.w)) : null,
      emitted_max: layers.length ? maxOf(layers.map(l => l.w)) : null,
      note: 'clamped per layer by the largest circle that fits in THIS layer mask' },
    bbox_mm: bb.map((v, i) => rnd(v, bbNp[i], 2)), size_mm: size, violations });

  const isInt = makeIsInt(intZero);
  const payload = { summary, foundation: first, layers };
  /** json.dump(payload, f) — the geometry file's exact text (default separators). */
  const toJson = () => pyJsonDumpsTyped(payload, { isInt });
  /** json.dump({'summary':..., 'foundation':..., 'layers':[]}, open(out+'.rejected')) */
  const rejectedJson = () => pyJsonDumpsTyped({ summary, foundation: first, layers: [] }, { isInt });
  /** the two printed lines: the summary without events/args/phases cut at 1900 characters, then PHASES */
  const stdoutText = () => {
    const shown = {}; for(const [k, v] of Object.entries(summary)) if(k !== 'events' && k !== 'args' && k !== 'phases') shown[k] = v;
    const line1 = pyJsonDumpsTyped(shown, { isInt, rootPath: ['summary'] }).slice(0, 1900);
    const line2 = 'PHASES ' + pyTupleListRepr(summary.phases.map(p => [p[0], p[1], p[2]]));
    return line1 + '\n' + line2 + '\n';
  };
  return { payload, summary, first, layers, violations, isInt, toJson, rejectedJson, stdoutText, stderrLines };
}

/* ---------------- argparse twin shared by the two ports ---------------- */
/** defs: [name, type, default, choices?] with type in int | float | float2 (nargs=2) | str | flag.
 *  Returns parseArgs(input): input is argv (array) or a partial object; the result has the
 *  argparse Namespace key order (the order of defs). Type conversion and errors follow argparse. */
export function makeArgParser(defs){
  const conv = (def, v) => {
    const [name, type, , choices] = def;
    if(type === 'int'){
      if(typeof v === 'number' && Number.isInteger(v)) return v;
      if(!/^[+-]?\d+$/.test(String(v).trim())) throw new Error(`argument --${name}: invalid int value: '${v}'`);
      const n = parseInt(v, 10);
      if(choices && !choices.includes(n)) throw new Error(`argument --${name}: invalid choice: ${n} (choose from ${choices.join(', ')})`);
      return n;
    }
    if(type === 'float'){ const f = Number(v); if(typeof v !== 'number' && (String(v).trim() === '' || Number.isNaN(f))) throw new Error(`argument --${name}: invalid float value: '${v}'`); return f; }
    if(type === 'float2'){ if(!Array.isArray(v) || v.length !== 2) throw new Error(`argument --${name}: expected 2 arguments`); return v.map(x => conv([name, 'float'], x)); }
    if(type === 'flag') return !!v;
    return String(v);
  };
  return function parseArgs(input){
    const args = {};
    for(const [name, type, dflt] of defs) args[name] = type === 'float2' && Array.isArray(dflt) ? dflt.slice() : dflt;
    if(Array.isArray(input)){
      for(let i = 0; i < input.length; i++){
        let a = input[i];
        if(!a.startsWith('--')) throw new Error(`unrecognized arguments: ${a}`);
        let val; const eq = a.indexOf('=');
        if(eq >= 0){ val = a.slice(eq + 1); a = a.slice(0, eq); }
        const name = a.slice(2).replace(/-/g, '_');
        const def = defs.find(d => d[0] === name);
        if(!def) throw new Error(`unrecognized arguments: ${a}`);
        if(def[1] === 'flag'){ if(eq >= 0) throw new Error(`argument ${a}: ignored explicit argument '${val}'`); args[name] = true; continue; }
        if(def[1] === 'float2'){
          const v2 = [];
          while(v2.length < 2 && i + 1 < input.length && !(input[i + 1].startsWith('--') && Number.isNaN(Number(input[i + 1])))) v2.push(input[++i]);
          if(v2.length !== 2) throw new Error(`argument ${a}: expected 2 arguments`);
          args[name] = conv(def, v2); continue;
        }
        if(eq < 0){ val = input[++i]; if(val === undefined) throw new Error(`argument ${a}: expected one argument`); }
        args[name] = conv(def, val);
      }
    } else if(input && typeof input === 'object'){
      for(const [k0, v] of Object.entries(input)){
        const k = k0.replace(/-/g, '_');
        const def = defs.find(d => d[0] === k);
        if(!def) throw new Error(`unknown argument ${k0}`);
        if(v !== null && v !== undefined) args[k] = conv(def, v);
      }
    }
    return args;
  };
}

/** The CLI tail both ports share: write the file or the .rejected twin, print what the Python prints. */
export function cliFinish(fs, args, g){
  if(g.violations.length && !args.allow_fail){
    console.error('REFUSED — the geometry did not pass its own checks:');
    for(const v of g.violations) console.error('  * ' + v);
    fs.writeFileSync(args.out + '.rejected', g.rejectedJson());
    process.exit(1);
  }
  fs.writeFileSync(args.out, g.toJson());
  process.stdout.write(g.stdoutText());
}
