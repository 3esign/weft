/* core/weft_geom_ext3.js — third set of additions to the numeric kernel, needed by the ports of
 * climber_geometry.py and vase_geometry.py (core/weft_climber_geometry.mjs, core/weft_vase_geometry.mjs,
 * which share core/weft_discbody_engine.mjs). Those two scripts are numpy/scipy/scikit-image based
 * like suma_geometry.py, so core/weft_geom.js carries most of what they need; what they add is:
 *
 *   - na @ nb on two 2-vectors (curv_at). numpy hands a 1-D float64 dot to OpenBLAS's ddot; the
 *     Haswell kernel this numpy wheel dispatches to accumulates `dot += y[i]*x[i]` with FMA
 *     contraction, so the result is fma(a1, b1, a0*b0), NOT a0*b0 + a1*b1 (measured: 24.5% of random
 *     pairs differ by one ulp, and every difference is explained by that single fma). fmaExact below
 *     is an exact fused multiply-add through BigInt arithmetic.
 *   - cKDTree(pts).query(pts, k=18) (railgap): the k nearest neighbours of every point, with their
 *     indices — knnGrid, exact through a uniform grid with ring expansion.
 *   - cKDTree(prev).query(cur) with the per-point distances kept (the WEFT-07 over-air arc).
 *   - ndimage.label(mask, structure=np.ones((3,3))): 8-connected components (label8).
 *   - distance_transform_edt on ONE labelled component, of which only max() and argmax() are used:
 *     computed on the component's bounding box with a 2-pixel zero margin, which gives bit-identical
 *     distances for every pixel of the component (the nearest zero pixel of an inside pixel is never
 *     further than the margin ring).
 *   - the script's resample(): like weft_geom.resampleClosed but the returned length is
 *     float(seg.sum()) — a PAIRWISE sum of the resampled segments, not the sequential cumsum's last entry.
 *   - json.dump with the default separators (", ", ": "), where the int/float decision sees the full
 *     key path INCLUDING array indices and the value ([zBot, count] pairs mix a float and an int in one
 *     list; a `max(..., default=0)` writes an int 0 where a float usually sits).
 *   - repr() of a list of (float, str, str) tuples, for the script's `print('PHASES', ...)`.
 *   - math.acos as a swappable libm binding (glibc's acos and V8's fdlibm acos disagree in the last
 *     bit for a small fraction of arguments; the parity test measures whether the port is sensitive).
 *   - round(x, n) on a numpy.float64 (npRound): numpy's rint(x*10^n)/10^n, not CPython's decimal
 *     rounding — the scripts round numpy scalars (contour points, cum, node positions, node gaps) and
 *     Python floats side by side, and the two roundings part company at decimal ties.
 *
 * Pure ES module, no dependencies. Nothing here touches the earlier kernel files.
 */
import { hypot, pairwiseSum, npInterp, edt } from './weft_geom.js';
import { pyFloatRepr, pyJsonString } from './weft_geom_ext.js';

/* ------------------------------------------------------------------------------------------ */
/* libm                                                                                        */
/* ------------------------------------------------------------------------------------------ */

export let libmAcos = Math.acos;
/** Swap the acos binding (live ES-module binding). Returns the previous function. */
export function setLibmAcos(fn){ const prev = libmAcos; if(fn) libmAcos = fn; return prev; }

/* ------------------------------------------------------------------------------------------ */
/* numpy's round()                                                                             */
/* ------------------------------------------------------------------------------------------ */

const POW10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];
/** round(x, n) when x is a numpy.float64 scalar (anything that came out of a numpy array, e.g. an
 *  element of cum or a difference of two such). numpy.float64.__round__ is NOT CPython's decimal
 *  rounding: it is PyArray_Round, i.e. rint(x * 10^n) / 10^n in double arithmetic (rint = half to
 *  even on the scaled double). The two differ wherever x*10^n lands within an ulp of a half-integer,
 *  which is exactly what the difference of two 4-decimal node positions rounded to 3 decimals
 *  produces (measured: 2.2% of such differences). Checked against numpy on 200000 random values. */
