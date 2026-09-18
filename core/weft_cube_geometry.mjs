/* WEFT — KOCKA: a cube as a woven box with a self-supporting hierarchical roof (2026-09-17).

   Level-2 generator in JavaScript (no Python). Emits the geometry file `weft.mjs build --geo` consumes:
   summary / foundation / layers, the same records the sculpture generator writes (closed contour with
   weld-column nodes per layer, typed `bridge` paths over air, declared experiments for the second gate).

   The roof is the experiment. A cube's top is a flat square over a hollow body; WEFT prints one thread per
   layer and the only closure that has printed cleanly is chords over air anchored on the rim (the woven
   iris on GORA, 2026-09-05). Here the closure is hierarchical: a coarse grid of full-span chords first (the
   skeleton), then a finer grid whose chords rest on the skeleton at the crossings, then a finer one still,
   until the spans are inside the qualified 16 mm. Each level's free span is the previous level's pitch:
   L, L/n, L/n², ... — only the very first roof layer bridges the whole opening. Every roof layer is the
   woven rim ring plus ONE continuous serpentine (chord, a hop along the outer rail by one pitch, chord
   back, ...) so the layer stays a single line over the void; the hops double the bead on the rail exactly
   where the chords land.

   Two compositions, both built only from what has printed (five grammars, relief, breathing wall, twist,
   horns, rings+spokes foundation):
     tkanje  — the calm sampler: five grammar bands foot to top, a 3x3 quilt of pillows on every face that
               vanish at the edges, no twist; floor 3x3; roof Peano 3 -> 9 -> 27.
     vrtlog  — the wrung cloth: a quarter turn foot to top, helical weld columns, sine grammar with the
               node density doubling at mid-height, a wave that climbs spirally, wall breathing 3.2 -> 2.2,
               four small horns on the corners; floor 2x2; roof Hilbert 2 -> 4 -> 8 -> 16.

   usage: node core/weft_cube_geometry.mjs --variant tkanje|vrtlog --machine a2l|ender --out FILE
          [--side S] [--H H] [--svg FILE] [--allow-assumed-bead]                                         */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TAU = 2 * Math.PI;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const rr = (v, n = 3) => { const f = 10 ** n; const x = Math.round(v * f) / f; return Object.is(x, -0) ? 0 : x; };
const hyp = Math.hypot;

export const PROCESS = 'crown-woven-grid/v1';
export const EVIDENCED_BRIDGE_MM = 16.2;   // LIMIT16 2026-09-04, both machines

export const VARIANTS = {
  tkanje: {
    title: 'TKANJE', concept: 'the sampler: five grammar bands, a 3x3 quilt on every face, Peano roof 3-9-27',
    sideCentre: 57.0, wallHeight: 57.12, corner: 6.0, turns: 0.0,
    wFoot: 3.4, wBody: 3.0, wTop: 3.0, wRoof: 2.8, eRoof: 1.2,
    bands: [[0.00, 0.20, 'staple', 'foot'], [0.20, 0.40, 'diagonal', 'truss'], [0.40, 0.60, 'sine', 'wave'],
            [0.60, 0.80, 'eight', 'knot'], [0.80, 0.94, 'perp', 'belly'], [0.94, 1.01, 'staple', 'ledge']],
    K: [[0.0, 48]],
    relief: 'pillows', reliefAmp: 1.2, pillowsPerFace: 3, ampWave: 0.15,
    horns: [], floorLines: 3,
    roof: { base: 3, levels: [3, 9, 27], layersPerLevel: [4, 4, 4], firstLevelRepeat: true },
    speed: 30, bridgeSpeed: 18, declaredBridge: 60,
  },
  vrtlog: {
    title: 'VRTLOG', concept: 'the wrung cloth: a quarter turn, helical columns, density doubling, a climbing wave, horns on the corners, Hilbert roof 2-4-8-16',
    sideCentre: 47.0, wallHeight: 47.6, corner: 6.0, turns: 0.25,
    wFoot: 3.2, wBody: 2.2, wTop: 2.8, wRoof: 2.8, eRoof: 1.2,
    bands: [[0.00, 0.06, 'staple', 'foot'], [0.06, 0.94, 'sine', 'wave'], [0.94, 1.01, 'staple', 'ledge']],
    K: [[0.0, 24], [0.45, 48]],
    relief: 'spiral', reliefAmp: 1.4, wavesAround: 4, waveRise_mm: 24.0, ampWave: 0.25,
    horns: [{ P_mm: 12.0, rate: 0.8, zFrac: 0.40 }], hornsOnCorners: true, floorLines: 2,
    roof: { base: 2, levels: [2, 4, 8, 16], layersPerLevel: [4, 4, 2, 2], firstLevelRepeat: true },
    speed: 26, bridgeSpeed: 15, declaredBridge: 52,
  },
};

export function loadMachine(id){
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'machines.json'), 'utf8'))[id];
  if(!m) throw new Error(`unknown machine ${id}`);
  return Object.assign({ id }, m);
}

