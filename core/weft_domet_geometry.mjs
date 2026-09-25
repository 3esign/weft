/* WEFT — DOMET: an instrument, not a sculpture. It measures how far a RETURNING HAIRPIN can reach into open
   air before it stops being a horizontal surface and becomes a nest (2026-09-23).

   WHY. On 2026-09-19 a second mind built two objects whose horizontal terraces are fields of returning
   hairpins: the thread leaves the wall, turns at a free tip and comes back. Printed on 2026-09-23 the Ender
   object's terraces came out FLAT — the first level floating surface in this project. The A2L object's first
   terrace came out flat on its straight runs and went to tangled nests where the return is longest, and the
   print was stopped for machine safety. Measuring the two geometry files gave the free reach of each terrace's
   first layer: the Ender terrace that held has a median of 18.1 mm and a MINIMUM of 6.6 mm; the A2L terrace
   that failed has a median of 28.6 mm and a minimum of 20.1 mm. So the limit is bracketed between roughly 25
   and 29 mm — but layer height and speed moved at the same time, so nothing is isolated.

   THIS OBJECT ISOLATES IT. One cylinder. Four terraces. Each terrace is one instrument, and the walls between
   them are identical, so a terrace can only differ from another terrace by the thing being tested.

   The ladder stops at 28 mm and not higher for a reason that is itself a finding: the gate measures a returning
   hairpin by its PATH LENGTH between anchors, so a 26 mm reach is scored as a 52 mm bridge, and 60 mm is the
   highest ceiling the chain will accept even with --allow-experimental-bridge. The rungs are therefore placed
   where the answer lives — the Ender terrace that printed flat had a maximum of 25.3 mm, the A2L terrace that
   nested had a minimum of 20.1 mm.

     terrace A  reach ladder, OUTWARD, ribbed weave   5/8/11/14/17/20/23/26 mm in eight 45 deg sectors
     terrace B  the same ladder, OUTWARD, plain weave  (the 2026-09-19 scheme) -> A vs B isolates the ribs
     terrace C  the same ladder, INWARD, ribbed weave  -> A vs C isolates direction (no wall mass outboard)
     terrace D  fixed 24 mm reach, RIB-PITCH ladder     3/4/5/6/8/10/14 mm and one sector with no ribs

   THE RIBS ARE SEMIR'S OWN INSTRUCTION, 2026-09-18: "in the next layer make rails for next layer". A terrace
   layer is either R (radial teeth) or C (circumferential rails), and they alternate. A rail crosses every
   tooth at very nearly 90 degrees, so the crossings are real nodes; and a tooth on the next R layer lands on
   the rails beneath it every `q` mm, so it is a beam on supports rather than a cantilever of its whole length.
   Only the FIRST layer of a terrace is a true full-length cantilever. That is the declared experiment.

   WHAT ELSE IS FIXED HERE. The 2026-09-19 terraces contain only TWO distinct paths: layer k equals layer k+2
   point for point, so each path is laid six times onto itself — the same defect Semir found at layers 164/165
   of ZIGURAT_TKANJE_A2L_X1, at period two instead of one. Here the six R layers each carry a different phase
   (p/6 apart) and the six C layers each carry a different rail offset (q/6 apart), so no layer of a terrace
   coincides with any other.

   READING THE RESULT. The sectors ascend, so the break shows as the angle at which the comb stops being a
   comb. Photograph each terrace from a fixed side with a scale, before and after the wall above it starts.

   usage: node core/weft_domet_geometry.mjs --machine ender|a2l --out FILE [--svg FILE] [--radius MM]
          [--wall-mm MM] [--name NAME] [--allow-assumed-bead] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, densifyNodes, resample, clamp, rr, loadMachine, EVIDENCED_BRIDGE_MM } from './weft_cube_geometry.mjs';

const TAU = 2 * Math.PI, hyp = Math.hypot;
export const PROCESS = 'terrace-return-ladder/v1';

/* the ladder, ascending, eight 45 degree sectors */
export const REACH_LADDER = [5, 8, 11, 14, 17, 20, 23, 26];
export const RIB_LADDER   = [3, 4, 5, 6, 8, 10, 14, 0];        // 0 = no ribs, the 2026-09-19 scheme

