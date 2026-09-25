/* WEFT — KRAK: five ways to hold a shelf in the air, compared on one object (2026-09-24).

   WHY. DOMET was printed on the Ender on 2026-09-24 and it finished. Its terraces are NOT flat: every skirt
   droops, and the hairpin tips read in the photographs as individual hanging loops rather than as the stiff
   fused palisade the 2026-09-19 ziggurat produced. The difference between the two objects is that the
   ziggurat's terraces contain only TWO distinct paths, each laid six times onto itself, and DOMET's ribbed
   terraces contain twelve distinct paths, so nothing is ever laid onto itself. The 2026-09-23 finding called
   that repetition a defect. The evidence says it is what made the ziggurat stiff. KRAK treats the two-path
   scheme as the CONTROL, not as the fault.

   DOMET also has a flaw of experiment design that this object corrects. Its reach ladder runs around the
   azimuth, and so does the part-cooling airflow, so a break at a given bearing cannot be told apart from a
   break at a given reach. Here every method appears TWICE, on opposite sides of the cylinder, so an effect
   that belongs to the machine's airflow shows as a difference between the two copies and an effect that
   belongs to the geometry shows as a difference between methods.

   THE FIVE METHODS, one per 36 degree sector, sector s carries method s mod 5, so s and s+5 are the same
   method 180 degrees apart:

     plain    the 2026-09-19 scheme: a triangle wave, two phases alternating, each laid six times onto itself.
              The current champion and the control.
     tiprail  the same wave, but every other layer runs a circumferential thread AT THE TIP RADIUS, landing on
              the tips below it. A row of independent cantilevers becomes one ring beam, and the rail itself
              only ever bridges one tooth pitch.
     truss    the outbound leg zigzags between two radial lines before reaching the tip, so the pair is a plane
              truss instead of two parallel wires.
     splay    the same wave with a tooth that spans TWO cells at the base and converges to one tip, so the tip
              is held by a base twice as wide.
     corbel   no cantilever at all. Each layer advances the reach by ADV mm over the layer below, so nothing
              ever hangs further than ADV. Classic masonry corbelling; the cost is height, not stability.

   THE THREE TERRACES:
     K1  reach 24 mm, heroic entry — layer 0 is a full-length cantilever. Near the evidenced limit (the
         ziggurat terrace that stayed flat had a maximum free reach of 25.3 mm).
     K2  reach 40 mm, ramped entry — every method, corbel included, grows the reach at ADV per layer until it
         is out at 40, then runs its own pattern for twelve more layers. This removes the cantilever problem
         and asks the architectural question instead: how far can a floating shelf go, and which weave keeps
         it flat once it is there.
     K3  a corbel-only reach ladder, 20/27/34/41/48 mm in five double sectors. This is where corbelling itself
         runs out, and it is the number that says how far WEFT can reach at all.

   READING THE RESULT. Find a sector by its fringe: on K3 the shortest fringe is 20 mm and they ascend
   clockwise. On K1 and K2 all ten sectors reach the same distance, so the methods are told apart by texture,
   and the pair test is: does the same method look the same on both sides of the object?

   usage: node core/weft_krak_geometry.mjs --machine ender|a2l --out FILE [--svg FILE] [--radius MM]
          [--name NAME] [--allow-assumed-bead] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, densifyNodes, resample, clamp, rr, loadMachine, EVIDENCED_BRIDGE_MM } from './weft_cube_geometry.mjs';

const TAU = 2 * Math.PI, hyp = Math.hypot;
export const PROCESS = 'reach-method-comparison/v1';

export const METHODS = ['plain', 'tiprail', 'truss', 'splay', 'castle'];
export const ADVANCE_LADDER = [1.5, 3, 4.5, 6, 9];
export const REACH_LADDER   = [20, 27, 34, 41, 48];

export const TERRACES = [
  /* three single-variable ladders, each rung printed twice 180 degrees apart */
  { id: 'K1', title: 'tooth shape, five shapes at 24 mm, heroic entry', reach: 24, entry: 'heroic', layers: 12, style: 'wave' },
  { id: 'K2', title: 'corbel step, five advances to 40 mm',  reach: 40, entry: 'ramp', layers: 28, style: 'castle', advLadder: ADVANCE_LADDER },
  { id: 'K3', title: 'corbel reach ladder, 20 to 48 mm',     reach: null, entry: 'ramp', layers: 26, style: 'castle', ladder: REACH_LADDER },
];
const WALL_WEB = ['staple', 'diagonal', 'sine', 'eight'];

