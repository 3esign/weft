/* WEFT — POLJE: an arbitrary VOLUME printed as pure weft (2026-10-02).

   pure-weft/v1 (core/weft_solid_geometry.mjs) removed the wall, but it could only describe bodies that
   are a single radial star r(theta) around one centre: one island per layer, convex enough to scan.
   Semir asked for the general case — "svaka geometrijska volumetrija bi trebalo da moze da se odstampa
   u weftu" — and for a chair that begins as FOUR separate circular feet, merges into one seat and then
   continues upward as a back. Four islands that become one is exactly what a radial star cannot say.

   So the body is now a FIELD: f(x,y,z) < 0 is material. Every layer is the level set f(.,.,z) = 0,
   extracted by marching squares and split into however many islands that layer happens to have.
   Nothing below cares how f is written — a chair, a lattice, a scan, a boolean of primitives.

   What a layer is (pure-weft/v2):

     RIM   — two interlacing waves, not an offset band. Pass A rides the boundary at depth
             m + A*(1+sin(N*2pi*t + phi)); pass B rides at m + gap + A*(1-sin(...)), i.e. in
             ANTIPHASE. Where A is out, B is in; they close on each other once per lobe and open to
             gap + 2A between. Those openings are real holes through the shell — the outside is as
             porous as the inside, which is what "porose on all sides" has to mean. phi advances with
             the layer, so the holes spiral and no two layers stack their gaps.
     CORE  — one open interior pattern (lines / sine / spiral / hilbert / density field) laid on the
             boundary that pass B actually traces (the wavy curve, not a constant offset), so a chord
             ends ON rim material instead of in one of the holes.
     ONE LINE — rim and core are not two paths any more. The rim hands over to the core along pass B
             and the layer leaves the nozzle as a SINGLE continuous line per island: "wall" pattern
             and "infill" pattern, one thread. Travel exists only between islands, where it must.

   Support is MEASURED, not estimated. Every point of layer k is looked up against a spatial hash of
   every point of layer k-1: the generator reports the worst unsupported RUN (the real free span) and
   refuses before the gate ever sees the G-code.

   usage: node core/weft_field_geometry.mjs --variant stolica --machine a1 --out FILE
            [--svg FILE] [--name NAME] [--H mm] [--allow-assumed-bead] [--report]                      */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TAU = 2 * Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const rr = (v, n = 3) => { const f = 10 ** n; const x = Math.round(v * f) / f; return Object.is(x, -0) ? 0 : x; };
const hyp = Math.hypot;

export const PROCESS = 'pure-weft/v2';
export const CHORD_STEP = 0.5;                 // every vertex must be able to land on support
export const CELL = 0.6;                       // marching-squares cell (topology only; points are Newton-projected)

