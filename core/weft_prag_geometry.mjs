/* WEFT — PRAG and KUKA: the two questions KRAK asked at once, asked one at a time (2026-09-25).

   WHY. KRAK was printed on both machines on 2026-09-24 and both copies were destroyed. The support gate had
   said PASS, 0 problems. Measured over the bytes of the shipped G-code afterwards (journal/2026-09-25):
   47.0 m of the A2L object's 279.2 m of thread is laid with nothing under it, and terrace K1 alone contains
   512 continuous free runs longer than 10 mm, one of them 206.8 mm long, inside a band 2.88 mm tall. The
   woven walls contain none over 10 mm. Travel moves are not the mechanism: the whole object has 237 travels
   totalling 1.9 m. The nozzle meets the raised tip of a cooling cantilever while it is still printing.

   TWO DESIGN ERRORS THESE OBJECTS CORRECT.

   1. The most dangerous band was the LOWEST one. K1 sat at Z 5.04-7.92, so when it tangled it took the
      corbel terraces above it with it, and predictions 1, 2, 4 and 5 were never tested at all. Here the
      terrace is the LAST thing printed. Whatever happens to it, the drum below is already finished and
      every sector that did hold can be read off the object. The object must die from the top.

   2. KRAK varied five things at once. Each of these objects varies ONE, on a terrace that is otherwise
      identical between them: the same drum, the same corbel advance, the same reach, the same 10 sectors of
      36 degrees, each method printed twice 180 degrees apart so that an effect belonging to the part-cooling
      fan shows up as a difference between twins.

   PRAG — how far may thread go before it touches something again?
      One corbel terrace. Every sector has the same radial legs and the same reach. Only the CIRCUMFERENTIAL
      GAP at the tip differs: 3, 6, 9, 13, 18 mm. That gap is exactly the quantity the new gate layer S2
      measures, so the object puts a number on the threshold the gate should refuse at.

   KUKA — is it the free LENGTH that kills, or the free END?
      One corbel terrace, the same 6 mm gap in every sector. Only the END CONDITION differs:
        zatvoren  the corbel tooth as it is: out, across, back. No free end anywhere.
        kuka      the same tooth with the leg overshooting the tip arc by 3 mm and turning back, so every
                  tooth carries one unsupported hairpin apex — the KRAK K1 condition, isolated.
        rebro     the same tooth plus a circumferential rib at the radius the layer below reached, landing
                  on that layer's tips and tying every leg just laid.
        dupli     the same tooth laid twice onto itself inside one layer — the 2026-09-19 ziggurat's
                  self-stacking, which the printed evidence says is what made it stiff.
        koren     the same tooth whose return leg runs all the way in to the wall ring instead of stopping
                  at the terrace base, so each tooth is anchored deep rather than at its own root.

   usage: node core/weft_prag_geometry.mjs --variant prag|kuka --machine ender|a2l --out FILE [--svg FILE]
          [--radius MM] [--reach MM] [--adv MM] [--name NAME] [--allow-assumed-bead] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, densifyNodes, resample, clamp, rr, loadMachine, EVIDENCED_BRIDGE_MM } from './weft_cube_geometry.mjs';

const TAU = 2 * Math.PI, hyp = Math.hypot;
export const PROCESS = 'single-variable-terrace/v1';

/* the ladders — five rungs, each printed twice, sector s pairs with sector s+5 */
export const GAP_LADDER = [3, 6, 9, 13, 18];   // PRAG: free span at the tip, mm — brackets the measured evidence: woven walls survive at max 4.9 mm, KRAK terrace K1 died at p90 23 mm
export const END_LADDER = ['zatvoren', 'kuka', 'rebro', 'dupli', 'koren'];      // KUKA: how the tooth ends

export const VARIANTS = {
  prag: {
    title: 'free span ladder — how far may thread go before it touches something again',
    ladder: GAP_LADDER, ladderName: 'tipGap_mm',
    question: 'At which circumferential gap does a corbel tooth stop being a shelf and start being a hook?',
  },
  kuka: {
    title: 'end condition ladder — is it the free length that kills, or the free end',
    ladder: END_LADDER, ladderName: 'endCondition',
    question: 'With the free span held at 6 mm in every sector, which way of ending a tooth survives?',
  },
};