export function npRound(x, n){
  if(!Number.isFinite(x)) return x;
  const p = POW10[n];
  const y = x * p;
  const f = Math.floor(y), d = y - f;
  let r;
  if(d < 0.5) r = f; else if(d > 0.5) r = f + 1; else r = (f % 2 === 0) ? f : f + 1;
  if(r === 0) r = y < 0 || Object.is(y, -0) ? -0 : 0;      // rint keeps the sign of zero
  return r / p;
}

/* ------------------------------------------------------------------------------------------ */
/* exact fused multiply-add                                                                    */
/* ------------------------------------------------------------------------------------------ */

const _f64 = new Float64Array(1), _u32 = new Uint32Array(_f64.buffer);
/** Decompose a finite double into [sign, mantissa (BigInt), exponent] with x = ±mantissa * 2^exponent. */
function decompose(x){
  _f64[0] = x;
  const lo = _u32[0], hi = _u32[1];                       // little-endian: word 1 holds sign/exponent
  const sign = hi >>> 31;
  const bexp = (hi >>> 20) & 0x7ff;
  const fracHi = hi & 0xfffff;
  let mant = (BigInt(fracHi) << 32n) | BigInt(lo);
  let exp;
  if(bexp === 0){ exp = -1074; }                          // subnormal (or zero)
  else { mant |= 1n << 52n; exp = bexp - 1075; }
  return [sign, mant, exp];
}
/** Nearest double to mant * 2^exp (mant a signed BigInt), ties to even. */
function compose(mant, exp){
  if(mant === 0n) return 0;
  const neg = mant < 0n; let mag = neg ? -mant : mant;
  const bits = mag.toString(2).length;
  let shift = 0;
  if(bits > 53){
    shift = bits - 53;
    const q = mag >> BigInt(shift);
    const rem = mag & ((1n << BigInt(shift)) - 1n);
    const half = 1n << BigInt(shift - 1);
    let r = q;
    if(rem > half || (rem === half && (q & 1n) === 1n)) r = q + 1n;
    mag = r;                                              // 2^53 after a carry is still exact as a double
  }
  let v = Number(mag);
  let e = exp + shift;
  // scale by 2^e in steps that stay inside the normal range
  while(e > 1000){ v *= Math.pow(2, 1000); e -= 1000; }
  while(e < -1000){ v *= Math.pow(2, -1000); e += 1000; }
  v *= Math.pow(2, e);
  return neg ? -v : v;
}
/** fma(a, b, c): a*b + c with a single rounding, exactly (the C fma the OpenBLAS ddot kernel emits).
 *  Finite arguments only; the sign of an exact zero result follows a*b + c. */