export function generateKrak(o) {
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh;
  const MARGIN = o.margin != null ? +o.margin : 15;
  const R = o.radius != null ? +o.radius : 32;
  const W_WALL = 3.0, W_FOOT = 3.4, E_WALL = 0.7, K_MAX = 192, GAP_MAX = 9.5;
  const BRIM = 6.0;
  const WALL_MM = o.wallMm != null ? +o.wallMm : 7.0;
  const N_WALL = Math.max(12, Math.round(WALL_MM / LH));
  const P_CELL = o.cell != null ? +o.cell : 5.0, TIP_GAP = 1.2, TIP_MIN = 2.2;
  const SEG = o.seg != null ? +o.seg : 0.5;     // must stay <= max(0.55, bead*1.25); larger sampling keeps the emitted file inside the 20 MB transfer limit
  const ADV = o.adv != null ? +o.adv : 2.5;              // corbel / ramp advance per layer
  const NSEC = 10, SEC = TAU / NSEC;
  const violations = [], warnings = [], events = [];

  const R_OUT = R + W_WALL / 2 + E_WALL;
  const maxReach = Math.max(24, 40, ...REACH_LADDER);
  const outerExtent = R_OUT + maxReach + BEAD / 2;
  if (2 * (outerExtent + BRIM + 2) > Math.min(m.plate[0], m.plate[1]) - 2 * MARGIN)
    violations.push(`outer extent ${rr(2 * outerExtent, 1)} mm does not fit ${m.plate.join(' x ')} with a ${MARGIN} mm margin`);

  /* ---------------- the profile ---------------- */
  const L = [];
  let band = 0;
  for (const T of TERRACES) {
    for (let j = 0; j < N_WALL; j++) L.push({ zone: 'wall', band, f: j / N_WALL });
    for (let j = 0; j < T.layers; j++) L.push({ zone: 'terrace', band, terrace: T, j });
    band++;
  }
  for (let j = 0; j < Math.round(N_WALL * 0.6); j++) L.push({ zone: 'wall', band, f: j / N_WALL });
  const H_TOTAL = L.length * LH;
  if (H_TOTAL > m.maxZ) violations.push(`height ${rr(H_TOTAL, 1)} exceeds the machine's ${m.maxZ}`);

  /* ---------------- per sector: method and reach ---------------- */
  const methodOf = (T, s) => T.style === 'castle' ? 'castle' : METHODS[s % METHODS.length];
  const reachOf  = (T, s) => T.ladder ? T.ladder[s % T.ladder.length] : T.reach;
  const advOf    = (T, s) => T.advLadder ? T.advLadder[s % T.advLadder.length] : ADV;
  /** reach available to terrace-layer j for this sector.
      On a ramped terrace nothing ever hangs further than one advance beyond the layer below, so the gate's
      declared ceiling is never the thing under test. */
  const reachAt = (T, s, j) => {
    const full = reachOf(T, s), meth = methodOf(T, s);
    if (meth === 'corbel' || T.entry === 'ramp') return Math.min(full, (j + 1) * advOf(T, s));
    return full;                                        // heroic: layer 0 is the whole cantilever
  };

  const ringPts = (rad, from = 0) => { const n = Math.max(64, Math.ceil(TAU * Math.abs(rad) / SEG)), o = [];
    for (let i = 0; i <= n; i++) { const t = from + TAU * i / n; o.push([rad * Math.cos(t), rad * Math.sin(t)]); } return o; };
  const arc = (rad, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * Math.abs(rad) / SEG)), o = [];
    for (let i = 1; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; o.push([rad * Math.cos(t), rad * Math.sin(t)]); } return o; };
  const radial = (th, r0, r1) => { const n = Math.max(2, Math.ceil(Math.abs(r1 - r0) / SEG)), o = [];
    for (let i = 1; i <= n; i++) { const r = r0 + (r1 - r0) * i / n; o.push([r * Math.cos(th), r * Math.sin(th)]); } return o; };
  const P = (t, r) => [r * Math.cos(t), r * Math.sin(t)];

  /* ---------------- one terrace layer ---------------- */
  /* The whole layer is ONE line: the base ring first (so every later move starts from supported material),
     then sector by sector. A sector emits either teeth or, for tiprail on its rail layers, a circumferential
     thread at the tip radius reached by a RADIAL jog placed exactly on a tooth leg below it. */
  function terraceLayer(T, j, jit) {
    const Rb = R_OUT + 0.55 + jit;
    /* N is taken from the UNJITTERED radius. Taking it from Rb let a 0.4 mm jitter flip the rounding between
       54 and 55 cells, which moved every tooth angle and left whole teeth hanging over nothing — 83 mm runs. */
    const N = Math.max(24, Math.round(TAU * (R_OUT + 0.55) / P_CELL)), dth = TAU / N;
    const pts = ringPts(Rb).slice();
    const info = [];
    let cells = 0;
    for (let s = 0; s < NSEC; s++) {
      const meth = methodOf(T, s), full = reachOf(T, s), rch = reachAt(T, s, j);
      const th0 = s * SEC, th1 = (s + 1) * SEC;
      const stride = meth === 'splay' ? 2 : 1;
      /* phase: plain and splay keep the two-phase 2026-09-19 scheme (each path laid six times onto itself);
         truss and corbel carry six distinct phases; tiprail alternates teeth and rail */
      const twoPhase = (meth === 'plain' || meth === 'splay' || meth === 'tiprail');
      /* A ramped terrace is PHASE LOCKED: every layer lies on the one below and only the new advance is in
         open air. That is what corbelling means, and it is also the 2026-09-19 stacking the printed ziggurat
         says is stiff. Only the heroic terrace K1 uses the alternating phases, where the layers cross. */
      const ph = T.entry === 'ramp' ? 0 : (twoPhase ? (j % 2) * 0.5 * stride : ((j % 6) / 6));
      const i0 = Math.ceil(th0 / dth / stride) * stride, i1 = Math.floor(th1 / dth / stride) * stride;
      if (i1 - i0 < 2 * stride) continue;

      if (T.style === 'castle') {
        if (rch < 0.9) continue;
        /* RADIAL legs and an arc across the top. Because the legs are radial, a layer that reaches further
           lies exactly on the layer below along its whole length and only the new advance is in open air.
           That is what makes a corbel a corbel, and it is what the triangle wave cannot do: a wave's leg runs
           from a fixed base angle to a fixed tip angle, so when the tip radius grows the whole leg swings and
           misses the leg below it. */
        const rTipC = Rb + rch, duty = 0.5;
        const last1 = pts[pts.length - 1];
        pts.push(...arc(Rb, Math.atan2(last1[1], last1[0]), i0 * dth));
        for (let i = i0; i + 1 <= i1; i++) {
          const tA = i * dth, tW = tA + duty * dth;
          pts.push(...radial(tA, Rb, rTipC));
          pts.push(...arc(rTipC, tA, tW));
          pts.push(...radial(tW, rTipC, Rb));
          pts.push(...arc(Rb, tW, (i + 1) * dth));
          cells++;
        }
        info.push({ sector: s, method: 'castle', kind: 'castellated', reach_mm: rr(rch, 2), fullReach_mm: full,
          advance_mm: advOf(T, s), toothWidthAtTip_mm: rr(duty * dth * rTipC, 2), gapAtTip_mm: rr((1 - duty) * dth * rTipC, 2) });
        continue;
      }

      if (rch < 0.9) continue;

      const last0 = pts[pts.length - 1];
      pts.push(...arc(Rb, Math.atan2(last0[1], last0[0]), (i0 + ph) * dth));
      const rTip = Rb + rch;
      const tipHalf = Math.min(stride * dth * 0.3, TIP_GAP / 2 / rTip);
      for (let i = i0; i + stride <= i1; i += stride) {
        const tA = (i + ph) * dth, tB = (i + stride + ph) * dth, tM = (i + stride / 2 + ph) * dth;
        if (meth === 'castle') {
          const rT = Rb + rch, tW = tA + 0.5 * (tB - tA);
          pts.push(...radial(tA, hyp(pts[pts.length - 1][0], pts[pts.length - 1][1]), rT));
          pts.push(...arc(rT, tA, tW));
          pts.push(...radial(tW, rT, Rb));
          pts.push(...arc(Rb, tW, tB));
        } else if (meth === 'truss') {
          /* The zigzag swings between the outbound line and the tooth's MIDLINE, not the full cell width, and
             takes a rung every 8 mm. A wider swing or a finer rung made the truss path itself longer than two
             reaches, and the gate scores a returning figure by its path length: at full cell width the 24 mm
             truss came out as a 62.6 mm run and was refused. */
          const tC = tA + 0.5 * (tB - tA);
          const NZ = Math.max(2, Math.round(rch / 8));            // zigzag rungs on the way out
          for (let z = 1; z <= NZ; z++) {
            const rz = Rb + (rch - 0) * z / (NZ + 1);
            pts.push(...resample([pts[pts.length - 1], P(z % 2 ? tC : tA, rz)], SEG).slice(1));
          }
          pts.push(...resample([pts[pts.length - 1], P(tM - tipHalf, rTip)], SEG).slice(1));
          pts.push(...resample([P(tM - tipHalf, rTip), P(tM + tipHalf, rTip)], SEG).slice(1));
          pts.push(...resample([P(tM + tipHalf, rTip), P(tB, Rb)], SEG).slice(1));
        } else {
          pts.push(...resample([P(tA, Rb), P(tM - tipHalf, rTip)], SEG).slice(1));
          pts.push(...resample([P(tM - tipHalf, rTip), P(tM + tipHalf, rTip)], SEG).slice(1));
          pts.push(...resample([P(tM + tipHalf, rTip), P(tB, Rb)], SEG).slice(1));
        }
        cells++;
      }
      let rail = null;
      if (meth === 'tiprail' && j > 0) {
        /* The TIP RAIL. It runs back across the sector at the radius the layer BELOW reached, so it lands on
           that layer's tips — supported every tooth pitch, a bridge of one pitch at the tip radius and never
           more — and on the way it ties every leg of the layer just laid. A row of independent cantilevers
           becomes one ring beam. It then follows the first tooth's own leg back in to the base ring rather
           than crossing open air on a radius. */
        const rPrev = Rb + reachAt(T, s, j - 1);
        const tA0 = (i0 + ph) * dth, tM0 = (i0 + stride / 2 + ph) * dth;
        const u = clamp((rPrev - Rb) / Math.max(rch, 1e-6), 0, 1);
        const aFirst = tA0 + (tM0 - tipHalf - tA0) * u;
        const iL = i0 + stride * Math.floor((i1 - i0) / stride - 1);
        const tAL = (iL + ph) * dth, tML = (iL + stride / 2 + ph) * dth;
        const aLast = tAL + (tML - tipHalf - tAL) * u;
        if (rPrev > Rb + 0.9 && aLast > aFirst) {
          const cur = pts[pts.length - 1];
          pts.push(...resample([cur, P(aLast, rPrev)], SEG).slice(1));
          pts.push(...arc(rPrev, aLast, aFirst));
          pts.push(...resample([P(aFirst, rPrev), P(tA0, Rb)], SEG).slice(1));
          rail = { radius_mm: rr(rPrev - Rb, 2), spanPerPitch_mm: rr(stride * dth * rPrev, 2) };
        }
      }
      info.push({ sector: s, method: meth, kind: 'teeth', reach_mm: rr(rch, 2), fullReach_mm: full, toothSpan_mm: rr(stride * dth * Rb, 2), tipRail: rail });
    }
    return { pts: pts.map(([x, y]) => [rr(x, 3), rr(y, 3)]), info, cells };
  }

  /* ---------------- layers ---------------- */
  const kFor = (Pn, web) => { let K = K_MAX; while (K > 12 && Pn / K < 3.0) K = Math.floor(K / 2); if ((web === 'sine' || web === 'eight' || web === 'diagonal') && Pn / (2 * K) >= 2.3) K *= 2; return K; };
  const NPHI = clamp(8 * Math.round(TAU * R / 0.8 / 8), 240, 720);
  const circle = [];
  for (let i = 0; i < NPHI; i++) { const t = TAU * i / NPHI; circle.push([rr(R * Math.cos(t), 3), rr(R * Math.sin(t), 3)]); }
  const P_RING = TAU * R;

  const layers = [], terraceInfo = [];
  let curTerr = null;
  for (let k = 0; k < L.length; k++) {
    const spec = L[k], z = k * LH;
    const web = WALL_WEB[spec.band % WALL_WEB.length];
    const w = k < 30 ? W_FOOT + (W_WALL - W_FOOT) * (k / 30) : W_WALL;
    const K = kFor(P_RING, web);
    let nodesU = []; for (let j = 0; j < K; j++) nodesU.push(P_RING * j / K);
    nodesU = densifyNodes(nodesU, P_RING, true, GAP_MAX);
    const phase = spec.zone === 'terrace' ? `terrace-${spec.terrace.id}` : `wall-${spec.band + 1}`;
    const rec = record(circle, true, nodesU, w, E_WALL, spec.zone === 'terrace' ? 'staple' : web, P_RING / 4, 0,
      spec.zone === 'terrace' ? `terrace${spec.terrace.id}-ring` : `wall${spec.band + 1}-ring`, spec.band);
    const lay = { k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: rr(w, 3), tab: rr(E_WALL, 3), web: spec.zone === 'terrace' ? 'staple' : web, phase, contours: [rec] };

    if (spec.zone === 'wall' && L[k + 1] && L[k + 1].zone === 'terrace') {
      const T2 = L[k + 1].terrace;
      lay.paths = [{ pts: ringPts(R_OUT).map(([x, y]) => [rr(x, 3), rr(y, 3)]), role: 'bridge', closed: false, speed: o.bridgeSpeed || 14,
        label: `terrace${T2.id}-seat`, tile: `terrace${T2.id}`, intent: `${PROCESS}: seat ring for terrace ${T2.id}, on the wall rail, so the first wave has a continuous landing (the DOMET fix)` }];
    }
    if (spec.zone === 'terrace') {
      const T = spec.terrace;
      if (spec.j === 0) {
        curTerr = { id: T.id, title: T.title, entry: T.entry, zFrom: rr(z, 3), zTo: rr(z + T.layers * LH, 3), layers: T.layers, kFrom: k,
          advance_mm: (T.entry === 'ramp' || T.allCorbel) ? ADV : null, sectors: [] };
        for (let s = 0; s < NSEC; s++) curTerr.sectors.push({ sector: s, deg: `${rr(s * 36, 0)}-${rr((s + 1) * 36, 0)}`,
          method: methodOf(T, s), reach_mm: reachOf(T, s), pairedWithSector: (s + 5) % NSEC,
          firstLayerCantilever_mm: rr(reachAt(T, s, 0), 2) });
        terraceInfo.push(curTerr);
      }
      /* a ramped terrace is meant to lie exactly on itself, so it gets no jitter at all */
      const t = terraceLayer(T, spec.j, (T.entry === 'ramp' || spec.j === 0) ? 0 : (spec.j % 4 < 2 ? 0.2 : -0.2));
      lay.paths = [{ pts: t.pts, role: 'bridge', closed: false, speed: o.bridgeSpeed || 14, label: `terrace${T.id}-j${spec.j}`, tile: `terrace${T.id}`,
        intent: `${PROCESS}: terrace ${T.id} layer ${spec.j}, base ring + ${t.info.length} sector figures, ${t.cells} teeth` }];
      if (spec.j === 0) curTerr.cellsFirstLayer = t.cells;
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
  const DECL_CANT = 8, DECL_BRIDGE = 60;

  const summary = {
    name: o.name || `KRAK_${m.id.toUpperCase()}_X1`, generator: 'core/weft_krak_geometry.mjs', process: PROCESS,
    generatedAt: new Date().toISOString().slice(0, 10), machine: m.id, machineLabel: m.label,
    machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    purpose: 'A comparison of five ways to carry a horizontal shelf in open air, all on one object, each method printed twice on opposite sides so that an effect belonging to the machine can be told apart from an effect belonging to the geometry.',
    principle: `${PROCESS}: ten 36 degree sectors, sector s carries method s mod 5, so sectors s and s+5 are the same method 180 degrees apart. plain = the 2026-09-19 two-path wave (the control, and the current champion). tiprail = the same wave with a circumferential thread at the tip radius every other layer, turning a row of cantilevers into a ring beam. truss = a zigzag outbound leg. splay = a tooth spanning two cells. corbel = no cantilever at all, the reach grows by ${ADV} mm per layer.`,
    size_mm: size, height_mm: size[2], wallRadius_mm: R, totalLayers: layers.length, layerHeight_mm: LH, bead_mm: BEAD,
    wallBetweenTerraces_mm: rr(N_WALL * LH, 2), toothPitch_mm: P_CELL, tipGap_mm: TIP_GAP, corbelAdvance_mm: ADV,
    sectors: NSEC,
    methods: METHODS, corbelLadder_mm: REACH_LADDER, advanceLadder_mm: ADVANCE_LADDER,
    terraces: terraceInfo,
    correctsFrom: [
      'DOMET 2026-09-24, printed: every terrace skirt droops and the tips read as hanging loops, while the 2026-09-19 ziggurat, whose terraces repeat every second layer, came out as a stiff palisade. The repetition the 2026-09-23 finding called a defect is treated here as the control.',
      "DOMET's reach ladder runs around the azimuth and so does the part-cooling airflow, so the two cannot be separated. Here every method is printed twice, 180 degrees apart.",
      'the seat ring laid by the last wall layer is kept: no terrace of DOMET failed at its root, only at its tip.',
    ],
    estimates: { threadLength_m: rr(threadEst, 0), ringThread_m: rr(ringThread / 1000, 1), typedPathThread_m: rr(pathThread / 1000, 1), maxTypedSegment_mm: rr(maxSeg, 3), note: 'thread = 1.94 x ring length (calibrated on four printed objects) + typed path length as emitted' },
    args: { lh: LH, bead: BEAD, firstLayerBead: m.firstLayerBead, firstLayerSpeed: 12, w: W_WALL, e: E_WALL, r0: R, K: K_MAX, foundation: BRIM,
      maxbridge: DECL_BRIDGE, maxcantilever: DECL_CANT, allow: 0.6, minanchor: 0.5, maxCapRadius: 20, speed: o.speed || 38, bridgeSpeed: o.bridgeSpeed || 14, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'every finding must fall inside a declared terrace; a finding in a wall is a design error', bridge_mm: DECL_BRIDGE, cantilever_mm: DECL_CANT, membrane_min_anchor: 0.5, first_layer_max_islands: 1, secondGate_mm: EVIDENCED_BRIDGE_MM },
    experiments: {
      declaredBridgeCeiling_mm: DECL_BRIDGE, gateCantilever_mm: DECL_CANT, experimentalFreeTip_mm: 24, evidencedBridge_mm: EVIDENCED_BRIDGE_MM,
      zones: terraceInfo.map(t => ({ name: `terrace ${t.id}`, z0: rr(t.zFrom - 0.01, 3), z1: rr(t.zTo + 0.01, 3), longestChord_mm: Math.max(...t.sectors.map(s => s.firstLayerCantilever_mm)) })),
      protocol: 'gate at the declared ceiling must be clean; at the evidenced 16.2 mm ceiling every finding must fall inside a declared terrace zone, and the count per terrace is itself a result',
    },
    foundation: { paths: foundation.length, islandsExpected: 1, kind: 'rings + spokes under the single cylinder' },
    reading: 'For each terrace, photograph from a fixed side with a scale and compare each method against its own copy 180 degrees away. A difference between the two copies of one method belongs to the machine; a difference between methods belongs to the geometry. On K3 the shortest fringe is the 20 mm rung and they ascend.',
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'rings+spokes', paths: foundation }, layers };

  function svg() {
    const Wv = 1040, Hv = 700, els = [];
    const sc = 300 / (2 * outerExtent), ox = 350, oy = 350;
    const pick = (id, j) => layers.find(l => l.phase === `terrace-${id}` && l.paths && l.paths[0].label === `terrace${id}-j${j}`);
    els.push(`<circle cx="${ox}" cy="${oy}" r="${R * sc}" fill="none" stroke="#2f4666" stroke-width="1.2"/>`);
    for (const [id, j, col, wd] of [['K2', 31, '#f6ff78', 0.45], ['K1', 0, '#ff4d6d', 0.8]]) {
      const l = pick(id, j); if (!l) continue;
      for (const p of l.paths) els.push(`<polyline points="${p.pts.map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - q[1] * sc).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${wd}"/>`);
    }
    for (let s = 0; s < NSEC; s++) { const t = (s + 0.5) * SEC, r = outerExtent * sc + 14;
      els.push(`<text x="${(ox + r * Math.cos(t)).toFixed(1)}" y="${(oy - r * Math.sin(t)).toFixed(1)}" font-family="Arial" font-size="9" fill="#cfe3e6" text-anchor="middle">${METHODS[s % 5]}</text>`); }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Wv}" height="${Hv}" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#0d1b1e"/>${els.join('')}</svg>`;
  }
  return { payload, svg, violations, warnings };
}

/* ---------------- CLI ---------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const A = process.argv.slice(2), opt = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 ? A[i + 1] : d; }, flag = (n) => A.includes('--' + n);
  const o = { machine: opt('machine', 'ender'), out: opt('out'), svg: opt('svg'), radius: opt('radius'), wallMm: opt('wall-mm'), cell: opt('cell'), seg: opt('seg'),
              adv: opt('adv'), name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') || flag('i-know-the-bead-is-a-guess') };
  const { payload, svg, violations, warnings } = generateKrak(o);
  for (const w of warnings) console.error('WARN  ' + w);
  if (violations.length) { for (const v of violations) console.error('REFUSE ' + v); process.exit(2); }
  if (o.out) { fs.writeFileSync(o.out, JSON.stringify(payload)); console.error(`GEOM  ${o.out}  ${payload.layers.length} layers, ${payload.summary.size_mm.join(' x ')} mm, ~${payload.summary.estimates.threadLength_m} m thread`); }
  if (o.svg) { fs.writeFileSync(o.svg, svg()); console.error(`SVG   ${o.svg}`); }
  if (!o.out && !o.svg) console.log(JSON.stringify(payload.summary, null, 2));
}