export function generatePrag(o) {
  const variant = (o.variant || 'prag').toLowerCase();
  const V = VARIANTS[variant];
  if (!V) throw new Error(`unknown variant ${variant}; use prag or kuka`);
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh;
  const MARGIN = o.margin != null ? +o.margin : 15;
  const R = o.radius != null ? +o.radius : 55;
  const W_WALL = 3.0, W_FOOT = 3.4, E_WALL = 0.7, K_MAX = 192, GAP_MAX = 9.5;
  const BRIM = 6.0;
  const REACH = o.reach != null ? +o.reach : 22;        // both variants reach the same distance
  const ADV = o.adv != null ? +o.adv : 2.5;             // corbel advance per layer — the evidenced safe step
  const KUKA_OVERSHOOT = 3.0;                           // mm past the tip arc, for the kuka sectors only
  const FIXED_GAP = 6;                                  // KUKA holds the span constant at this
  const SEG = o.seg != null ? +o.seg : 0.5;
  const NSEC = 10, SEC = TAU / NSEC;
  const TERRACE_LAYERS = Math.ceil(REACH / ADV) + 2;    // ramp out, then two layers at full reach
  /* the drum: tall enough to be a finished object on its own, because it is what survives a tangle */
  const WALL_MM = o.wallMm != null ? +o.wallMm : 18.0;
  const N_WALL = Math.max(12, Math.round(WALL_MM / LH));
  const CAP_LAYERS = 2;                                 // a short collar over the terrace, nothing more

  const violations = [], warnings = [], events = [];
  const R_OUT = R + W_WALL / 2 + E_WALL;
  const outerExtent = R_OUT + REACH + KUKA_OVERSHOOT + BEAD / 2;
  if (2 * (outerExtent + BRIM + 2) > Math.min(m.plate[0], m.plate[1]) - 2 * MARGIN)
    violations.push(`outer extent ${rr(2 * outerExtent, 1)} mm does not fit ${m.plate.join(' x ')} with a ${MARGIN} mm margin`);

  /* ---------------- the profile: wall, then ONE terrace, then a collar ---------------- */
  const L = [];
  for (let j = 0; j < N_WALL; j++) L.push({ zone: 'wall', band: 0, f: j / N_WALL });
  for (let j = 0; j < TERRACE_LAYERS; j++) L.push({ zone: 'terrace', band: 0, j });
  for (let j = 0; j < CAP_LAYERS; j++) L.push({ zone: 'wall', band: 1, f: j / N_WALL });
  const H_TOTAL = L.length * LH;
  if (H_TOTAL > m.maxZ) violations.push(`height ${rr(H_TOTAL, 1)} exceeds the machine's ${m.maxZ}`);

  /* ---------------- per sector ---------------- */
  const rungOf = (s) => V.ladder[s % V.ladder.length];
  const gapOf  = (s) => variant === 'prag' ? rungOf(s) : FIXED_GAP;
  const endOf  = (s) => variant === 'kuka' ? rungOf(s) : 'zatvoren';
  /* the reach available to terrace layer j — phase locked, so a leg lies on the leg below along its whole
     length and only the new advance is ever in open air. This is what makes a corbel a corbel. */
  const reachAt = (j) => Math.min(REACH, (j + 1) * ADV);

  const ringPts = (rad, from = 0) => { const n = Math.max(64, Math.ceil(TAU * Math.abs(rad) / SEG)), out = [];
    for (let i = 0; i <= n; i++) { const t = from + TAU * i / n; out.push([rad * Math.cos(t), rad * Math.sin(t)]); } return out; };
  const arc = (rad, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * Math.abs(rad) / SEG)), out = [];
    for (let i = 1; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push([rad * Math.cos(t), rad * Math.sin(t)]); } return out; };
  const radial = (th, r0, r1) => { const n = Math.max(2, Math.ceil(Math.abs(r1 - r0) / SEG)), out = [];
    for (let i = 1; i <= n; i++) { const r = r0 + (r1 - r0) * i / n; out.push([r * Math.cos(th), r * Math.sin(th)]); } return out; };

  /* ---------------- one terrace layer ---------------- */
  /* One line for the whole layer: the base ring first, so every later move starts from supported material,
     then sector by sector. Inside a sector the tooth pitch is chosen so that the gap at the TIP radius is
     the sector's rung; the tooth itself is always the same width at the tip. */
  const BASE_ARC_MM = 3.0;   // the SUPPORTED arc on the base ring between two teeth — constant everywhere

  function terraceLayer(j) {
    const Rb = R_OUT + 0.55;
    const rch = reachAt(j);
    const pts = ringPts(Rb).slice();
    const info = [];
    let teeth = 0;
    for (let s = 0; s < NSEC; s++) {
      const gap = gapOf(s), end = endOf(s);
      const th0 = s * SEC, th1 = (s + 1) * SEC;
      const rTip = Rb + rch;
      /* pitch in RADIANS chosen from the FULL reach, not the current one, so the tooth angles never move
         while the terrace ramps out. KRAK lost whole teeth to exactly this: a pitch taken from a jittered
         radius flipped the cell count and every tooth swung. */
      const rTipFull = Rb + REACH;
      const pitchRad = (gap + BASE_ARC_MM) / rTipFull;
      const nT = Math.floor((th1 - th0) / pitchRad);
      if (nT < 2) { warnings.push(`sector ${s}: gap ${gap} mm leaves only ${nT} teeth; rung not represented`); continue; }
      const used = nT * pitchRad;
      const a0 = th0 + ((th1 - th0) - used) / 2;                // centre the rung inside its sector
      /* THE VARIABLE. The rim arc runs at the TIP radius, where the layer below has not reached, so its
         whole length is in open air. That is the free span, and on PRAG it is the ladder. On the base ring
         between two teeth the thread lies on the ring it has just laid, so that arc is supported. */
      const toothRad = gap / rTipFull;

      const here = pts[pts.length - 1];
      pts.push(...arc(Rb, Math.atan2(here[1], here[0]), a0));
      if (rch < 0.9) { info.push({ sector: s, rung: rungOf(s), teeth: 0, note: 'ramp has not left the wall yet' }); continue; }

      const rInner = end === 'koren' ? R : Rb;                  // koren returns all the way to the wall ring
      const laps = end === 'dupli' ? 2 : 1;

      for (let i = 0; i < nT; i++) {
        const tA = a0 + i * pitchRad, tW = tA + toothRad, tNext = a0 + (i + 1) * pitchRad;
        for (let lap = 0; lap < laps; lap++) {
          pts.push(...radial(tA, hyp(pts[pts.length - 1][0], pts[pts.length - 1][1]), rTip));
          if (end === 'kuka') {
            /* one unsupported apex per tooth: the leg overshoots the tip arc and turns back on itself */
            pts.push(...radial(tA, rTip, rTip + KUKA_OVERSHOOT));
            pts.push(...arc(rTip + KUKA_OVERSHOOT, tA, tA + toothRad * 0.5));
            pts.push(...radial(tA + toothRad * 0.5, rTip + KUKA_OVERSHOOT, rTip));
          }
          pts.push(...arc(rTip, end === 'kuka' ? tA + toothRad * 0.5 : tA, tW));
          pts.push(...radial(tW, rTip, rInner));
          if (lap + 1 < laps) pts.push(...arc(rInner, tW, tA));
        }
        if (rInner !== Rb) pts.push(...radial(tW, rInner, Rb));
        pts.push(...arc(Rb, tW, tNext));
        teeth++;
      }

      let rib = null;
      if (end === 'rebro' && j > 0 && reachAt(j - 1) > 0.9) {
        /* the rib runs back across the sector at the radius the layer BELOW reached, so it lands on that
           layer's tips: supported every tooth pitch, never bridging more than one pitch, and on the way it
           ties every leg of the layer just laid into one ring beam. */
        const rPrev = Rb + reachAt(j - 1);
        const aLast = a0 + (nT - 1) * pitchRad + toothRad;
        const cur = pts[pts.length - 1];
        pts.push(...resample([cur, [rPrev * Math.cos(aLast), rPrev * Math.sin(aLast)]], SEG).slice(1));
        pts.push(...arc(rPrev, aLast, a0));
        pts.push(...resample([[rPrev * Math.cos(a0), rPrev * Math.sin(a0)], [Rb * Math.cos(a0), Rb * Math.sin(a0)]], SEG).slice(1));
        const back = pts[pts.length - 1];
        pts.push(...arc(Rb, Math.atan2(back[1], back[0]), a0 + nT * pitchRad));
        rib = { radius_mm: rr(rPrev - Rb, 2), spanPerPitch_mm: rr(pitchRad * rPrev, 2) };
      }

      info.push({ sector: s, rung: rungOf(s), endCondition: end, teeth: nT,
        freeRimSpan_mm: rr(gap, 2), supportedBaseArc_mm: BASE_ARC_MM,
        longestFreeExcursion_mm: rr(gap + 2 * ADV + (end === 'kuka' ? 2 * KUKA_OVERSHOOT : 0), 2),
        pairedWithSector: (s + 5) % NSEC, rib });
    }
    const back = pts[pts.length - 1];
    pts.push(...arc(Rb, Math.atan2(back[1], back[0]), TAU));
    return { pts: pts.map(([x, y]) => [rr(x, 3), rr(y, 3)]), info, teeth };
  }

  /* ---------------- layers ---------------- */
  const WALL_WEB = ['staple', 'diagonal', 'sine', 'eight'];
  const kFor = (Pn, web) => { let K = K_MAX; while (K > 12 && Pn / K < 3.0) K = Math.floor(K / 2); if ((web === 'sine' || web === 'eight' || web === 'diagonal') && Pn / (2 * K) >= 2.3) K *= 2; return K; };
  const NPHI = clamp(8 * Math.round(TAU * R / 0.8 / 8), 240, 720);
  const circle = [];
  for (let i = 0; i < NPHI; i++) { const t = TAU * i / NPHI; circle.push([rr(R * Math.cos(t), 3), rr(R * Math.sin(t), 3)]); }
  const P_RING = TAU * R;

  const layers = [];
  let terraceInfo = null;
  for (let k = 0; k < L.length; k++) {
    const spec = L[k], z = k * LH;
    const web = WALL_WEB[(spec.band * 2 + Math.floor(k / 40)) % WALL_WEB.length];
    const w = k < 30 ? W_FOOT + (W_WALL - W_FOOT) * (k / 30) : W_WALL;
    const K = kFor(P_RING, web);
    let nodesU = []; for (let j = 0; j < K; j++) nodesU.push(P_RING * j / K);
    nodesU = densifyNodes(nodesU, P_RING, true, GAP_MAX);
    const phase = spec.zone === 'terrace' ? 'terrace' : `wall-${spec.band + 1}`;
    const rec = record(circle, true, nodesU, w, E_WALL, spec.zone === 'terrace' ? 'staple' : web, P_RING / 4, 0,
      spec.zone === 'terrace' ? 'terrace-ring' : `wall${spec.band + 1}-ring`, spec.band);
    const lay = { k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: rr(w, 3), tab: rr(E_WALL, 3),
      web: spec.zone === 'terrace' ? 'staple' : web, phase, contours: [rec] };

    if (spec.zone === 'wall' && L[k + 1] && L[k + 1].zone === 'terrace') {
      lay.paths = [{ pts: ringPts(R_OUT).map(([x, y]) => [rr(x, 3), rr(y, 3)]), role: 'bridge', closed: false,
        speed: o.bridgeSpeed || 14, label: 'terrace-seat', tile: 'terrace',
        intent: `${PROCESS}: seat ring on the wall rail, so the first terrace layer has a continuous landing` }];
    }
    if (spec.zone === 'terrace') {
      if (spec.j === 0) {
        terraceInfo = { id: 'T', title: V.title, zFrom: rr(z, 3), zTo: rr(z + TERRACE_LAYERS * LH, 3),
          layers: TERRACE_LAYERS, kFrom: k, advance_mm: ADV, reach_mm: REACH, sectors: [] };
        for (let s = 0; s < NSEC; s++) terraceInfo.sectors.push({ sector: s, deg: `${s * 36}-${(s + 1) * 36}`,
          [V.ladderName]: rungOf(s), tipGap_mm: gapOf(s), endCondition: endOf(s), pairedWithSector: (s + 5) % NSEC });
      }
      const t = terraceLayer(spec.j);
      lay.paths = [{ pts: t.pts, role: 'bridge', closed: false, speed: o.bridgeSpeed || 14,
        label: `terrace-j${spec.j}`, tile: 'terrace',
        intent: `${PROCESS}: terrace layer ${spec.j}, reach ${rr(reachAt(spec.j), 2)} mm, base ring + ${t.info.length} sectors, ${t.teeth} teeth` }];
      if (spec.j === 0) terraceInfo.teethFirstLayer = t.teeth;
      if (spec.j === TERRACE_LAYERS - 1) terraceInfo.sectorDetail = t.info;
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
  for (let s = 0; s < nSp; s++) { const t = TAU * s / nSp;
    foundation.push([[rr((R - W_FOOT / 2 - 2.6) * Math.cos(t), 2), rr((R - W_FOOT / 2 - 2.6) * Math.sin(t), 2)],
                     [rr((R + W_FOOT / 2 + BRIM + 0.6) * Math.cos(t), 2), rr((R + W_FOOT / 2 + BRIM + 0.6) * Math.sin(t), 2)]]); }

  /* ---------------- checks and summary ---------------- */
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const eat = (p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; };
  for (const lay of layers) { for (const c of lay.contours) for (const p of c.pts) eat(p); for (const pth of (lay.paths || [])) for (const p of pth.pts) eat(p); }
  for (const pth of foundation) for (const p of pth) eat(p);
  const size = [rr(x1 - x0, 1), rr(y1 - y0, 1), rr(H_TOTAL, 2)];
  if (m.beadSource !== 'measured' && !o.allowAssumedBead) violations.push(`machine ${m.id}: bead ${BEAD} is ${m.beadSource}; pass --allow-assumed-bead`);
  let maxSeg = 0;
  for (const lay of layers) for (const pth of (lay.paths || [])) for (let i = 1; i < pth.pts.length; i++)
    maxSeg = Math.max(maxSeg, hyp(pth.pts[i][0] - pth.pts[i - 1][0], pth.pts[i][1] - pth.pts[i - 1][1]));
  if (maxSeg > Math.max(0.55, BEAD * 1.25)) violations.push(`typed path sampled every ${rr(maxSeg, 2)} mm; must be <= ${rr(Math.max(0.55, BEAD * 1.25), 2)}`);
  const ringThread = layers.reduce((a, l) => a + l.contours.reduce((b, c) => b + c.total, 0), 0);
  let pathThread = 0;
  for (const lay of layers) for (const pth of (lay.paths || [])) for (let i = 1; i < pth.pts.length; i++)
    pathThread += hyp(pth.pts[i][0] - pth.pts[i - 1][0], pth.pts[i][1] - pth.pts[i - 1][1]);
  const threadEst = (ringThread * 1.94 + pathThread) / 1000;

  /* the declared ceiling is now the rung itself: the largest span the object deliberately contains */
  /* The declared ceiling is not a number chosen to make the build pass. It is the longest free excursion the
     object DELIBERATELY contains, computed from its own ladder: the rim span, plus the one corbel advance at
     each leg that is always in open air, plus the hairpin on the kuka sectors. Anything the gate finds above
     it is a real defect and not the experiment. KRAK declared 60 mm and therefore found nothing. */
  const DECL_BRIDGE = (variant === 'prag' ? Math.max(...GAP_LADDER) : FIXED_GAP)
    + 2 * ADV + (variant === 'kuka' ? 2 * KUKA_OVERSHOOT : 0) + 1;
  const DECL_CANT = Math.min(3, variant === 'kuka' ? KUKA_OVERSHOOT : ADV + 0.5);   // the gate accepts 0.2..3; the real exposure is one corbel advance, or one hairpin overshoot

  const summary = {
    name: o.name || `${variant.toUpperCase()}_${m.id.toUpperCase()}_X1`,
    generator: 'core/weft_prag_geometry.mjs', variant, process: PROCESS,
    generatedAt: new Date().toISOString().slice(0, 10), machine: m.id, machineLabel: m.label,
    machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    purpose: V.question,
    principle: `${PROCESS}: one drum, one terrace, and the terrace is the LAST thing printed so that a tangle cannot destroy the evidence below it. Ten 36 degree sectors; sector s carries rung s mod 5, so s and s+5 are the same rung 180 degrees apart and a difference between twins belongs to the machine, not to the design. Everything except ${V.ladderName} is held identical across all ten sectors.`,
    ladder: { name: V.ladderName, rungs: V.ladder },
    freeSpan: {
      supportedBaseArc_mm: 3.0,
      rimSpans_mm: variant === 'prag' ? GAP_LADDER : [FIXED_GAP],
      evidencedCeiling_mm: EVIDENCED_BRIDGE_MM,
      crossesEvidencedCeiling: variant === 'prag',
      note: variant === 'prag'
        ? `the ladder deliberately straddles the evidenced ${EVIDENCED_BRIDGE_MM} mm limit: 3, 6 and 9 mm sit well under it, 13 mm sits just under, 18 mm sits over. That is the question the object asks.`
        : `every sector holds the rim span at ${FIXED_GAP} mm, well under the evidenced ${EVIDENCED_BRIDGE_MM} mm limit, so a sector that fails fails because of how its tooth ENDS, not because of how far it reaches.`,
    },
    size_mm: size, height_mm: size[2], wallRadius_mm: R, totalLayers: layers.length, layerHeight_mm: LH, bead_mm: BEAD,
    drumHeight_mm: rr(N_WALL * LH, 2), terraceLayers: TERRACE_LAYERS, collarLayers: CAP_LAYERS,
    reach_mm: REACH, corbelAdvance_mm: ADV, supportedBaseArc_mm: BASE_ARC_MM,
    kukaOvershoot_mm: variant === 'kuka' ? KUKA_OVERSHOOT : null,
    fixedRimSpan_mm: variant === 'kuka' ? FIXED_GAP : null,
    sectors: NSEC, terrace: terraceInfo,
    correctsFrom: [
      'KRAK 2026-09-24, printed on both machines and destroyed on both: the most dangerous terrace was the lowest, so its tangle took the two corbel terraces above it and four of the six predictions were never tested. Here the terrace is last.',
      'KRAK varied tooth shape, corbel advance and reach at once. Each of these objects varies exactly one quantity.',
      'The support gate passed KRAK at 0 problems while terrace K1 contained 512 continuous free runs longer than 10 mm. The declared ceiling here is the largest span the object deliberately contains, so any finding above it is a real defect.',
    ],
    estimates: { threadLength_m: rr(threadEst, 0), ringThread_m: rr(ringThread / 1000, 1), typedPathThread_m: rr(pathThread / 1000, 1), maxTypedSegment_mm: rr(maxSeg, 3), note: 'thread = 1.94 x ring length (calibrated on four printed objects) + typed path length as emitted' },
    args: { lh: LH, bead: BEAD, firstLayerBead: m.firstLayerBead, firstLayerSpeed: 12, w: W_WALL, e: E_WALL, r0: R, K: K_MAX, foundation: BRIM,
      maxbridge: DECL_BRIDGE, maxcantilever: DECL_CANT, allow: 0.6, minanchor: 0.5, maxCapRadius: 20,
      speed: o.speed || 38, bridgeSpeed: o.bridgeSpeed || 14, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'every finding must fall inside the declared terrace zone; a finding in the drum is a design error', bridge_mm: DECL_BRIDGE, cantilever_mm: DECL_CANT, membrane_min_anchor: 0.5, first_layer_max_islands: 1, secondGate_mm: EVIDENCED_BRIDGE_MM },
    experiments: {
      declaredBridgeCeiling_mm: DECL_BRIDGE, gateCantilever_mm: DECL_CANT, evidencedBridge_mm: EVIDENCED_BRIDGE_MM,
      zones: terraceInfo ? [{ name: 'terrace', z0: rr(terraceInfo.zFrom - 0.01, 3), z1: rr(terraceInfo.zTo + 0.01, 3), longestChord_mm: DECL_BRIDGE - 1 }] : [],
      protocol: 'the drum must be clean at every ceiling; inside the terrace the count per sector is itself the result, and the two copies of a rung must match or the difference belongs to the fan',
    },
    foundation: { paths: foundation.length, islandsExpected: 1, kind: 'rings + spokes under the single cylinder' },
    reading: 'Photograph from directly above so all ten sectors are in one frame, then from a fixed side with a scale. For each sector: does the comb read as a comb, is the outer edge level or drooping or tangled, and does it match its copy 180 degrees away. A rung that disagrees with its twin is a machine effect and must be written down as one.',
    stopRule: 'If the terrace tangles, stop the print. The drum below it is already a finished object and every sector that held is still readable. Nothing is lost by stopping; the whole experiment is lost by letting a tangle run.',
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'rings+spokes', paths: foundation }, layers };

  function svg() {
    const Wv = 1040, Hv = 760, els = [];
    const sc = 300 / (2 * outerExtent), ox = 360, oy = 360;
    const last = layers.filter(l => l.phase === 'terrace').pop();
    els.push(`<circle cx="${ox}" cy="${oy}" r="${R * sc}" fill="none" stroke="#2f4666" stroke-width="1.2"/>`);
    if (last) for (const p of last.paths)
      els.push(`<polyline points="${p.pts.map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - q[1] * sc).toFixed(1)}`).join(' ')}" fill="none" stroke="#ff4d6d" stroke-width="0.6"/>`);
    for (let s = 0; s < NSEC; s++) {
      const t = (s + 0.5) * SEC, r = outerExtent * sc + 16;
      els.push(`<text x="${(ox + r * Math.cos(t)).toFixed(1)}" y="${(oy - r * Math.sin(t)).toFixed(1)}" font-family="Arial" font-size="10" fill="#cfe3e6" text-anchor="middle">${rungOf(s)}</text>`);
      const a = s * SEC;
      els.push(`<line x1="${ox}" y1="${oy}" x2="${(ox + (outerExtent * sc) * Math.cos(a)).toFixed(1)}" y2="${(oy - (outerExtent * sc) * Math.sin(a)).toFixed(1)}" stroke="#20323a" stroke-width="0.5"/>`);
    }
    els.push(`<text x="20" y="28" font-family="Arial" font-size="14" fill="#cfe3e6">${(o.name || variant.toUpperCase())} — ${V.title}</text>`);
    els.push(`<text x="20" y="48" font-family="Arial" font-size="11" fill="#7f9aa3">${V.ladderName}: ${V.ladder.join(' · ')} — sector s pairs with s+5</text>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Wv}" height="${Hv}" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#0d1b1e"/>${els.join('')}</svg>`;
  }
  return { payload, svg, violations, warnings };
}

/* ---------------- CLI ---------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const A = process.argv.slice(2), opt = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 ? A[i + 1] : d; }, flag = (n) => A.includes('--' + n);
  const o = { variant: opt('variant', 'prag'), machine: opt('machine', 'ender'), out: opt('out'), svg: opt('svg'),
              radius: opt('radius'), wallMm: opt('wall-mm'), reach: opt('reach'), adv: opt('adv'), seg: opt('seg'),
              name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') || flag('i-know-the-bead-is-a-guess') };
  const { payload, svg, violations, warnings } = generatePrag(o);
  for (const w of warnings) console.error('WARN  ' + w);
  if (violations.length) { for (const v of violations) console.error('REFUSE ' + v); process.exit(2); }
  if (o.out) { fs.writeFileSync(o.out, JSON.stringify(payload)); console.error(`GEOM  ${o.out}  ${payload.layers.length} layers, ${payload.summary.size_mm.join(' x ')} mm, ~${payload.summary.estimates.threadLength_m} m thread`); }
  if (o.svg) { fs.writeFileSync(o.svg, svg()); console.error(`SVG   ${o.svg}`); }
  if (!o.out && !o.svg) console.log(JSON.stringify(payload.summary, null, 2));
}
