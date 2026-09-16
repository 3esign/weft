/* core/weft_geom.js — the numeric kernel behind the Level-2 geometry generators.
 *
 * Pure ES module, no dependencies. Everything here re-implements a numpy / scipy.ndimage /
 * scikit-image primitive that suma_geometry.py leans on, close enough that the JavaScript port
 * (core/weft_suma_geometry.mjs) reproduces the Python output number for number. Where the library
 * semantics are non-obvious the comment says what the Python does and why the port does the same.
 *
 * Grids are row-major Float64Array / Uint8Array of size h*w, index r*w+c, exactly like a C-ordered
 * numpy array of shape (h, w) — row = y, column = x, as in the Python script.
 */

/* ------------------------------------------------------------------------------------------ */
/* Python / numpy scalar semantics                                                              */
/* ------------------------------------------------------------------------------------------ */

/** numpy.arange(start, stop, step) for floats. numpy computes the length as
 *  ceil((stop-start)/step) and then FILLS the array as start + i*delta with
 *  delta = (start+step) - start (arraytypes.c DOUBLE_fill), so the i-th value is not
 *  start + i*step but start + i*((start+step)-start). Reproduced bit for bit. */
export function npArange(start, stop, step){
  const len = Math.ceil((stop - start) / step);
  const out = new Float64Array(Math.max(0, len));
  if(len <= 0) return out;
  out[0] = start;
  if(len > 1){
    const next = start + step;
    out[1] = next;
    const delta = next - start;
    for(let i = 2; i < len; i++) out[i] = start + i * delta;
  }
  return out;
}

/** numpy's pairwise summation (umath loops_utils.h pairwise_sum) for a contiguous float64 array:
 *  plain loop below 8 elements, 8 accumulators up to 128 elements, recursive halving above.
 *  arr.sum() on a 1-D contiguous array is exactly this, NOT a left-to-right loop, and the
 *  difference is a few ulp — which matters because the resampled contour points derive from the
 *  total length. */
export function pairwiseSum(a, off = 0, n = a.length - off){
  if(n < 8){
    let res = 0.0;
    for(let i = 0; i < n; i++) res += a[off + i];
    return res;
  }
  if(n <= 128){
    const r = [a[off], a[off + 1], a[off + 2], a[off + 3], a[off + 4], a[off + 5], a[off + 6], a[off + 7]];
    let i = 8;
    const lim = n - (n % 8);
    for(; i < lim; i += 8){
      r[0] += a[off + i]; r[1] += a[off + i + 1]; r[2] += a[off + i + 2]; r[3] += a[off + i + 3];
      r[4] += a[off + i + 4]; r[5] += a[off + i + 5]; r[6] += a[off + i + 6]; r[7] += a[off + i + 7];
    }
    let res = ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7]));
    for(; i < n; i++) res += a[off + i];
    return res;
  }
  let n2 = Math.floor(n / 2);
  n2 -= n2 % 8;
  return pairwiseSum(a, off, n2) + pairwiseSum(a, off + n2, n - n2);
}

/** numpy.cumsum (sequential). Returns a Float64Array of the same length. */
export function cumsum(a){
  const out = new Float64Array(a.length);
  let s = 0.0;
  for(let i = 0; i < a.length; i++){ s += a[i]; out[i] = s; }
  return out;
}

/** glibc's hypot(x, y) (sysdeps/ieee754/dbl-64/e_hypot.c, the non-FMA kernel, glibc 2.35+).
 *  numpy.hypot calls the C library, and glibc's result differs from sqrt(x*x+y*y) in roughly one
 *  case in six by one ulp; Math.hypot differs even more often. The kernel below was checked bit
 *  for bit against numpy.hypot on 20000 random pairs. Scaling for huge / tiny magnitudes is
 *  omitted: the generator never leaves the millimetre range. */
export function hypot(x, y){
  x = Math.abs(x); y = Math.abs(y);
  const ax = x < y ? y : x, ay = x < y ? x : y;
  if(ay === 0 || ay <= ax * 5.551115123125783e-17 /* 2^-54 */) return ax + ay;
  let h = Math.sqrt(ax * ax + ay * ay);
  let t1, t2;
  if(h <= 2.0 * ay){
    const delta = h - ay;
    t1 = ax * (2.0 * delta - ax);
    t2 = (delta - 2.0 * (ax - ay)) * delta;
  } else {
    const delta = h - ax;
    t1 = 2.0 * delta * (ax - 2.0 * ay);
    t2 = (4.0 * delta - ay) * ay + delta * delta;
  }
  h -= (t1 + t2) / (2.0 * h);
  return h;
}

