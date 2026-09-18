/* WEFT — ZIGURAT2: a stepped pyramid whose steps are made by CUTTING THE CORNERS, nothing on the plate but the
   lowest tier (2026-09-18). Semir's method, and it is better than the two I tried before it.

   The X1 pair (2026-09-17) gave every tier its own tube down to the plate — the step was not really in mid-air.
   The first X2 attempt put the whole ring on a uniform corbel; honest, but it walked the entire perimeter inward
   at once and its terraces carried no crossings worth the name.

   THE METHOD. At the top of a tier, start cutting a 45 degree chord across each of the four corners, between two
   adjacent edges. The first cut is a few millimetres long and both of its ends land on material that is already
   there. Each layer cuts a little deeper: the chord grows longer, its ends slide outward along the two edges
   (still onto solid material, zero overhang there), and only its middle moves inward — by `rate` mm, which is the
   whole overhang of the layer. The next layer's chord crosses the previous one at an angle, so the crossings are
   weld nodes: the terrace is woven, not stacked. (Two identical layers on top of each other make no nodes at all
   — that was the defect Semir found in the X1 terraces, at z 39.36 / 39.60 of the A2L file.)

   THE ARITHMETIC FALLS OUT. When the four cuts have grown until they meet, they meet at the midpoints of the four
   original edges, and what is left is a square rotated 45 degrees with side a/sqrt(2). One cut cycle IS one step:
   a factor of 1.414 and a 45 degree rotation, both structural. The octagon is the transition, the twist is not a
   decoration. Sides run 273 -> 193 -> 136 -> 96 -> 68 -> 48 mm on the A2L.

   RATE. The chord's ends do not move inward at all; its middle moves `rate` mm per layer. At rate 0.5 that is the
   same overhang OBLAK's upper hemisphere carried cleanly (it went wavy only past ~0.9 mm/layer, photographs
   2026-09-08), and it is gentler than a uniform corbel at the same rate because the overhang tapers to nothing at
   both ends. The ramp reads as a 26 degree slope.

   WHAT ELSE HOLDS THE RAMP UP, in order of what it is worth:
     1. the cut geometry itself — every chord lands on solid material at both ends;
     2. PLEATS — a radial corrugation locked to the polar ANGLE (not to arc length, so it does not slide as the
        section changes shape), running through the whole cut zone and easing into the walls above and below, so a
        rib grows out of the wall. Bending stiffness goes with the square of the amplitude;
     3. DOUBLED weld columns through the cut — twice the tabs, twice the landing points for the lip above;
     4. a deeper wall (4.0 mm) and a longer tab (1.4 mm) through the cut, the numbers OBLAK's crown approach used.
   Items 2-4 are reasoned, not measured. Item 1 and the rate are evidenced.

   Only the crown is a real span: the last square is drawn in at 0.3 mm/layer to a ~34 mm hole, then the woven grid
   closes it (3 -> 9 -> 27), first chord ~31 mm — the class GORA's iris closed cleanly at 26.4 mm.

   usage: node core/weft_zigurat2_geometry.mjs --variant tkanje|vrtlog --machine a2l|ender --out FILE
          [--footprint MM] [--cycles N] [--rate MM] [--wall-layers N] [--svg FILE] [--name NAME] [--allow-assumed-bead] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, densifyNodes, minConcaveRadius, resample, clamp, smooth, lerp, rr, loadMachine, EVIDENCED_BRIDGE_MM } from './weft_cube_geometry.mjs';

const TAU = 2 * Math.PI, hyp = Math.hypot;
export const PROCESS_CUT = 'terrace-corner-cut/v1';
export const PROCESS_ROOF = 'crown-woven-grid/v1';

export const VARIANTS = {
  tkanje: {
    title: 'TKANJE', concept: 'the sampler: one grammar per tier, a quilt of pillows on the walls, pleated ramps, the 45 degree rotation coming from the cut itself, Peano roof 3-9-27',
    cycles: null, wallLayers: 30, grammars: ['staple', 'diagonal', 'sine', 'eight', 'perp', 'staple'],
    relief: 'pillows', reliefAmp: 1.4, pillowSize_mm: 22, ampWave: 0.15,
    pleatLambda_ref: 44, pleatAmp: 1.4,
    roof: { levels: [3, 9, 27], layersPerLevel: [4, 4, 4], firstLevelRepeat: true },
    hole: 30, horns: [], speed: 30, bridgeSpeed: 18, declaredBridge: 36,
  },
  vrtlog: {
    title: 'VRTLOG', concept: 'the wrung one: sine throughout, a wave that climbs the walls, pleated ramps, horns on the last tier, Hilbert roof 2-4-8-16',
    cycles: null, wallLayers: 35, grammars: ['sine', 'sine', 'sine', 'sine', 'sine'],
    relief: 'spiral', reliefAmp: 1.4, wavesAround: 4, waveRise_mm: 24, ampWave: 0.25,
    pleatLambda_ref: 42, pleatAmp: 1.4,
    roof: { levels: [2, 4, 8, 16], layersPerLevel: [4, 4, 2, 2], firstLevelRepeat: true },
    hole: 28, horns: [{ P_mm: 8, rate: 0.8, atFrac: 0.5 }], speed: 26, bridgeSpeed: 15, declaredBridge: 36,
  },
};

/* ---------- a rounded convex section: the intersection of half-planes, Minkowski-summed with a disc ---------- */
function clipHalf(poly, nx, ny, d) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
/** planes: [{nx,ny,h}] outward normals and centre-to-edge distances of the FINISHED shape; r = corner radius.
    Sampled by POLAR ANGLE, not by arc length: as the octagon closes back into a square the vertex count drops
    8 -> 4, and an arc-length parameterisation would slide the whole weave sideways in one layer (measured: a
    10.7 mm apparent jump). By angle, sample i of every layer looks in the same direction, so the weld columns
    stack and the pleats stay put. */
