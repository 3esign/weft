/* WEFT — ZIGURAT: a stepped pyramid as nested woven tubes with hierarchical chord terraces (2026-09-17).

   A stepped pyramid whose every tier stood on the roof of the tier below would need a chord across the
   whole opening of the bottom tier (275 mm on the A2L) — nothing in the evidence spans that. So the
   pyramid is N concentric rounded-square tubes, all founded on the bed as ONE first-layer island (rings,
   spokes, ribs between the tubes, the floor grid inside the innermost), the outer tube the lowest, the
   inner the tallest. Where a tube ends, a terrace bridges the gap to the next tube: chords from the
   ending rim to the standing wall (the OBLAK/GORA lintel class, ~35 mm sides, ~50 mm on the corner
   diagonals), then a diamond lattice resting on those chords (qualified spans), then fine chords resting
   on the diamonds. The innermost tube closes with the hierarchical grid roof of the cube generator
   (3 -> 9 -> 27 or 2 -> 4 -> 8 -> 16). From outside: a ziggurat. From inside: nested lattices.

   Every tube's visible skin (between the terrace below it and its own top) carries its own painting —
   one grammar per tier, a relief that scales with the tier; the hidden lengths (a tube below the
   terrace of the tube outside it) are plain staple at half the node density: structure, not surface.

   usage: node core/weft_ziggurat_geometry.mjs --variant tkanje|vrtlog --machine a2l|ender --out FILE
          [--footprint MM] [--H MM] [--tiers N] [--svg FILE] [--name NAME] [--allow-assumed-bead]     */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSquare, record, densifyNodes, minConcaveRadius, resample, clamp, smooth, lerp, rr, loadMachine, EVIDENCED_BRIDGE_MM } from './weft_cube_geometry.mjs';

const TAU = 2 * Math.PI, hyp = Math.hypot;
export const PROCESS_ROOF = 'crown-woven-grid/v1';
export const PROCESS_TERRACE = 'terrace-woven-annulus/v1';

export const VARIANTS = {
  tkanje: {
    title: 'TKANJE', concept: 'the sampler ziggurat: one grammar per tier, a quilt of pillows that scales with the tier, a twist that accelerates upward (0, 15, 30, 45 degrees per tier — 90 in all), Peano roof 3-9-27',
    tiers: 4, heightRatio: 0.55, topSideMax: 60, turns: [0, 1 / 24, 1 / 12, 1 / 8],
    grammars: ['staple', 'diagonal', 'sine', 'eight', 'perp'], relief: 'pillows', reliefAmp: 1.4, pillowSize_mm: 22, ampWave: 0.15,
    roof: { base: 3, levels: [3, 9, 27], layersPerLevel: [4, 4, 4], firstLevelRepeat: true },
    hornsOnTop: false, floorLines: 3, speed: 30, bridgeSpeed: 18, declaredBridge: 60, K: 48, hiddenK: 24,
  },
  vrtlog: {
    title: 'VRTLOG', concept: 'the wrung ziggurat: the base square, the middle tier wrung an eighth of a turn, the top wrung back, helical columns, a wave that climbs, horns on the top corners, Hilbert roof 2-4-8-16',
    tiers: 3, heightRatio: 0.55, topSideMax: 52, turns: [0, 1 / 8, -1 / 8],
    grammars: ['sine', 'sine', 'sine', 'sine'], relief: 'spiral', reliefAmp: 1.4, wavesAround: 4, waveRise_mm: 24, ampWave: 0.25,
    roof: { base: 2, levels: [2, 4, 8, 16], layersPerLevel: [4, 4, 2, 2], firstLevelRepeat: true },
    hornsOnTop: true, horn: { P_mm: 8, rate: 0.8, zFrac: 0.45 }, floorLines: 2, speed: 26, bridgeSpeed: 15, declaredBridge: 52, K: 48, hiddenK: 24,
  },
};