/** Python's round(x) with no ndigits: round half to even, returns an integer-valued number.
 *  (CPython: C round() = half away from zero, then the exact-half case is redone via 2*round(x/2).) */
export function pyRound(x){
  let r = x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5);
  if(Math.abs(x - r) === 0.5){
    const h = x / 2.0;
    r = 2.0 * (h >= 0 ? Math.floor(h + 0.5) : -Math.floor(-h + 0.5));
  }
  return r;
}

/** Python's round(x, n) for n > 0: the EXACT binary value is rounded to n decimals, ties to even,
 *  and the decimal is converted back to the nearest double (CPython double_round via dtoa mode 3).
 *  Number.prototype.toFixed rounds the exact value too but sends ties AWAY from zero, so an exact
 *  tie (only possible when x*10^n*2 is an odd integer, e.g. round(0.0625, 3)) is detected from the
 *  full decimal expansion and pushed to the even neighbour. */
export function pyRoundN(x, n){
  if(!Number.isFinite(x)) return x;
  const s = x.toFixed(n);
  // exact-tie test: the exact decimal expansion must end with a lone 5 right after the n-th digit
  const full = x.toFixed(Math.min(100, n + 30));
  const tail = full.slice(full.indexOf('.') + 1 + n);
  if(tail[0] === '5' && /^5(0*)$/.test(tail)){
    // toFixed rounded away from zero; the even neighbour is the one whose last digit is even
    const lastDigit = +s[s.length - 1];
    if(lastDigit % 2 === 1){
      // step one unit in the n-th decimal towards zero
      const towardsZero = (Math.abs(x) - 0.5 * Math.pow(10, -n)).toFixed(n); // the lower candidate's magnitude
      const v = Number(towardsZero);
      return x < 0 ? -v : v;
    }
  }
  const v = Number(s);
  return v === 0 ? 0 : v; // -0 is written as 0 by JSON.stringify anyway; Python writes -0.0, numerically equal
}

/** Python float modulo: result takes the sign of the divisor (CPython float_rem). */
export function pyMod(a, b){
  let m = a % b;
  if(m !== 0){ if((b < 0) !== (m < 0)) m += b; }
  else m = b < 0 ? -0.0 : 0.0;
  return m;
}

/** Python float floor division a // b (CPython float_divmod). */
export function pyFloorDiv(a, b){
  let mod = a % b;
  let div = (a - mod) / b;
  if(mod !== 0){ if((b < 0) !== (mod < 0)){ mod += b; div -= 1.0; } }
  let floordiv;
  if(div !== 0){ floordiv = Math.floor(div); if(div - floordiv > 0.5) floordiv += 1.0; }
  else floordiv = 0.0;                          // copysign(0, a/b) in CPython; the sign never matters here
  return floordiv;
}

/** smoothstep as the script writes it: clamp then t*t*(3-2t). */
export function smoothstep(t){ t = Math.max(0.0, Math.min(1.0, t)); return t * t * (3 - 2 * t); }
export function clamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }

/* ------------------------------------------------------------------------------------------ */
/* Grid utilities                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** Exact Euclidean distance transform of a boolean grid, scipy.ndimage.distance_transform_edt
 *  semantics: for every NON-ZERO (true) pixel, the distance to the nearest ZERO pixel; zero pixels
 *  get 0. Felzenszwalb–Huttenlocher lower-envelope transform: the squared distances are exact
 *  integers, so sqrt of them is bit-identical to scipy's sqrt(sum of squared index differences).
 *  If the grid has no zero pixel at all scipy returns garbage (distances to a phantom pixel); here
 *  every pixel is +Infinity, which the generator never triggers. */