function roundedConvex(planes, r, nOut) {
  let poly = [[-1e4, -1e4], [1e4, -1e4], [1e4, 1e4], [-1e4, 1e4]];          // CCW
  for (const p of planes) poly = clipHalf(poly, p.nx, p.ny, p.h - r);
  poly = poly.filter((p, i) => { const q = poly[(i + 1) % poly.length]; return hyp(q[0] - p[0], q[1] - p[1]) > 1e-7; });
  const n = poly.length, samp = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], c = poly[(i + 2) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1], Le = hyp(ex, ey), nx = ey / Le, ny = -ex / Le;
    samp.push({ x: a[0] + nx * r, y: a[1] + ny * r, nx, ny, face: i, u: 0, len: Le });
    samp.push({ x: b[0] + nx * r, y: b[1] + ny * r, nx, ny, face: i, u: 1, len: Le });
    const ex2 = c[0] - b[0], ey2 = c[1] - b[1], L2 = hyp(ex2, ey2), nx2 = ey2 / L2, ny2 = -ex2 / L2;
    let a0 = Math.atan2(ny, nx), a1 = Math.atan2(ny2, nx2), da = a1 - a0;
    while (da <= -Math.PI) da += TAU; while (da > Math.PI) da -= TAU;
    const steps = Math.max(1, Math.ceil(Math.abs(da) / 0.06));
    for (let q = 1; q < steps; q++) { const ang = a0 + da * q / steps; samp.push({ x: b[0] + r * Math.cos(ang), y: b[1] + r * Math.sin(ang), nx: Math.cos(ang), ny: Math.sin(ang), face: -1, u: NaN, len: 0 }); }
  }
  /* ray from the origin at angle theta against the boundary polyline */
  const N = samp.length, out = [];
  let seg = 0;
  const ang = samp.map(q => Math.atan2(q.y, q.x));
  for (let j = 0; j < nOut; j++) {
    const th = -Math.PI + TAU * j / nOut, cx = Math.cos(th), cy = Math.sin(th);
    let hit = null;
    for (let t = 0; t < N && !hit; t++) {
      const i = (seg + t) % N, a = samp[i], b = samp[(i + 1) % N];
      const ex = b.x - a.x, ey = b.y - a.y, den = cx * ey - cy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const tt = (a.x * ey - a.y * ex) / den;                      // distance along the ray
      const ss = (a.x * cy - a.y * cx) / den;                       // parameter along the segment
      if (tt > 0 && ss >= -1e-9 && ss <= 1 + 1e-9) { hit = { x: cx * tt, y: cy * tt, a, b, ss }; seg = i; }
    }
    if (!hit) { const i = seg, a = samp[i]; hit = { x: a.x, y: a.y, a, b: a, ss: 0 }; }
    const a = hit.a;
    out.push({ x: hit.x, y: hit.y, nx: a.nx, ny: a.ny, face: a.face, u: a.face >= 0 ? a.u + (hit.b.face === a.face ? (hit.b.u - a.u) * hit.ss : 0) : NaN, faceLen: a.len });
  }
  let P = 0; for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; P += hyp(b.x - a.x, b.y - a.y); }
  return { pts: out, P, faces: n };
}