/* ---------------- the rounded square, by arc length ---------------- */
/** centreline rounded square of side S (centreline) and corner radius c: point + outward normal at arc position s */
export function makeSquare(S, c){
  const flat = S - 2 * c, arc = Math.PI * c / 2;
  const P = 4 * flat + 4 * arc;
  const h = S / 2;
  // segments in CCW order starting at (h, 0): right side up, corner NE, top side leftwards, corner NW, left side down, corner SW, bottom side rightwards, corner SE
  const segs = [];
  segs.push({ len: flat / 2, f: (t) => [h, t] , n: [1, 0] });
  segs.push({ len: arc, f: (t) => { const a = t / c; return [h - c + c * Math.cos(a), h - c + c * Math.sin(a)]; }, nf: (t) => { const a = t / c; return [Math.cos(a), Math.sin(a)]; } });
  segs.push({ len: flat, f: (t) => [h - c - t, h], n: [0, 1] });
  segs.push({ len: arc, f: (t) => { const a = Math.PI / 2 + t / c; return [-h + c + c * Math.cos(a), h - c + c * Math.sin(a)]; }, nf: (t) => { const a = Math.PI / 2 + t / c; return [Math.cos(a), Math.sin(a)]; } });
  segs.push({ len: flat, f: (t) => [-h, h - c - t], n: [-1, 0] });
  segs.push({ len: arc, f: (t) => { const a = Math.PI + t / c; return [-h + c + c * Math.cos(a), -h + c + c * Math.sin(a)]; }, nf: (t) => { const a = Math.PI + t / c; return [Math.cos(a), Math.sin(a)]; } });
  segs.push({ len: flat, f: (t) => [-h + c + t, -h], n: [0, -1] });
  segs.push({ len: arc, f: (t) => { const a = 1.5 * Math.PI + t / c; return [h - c + c * Math.cos(a), -h + c + c * Math.sin(a)]; }, nf: (t) => { const a = 1.5 * Math.PI + t / c; return [Math.cos(a), Math.sin(a)]; } });
  segs.push({ len: flat / 2, f: (t) => [h, -h + c + t], n: [1, 0] });
  let acc = 0; for(const sg of segs){ sg.s0 = acc; acc += sg.len; }
  /** returns [x, y, nx, ny, face, u] — face 0..3 for the four straight sides (-1 on a corner), u in 0..1 along that face (corners: NaN) */
  function at(s){
    s = ((s % P) + P) % P;
    for(let i = 0; i < segs.length; i++){
      const sg = segs[i];
      if(s <= sg.s0 + sg.len + 1e-9 || i === segs.length - 1){
        const t = clamp(s - sg.s0, 0, sg.len);
        const [x, y] = sg.f(t);
        const [nx, ny] = sg.n ? sg.n : sg.nf(t);
        let face = -1, u = NaN;
        if(sg.n){
          // face coordinate: position along the full straight side, 0..1
          if(i === 0){ face = 0; u = 0.5 + t / flat; }
          else if(i === 8){ face = 0; u = t / flat; }
          else if(i === 2){ face = 1; u = t / flat; }
          else if(i === 4){ face = 2; u = t / flat; }
          else { face = 3; u = t / flat; }
        }
        return [x, y, nx, ny, face, u];
      }
    }
    throw new Error('unreachable');
  }
  const cornerCentresS = [0.5 * flat + arc / 2, 0.5 * flat + arc + flat + arc / 2, 0.5 * flat + 2 * arc + 2 * flat + arc / 2, 0.5 * flat + 3 * arc + 3 * flat + arc / 2];
  return { P, flat, arc, at, cornerCentresS };
}

/* ---------------- contour record (the sculpture generator's, plain Math) ---------------- */
export function record(pts, closed, nodesU, w, e, web, lam, amp, label, tile = null){
  const q = pts.slice(), n = q.length;
  const qc = closed ? q.concat([q[0]]) : q;
  let normals = [];
  for(let i = 0; i < n; i++){
    let p0, p1;
    if(closed){ p0 = q[(i - 1 + n) % n]; p1 = q[(i + 1) % n]; } else { p0 = q[Math.max(0, i - 1)]; p1 = q[Math.min(n - 1, i + 1)]; }
    const tx = p1[0] - p0[0], ty = p1[1] - p0[1], dd = hyp(tx, ty) || 1;
    normals.push([ty / dd, -tx / dd]);
  }
  if(closed) normals = normals.concat([normals[0]]);
  const cum = [0];
  for(let i = 0; i + 1 < qc.length; i++) cum.push(cum[cum.length - 1] + hyp(qc[i + 1][0] - qc[i][0], qc[i + 1][1] - qc[i][1]));
  const total = cum[cum.length - 1];
  const nodes = [...new Set(nodesU.map(u => rr(clamp(u, 0, total), 4)))].sort((a, b) => a - b);
  const gaps = []; for(let j = 0; j + 1 < nodes.length; j++) gaps.push(nodes[j + 1] - nodes[j]);
  if(closed && nodes.length) gaps.push(total - nodes[nodes.length - 1] + nodes[0]);
  const rec = { pts: qc.map(([x, y]) => [rr(x, 2), rr(y, 2)]), nrm: normals.map(([x, y]) => [rr(x, 4), rr(y, 4)]), cum: cum.map(v => rr(v, 3)),
    total: rr(total, 3), nodes, K: nodes.length, maxNodeGap: rr(gaps.length ? Math.max(...gaps) : total, 3), closed: !!closed,
    w: rr(w, 3), e: rr(e, 3), web, label };
  if(lam) rec.breath = rr(lam, 3);
  if(amp) rec.amp = rr(amp, 3);
  if(web === 'sine' && gaps.length) rec.lambda = rr(2 * gaps.reduce((a, b) => a + b, 0) / gaps.length, 3);
  if(tile !== null) rec.tile = tile;
  return rec;
}
export function densifyNodes(nodes, total, closed, gapMax){
  let out = nodes.slice().sort((a, b) => a - b), changed = true;
  while(changed){
    changed = false; const nxt = [];
    for(let j = 0; j < out.length; j++){ const u = out[j]; nxt.push(u); if(j + 1 < out.length){ const g = out[j + 1] - u; if(g > gapMax){ nxt.push(u + g / 2); changed = true; } } }
    if(closed && out.length > 1){ const g = total - out[out.length - 1] + out[0]; if(g > gapMax){ const last = out[out.length - 1]; nxt.push(last + g / 2 < total ? last + g / 2 : last + g / 2 - total); changed = true; } }
    out = [...new Set(nxt)].sort((a, b) => a - b);
  }
  return out;
}
export function minConcaveRadius(pts){
  const n = pts.length; let best = 1e9;
  for(let i = 0; i < n; i++){
    const [x0, y0] = pts[(i - 1 + n) % n], [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    const ax = x1 - x0, ay = y1 - y0, bx = x2 - x1, by = y2 - y1, la = hyp(ax, ay), lb = hyp(bx, by);
    if(la < 1e-9 || lb < 1e-9) continue;
    const ang = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    if(ang < -1e-6) best = Math.min(best, (la + lb) / 2 / Math.abs(ang));
  }
  return best;
}
/** resample a polyline every `step` mm (keeps the first and last points) */
export function resample(pts, step){
  const out = [pts[0]];
  for(let i = 1; i < pts.length; i++){
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = hyp(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / step));
    for(let j = 1; j <= n; j++) out.push([x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n]);
  }
  return out;
}