export function fmaExact(a, b, c){
  if(!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return a * b + c;
  if(a === 0 || b === 0) return a * b + c;                // an exact zero product: the sum is exact anyway
  const [sa, ma, ea] = decompose(a), [sb, mb, eb] = decompose(b);
  let mp = ma * mb; if(sa !== sb) mp = -mp;
  const ep = ea + eb;
  if(c === 0){ return compose(mp, ep) || (a * b + c); }
  const [sc, mc0, ec] = decompose(c);
  const mc = sc ? -mc0 : mc0;
  const e = Math.min(ep, ec);
  const total = (mp << BigInt(ep - e)) + (mc << BigInt(ec - e));
  if(total === 0n) return a * b + c;                      // exact zero: the sign rule of the sum
  return compose(total, e);
}
/** numpy's `u @ v` for two float64 2-vectors on this platform: fma(u1, v1, u0*v0). */
export function npDot2(u0, u1, v0, v1){ return fmaExact(u1, v1, u0 * v0); }

/* ------------------------------------------------------------------------------------------ */
/* nearest neighbours                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** Uniform grid over the points of A (array of [x, y]) for exact nearest-neighbour searches. */
function buildGrid(A){
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for(const p of A){ if(p[0] < minx) minx = p[0]; if(p[0] > maxx) maxx = p[0]; if(p[1] < miny) miny = p[1]; if(p[1] > maxy) maxy = p[1]; }
  const cell = Math.max(1e-9, Math.sqrt(((maxx - minx + 1e-9) * (maxy - miny + 1e-9)) / Math.max(1, A.length)) * 2);
  const nx = Math.max(1, Math.ceil((maxx - minx) / cell) + 1), ny = Math.max(1, Math.ceil((maxy - miny) / cell) + 1);
  const heads = new Int32Array(nx * ny).fill(-1), next = new Int32Array(A.length);
  for(let i = 0; i < A.length; i++){
    const cx = Math.floor((A[i][0] - minx) / cell), cy = Math.floor((A[i][1] - miny) / cell);
    const k = cy * nx + cx; next[i] = heads[k]; heads[k] = i;
  }
  return { minx, miny, cell, nx, ny, heads, next };
}

/** cKDTree(A).query(B)[0] for every point of B: the exact Euclidean distance to the nearest point of
 *  A, as sqrt(dx*dx + dy*dy) — which is what the tree computes (sum of squared differences, one sqrt
 *  at the end; checked against scipy on 3000 random queries). Returns a Float64Array. */
export function nearestDistances(A, B){
  const out = new Float64Array(B.length);
  if(!A.length){ out.fill(Infinity); return out; }
  const G = buildGrid(A);
  const { minx, miny, cell, nx, ny, heads, next } = G;
  for(let qi = 0; qi < B.length; qi++){
    const q = B[qi];
    const cx = Math.floor((q[0] - minx) / cell), cy = Math.floor((q[1] - miny) / cell);
    let best = Infinity;
    for(let ring = 0; ; ring++){
      const x0 = cx - ring, x1 = cx + ring, y0 = cy - ring, y1 = cy + ring;
      for(let yy = y0; yy <= y1; yy++){
        if(yy < 0 || yy >= ny) continue;
        const edge = (yy === y0 || yy === y1);
        for(let xx = x0; xx <= x1; xx += (edge ? 1 : (x1 - x0 || 1))){
          if(xx < 0 || xx >= nx) continue;
          for(let i = heads[yy * nx + xx]; i !== -1; i = next[i]){
            const dx = A[i][0] - q[0], dy = A[i][1] - q[1]; const d2 = dx * dx + dy * dy; if(d2 < best) best = d2;
          }
          if(!edge && x1 === x0) break;
        }
      }
      const covered = ring * cell;                          // every point closer than this has been seen
      if(best <= covered * covered) break;
      if(x0 < 0 && y0 < 0 && x1 >= nx && y1 >= ny) break;
    }
    out[qi] = Math.sqrt(best);
  }
  return out;
}

/** cKDTree(P).query(P, k) — for every point of P its k nearest points (itself included, distance 0),
 *  ascending by distance. Returns { d: Float64Array(n*k), j: Int32Array(n*k) } like scipy's (d, i)
 *  pair flattened row-major. Exact: the grid rings are expanded until the k-th best distance is
 *  inside the covered radius. Among points at EXACTLY equal distance the lower index is preferred;
 *  scipy's tree order for such ties depends on its splitting and may differ (the values do not). */
export function knnGrid(P, k){
  const n = P.length; k = Math.min(k, n);
  const dOut = new Float64Array(n * k), jOut = new Int32Array(n * k);
  if(!n || !k) return { d: dOut, j: jOut, k };
  const G = buildGrid(P);
  const { minx, miny, cell, nx, ny, heads, next } = G;
  const bd = new Float64Array(k), bj = new Int32Array(k);
  for(let qi = 0; qi < n; qi++){
    const q = P[qi];
    const cx = Math.floor((q[0] - minx) / cell), cy = Math.floor((q[1] - miny) / cell);
    let cnt = 0;                                            // entries in the sorted candidate list
    const consider = (i, d2) => {
      // insert (d2, i) into the sorted list of at most k entries; equal distances keep the lower index first
      if(cnt === k && (d2 > bd[k - 1] || (d2 === bd[k - 1] && i > bj[k - 1]))) return;
      let pos = cnt < k ? cnt : k - 1;
      while(pos > 0 && (bd[pos - 1] > d2 || (bd[pos - 1] === d2 && bj[pos - 1] > i))){ bd[pos] = bd[pos - 1]; bj[pos] = bj[pos - 1]; pos--; }
      bd[pos] = d2; bj[pos] = i;
      if(cnt < k) cnt++;
    };
    for(let ring = 0; ; ring++){
      const x0 = cx - ring, x1 = cx + ring, y0 = cy - ring, y1 = cy + ring;
      for(let yy = y0; yy <= y1; yy++){
        if(yy < 0 || yy >= ny) continue;
        const edge = (yy === y0 || yy === y1);
        for(let xx = x0; xx <= x1; xx += (edge ? 1 : (x1 - x0 || 1))){
          if(xx < 0 || xx >= nx) continue;
          for(let i = heads[yy * nx + xx]; i !== -1; i = next[i]){
            const dx = P[i][0] - q[0], dy = P[i][1] - q[1]; consider(i, dx * dx + dy * dy);
          }
          if(!edge && x1 === x0) break;
        }
      }
      const covered = ring * cell;
      if(cnt === k && bd[k - 1] <= covered * covered) break;
      if(x0 < 0 && y0 < 0 && x1 >= nx && y1 >= ny) break;
    }
    for(let t = 0; t < k; t++){ dOut[qi * k + t] = Math.sqrt(bd[t]); jOut[qi * k + t] = bj[t]; }
  }
  return { d: dOut, j: jOut, k };
}

/* ------------------------------------------------------------------------------------------ */
/* grids                                                                                       */
/* ------------------------------------------------------------------------------------------ */

/** scipy.ndimage.label(mask, structure=np.ones((3,3))): 8-connected components, labels 1..n in
 *  raster order of first appearance. */
export function label8(mask, h, w){
  const N = h * w;
  const parent = new Int32Array(N + 1);
  const prov = new Int32Array(N);
  let np = 0;
  const find = (x) => { while(parent[x] !== x){ parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if(a === b) return; if(a < b) parent[b] = a; else parent[a] = b; };
  for(let r = 0; r < h; r++){
    for(let c = 0; c < w; c++){
      const i = r * w + c;
      if(!mask[i]) continue;
      let lab = 0;
      const cand = [];
      if(c > 0 && mask[i - 1]) cand.push(prov[i - 1]);
      if(r > 0){
        if(mask[i - w]) cand.push(prov[i - w]);
        if(c > 0 && mask[i - w - 1]) cand.push(prov[i - w - 1]);
        if(c < w - 1 && mask[i - w + 1]) cand.push(prov[i - w + 1]);
      }
      if(cand.length){ lab = cand[0]; for(let t = 1; t < cand.length; t++) union(lab, cand[t]); }
      else { np++; parent[np] = np; lab = np; }
      prov[i] = lab;
    }
  }
  const remap = new Int32Array(np + 1);
  const labels = new Int32Array(N);
  let n = 0;
  for(let i = 0; i < N; i++){
    if(!prov[i]) continue;
    const root = find(prov[i]);
    if(!remap[root]) remap[root] = ++n;
    labels[i] = remap[root];
  }
  return { labels, n };
}

/** distance_transform_edt(labels == cid) reduced to what the scripts use of it: the maximum distance
 *  and the raster-first index of that maximum (np.argmax), plus the pixel count. Computed on the
 *  component's bounding box padded by two rows/columns of zeros: for a pixel of the component the
 *  nearest zero pixel is at most as far as the ring around the box (an exit along its own row is
 *  inside the box), and any zero outside the padded box is strictly further, so every distance is the
 *  one the full-grid transform gives. Pixels outside the component are 0 in scipy's result and never
 *  the maximum unless the component is empty, in which case { max: 0, imax: 0, count: 0 }. */
export function edtMaxArg(labels, cid, h, w){
  let r0 = h, r1 = -1, c0 = w, c1 = -1, count = 0;
  for(let r = 0; r < h; r++){
    const base = r * w;
    for(let c = 0; c < w; c++) if(labels[base + c] === cid){ count++; if(r < r0) r0 = r; if(r > r1) r1 = r; if(c < c0) c0 = c; if(c > c1) c1 = c; }
  }
  if(count === 0) return { max: 0, imax: 0, count: 0 };
  // the margin stops at the grid edge: scipy has no background beyond the array, so a component
  // touching the edge must not see phantom zeros there
  const rr0 = Math.max(0, r0 - 2), rr1 = Math.min(h - 1, r1 + 2), cc0 = Math.max(0, c0 - 2), cc1 = Math.min(w - 1, c1 + 2);
  const ch = rr1 - rr0 + 1, cw = cc1 - cc0 + 1;
  const sub = new Uint8Array(ch * cw);
  for(let r = r0; r <= r1; r++){ const base = r * w; for(let c = c0; c <= c1; c++) if(labels[base + c] === cid) sub[(r - rr0) * cw + (c - cc0)] = 1; }
  const d = edt(sub, ch, cw);
  let best = -1, bi = 0;
  for(let r = 0; r < ch; r++) for(let c = 0; c < cw; c++){ const v = d[r * cw + c]; if(v > best){ best = v; bi = (r + rr0) * w + (c + cc0); } }
  return { max: best, imax: bi, count };
}

/** The same for a boolean mask (every non-zero pixel is the component). */
export function edtMaxArgMask(mask, h, w){ return edtMaxArg(mask, 1, h, w); }

/* ------------------------------------------------------------------------------------------ */
/* the scripts' resample()                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** resample(pts, step) as climber_geometry.py / vase_geometry.py write it. Identical to
 *  weft_geom.resampleClosed except for the returned length: those scripts return
 *  float(seg.sum()) — numpy's pairwise sum of the n resampled segment lengths — while cum (the third
 *  return value) is the sequential np.cumsum of the same segments. The two differ in the last bits,
 *  and both are written to the file (total vs cum[-1]). */
export function resampleClosedPairwise(pts, step = 0.7){
  const m = pts.length;
  const q = pts.slice(); q.push(pts[0]);
  const d = new Float64Array(m);
  for(let i = 0; i < m; i++) d[i] = hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]);
  const L0 = pairwiseSum(d);
  const n = Math.max(12, Math.ceil(L0 / step));
  const s = new Float64Array(m + 1); s[0] = 0; let acc = 0.0;
  for(let i = 0; i < m; i++){ acc += d[i]; s[i + 1] = acc; }
  const qx = new Float64Array(m + 1), qy = new Float64Array(m + 1);
  for(let i = 0; i <= m; i++){ qx[i] = q[i][0]; qy[i] = q[i][1]; }
  const stepL = L0 / n;                                     // np.linspace(0, L, n, endpoint=False): i * (L/n)
  const xs = new Float64Array(n), ys = new Float64Array(n);
  for(let i = 0; i < n; i++){ const t = i * stepL; xs[i] = npInterp(t, s, qx); ys[i] = npInterp(t, s, qy); }
  const r = new Array(n);
  for(let i = 0; i < n; i++){
    const ip = (i - 1 + n) % n, inx = (i + 1) % n;
    r[i] = [((xs[ip] + xs[i]) + xs[inx]) / 3.0, ((ys[ip] + ys[i]) + ys[inx]) / 3.0];   // (roll(1) + r) + roll(-1), then /3
  }
  const seg = new Float64Array(n);
  for(let i = 0; i < n; i++){ const j = (i + 1) % n; seg[i] = hypot(r[j][0] - r[i][0], r[j][1] - r[i][1]); }
  const cum = new Float64Array(n + 1); cum[0] = 0.0; acc = 0.0;
  for(let i = 0; i < n; i++){ acc += seg[i]; cum[i + 1] = acc; }
  return { r, L: pairwiseSum(seg), cum };
}