export const TERRACES = [
  { id: 'A', title: 'reach ladder, outward, ribbed', dir: +1, reach: REACH_LADDER, rib: 5,   plain: false },
  { id: 'B', title: 'reach ladder, outward, plain',  dir: +1, reach: REACH_LADDER, rib: 0,   plain: true  },
  { id: 'C', title: 'reach ladder, inward, ribbed',  dir: -1, reach: REACH_LADDER, rib: 5,   plain: false },
  { id: 'D', title: 'rib-pitch ladder, outward',     dir: +1, reach: null,         rib: null, plain: false, fixedReach: 20, ribs: RIB_LADDER },
];
const WALL_WEB = ['staple', 'diagonal', 'sine', 'eight', 'staple'];   // never perp here: perp sets the tab to zero, which moves the rail radius and leaves the terrace ring above it floating   // one per band, so the photograph says which terrace it is

export function generateDomet(o) {
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh;
  const MARGIN = o.margin != null ? +o.margin : 15;
  const R = o.radius != null ? +o.radius : 48;                       // wall centreline radius
  const W_WALL = 3.0, W_FOOT = 3.4, E_WALL = 0.7, K_MAX = 192, GAP_MAX = 9.5;
  const BRIM = 6.0;
  const WALL_MM = o.wallMm != null ? +o.wallMm : 7.0;                // wall between terraces
  const N_WALL = Math.max(12, Math.round(WALL_MM / LH));
  const N_TERR = 12;                                                  // layers per terrace, as 2026-09-19
  const P_CELL = 4.0;                                                 // tooth pitch along the base ring, mm
  const TIP_GAP = 1.2;
  const TIP_MIN = 2.2;                                                // smallest allowed spacing between neighbouring tips (fused fans killed GORA's corners)                                                // clear space between a tooth's two legs at the tip
  const SEG = 0.45;                                                   // path sampling; typed paths must be <= max(0.55, bead*1.25)
  const violations = [], warnings = [], events = [];

  const maxReach = Math.max(...REACH_LADDER);
  const R_OUT = R + W_WALL / 2 + E_WALL, R_IN = R - W_WALL / 2 - E_WALL;   // half a bead OUTSIDE the wall's rail: on the rail it is the same line twice (4371 same-layer overlaps), further out it floats   // the wave's base must land ON a wall RAIL. A WEFT wall is two rails plus sparse staples, not a solid band, and the rails sit at w/2 + tab from the centreline: a base placed inside that band is 1.37 mm from anything and the gate then scores the run across two whole cells (112 mm)
  const outerExtent = R_OUT + maxReach + BEAD / 2;
  const innerExtent = R_IN - maxReach;
  if (innerExtent < 7) violations.push(`inward ladder leaves a ${rr(2 * innerExtent, 1)} mm hole; raise --radius`);
  if (2 * (outerExtent + BRIM + 2) > Math.min(m.plate[0], m.plate[1]) - 2 * MARGIN)
    violations.push(`outer extent ${rr(2 * outerExtent, 1)} mm does not fit ${m.plate.join(' x ')} with a ${MARGIN} mm margin`);

  /* ---------------- the profile ---------------- */
  const L = [];
  let band = 0;
  for (const T of TERRACES) {
    for (let j = 0; j < N_WALL; j++) L.push({ zone: 'wall', band, f: j / N_WALL });
    for (let j = 0; j < N_TERR; j++) L.push({ zone: 'terrace', band, terrace: T, j });
    band++;
  }
  for (let j = 0; j < Math.round(N_WALL * 0.6); j++) L.push({ zone: 'wall', band, f: j / N_WALL });
  const H_TOTAL = L.length * LH;
  if (H_TOTAL > m.maxZ) violations.push(`height ${rr(H_TOTAL, 1)} exceeds the machine's ${m.maxZ}`);

  /* ---------------- the ladder, as a function of angle ---------------- */
  const NSEC = 8, SEC = TAU / NSEC;
  const sectorOf = (th) => Math.floor((((th % TAU) + TAU) % TAU) / SEC);
  const reachOf = (T, th) => T.fixedReach != null ? T.fixedReach : T.reach[sectorOf(th)];
  const ribOf   = (T, th) => T.ribs != null ? T.ribs[sectorOf(th)] : T.rib;

  /* ---------------- one R layer: the teeth ---------------- */
  /** phase in [0,1): shifts every tooth along the base ring by phase * P_CELL */
  /* Every terrace layer begins with a CLOSED RING on the base radius. That ring is what the next layer's
     wave lands on, so the wave never has to hit a thin wall rail: only the first ring of a terrace does, and
     it is laid exactly on the wall's outer (or inner) rail. The ring's radius jitters +-0.3 mm between layers
     so consecutive rings are not the same line twice. */
  const ringPts = (rad, from = 0) => { const n = Math.max(64, Math.ceil(TAU * Math.abs(rad) / SEG)), o = [];
    for (let i = 0; i <= n; i++) { const t = from + TAU * i / n; o.push([rad * Math.cos(t), rad * Math.sin(t)]); } return o; };

  function teethPath(T, phase, jit) {
    const Rb = (T.dir > 0 ? R_OUT : R_IN) + T.dir * (0.55 + jit);
    const N = Math.max(24, Math.round(TAU * Math.abs(Rb) / P_CELL));
    const dth = TAU / N;
    /* a TRIANGLE WAVE, not separate teeth: the legs are shared, so a layer shifted by half a cell crosses this
       one twice per cell instead of missing it. An inward fan also converges, so teeth are dropped to keep the
       tips at least TIP_MIN apart — fused fans are what spoiled GORA's corners. */
    const stepAt = (th) => { const rTip = Math.abs(Rb + T.dir * reachOf(T, th)); return Math.max(1, Math.ceil(TIP_MIN / Math.max(TAU * rTip / N, 1e-6))); };
    const keep = []; for (let i = 0; i < N; i++) if (i % stepAt((i + phase) * dth) === 0) keep.push(i);
    const raw = [], perSector = new Array(NSEC).fill(0);
    for (let q = 0; q < keep.length; q++) {
      const i = keep[q], iNext = keep[(q + 1) % keep.length] + (q + 1 === keep.length ? N : 0);
      const thB = (i + phase) * dth, thT = ((i + iNext) / 2 + phase) * dth;
      const rch = reachOf(T, thT), rTip = Rb + T.dir * rch;
      const tipHalf = Math.min((iNext - i) * dth * 0.3, TIP_GAP / 2 / Math.max(Math.abs(rTip), 1));
      raw.push([Rb * Math.cos(thB), Rb * Math.sin(thB)]);
      raw.push([rTip * Math.cos(thT - tipHalf), rTip * Math.sin(thT - tipHalf)]);
      raw.push([rTip * Math.cos(thT + tipHalf), rTip * Math.sin(thT + tipHalf)]);
      perSector[sectorOf(thT)]++;
    }
    raw.push(raw[0]);
    const pts = ringPts(Rb, phase * dth).concat(resample(raw, SEG).slice(1)).map(([x, y]) => [rr(x, 3), rr(y, 3)]);
    return { pts, cells: keep.length, perSector, N };
  }

  /* ---------------- one C layer: the rails, as ONE continuous line ---------------- */
  /** WEFT emits one thread per layer, so separate rail polylines are joined by the builder and the joins fly
      across open air; the gate scored such a pair as a single 86-561 mm bridge. The rails are therefore routed
      here: ring, then sector by sector, out and back along the rails with RADIAL jogs between them (a radial
      jog crosses the teeth below, so it is supported), returning to the ring between sectors. */
  function railPath(T, off, jit) {
    const Rb = (T.dir > 0 ? R_OUT : R_IN) + T.dir * (0.55 + jit);
    const N = Math.max(24, Math.round(TAU * Math.abs(Rb) / P_CELL)), dth = TAU / N;
    const pts = ringPts(Rb).slice();
    const arc = (rad, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * Math.abs(rad) / SEG)), o = [];
      for (let i = 1; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; o.push([rad * Math.cos(t), rad * Math.sin(t)]); } return o; };
    const radial = (th, r0, r1) => { const n = Math.max(2, Math.ceil(Math.abs(r1 - r0) / SEG)), o = [];
      for (let i = 1; i <= n; i++) { const r = r0 + (r1 - r0) * i / n; o.push([r * Math.cos(th), r * Math.sin(th)]); } return o; };
    const info = [];
    for (let s = 0; s < NSEC; s++) {
      const th0 = s * SEC, th1 = (s + 1) * SEC, thm = th0 + SEC / 2;
      const q = ribOf(T, thm); if (!q) continue;                       // a sector with no ribs is the control
      const rch = reachOf(T, thm);
      const rTipS = Math.abs(Rb + T.dir * rch), stepS = Math.max(1, Math.ceil(TIP_MIN / Math.max(TAU * rTipS / N, 1e-6)));
      const a0 = (Math.ceil(Math.ceil(th0 / dth) / stepS) + 1) * stepS * dth, a1 = (Math.floor(Math.floor(th1 / dth) / stepS) - 1) * stepS * dth;
      if (a1 <= a0) continue;
      pts.push(...arc(Rb, pts.length ? Math.atan2(pts[pts.length - 1][1], pts[pts.length - 1][0]) : 0, a0));
      let cur = Rb, k = 1, fwd = true;
      for (; ; k++) {
        const dd = (k - 0.5 + off * 0.5) * q; if (dd > rch - 0.9) break;
        const rad = Rb + T.dir * dd;
        pts.push(...radial(fwd ? a0 : a1, cur, rad));
        pts.push(...arc(rad, fwd ? a0 : a1, fwd ? a1 : a0));
        cur = rad; fwd = !fwd;
        info.push({ sector: s, rail: k, offset_mm: rr(dd, 2), pitch_mm: q, reach_mm: rch });
      }
      pts.push(...radial(fwd ? a0 : a1, cur, Rb));                    // back to the ring before the next sector
    }
    return { pts: pts.map(([x, y]) => [rr(x, 3), rr(y, 3)]), info };
  }

  /* ---------------- layers ---------------- */
  const kFor = (P, web) => { let K = K_MAX; while (K > 12 && P / K < 3.0) K = Math.floor(K / 2); if ((web === 'sine' || web === 'eight' || web === 'diagonal') && P / (2 * K) >= 2.3) K *= 2; return K; };
  const NPHI = clamp(8 * Math.round(TAU * R / 0.8 / 8), 240, 720);
  const circle = [];
  for (let i = 0; i < NPHI; i++) { const t = TAU * i / NPHI; circle.push([rr(R * Math.cos(t), 3), rr(R * Math.sin(t), 3)]); }
  const P_RING = TAU * R;

  const layers = [], terraceInfo = [];
  let phaseR = 0, offC = 0, curTerr = null;
  for (let k = 0; k < L.length; k++) {
    const spec = L[k], z = k * LH;
    const web = WALL_WEB[spec.band % WALL_WEB.length];
    const w = k < 30 ? W_FOOT + (W_WALL - W_FOOT) * (k / 30) : W_WALL;
    const e = web === 'perp' ? 0 : E_WALL;
    const K = kFor(P_RING, web);
    let nodesU = []; for (let j = 0; j < K; j++) nodesU.push(P_RING * j / K);
    nodesU = densifyNodes(nodesU, P_RING, true, GAP_MAX);
    const phase = spec.zone === 'terrace' ? `terrace-${spec.terrace.id}` : `wall-${spec.band + 1}`;
    const rec = record(circle, true, nodesU, w, e, spec.zone === 'terrace' ? 'staple' : web, P_RING / 4, 0,
      spec.zone === 'terrace' ? `terrace${spec.terrace.id}-ring` : `wall${spec.band + 1}-ring`, spec.band);
    const lay = { k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: rr(w, 3), tab: rr(e, 3), web: spec.zone === 'terrace' ? 'staple' : web, phase, contours: [rec] };

    if (spec.zone === 'wall' && L[k + 1] && L[k + 1].zone === 'terrace') {
      /* the last wall layer lays the terrace's base ring itself, at the rail radius. The first wave of the
         terrace then lands on a ring that is certainly there, instead of having to hit a rail whose emitted
         radius depends on the wall's grammar. Without this the first layer of a terrace was scored as runs of
         70-540 mm because some of its base points missed the rail by a millimetre. */
      const T2 = L[k + 1].terrace, Rb2 = T2.dir > 0 ? R_OUT : R_IN;
      lay.paths = [{ pts: ringPts(Rb2).map(([x, y]) => [rr(x, 3), rr(y, 3)]), role: 'bridge', closed: false, speed: o.bridgeSpeed || 14,
        label: `terrace${T2.id}-seat`, tile: `terrace${T2.id}`, intent: `${PROCESS}: seat ring for terrace ${T2.id}, laid on the wall rail so the terrace's first wave has a continuous landing` }];
    }
    if (spec.zone === 'terrace') {
      const T = spec.terrace;
      if (spec.j === 0) { curTerr = { id: T.id, title: T.title, dir: T.dir > 0 ? 'outward' : 'inward', zFrom: rr(z, 3), zTo: rr(z + N_TERR * LH, 3), layers: N_TERR, kFrom: k, sectors: [], distinctPaths: 0 }; terraceInfo.push(curTerr); phaseR = 0; offC = 0; }
      const isR = T.plain ? true : (spec.j % 2 === 0);
      if (isR) {
        const ph = T.plain ? (spec.j % 2) * 0.5 : (phaseR / 6);        // plain: the 2026-09-19 two-phase scheme. ribbed: six distinct phases
        const t = teethPath(T, ph, spec.j === 0 ? 0 : (spec.j % 4 < 2 ? 0.2 : -0.2));
        lay.paths = [{ pts: t.pts, role: 'bridge', closed: false, speed: o.bridgeSpeed || 14, label: `terrace${T.id}-teeth-p${rr(ph, 3)}`, tile: `terrace${T.id}`,
          intent: `${PROCESS}: terrace ${T.id} (${T.title}), base ring + triangle wave, ${t.cells} cells, phase ${rr(ph * P_CELL, 2)} mm of ${P_CELL}` }];
        if (!T.plain) phaseR++;
        if (spec.j === 0) { curTerr.cells = t.cells; curTerr.cellsPerSector = t.perSector; }
      } else {
        const r = railPath(T, offC / 6, spec.j % 4 < 2 ? -0.2 : 0.2);
        lay.paths = [{ pts: r.pts, role: 'bridge', closed: false, speed: o.bridgeSpeed || 14, label: `terrace${T.id}-rails-o${offC}`, tile: `terrace${T.id}`,
          intent: `${PROCESS}: terrace ${T.id} rails, ${r.info.length} arcs on ${NSEC} sectors, offset ${rr(offC / 6, 2)} of a pitch; each rail crosses every tooth below at ~90 deg and gives the wave above a landing every pitch` }];
        offC++;
      }
      if (spec.j === N_TERR - 1) {
        curTerr.distinctPaths = T.plain ? 2 : N_TERR;
        for (let s = 0; s < NSEC; s++) {
          const th = s * SEC + SEC / 2;
          curTerr.sectors.push({ sector: s, deg: `${rr(s * 45, 0)}-${rr((s + 1) * 45, 0)}`, reach_mm: reachOf(T, th), ribPitch_mm: ribOf(T, th) || 'none',
            firstLayerCantilever_mm: reachOf(T, th), laterLayerFreeRun_mm: ribOf(T, th) ? rr(ribOf(T, th) * (1 + 1 / 6), 2) : reachOf(T, th) });
        }
      }
    }
    layers.push(lay);
    if (k > 0 && layers[k - 1].phase !== phase) events.push({ z: rr(z, 2), k, event: `${layers[k - 1].phase} -> ${phase}` });
  }

  /* ---------------- foundation ---------------- */
  const foundation = [];
  const ring = (rad) => { const p = []; for (let i = 0; i <= NPHI; i++) { const t = TAU * i / NPHI; p.push([rr(rad * Math.cos(t), 2), rr(rad * Math.sin(t), 2)]); } return p; };
  foundation.push(ring(R - W_FOOT / 2 - 1.0), ring(R - W_FOOT / 2 - 2.0));
  for (let b = 0; b < BRIM; b++) foundation.push(ring(R + W_FOOT / 2 + 1.0 + b));
  const nSp = Math.max(48, Math.round(TAU * R / 12));
  for (let s = 0; s < nSp; s++) { const t = TAU * s / nSp; foundation.push([[rr((R - W_FOOT / 2 - 2.6) * Math.cos(t), 2), rr((R - W_FOOT / 2 - 2.6) * Math.sin(t), 2)], [rr((R + W_FOOT / 2 + BRIM + 0.6) * Math.cos(t), 2), rr((R + W_FOOT / 2 + BRIM + 0.6) * Math.sin(t), 2)]]); }

  /* ---------------- checks and summary ---------------- */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const eat = (p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; };
  for (const lay of layers) { for (const c of lay.contours) for (const p of c.pts) eat(p); for (const pth of (lay.paths || [])) for (const p of pth.pts) eat(p); }
  for (const pth of foundation) for (const p of pth) eat(p);
  const size = [rr(x1 - x0, 1), rr(y1 - y0, 1), rr(H_TOTAL, 2)];
  if (m.beadSource !== 'measured' && !o.allowAssumedBead) violations.push(`machine ${m.id}: bead ${BEAD} is ${m.beadSource}; pass --allow-assumed-bead`);
  let maxSeg = 0;
  for (const lay of layers) for (const pth of (lay.paths || [])) for (let i = 1; i < pth.pts.length; i++) maxSeg = Math.max(maxSeg, hyp(pth.pts[i][0] - pth.pts[i - 1][0], pth.pts[i][1] - pth.pts[i - 1][1]));
  if (maxSeg > Math.max(0.55, BEAD * 1.25)) violations.push(`typed path sampled every ${rr(maxSeg, 2)} mm; must be <= ${rr(Math.max(0.55, BEAD * 1.25), 2)}`);
  const ringThread = layers.reduce((a, l) => a + l.contours.reduce((b, c) => b + c.total, 0), 0);
  let pathThread = 0;
  for (const lay of layers) for (const pth of (lay.paths || [])) for (let i = 1; i < pth.pts.length; i++) pathThread += hyp(pth.pts[i][0] - pth.pts[i - 1][0], pth.pts[i][1] - pth.pts[i - 1][1]);
  const threadEst = (ringThread * 1.94 + pathThread) / 1000;
  const DECL_CANT = 8, DECL_BRIDGE = 60;   // the gate's own ceilings (it caps cantilever at 8); the real experiment is a free tip of up to maxReach, declared in experiments and attributed to a terrace zone

  const summary = {
    name: o.name || `DOMET_${m.id.toUpperCase()}_X1`, generator: 'core/weft_domet_geometry.mjs', process: PROCESS,
    generatedAt: new Date().toISOString().slice(0, 10), machine: m.id, machineLabel: m.label,
    machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    purpose: 'An instrument. It measures the free reach at which a returning hairpin stops producing a horizontal surface, and whether circumferential rails under the teeth raise that limit. It is not a sculpture and is not meant to be beautiful beyond being legible.',
    principle: `${PROCESS}: a terrace layer is either R (radial returning teeth, both ends on the base ring, free tip) or C (circumferential rails that cross every tooth at ~90 deg and give the next R layer a landing every rib pitch). R and C alternate. Only a terrace's FIRST layer is a full-length cantilever; after it, a tooth is a beam on supports.`,
    size_mm: size, height_mm: size[2], wallRadius_mm: R, totalLayers: layers.length, layerHeight_mm: LH, bead_mm: BEAD,
    wallBetweenTerraces_mm: rr(N_WALL * LH, 2), layersPerTerrace: N_TERR, toothPitch_mm: P_CELL, tipGap_mm: TIP_GAP,
    ladder: { reach_mm: REACH_LADDER, ribPitch_mm: RIB_LADDER, sectors: NSEC, note: 'sectors ascend, so the break reads as the angle at which the comb stops being a comb' },
    terraces: terraceInfo,
    fixesAppliedFrom: [
      'the 2026-09-19 terraces contain two distinct paths repeated six times each (layer k == layer k+2, 0.000 mm); here the six R layers carry six different phases and the six C layers six different rail offsets, so no layer of a terrace coincides with another',
      'the 2026-09-19 crossings have a median angle of 16-54 deg with 44% below 10 deg on the largest terrace; a rail crosses a tooth at ~90 deg',
      "Semir 2026-09-18: 'in the next layer make rails for next layer' — the C layers are those rails",
    ],
    estimates: { threadLength_m: rr(threadEst, 0), ringThread_m: rr(ringThread / 1000, 1), typedPathThread_m: rr(pathThread / 1000, 1), maxTypedSegment_mm: rr(maxSeg, 3), note: 'thread = 1.94 x ring length (calibrated on four printed objects) + typed path length as emitted' },
    args: { lh: LH, bead: BEAD, firstLayerBead: m.firstLayerBead, firstLayerSpeed: 12, w: W_WALL, e: E_WALL, r0: R, K: K_MAX, foundation: BRIM,
      maxbridge: DECL_BRIDGE, maxcantilever: DECL_CANT, allow: 0.6, minanchor: 0.5, maxCapRadius: 20, speed: o.speed || 38, bridgeSpeed: o.bridgeSpeed || 14, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'every finding must fall inside a declared terrace; a finding in a wall is a design error', bridge_mm: DECL_BRIDGE, cantilever_mm: DECL_CANT, membrane_min_anchor: 0.5, first_layer_max_islands: 1, secondGate_mm: EVIDENCED_BRIDGE_MM },
    experiments: {
      declaredBridgeCeiling_mm: DECL_BRIDGE, gateCantilever_mm: DECL_CANT, experimentalFreeTip_mm: maxReach, evidencedBridge_mm: EVIDENCED_BRIDGE_MM,
      zones: terraceInfo.map(t => ({ name: `terrace ${t.id}`, z0: rr(t.zFrom - 0.01, 3), z1: rr(t.zTo + 0.01, 3), longestChord_mm: Math.max(...t.sectors.map(s => s.firstLayerCantilever_mm)) })),
      protocol: 'gate at the declared ceiling must be clean; at the evidenced 16.2 mm ceiling every finding must fall inside a declared terrace zone, and the count per terrace is itself a result',
    },
    foundation: { paths: foundation.length, islandsExpected: 1, kind: 'rings + spokes under the single cylinder' },
    reading: 'Photograph each terrace from a fixed side with a scale, before the wall above it starts and after. Record the sector angle at which the comb first fails, for each terrace, and the underside after removal.',
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'rings+spokes', paths: foundation }, layers };

  function svg() {
    const Wv = 1040, Hv = 660, els = [];
    const sc = 300 / (2 * outerExtent), ox = 190, oy = 330;
    const tA = layers.find(l => l.phase === 'terrace-A' && l.paths && l.paths.length === 1);
    const tA2 = layers.find(l => l.phase === 'terrace-A' && l.paths && l.paths.length > 1);
    els.push(`<circle cx="${ox}" cy="${oy}" r="${R * sc}" fill="none" stroke="#2f4666" stroke-width="1.2"/>`);
    for (const src of [[tA, '#f6ff78', 0.5], [tA2, '#ff4d6d', 0.8]]) if (src[0]) for (const p of src[0].paths) {
      const s = p.pts.map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - q[1] * sc).toFixed(1)}`).join(' ');
      els.push(`<polyline points="${s}" fill="none" stroke="${src[1]}" stroke-width="${src[2]}"/>`);
    }
    for (let s = 0; s < NSEC; s++) { const t = s * SEC + SEC / 2, rr2 = (R_OUT + REACH_LADDER[s] + 5) * sc;
      els.push(`<text x="${(ox + rr2 * Math.cos(t)).toFixed(1)}" y="${(oy - rr2 * Math.sin(t)).toFixed(1)}" fill="#9bb0c8" font-family="sans-serif" font-size="9" text-anchor="middle">${REACH_LADDER[s]}</text>`); }
    const px = 720, py = 620, pys = 560 / H_TOTAL, pxs = 300 / (2 * outerExtent);
    for (const lay of layers) { let mn = 1e9, mx = 0;
      for (const c of lay.contours) for (const p of c.pts) { const r2 = hyp(p[0], p[1]); if (r2 < mn) mn = r2; if (r2 > mx) mx = r2; }
      for (const pth of (lay.paths || [])) for (const p of pth.pts) { const r2 = hyp(p[0], p[1]); if (r2 < mn) mn = r2; if (r2 > mx) mx = r2; }
      const yy = py - lay.zBot * pys;
      els.push(`<line x1="${(px - mx * pxs).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(px + mx * pxs).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${lay.phase.startsWith('terrace') ? '#ff4d6d' : '#2f7a4a'}" stroke-width=".7" opacity=".85"/>`);
      if (mn < R - 1) els.push(`<line x1="${(px - mn * pxs).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(px + mn * pxs).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#070a12" stroke-width=".7"/>`);
    }
    for (const t of terraceInfo) els.push(`<text x="${px + 160}" y="${(py - t.zFrom * pys).toFixed(1)}" fill="#fff" font-family="sans-serif" font-size="10">${t.id} — ${t.title}</text>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>${els.join('')}`
      + `<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="13">${summary.name} — how far a returning hairpin reaches before it stops being a surface</text>`
      + `<text x="12" y="38" fill="#9bb0c8" font-family="sans-serif" font-size="10">${size[0]} x ${size[1]} x ${size[2]} mm · ${m.label} · bead ${BEAD} (${m.beadSource}) · ${layers.length} layers · ladder ${REACH_LADDER.join('/')} mm in eight sectors · left: terrace A, teeth (yellow) and rails (red)</text></svg>`;
  }
  return { payload, summary, violations, warnings, svg };
}

function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const machine = opt('machine'), out = opt('out');
  if (!machine || !out) { console.error('usage: node core/weft_domet_geometry.mjs --machine ender|a2l --out FILE [--svg FILE] [--radius MM] [--wall-mm MM] [--name NAME] [--allow-assumed-bead]'); process.exit(2); }
  const r = generateDomet({ machine, out, radius: opt('radius'), wallMm: opt('wall-mm'), margin: opt('margin'), name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') });
  for (const w of r.warnings) console.error('note: ' + w);
  if (r.violations.length) { console.error('REFUSED:'); for (const v of r.violations.slice(0, 10)) console.error('  * ' + v); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  if (opt('svg')) fs.writeFileSync(opt('svg'), r.svg());
  const s = r.summary;
  console.log(JSON.stringify({ name: s.name, size_mm: s.size_mm, layers: s.totalLayers, thread_est_m: s.estimates.threadLength_m, maxSeg: s.estimates.maxTypedSegment_mm,
    terraces: s.terraces.map(t => `${t.id} z${t.zFrom}-${t.zTo} ${t.dir} ${t.cells}cells ${t.distinctPaths}paths`), zones: s.experiments.zones }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