/* ============================================================================================ */
export function generateZigurat2(o) {
  const V = VARIANTS[o.variant]; if (!V) throw new Error(`variant must be one of ${Object.keys(VARIANTS).join(', ')}`);
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh, FIRST_BEAD = m.firstLayerBead, ALLOW = 0.6, REACH = BEAD / 2 + ALLOW, GAP_MAX = 9.5;
  const MARGIN = o.margin != null ? +o.margin : 15;
  const FOOTPRINT = o.footprint != null ? +o.footprint : Math.min(m.plate[0], m.plate[1]) - 2 * MARGIN;
  const RATE = o.rate != null ? +o.rate : 0.5, RATE_CROWN = 0.3;
  const BRIM_C = 6.0, W_FOOT_C = 3.4;
  /* as many sqrt(2) steps as fit before the last square gets close to the crown hole */
  const CYCLES = o.cycles != null ? +o.cycles : (V.cycles != null ? V.cycles : (() => {
    let n = 0, h = (FOOTPRINT - 2 * (BRIM_C + 1.0) - W_FOOT_C) / 2;
    while (h / Math.SQRT2 >= V.hole * 0.62 && n < 8) { h /= Math.SQRT2; n++; }
    return Math.max(2, n);
  })());
  const N_WALL = o.wallLayers != null ? +o.wallLayers : V.wallLayers;
  const BRIM = BRIM_C, W_WALL = 3.0, W_RAMP = 4.0, W_FOOT = W_FOOT_C, W_ROOF = 2.8, E_ROOF = 1.2, E_WALL = 0.7, E_RAMP = 1.4;
  const K_MAX = 192, FADE = 10;
  const S0 = FOOTPRINT - 2 * (BRIM + 1.0) - W_FOOT;
  const HOLE = V.hole;
  const ROOF_LAYERS = V.roof.layersPerLevel.reduce((a, b) => a + b, 0);
  const warnings = [], violations = [], events = [];
  const cornerR = (hA) => clamp(hA * 0.09, 6, 12);

  /* ---------------- the profile ---------------- */
  const L = [];
  let hA = S0 / 2, phi = 0;
  const cutInfo = [], tierInfo = [];
  for (let t = 0; t <= CYCLES; t++) {
    tierInfo.push({ tier: t + 1, side_mm: rr(2 * hA, 2), rotation_deg: rr(phi * 180 / Math.PI, 1), grammar: V.grammars[t % V.grammars.length], zFrom: rr(L.length * LH, 2) });
    for (let j = 0; j < N_WALL; j++) L.push({ zone: 'tier', tier: t, hA, hB: 1e9, phi, f: j / N_WALL });
    if (t === CYCLES) break;
    const hB0 = hA * Math.SQRT2, hB1 = hA / Math.SQRT2, nCut = Math.max(4, Math.round((hB0 - hB1) / RATE));
    cutInfo.push({ cut: t + 1, fromSide_mm: rr(2 * hA, 2), toSide_mm: rr(2 * hA / Math.SQRT2, 2), layers: nCut, rise_mm: rr(nCut * LH, 2), inward_mm: rr(hB0 - hB1, 2), slope_deg: rr(Math.atan(nCut * LH / (hB0 - hB1)) * 180 / Math.PI, 1), rate_mm_per_layer: RATE, zFrom: rr(L.length * LH, 2), chordAtEnd_mm: rr(2 * hA / Math.SQRT2, 1) });
    for (let j = 0; j < nCut; j++) L.push({ zone: 'cut', tier: t, hA, hB: hB0 - (hB0 - hB1) * (j + 1) / nCut, phi, f: j / nCut });
    phi += Math.PI / 4; hA = hA / Math.SQRT2;
  }
  const nAppr = Math.max(4, Math.round((hA - HOLE / 2) / RATE_CROWN));
  for (let j = 0; j < nAppr; j++) L.push({ zone: 'approach', tier: CYCLES, hA: hA - (hA - HOLE / 2) * (j + 1) / nAppr, hB: 1e9, phi, f: j / nAppr });
  const H_HOLE = L[L.length - 1].hA;
  for (let j = 0; j < ROOF_LAYERS; j++) L.push({ zone: 'roof', tier: CYCLES, hA: H_HOLE, hB: 1e9, phi, f: j / ROOF_LAYERS, roofIdx: j });
  const H_TOTAL = L.length * LH;
  if (H_TOTAL > m.maxZ) violations.push(`height ${rr(H_TOTAL, 1)} exceeds the machine's ${m.maxZ}`);

  /* pleat / step envelope: full through a cut, easing FADE layers into the walls either side */
  for (const l of L) { l.env = 0; l.pleatN = 0; l.pleatPhi = 0; }
  for (let i = 0; i < L.length; i++) {
    if (L[i].zone !== 'cut' || (i > 0 && L[i - 1].zone === 'cut')) continue;
    let j = i; while (j + 1 < L.length && L[j + 1].zone === 'cut') j++;
    const meanP = 4 * (L[i].hA + L[j].hA) * 0.9, n = Math.max(8, 4 * Math.round(meanP / V.pleatLambda_ref / 4));
    for (let q = Math.max(0, i - FADE); q <= Math.min(L.length - 1, j + FADE); q++) {
      const e = q < i ? smooth((q - (i - FADE)) / FADE) : q > j ? smooth((j + FADE - q) / FADE) : 1;
      if (e > L[q].env) { L[q].env = e; L[q].pleatN = n; L[q].pleatPhi = L[i].phi; }   // the cut's own angle: phi jumps 45 deg the layer after a cut ends, and a pleat locked to it would invert in one layer (measured: a 3.2 mm step, three findings at z 65.52)
    }
  }
  for (const l of L) if (l.zone === 'approach') l.env = Math.max(l.env, smooth(l.f * 4));

  /* horns, by angle, on the last tier's wall */
  const horns = [];
  for (const h of V.horns) {
    const k0 = L.findIndex(l => l.tier === CYCLES && l.zone === 'tier') + Math.round(h.atFrac * N_WALL);
    const nRise = Math.ceil(h.P_mm / h.rate);
    horns.push({ k0: k0 - nRise, nRise, nHold: 4, nFall: nRise, P: h.P_mm, rate: h.rate, halfArc_mm: Math.sqrt(h.P_mm * Math.PI * Math.PI * 3.2 / 2) * 1.35 });
  }
  const hornZone = horns.length ? [Math.min(...horns.map(h => h.k0)), Math.max(...horns.map(h => h.k0 + h.nRise + h.nHold + h.nFall))] : null;
  const hornBump = (th, k, phi0, hA) => {
    let add = 0;
    for (const h of horns) {
      const j = k - h.k0; if (j < 0 || j >= h.nRise + h.nHold + h.nFall) continue;
      let d; if (j < h.nRise) d = Math.min(h.P, h.rate * (j + 1)); else if (j < h.nRise + h.nHold) d = h.P; else d = Math.max(0, h.P - h.rate * (j - h.nRise - h.nHold + 1));
      if (d <= 0) continue;
      const halfAng = clamp(h.halfArc_mm / Math.max(hA, 8), 0.3, 1.0);
      for (let c = 0; c < 4; c++) { const a = phi0 + Math.PI / 4 + c * Math.PI / 2; let dt = ((th - a + Math.PI) % TAU + TAU) % TAU - Math.PI; if (Math.abs(dt) < halfAng) add += d * (0.5 + 0.5 * Math.cos(Math.PI * dt / halfAng)); }
    }
    return add;
  };
  const ampEnv = (k) => { if (!hornZone) return 1; const [a, b] = hornZone; if (a - 12 <= k && k < a) return smooth((a - k) / 12); if (a <= k && k < b) return 0; if (b <= k && k < b + 12) return smooth((k - b) / 12); return 1; };

  /* ---------------- roof schedule ---------------- */
  const roofSchedule = [];
  V.roof.levels.forEach((n, li) => { const cnt = V.roof.layersPerLevel[li]; for (let j = 0; j < cnt; j++) { let dir; if (li === 0 && V.roof.firstLevelRepeat) dir = (j < cnt / 2) ? 'X' : 'Y'; else dir = j % 2 === 0 ? 'X' : 'Y'; roofSchedule.push({ level: li + 1, n, dir }); } });
  const roofInfo = [];

  /* ---------------- layers ---------------- */
  const kFor = (P, web) => { let K = K_MAX; while (K > 12 && P / K < 3.0) K = Math.floor(K / 2); if ((web === 'sine' || web === 'eight' || web === 'diagonal') && P / (2 * K) >= 2.3) K *= 2; return K; };
  const layers = [];
  let prevPts = null, worstMove = 0, worstMoveAt = null, maxGap = 0, worstConcave = 1e9;
  for (let k = 0; k < L.length; k++) {
    const spec = L[k], z = k * LH, zm = (k + 0.5) * LH;
    const cut = spec.zone === 'cut', appr = spec.zone === 'approach', roof = spec.zone === 'roof';
    const r = cornerR(spec.hA);
    const planes = [];
    for (let c = 0; c < 4; c++) { const a = spec.phi + c * Math.PI / 2; planes.push({ nx: Math.cos(a), ny: Math.sin(a), h: spec.hA }); }
    if (spec.hB < spec.hA * 1.9) for (let c = 0; c < 4; c++) { const a = spec.phi + Math.PI / 4 + c * Math.PI / 2; planes.push({ nx: Math.cos(a), ny: Math.sin(a), h: spec.hB }); }
    const approxP = 8 * spec.hA;
    const NPHI = clamp(8 * Math.round(approxP / 8), 240, 720);
    const sec = roundedConvex(planes, r, NPHI);
    const P = sec.P;
    const web = (roof || appr) ? 'staple' : V.grammars[spec.tier % V.grammars.length];
    const w = roof ? W_ROOF : appr ? lerp(lerp(W_WALL, W_RAMP, spec.env), W_ROOF, spec.f) : (k < 40 ? lerp(W_FOOT, W_WALL, smooth(k / 40)) : lerp(W_WALL, W_RAMP, spec.env));
    let e = roof ? E_ROOF : lerp(E_WALL, E_RAMP, spec.env);
    if (web === 'perp') e = 0;
    let K = kFor(P, web); if (spec.env > 0.5 && P / (2 * K) >= 2.4) K *= 2;
    const pAmp = (() => { if (!spec.pleatN || !spec.env) return 0; const lam = P / spec.pleatN, cap = lam * lam / (4 * Math.PI * Math.PI * (w / 2 + e + BEAD)) * 0.8; return Math.min(V.pleatAmp, cap) * spec.env; })();
    const reliefEnv = (roof || appr || cut) ? 0 : (1 - spec.env) * smooth(spec.f * N_WALL * LH / 5) * (1 - smooth((spec.f * N_WALL * LH - (N_WALL * LH - 4)) / 3)) * (spec.tier === 0 ? smooth(k / 30) : 1);
    const pts = [];
    for (const q of sec.pts) {
      const th = Math.atan2(q.y, q.x);
      let d = 0;
      if (pAmp > 0) d += pAmp * Math.cos(spec.pleatN * (th - spec.pleatPhi));                            // locked to the ANGLE: it does not slide as the section changes shape
      if (reliefEnv > 0) {
        if (V.relief === 'pillows') { if (q.face >= 0 && Number.isFinite(q.u)) { const nn = Math.max(1, Math.round(q.faceLen / V.pillowSize_mm)), rows = Math.max(1, Math.round(N_WALL * LH / V.pillowSize_mm)); d += reliefEnv * V.reliefAmp * (1 - Math.cos(TAU * nn * q.u)) / 2 * (1 - Math.cos(TAU * rows * spec.f)) / 2; } }
        else d += reliefEnv * V.reliefAmp * Math.sin(TAU * (V.wavesAround * th / TAU - zm / V.waveRise_mm));
      }
      d += hornBump(th, k, spec.phi, spec.hA);
      pts.push([q.x + q.nx * d, q.y + q.ny * d]);
    }
    const cum = [0]; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; cum.push(cum[i] + hyp(b[0] - a[0], b[1] - a[1])); }
    const total = cum[pts.length];
    let nodesU = []; for (let j = 0; j < K; j++) nodesU.push(total * j / K);
    nodesU = densifyNodes(nodesU, total, true, GAP_MAX);
    const amp = (!cut && !appr && !roof) ? V.ampWave * w * reliefEnv * ampEnv(k) : 0;
    const rec = record(pts, true, nodesU, w, e, web, total / 4, amp, roof ? 'crown-ring' : cut ? `cut${spec.tier + 1}-ring` : `tier${spec.tier + 1}-ring`, spec.tier);
    maxGap = Math.max(maxGap, rec.maxNodeGap);
    if (k % 5 === 0) { const rc = minConcaveRadius(pts); const need = w / 2 + e + BEAD; if (rc < need) violations.push(`layer ${k} (${spec.zone}): concave radius ${rc.toFixed(2)} < ${need.toFixed(2)}`); worstConcave = Math.min(worstConcave, rc); }
    if (prevPts && prevPts.length === pts.length && !(hornZone && k >= hornZone[0] && k < hornZone[1])) { let mv = 0; for (let i = 0; i < pts.length; i++) mv = Math.max(mv, hyp(pts[i][0] - prevPts[i][0], pts[i][1] - prevPts[i][1])); if (mv > worstMove) { worstMove = mv; worstMoveAt = [spec.zone, k]; } }
    prevPts = pts;
    const phase = roof ? 'crown-grid' : cut ? `cut ${spec.tier + 1}` : appr ? 'crown-approach' : (hornZone && k >= hornZone[0] && k < hornZone[1] ? 'horns' : `tier ${spec.tier + 1}`);
    const lay = { k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: rr(w, 3), tab: rr(e, 3), web, phase, contours: [rec] };
    if (roof) lay.paths = [roofPath(spec.roofIdx, pts, w, k, z, spec.phi)];
    if (cut && cutInfo[spec.tier] && spec.f < 1e-9) Object.assign(cutInfo[spec.tier], { K, nodePitch_mm: rr(P / K, 2), pleats: spec.pleatN, pleatAmp_mm: rr(pAmp, 2), wall_mm: rr(w, 2), tab_mm: rr(e, 2) });
    layers.push(lay);
    if (k > 0 && layers[k - 1].phase !== phase) events.push({ z: rr(z, 2), k, event: `${layers[k - 1].phase} -> ${phase}` });
  }

  function roofPath(j, rimPts, w, k, z, phi0) {
    const st = roofSchedule[j];
    const rot = ([x, y], t) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
    const rimC = rimPts.map(p => rot(p, -phi0));
    const rail = rimC.map((p, i) => { const a = rimC[(i - 1 + rimC.length) % rimC.length], b = rimC[(i + 1) % rimC.length]; const tx = b[0] - a[0], ty = b[1] - a[1], dd = hyp(tx, ty) || 1; return [p[0] + ty / dd * (W_ROOF / 2 + 0.3), p[1] - tx / dd * (W_ROOF / 2 + 0.3)]; });
    const rc = [0]; for (let i = 0; i < rail.length; i++) { const a = rail[i], b = rail[(i + 1) % rail.length]; rc.push(rc[i] + hyp(b[0] - a[0], b[1] - a[1])); }
    const at = (u) => { const Pp = rc[rail.length]; u = ((u % Pp) + Pp) % Pp; let i = 0; while (i < rail.length - 1 && rc[i + 1] < u) i++; const a = rail[i], b = rail[(i + 1) % rail.length], t = (u - rc[i]) / ((rc[i + 1] - rc[i]) || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    const innerSpan = 2 * H_HOLE - W_ROOF;
    const lines = []; for (let q = 1; q < st.n; q++) lines.push(innerSpan * (q / st.n - 0.5));
    const cross = (y0) => { const hits = []; for (let q = 0; q < rail.length; q++) { const a = rail[q], b = rail[(q + 1) % rail.length]; if ((a[1] - y0) * (b[1] - y0) <= 0 && a[1] !== b[1]) { const tt = (y0 - a[1]) / (b[1] - a[1]); hits.push({ u: rc[q] + tt * (rc[q + 1] - rc[q]), x: a[0] + (b[0] - a[0]) * tt }); } } hits.sort((p, q2) => p.x - q2.x); return [hits[0], hits[hits.length - 1]]; };
    const hop = (u0, u1) => { const Pp = rc[rail.length]; let d = ((u1 - u0) % Pp + Pp) % Pp; if (d > Pp / 2) d -= Pp; const n = Math.max(1, Math.ceil(Math.abs(d) / 0.5)), out = []; for (let q = 1; q <= n; q++) out.push(at(u0 + d * q / n)); return out; };
    let pts = [], prevU = null;
    lines.forEach((y0, li) => { const [Lh, Rh] = cross(y0); const l2r = li % 2 === 0; const from = l2r ? Lh : Rh, to = l2r ? Rh : Lh; if (prevU !== null) pts.push(...hop(prevU, from.u)); const ch = resample([[from.x, y0], [to.x, y0]], 0.5); pts.push(...(prevU === null ? ch : ch.slice(1))); prevU = to.u; });
    if (st.dir === 'Y') pts = pts.map(([x, y]) => [y, x]);
    pts = pts.map(p => rot(p, phi0)).map(([x, y]) => [rr(x, 3), rr(y, 3)]);
    const prev = roofInfo[roofInfo.length - 1], pitch = innerSpan / st.n;
    let free; if (!prev) free = innerSpan; else if (prev.dir === st.dir) free = prev.freeSpan_mm; else free = prev.pitch_mm;
    roofInfo.push({ k, z: rr(z, 3), level: st.level, grid: `${st.n}x${st.n}`, dir: st.dir, pitch_mm: rr(pitch, 2), freeSpan_mm: rr(free, 2), inQualifiedDomain: free <= EVIDENCED_BRIDGE_MM });
    return { pts, role: 'bridge', closed: false, speed: V.bridgeSpeed, label: `roof-L${st.level}-${st.n}x${st.n}-${st.dir}`, tile: 'crown', intent: `${PROCESS_ROOF}: level ${st.level} (${st.n}x${st.n}), ${st.dir}, layer ${j + 1} of ${roofSchedule.length}` };
  }

  /* ---------------- foundation: the lowest tier only ---------------- */
  const base = layers[0].contours[0].pts.slice(0, -1);
  const off = (d) => { const n = base.length, out = []; for (let i = 0; i < n; i++) { const a = base[(i - 1 + n) % n], b = base[(i + 1) % n]; const tx = b[0] - a[0], ty = b[1] - a[1], dd = hyp(tx, ty) || 1; out.push([rr(base[i][0] + ty / dd * d, 2), rr(base[i][1] - tx / dd * d, 2)]); } out.push(out[0]); return out; };
  const foundation = [];
  const offs = [-(W_FOOT / 2 + 1.0), -(W_FOOT / 2 + 2.0)]; for (let b = 0; b < BRIM; b++) offs.push(W_FOOT / 2 + 1.0 + b);
  for (const d of offs) foundation.push(off(d));
  const nSp = Math.max(48, Math.round(4 * S0 / 12));
  for (let s = 0; s < nSp; s++) {
    const q = Math.round(s * base.length / nSp) % base.length;
    const a = base[(q - 1 + base.length) % base.length], b = base[(q + 1) % base.length];
    const tx = b[0] - a[0], ty = b[1] - a[1], dd = hyp(tx, ty) || 1, p = base[q];
    const din = offs[1] - 0.6, dout = offs[offs.length - 1] + 0.6;
    foundation.push([[rr(p[0] + ty / dd * din, 2), rr(p[1] - tx / dd * din, 2)], [rr(p[0] + ty / dd * dout, 2), rr(p[1] - tx / dd * dout, 2)]]);
  }

  /* ---------------- checks ---------------- */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const eat = (p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; };
  for (const lay of layers) { for (const c of lay.contours) for (const p of c.pts) eat(p); for (const p of (lay.paths || [])) for (const q of p.pts) eat(q); }
  for (const pth of foundation) for (const p of pth) eat(p);
  const size = [rr(x1 - x0, 1), rr(y1 - y0, 1), rr(H_TOTAL, 2)];
  if (size[0] + 16 > m.plate[0] || size[1] + 16 > m.plate[1]) violations.push(`${size[0]} x ${size[1]} does not fit ${m.plate.join(' x ')} with an 8 mm margin`);
  if (worstMove > REACH + E_RAMP + 0.2) violations.push(`layer-to-layer move ${worstMove.toFixed(3)} mm (${worstMoveAt}) beyond reach + tab`);
  if (roofInfo[0].freeSpan_mm > V.declaredBridge) violations.push(`first roof span ${roofInfo[0].freeSpan_mm} > declared ${V.declaredBridge}`);
  if (m.beadSource !== 'measured' && !o.allowAssumedBead) violations.push(`machine ${m.id}: bead ${BEAD} is ${m.beadSource}; pass --allow-assumed-bead`);
  const threadEst = layers.reduce((a, l) => a + l.contours.reduce((b, c) => b + c.total, 0), 0) / 1000 * 1.94;

  const summary = {
    name: o.name || `ZIGURAT2_${V.title}_${m.id.toUpperCase()}_X2`, variant: o.variant, title: V.title, concept: V.concept,
    generator: 'core/weft_zigurat2_geometry.mjs', generatedAt: new Date().toISOString().slice(0, 10),
    machine: m.id, machineLabel: m.label, machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    principle: `${PROCESS_CUT}: a step is made by cutting 45 degree chords across the four corners and growing them a little each layer until they meet at the edge midpoints, which leaves a square rotated 45 degrees with side a/sqrt(2). The chord's ends land on solid material; only its middle overhangs, by ${RATE} mm. Consecutive chords cross, so the terrace is woven. Only the lowest tier stands on the plate.`,
    size_mm: size, footprint_mm: FOOTPRINT, margin_mm: MARGIN, height_mm: size[2], cycles: CYCLES, tiers: CYCLES + 1, totalLayers: layers.length,
    tiers_detail: tierInfo, cuts: cutInfo,
    crown: { approachLayers: nAppr, holeSide_mm: rr(2 * H_HOLE, 2), rate_mm_per_layer: RATE_CROWN },
    stiffening: { cutRate_mm_per_layer: RATE, overhangProfile: 'zero at the chord ends, maximum at its middle', pleatsPerCut: cutInfo.map(c => c.pleats), pleatAmplitude_mm: V.pleatAmp, pleatLock: 'polar angle, so the corrugation does not slide as the section changes shape', pleatFadeLayers: FADE, weldColumnsOnCut: 'doubled where the pitch allows', wallOnCut_mm: W_RAMP, tabOnCut_mm: E_RAMP, note: 'the cut geometry and the rate are evidenced (OBLAK\'s upper hemisphere); the pleats, the doubled columns and the deeper wall are reasoned, not measured' },
    roof: { process: PROCESS_ROOF, schedule: V.roof.levels.join(' -> '), innerSpan_mm: rr(2 * H_HOLE - W_ROOF, 2), layers: ROOF_LAYERS, perLayer: roofInfo, firstFreeSpan_mm: roofInfo[0].freeSpan_mm },
    horns: horns.map(h => ({ P_mm: h.P, rate_mm_per_layer: h.rate, zStart: rr(h.k0 * LH, 2), zEnd: rr((h.k0 + h.nRise + h.nHold + h.nFall) * LH, 2), flankHalfArc_mm: rr(h.halfArc_mm, 1), where: 'last tier, corners' })),
    args: { lh: LH, bead: BEAD, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12, w: W_WALL, e: E_WALL, r0: rr(S0 / 2, 2), K: K_MAX, foundation: BRIM, maxbridge: V.declaredBridge, maxcantilever: 4.8, allow: ALLOW, minanchor: 0.5, maxCapRadius: 20, speed: V.speed, bridgeSpeed: V.bridgeSpeed, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'the only declared span is the crown; a cut that produces findings is a design error, not an experiment', bridge_mm: V.declaredBridge, cantilever_mm: 4.8, membrane_min_anchor: 0.5, first_layer_max_islands: 1, secondGate_mm: EVIDENCED_BRIDGE_MM },
    estimates: { threadLength_m: rr(threadEst, 0), worstLayerMove_mm: rr(worstMove, 3), worstLayerMoveAt: worstMoveAt, reachWithTab_mm: rr(REACH + E_RAMP, 3), minConcaveRadius_mm: rr(worstConcave, 2), maxNodeGap_mm: maxGap },
    foundation: { paths: foundation.length, islandsExpected: 1, kind: 'rings + spokes under the lowest tier only' },
    experiments: {
      declaredBridgeCeiling_mm: V.declaredBridge, evidencedBridge_mm: EVIDENCED_BRIDGE_MM,
      crown: { process: PROCESS_ROOF, physicalStatus: 'experimental', layers: ROOF_LAYERS, firstLayerFreeSpan_mm: roofInfo[0].freeSpan_mm },
      zones: [{ name: 'crown', z0: rr((L.length - ROOF_LAYERS - nAppr) * LH, 3), z1: rr(H_TOTAL + 1, 3), longestChord_mm: roofInfo[0].freeSpan_mm }]
        .concat(horns.map((h, i) => ({ name: `horn ${h.P}`, z0: rr((h.k0 - 1) * LH, 3), z1: rr((h.k0 + h.nRise + h.nHold + h.nFall + 1) * LH, 3), longestChord_mm: h.P }))),
      horns: horns.map(h => ({ P_mm: h.P, rate_mm_per_layer: h.rate, zStart: rr(h.k0 * LH, 2), zEnd: rr((h.k0 + h.nRise + h.nHold + h.nFall) * LH, 2) })),
      protocol: 'gate at the declared ceiling must be clean; at the evidenced ceiling every finding must fall in the crown or a horn',
    },
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'rings+spokes (lowest tier only)', paths: foundation }, layers };

  function svg() {
    const Wv = 1020, Hv = 700, els = [];
    const COL = { staple: '#f6ff78', perp: '#79f79b', sine: '#45d9c0', eight: '#ff9f6b', diagonal: '#78a7ff' };
    const sc = Math.min(1.3, 330 / FOOTPRINT), ox = 30 + FOOTPRINT * sc / 2, oy = 650;
    for (let li = 0; li < layers.length; li += 3) {
      const lay = layers[li], z = lay.zBot, isCut = lay.phase.startsWith('cut');
      for (const c of lay.contours) { const pts = c.pts.map(p => `${(ox + p[0] * sc).toFixed(1)},${(oy - z * sc * 1.15 - p[1] * sc * 0.33).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="${isCut ? '#ff9f6b' : lay.phase === 'crown-grid' ? '#fff' : (COL[c.web] || '#fff')}" stroke-width="${isCut ? 0.55 : 0.4}" opacity="${isCut ? 0.95 : 0.65}"/>`); }
      for (const p of (lay.paths || [])) { const pts = p.pts.map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - z * sc * 1.15 - q[1] * sc * 0.33).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="#ff4d6d" stroke-width=".6"/>`); }
    }
    const tx = 800, ty = 230, ts = Math.min(1.0, 280 / FOOTPRINT);
    for (const pth of foundation) { const pts = pth.map(p => `${(tx + p[0] * ts).toFixed(1)},${(ty - p[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="#5a6b85" stroke-width=".35"/>`); }
    for (let li = 0; li < layers.length; li += 4) { const lay = layers[li]; for (const c of lay.contours) { const pts = c.pts.map(p => `${(tx + p[0] * ts).toFixed(1)},${(ty - p[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="${lay.phase.startsWith('cut') ? '#ff9f6b' : '#2f4666'}" stroke-width=".3" opacity=".8"/>`); } }
    for (const lay of layers) for (const p of (lay.paths || [])) { const pts = p.pts.map(q => `${(tx + q[0] * ts).toFixed(1)},${(ty - q[1] * ts).toFixed(1)}`).join(' '); els.push(`<polyline points="${pts}" fill="none" stroke="#ff4d6d" stroke-width=".5"/>`); }
    /* the true silhouette: the greatest and the least radius of each layer. During a cut the half-width hA does
       not move at all (only the diagonal planes come in), so plotting hA would draw a staircase that does not exist. */
    const px0 = 800, py0 = 660, pxs = 0.8, pys = 1.1;
    const rad = layers.map(lay => { let mn = 1e9, mx = 0; for (const p of lay.contours[0].pts) { const r2 = hyp(p[0], p[1]); if (r2 < mn) mn = r2; if (r2 > mx) mx = r2; } return [mn, mx]; });
    const pr = (sign, idx) => rad.map((r2, k) => `${(px0 + sign * r2[idx] * pxs).toFixed(1)},${(py0 - k * LH * pys).toFixed(1)}`).join(' ');
    els.push(`<polyline points="${pr(-1, 1)}" fill="none" stroke="#7cff5e" stroke-width="1"/><polyline points="${pr(1, 1)}" fill="none" stroke="#7cff5e" stroke-width="1"/>`);
    els.push(`<polyline points="${pr(-1, 0)}" fill="none" stroke="#2f7a4a" stroke-width=".8"/><polyline points="${pr(1, 0)}" fill="none" stroke="#2f7a4a" stroke-width=".8"/>`);
    els.push(`<line x1="${px0 - S0 / 2 * pxs}" y1="${py0}" x2="${px0 + S0 / 2 * pxs}" y2="${py0}" stroke="#5a6b85" stroke-width="1.5"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>${els.join('')}`
      + `<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="13">${summary.name} — ${V.concept}</text>`
      + `<text x="12" y="38" fill="#9bb0c8" font-family="sans-serif" font-size="10">${size[0]} x ${size[1]} x ${size[2]} mm · ${m.label} · bead ${BEAD} (${m.beadSource}) · sides ${tierInfo.map(t => Math.round(t.side_mm)).join(' → ')} mm · ${layers.length} layers · corner cuts at ${RATE} mm/layer = ${cutInfo[0].slope_deg}° · only the lowest tier touches the plate</text>`
      + `<text x="${px0 - 70}" y="${py0 + 16}" fill="#9bb0c8" font-family="sans-serif" font-size="10">true silhouette: greatest radius (bright) and least radius (dark) per layer</text></svg>`;
  }
  return { payload, summary, violations, warnings, svg };
}

function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const variant = opt('variant'), machine = opt('machine'), out = opt('out');
  if (!variant || !machine || !out) { console.error('usage: node core/weft_zigurat2_geometry.mjs --variant tkanje|vrtlog --machine a2l|ender --out FILE [--footprint MM] [--cycles N] [--rate MM] [--wall-layers N] [--margin MM] [--svg FILE] [--name NAME] [--allow-assumed-bead]'); process.exit(2); }
  const r = generateZigurat2({ variant, machine, footprint: opt('footprint'), cycles: opt('cycles'), rate: opt('rate'), wallLayers: opt('wall-layers'), margin: opt('margin'), name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') });
  for (const w of r.warnings) console.error('note: ' + w);
  if (r.violations.length) { console.error('REFUSED:'); for (const v of r.violations.slice(0, 10)) console.error('  * ' + v); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  if (opt('svg')) fs.writeFileSync(opt('svg'), r.svg());
  const s = r.summary;
  console.log(JSON.stringify({ name: s.name, size_mm: s.size_mm, layers: s.totalLayers, tiers: s.tiers_detail.map(t => `${t.side_mm}@${t.rotation_deg}deg:${t.grammar}`), cuts: s.cuts.map(c => `cut${c.cut} z${c.zFrom} ${c.fromSide_mm}->${c.toSide_mm} ${c.layers}L ${c.rise_mm}mm ${c.slope_deg}deg K${c.K}/${c.nodePitch_mm} pleats${c.pleats}x${c.pleatAmp_mm}`), crown: s.crown, roofFirstSpan: s.roof.firstFreeSpan_mm, thread_est_m: s.estimates.threadLength_m, worstMove: s.estimates.worstLayerMove_mm, minConcave: s.estimates.minConcaveRadius_mm }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