/* ------------------------------------------------------------------------------------------ */
/* Python repr / json                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** repr() of a Python str, the way print() of a list shows it: single quotes unless the string
 *  holds a single quote and no double quote; backslash and control characters escaped; non-ASCII
 *  printable characters kept as they are. */
export function pyStrRepr(s){
  const useDouble = s.includes("'") && !s.includes('"');
  const qch = useDouble ? '"' : "'";
  let out = qch;
  for(const ch of s){
    const c = ch.codePointAt(0);
    if(ch === '\\') out += '\\\\';
    else if(ch === qch) out += '\\' + qch;
    else if(ch === '\n') out += '\\n';
    else if(ch === '\r') out += '\\r';
    else if(ch === '\t') out += '\\t';
    else if(c < 0x20 || c === 0x7f) out += '\\x' + c.toString(16).padStart(2, '0');
    else out += ch;
  }
  return out + qch;
}
/** repr() of a list of tuples of floats / strings / ints — `print('PHASES', [(z, name, web), ...])`.
 *  Numbers are floats unless opts.isInt(index) says otherwise. */
export function pyTupleListRepr(rows, opts = {}){
  const isInt = opts.isInt || (() => false);
  const item = (v, i) => typeof v === 'string' ? pyStrRepr(v) : typeof v === 'number' ? (isInt(i) ? String(v) : pyFloatRepr(v)) : v === null ? 'None' : v === true ? 'True' : v === false ? 'False' : String(v);
  return '[' + rows.map(t => '(' + t.map(item).join(', ') + (t.length === 1 ? ',' : '') + ')').join(', ') + ']';
}