export function edt(mask, h, w){
  const N = h * w;
  const g = new Float64Array(N);         // squared vertical distance to nearest zero in the column
  // pass 1: per column, distance along the column to the nearest zero (two sweeps)
  for(let c = 0; c < w; c++){
    let d = Infinity;
    for(let r = 0; r < h; r++){
      const i = r * w + c;
      if(!mask[i]) d = 0; else if(d !== Infinity) d += 1;
      g[i] = d;
    }
    d = Infinity;
    for(let r = h - 1; r >= 0; r--){
      const i = r * w + c;
      if(!mask[i]) d = 0; else if(d !== Infinity) d += 1;
      if(d < g[i]) g[i] = d;
    }
    for(let r = 0; r < h; r++){ const i = r * w + c; const v = g[i]; g[i] = v === Infinity ? Infinity : v * v; }
  }
  // pass 2: per row, lower envelope of parabolas over the finite columns
  const out = new Float64Array(N);
  const v = new Int32Array(w), z = new Float64Array(w + 1), f = new Float64Array(w);
  for(let r = 0; r < h; r++){
    const base = r * w;
    let k = -1;
    for(let q = 0; q < w; q++){
      const fq = g[base + q];
      f[q] = fq;
      if(fq === Infinity) continue;
      if(k < 0){ k = 0; v[0] = q; z[0] = -Infinity; z[1] = Infinity; continue; }
      let s = ((fq + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while(s <= z[k]){
        k--;
        s = ((fq + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    if(k < 0){ for(let q = 0; q < w; q++) out[base + q] = Infinity; continue; }
    k = 0;
    for(let q = 0; q < w; q++){
      while(z[k + 1] < q) k++;
      const dq = q - v[k];
      out[base + q] = Math.sqrt(dq * dq + f[v[k]]);
    }
  }
  return out;
}

/** Elementwise boolean helpers on Uint8Array grids. */
export function not(mask){ const o = new Uint8Array(mask.length); for(let i = 0; i < mask.length; i++) o[i] = mask[i] ? 0 : 1; return o; }
export function anyOf(mask){ for(let i = 0; i < mask.length; i++) if(mask[i]) return true; return false; }
export function countOf(mask){ let n = 0; for(let i = 0; i < mask.length; i++) if(mask[i]) n++; return n; }
/** edt(mask) <= r as a mask (used for the disc dilation of the closing). */
export function edtLE(mask, h, w, r){ const d = edt(mask, h, w); const o = new Uint8Array(d.length); for(let i = 0; i < d.length; i++) o[i] = d[i] <= r ? 1 : 0; return o; }
/** edt(mask) > r as a mask (used for the disc erosion of the closing). */
export function edtGT(mask, h, w, r){ const d = edt(mask, h, w); const o = new Uint8Array(d.length); for(let i = 0; i < d.length; i++) o[i] = d[i] > r ? 1 : 0; return o; }

/** The script's morphological closing / opening. NOTE: suma_geometry.py does NOT call
 *  scipy.ndimage.binary_closing (whose default structuring element would be the 3x3 cross); it
 *  builds a Euclidean DISC of radius r px from two distance transforms:
 *    dil    = edt(~inside) <= r        (dilate by the disc)
 *    closed = edt(dil)     >  r        (erode by the disc)
 *  and the opening the same way in the other order. These helpers are those exact two lines. */
export function discClosing(mask, h, w, r){ const dil = edtLE(not(mask), h, w, r); return edtGT(dil, h, w, r); }
export function discOpening(mask, h, w, r){ const ero = edtGT(mask, h, w, r); return edtLE(not(ero), h, w, r); }

/** scipy.ndimage.label with the default structure (the 3x3 cross = 4-connectivity in 2D).
 *  Labels are 1..n in order of first appearance in raster (row-major) scan, which is what scipy
 *  produces and what the contour-tree event ids depend on. */
export function label4(mask, h, w){
  const N = h * w;
  const parent = new Int32Array(N + 1);       // union-find over provisional labels (1-based)
  const prov = new Int32Array(N);
  let np = 0;
  const find = (x) => { while(parent[x] !== x){ parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if(a === b) return; if(a < b) parent[b] = a; else parent[a] = b; };
  for(let r = 0; r < h; r++){
    for(let c = 0; c < w; c++){
      const i = r * w + c;
      if(!mask[i]) continue;
      const up = r > 0 && mask[i - w] ? prov[i - w] : 0;
      const left = c > 0 && mask[i - 1] ? prov[i - 1] : 0;
      if(up && left){ prov[i] = up; union(up, left); }
      else if(up) prov[i] = up;
      else if(left) prov[i] = left;
      else { np++; parent[np] = np; prov[i] = np; }
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

/** scipy.ndimage.binary_fill_holes with the default structure: background pixels that are NOT
 *  4-connected to the grid border are holes and get filled. (scipy dilates from a border_value=1
 *  seed inside the complement with the cross structure; that is a 4-connected flood from the edge.) */
export function fillHoles(mask, h, w){
  const N = h * w;
  const reach = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const push = (i) => { if(!mask[i] && !reach[i]){ reach[i] = 1; stack[sp++] = i; } };
  for(let c = 0; c < w; c++){ push(c); push((h - 1) * w + c); }
  for(let r = 0; r < h; r++){ push(r * w); push(r * w + w - 1); }
  while(sp > 0){
    const i = stack[--sp];
    const r = (i / w) | 0, c = i - r * w;
    if(r > 0) push(i - w);
    if(r < h - 1) push(i + w);
    if(c > 0) push(i - 1);
    if(c < w - 1) push(i + 1);
  }
  const out = new Uint8Array(N);
  for(let i = 0; i < N; i++) out[i] = reach[i] ? 0 : 1;
  return out;
}

/** scipy.ndimage.binary_erosion(mask, iterations=n) with the default cross structure and
 *  border_value=0: n successive 4-neighbour erosions, pixels outside the grid counting as background. */
export function erodeCross(mask, h, w, iterations = 1){
  let cur = mask;
  for(let it = 0; it < iterations; it++){
    const out = new Uint8Array(h * w);
    for(let r = 0; r < h; r++){
      for(let c = 0; c < w; c++){
        const i = r * w + c;
        if(!cur[i]) continue;
        if(r === 0 || c === 0 || r === h - 1 || c === w - 1) continue;      // border_value = 0
        if(cur[i - w] && cur[i + w] && cur[i - 1] && cur[i + 1]) out[i] = 1;
      }
    }
    cur = out;
  }
  return cur === mask ? new Uint8Array(mask) : cur;
}

/** numpy.argmax over a grid: index of the FIRST maximum in raster order. */
export function argmax(a){ let bi = 0, bv = a[0]; for(let i = 1; i < a.length; i++) if(a[i] > bv){ bv = a[i]; bi = i; } return bi; }
export function maxOf(a){ let bv = a[0]; for(let i = 1; i < a.length; i++) if(a[i] > bv) bv = a[i]; return bv; }

/* ------------------------------------------------------------------------------------------ */
/* Marching squares — skimage.measure.find_contours                                             */
/* ------------------------------------------------------------------------------------------ */

/** Exact re-implementation of skimage.measure.find_contours(array, level) for a 2-D float64 grid,
 *  defaults fully_connected='low' (vertex_connect_high = false) and positive_orientation='low'
 *  (no reversal). Returns a list of contours, each an array of [row, col] points; a closed contour
 *  repeats its first point at the end, exactly as skimage does. The per-square segment table is
 *  _find_contours_cy.pyx (a corner counts as "high" only when STRICTLY greater than the level, a
 *  corner exactly on the level gives a fraction of 0 and a degenerate zero-length segment which
 *  is dropped), and the assembly is _assemble_contours: segments are linked through dictionaries
 *  keyed on their exact endpoint coordinates, so two segments join only when their floating-point
 *  endpoints are bit-identical, which holds because both squares interpolate the same edge from
 *  the same two values. Contours are returned in order of creation (raster order of their first
 *  segment), the surviving deque keeping the lower index when two merge. */
export function findContours(arr, h, w, level){
  // ---- segments (row, col) tuples in raster order of the 2x2 squares
  const segs = [];               // flat: r0,c0,r1,c1 per segment
  const frac = (from, to) => (to === from) ? 0 : ((level - from) / (to - from));
  for(let r0 = 0; r0 < h - 1; r0++){
    const r1 = r0 + 1;
    for(let c0 = 0; c0 < w - 1; c0++){
      const c1 = c0 + 1;
      const ul = arr[r0 * w + c0], ur = arr[r0 * w + c1], ll = arr[r1 * w + c0], lr = arr[r1 * w + c1];
      let sq = 0;
      if(ul > level) sq += 1;
      if(ur > level) sq += 2;
      if(ll > level) sq += 4;
      if(lr > level) sq += 8;
      if(sq === 0 || sq === 15) continue;
      const topR = r0, topC = c0 + frac(ul, ur);
      const botR = r1, botC = c0 + frac(ll, lr);
      const lefR = r0 + frac(ul, ll), lefC = c0;
      const rigR = r0 + frac(ur, lr), rigC = c1;
      switch(sq){
        case 1: segs.push(topR, topC, lefR, lefC); break;
        case 2: segs.push(rigR, rigC, topR, topC); break;
        case 3: segs.push(rigR, rigC, lefR, lefC); break;
        case 4: segs.push(lefR, lefC, botR, botC); break;
        case 5: segs.push(topR, topC, botR, botC); break;
        case 6: segs.push(rigR, rigC, topR, topC, lefR, lefC, botR, botC); break;   // 'low' connected
        case 7: segs.push(rigR, rigC, botR, botC); break;
        case 8: segs.push(botR, botC, rigR, rigC); break;
        case 9: segs.push(topR, topC, lefR, lefC, botR, botC, rigR, rigC); break;   // 'low' connected
        case 10: segs.push(botR, botC, topR, topC); break;
        case 11: segs.push(botR, botC, lefR, lefC); break;
        case 12: segs.push(lefR, lefC, rigR, rigC); break;
        case 13: segs.push(topR, topC, rigR, rigC); break;
        case 14: segs.push(lefR, lefC, topR, topC); break;
      }
    }
  }
  // ---- assembly. A contour is a deque of points; starts/ends map an endpoint key to it.
  // Keys are the JS number->string of both coordinates: Python compares the tuples (int, float)
  // by value, and integer-valued floats hash like ints, which String() also guarantees.
  const contours = new Map();     // index -> deque
  const starts = new Map(), ends = new Map();
  let current = 0;
  const key = (r, c) => r + ',' + c;
  for(let s = 0; s < segs.length; s += 4){
    const fr = segs[s], fc = segs[s + 1], tr = segs[s + 2], tc = segs[s + 3];
    if(fr === tr && fc === tc) continue;                       // degenerate segment
    const fk = key(fr, fc), tk = key(tr, tc);
    const tail = starts.get(tk); if(tail) starts.delete(tk);
    const head = ends.get(fk); if(head) ends.delete(fk);
    if(tail && head){
      if(tail.dq === head.dq){
        head.dq.pushBack(tr, tc);                                 // close the loop
      } else if(tail.num > head.num){
        head.dq.extendBack(tail.dq);
        contours.delete(tail.num);
        starts.set(key(head.dq.frontR(), head.dq.frontC()), head);
        ends.set(key(head.dq.backR(), head.dq.backC()), head);
      } else {
        const headFrontKey = key(head.dq.frontR(), head.dq.frontC());
        tail.dq.extendFront(head.dq);
        starts.delete(headFrontKey);                              // head[0] can be == to_point
        contours.delete(head.num);
        starts.set(key(tail.dq.frontR(), tail.dq.frontC()), tail);
        ends.set(key(tail.dq.backR(), tail.dq.backC()), tail);
      }
    } else if(!tail && !head){
      const dq = new Deque();
      dq.pushBack(fr, fc); dq.pushBack(tr, tc);
      const ent = { dq, num: current };
      contours.set(current, ent);
      starts.set(fk, ent); ends.set(tk, ent);
      current++;
    } else if(!head){
      tail.dq.pushFront(fr, fc);
      starts.set(fk, tail);
    } else {
      head.dq.pushBack(tr, tc);
      ends.set(tk, head);
    }
  }
  const keys = [...contours.keys()].sort((a, b) => a - b);
  return keys.map(k => contours.get(k).dq.toArray());
}

/** A double-ended queue of (r, c) points with amortised O(1) push at both ends. */
class Deque {
  constructor(){ this.buf = new Float64Array(128); this.head = 32; this.tail = 32; }   // [head, tail) in units of points
  get length(){ return (this.tail - this.head); }
  _grow(){
    // re-centre the points in a buffer of at least 4x their number, so that both ends have room
    // (a typed-array write past the end is silently dropped — this must never run out of space)
    const n = this.length, cap = Math.max(64, 4 * n);
    const nb = new Float64Array(cap * 2);
    const nh = Math.floor((cap - n) / 2);
    nb.set(this.buf.subarray(this.head * 2, this.tail * 2), nh * 2);
    this.buf = nb; this.head = nh; this.tail = nh + n;
  }
  pushBack(r, c){ if(this.tail * 2 + 2 > this.buf.length) this._grow(); this.buf[this.tail * 2] = r; this.buf[this.tail * 2 + 1] = c; this.tail++; }
  pushFront(r, c){ if(this.head === 0) this._grow(); this.head--; this.buf[this.head * 2] = r; this.buf[this.head * 2 + 1] = c; }
  frontR(){ return this.buf[this.head * 2]; } frontC(){ return this.buf[this.head * 2 + 1]; }
  backR(){ return this.buf[this.tail * 2 - 2]; } backC(){ return this.buf[this.tail * 2 - 1]; }
  extendBack(o){ for(let i = o.head; i < o.tail; i++) this.pushBack(o.buf[i * 2], o.buf[i * 2 + 1]); }
  extendFront(o){ for(let i = o.tail - 1; i >= o.head; i--) this.pushFront(o.buf[i * 2], o.buf[i * 2 + 1]); }  // deque.extendleft(reversed(head))
  toArray(){ const out = new Array(this.length); for(let i = this.head, j = 0; i < this.tail; i++, j++) out[j] = [this.buf[i * 2], this.buf[i * 2 + 1]]; return out; }
}

/* ------------------------------------------------------------------------------------------ */
/* Polylines                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/** numpy.interp(x, xp, fp) for one x, xp ascending (duplicates allowed). numpy finds the largest j
 *  with xp[j] <= x by bisection, returns fp[j] when xp[j] == x (so a zero-length segment never
 *  divides by zero) and otherwise slope*(x-xp[j]) + fp[j] with slope = (fp[j+1]-fp[j])/(xp[j+1]-xp[j]). */
export function npInterp(x, xp, fp){
  const n = xp.length;
  if(x > xp[n - 1]) return fp[n - 1];
  if(x < xp[0]) return fp[0];
  let lo = 0, hi = n;
  while(lo < hi){ const mid = lo + ((hi - lo) >> 1); if(x >= xp[mid]) lo = mid + 1; else hi = mid; }
  const j = lo - 1;
  if(j === n - 1) return fp[j];
  if(xp[j] === x) return fp[j];
  const slope = (fp[j + 1] - fp[j]) / (xp[j + 1] - xp[j]);
  let v = slope * (x - xp[j]) + fp[j];
  if(!Number.isFinite(v)){ v = slope * (x - xp[j + 1]) + fp[j + 1]; if(!Number.isFinite(v) && fp[j] === fp[j + 1]) v = fp[j]; }
  return v;
}

/** Signed area of a closed polygon (shoelace), summed the numpy way (pairwise) — only the sign
 *  and a coarse threshold are used, but the summation order is kept anyway. */
export function polygonArea(pts){
  const n = pts.length;
  const terms = new Float64Array(n);
  for(let i = 0; i < n; i++){ const j = (i + 1) % n; terms[i] = pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
  return 0.5 * pairwiseSum(terms);
}

/** Length of an open polyline, summed pairwise like numpy (the script's _plen). */
export function polylineLength(pts){
  const n = pts.length;
  if(n < 2) return 0.0;
  const d = new Float64Array(n - 1);
  for(let i = 0; i < n - 1; i++) d[i] = hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return pairwiseSum(d);
}

/** The script's resample(pts, step): a closed polyline -> n = max(12, ceil(L/step)) evenly spaced
 *  points by arc length (numpy.interp over the cumulative length, the closing segment appended),
 *  then a circular 3-point moving average. Returns { r: [[x,y],...], L, cum } with cum of n+1
 *  entries whose last is the closed length. The numpy quirks reproduced: L is a pairwise sum, the
 *  linspace parameter is i*(L/n), the moving average is (prev + cur) + next then /3. */
export function resampleClosed(pts, step = 0.7){
  const m = pts.length;
  const q = pts.slice(); q.push(pts[0]);                      // np.vstack([p, p[:1]])
  const d = new Float64Array(m);
  for(let i = 0; i < m; i++) d[i] = hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]);
  const L = pairwiseSum(d);
  const n = Math.max(12, Math.ceil(L / step));
  const s = new Float64Array(m + 1); s[0] = 0; let acc = 0.0;
  for(let i = 0; i < m; i++){ acc += d[i]; s[i + 1] = acc; }
  const qx = new Float64Array(m + 1), qy = new Float64Array(m + 1);
  for(let i = 0; i <= m; i++){ qx[i] = q[i][0]; qy[i] = q[i][1]; }
  const stepL = L / n;
  const xs = new Float64Array(n), ys = new Float64Array(n);
  for(let i = 0; i < n; i++){ const t = i * stepL; xs[i] = npInterp(t, s, qx); ys[i] = npInterp(t, s, qy); }
  const r = new Array(n);
  for(let i = 0; i < n; i++){
    const ip = (i - 1 + n) % n, inx = (i + 1) % n;
    r[i] = [((xs[ip] + xs[i]) + xs[inx]) / 3.0, ((ys[ip] + ys[i]) + ys[inx]) / 3.0];
  }
  const cum = new Float64Array(n + 1); cum[0] = 0.0; acc = 0.0;
  for(let i = 0; i < n; i++){ const j = (i + 1) % n; acc += hypot(r[j][0] - r[i][0], r[j][1] - r[i][1]); cum[i + 1] = acc; }
  return { r, L: cum[n], cum };
}

/** The script's outward_normals(q): right-hand normal of the central-difference tangent of a
 *  CCW curve, zero tangents replaced by length 1. */
export function outwardNormals(q){
  const n = q.length, out = new Array(n);
  for(let i = 0; i < n; i++){
    const nx = q[(i + 1) % n], pv = q[(i - 1 + n) % n];
    const tx = nx[0] - pv[0], ty = nx[1] - pv[1];
    let l = hypot(tx, ty); if(l === 0) l = 1;
    out[i] = [ty / l, -tx / l];
  }
  return out;
}

/** numpy.searchsorted(a, v) (side='left'): first index with a[idx] >= v. */
export function searchsortedLeft(a, v){
  let lo = 0, hi = a.length;
  while(lo < hi){ const mid = lo + ((hi - lo) >> 1); if(a[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

/** Nearest-neighbour queries. cKDTree returns exact Euclidean nearest distances; a brute-force
 *  scan on squared distances is the same number after one sqrt (the KD-tree also compares squared
 *  distances internally). Ties resolve to the lowest index, as scipy's tree does for its query. */
export function nearestDistance(pts, x, y){
  let best = Infinity;
  for(let i = 0; i < pts.length; i++){ const dx = pts[i][0] - x, dy = pts[i][1] - y; const d2 = dx * dx + dy * dy; if(d2 < best) best = d2; }
  return Math.sqrt(best);
}
/** max over B of the distance to the nearest point of A (cKDTree(A).query(B)[0].max()). Uses a
 *  uniform grid hash over A so 30k x 1.5k queries stay cheap; exact because every cell within
 *  the current best radius is visited. */
export function maxNearestDistance(A, B){
  if(!A.length || !B.length) return NaN;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for(const p of A){ if(p[0] < minx) minx = p[0]; if(p[0] > maxx) maxx = p[0]; if(p[1] < miny) miny = p[1]; if(p[1] > maxy) maxy = p[1]; }
  const cell = Math.max(1e-9, Math.sqrt(((maxx - minx + 1e-9) * (maxy - miny + 1e-9)) / Math.max(1, A.length)) * 2);
  const nx = Math.max(1, Math.ceil((maxx - minx) / cell) + 1), ny = Math.max(1, Math.ceil((maxy - miny) / cell) + 1);
  const heads = new Int32Array(nx * ny).fill(-1), next = new Int32Array(A.length);
  for(let i = 0; i < A.length; i++){
    const cx = Math.floor((A[i][0] - minx) / cell), cy = Math.floor((A[i][1] - miny) / cell);
    const k = cy * nx + cx; next[i] = heads[k]; heads[k] = i;
  }
  let worst = 0.0;
  for(const q of B){
    const cx = Math.floor((q[0] - minx) / cell), cy = Math.floor((q[1] - miny) / cell);
    let best = Infinity;
    for(let ring = 0; ; ring++){
      // all cells whose Chebyshev index distance is `ring`
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
      // every point closer than (ring)*cell has been seen once ring covers that radius
      const covered = ring * cell;
      if(best <= covered * covered) break;
      if(x0 < 0 && y0 < 0 && x1 >= nx && y1 >= ny) break;
    }
    const d = Math.sqrt(best);
    if(d > worst) worst = d;
  }
  return worst;
}
/** For every point the distance to its nearest OTHER point (cKDTree(P).query(P, k=2)[0][:,1]);
 *  returns the minimum over the set. Duplicated points give 0, as the tree does. */
export function minNearestOtherDistance(P){
  let best = Infinity;
  for(let i = 0; i < P.length; i++){
    let bi = Infinity;
    for(let j = 0; j < P.length; j++){ if(j === i) continue; const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1]; const d2 = dx * dx + dy * dy; if(d2 < bi) bi = d2; }
    if(bi < best) best = bi;
  }
  return Math.sqrt(best);
}