/* ============================================================================================ */
export function generateCube(o){
  const V = VARIANTS[o.variant]; if(!V) throw new Error(`variant must be one of ${Object.keys(VARIANTS).join(', ')}`);
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh, FIRST_BEAD = m.firstLayerBead;
  const ALLOW = 0.6, REACH = BEAD / 2 + ALLOW, GAP_MAX = 9.5;
  const S = o.side != null ? +o.side - V.wBody : V.sideCentre;      // --side is the outer side; S is the wall centreline
  const H_W_REQ = o.H != null ? +o.H - LH * V.roof.layersPerLevel.reduce((a, b) => a + b, 0) : V.wallHeight;
  const N_WALL = Math.round(H_W_REQ / LH), H_W = N_WALL * LH;
  const C = V.corner, TURNS = V.turns;
  const sq = makeSquare(S, C);
  const P = sq.P;
  const NPHI = 240;
  const tw = (z) => TAU * TURNS * z / H_W;
  const rot = ([x, y], t) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
  const warnings = [], violations = [], events = [];

  /* ---------------- height programme ---------------- */
  const grammarAt = (z) => { const f = z / H_W; for(const [lo, hi, g, name] of V.bands) if(lo <= f && f < hi) return [g, name]; return ['staple', 'ledge']; };
  const Kat = (z) => { const f = z / H_W; let K = V.K[0][1]; for(const [lo, k] of V.K) if(f >= lo) K = k; return K; };
  function wallAt(z){
    const f = z / H_W;
    let w = z < 8 ? V.wFoot : lerp(V.wFoot, V.wBody, smooth((z - 8) / 12));
    if(V.wBody !== V.wTop && f > 0.90) w = lerp(w, V.wTop, smooth((f - 0.90) / 0.08));
    return w;
  }
  function tabAt(z){ const f = z / H_W; let e = 0.7; if(f > 0.48) e = lerp(0.7, 0.9, smooth((f - 0.48) / 0.08)); return e; }
  const reliefEnv = (z) => { const foot = lerp(0.0, 1.0, smooth(z / 8.0)); const top = 1 - smooth((z - (H_W - 6.0)) / 5.0); return foot * top; };

  /* ---------------- horns (corners, raised cosine along the perimeter) ---------------- */
  const horns = [];
  for(const hdef of V.horns){
    const nRise = Math.ceil(hdef.P_mm / hdef.rate), k0 = Math.round(hdef.zFrac * N_WALL);
    const where = V.hornsOnCorners ? sq.cornerCentresS : [0, P / 4, P / 2, 3 * P / 4];
    for(const sC of where) horns.push({ sC, P: hdef.P_mm, rate: hdef.rate, k0, nRise, nHold: 4, nFall: nRise, half: 0.6 * hdef.P_mm });
  }
  function hornBump(s, k){
    let add = 0;
    for(const h of horns){
      const j = k - h.k0; if(j < 0 || j >= h.nRise + h.nHold + h.nFall) continue;
      let d; if(j < h.nRise) d = Math.min(h.P, h.rate * (j + 1)); else if(j < h.nRise + h.nHold) d = h.P; else d = Math.max(0, h.P - h.rate * (j - h.nRise - h.nHold + 1));
      if(d <= 0) continue;
      let ds = ((s - h.sC + P / 2) % P + P) % P - P / 2;
      if(Math.abs(ds) < h.half) add += d * (0.5 + 0.5 * Math.cos(Math.PI * ds / h.half));
    }
    return add;
  }
  const hornZones = horns.length ? [[Math.min(...horns.map(h => h.k0)), Math.max(...horns.map(h => h.k0 + h.nRise + h.nHold + h.nFall))]] : [];
  function ampEnv(k){ let f = 1; for(const [k0, k1] of hornZones){ if(k0 - 12 <= k && k < k0) f = Math.min(f, smooth((k0 - k) / 12)); else if(k0 <= k && k < k1) f = 0; else if(k1 <= k && k < k1 + 12) f = Math.min(f, smooth((k - k1) / 12)); } return f; }
  const hornsAt = (k) => horns.filter(h => k >= h.k0 && k < h.k0 + h.nRise + h.nHold + h.nFall);

  /* ---------------- relief: the painting ---------------- */
  function relief(s, z, face, u){
    const env = reliefEnv(z); if(env <= 0) return 0;
    if(V.relief === 'pillows'){
      if(face < 0) return 0;                                             // corners stay clean
      const n = V.pillowsPerFace;
      const across = (1 - Math.cos(TAU * n * u)) / 2;                    // n pillows along the face, zero at both edges
      const rows = (1 - Math.cos(TAU * n * z / H_W)) / 2;                // n rows over the height, zero at foot and top
      return env * V.reliefAmp * across * rows;
    }
    if(V.relief === 'spiral'){
      const phase = TAU * (V.wavesAround * s / P - z / V.waveRise_mm);
      return env * V.reliefAmp * Math.sin(phase);
    }
    return 0;
  }

  /** the section at height z, layer k: world-frame CCW polyline starting at material s = 0 */
  function section(z, k, withRelief = true){
    const pts = [], sList = [];
    for(let i = 0; i < NPHI; i++){
      const s = P * i / NPHI;
      const [bx, by, nx, ny, face, u] = sq.at(s);
      const d = (withRelief ? relief(s, z, face, u) : 0) + hornBump(s, k);
      pts.push(rot([bx + nx * d, by + ny * d], tw(z)));
      sList.push(s);
    }
    return { pts, sList };
  }

  /* ---------------- the wall ---------------- */
  const layers = [];
  let prev = null, worstMove = 0, worstMoveK = null, maxGap = 0;
  for(let k = 0; k < N_WALL; k++){
    const z = k * LH, zm = (k + 0.5) * LH;
    const K = Kat(zm), mIdx = NPHI / K;
    if(!Number.isInteger(mIdx)) throw new Error(`NPHI ${NPHI} is not a multiple of K ${K}`);
    const { pts } = section(zm, k);
    const w = wallAt(zm);
    let e = tabAt(zm);
    const [web, band] = grammarAt(zm);
    if(web === 'perp') e = 0;
    const amp = V.ampWave * w * reliefEnv(zm) * ampEnv(k);
    const cl = pts.concat([pts[0]]); const cum = [0];
    for(let i = 0; i + 1 < cl.length; i++) cum.push(cum[cum.length - 1] + hyp(cl[i + 1][0] - cl[i][0], cl[i + 1][1] - cl[i][1]));
    const total = cum[cum.length - 1];
    let nodesU = []; for(let j = 0; j < K; j++) nodesU.push(cum[j * mIdx]);
    nodesU = densifyNodes(nodesU, total, true, GAP_MAX);
    const rec = record(pts, true, nodesU, w, e, web, total / 4, amp, `${o.variant}-ring`);
    maxGap = Math.max(maxGap, rec.maxNodeGap);
    if(prev){ let mv = 0; for(let i = 0; i < NPHI; i++) mv = Math.max(mv, hyp(pts[i][0] - prev[i][0], pts[i][1] - prev[i][1])); if(mv > worstMove){ worstMove = mv; worstMoveK = k; } }
    prev = pts;
    let phase = band; if(hornsAt(k).length) phase = 'horns';
    layers.push({ k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: rr(w, 3), tab: rr(e, 3), web, phase, contours: [rec] });
    if(k > 0 && layers[k - 1].phase !== phase) events.push({ z: rr(z, 2), k, event: `${layers[k - 1].phase} -> ${phase}` });
  }

  /* ---------------- the roof: rim ring + one serpentine per layer ---------------- */
  const roofLayers = [];
  const wR = V.wRoof, eR = V.eRoof;
  const zTopWall = N_WALL * LH;
  const { pts: rimPts } = section(zTopWall + 0.5 * LH, N_WALL, false);        // no relief on the rim; the twist at the top
  const rimTwist = tw(zTopWall + 0.5 * LH);
  const rimCum = [0]; { const cl = rimPts.concat([rimPts[0]]); for(let i = 0; i + 1 < cl.length; i++) rimCum.push(rimCum[rimCum.length - 1] + hyp(cl[i + 1][0] - cl[i][0], cl[i + 1][1] - cl[i][1])); }
  const rimTotal = rimCum[rimCum.length - 1];
  const KR = Kat(H_W - 0.01), mR = NPHI / KR;
  let rimNodes = []; for(let j = 0; j < KR; j++) rimNodes.push(rimCum[j * mR]);
  rimNodes = densifyNodes(rimNodes, rimTotal, true, GAP_MAX);
  // outer rail polygon (chord ends and hops live here), in the UN-twisted frame; a 90-degree twist keeps a square axis-aligned
  const unrot = (p) => rot(p, -rimTwist);
  const railOff = wR / 2 + 0.3;
  const rail = []; for(let i = 0; i < NPHI; i++){ const [bx, by, nx, ny] = sq.at(P * i / NPHI); rail.push([bx + nx * railOff, by + ny * railOff]); }
  const railCum = [0]; for(let i = 0; i < NPHI; i++){ const a = rail[i], b = rail[(i + 1) % NPHI]; railCum.push(railCum[railCum.length - 1] + hyp(b[0] - a[0], b[1] - a[1])); }
  const railP = railCum[NPHI];
  const railAt = (u) => { u = ((u % railP) + railP) % railP; let i = 0; while(i < NPHI - 1 && railCum[i + 1] < u) i++; const a = rail[i], b = rail[(i + 1) % NPHI], t = (u - railCum[i]) / (railCum[i + 1] - railCum[i] || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  /** the two crossings of the horizontal line y=y0 with the rail: returns [{u,x}] left and right */
  function crossings(y0){
    const hits = [];
    for(let i = 0; i < NPHI; i++){
      const a = rail[i], b = rail[(i + 1) % NPHI];
      if((a[1] - y0) * (b[1] - y0) <= 0 && a[1] !== b[1]){ const t = (y0 - a[1]) / (b[1] - a[1]); hits.push({ u: railCum[i] + t * (railCum[i + 1] - railCum[i]), x: a[0] + (b[0] - a[0]) * t }); }
    }
    hits.sort((p, q) => p.x - q.x);
    if(hits.length < 2) throw new Error(`line y=${y0} does not cross the rail twice`);
    return [hits[0], hits[hits.length - 1]];
  }
  /** walk the rail from u0 to u1 the short way, sampled every 0.5 mm */
  function hop(u0, u1){
    let d = ((u1 - u0) % railP + railP) % railP; if(d > railP / 2) d -= railP;
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.5)), out = [];
    for(let j = 1; j <= n; j++) out.push(railAt(u0 + d * j / n));
    return out;
  }
  const innerSpan = S - wR;                                                   // clear span between the inner rails
  const schedule = [];                                                        // [{level, n, dir}] per roof layer
  V.roof.levels.forEach((n, li) => {
    const count = V.roof.layersPerLevel[li];
    for(let j = 0; j < count; j++){
      let dir; if(li === 0 && V.roof.firstLevelRepeat) dir = (j < count / 2) ? 'X' : 'Y'; else dir = j % 2 === 0 ? 'X' : 'Y';
      schedule.push({ level: li + 1, n, dir });
    }
  });
  const gateView = [];
  let prevDir = null, prevPitch = null, prevN = null, prevLevel = null;
  schedule.forEach((st, j) => {
    const k = N_WALL + j, z = k * LH;
    const lines = []; for(let i = 1; i < st.n; i++) lines.push(innerSpan * (i / st.n - 0.5));
    // serpentine in the X frame (lines are y = const); for Y we swap x/y
    const swap = st.dir === 'Y';
    let pathPts = [];
    let prevEndU = null;
    lines.forEach((y0, li) => {
      const [L, R] = crossings(y0);
      const leftToRight = li % 2 === 0;
      const from = leftToRight ? L : R, to = leftToRight ? R : L;
      if(prevEndU !== null) pathPts.push(...hop(prevEndU, from.u));
      const chord = resample([[from.x, y0], [to.x, y0]], 0.5);
      pathPts.push(...(prevEndU === null ? chord : chord.slice(1)));
      prevEndU = to.u;
    });
    if(swap) pathPts = pathPts.map(([x, y]) => [y, x]);
    pathPts = pathPts.map(p => rot(p, rimTwist)).map(([x, y]) => [rr(x, 3), rr(y, 3)]);
    // gate's view of the free span in this layer: the previous roof layer's crossing pitch (perpendicular), or the full span
    const pitch = innerSpan / st.n;
    let freeSpan;
    if(prevDir === null) freeSpan = innerSpan;
    else if(prevDir === st.dir) freeSpan = gateView[gateView.length - 1].freeSpan_mm;   // same direction: rests on nothing new
    else freeSpan = prevPitch;
    gateView.push({ k, z: rr(z, 3), level: st.level, grid: `${st.n}x${st.n}`, dir: st.dir, lines: lines.length, pitch_mm: rr(pitch, 2), freeSpan_mm: rr(freeSpan, 2),
      inQualifiedDomain: freeSpan <= EVIDENCED_BRIDGE_MM, pathLength_mm: rr(pathPts.slice(1).reduce((a, p, i) => a + hyp(p[0] - pathPts[i][0], p[1] - pathPts[i][1]), 0), 1) });
    if(prevDir !== st.dir || prevLevel !== st.level){ prevPitch = pitch; }
    prevDir = st.dir; prevN = st.n; prevLevel = st.level;
    const rec = record(rimPts, true, rimNodes, wR, eR, 'staple', null, 0, 'crown-ring');
    const paths = [{ pts: pathPts, role: 'bridge', closed: false, speed: V.bridgeSpeed, label: `grid-L${st.level}-${st.n}x${st.n}-${st.dir}`, tile: 'crown',
      intent: `${PROCESS}: level ${st.level} (${st.n}x${st.n}), ${st.dir} lines, layer ${j + 1} of ${schedule.length}` }];
    roofLayers.push({ k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: wR, tab: eR, web: 'staple', phase: 'crown-grid', contours: [rec], paths });
  });
  events.push({ z: rr(zTopWall, 2), k: N_WALL, event: `wall -> crown-grid (${PROCESS})` });
  const allLayers = layers.concat(roofLayers);

  /* ---------------- foundation: rings + spokes + the floor skeleton ---------------- */
  const { pts: basePts } = section(0.5 * LH, 0);
  function offsetRing(d){
    const n = basePts.length, out = [];
    for(let i = 0; i < n; i++){ const [x0, y0] = basePts[(i - 1 + n) % n], [x1, y1] = basePts[(i + 1) % n]; const tx = x1 - x0, ty = y1 - y0, dd = hyp(tx, ty) || 1; const [px, py] = basePts[i]; out.push([rr(px + ty / dd * d, 2), rr(py - tx / dd * d, 2)]); }
    out.push(out[0]); return out;
  }
  const foundation = [];
  const w0 = layers[0].w, FOUNDATION = 6.0;
  const ringOffsets = [-(w0 / 2 + 1.0), -(w0 / 2 + 2.0)];
  for(let i = 0; i < FOUNDATION; i++) ringOffsets.push(w0 / 2 + 1.0 + 1.0 * i);
  for(const d of ringOffsets) foundation.push(offsetRing(d));
  const nSp = 48;
  for(let s = 0; s < nSp; s++){
    const i = Math.round(s * NPHI / nSp) % NPHI;
    const [x0, y0] = basePts[(i - 1 + NPHI) % NPHI], [x1, y1] = basePts[(i + 1) % NPHI]; const tx = x1 - x0, ty = y1 - y0, dd = hyp(tx, ty) || 1; const [px, py] = basePts[i];
    const din = ringOffsets[1] - 0.6, dout = ringOffsets[ringOffsets.length - 1] + 0.6;
    foundation.push([[rr(px + ty / dd * din, 2), rr(py - tx / dd * din, 2)], [rr(px + ty / dd * dout, 2), rr(py - tx / dd * dout, 2)]]);
  }
  // the floor: the roof's first grid, drawn on the bed inside the innermost ring (one island with holes)
  const innerRing = offsetRing(ringOffsets[1] - 0.6).slice(0, -1);
  const floorSpan = S - w0 - 4.0;
  const floorLines = [];
  for(let i = 1; i < V.floorLines; i++) floorLines.push(floorSpan * (i / V.floorLines - 0.5));
  function ringCross(y0, vertical){
    const hits = [];
    for(let i = 0; i < innerRing.length; i++){ const a = innerRing[i], b = innerRing[(i + 1) % innerRing.length]; const [a1, b1] = vertical ? [a[0], b[0]] : [a[1], b[1]]; if((a1 - y0) * (b1 - y0) <= 0 && a1 !== b1){ const t = (y0 - a1) / (b1 - a1); hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
    hits.sort((p, q) => vertical ? p[1] - q[1] : p[0] - q[0]);
    return [hits[0], hits[hits.length - 1]];
  }
  for(const y0 of floorLines){ const [a, b] = ringCross(y0, false); foundation.push([[rr(a[0] - 0.6, 2), rr(a[1], 2)], [rr(b[0] + 0.6, 2), rr(b[1], 2)]]); }
  for(const x0 of floorLines){ const [a, b] = ringCross(x0, true); foundation.push([[rr(a[0], 2), rr(a[1] - 0.6, 2)], [rr(b[0], 2), rr(b[1] + 0.6, 2)]]); }

  /* ---------------- checks that refuse ---------------- */
  const xs = [], ys = [];
  for(const lay of allLayers){ for(const c of lay.contours) for(const p of c.pts){ xs.push(p[0]); ys.push(p[1]); } for(const p of (lay.paths || [])) for(const q of p.pts){ xs.push(q[0]); ys.push(q[1]); } }
  for(const pth of foundation) for(const p of pth){ xs.push(p[0]); ys.push(p[1]); }
  const size = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), rr((N_WALL + schedule.length) * LH, 2)];
  if(size[0] + 16 > m.plate[0] || size[1] + 16 > m.plate[1]) violations.push(`${size[0].toFixed(1)} x ${size[1].toFixed(1)} mm does not fit ${m.plate.join(' x ')} with an 8 mm margin`);
  let worstConcave = 1e9;
  for(let li = 0; li < allLayers.length; li += 5){
    const lay = allLayers[li];
    for(const c of lay.contours){ const rc = minConcaveRadius(c.pts.slice(0, -1)); const need = c.w / 2 + c.e + BEAD; if(rc < need) violations.push(`layer ${lay.k} z=${lay.zBot}: concave radius ${rc.toFixed(2)} < w/2+e+bead ${need.toFixed(2)}`); worstConcave = Math.min(worstConcave, rc); }
  }
  const hornLayers = layers.filter(l => l.phase === 'horns').length;
  if(worstMove > REACH + 0.9 && !hornLayers) violations.push(`layer-to-layer move ${worstMove.toFixed(3)} mm at layer ${worstMoveK} beyond reach+tab`);
  const firstSpan = gateView[0].freeSpan_mm;
  if(firstSpan > V.declaredBridge) violations.push(`first roof span ${firstSpan} mm exceeds the declared ceiling ${V.declaredBridge} mm`);
  if(m.beadSource !== 'measured' && !o.allowAssumedBead) violations.push(`machine ${m.id}: bead ${BEAD} is ${m.beadSource}; pass --allow-assumed-bead (and --i-know-the-bead-is-a-guess to weft.mjs) to build anyway`);

  /* ---------------- summary ---------------- */
  const outerSide = rr(S + V.wFoot, 1);
  const summary = {
    name: o.name || `KOCKA_${V.title}_${m.id.toUpperCase()}_X1`, variant: o.variant, title: V.title, concept: V.concept,
    generator: 'core/weft_cube_geometry.mjs', generatedAt: new Date().toISOString().slice(0, 10),
    machine: m.id, machineLabel: m.label,
    machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    size_mm: [rr(size[0], 1), rr(size[1], 1), size[2]], outerSide_mm: outerSide, wallHeight_mm: rr(H_W, 2), wallLayers: N_WALL, roofLayers: schedule.length, totalLayers: allLayers.length,
    args: { lh: LH, bead: BEAD, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12, w: V.wBody, e: 0.7, r0: rr(S / 2, 2), K: Math.max(...V.K.map(k => k[1])), foundation: FOUNDATION,
      maxbridge: V.declaredBridge, maxcantilever: 4.8, allow: ALLOW, minanchor: 0.5, maxCapRadius: 20, speed: V.speed, bridgeSpeed: V.bridgeSpeed, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'experimental admission ceiling for the roof skeleton, not a claim that it will not sag', bridge_mm: V.declaredBridge, cantilever_mm: 4.8, membrane_min_anchor: 0.5, first_layer_max_islands: 1,
      secondGate_mm: EVIDENCED_BRIDGE_MM, secondGateRule: 'every finding at the evidenced ceiling must lie in a declared zone (roof, horns)' },
    body: { sideCentre_mm: S, corner_mm: C, turns: TURNS, twist_deg: rr(360 * TURNS, 1), wall: { foot: V.wFoot, body: V.wBody, top: V.wTop, roofRing: wR }, tab: { foot: 0.7, upper: 0.9, roofRing: eR },
      grammarBands: V.bands.map(([lo, hi, g, name]) => ({ from_z: rr(lo * H_W, 1), to_z: rr(Math.min(hi, 1) * H_W, 1), web: g, name })),
      weldColumns: V.K.map(([lo, k]) => ({ from_z: rr(lo * H_W, 1), K: k })), nodePitch_mm: rr(P / Math.max(...V.K.map(k => k[1])), 2), maxNodeGap_mm: maxGap,
      relief: V.relief === 'pillows' ? { kind: 'pillows', perFace: V.pillowsPerFace, rows: V.pillowsPerFace, amplitude_mm: V.reliefAmp, note: 'smooth (1-cos)/2 x (1-cos)/2 bumps, zero on every edge and on the corners' }
        : { kind: 'spiral wave', wavesAround: V.wavesAround, rise_mm_per_turn: V.waveRise_mm, amplitude_mm: V.reliefAmp, note: 'sin(2pi(n s/P - z/rise)) — climbs helically; fades over the foot and under the roof' },
      breathingWall: { amplitudeFraction: V.ampWave, wavelength: 'one wave per face' },
      horns: horns.map(h => ({ P_mm: h.P, rate_mm_per_layer: h.rate, at_s_mm: rr(h.sC, 1), zStart: rr(h.k0 * LH, 2), zEnd: rr((h.k0 + h.nRise + h.nHold + h.nFall) * LH, 2), where: 'corner' })),
      worstLayerMove_mm: rr(worstMove, 3), worstLayerMoveAt: worstMoveK, reachWithTab_mm: rr(REACH + 0.7, 3), minConcaveRadius_mm: rr(worstConcave, 2) },
    roof: { process: PROCESS, physicalStatus: 'experimental', schedule: `${V.roof.levels.join(' -> ')} (base ${V.roof.base})`, innerSpan_mm: rr(innerSpan, 2), layers: schedule.length, thickness_mm: rr(schedule.length * LH, 2),
      rule: 'each level\'s chords rest on the previous level\'s perpendicular chords at the crossings; the free span the gate sees is the previous level\'s pitch',
      perLayer: gateView, firstFreeSpan_mm: firstSpan, firstLevelRepeatedInSameDirection: V.roof.firstLevelRepeat,
      oneLinePerLayer: 'rim ring (woven) + one serpentine over the void; two travels per roof layer (ring -> serpentine, serpentine -> next ring), both inside the cube',
      evidenceBasis: 'GORA crown-woven-iris/v1 closed a 31 mm hole with straight chords in three directions (2026-09-06, photographs read 2026-09-08); OBLAK/GORA lintels 30/40/50 mm held; LIMIT16: 16 mm continuous on both machines',
      expected: 'the first roof layer\'s chords sag by a few mm at mid-span (the gate cannot see sag); later levels either pull the mesh taut or bridge over the sagged skeleton with air beneath — the measurement is the sag at the centre and at the quarter points, per level, against a rule' },
    floor: { lines: V.floorLines, kind: 'the roof\'s first grid drawn on the bed inside the innermost ring; one island with holes' },
    foundation: { paths: foundation.length, rings: ringOffsets.length, spokes: nSp, islandsExpected: 1, kind: 'rings+spokes+floor' },
    experiments: {
      declaredBridgeCeiling_mm: V.declaredBridge, evidencedBridge_mm: EVIDENCED_BRIDGE_MM,
      crown: { process: PROCESS, physicalStatus: 'experimental', schedule: V.roof.levels, layers: schedule.length, firstLayerFreeSpan_mm: firstSpan, laterLayersMaxFreeSpan_mm: rr(Math.max(...gateView.slice(1).map(g => g.freeSpan_mm)), 2) },
      horns: horns.map(h => ({ P_mm: h.P, rate_mm_per_layer: h.rate, zStart: rr(h.k0 * LH, 2), zEnd: rr((h.k0 + h.nRise + h.nHold + h.nFall) * LH, 2) })),
      protocol: 'gate at the declared ceiling must be clean; gate at the evidenced ceiling must attribute every finding to the roof or a horn zone, otherwise the build is refused',
    },
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'rings+spokes+floor', paths: foundation }, layers: allLayers };

  /* ---------------- preview ---------------- */
  function svg(){
    const Wv = 900, Hv = 560, els = [];
    const COL = { staple: '#f6ff78', perp: '#79f79b', sine: '#45d9c0', eight: '#ff9f6b', diagonal: '#78a7ff' };
    const LEV = ['#ff4d6d', '#ffb347', '#7cff5e', '#5ec8ff'];
    // oblique stack of the body
    const ox = 170, oy = 500, sc = 2.2;
    for(let li = 0; li < allLayers.length; li += 4){
      const lay = allLayers[li], z = lay.zBot;
      for(const c of lay.contours){
        const pts = c.pts.map(p => `${(ox + p[0] * sc).toFixed(1)},${(oy - z * sc * 1.0 - p[1] * sc * 0.36).toFixed(1)}`).join(' ');
        els.push(`<polyline points="${pts}" fill="none" stroke="${lay.phase === 'crown-grid' ? '#ffffff' : (COL[c.web] || '#fff')}" stroke-width=".55" opacity=".8"/>`);
      }
      for(const p of (lay.paths || [])){
        const pts = p.pts.map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - z * sc - q[1] * sc * 0.36).toFixed(1)}`).join(' ');
        els.push(`<polyline points="${pts}" fill="none" stroke="#ff4d6d" stroke-width=".6" opacity=".9"/>`);
      }
    }
    // top view: foundation + roof levels
    const tx = 640, ty = 200, ts = 2.4;
    for(const pth of foundation){ const pts = pth.map(p => `${(tx + p[0] * ts).toFixed(1)},${(ty - p[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="#5a6b85" stroke-width=".5"/>`); }
    roofLayers.forEach((lay, j) => { const st = schedule[j]; for(const p of lay.paths){ const pts = p.pts.map(q => `${(tx + q[0] * ts).toFixed(1)},${(ty - q[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="${LEV[st.level - 1]}" stroke-width="${(1.1 - 0.25 * (st.level - 1)).toFixed(2)}" opacity=".85"/>`); } });
    { const c = roofLayers[0].contours[0]; const pts = c.pts.map(p => `${(tx + p[0] * ts).toFixed(1)},${(ty - p[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="1"/>`); }
    // unrolled elevation: relief as brightness (s along, z up)
    const ux = 470, uy = 540, us = 340 / P, uz = 150 / H_W;
    for(let k = 0; k < N_WALL; k += 3){
      const zm = (k + 0.5) * LH; const { pts, sList } = section(zm, k);
      for(let i = 0; i < NPHI; i += 2){
        const [bx, by, nx, ny] = sq.at(sList[i]); const p = rot(pts[i], -tw(zm)); const d = (p[0] - bx) * nx + (p[1] - by) * ny;
        const v = clamp(0.5 + d / 4, 0, 1); const g = Math.round(40 + 200 * v);
        els.push(`<rect x="${(ux + sList[i] * us).toFixed(1)}" y="${(uy - zm * uz).toFixed(1)}" width="${(2 * P / NPHI * us).toFixed(2)}" height="${(3 * LH * uz).toFixed(2)}" fill="rgb(${g},${Math.round(g * 0.9)},${Math.round(g * 0.6)})"/>`);
      }
    }
    const legend = V.roof.levels.map((n, i) => `<tspan fill="${LEV[i]}">${n}x${n}</tspan>`).join('  ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>${els.join('')}`
      + `<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="13">${summary.name} — ${V.concept}</text>`
      + `<text x="12" y="38" fill="#9bb0c8" font-family="sans-serif" font-size="10">${size[0].toFixed(0)} x ${size[1].toFixed(0)} x ${size[2].toFixed(1)} mm · ${m.label} · bead ${BEAD} (${m.beadSource}) · ${allLayers.length} layers · roof ${schedule.length} layers, first span ${firstSpan} mm</text>`
      + `<text x="${tx - 90}" y="${ty + 105}" fill="#9bb0c8" font-family="sans-serif" font-size="10">roof from above — levels ${legend}</text>`
      + `<text x="${ux}" y="${uy + 14}" fill="#9bb0c8" font-family="sans-serif" font-size="10">the four faces unrolled, relief as brightness (s along the perimeter, z up)</text></svg>`;
  }
  return { payload, summary, violations, warnings, svg };
}

/* ---------------- CLI ---------------- */
function main(argv){
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const variant = opt('variant'), machine = opt('machine'), out = opt('out');
  if(!variant || !machine || !out){ console.error('usage: node core/weft_cube_geometry.mjs --variant tkanje|vrtlog --machine a2l|ender --out FILE [--side S] [--H H] [--svg FILE] [--name NAME] [--allow-assumed-bead]'); process.exit(2); }
  const r = generateCube({ variant, machine, side: opt('side'), H: opt('H'), name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') });
  for(const w of r.warnings) console.error('note: ' + w);
  if(r.violations.length){ console.error('REFUSED:'); for(const v of r.violations) console.error('  * ' + v); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  if(opt('svg')) fs.writeFileSync(opt('svg'), r.svg());
  const s = r.summary;
  console.log(JSON.stringify({ name: s.name, machine: s.machineLabel, size_mm: s.size_mm, layers: s.totalLayers, roof: s.roof.schedule, firstFreeSpan_mm: s.roof.firstFreeSpan_mm,
    roofPerLayer: s.roof.perLayer.map(g => `${g.grid}${g.dir}:${g.freeSpan_mm}`), worstLayerMove_mm: s.body.worstLayerMove_mm, minConcaveRadius_mm: s.body.minConcaveRadius_mm, maxNodeGap_mm: s.body.maxNodeGap_mm, events: s.events.length }, null, 1));
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