/** json.dumps(obj) with Python's DEFAULT separators (", " and ": ") or an indent, ensure_ascii, and
 *  the int/float decision made by opts.isInt(path, value) where path is the full list of object keys
 *  AND array indices from the root to the number (e.g. ['summary', 'contourCounts', 3, 1]). Strings,
 *  booleans, null, NaN/Infinity and key order as in weft_geom_ext.pyJsonDumps. opts.separators may be
 *  given as [item, key] to override (json.dump(..., separators=(",", ":")) style). */
export function pyJsonDumpsTyped(obj, opts = {}){
  const isInt = opts.isInt || (() => false);
  const indent = opts.indent == null ? null : opts.indent;
  const sep = opts.separators || (indent == null ? [', ', ': '] : [',', ': ']);
  const itemSep = sep[0], keySep = sep[1];
  const pad = (lvl) => indent == null ? '' : '\n' + ' '.repeat(indent * lvl);
  const path = (opts.rootPath || []).slice();
  function enc(v, lvl){
    if(v === null || v === undefined) return 'null';
    if(v === true) return 'true';
    if(v === false) return 'false';
    if(typeof v === 'number'){
      if(Number.isNaN(v)) return 'NaN';
      if(v === Infinity) return 'Infinity';
      if(v === -Infinity) return '-Infinity';
      if(isInt(path, v)) return String(v);
      return pyFloatRepr(v);
    }
    if(typeof v === 'string') return pyJsonString(v);
    if(Array.isArray(v)){
      if(v.length === 0) return '[]';
      const parts = new Array(v.length);
      for(let i = 0; i < v.length; i++){ path.push(i); parts[i] = enc(v[i], lvl + 1); path.pop(); }
      if(indent == null) return '[' + parts.join(itemSep) + ']';
      return '[' + pad(lvl + 1) + parts.join(itemSep + pad(lvl + 1)) + pad(lvl) + ']';
    }
    if(typeof v === 'object'){
      const keys = Object.keys(v);
      if(keys.length === 0) return '{}';
      const parts = keys.map(k => { path.push(k); const s = pyJsonString(k) + keySep + enc(v[k], lvl + 1); path.pop(); return s; });
      if(indent == null) return '{' + parts.join(itemSep) + '}';
      return '{' + pad(lvl + 1) + parts.join(itemSep + pad(lvl + 1)) + pad(lvl) + '}';
    }
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  }
  return enc(obj, 0);
}