/* ===================== signed distance primitives ===================== */
export function sdRoundRect2(x, y, hx, hy, rad){
  const qx = Math.abs(x) - (hx - rad), qy = Math.abs(y) - (hy - rad);
  return hyp(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}
export function sdRoundBox(x, y, z, c, h, rad){
  const qx = Math.abs(x - c[0]) - (h[0] - rad), qy = Math.abs(y - c[1]) - (h[1] - rad), qz = Math.abs(z - c[2]) - (h[2] - rad);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return hyp(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - rad;
}
export function smin(a, b, k){                        // polynomial smooth minimum — the merge
  if(k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}

/* ===================== field helpers ===================== */
function gradAt(F, x, y, z, e = 0.05){
  return [(F(x + e, y, z) - F(x - e, y, z)) / (2 * e), (F(x, y + e, z) - F(x, y - e, z)) / (2 * e)];
}
/** in-plane signed distance estimate: f / |grad f| (first order; exact for a true SDF) */
export function sdist(F, x, y, z){
  const g = gradAt(F, x, y, z), n = hyp(g[0], g[1]);
  return n > 1e-9 ? F(x, y, z) / n : F(x, y, z);
}
/** Move a point to where the in-plane signed distance equals `target` (negative = inside).
    The walk is INCREMENTAL and remembers the deepest point it actually reached: where the body is
    thinner than the target there is no such level set, and a plain Newton step would walk straight
    out of the body and come back as a path 100 mm away (measured 2026-10-02, chair legs). Asking
    too deep now lands on the medial axis instead, which is where the thread belongs anyway. */
function toDepth(F, z, p, target){
  let x = p[0], y = p[1];
  let bx = x, by = y, bs = sdist(F, x, y, z);
  const steps = Math.max(2, Math.ceil(Math.abs(target) / 0.4));
  for(let i = 1; i <= steps; i++){
    const want = target * i / steps;
    const g = gradAt(F, x, y, z), n = hyp(g[0], g[1]);
    if(!(n > 1e-9)) break;
    const err = want - F(x, y, z) / n;
    const nx = x + err * g[0] / n, ny = y + err * g[1] / n;
    const s = sdist(F, nx, ny, z);
    if(s > want + 0.45) break;                       // the body is thinner than this: stop at the deepest
    x = nx; y = ny;
    if(s < bs){ bs = s; bx = x; by = y; }
  }
  return sdist(F, x, y, z) <= 0.05 ? [x, y] : [bx, by];
}

/* ===================== marching squares: the layer's islands ===================== */
/* Directed so material (f<0) is on the LEFT: outer loops come out counter-clockwise, holes clockwise.
   Corners c0..c3 = (x0,y0),(x1,y0),(x1,y1),(x0,y1); edges E0 bottom, E1 right, E2 top, E3 left.
   The two saddles are resolved with the cell-centre value, never guessed. */
const MS_TABLE = {
  1: [[0, 3]], 2: [[1, 0]], 3: [[1, 3]], 4: [[2, 1]], 6: [[2, 0]], 7: [[2, 3]],
  8: [[3, 2]], 9: [[0, 2]], 11: [[1, 2]], 12: [[3, 1]], 13: [[0, 1]], 14: [[3, 0]],
};
export function contoursAt(F, z, bbox, cell = CELL){
  const [bx0, by0, bx1, by1] = bbox;
  const nx = Math.ceil((bx1 - bx0) / cell), ny = Math.ceil((by1 - by0) / cell);
  const gx = i => bx0 + i * cell, gy = j => by0 + j * cell;
  const val = new Float64Array((nx + 1) * (ny + 1));
  for(let j = 0; j <= ny; j++) for(let i = 0; i <= nx; i++) val[j * (nx + 1) + i] = F(gx(i), gy(j), z);
  const V = (i, j) => val[j * (nx + 1) + i];
  const pt = new Map(), next = new Map();
  const edgeKey = (i, j, e) => e === 0 ? `h${i},${j}` : e === 1 ? `v${i + 1},${j}` : e === 2 ? `h${i},${j + 1}` : `v${i},${j}`;
  const edgePt = (i, j, e) => {
    if(e === 0){ const a = V(i, j), b = V(i + 1, j); return [gx(i) + cell * a / (a - b), gy(j)]; }
    if(e === 1){ const a = V(i + 1, j), b = V(i + 1, j + 1); return [gx(i + 1), gy(j) + cell * a / (a - b)]; }
    if(e === 2){ const a = V(i, j + 1), b = V(i + 1, j + 1); return [gx(i) + cell * a / (a - b), gy(j + 1)]; }
    const a = V(i, j), b = V(i, j + 1); return [gx(i), gy(j) + cell * a / (a - b)];
  };
  for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++){
    const v0 = V(i, j), v1 = V(i + 1, j), v2 = V(i + 1, j + 1), v3 = V(i, j + 1);
    const b = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0);
    if(b === 0 || b === 15) continue;
    let segs = MS_TABLE[b];
    if(b === 5 || b === 10){
      const ctr = (v0 + v1 + v2 + v3) / 4;
      if(b === 5) segs = ctr < 0 ? [[0, 1], [2, 3]] : [[0, 3], [2, 1]];
      else        segs = ctr < 0 ? [[1, 2], [3, 0]] : [[1, 0], [3, 2]];
    }
    for(const [ea, eb] of segs){
      const ka = edgeKey(i, j, ea), kb = edgeKey(i, j, eb);
      if(!pt.has(ka)) pt.set(ka, edgePt(i, j, ea));
      if(!pt.has(kb)) pt.set(kb, edgePt(i, j, eb));
      next.set(ka, kb);
    }
  }
  const seen = new Set(), loops = [];
  for(const start of next.keys()){
    if(seen.has(start)) continue;
    const ring = []; let k = start, guard = 0, closed = false;
    while(k != null && guard++ < next.size + 4){
      if(seen.has(k)){ closed = (k === start); break; }
      seen.add(k); ring.push(pt.get(k)); k = next.get(k);
    }
    if(closed && ring.length >= 8) loops.push(ring);
  }
  return loops;
}

/* ===================== loop utilities ===================== */
export function signedArea(pts){
  let a = 0; for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
function resampleClosed(pts, step){
  const cum = [0];
  for(let i = 1; i <= pts.length; i++){ const a = pts[i - 1], b = pts[i % pts.length]; cum.push(cum[i - 1] + hyp(b[0] - a[0], b[1] - a[1])); }
  const total = cum[pts.length];
  const n = Math.max(16, Math.round(total / step)), out = [];
  let j = 0;
  for(let k = 0; k < n; k++){
    const t = total * k / n;
    while(j < pts.length - 1 && cum[j + 1] < t) j++;
    const seg = cum[j + 1] - cum[j], f = seg > 1e-12 ? (t - cum[j]) / seg : 0;
    const a = pts[j], b = pts[(j + 1) % pts.length];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}
function resampleOpen(pts, step){
  const out = [pts[0]];
  for(let i = 1; i < pts.length; i++){
    const a = out[out.length - 1], b = pts[i], d = hyp(b[0] - a[0], b[1] - a[1]);
    if(d < 1e-9) continue;
    const n = Math.max(1, Math.ceil(d / step));
    for(let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  return out;
}
/** a closed polygon with arc-length tables and inward normals */
function makeLoop(pts){
  const n = pts.length, cum = [0];
  for(let i = 0; i < n; i++){ const a = pts[i], b = pts[(i + 1) % n]; cum.push(cum[i] + hyp(b[0] - a[0], b[1] - a[1])); }
  const ccw = signedArea(pts) > 0, nrmIn = [];
  for(let i = 0; i < n; i++){
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1], d = hyp(tx, ty) || 1;
    nrmIn.push(ccw ? [-ty / d, tx / d] : [ty / d, -tx / d]);
  }
  let cx = 0, cy = 0; for(const p of pts){ cx += p[0]; cy += p[1]; }
  return { pts, n, cum, total: cum[n], nrmIn, cx: cx / n, cy: cy / n, area: Math.abs(signedArea(pts)) };
}
const walkAt = (L, u) => {
  const P = L.total; u = ((u % P) + P) % P;
  let i = 0; while(i < L.n - 1 && L.cum[i + 1] < u) i++;
  const a = L.pts[i], b = L.pts[(i + 1) % L.n], t = (u - L.cum[i]) / (L.cum[i + 1] - L.cum[i] || 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};
function hop(L, u0, u1, step = CHORD_STEP){
  const P = L.total; let d = ((u1 - u0) % P + P) % P; if(d > P / 2) d -= P;
  const n = Math.max(1, Math.ceil(Math.abs(d) / step)), out = [];
  for(let j = 1; j <= n; j++) out.push(walkAt(L, u0 + d * j / n));
  return out;
}
const nearestU = (L, p) => {
  let best = 0, bd = Infinity;
  for(let i = 0; i < L.n; i++){ const d = hyp(L.pts[i][0] - p[0], L.pts[i][1] - p[1]); if(d < bd){ bd = d; best = i; } }
  return L.cum[best];
};
const minRadius = (L) => { let d = 1e9; for(const p of L.pts) d = Math.min(d, hyp(p[0] - L.cx, p[1] - L.cy)); return d; };
const maxRadius = (L) => { let d = 0; for(const p of L.pts) d = Math.max(d, hyp(p[0] - L.cx, p[1] - L.cy)); return d; };
/* How deep is the section at its THICKEST? A concentric schedule truncated to minRadius (the distance
   from the centroid to the nearest boundary point) stops short wherever the section is fatter than
   that, and leaves a void the next layer's chords cross with nothing underneath — measured 11.2 mm
   at z 39.36, on two merging legs whose waist is 5.6 mm and whose lobes are 7.8 mm deep. */
function maxInradius(F, z, L, step = 0.8){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const q of L.pts){ if(q[0] < x0) x0 = q[0]; if(q[0] > x1) x1 = q[0]; if(q[1] < y0) y0 = q[1]; if(q[1] > y1) y1 = q[1]; }
  let best = 0;
  for(let y = y0; y <= y1; y += step) for(let x = x0; x <= x1; x += step){
    if(!pointInPoly(L.pts, [x, y])) continue;
    const d = -sdist(F, x, y, z);
    if(d > best) best = d;
  }
  return best;
}
function pointInPoly(pts, p){
  let inside = false;
  for(let i = 0, j = pts.length - 1; i < pts.length; j = i++){
    const a = pts[i], b = pts[j];
    if((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** true when the section has a neck narrower than 2*depth, i.e. an inward offset would fold on itself */
function ringCollapses(L, depth){
  const need = 2 * depth + 0.4, cell = need, H = new Map();
  for(let i = 0; i < L.n; i++){
    const k = `${Math.floor(L.pts[i][0] / cell)},${Math.floor(L.pts[i][1] / cell)}`;
    let a = H.get(k); if(!a){ a = []; H.set(k, a); } a.push(i);
  }
  const far = Math.max(4 * depth, 3.0);
  for(let i = 0; i < L.n; i++){
    const ci = Math.floor(L.pts[i][0] / cell), cj = Math.floor(L.pts[i][1] / cell);
    for(let a = ci - 1; a <= ci + 1; a++) for(let b = cj - 1; b <= cj + 1; b++){
      const bucket = H.get(`${a},${b}`); if(!bucket) continue;
      for(const j of bucket){
        let arc = Math.abs(L.cum[i] - L.cum[j]); arc = Math.min(arc, L.total - arc);
        if(arc < far) continue;
        if(hyp(L.pts[i][0] - L.pts[j][0], L.pts[i][1] - L.pts[j][1]) < need) return true;
      }
    }
  }
  return false;
}

/* ===================== the rim: two interlacing waves ===================== */
/* depthA(t) = m + A*(1 + sin(N*2pi*t + phi)); depthB(t) = m + gap + A*(1 - sin(N*2pi*t + phi)).
   N is an integer so the wave closes on itself at the seam; phi advances per layer so the openings
   between the two passes spiral instead of stacking. Pass B — the deeper, wavy one — is handed back
   as the CORE BOUNDARY, so a core chord always ends on rim material and never in one of the holes. */
function rimWeave(F, z, loop, spec){
  const { m, amp, lobes, phase, gap } = spec;
  const M = Math.max(64, Math.round(loop.total / CHORD_STEP));
  const dA = t => -(m + amp * (1 + Math.sin(TAU * lobes * t + phase)));
  const dB = t => -(m + gap + amp * (1 - Math.sin(TAU * lobes * t + phase)));
  const A = [], B = [], ring = [];
  for(let i = 0; i <= M; i++){ const t = i / M; A.push(toDepth(F, z, walkAt(loop, loop.total * t), dA(t))); }
  for(let i = 0; i <= M; i++){ const t = 1 - i / M; B.push(toDepth(F, z, walkAt(loop, loop.total * t), dB(t))); }
  for(let i = 0; i < M; i++){ const t = i / M; ring.push(toDepth(F, z, walkAt(loop, loop.total * t), dB(t))); }
  return { pts: A.concat(B), coreRing: ring, maxDepth: m + gap + 2 * amp, opening: gap + 2 * amp };
}
/** a plain inward spiral — where the section is too small to hold a weave plus a core */
function rimSpiralPlain(F, z, loop, pitches){
  const cum = [0]; for(const p of pitches) cum.push(cum[cum.length - 1] + p);
  const M = Math.max(48, Math.round(loop.total / CHORD_STEP)), out = [];
  for(let j = 0; j < pitches.length; j++) for(let i = 0; i < M; i++){
    const t = i / M; out.push(toDepth(F, z, walkAt(loop, loop.total * t), -(cum[j] + pitches[j] * t)));
  }
  out.push(toDepth(F, z, walkAt(loop, 0), -cum[pitches.length]));
  return { pts: out, maxDepth: cum[pitches.length] };
}

/* ===================== the core: patterns on an island ===================== */
/* Boustrophedon over a polygon that may be concave: crossings are PAIRED (0-1, 2-3, ...), so a
   section a scan line enters and leaves twice is filled twice and hopped between along the
   boundary — the v1 convexity refusal is gone. */
/* `loops` is the whole region: loops[0] is the outer core boundary, loops[1..] are the boundaries of
   its HOLES. Crossings from every loop are merged and sorted, so pairing (0-1, 2-3, ...) is exact for
   any multiply-connected section — which is what a column of four merging legs actually is: a ring
   with a hollow middle, where the v1 scan fill would have laid every chord straight through the hole. */
function scanFillRegion(loops, angleDeg, spacingAt, sine, start, inMaterial){
  const a = angleDeg * Math.PI / 180, ca = Math.cos(-a), sa = Math.sin(-a);
  const rot = ([x, y]) => [x * ca - y * sa, x * sa + y * ca];
  const rps = loops.map(L => L.pts.map(rot));
  let yMin = 1e9, yMax = -1e9; for(const p of rps[0]){ if(p[1] < yMin) yMin = p[1]; if(p[1] > yMax) yMax = p[1]; }
  const span = yMax - yMin;
  const crossings = (y) => {
    const hits = [];
    for(let li = 0; li < loops.length; li++){
      const L = loops[li], rp = rps[li];
      for(let i = 0; i < L.n; i++){
        const p = rp[i], q = rp[(i + 1) % L.n];
        if((p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1]){
          const t = (y - p[1]) / (q[1] - p[1]); if(t >= 1) continue;
          hits.push({ loop: li, u: L.cum[i] + t * (L.cum[i + 1] - L.cum[i]), xr: p[0] + (q[0] - p[0]) * t });
        }
      }
    }
    hits.sort((p, q) => p.xr - q.xr);
    return hits;
  };
  const ys = []; let maxSpacing = 0, li = 0;
  let y = yMin + Math.max(0.6, 0.55 * spacingAt(0, 0));
  while(y < yMax - 0.5){ ys.push(y); const s = spacingAt(li, (y - yMin) / span); maxSpacing = Math.max(maxSpacing, s); y += s; li++; }
  const chords = []; let dropped = 0;
  ys.forEach((y0, i) => {
    const hits = crossings(y0); if(hits.length < 2) return;
    const pairs = [];
    for(let h = 0; h + 1 < hits.length; h += 2) pairs.push([hits[h], hits[h + 1]]);
    if(i % 2 === 1) pairs.reverse();
    for(const [p, q] of pairs){
      const l2r = i % 2 === 0, from = l2r ? p : q, to = l2r ? q : p;
      const cb = Math.cos(a), sb = Math.sin(a);
      const at = (t) => { const xr = from.xr + (to.xr - from.xr) * t; return [xr * cb - y0 * sb, xr * sb + y0 * cb]; };
      let solid = true;
      const n = Math.max(2, Math.ceil(Math.abs(to.xr - from.xr) / 1.0));
      for(let t = 1; t < n && solid; t++) if(!inMaterial(...at(t / n))) solid = false;
      if(solid) chords.push({ y0, from, to }); else dropped++;
    }
  });
  if(!chords.length) return null;
  const cb = Math.cos(a), sb = Math.sin(a);
  const paths = []; let out = [], splits = 0;
  let prev = start || null;                                      // { loop, u, pt }
  const connect = (to) => {
    if(!prev) return true;
    if(prev.loop === to.loop){ out.push(...hop(loops[prev.loop], prev.u, to.u)); return true; }
    const from = walkAt(loops[prev.loop], prev.u), dst = walkAt(loops[to.loop], to.u);
    const seg = resampleOpen([from, dst], CHORD_STEP);
    if(seg.every(q => inMaterial(q[0], q[1]))){ out.push(...seg.slice(1)); return true; }
    return false;                                                // the straight way crosses the hole
  };
  for(const c of chords){
    if(!connect(c.from)){ if(out.length > 1){ paths.push(out); splits++; } out = []; }
    const x0 = c.from.xr, x1 = c.to.xr, len = Math.abs(x1 - x0);
    const n = Math.max(1, Math.ceil(len / CHORD_STEP));
    for(let j = (out.length === 0 ? 0 : 1); j <= n; j++){
      const t = j / n, xr = x0 + (x1 - x0) * t;
      let yr = c.y0;
      if(sine){ const taper = smooth(Math.min(t, 1 - t) * len / (sine.lambda * 0.5)); yr += sine.amp * taper * Math.sin(TAU * (xr - x0) / sine.lambda + sine.phase); }
      out.push([xr * cb - yr * sb, xr * sb + yr * cb]);
    }
    prev = c.to;
  }
  if(out.length > 1) paths.push(out);
  if(!paths.length) return null;
  return { paths, pts: paths[0], nLines: ys.length, maxSpacing, nChords: chords.length, splits, dropped };
}
/** growth rings inside the core boundary; the first turn starts half a bead in so it welds to the rim */
function spiralFillLoop(F, z, L, baseDepth, spacing, d0){
  const depth = minRadius(L);
  const nTurns = Math.max(0, Math.floor((depth - d0 - 0.6 * spacing) / spacing));
  if(nTurns < 1) return null;
  const M = Math.max(48, Math.round(L.total / CHORD_STEP)), out = [];
  for(let j = 0; j < nTurns; j++) for(let i = 0; i < M; i++){
    const t = i / M; out.push(toDepth(F, z, walkAt(L, L.total * t), -(baseDepth + d0 + (j + t) * spacing)));
  }
  for(let i = 0; i <= Math.round(M / 4); i++){
    const t = i / M; out.push(toDepth(F, z, walkAt(L, L.total * t), -(baseDepth + d0 + nTurns * spacing)));
  }
  return { pts: out, nTurns, maxSpacing: spacing };
}
function hilbertFill(cx, cy, side, targetPitch, flip){
  const order = clamp(Math.ceil(Math.log2(side / targetPitch)), 2, 6);
  const n = 1 << order, pitch = side / n, pts = [];
  for(let d = 0; d < n * n; d++){
    let rx, ry, x = 0, y = 0, t = d;
    for(let s = 1; s < n; s *= 2){
      rx = 1 & (t / 2); ry = 1 & (t ^ rx);
      if(ry === 0){ if(rx === 1){ x = s - 1 - x; y = s - 1 - y; } const tmp = x; x = y; y = tmp; }
      x += s * rx; y += s * ry; t = Math.floor(t / 4);
    }
    const px = (x + 0.5) * pitch - side / 2, py = (y + 0.5) * pitch - side / 2;
    pts.push(flip ? [cx + py, cy + px] : [cx + px, cy + py]);
  }
  return { pts: resampleOpen(pts, CHORD_STEP), pitch, order, maxSpacing: pitch };
}

/* ===================== support, measured against the layer below ===================== */
function hashPoints(pts, cell){
  const H = new Map();
  for(const p of pts){ const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`; let a = H.get(k); if(!a){ a = []; H.set(k, a); } a.push(p); }
  return { H, cell };
}
/* Rings are expanded until the answer is certain or `limit` is passed. A fixed 3x3 lookup silently
   answered Infinity for anything beyond one cell, which read as "no support" on every layer whose
   thread simply sits more than a cell away — the metric must be able to see as far as it judges. */
function nearestDist(G, p, limit){
  const ci = Math.floor(p[0] / G.cell), cj = Math.floor(p[1] / G.cell);
  const maxR = Math.ceil(limit / G.cell) + 1;
  let best = Infinity;
  for(let r = 0; r <= maxR; r++){
    for(let i = ci - r; i <= ci + r; i++) for(let j = cj - r; j <= cj + r; j++){
      if(r > 0 && Math.abs(i - ci) !== r && Math.abs(j - cj) !== r) continue;   // ring only
      const a = G.H.get(`${i},${j}`); if(!a) continue;
      for(const q of a){ const d = hyp(q[0] - p[0], q[1] - p[1]); if(d < best) best = d; }
    }
    if(best <= r * G.cell) break;                                   // nothing further out can beat it
  }
  return best;
}
/* How far is a point from the nearest thing the previous layer laid down? That distance IS the half
   free span, and it is the quantity the gate measures on the finished G-code. The first cut of this
   check counted the longest RUN of points further than `reach` instead, and refused the merge of the
   chair's legs: a chord running ALONG a 1 mm wide new neck is 29 mm of "unsupported run" while every
   point of it sits 1.3 mm from supported material — a 2.6 mm bridge, legal four times over. Span is
   the measure; the run is kept because it still tells you where a thread is lying in a valley. */
function supportOf(paths, G, reach, limit){
  let span = 0, spanAt = null, run = 0, runAt = null, unsupported = 0, total = 0;
  for(const P of paths){
    let runLen = 0, prev = null;
    for(const p of P){
      const d = nearestDist(G, p, limit); total++;
      if(d > span && Number.isFinite(d)){ span = d; spanAt = p; }
      if(!Number.isFinite(d)){ span = Infinity; spanAt = p; }
      if(d > reach){
        unsupported++;
        if(prev) runLen += hyp(p[0] - prev[0], p[1] - prev[1]);
        if(runLen > run){ run = runLen; runAt = p; }
      } else runLen = 0;
      prev = p;
    }
  }
  return { span, spanAt, run, runAt, unsupported, total };
}

/* ====================================================================================================
   The bodies. A variant provides:
     H, bbox(H)                       — height and the x/y box the field lives in
     field(x, y, z, H)                — f < 0 is material
     planAt(k, z, zf, ctx)            — the layer program: rim weave + core pattern
   ==================================================================================================== */
export const VARIANTS = {
  stolica: {
    title: 'STOLICA',
    concept: 'a chair that begins as four separate round feet, merges into one seat and continues as a back — porous on every side, one line per island',
    H: 170.0,
    /* Proportions, scaled to H. Four feet converge into one column, the column flares into the seat,
       the seat carries the back. Nothing ever has to span empty air: the legs only LEAN INWARD
       (their outer face always shrinks) and the seat only grows at a rate the layer below can hold. */
    geom(H){
      const s = H / 170;
      return { s, H,
        legX: 26 * s, legY: 27 * s, footR: 9.5 * s, legR: 7.0 * s, footTop: 16 * s,
        mergeTop: 56 * s, converge: 0.72,
        flareZ0: 56 * s, flareZ1: 79 * s, seatTop: 88 * s,
        colX: 14 * s, colY: 14.5 * s, seatX: 41 * s, seatY: 42 * s, seatRad: 10 * s,
        backZ0: 82 * s, backX: 35 * s, backT: 4.6 * s, backY: 34 * s, backRad: 3.2 * s, lean: 0.10,
        /* kBack is deliberately SMALL: a smooth union inflates wherever both fields are positive,
           and above the seat top that is everywhere — k=10 produced a 1 mm halo that came back as a
           second, floating island at z=90 (measured 2026-10-02). */
        kLeg: 7 * s, kSeat: 10 * s, kBack: 4 * s };
    },
    field(x, y, z, H){
      const G = this.geom(H);
      /* four feet: flared, then straight, and all the while their centres walk toward the axis */
      const r = lerp(G.footR, G.legR, smooth(z / G.footTop));
      /* ease-OUT, not smoothstep: the neck that appears when two legs touch grows like the square
         root of how far they have overlapped, so the gap has to close slowest exactly where it closes. */
      const tc = clamp((z - G.footTop) / (G.mergeTop - G.footTop), 0, 1);
      const cf = 1 - G.converge * (1 - (1 - tc) ** 3.2);
      let d = 1e9;
      for(const sx of [-1, 1]) for(const sy of [-1, 1])
        d = smin(d, hyp(x - sx * G.legX * cf, y - sy * G.legY * cf) - r, G.kLeg);
      d = Math.max(d, z - G.seatTop);                                  // the column ends inside the seat
      /* seat: a slab whose half-extents GROW with z, from the column's width out to the full seat.
         The growth rate, not a blend radius, is what keeps every new millimetre over material. */
      const t = clamp((z - G.flareZ0) / (G.flareZ1 - G.flareZ0), 0, 1);
      const hx = lerp(G.colX, G.seatX, smooth(t)), hy = lerp(G.colY, G.seatY, smooth(t));
      const seat = Math.max(sdRoundRect2(x, y, hx, hy, G.seatRad),
                            Math.max(z - G.seatTop, (G.flareZ0 - 2 * G.s) - z));
      let f = smin(d, seat, G.kSeat);
      /* back: extruded upward out of the rear of the seat, leaning back a little */
      const lean = G.lean * (z - G.backZ0);
      const back = sdRoundBox(x, y - lean, z, [0, G.backY, (G.backZ0 + H) / 2], [G.backX, G.backT, (H - G.backZ0) / 2], G.backRad);
      return smin(f, back, G.kBack);
      /* no half-space clamp here: max(f, -z-0.2) would cap the IN-PLANE depth of every layer near
         the bed to z+0.2, and a rim or spiral asking for a deeper level set then has no level set
         to land on — Newton walks off and the layer comes back as noise 100 mm wide (2026-10-02). */
    },
    bbox(H){ const G = this.geom(H); return [-(G.seatX + 7), -(G.seatY + 7), G.seatX + 7, G.seatY + 7]; },
    /* the layer program: weave outside, pattern inside, both free per layer */
    planAt(k, z, zf, ctx){
      const G = this.geom(ctx.H);
      if(k < ctx.N_BASE) return { kind: 'lines', spacing: k === 0 ? 0.50 : 0.85, angle: 90 * (k % 2), tag: 'base',
        weave: { m: 0.22, amp: 0.0, gap: 0.55 }, plain: [0.50, 0.85] };
      /* the feet: growth rings, the way a turned wooden foot reads */
      if(z < G.footTop) return { kind: 'spiral', spacing: 2.6, angle: 0, tag: 'stopalo',
        weave: { m: 0.22, amp: 0.80, gap: 0.85, lobeLen: 5.5 }, plain: [0.45, 0.85, 1.5] };
      /* the posts, leaning in until four become one: rings, with a crossing lines layer every third */
      if(z < G.flareZ0) return (k % 3 === 2)
        ? { kind: 'lines', spacing: 2.8, angle: 60 * (Math.floor(k / 3) % 3), tag: 'noga-veza',
            weave: { m: 0.22, amp: 0.85, gap: 0.85, lobeLen: 5.5 }, plain: [0.45, 0.85, 1.5] }
        : { kind: 'spiral', spacing: 2.6, angle: 0, tag: 'noga',
            weave: { m: 0.22, amp: 0.85, gap: 0.85, lobeLen: 5.5 }, plain: [0.45, 0.85, 1.5] };
      /* the last millimetres of the seat are close-woven: the back starts here, and its rim runs
         straight along 70 mm of edge — over a 4 mm sparse fill that is one long unsupported line */
      if(z < G.seatTop && z >= G.seatTop - 1.6 * G.s) return { kind: 'lines', spacing: 1.1, angle: 90 * (k % 2),
        tag: 'sediste-lezaj', weave: { m: 0.22, amp: 0.5, gap: 0.6, lobeLen: 6.0 }, plain: [0.45, 0.8] };
      /* the flare into the seat: lines rotate 45 deg a layer, so every layer crosses the one below */
      if(z < G.seatTop) return { kind: 'lines',
        spacing: lerp(2.6, 4.0, smooth((z - G.flareZ0) / (G.seatTop - G.flareZ0))),
        angle: 45 * (k % 4), tag: 'sediste', weave: { m: 0.22, amp: 1.0, gap: 0.9, lobeLen: 6.0 }, plain: [0.45, 0.9, 1.5] };
      /* the back: three bands, so the thread is never doing the same thing for long */
      const seatTop = G.seatTop / ctx.H, bf = clamp((zf - seatTop) / (1 - seatTop), 0, 1);
      if(bf < 0.34) return { kind: 'lines', spacing: 3.2, angle: 60 * (k % 3), tag: 'naslon-mreza',
        weave: { m: 0.22, amp: 1.0, gap: 0.9, lobeLen: 6.0 }, plain: [0.45, 0.9, 1.5] };
      if(bf < 0.70) return (k % 2 === 0)
        ? { kind: 'sine', spacing: 3.4, angle: 0, sine: { amp: 0.9, lambda: 7 }, tag: 'naslon-talas',
            weave: { m: 0.22, amp: 1.1, gap: 0.95, lobeLen: 6.5 }, plain: [0.45, 0.9, 1.5] }
        : { kind: 'lines', spacing: 3.0, angle: 90, tag: 'naslon-veza',
            weave: { m: 0.22, amp: 1.1, gap: 0.95, lobeLen: 6.5 }, plain: [0.45, 0.9, 1.5] };
      return { kind: 'lines', spacing: lerp(3.0, 2.2, smooth((bf - 0.70) / 0.30)), angle: 45 * (k % 4), tag: 'naslon-vrh',
        weave: { m: 0.22, amp: 0.9, gap: 0.9, lobeLen: 6.0 }, plain: [0.45, 0.9, 1.4] };
    },
    speed: 50,
  },
};

/* ====================================================================================================
   generate                                                                                            */
export function generateField(o){
  const V = VARIANTS[o.variant]; if(!V) throw new Error(`unknown variant ${JSON.stringify(o.variant)}; known: ${Object.keys(VARIANTS).join(', ')}`);
  const machines = JSON.parse(fs.readFileSync(path.join(ROOT, 'machines.json'), 'utf8'));
  const m = machines[o.machine]; if(!m || m._note) throw new Error(`unknown machine ${JSON.stringify(o.machine)}`);
  const BEAD = m.bead, LH = m.lh, FIRST_BEAD = m.firstLayerBead ?? 0.52;
  const H = o.H ? +o.H : V.H;
  const N = Math.round(H / LH);
  const N_BASE = 4;
  const MAXBRIDGE = 12, ALLOW = 0.6, REACH = Math.max(0.9, BEAD * 1.6);
  const DPHI = o.dphi != null ? +o.dphi : 0.28;        // weave phase advance per layer (radians)
  const violations = [], warnings = [], events = [];
  const F = (x, y, z) => V.field(x, y, z, H);
  const bbox = V.bbox(H);
  const ctx = { H, N, N_BASE };

  const layers = [], plan = [];
  let prevGrid = null, prevPlan = null, prevLoops = null, prevTracks = null;
  let nextTrack = 1;
  let worstSpan = 0, worstSpanAt = null, worstRun = 0, worstGrowth = 0, worstGrowthAt = null;
  let pulledTotal = 0, emittedTotal = 0, worstPull = 0;

  for(let k = 0; k < N; k++){
    const z = k * LH, zf = N > 1 ? k / (N - 1) : 0, zs = z + 0.5 * LH;
    const p = V.planAt(k, z, zf, ctx);
    const raw = contoursAt(F, zs, bbox, CELL).filter(r => Math.abs(signedArea(r)) > 1.2);
    const outer = raw.filter(r => signedArea(r) > 0);
    const holeRaw = raw.filter(r => signedArea(r) < 0);
    if(!outer.length){ violations.push(`layer ${k} z=${rr(z, 2)}: the field has no material`); break; }

    /* island identity: a track that persists keeps its weave phase; a new or merged island ramps in */
    const loops = outer.map(r => makeLoop(resampleClosed(r, CHORD_STEP * 1.6)));
    /* holes belong to the island that contains them. Four legs leaning together close into a RING
       with a hollow middle before they close into a column — without this the scan fill pairs the
       crossings as if the middle were solid and lays every chord straight across the hole. */
    const holesOf = loops.map(() => []);
    for(const r of holeRaw){
      const Hl = makeLoop(resampleClosed(r, CHORD_STEP * 1.6));
      let idx = -1;
      for(let i = 0; i < loops.length; i++) if(pointInPoly(loops[i].pts, Hl.pts[0])){ idx = i; break; }
      if(idx >= 0) holesOf[idx].push(Hl);
    }
    const nHoles = holeRaw.length;
    if(nHoles) events.push({ z: rr(z, 2), k, event: `${nHoles} interior hole(s) in the section` });
    const tracks = loops.map(L => {
      if(!prevTracks) return { id: nextTrack++, age: 0 };
      let best = null, bd = Infinity;
      for(let i = 0; i < prevLoops.length; i++){
        const d = hyp(prevLoops[i].cx - L.cx, prevLoops[i].cy - L.cy);
        if(d < bd){ bd = d; best = prevTracks[i]; }
      }
      const merged = prevLoops.length !== loops.length;
      return (best && bd < 6 && !merged) ? { id: best.id, age: best.age + 1 } : { id: nextTrack++, age: 0 };
    });

    /* --- what the boundary does is fixed by the shape: rim, holes, core boundary. Build it once. --- */
    const pre = loops.map((L, li) => {
      const tr = tracks[li];
      const ramp = smooth(tr.age / 10);                               // a new island starts with no wave, then weaves
      const minR = minRadius(L);
      const w = p.weave;
      const lobes = w.lobeLen ? Math.max(4, Math.round(L.total / w.lobeLen)) : 0;
      const amp = (w.amp || 0) * ramp;
      const weaveDepth = w.m + (w.gap || 0) + 2 * amp;
      const myHoles = holesOf[li];
      /* Too small to carry a weave AND a core: the plain pitch schedule simply runs to the centre.
         Collapsed too: where a section has a neck thinner than twice the weave, the inward offset
         self-intersects, the crossing pairing of the scan fill reads the figure-eight as solid and
         lays chords through air (measured 2026-10-02 at the leg merge, z 48-51). */
      const rimOnly = minR - weaveDepth < 2.0 || (!myHoles.length && ringCollapses(L, weaveDepth));
      const inMaterial = (x, y) => sdist(F, x, y, zs) <= 0.08;
      let rimPts, coreLoop = null, baseDepth = 0, rimSpacing = 0;
      if(rimOnly){
        /* the schedule is TRUNCATED to the section, never run past it: a target deeper than the
           shape has no level set, Newton walks off and the spiral comes back as noise. */
        const deep = Math.max(minR, maxInradius(F, zs, L));
        const pitches = []; let acc = 0;
        for(const q of (p.plain || [0.45])){ if(acc + q > deep - 0.35) break; pitches.push(q); acc += q; }
        if(!pitches.length) pitches.push(clamp(deep - 0.15, 0.15, 0.45));
        const step = Math.min(p.spacing, 1.5);
        while(acc + step < deep - 0.35 && pitches.length < 60){ pitches.push(step); acc += step; }
        /* ALWAYS finish on the medial axis. Making the closing pass conditional let the turn
           count flip between adjacent layers, and the innermost pass jumped a whole pitch sideways
           from one layer to the next — 17.8 mm of thread with nothing under it at z 166.32. */
        if(deep - acc > 0.25) pitches.push(Math.max(0.25, deep - acc - 0.2));
        const R = rimSpiralPlain(F, zs, L, pitches);
        rimPts = R.pts; rimSpacing = Math.max(...pitches);
      } else {
        const R = rimWeave(F, zs, L, { m: w.m, amp, gap: w.gap, lobes, phase: DPHI * k + li * 1.7 });
        rimPts = R.pts; baseDepth = R.maxDepth; coreLoop = makeLoop(R.coreRing); rimSpacing = R.opening;
      }
      /* every hole gets its own woven rim too — a hole in a weft body is a boundary like any other */
      const coreLoops = coreLoop ? [coreLoop] : [];
      const line = rimPts.slice(), extra = [];
      if(coreLoop) for(const Hl of myHoles){
        if(Hl.total < 10) continue;                                    // too small to carry a thread
        const HR = rimWeave(F, zs, Hl, { m: w.m, amp, gap: w.gap, lobes: Math.max(4, Math.round(Hl.total / (w.lobeLen || 6))), phase: DPHI * k + 0.9 });
        const bridge = resampleOpen([line[line.length - 1], HR.pts[0]], CHORD_STEP);
        if(bridge.every(q => inMaterial(q[0], q[1]))) line.push(...bridge.slice(1), ...HR.pts);
        else extra.push(HR.pts);
        const ring = makeLoop(HR.coreRing);
        let encloses = true;
        for(let t = 0; t < Hl.n && encloses; t += Math.max(1, Math.floor(Hl.n / 16)))
          if(!pointInPoly(ring.pts, Hl.pts[t])) encloses = false;
        coreLoops.push(encloses ? ring : Hl);
      }
      /* A region with holes is filled by scanning, always: a spiral or a hilbert block has no way to
         say "not here" and would walk into the hollow middle. So is a CLOVER — a section with a waist
         narrower than its own inradius, which is what four legs look like while they are merging; and
         so is anything whose radius is not roughly constant, because a ring pattern is an OFFSET of
         the boundary and on a four-lobed section the offsets stop 10 mm short along the diagonals. */
      let kind = p.kind;
      if(coreLoop && p.kind !== 'lines' && p.kind !== 'sine'){
        const clover = ringCollapses(coreLoop, 0.5 * minRadius(coreLoop));
        const roundish = maxRadius(coreLoop) / Math.max(1e-6, minRadius(coreLoop)) < 1.25;
        if(myHoles.length || clover || !roundish) kind = 'lines';
      }
      const rimOpen = hyp(rimPts.at(-1)[0] - rimPts[0][0], rimPts.at(-1)[1] - rimPts[0][1]);
      return { L, tr, li, myHoles, rimOnly, rimPts, rimOpen, coreLoop, coreLoops, line, extra, baseDepth, lobes, amp, inMaterial, kind, rimSpacing };
    });

    /* --- the core is the free choice, so it is the one that gets measured --- */
    const attempt = (angle, forceLines) => {
      const paths = [], silhouettes = [], supportPts = [];
      let fillLen = 0, maxSpacing = 0, rimOnlyCount = 0, pulled = 0, pulledWorst = 0, emitted = 0, blocky = false; const kinds = [];
      for(const q of pre){
        maxSpacing = Math.max(maxSpacing, q.rimSpacing);
        if(q.rimOnly){ rimOnlyCount++; blocky = true; }                 // concentric to the centre can leave a void too
        let core = null;
        if(q.coreLoop){
          const spacingAt = p.field ? ((ii) => p.field(ii, k)) : (() => p.spacing);
          const start = { loop: 0, u: nearestU(q.coreLoop, q.line[q.line.length - 1]) };
          const kind = forceLines ? 'lines' : q.kind;
          if(kind !== 'lines' && kind !== 'sine') blocky = true;
          if(kind === 'lines' || kind === 'sine'){
            const sine = kind === 'sine' ? { amp: p.sine.amp, lambda: p.sine.lambda, phase: (k % 2) * Math.PI } : null;
            core = scanFillRegion(q.coreLoops, angle, spacingAt, sine, start, q.inMaterial);
          } else if(kind === 'spiral'){
            core = spiralFillLoop(F, zs, q.coreLoop, q.baseDepth, p.spacing, 0.5 * BEAD);
            if(core) core.paths = [hop(q.coreLoop, start.u, nearestU(q.coreLoop, core.pts[0])).concat(core.pts)];
          } else if(kind === 'hilbert'){
            const side = 2 * minRadius(q.coreLoop) - 1.2;
            core = side > 3 * p.spacing ? hilbertFill(q.coreLoop.cx, q.coreLoop.cy, side, p.spacing, Math.floor(k / 2) % 2 === 1) : null;
            if(core) core.paths = [hop(q.coreLoop, start.u, nearestU(q.coreLoop, core.pts[0])).concat(core.pts)];
          } else throw new Error(`unknown fill kind ${kind}`);
          if(core){ maxSpacing = Math.max(maxSpacing, core.maxSpacing); kinds.push(kind); }
        }
        if(q.rimOnly) kinds.push('rim-only');
        /* ONE LINE: the rim hands over to the core along pass B — no second path, no travel inside the
           region. A path only ever splits where a straight connector would have crossed a hole. */
        const bodies = [q.line.concat(core ? core.paths[0] : []), ...(core ? core.paths.slice(1) : []), ...q.extra];
        const sparse = maxSpacing > 1.2;
        bodies.forEach((b, bi) => {
          /* nothing leaves the body: a crossing or a connector may land a fraction outside a
             concave boundary, so every emitted point is checked (one field evaluation) and pulled
             back onto it. How many had to be pulled is reported, and a layer that needs more than
             one in a hundred pulled is a broken layer, not a rounded one. */
          const inside = b.map(([x, y]) => {
            emitted++;
            if(F(x, y, zs) > 0){ pulled++; const out = sdist(F, x, y, zs); if(out > pulledWorst) pulledWorst = out; return toDepth(F, zs, [x, y], -0.15); }
            return [x, y];
          });
          /* pull FIRST, resample AFTER: moving a point by up to 0.3 mm after resampling stretched a
             neighbouring segment to 0.95 mm, and a typed bridge must stay under 0.56 mm or the
             builder refuses it (the gate samples path VERTICES). */
          const pts = resampleOpen(inside, CHORD_STEP).map(([x, y]) => [rr(x, 3), rr(y, 3)]);
          paths.push({ pts, role: sparse ? 'bridge' : 'wall', closed: false, rimWoven: !q.rimOnly, rimOpen_mm: rr(q.rimOpen, 3), rimOpening_mm: rr(q.rimSpacing, 3), bead: k === 0 ? FIRST_BEAD : BEAD,
            speed: V.speed, label: `${p.tag}-i${q.tr.id}${bi ? `-${bi}` : ''}`, tile: `island-${q.tr.id}`,
            intent: `${PROCESS}: ${q.rimOnly ? 'plain rim to the centre' : `weave ${q.lobes} lobes amp ${rr(q.amp, 2)}`} + ${core ? `${forceLines ? 'lines' : q.kind} @ ${rr(angle, 1)}deg` : 'none'}, island ${q.li + 1}/${loops.length}${q.myHoles.length ? `, ${q.myHoles.length} hole(s)` : ''}, layer ${k + 1}/${N}` });
          fillLen += pts.slice(1).reduce((a, r2, ii) => a + hyp(r2[0] - pts[ii][0], r2[1] - pts[ii][1]), 0);
          supportPts.push(pts);
        });
        const sil = q.L.pts.map(([x, y]) => [rr(x, 3), rr(y, 3)]); sil.push(sil[0]);
        silhouettes.push(sil);
      }
      /* A layer may not leave a void wider than it could bridge. Sparse fill leaves voids on
         purpose and that is fine; a RING pattern on a four-lobed section leaves a four-pointed star
         10 mm across, and the NEXT layer's chords cross it with nothing underneath (measured 31.2 mm
         at z 53.04 — on the layer above, which is why the layer itself has to answer for it). Only
         ring and block patterns are tested; scanning cannot produce a surprise void. */
      let selfVoid = 0;
      if(blocky){
        const G2 = hashPoints([].concat(...supportPts), 1.0);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for(const q of pre) for(const pt of q.L.pts){ if(pt[0] < x0) x0 = pt[0]; if(pt[0] > x1) x1 = pt[0]; if(pt[1] < y0) y0 = pt[1]; if(pt[1] > y1) y1 = pt[1]; }
        for(let yy = y0; yy <= y1; yy += 1.0) for(let xx = x0; xx <= x1; xx += 1.0){
          if(F(xx, yy, zs) > -0.4) continue;                            // only material is asked
          const d = nearestDist(G2, [xx, yy], 0.5 * MAXBRIDGE + 1);
          if(d > selfVoid) selfVoid = d;
        }
      }
      return { paths, silhouettes, supportPts, fillLen, maxSpacing, rimOnlyCount, kinds, pulled, pulledWorst, emitted, selfVoid };
    };

    /* The plan PROPOSES an angle; the layer below disposes. A chord running ALONG a strip the layer
       below does not have under it is a long bridge however narrow the gap — the gate measures run
       LENGTH against maxbridge, and merging four legs creates exactly such a strip. So build it,
       measure it against the material actually laid down, and keep the direction that survives. */
    const RUNLIMIT = 0.9 * MAXBRIDGE;
    const candidates = [];
    for(const forceLines of [false, true]) for(const d of [0, 90, 45, 135, 22.5, 112.5, 67.5, 157.5]) candidates.push([p.angle + d, forceLines]);
    let best = null, tried = 0;
    for(const [a, forceLines] of candidates){
      const At = attempt(a, forceLines); tried++;
      const sup = prevGrid ? supportOf(At.supportPts, prevGrid, REACH, 0.5 * MAXBRIDGE + 1)
                           : { span: 0, run: 0, unsupported: 0, total: 0 };
      const score = Math.max(sup.run, 2 * sup.span, 2 * At.selfVoid);
      if(!best || score < best.score) best = { At, sup, angle: a, forceLines, score };
      if(score <= RUNLIMIT || !prevGrid) break;
    }
    const { paths, silhouettes, supportPts, fillLen, maxSpacing, rimOnlyCount, kinds, pulled, pulledWorst, emitted, selfVoid } = best.At;
    const free = best.sup, usedAngle = best.angle;
    if(tried > 1) events.push({ z: rr(z, 2), k, event: `fill angle ${rr(p.angle, 1)} -> ${rr(usedAngle, 1)} after ${tried} measured tries` });

    /* A hair outside a concave boundary is rounding; half a bead outside is a broken layer. Both are
       measured, because on a 3 mm leg six points out of 371 is ordinary polygon resolution while on a
       seat the same ratio would be a chord laid through air. */
    if(pulledWorst > 0.6 || pulled > 0.03 * emitted)
      violations.push(`layer ${k} z=${rr(z, 2)} (${p.tag}): ${pulled}/${emitted} points outside the body, worst ${rr(pulledWorst, 2)} mm — that is a broken layer, not rounding`);
    if(2 * selfVoid > RUNLIMIT) violations.push(`layer ${k} z=${rr(z, 2)} (${p.tag}): the layer leaves a ${rr(2 * selfVoid, 1)} mm void inside itself (ceiling ${rr(RUNLIMIT, 1)} mm)`);
    pulledTotal += pulled; emittedTotal += emitted; if(pulledWorst > worstPull) worstPull = pulledWorst;

    let growth = 0;
    if(prevGrid){
      if(!(free.run <= RUNLIMIT))
        violations.push(`layer ${k} z=${rr(z, 2)} (${p.tag}): ${rr(free.run, 1)} mm of thread runs with nothing under it (gate ceiling ${rr(RUNLIMIT, 1)} mm), best of ${tried} angles`);
      const span = 2 * free.span;
      if(!(span <= RUNLIMIT))
        violations.push(`layer ${k} z=${rr(z, 2)} (${p.tag}): free span ${rr(span, 1)} mm over the layer below exceeds ${rr(RUNLIMIT, 1)} mm`);
      if(span > worstSpan){ worstSpan = span; worstSpanAt = { k, z: rr(z, 2), tag: p.tag }; }
      if(free.run > worstRun) worstRun = free.run;
      /* the body may not grow outward past what the previous layer's BODY can carry */
      const zPrev = zs - LH;
      for(const L of loops) for(let ii = 0; ii < L.n; ii += 3){
        const sd = sdist(F, L.pts[ii][0], L.pts[ii][1], zPrev);
        if(sd > growth) growth = sd;
      }
      /* Reported, not refused. In a concave blend |grad f| drops below 1, so f/|grad f| overstates how
         far the new edge really stands out; the authority is the MEASURED run above, which looks at
         the material the machine actually laid down instead of at the field. */
      if(growth > ALLOW) warnings.push(`layer ${k} z=${rr(z, 2)}: section grows ${rr(growth, 2)} mm outward (field estimate; measured run ${rr(free.run, 1)} mm)`);
      if(growth > worstGrowth){ worstGrowth = growth; worstGrowthAt = { k, z: rr(z, 2), tag: p.tag }; }
    }

    layers.push({ k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: 2.0, tab: 0, web: 'staple', phase: p.tag,
      contours: [], paths, silhouette: silhouettes[0], silhouettes });
    plan.push({ k, z: rr(z, 3), tag: p.tag, islands: loops.length, kinds: [...new Set(kinds)],
      spacing_mm: rr(p.spacing, 2), maxSpacing_mm: rr(maxSpacing, 2), rimOnly: rimOnlyCount,
      angle_deg: rr(usedAngle, 1), freeSpan_mm: rr(2 * free.span, 2), freeRun_mm: rr(free.run, 2), unsupported: free.unsupported,
      growth_mm: rr(growth, 2), fill_mm: rr(fillLen, 0) });
    if(prevPlan && (prevPlan.tag !== p.tag || prevPlan.islands !== loops.length))
      events.push({ z: rr(z, 2), k, event: `${prevPlan.tag}/${prevPlan.islands} -> ${p.tag}/${loops.length}` });
    prevGrid = hashPoints([].concat(...supportPts), 0.8);
    prevPlan = { tag: p.tag, islands: loops.length };
    prevLoops = loops; prevTracks = tracks;
    if(o.report && k % 25 === 0) process.stderr.write(`  layer ${k}/${N} z=${rr(z, 1)} islands=${loops.length} ${p.tag} run=${rr(free.run, 1)} span=${rr(2 * free.span, 1)} growth=${rr(growth, 2)}\n`);
  }

  /* foundation: three touching brim rings around EVERY first-layer island */
  const foundation = [];
  for(const sil of (layers[0].silhouettes || [layers[0].silhouette])){
    const L = makeLoop(sil.slice(0, -1));
    for(const d of [0.42, 0.84, 1.26]){
      const ring = [];
      for(let i = 0; i < L.n; i++) ring.push([rr(L.pts[i][0] - L.nrmIn[i][0] * d, 2), rr(L.pts[i][1] - L.nrmIn[i][1] * d, 2)]);
      ring.push(ring[0]); foundation.push(ring);
    }
  }
  const firstIslands = (layers[0].silhouettes || []).length;

  /* checks that refuse */
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
  for(const lay of layers) for(const pa of lay.paths) for(const q of pa.pts){
    if(q[0] < mnx) mnx = q[0]; if(q[0] > mxx) mxx = q[0]; if(q[1] < mny) mny = q[1]; if(q[1] > mxy) mxy = q[1]; }
  const size = [mxx - mnx + BEAD, mxy - mny + BEAD, rr(layers.length * LH, 2)];
  if(size[0] + 16 > m.plate[0] || size[1] + 16 > m.plate[1])
    violations.push(`${size[0].toFixed(1)} x ${size[1].toFixed(1)} mm does not fit ${m.plate.join(' x ')} with an 8 mm margin`);
  if(m.maxZ && size[2] + 2 > m.maxZ) violations.push(`${size[2]} mm is taller than the ${m.maxZ} mm Z of ${m.label}`);
  if(m.beadSource !== 'measured' && !o.allowAssumedBead)
    violations.push(`machine ${o.machine}: bead ${BEAD} is ${m.beadSource}; pass --allow-assumed-bead (and --i-know-the-bead-is-a-guess to weft.mjs) to build anyway`);

  const totalFill = plan.reduce((a, q) => a + q.fill_mm, 0);
  const mesh = stackMesh(layers, size[2], o.meshEvery ?? 6);
  const summary = {
    name: o.name || `${V.title}_${o.machine.toUpperCase()}_X1`, variant: o.variant, title: V.title, concept: V.concept,
    generator: 'core/weft_field_geometry.mjs', process: PROCESS, generatedAt: new Date().toISOString().slice(0, 10),
    machine: o.machine, machineLabel: m.label,
    machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    size_mm: [rr(size[0], 1), rr(size[1], 1), size[2]], H: size[2], totalLayers: layers.length,
    args: { lh: LH, bead: BEAD, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12, w: 2.0, e: 0, r0: rr(size[0] / 2, 2), K: 8, foundation: 3,
      maxbridge: MAXBRIDGE, maxcantilever: 3, allow: ALLOW, minanchor: 0.5, maxCapRadius: 20,
      speed: V.speed, bridgeSpeed: 18, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'a volumetric body woven as one line per island: the outside is as open as the inside, and every span between crossings must be a legal bridge',
      bridge_mm: MAXBRIDGE, cantilever_mm: 3, first_layer_max_islands: firstIslands },
    field: { firstLayerIslands: firstIslands, maxIslands: Math.max(...plan.map(q => q.islands)),
      weavePhaseStep_rad: DPHI, supportReach_mm: rr(REACH, 2),
      worstFreeSpan_mm: rr(worstSpan, 2), worstFreeSpanAt: worstSpanAt, worstValleyRun_mm: rr(worstRun, 2),
      pointsPulledIntoBody: pulledTotal, pointsEmitted: emittedTotal, worstPullBack_mm: rr(worstPull, 2),
      worstOutwardGrowth_mm: rr(worstGrowth, 2), worstOutwardGrowthAt: worstGrowthAt,
      fillLength_m: rr(totalFill / 1000, 1), tags: [...new Set(plan.map(q => q.tag))],
      patterns: [...new Set([].concat(...plan.map(q => q.kinds)))] },
    layerProgram: plan.filter((_, i) => i % 5 === 0 || i === plan.length - 1),
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'brim-rings', paths: foundation }, layers, mesh };
  return { payload, summary, violations, warnings, plan, svg: () => svgOf(summary, plan, layers, size, m, MAXBRIDGE) };
}

/* ---------------- display mesh: the stack the machine will actually lay down ----------------
   Not a loft of one ring — this body changes island COUNT, and a single-ring loft cannot say that.
   Sampled slices are lofted island to island where the matching is 1:1, and capped on both sides
   where the topology changes, so four feet read as four feet and the seat reads as one body. */
function stackMesh(layers, H, every){
  const RING = 72;
  const idx = [];
  for(let k = 0; k < layers.length; k += every) idx.push(k);
  if(idx[idx.length - 1] !== layers.length - 1) idx.push(layers.length - 1);
  /* the top slice takes the layer's zTop, not its zBot: otherwise the mesh is one layer short and
     sits half a layer below the body it is meant to show */
  const slices = idx.map((k, i) => ({
    z: i === idx.length - 1 ? layers[k].zTop : layers[k].zBot,
    rings: (layers[k].silhouettes || [layers[k].silhouette]).map(s => ringOf(s, RING)),
  }));
  const vertices = [], triangles = [];
  const zc = z => rr(z - H / 2, 4);
  const emit = (ring, z) => { const b = vertices.length; for(const p of ring) vertices.push([p[0], p[1], zc(z)]); return b; };
  const capRing = (base, ring, z, up) => {
    const c = vertices.length;
    vertices.push([rr(ring.reduce((s, p) => s + p[0], 0) / ring.length, 4), rr(ring.reduce((s, p) => s + p[1], 0) / ring.length, 4), zc(z)]);
    for(let i = 0; i < ring.length; i++){
      const a = base + i, b = base + (i + 1) % ring.length;
      triangles.push(up ? [c, a, b] : [c, b, a]);
    }
  };
  let prev = null;
  for(let s = 0; s < slices.length; s++){
    const sl = slices[s];
    const bases = sl.rings.map(r => emit(r, sl.z));
    const match = prev && prev.rings.length === sl.rings.length ? matchRings(prev, sl) : null;
    if(!prev) sl.rings.forEach((r, i) => capRing(bases[i], r, sl.z, false));
    else if(match){
      match.forEach(([pi, ci]) => {
        const a0 = prev.bases[pi], b0 = bases[ci], n = RING;
        for(let i = 0; i < n; i++){
          const a = a0 + i, b = a0 + (i + 1) % n, c = b0 + (i + 1) % n, d = b0 + i;
          triangles.push([a, b, c], [a, c, d]);
        }
      });
    } else {
      prev.rings.forEach((r, i) => capRing(prev.bases[i], r, prev.z, true));
      sl.rings.forEach((r, i) => capRing(bases[i], r, sl.z, false));
    }
    sl.bases = bases; prev = sl;
  }
  prev.rings.forEach((r, i) => capRing(prev.bases[i], r, prev.z, true));
  return { vertices, triangles, faceCount: triangles.length, slices: slices.length };
}
function ringOf(sil, n){
  const pts = sil.slice(0, -1);
  const r = resampleClosed(signedArea(pts) < 0 ? [...pts].reverse() : pts, 1);
  const cum = [0];
  for(let i = 1; i <= r.length; i++) cum.push(cum[i - 1] + hyp(r[i % r.length][0] - r[i - 1][0], r[i % r.length][1] - r[i - 1][1]));
  const total = cum[r.length], out = []; let j = 0;
  for(let k = 0; k < n; k++){
    const t = total * k / n;
    while(j < r.length - 1 && cum[j + 1] < t) j++;
    const seg = cum[j + 1] - cum[j], f = seg > 1e-12 ? (t - cum[j]) / seg : 0;
    const a = r[j], b = r[(j + 1) % r.length];
    out.push([rr(a[0] + (b[0] - a[0]) * f, 4), rr(a[1] + (b[1] - a[1]) * f, 4)]);
  }
  return out;
}
function matchRings(prev, cur){
  const used = new Set(), out = [];
  for(let i = 0; i < prev.rings.length; i++){
    const pc = centroid(prev.rings[i]);
    let best = -1, bd = Infinity;
    for(let j = 0; j < cur.rings.length; j++){
      if(used.has(j)) continue;
      const cc = centroid(cur.rings[j]), d = hyp(pc[0] - cc[0], pc[1] - cc[1]);
      if(d < bd){ bd = d; best = j; }
    }
    if(best < 0 || bd > 25) return null;
    used.add(best); out.push([i, best]);
  }
  /* rotate each current ring so the loft does not twist */
  for(const [pi, ci] of out){
    const a = prev.rings[pi][0]; let bi = 0, bd = Infinity;
    cur.rings[ci].forEach((p, i) => { const d = hyp(p[0] - a[0], p[1] - a[1]); if(d < bd){ bd = d; bi = i; } });
    if(bi) cur.rings[ci] = cur.rings[ci].slice(bi).concat(cur.rings[ci].slice(0, bi));
  }
  return out;
}
const centroid = (r) => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];

/* ---------------- a picture of the program ---------------- */
function svgOf(summary, plan, layers, size, m, MAXBRIDGE){
  const Wv = 1000, Hv = 600, els = [], N = plan.length;
  const COL = { lines: '#78a7ff', sine: '#45d9c0', hilbert: '#ff9f6b', spiral: '#7cff5e', 'rim-only': '#c8a2ff', base: '#9bb0c8' };
  const picks = [0, Math.floor(layers.length * 0.30), Math.floor(layers.length * 0.52), Math.floor(layers.length * 0.85)];
  picks.forEach((k, j) => {
    const lay = layers[clamp(k, 0, layers.length - 1)], ox = 130 + j * 240, oy = 170, sc = 190 / Math.max(size[0], size[1]);
    for(const pa of lay.paths){
      const pts = pa.pts.map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - q[1] * sc).toFixed(1)}`).join(' ');
      els.push(`<polyline points="${pts}" fill="none" stroke="#7cff5e" stroke-width=".4" opacity=".85"/>`);
    }
    els.push(`<text x="${ox - 95}" y="${oy + 130}" fill="#9bb0c8" font-family="sans-serif" font-size="10">z=${lay.zBot.toFixed(1)} · ${lay.phase} · ${lay.paths.length} island(s)</text>`);
  });
  const ex = 60, ey = 560, ew = 880, eh = 200;
  plan.forEach(q => {
    const yy = ey - (q.k / plan[plan.length - 1].k) * eh;
    els.push(`<rect x="${ex}" y="${yy.toFixed(1)}" width="${(ew * 0.30 * q.islands / 4).toFixed(1)}" height="1" fill="${COL[q.kinds[0]] || '#fff'}" opacity=".85"/>`);
    els.push(`<rect x="${(ex + ew * 0.36).toFixed(1)}" y="${yy.toFixed(1)}" width="${(q.freeSpan_mm / MAXBRIDGE * ew * 0.28).toFixed(1)}" height="1" fill="#ff4d6d" opacity=".9"/>`);
    els.push(`<rect x="${(ex + ew * 0.70).toFixed(1)}" y="${yy.toFixed(1)}" width="${(q.growth_mm / 0.6 * ew * 0.28).toFixed(1)}" height="1" fill="#ffd166" opacity=".9"/>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>${els.join('')}`
    + `<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="13">${summary.name} — ${summary.concept}</text>`
    + `<text x="12" y="38" fill="#9bb0c8" font-family="sans-serif" font-size="10">${size[0].toFixed(0)} x ${size[1].toFixed(0)} x ${size[2].toFixed(1)} mm · ${m.label} · bead ${m.bead} (${m.beadSource}) · ${layers.length} layers · thread ${summary.field.fillLength_m} m · worst free span ${summary.field.worstFreeSpan_mm} mm · worst growth ${summary.field.worstOutwardGrowth_mm} mm</text>`
    + `<text x="${ex}" y="${ey + 18}" fill="#9bb0c8" font-family="sans-serif" font-size="10">left: islands per layer · middle: measured free span vs ${MAXBRIDGE} mm · right: outward growth vs 0.6 mm</text></svg>`;
}

/* ---------------- CLI ---------------- */
function main(argv){
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const variant = opt('variant'), machine = opt('machine'), out = opt('out');
  if(!variant || !machine || !out){
    console.error('usage: node core/weft_field_geometry.mjs --variant stolica --machine a1 --out FILE [--svg FILE] [--name NAME] [--H mm] [--dphi rad] [--allow-assumed-bead] [--report]');
    process.exit(2);
  }
  const r = generateField({ variant, machine, out, name: opt('name'), H: opt('H'), dphi: opt('dphi'),
    meshEvery: opt('mesh-every'), allowAssumedBead: flag('allow-assumed-bead'), report: flag('report') });
  for(const w of r.warnings) console.error('note: ' + w);
  if(r.violations.length){
    console.error('REFUSED:');
    for(const v of r.violations.slice(0, 12)) console.error('  * ' + v);
    if(r.violations.length > 12) console.error(`  ... and ${r.violations.length - 12} more`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  if(opt('svg')) fs.writeFileSync(opt('svg'), r.svg());
  const s = r.summary;
  console.log(JSON.stringify({ name: s.name, machine: s.machineLabel, size_mm: s.size_mm, layers: s.totalLayers,
    firstLayerIslands: s.field.firstLayerIslands, maxIslands: s.field.maxIslands, patterns: s.field.patterns, tags: s.field.tags,
    thread_m: s.field.fillLength_m, worstFreeSpan_mm: s.field.worstFreeSpan_mm, worstValleyRun_mm: s.field.worstValleyRun_mm, worstGrowth_mm: s.field.worstOutwardGrowth_mm,
    meshFaces: r.payload.mesh.faceCount, events: s.events.length }, null, 1));
}
/* realpath both sides: C:\Svemir\!Projekti is a junction to D:\ and node realpaths the module URL */
if(process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