/* ---------------- polygon helpers ---------------- */
function cumOf(poly){ const c = [0]; for(let i = 0; i < poly.length; i++){ const a = poly[i], b = poly[(i + 1) % poly.length]; c.push(c[c.length - 1] + hyp(b[0] - a[0], b[1] - a[1])); } return c; }
function polyAt(poly, cum, u){ const P = cum[poly.length]; u = ((u % P) + P) % P; let i = 0; while(i < poly.length - 1 && cum[i + 1] < u) i++; const a = poly[i], b = poly[(i + 1) % poly.length], t = (u - cum[i]) / ((cum[i + 1] - cum[i]) || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
/** first hit of the ray p + t d (t > tmin) with a closed polygon: {pt, u, t} or null */
function rayHit(poly, cum, p, d, tmin = 0.5){
  let best = null;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex; if(Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den, s = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
    if(t > tmin && s >= 0 && s <= 1 && (!best || t < best.t)) best = { t, pt: [p[0] + d[0] * t, p[1] + d[1] * t], u: cum[i] + s * (cum[i + 1] - cum[i]) };
  }
  return best;
}
function hopAlong(poly, cum, u0, u1, step = 0.5){ const P = cum[poly.length]; let d = ((u1 - u0) % P + P) % P; if(d > P / 2) d -= P; const n = Math.max(1, Math.ceil(Math.abs(d) / step)), out = []; for(let j = 1; j <= n; j++) out.push(polyAt(poly, cum, u0 + d * j / n)); return out; }
function offsetPoly(pts, d){ const n = pts.length, out = []; for(let i = 0; i < n; i++){ const [x0, y0] = pts[(i - 1 + n) % n], [x1, y1] = pts[(i + 1) % n]; const tx = x1 - x0, ty = y1 - y0, dd = hyp(tx, ty) || 1; out.push([pts[i][0] + ty / dd * d, pts[i][1] - tx / dd * d]); } return out; }
const rot = ([x, y], t) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
const pathLen = (pts) => pts.slice(1).reduce((a, p, i) => a + hyp(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/* ============================================================================================ */
export function generateZiggurat(o){
  const V = VARIANTS[o.variant]; if(!V) throw new Error(`variant must be one of ${Object.keys(VARIANTS).join(', ')}`);
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh, FIRST_BEAD = m.firstLayerBead, ALLOW = 0.6, REACH = BEAD / 2 + ALLOW, GAP_MAX = 9.5;
  const K_MAX = 192;
  const MARGIN = o.margin != null ? +o.margin : 15;
  const FOOTPRINT = o.footprint != null ? +o.footprint : Math.min(m.plate[0], m.plate[1]) - 2 * MARGIN;   // outer size incl. brim
  const N_T = o.tiers != null ? +o.tiers : V.tiers;
  const BRIM = 6.0, W_FOOT = 3.4, W_BODY = 3.0, W_ROOF = 2.8, E_ROOF = 1.2;
  const S0 = FOOTPRINT - 2 * (BRIM + 1.0) - W_FOOT;                       // outermost tube, centreline side
  const topSide = Math.min(V.topSideMax, S0 * 0.3);
  const gapC = (S0 - topSide) / (N_T - 1);                                 // centreline side step per tier
  const sides = []; for(let i = 0; i < N_T; i++) sides.push(rr(S0 - i * gapC, 2));
  const H_TOTAL = o.H != null ? +o.H : rr(FOOTPRINT * V.heightRatio, 1);
  const ROOF_LAYERS = V.roof.layersPerLevel.reduce((a, b) => a + b, 0), TERRACE_LAYERS = 6;
  const tierH = (H_TOTAL - ROOF_LAYERS * LH) / N_T;
  const kTop = []; for(let i = 0; i < N_T; i++) kTop.push(Math.round((i + 1) * tierH / LH));  // tube i's last wall layer (exclusive)
  const kTerraceEnd = kTop.map((k, i) => i < N_T - 1 ? k + TERRACE_LAYERS : k + ROOF_LAYERS);   // the top tube's rim carries the roof
  const K_LAYERS = Math.max(...kTerraceEnd);
  const corner = (S) => clamp(S * 0.05, 8, 10);                           // >= 8: the terrace fans land on the inner corner arcs; a smaller arc fuses the fan
  const squares = sides.map(S => makeSquare(S, corner(S)));
  const nphiOf = (i) => clamp(8 * Math.round(squares[i].P / 8), 240, 720);          // ~1 mm sampling of the contour
  /** weld columns per ring, the sculpture generator's rule: K_MAX halved until the pitch is >= 3 mm; the crossing grammars doubled while the pitch stays >= 2.3 */
  const kFor = (P, web) => { let K = K_MAX; while(K > 12 && P / K < 3.0) K = Math.floor(K / 2); if((web === 'sine' || web === 'eight' || web === 'diagonal') && P / (2 * K) >= 2.3) K *= 2; return K; };
  const warnings = [], violations = [], events = [];

  /* ---------------- per-tube programme ---------------- */
  const zBase = (i) => i === 0 ? 0 : kTop[i - 1] * LH;                    // where tube i becomes visible
  const zTopOf = (i) => kTop[i] * LH;
  const turnsOf = (i) => V.turns[i] || 0;                                  // the base tier stays square to the plate (a rotated square does not fit the footprint); the twist accelerates upward
  const twistBase = (i) => { let t = 0; for(let j = 0; j < i; j++) t += TAU * turnsOf(j); return t; };   // the tiers below, cumulative: one continuous spiral outside
  const twist = (i, z) => { const z0 = zBase(i), z1 = zTopOf(i); return twistBase(i) + TAU * turnsOf(i) * clamp((z - z0) / (z1 - z0), 0, 1); };
  const visible = (i, z) => z >= zBase(i) - 1e-9;
  const grammarOf = (i) => V.grammars[i % V.grammars.length];
  const reliefEnv = (i, z) => { const z0 = zBase(i), z1 = zTopOf(i); return smooth((z - z0) / 8.0) * (1 - smooth((z - (z1 - 6.0)) / 5.0)); };
  const pillowsFor = (i) => Math.max(2, Math.round(squares[i].flat / V.pillowSize_mm));
  function relief(i, s, z, face, u){
    if(!visible(i, z)) return 0;
    const env = reliefEnv(i, z); if(env <= 0) return 0;
    const z0 = zBase(i), z1 = zTopOf(i), f = (z - z0) / (z1 - z0);
    if(V.relief === 'pillows'){
      if(face < 0) return 0;
      const n = pillowsFor(i), rows = Math.max(1, Math.round((z1 - z0) / V.pillowSize_mm));
      return env * V.reliefAmp * (1 - Math.cos(TAU * n * u)) / 2 * (1 - Math.cos(TAU * rows * f)) / 2;
    }
    if(V.relief === 'spiral'){ const P = squares[i].P; return env * V.reliefAmp * Math.sin(TAU * (V.wavesAround * s / P - z / V.waveRise_mm)); }
    return 0;
  }
  /* horns on the top tube's corners (VRTLOG) */
  const horns = [];
  if(V.hornsOnTop){
    const i = N_T - 1, sq = squares[i], nRise = Math.ceil(V.horn.P_mm / V.horn.rate), k0 = Math.round((kTop[i - 1] || 0) + V.horn.zFrac * (kTop[i] - (kTop[i - 1] || 0)));
    for(const sC of sq.cornerCentresS) horns.push({ tube: i, sC, P: V.horn.P_mm, rate: V.horn.rate, k0, nRise, nHold: 4, nFall: nRise, half: 1.6 * V.horn.P_mm });   // gentle flanks: the concave radius at the base is 2 half^2 / (P pi^2), must clear w/2+e+bead
  }
  function hornBump(i, s, k){
    let add = 0; const P = squares[i].P;
    for(const h of horns){ if(h.tube !== i) continue; const j = k - h.k0; if(j < 0 || j >= h.nRise + h.nHold + h.nFall) continue;
      let d; if(j < h.nRise) d = Math.min(h.P, h.rate * (j + 1)); else if(j < h.nRise + h.nHold) d = h.P; else d = Math.max(0, h.P - h.rate * (j - h.nRise - h.nHold + 1));
      if(d <= 0) continue; let ds = ((s - h.sC + P / 2) % P + P) % P - P / 2; if(Math.abs(ds) < h.half) add += d * (0.5 + 0.5 * Math.cos(Math.PI * ds / h.half)); }
    return add;
  }
  const hornZone = horns.length ? [Math.min(...horns.map(h => h.k0)), Math.max(...horns.map(h => h.k0 + h.nRise + h.nHold + h.nFall))] : null;
  const ampEnv = (k) => { if(!hornZone) return 1; const [k0, k1] = hornZone; if(k0 - 12 <= k && k < k0) return smooth((k0 - k) / 12); if(k0 <= k && k < k1) return 0; if(k1 <= k && k < k1 + 12) return smooth((k - k1) / 12); return 1; };
  function wallAt(i, z){ const z0 = zBase(i); const dz = z - z0; if(i === 0) return dz < 8 ? W_FOOT : lerp(W_FOOT, W_BODY, smooth((dz - 8) / 12)); return W_BODY; }
  function tabAt(i, z){ const f = (z - zBase(i)) / (zTopOf(i) - zBase(i)); return f > 0.5 ? 0.9 : 0.7; }

  /** section of tube i at z (layer k): world-frame CCW polyline from material s=0 */
  function section(i, z, k, withRelief = true){
    const sq = squares[i], pts = [], sList = [], t = twist(i, z), NPHI = nphiOf(i);
    for(let j = 0; j < NPHI; j++){ const s = sq.P * j / NPHI; const [bx, by, nx, ny, face, u] = sq.at(s); const d = (withRelief ? relief(i, s, z, face, u) : 0) + hornBump(i, s, k); pts.push(rot([bx + nx * d, by + ny * d], t)); sList.push(s); }
    return { pts, sList };
  }

  const roofSchedule = [];
  V.roof.levels.forEach((n, li) => { const count = V.roof.layersPerLevel[li]; for(let j = 0; j < count; j++){ let dir; if(li === 0 && V.roof.firstLevelRepeat) dir = (j < count / 2) ? 'X' : 'Y'; else dir = j % 2 === 0 ? 'X' : 'Y'; roofSchedule.push({ level: li + 1, n, dir }); } });
  /* ---------------- the tubes, layer by layer ---------------- */
  const layers = [];
  const prevPts = new Array(N_T).fill(null); let worstMove = 0, worstMoveAt = null, maxGap = 0;
  const terraceInfo = [], roofInfo = { perLayer: [] };
  for(let k = 0; k < K_LAYERS; k++){
    const z = k * LH, zm = (k + 0.5) * LH;
    const contours = [], paths = [];
    let phase = `tier ${Math.min(N_T, kTop.findIndex(kt => k < kt) + 1) || N_T}`;
    for(let i = 0; i < N_T; i++){
      if(k >= kTerraceEnd[i]) continue;                                  // this tube has ended
      const isTerraceRing = k >= kTop[i];                                 // the ending rim during its terrace
      const vis = visible(i, zm) && !isTerraceRing;
      const web = isTerraceRing ? 'staple' : (vis ? grammarOf(i) : 'staple');
      const Kfull = kFor(squares[i].P, web);
      const K = (isTerraceRing || vis) ? Kfull : Math.max(24, Math.floor(kFor(squares[i].P, 'staple') / 2));   // hidden lengths: half the columns
      const { pts } = section(i, zm, k, vis); const NPHI = pts.length;
      const w = isTerraceRing ? W_ROOF : wallAt(i, zm);
      let e = isTerraceRing ? E_ROOF : tabAt(i, zm);
      if(web === 'perp') e = 0;
      const amp = vis ? V.ampWave * w * reliefEnv(i, zm) * ampEnv(k) : 0;
      const cum = cumOf(pts), total = cum[NPHI];
      let nodesU = []; for(let j = 0; j < K; j++) nodesU.push(total * j / K);                      // uniform along the ring, registered by material s
      nodesU = densifyNodes(nodesU, total, true, GAP_MAX);
      const rec = record(pts, true, nodesU, w, e, web, total / 4, amp, isTerraceRing ? `tube${i}-rim` : `tube${i}-ring`, i);
      maxGap = Math.max(maxGap, rec.maxNodeGap);
      if(prevPts[i]){ let mv = 0; for(let j = 0; j < NPHI; j++) mv = Math.max(mv, hyp(pts[j][0] - prevPts[i][j][0], pts[j][1] - prevPts[i][j][1])); if(mv > worstMove && !(hornZone && k >= hornZone[0] && k < hornZone[1])){ worstMove = mv; worstMoveAt = [i, k]; } }
      prevPts[i] = pts;
      contours.push(rec);
    }
    /* terraces: the rim of tube i during its 6 terrace layers, chords to tube i+1 */
    for(let i = 0; i < N_T - 1; i++){
      if(k < kTop[i] || k >= kTerraceEnd[i]) continue;
      const j = k - kTop[i];
      const tp = terracePaths(i, j, zm, k);
      paths.push(...tp.paths);
      if(j === 0) terraceInfo.push(tp.info);
      else terraceInfo[terraceInfo.length - 1].perLayer.push(tp.layerInfo);
      phase = `terrace ${i + 1}`;
    }
    /* the roof on the innermost tube */
    const iTop = N_T - 1;
    if(k >= kTop[iTop] && k < kTop[iTop] + ROOF_LAYERS){
      const j = k - kTop[iTop];
      const rp = roofPath(j, zm, k);
      paths.push(rp.path); roofInfo.perLayer.push(rp.info);
      phase = 'crown-grid';
      const rim = contours.find(c => c.tile === iTop); if(!rim) throw new Error(`roof layer ${k} has no rim ring`); rim.label = 'crown-ring';
    }
    if(hornZone && k >= hornZone[0] && k < hornZone[1]) phase = 'horns';
    const lay = { k, zBot: rr(z, 4), zTop: rr(z + LH, 4), phase, contours };
    if(paths.length) lay.paths = paths;
    layers.push(lay);
    if(k > 0 && layers[k - 1].phase !== phase) events.push({ z: rr(z, 2), k, event: `${layers[k - 1].phase} -> ${phase}` });
  }
  /* the innermost tube: its wall must run to kTop[iTop]; extend kTerraceEnd semantics — the roof layers above replaced the ring */

  /* ---------------- terrace geometry ---------------- */
  function terracePaths(i, j, zm, k){
    const outerC = section(i, zm, k, false).pts;                           // rim of tube i (no relief)
    const innerC = section(i + 1, zm, k, true).pts;                        // wall of tube i+1 as it is
    const outer = offsetPoly(outerC, W_ROOF / 2 + 0.3), oc = cumOf(outer), NPHI = outer.length;
    const wIn = wallAt(i + 1, zm);
    const innerTarget = offsetPoly(innerC, -(wIn / 2 + 0.3)), ic = cumOf(innerTarget);   // chords cross tube i+1's wall and end at its inner rail
    const sqO = squares[i], sqI = squares[i + 1];
    const gap = (sides[i] - sides[i + 1]) / 2;                              // centreline gap between the tubes
    const aIn = sides[i + 1] / 2 - (wIn / 2 + 0.3);                          // the inner target's half-side: a perpendicular chord from beyond it would miss the inner square
    const cIn = Math.max(1, corner(sides[i + 1]) - (wIn / 2 + 0.3));         // the inner target's corner radius
    const hi = aIn - cIn;                                                    // the inner target's straight half-length: beyond it a perpendicular chord would skim the inner corner
    const P = oc[NPHI];
    // stage j -> mode. Every layer must rest on the layer immediately below it (the gate's rule), so the stages alternate
    // between chords ACROSS the strip and chords ALONG it: radial (spans the gap) x2 -> a 4-turn spiral along the strip
    // resting on the radials every 9 mm -> fine radials (3 mm) resting on the spiral's loops -> an 8-turn spiral resting on
    // the fine radials -> diamonds on the sides + anti-diagonals across the corners, resting on the spiral's loops.
    const STAGES = hi >= gap ? ['radial', 'radial', 'spiral4', 'fine', 'spiral8', 'diamond'] : ['radial', 'radial', 'spiral4', 'fine', 'spiral8', 'fine'];   // diamonds need a strip longer than the gap
    const mode = STAGES[j];
    const pitch = mode === 'fine' ? 3.0 : 9.0;
    const slopeSign = -1;
    const paths = []; let spans = [];
    const tOut = twist(i, zm);
    if(mode === 'spiral4' || mode === 'spiral8'){
      /* one continuous square spiral from the outer rail (on the rim) to the inner rail (on the wall): a point at fraction f
         around and depth tau is the lerp of the two rails at the same fraction — the rails are the same rounded square
         rotated the same, so the loops stay concentric at the corners too. */
      const turns = mode === 'spiral4' ? 4 : 8;
      const Pi = ic[innerTarget.length];
      const nSamples = Math.ceil(turns * P / 0.5);
      let pts = [];
      for(let n = 0; n <= nSamples; n++){
        const f = turns * n / nSamples, frac = f - Math.floor(f), tau = f / turns;
        const a = polyAt(outer, oc, frac * P), b = polyAt(innerTarget, ic, frac * Pi);
        pts.push([a[0] + (b[0] - a[0]) * tau, a[1] + (b[1] - a[1]) * tau]);
      }
      pts = pts.map(([x, y]) => [rr(x, 3), rr(y, 3)]);
      spans.push(gap / turns);
      paths.push({ pts, role: 'bridge', closed: false, speed: V.bridgeSpeed, label: `terrace${i + 1}-${mode}-${j + 1}-0`, tile: `terrace${i + 1}`,
        intent: `${PROCESS_TERRACE}: terrace ${i + 1} (tube ${i} -> ${i + 1}, gap ${rr(gap, 1)} mm), stage ${mode} (${turns} turns, pitch ${rr(gap / turns, 1)} mm), layer ${j + 1} of ${TERRACE_LAYERS}` });
    } else {
      const nSt = Math.round(P / pitch);
      const pieces = [];
      let cornerSkip = 0;
      for(let n = 0; n < nSt; n++){
        const u = P * n / nSt, p = polyAt(outer, oc, u);
        const q = rot(p, -tOut);
        const ax = Math.abs(q[0]), ay = Math.abs(q[1]), sx = Math.sign(q[0]) || 1, sy = Math.sign(q[1]) || 1;
        const onRight = ax >= ay;
        const inCorner = onRight ? (ay > hi) : (ax > hi);
        let dir, target;
        if(mode === 'radial' && inCorner){ if(cornerSkip++ % 3 === 1) continue; }   // the converging fan at 2/3 of the side pitch
        if(mode === 'fine' && inCorner){ if(cornerSkip++ % 3 !== 0) continue; }      // the fine fan at 9 mm (a 3 mm fan fuses at the inner arc); it crosses the spiral's corner arcs, an anti-diagonal would run parallel to them
        if(mode === 'radial'){
          /* sides: perpendicular to the wall. Corner band: a fan converging on the inner corner's centre — the chords neither
             cross each other nor the side chords (a parallel -45° family from the band would land among the side chords). */
          if(inCorner){ const cx = sx * (aIn - cIn), cy = sy * (aIn - cIn); dir = [cx - q[0], cy - q[1]]; } else dir = onRight ? [-sx, 0] : [0, -sy];
          target = 'inner'; }
        else if(mode === 'fine'){
          /* sides: perpendicular at 3 mm (rest on the spiral's loops). Corners: the converging fan again, at 9 mm. */
          if(inCorner){ const cx = sx * (aIn - cIn), cy = sy * (aIn - cIn); dir = [cx - q[0], cy - q[1]]; } else dir = onRight ? [-sx, 0] : [0, -sy];
          target = 'inner'; }
        else { if(inCorner){ if(!onRight) continue; dir = [-sx, sy]; target = 'outer'; } else { dir = onRight ? [-sx, slopeSign] : [slopeSign, -sy]; target = 'inner'; } }
        const L = hyp(dir[0], dir[1]); dir = rot([dir[0] / L, dir[1] / L], tOut);
        const hit = rayHit(target === 'inner' ? innerTarget : outer, target === 'inner' ? ic : oc, p, dir, target === 'inner' ? 0.5 : 2.0);
        if(!hit) continue;
        if(target === 'inner' && hit.t > gap * 1.6 + 6) continue;
        const last = pieces[pieces.length - 1];
        if(last && last.target === target) last.chords.push({ from: p, uO: u, to: hit.pt, uT: hit.u });
        else pieces.push({ target, chords: [{ from: p, uO: u, to: hit.pt, uT: hit.u }] });
      }
      if(pieces.length > 1 && pieces[0].target === pieces[pieces.length - 1].target){ const lastP = pieces.pop(); pieces[0].chords = lastP.chords.concat(pieces[0].chords); }
      pieces.forEach((pc, pi) => {
        const tPoly = pc.target === 'inner' ? innerTarget : outer, tc = pc.target === 'inner' ? ic : oc;
        let pts = [];
        pc.chords.forEach((ch, ci) => {
          const inward = ci % 2 === 0;
          const a = inward ? ch.from : ch.to, b = inward ? ch.to : ch.from;
          if(ci > 0){ const prev = pc.chords[ci - 1]; if(inward) pts.push(...hopAlong(outer, oc, prev.uO, ch.uO)); else pts.push(...hopAlong(tPoly, tc, prev.uT, ch.uT)); }
          const chord = resample([a, b], 0.5);
          pts.push(...(ci === 0 ? chord : chord.slice(1)));
          spans.push(hyp(ch.to[0] - ch.from[0], ch.to[1] - ch.from[1]));
        });
        pts = pts.map(([x, y]) => [rr(x, 3), rr(y, 3)]);
        paths.push({ pts, role: 'bridge', closed: false, speed: V.bridgeSpeed, label: `terrace${i + 1}-${mode}-${j + 1}-${pi}`, tile: `terrace${i + 1}`,
          intent: `${PROCESS_TERRACE}: terrace ${i + 1} (tube ${i} -> ${i + 1}, gap ${rr(gap, 1)} mm), stage ${mode}, layer ${j + 1} of ${TERRACE_LAYERS}` });
      });
    }
    const believed = mode === 'radial' ? (j === 0 ? Math.max(...spans) : 0) : (mode === 'spiral4' ? 9.0 : mode === 'fine' ? gap / 4 : mode === 'spiral8' ? 3.0 : (gap / 8) * Math.SQRT2);   // the free span the gate should see: the previous layer's crossing pitch
    const layerInfo = { k, z: rr(zm - LH / 2, 3), stage: mode, pitch_mm: pitch, pieces: paths.length, chords: spans.length, longestChord_mm: rr(Math.max(...spans), 2), freeSpanBelieved_mm: rr(believed, 2), pathLength_mm: rr(paths.reduce((a, p) => a + pathLen(p.pts), 0), 0) };
    const info = { terrace: i + 1, between: [i, i + 1], z: rr(kTop[i] * LH, 2), gapCentreline_mm: rr(gap, 2), sideChord_mm: rr(gap - W_ROOF / 2 - 0.3 + wIn / 2 + 0.3, 1), cornerDiagonal_mm: rr(Math.max(...spans), 1), layers: TERRACE_LAYERS,
      schedule: 'radial x2 (spans the gap; corners on the diagonal) -> 4-turn spiral along the strip (rests on the radials every 9 mm) -> fine radials at 3 mm (rest on the loops) -> 8-turn spiral (rests on the fine radials) -> diamonds on the sides, anti-diagonals across the corners (rest on the loops); every layer rests on the one below', perLayer: [layerInfo] };
    return { paths, info, layerInfo };
  }

  /* ---------------- the roof on the innermost tube (the cube generator's grid, rebuilt here) ---------------- */
  function roofPath(j, zm, k){
    const i = N_T - 1, st = roofSchedule[j];
    const t = twist(i, zm);
    const rimC = section(i, zm, k, false).pts.map(p => rot(p, -t));
    const rail = offsetPoly(rimC, W_ROOF / 2 + 0.3), rc = cumOf(rail), NPHI = rail.length;
    const innerSpan = sides[i] - W_ROOF;
    const lines = []; for(let q = 1; q < st.n; q++) lines.push(innerSpan * (q / st.n - 0.5));
    const swap = st.dir === 'Y';
    const cross = (y0) => { const hits = []; for(let q = 0; q < NPHI; q++){ const a = rail[q], b = rail[(q + 1) % NPHI]; if((a[1] - y0) * (b[1] - y0) <= 0 && a[1] !== b[1]){ const tt = (y0 - a[1]) / (b[1] - a[1]); hits.push({ u: rc[q] + tt * (rc[q + 1] - rc[q]), x: a[0] + (b[0] - a[0]) * tt }); } } hits.sort((p, q) => p.x - q.x); return [hits[0], hits[hits.length - 1]]; };
    let pts = [], prevU = null;
    lines.forEach((y0, li) => { const [L, R] = cross(y0); const l2r = li % 2 === 0; const from = l2r ? L : R, to = l2r ? R : L; if(prevU !== null) pts.push(...hopAlong(rail, rc, prevU, from.u)); const chord = resample([[from.x, y0], [to.x, y0]], 0.5); pts.push(...(prevU === null ? chord : chord.slice(1))); prevU = to.u; });
    if(swap) pts = pts.map(([x, y]) => [y, x]);
    pts = pts.map(p => rot(p, t)).map(([x, y]) => [rr(x, 3), rr(y, 3)]);
    const prev = roofInfo.perLayer[roofInfo.perLayer.length - 1];
    const pitch = innerSpan / st.n;
    let free; if(!prev) free = innerSpan; else if(prev.dir === st.dir) free = prev.freeSpan_mm; else free = prev.pitch_mm;
    const info = { k, z: rr(zm - LH / 2, 3), level: st.level, grid: `${st.n}x${st.n}`, dir: st.dir, lines: lines.length, pitch_mm: rr(pitch, 2), freeSpan_mm: rr(free, 2), inQualifiedDomain: free <= EVIDENCED_BRIDGE_MM, pathLength_mm: rr(pathLen(pts), 0) };
    return { path: { pts, role: 'bridge', closed: false, speed: V.bridgeSpeed, label: `roof-L${st.level}-${st.n}x${st.n}-${st.dir}`, tile: 'crown', intent: `${PROCESS_ROOF}: level ${st.level} (${st.n}x${st.n}), ${st.dir} lines, layer ${j + 1} of ${roofSchedule.length}` }, info };
  }

  /* ---------------- foundation: rings + spokes around every tube, ribs between tubes, the floor ---------------- */
  const foundation = [];
  const baseSections = sides.map((S, i) => section(i, 0.5 * LH, 0, true).pts);
  const ringsOf = (pts, offsets) => offsets.map(d => { const o = offsetPoly(pts, d).map(([x, y]) => [rr(x, 2), rr(y, 2)]); o.push(o[0]); return o; });
  const spokesOf = (pts, din, dout, n) => { const out = [], NPHI = pts.length; for(let s = 0; s < n; s++){ const q = Math.round(s * NPHI / n) % NPHI; const [x0, y0] = pts[(q - 1 + NPHI) % NPHI], [x1, y1] = pts[(q + 1) % NPHI]; const tx = x1 - x0, ty = y1 - y0, dd = hyp(tx, ty) || 1; const [px, py] = pts[q]; out.push([[rr(px + ty / dd * din, 2), rr(py - tx / dd * din, 2)], [rr(px + ty / dd * dout, 2), rr(py - tx / dd * dout, 2)]]); } return out; };
  sides.forEach((S, i) => {
    const w0 = i === 0 ? W_FOOT : W_BODY, pts = baseSections[i];
    const offs = [-(w0 / 2 + 1.0), -(w0 / 2 + 2.0), w0 / 2 + 1.0, w0 / 2 + 2.0];
    if(i === 0) for(let b = 2; b < BRIM; b++) offs.push(w0 / 2 + 1.0 + b);
    foundation.push(...ringsOf(pts, offs));
    const NPHI = pts.length; const nSp = Math.max(24, Math.round(cumOf(pts)[NPHI] / 12));
    if(i === 0) foundation.push(...spokesOf(pts, -(w0 / 2 + 2.6), w0 / 2 + BRIM + 0.6, nSp));
    else foundation.push(...spokesOf(pts, -(w0 / 2 + 2.6), w0 / 2 + 2.6, nSp));
    // ribs across the gap to the next tube inward: from this tube's inner rings to the next tube's outer rings
    if(i < N_T - 1){ const nRib = Math.max(16, Math.round(cumOf(pts)[NPHI] / 18)); const target = offsetPoly(baseSections[i + 1], W_BODY / 2 + 2.0), tc = cumOf(target);
      for(let s = 0; s < nRib; s++){ const q = Math.round(s * pts.length / nRib) % pts.length; const [x0, y0] = pts[(q - 1 + pts.length) % pts.length], [x1, y1] = pts[(q + 1) % pts.length]; const tx = x1 - x0, ty = y1 - y0, dd = hyp(tx, ty) || 1; const nx = ty / dd, ny = -tx / dd; const [px, py] = pts[q];
        const from = [px - nx * (w0 / 2 + 2.6), py - ny * (w0 / 2 + 2.6)]; const hit = rayHit(target, tc, from, [-nx, -ny], 0.1);
        if(hit && hit.t < (sides[i] - sides[i + 1]) * 1.2) foundation.push([[rr(from[0], 2), rr(from[1], 2)], [rr(hit.pt[0] - nx * 0.6, 2), rr(hit.pt[1] - ny * 0.6, 2)]]); } }
  });
  // the floor inside the innermost tube
  { const i = N_T - 1, inner = offsetPoly(baseSections[i], -(W_BODY / 2 + 2.6)); const span = sides[i] - W_BODY - 5.2; const ls = []; for(let q = 1; q < V.floorLines; q++) ls.push(span * (q / V.floorLines - 0.5));
    const ic = cumOf(inner);
    for(const y0 of ls){ const h = rayHit(inner, ic, [-sides[i], y0], [1, 0], 0.1), h2 = rayHit(inner, ic, [sides[i], y0], [-1, 0], 0.1); if(h && h2) foundation.push([[rr(h.pt[0] - 0.6, 2), rr(y0, 2)], [rr(h2.pt[0] + 0.6, 2), rr(y0, 2)]]); }
    for(const x0 of ls){ const h = rayHit(inner, ic, [x0, -sides[i]], [0, 1], 0.1), h2 = rayHit(inner, ic, [x0, sides[i]], [0, -1], 0.1); if(h && h2) foundation.push([[rr(x0, 2), rr(h.pt[1] - 0.6, 2)], [rr(x0, 2), rr(h2.pt[1] + 0.6, 2)]]); } }

  /* ---------------- checks that refuse ---------------- */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const eat = (p) => { if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0]; if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1]; };
  for(const lay of layers){ for(const c of lay.contours) for(const p of c.pts) eat(p); for(const p of (lay.paths || [])) for(const q of p.pts) eat(q); }
  for(const pth of foundation) for(const p of pth) eat(p);
  const size = [rr(x1 - x0, 1), rr(y1 - y0, 1), rr(K_LAYERS * LH, 2)];
  if(size[0] + 2 * 8 > m.plate[0] || size[1] + 2 * 8 > m.plate[1]) violations.push(`${size[0]} x ${size[1]} mm does not fit ${m.plate.join(' x ')} with an 8 mm margin`);
  if(size[2] > m.maxZ) violations.push(`height ${size[2]} exceeds the machine's ${m.maxZ}`);
  let worstConcave = 1e9;
  for(let li = 0; li < layers.length; li += 7) for(const c of layers[li].contours){ const rc = minConcaveRadius(c.pts.slice(0, -1)); const need = c.w / 2 + c.e + BEAD; if(rc < need) violations.push(`layer ${layers[li].k}: tube ${c.tile} concave radius ${rc.toFixed(2)} < ${need.toFixed(2)}`); worstConcave = Math.min(worstConcave, rc); }
  if(worstMove > REACH + 0.9) violations.push(`layer-to-layer move ${worstMove.toFixed(3)} mm (tube ${worstMoveAt[0]}, layer ${worstMoveAt[1]}) beyond reach+tab`);
  const longest = Math.max(...terraceInfo.map(t => t.cornerDiagonal_mm), roofInfo.perLayer[0].freeSpan_mm);
  if(longest > V.declaredBridge) violations.push(`longest chord ${longest} mm exceeds the declared ceiling ${V.declaredBridge} mm`);
  if(m.beadSource !== 'measured' && !o.allowAssumedBead) violations.push(`machine ${m.id}: bead ${BEAD} is ${m.beadSource}; pass --allow-assumed-bead (and --i-know-the-bead-is-a-guess to weft.mjs) to build anyway`);
  const travelEstimate = layers.reduce((a, l) => a + Math.max(0, l.contours.length + (l.paths || []).length - 1), 0);
  const threadEstimate = layers.reduce((a, l) => a + l.contours.reduce((b, c) => b + c.total * (l.k % 2 ? 2.6 : 1.05), 0) + (l.paths || []).reduce((b, p) => b + pathLen(p.pts), 0), 0) / 1000;

  const summary = {
    name: o.name || `ZIGURAT_${V.title}_${m.id.toUpperCase()}_X1`, variant: o.variant, title: V.title, concept: V.concept,
    generator: 'core/weft_ziggurat_geometry.mjs', generatedAt: new Date().toISOString().slice(0, 10),
    machine: m.id, machineLabel: m.label, machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    size_mm: size, footprint_mm: FOOTPRINT, margin_mm: MARGIN, height_mm: size[2], tiers: N_T, totalLayers: layers.length,
    tubes: sides.map((S, i) => ({ tube: i, sideCentreline_mm: S, corner_mm: rr(corner(S), 1), zVisibleFrom: rr(zBase(i), 2), zTop: rr(zTopOf(i), 2), grammar: grammarOf(i), perimeter_mm: rr(squares[i].P, 1), K: kFor(squares[i].P, grammarOf(i)), nodePitch_mm: rr(squares[i].P / kFor(squares[i].P, grammarOf(i)), 2), hiddenK: Math.max(24, Math.floor(kFor(squares[i].P, 'staple') / 2)), turns: turnsOf(i),
      relief: V.relief === 'pillows' ? { pillowsPerFace: pillowsFor(i), rows: Math.max(1, Math.round((zTopOf(i) - zBase(i)) / V.pillowSize_mm)), amplitude_mm: V.reliefAmp } : { kind: 'spiral wave', wavesAround: V.wavesAround, rise_mm: V.waveRise_mm, amplitude_mm: V.reliefAmp } })),
    terraces: terraceInfo, roof: { process: PROCESS_ROOF, tube: N_T - 1, schedule: `${V.roof.levels.join(' -> ')} (base ${V.roof.base})`, innerSpan_mm: rr(sides[N_T - 1] - W_ROOF, 2), layers: ROOF_LAYERS, perLayer: roofInfo.perLayer, firstFreeSpan_mm: roofInfo.perLayer[0].freeSpan_mm },
    horns: horns.map(h => ({ tube: h.tube, P_mm: h.P, rate_mm_per_layer: h.rate, zStart: rr(h.k0 * LH, 2), zEnd: rr((h.k0 + h.nRise + h.nHold + h.nFall) * LH, 2), where: 'top tube corner' })),
    args: { lh: LH, bead: BEAD, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12, w: W_BODY, e: 0.7, r0: rr(S0 / 2, 2), K: K_MAX, foundation: BRIM, maxbridge: V.declaredBridge, maxcantilever: 4.8, allow: ALLOW, minanchor: 0.5, maxCapRadius: 20, speed: V.speed, bridgeSpeed: V.bridgeSpeed, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'experimental admission ceiling for the terrace and roof skeletons, not a claim that they will not sag', bridge_mm: V.declaredBridge, cantilever_mm: 4.8, membrane_min_anchor: 0.5, first_layer_max_islands: 1, secondGate_mm: EVIDENCED_BRIDGE_MM },
    estimates: { threadLength_m: rr(threadEstimate, 0), travelsBetweenPaths: travelEstimate, worstLayerMove_mm: rr(worstMove, 3), minConcaveRadius_mm: rr(worstConcave, 2), maxNodeGap_mm: maxGap },
    foundation: { paths: foundation.length, islandsExpected: 1, kind: 'rings+spokes around every tube, ribs across every gap, the floor grid inside the innermost' },
    experiments: {
      declaredBridgeCeiling_mm: V.declaredBridge, evidencedBridge_mm: EVIDENCED_BRIDGE_MM,
      crown: { process: PROCESS_ROOF, physicalStatus: 'experimental', layers: ROOF_LAYERS, firstLayerFreeSpan_mm: roofInfo.perLayer[0].freeSpan_mm },
      zones: terraceInfo.map(t => ({ name: `terrace ${t.terrace}`, z0: t.z, z1: rr(t.z + TERRACE_LAYERS * LH, 3), longestChord_mm: t.cornerDiagonal_mm })),
      horns: horns.map(h => ({ P_mm: h.P, rate_mm_per_layer: h.rate, zStart: rr(h.k0 * LH, 2), zEnd: rr((h.k0 + h.nRise + h.nHold + h.nFall) * LH, 2) })),
      protocol: 'gate at the declared ceiling must be clean; gate at the evidenced ceiling must attribute every finding to a terrace zone (6 layers), a horn, or the roof — otherwise the build is refused',
    },
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'rings+spokes+ribs+floor', paths: foundation }, layers };

  function svg(){
    const Wv = 1000, Hv = 640, els = [];
    const COL = { staple: '#f6ff78', perp: '#79f79b', sine: '#45d9c0', eight: '#ff9f6b', diagonal: '#78a7ff' };
    const sc = Math.min(1.5, 380 / FOOTPRINT), ox = 40 + FOOTPRINT * sc / 2, oy = 600;
    for(let li = 0; li < layers.length; li += 3){ const lay = layers[li], z = lay.zBot;
      for(const c of lay.contours){ const pts = c.pts.map(p => `${(ox + p[0] * sc).toFixed(1)},${(oy - z * sc * 1.2 - p[1] * sc * 0.36).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="${COL[c.web] || '#fff'}" stroke-width=".45" opacity="${c.label.includes('rim') || c.label.includes('crown') ? 1 : 0.7}"/>`); }
      for(const p of (lay.paths || [])){ const pts = p.pts.map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - z * sc * 1.2 - q[1] * sc * 0.36).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="#ff4d6d" stroke-width=".5" opacity=".9"/>`); } }
    const tx = 760, ty = 330, ts = Math.min(1.5, 420 / FOOTPRINT);
    for(const pth of foundation){ const pts = pth.map(p => `${(tx + p[0] * ts).toFixed(1)},${(ty - p[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="#5a6b85" stroke-width=".4"/>`); }
    const STAGE = { radial: '#ff4d6d', spiral4: '#ffb347', fine: '#7cff5e', spiral8: '#5ec8ff', diamond: '#e08cff' }, LEV = ['#ff4d6d', '#ffb347', '#7cff5e', '#5ec8ff'];
    for(const lay of layers) for(const p of (lay.paths || [])){ const col = p.tile === 'crown' ? LEV[(+p.label.match(/L(\d)/)[1]) - 1] : STAGE[p.label.split('-')[1]]; const pts = p.pts.map(q => `${(tx + q[0] * ts).toFixed(1)},${(ty - q[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="${col}" stroke-width=".6" opacity=".8"/>`); }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>${els.join('')}`
      + `<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="13">${summary.name} — ${V.concept}</text>`
      + `<text x="12" y="38" fill="#9bb0c8" font-family="sans-serif" font-size="10">${size[0]} x ${size[1]} x ${size[2]} mm · ${m.label} · bead ${BEAD} (${m.beadSource}) · ${N_T} tiers · tubes ${sides.join(' / ')} mm · ${layers.length} layers · ~${rr(threadEstimate, 0)} m thread</text>`
      + `<text x="${tx - 200}" y="${ty + FOOTPRINT * ts / 2 + 24}" fill="#9bb0c8" font-family="sans-serif" font-size="10">from above: foundation (grey), terraces — radial / diamonds / fine, roof levels</text></svg>`;
  }
  return { payload, summary, violations, warnings, svg };
}

function main(argv){
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const variant = opt('variant'), machine = opt('machine'), out = opt('out');
  if(!variant || !machine || !out){ console.error('usage: node core/weft_ziggurat_geometry.mjs --variant tkanje|vrtlog --machine a2l|ender --out FILE [--footprint MM] [--H MM] [--tiers N] [--margin MM] [--svg FILE] [--name NAME] [--allow-assumed-bead]'); process.exit(2); }
  const r = generateZiggurat({ variant, machine, footprint: opt('footprint'), H: opt('H'), tiers: opt('tiers'), margin: opt('margin'), name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') });
  for(const w of r.warnings) console.error('note: ' + w);
  if(r.violations.length){ console.error('REFUSED:'); for(const v of r.violations) console.error('  * ' + v); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  if(opt('svg')) fs.writeFileSync(opt('svg'), r.svg());
  const s = r.summary;
  console.log(JSON.stringify({ name: s.name, size_mm: s.size_mm, tiers: s.tiers, tubes: s.tubes.map(t => `${t.sideCentreline_mm}@${t.zTop}:${t.grammar}`), layers: s.totalLayers, thread_m: s.estimates.threadLength_m, travels: s.estimates.travelsBetweenPaths,
    terraces: s.terraces.map(t => `T${t.terrace} z${t.z} gap${t.gapCentreline_mm} side${t.sideChord_mm} diag${t.cornerDiagonal_mm}`), roofFirstSpan: s.roof.firstFreeSpan_mm, worstMove: s.estimates.worstLayerMove_mm, minConcave: s.estimates.minConcaveRadius_mm }, null, 1));
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
