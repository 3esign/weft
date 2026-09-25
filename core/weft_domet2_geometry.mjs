/* WEFT — DOMET2: a test sculpture that is also seven instruments (2026-09-24).

   DOMET (the same day) asks one question — how far a returning hairpin reaches. DOMET2 asks everything else
   that three minds left open in three days, and puts each question in its own terrace on one tower, so the
   walls between them are identical and a terrace can only differ from another by the thing being tested.

   WHERE THE QUESTIONS COME FROM

     T1 chord march     Gemini's family, 18-19 Sept (weft/exports/zigurat3_test): "layer k+1 is an octagon
                        bridging the corners of layer k; layer k+2 is a square resting on the midpoints of
                        those bridges". Generalised to a circle: M anchors, chords between them bulged out so
                        their midpoints become the next anchors. There is NO free tip anywhere — every run is
                        a bridge between two supported ends. The ladder is the chord span, 6..30 mm, which
                        brackets the only number this project actually trusts: 16.2 mm.
     T2 speed           The A2L nested where the Ender stayed flat. Reach, layer height AND speed all differed,
                        so nothing was isolated. Here reach is fixed at 20 mm and only the feedrate changes,
                        6..34 mm/s, eight sectors, one layer height, one machine.
     T3 crossing angle  Semir found coincident stacked layers twice in a week. Measured on the 19 Sept
                        terraces: median crossing 16 deg, 44 % below 10 deg. Does a node have to be a node?
                        Eight sectors from 0 deg (deliberately identical layers — the defect, reproduced on
                        purpose as the control) to 90 deg.
     T4 counterweight   Semir's own hypothesis, 19 Sept, in his words: "da chords prepustamo vise sa obe
                        strane da sa jedne bude oslonac a sa spoljne kontra teg". Never tested. Inward reach
                        fixed at 16 mm in all eight sectors; the outward arm runs 0..26 mm. If the counterweight
                        is real, the inward side sags less where the outward arm is longer.
     T5 thickness       Every terrace built so far is twelve layers because the first one was. Sectors weave
                        for 2, 3, 4, 6, 8, 10, 14, 18 layers and then stop.
     T6 pitch           How dense must the comb be? Tooth pitch 2..10 mm at a fixed 20 mm reach.
     T7 closing         Hairpins inward until a ~40 mm hole is left, then the crown closes it.

   The crown is a hierarchical woven grid over that hole and then a seven-lobed rose drawn as one continuous
   line — the artistic pattern Semir asks for on top of every closed pyramid.

   WHAT IS SHARED WITH DOMET, AND WHY
   Every terrace layer starts with a closed RING on the base radius, and the wall layer below a terrace lays
   that ring too (the "seat"). Without it the first wave of a terrace has to hit a wall rail whose emitted
   radius depends on the wall's grammar, and the gate scored those misses as runs of 70-540 mm.

   usage: node core/weft_domet2_geometry.mjs --machine ender|a2l --out FILE [--svg FILE] [--radius MM]
          [--wall-mm MM] [--name NAME] [--allow-assumed-bead] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, densifyNodes, resample, clamp, rr, loadMachine, EVIDENCED_BRIDGE_MM } from './weft_cube_geometry.mjs';

const TAU = 2 * Math.PI, hyp = Math.hypot;
export const PROCESS = 'terrace-question-tower/v1';
const NSEC = 8, SEC = TAU / NSEC;

/* every ladder ascends, so a break reads as the angle at which the pattern stops working */
export const TERRACES = [
  { id: 'T1', kind: 'march',  title: 'chord march, outward — Gemini\'s corner bridging, no free tip anywhere',
    ladder: [6, 9, 12, 15, 18, 21, 25, 30], unit: 'chord span mm', layers: 14, reach: 22, advance: 1.6 },
  { id: 'T2', kind: 'speed',  title: 'speed ladder — reach and everything else fixed, only the feedrate changes',
    ladder: [6, 8, 10, 12, 15, 20, 26, 34], unit: 'mm/s', layers: 12, reach: 20, rib: 5 },
  { id: 'T3', kind: 'angle',  title: 'crossing-angle ladder — sector 0 deliberately stacks identical layers',
    ladder: [0, 10, 20, 30, 45, 60, 75, 90], unit: 'deg between consecutive layers', layers: 12, reach: 20, rib: 5 },
  { id: 'T4', kind: 'counter', title: 'counterweight ladder — inward 16 mm everywhere, outward arm 0..26 mm',
    ladder: [0, 3, 6, 9, 12, 16, 20, 26], unit: 'outward arm mm', layers: 12, reach: 20, rib: 5 },
  { id: 'T5', kind: 'thick',  title: 'thickness ladder — how many woven layers a terrace actually needs',
    ladder: [2, 3, 4, 6, 8, 10, 14, 18], unit: 'layers', layers: 18, reach: 20, rib: 5 },
  { id: 'T6', kind: 'pitch',  title: 'pitch ladder — how dense the comb must be',
    ladder: [2, 2.5, 3, 4, 5, 6, 8, 10], unit: 'tooth pitch mm', layers: 12, reach: 20, rib: 5 },
  { id: 'T7', kind: 'close',  title: 'closing terrace — hairpins inward, ribbed, leaving the crown its hole',
    ladder: null, unit: null, layers: 12, reach: null, rib: 5, dir: -1 },
];
const WALL_WEB = ['staple', 'diagonal', 'sine', 'eight', 'staple', 'diagonal', 'sine', 'eight'];

export function generateDomet2(o) {
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh;
  const MARGIN = o.margin != null ? +o.margin : 15;
  const R = o.radius != null ? +o.radius : 42;
  const W_WALL = 3.0, W_FOOT = 3.4, E_WALL = 0.7, K_MAX = 192, GAP_MAX = 9.5, BRIM = 6.0;
  const WALL_MM = o.wallMm != null ? +o.wallMm : 5.0;
  const N_WALL = Math.max(12, Math.round(WALL_MM / LH));
  const P_CELL = 4.0, TIP_GAP = 1.2, TIP_MIN = 2.2, SEG = 0.45;
  const SPEED_WALL = 34, SPEED_TERR = 14;
  const violations = [], warnings = [], events = [];

  const R_OUT = R + W_WALL / 2 + E_WALL, R_IN = R - W_WALL / 2 - E_WALL;
  const maxOut = Math.max(22, ...TERRACES.filter(t => t.kind !== 'close' && t.kind !== 'counter').map(t => t.reach || 0),
                          ...(TERRACES.find(t => t.kind === 'counter')?.ladder || [0]));
  const HOLE = 40;                                            // what T7 leaves for the crown
  const R_SEAT = HOLE / 2 + 2.5;                              // a continuous ring on T7's last layers: the crown grid lands on IT, not on the scalloped tips of a triangle wave, where every other line end fell into a gap
  const outerExtent = R_OUT + maxOut + BEAD / 2;
  if (2 * (outerExtent + BRIM + 2) > Math.min(m.plate[0], m.plate[1]) - 2 * MARGIN)
    violations.push(`outer extent ${rr(2 * outerExtent, 1)} mm does not fit ${m.plate.join(' x ')} with a ${MARGIN} mm margin`);

  const sectorOf = (th) => Math.floor((((th % TAU) + TAU) % TAU) / SEC);
  const lad = (T, th) => T.ladder ? T.ladder[sectorOf(th)] : null;

  /* ---------------- the profile ---------------- */
  const L = [];
  let band = 0;
  for (const T of TERRACES) {
    for (let j = 0; j < N_WALL; j++) L.push({ zone: 'wall', band, f: j / N_WALL });
    for (let j = 0; j < T.layers; j++) L.push({ zone: 'terrace', band, terrace: T, j });
    band++;
  }
  const ROOF = [2, 2, 4, 4, 8, 8, 16, 16];                     // hierarchical grid over the hole
  const ROSE = 6;                                             // the drawing on top
  for (let j = 0; j < ROOF.length; j++) L.push({ zone: 'crown', band, j, grid: ROOF[j] });
  for (let j = 0; j < ROSE; j++) L.push({ zone: 'rose', band, j });
  const H_TOTAL = L.length * LH;
  if (H_TOTAL > m.maxZ) violations.push(`height ${rr(H_TOTAL, 1)} exceeds the machine's ${m.maxZ}`);

  /* ---------------- shared primitives ---------------- */
  const ringPts = (rad, from = 0) => { const n = Math.max(64, Math.ceil(TAU * Math.abs(rad) / SEG)), out = [];
    for (let i = 0; i <= n; i++) { const t = from + TAU * i / n; out.push([rad * Math.cos(t), rad * Math.sin(t)]); } return out; };
  const arcPts = (rad, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * Math.abs(rad) / SEG)), out = [];
    for (let i = 1; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push([rad * Math.cos(t), rad * Math.sin(t)]); } return out; };
  const radPts = (th, r0, r1) => { const n = Math.max(2, Math.ceil(Math.abs(r1 - r0) / SEG)), out = [];
    for (let i = 1; i <= n; i++) { const r = r0 + (r1 - r0) * i / n; out.push([r * Math.cos(th), r * Math.sin(th)]); } return out; };
  const P3 = (a) => resample(a, SEG).map(([x, y]) => [rr(x, 3), rr(y, 3)]);   // one place guarantees the typed-path sampling the builder demands

  /* one sector of a triangle wave: base on the ring, tip at reach, optional tilt (the crossing-angle test),
     optional inward arm (the counterweight test). Starts and ends ON the ring, so sectors can be separate
     paths with their own speed and the builder's joins stay on supported material. */
  function waveSector(Rb, a0, a1, pitch, outReach, inReach, tilt, phase) {
    const cells = Math.max(2, Math.round(Math.abs(a1 - a0) * Math.abs(Rb) / pitch));
    const d = (a1 - a0) / cells;
    const raw = [[Rb * Math.cos(a0), Rb * Math.sin(a0)]];
    for (let i = 0; i < cells; i++) {
      const b0 = a0 + (i + phase) * d, mid = b0 + d / 2;
      const rO = Rb + outReach, tiltA = tilt * Math.PI / 180;
      const th = mid + tiltA * d / 2 / (Math.PI / 180) * 0;      // tilt applied below, in absolute angle
      const tipHalf = Math.min(d * 0.28, TIP_GAP / 2 / Math.max(Math.abs(rO), 1));
      const tw = mid + (tilt * d * 0.5);                          // tilt moves the tip by a fraction of a cell
      raw.push([rO * Math.cos(tw - tipHalf), rO * Math.sin(tw - tipHalf)]);
      raw.push([rO * Math.cos(tw + tipHalf), rO * Math.sin(tw + tipHalf)]);
      if (inReach > 0) {                                           // dip through the ring to the inner tip
        const rI = Rb - inReach, iw = b0 + d, ih = Math.min(d * 0.28, TIP_GAP / 2 / Math.max(Math.abs(rI), 1));
        raw.push([Rb * Math.cos(iw - d * 0.25), Rb * Math.sin(iw - d * 0.25)]);
        raw.push([rI * Math.cos(iw - ih), rI * Math.sin(iw - ih)]);
        raw.push([rI * Math.cos(iw + ih), rI * Math.sin(iw + ih)]);
      }
      raw.push([Rb * Math.cos(b0 + d), Rb * Math.sin(b0 + d)]);
    }
    return { pts: P3(resample(raw, SEG)), cells };
  }

  /* ribs for one sector: a boustrophedon of concentric arcs joined by radial jogs, all on the teeth below */
  function ribSector(Rb, a0, a1, q, reach, off, dir = 1) {
    if (!q) return null;
    const pts = [[Rb * Math.cos(a0), Rb * Math.sin(a0)]];
    let cur = Rb, fwd = true, n = 0;
    for (let k = 1; ; k++) {
      const dd = (k - 0.5 + off * 0.5) * q; if (dd > reach - 0.9) break;
      const rad = Rb + dir * dd;
      pts.push(...radPts(fwd ? a0 : a1, cur, rad));
      pts.push(...arcPts(rad, fwd ? a0 : a1, fwd ? a1 : a0));
      cur = rad; fwd = !fwd; n++;
    }
    pts.push(...radPts(fwd ? a0 : a1, cur, Rb));
    return n ? { pts: P3(pts), rails: n } : null;
  }

  /* T1: anchors on a circle; the next layer lays chords between them bulged outward so their midpoints
     become the next anchors. Every run is a bridge between two supported ends — no free tip at all. */
  function marchSector(Rb, a0, a1, span, step, adv) {
    /* M is fixed for the whole sector, and the anchors shift by HALF a cell every layer, so this layer's
       anchors land exactly on the previous layer's bulged midpoints. Without the half-cell alternation the
       anchors sit between them and the entire sector is unsupported (measured: supFrac 0, runs to 61 mm). */
    const M = Math.max(2, Math.round(2 * Math.PI * Rb / span / NSEC));
    const rA = Rb + step * adv, rB = Rb + (step + 1) * adv;
    const d = (a1 - a0) / M, off = (step % 2) * 0.5;
    const raw = [[Rb * Math.cos(a0 + off * d), Rb * Math.sin(a0 + off * d)]];
    raw.push(...radPts(a0 + off * d, Rb, rA));                   // a free end in mid-air is a CANTILEVER; start on the ring
    for (let i = 0; i < M; i++) {
      const s = a0 + (i + off) * d, e = s + d, mid = s + d / 2;
      raw.push([rB * Math.cos(mid), rB * Math.sin(mid)]);       // the bulged midpoint, the next layer's anchor
      raw.push([rA * Math.cos(e), rA * Math.sin(e)]);
    }
    raw.push(...radPts(a0 + (M + off) * d, rA, Rb));            // and come back down to it
    const chord = 2 * rA * Math.sin(d / 2);
    return { pts: P3(resample(raw, SEG)), chords: M, chord_mm: rr(chord, 2) };
  }

  /* ---------------- layers ---------------- */
  const kFor = (P, web) => { let K = K_MAX; while (K > 12 && P / K < 3.0) K = Math.floor(K / 2); if ((web === 'sine' || web === 'eight' || web === 'diagonal') && P / (2 * K) >= 2.3) K *= 2; return K; };
  const NPHI = clamp(8 * Math.round(TAU * R / 0.8 / 8), 240, 720);
  const circle = P3(Array.from({ length: NPHI }, (_, i) => { const t = TAU * i / NPHI; return [R * Math.cos(t), R * Math.sin(t)]; }));
  const P_RING = TAU * R;
  const layers = [], info = [];
  let curT = null;

  for (let k = 0; k < L.length; k++) {
    const spec = L[k], z = k * LH;
    const wallWeb = WALL_WEB[spec.band % WALL_WEB.length];
    const w = k < 30 ? W_FOOT + (W_WALL - W_FOOT) * (k / 30) : W_WALL;
    const web = spec.zone === 'wall' ? wallWeb : 'staple';
    const K = kFor(P_RING, web);
    let nodesU = []; for (let j = 0; j < K; j++) nodesU.push(P_RING * j / K);
    nodesU = densifyNodes(nodesU, P_RING, true, GAP_MAX);
    const phase = spec.zone === 'terrace' ? `terrace-${spec.terrace.id}` : spec.zone === 'wall' ? `wall-${spec.band + 1}` : spec.zone === 'crown' ? 'crown-grid' : 'crown-rose';
    const rec = record(circle, true, nodesU, w, E_WALL, web, P_RING / 4, 0, `${phase}-ring`, spec.band);
    const lay = { k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: rr(w, 3), tab: rr(E_WALL, 3), web, phase, contours: [rec] };
    const paths = [];

    if (spec.zone === 'wall' && L[k + 1] && L[k + 1].zone === 'terrace') {
      const T2 = L[k + 1].terrace, Rb2 = (T2.dir || 1) > 0 ? R_OUT : R_IN;
      paths.push({ pts: P3(ringPts(Rb2)), role: 'bridge', closed: false, speed: SPEED_TERR,
        label: `${T2.id}-seat`, tile: T2.id, intent: `${PROCESS}: seat ring for ${T2.id}, on the wall rail, so the terrace's first wave lands on a continuous line` });
    }

    if (spec.zone === 'terrace') {
      const T = spec.terrace, dir = T.dir || 1, Rb = (dir > 0 ? R_OUT : R_IN) + dir * (0.55 + (spec.j === 0 ? 0 : (spec.j % 4 < 2 ? 0.2 : -0.2)));
      if (spec.j === 0) { curT = { id: T.id, kind: T.kind, title: T.title, unit: T.unit, ladder: T.ladder, zFrom: rr(z, 3), zTo: rr(z + T.layers * LH, 3), layers: T.layers, dir: dir > 0 ? 'outward' : 'inward', sectors: [] }; info.push(curT); }
      paths.push({ pts: P3(ringPts(Rb)), role: 'bridge', closed: false, speed: SPEED_TERR, label: `${T.id}-ring-${spec.j}`, tile: T.id,
        intent: `${PROCESS}: ${T.id} base ring, layer ${spec.j + 1} of ${T.layers}` });
      if (T.kind === 'close' && spec.j >= T.layers - 3)
        paths.push({ pts: P3(ringPts(R_SEAT + (spec.j % 2 ? 0.2 : -0.2))), role: 'bridge', closed: false, speed: SPEED_TERR, label: `crown-seat-${spec.j}`, tile: T.id,
          intent: `${PROCESS}: crown seat ring at ${R_SEAT} mm, laid on T7's weave so the crown grid has a continuous landing` });
      for (let s = 0; s < NSEC; s++) {
        const a0 = s * SEC, a1 = (s + 1) * SEC, v = lad(T, a0 + SEC / 2);
        let sp = SPEED_TERR, pitch = P_CELL, outR = T.reach || 20, inR = 0, tilt = 0, q = T.rib || 0, lim = T.layers;
        if (T.kind === 'speed') sp = v;
        if (T.kind === 'pitch') pitch = v;
        if (T.kind === 'angle') tilt = (spec.j % 2 ? -1 : 1) * (v / 90) * 0.5;      // +-half a cell at 90 deg
        if (T.kind === 'counter') { inR = 16; outR = v; }   // 16 mm keeps the converging inner tips above the 2.2 mm minimum spacing at this radius
        if (T.kind === 'thick') lim = v;
        if (T.kind === 'close') { outR = (R_IN - HOLE / 2 - 2); }
        if (spec.j >= lim) continue;
        if (T.kind === 'march') {
          const mm = marchSector(Rb, a0, a1, v, spec.j, T.advance);
          paths.push({ pts: mm.pts, role: 'bridge', closed: false, speed: sp, label: `${T.id}-s${s}-march`, tile: T.id,
            intent: `${PROCESS}: ${T.id} sector ${s}, ${mm.chords} chords of ${mm.chord_mm} mm, advancing ${T.advance} mm per layer; both ends of every chord rest on the layer below` });
          if (spec.j === 0) curT.sectors.push({ sector: s, deg: `${s * 45}-${(s + 1) * 45}`, value: v, unit: T.unit, chords: mm.chords, chord_mm: mm.chord_mm, freeTip_mm: 0 });
        } else {
          const isRib = q && (spec.j % 2 === 1);
          if (isRib) {
            const rb = ribSector(Rb, a0, a1, q, dir > 0 ? outR : outR, (spec.j >> 1) / 6, dir);
            if (rb) paths.push({ pts: rb.pts, role: 'bridge', closed: false, speed: sp, label: `${T.id}-s${s}-ribs`, tile: T.id,
              intent: `${PROCESS}: ${T.id} sector ${s}, ${rb.rails} ribs at ${q} mm, each crossing every tooth below at ~90 deg` });
          } else {
            const wv = waveSector(Rb * (dir > 0 ? 1 : 1), a0, a1, pitch, dir * outR, inR, tilt, (spec.j / 2) / 6);
            paths.push({ pts: wv.pts, role: 'bridge', closed: false, speed: sp, label: `${T.id}-s${s}-wave`, tile: T.id,
              intent: `${PROCESS}: ${T.id} sector ${s}, ${wv.cells} returning cells, reach ${rr(outR, 1)} mm${inR ? `, inward arm ${inR} mm` : ''}${tilt ? `, tilted ${rr(tilt * 100, 0)}% of a cell` : ''}, ${sp} mm/s` });
            if (spec.j === 0) curT.sectors.push({ sector: s, deg: `${s * 45}-${(s + 1) * 45}`, value: v, unit: T.unit, cells: wv.cells, reach_mm: rr(outR, 1), inwardArm_mm: inR || undefined, speed_mm_s: sp, ribPitch_mm: q || 'none', weaveLayers: lim, freeTip_mm: rr(outR, 1) });
          }
        }
      }
    }

    if (spec.zone === 'crown' || spec.zone === 'rose') {
      const rHole = R_SEAT;
      /* the seat ring is re-laid on EVERY crown layer: support comes only from the layer immediately below,
         so a ring left behind on T7 stops holding the grid's line ends after two layers (measured: four
         CANTILEVER findings with a 21 mm gap at the 4x4 level). */
      paths.push({ pts: P3(ringPts(R_SEAT + (spec.j % 2 ? 0.2 : -0.2))), role: 'bridge', closed: false, speed: SPEED_TERR,
        label: `crown-rim-${spec.j}`, tile: 'crown', intent: `${PROCESS}: crown rim ring, the landing for this layer's line ends` });
      if (spec.zone === 'crown') {
        const n = spec.grid, dirXY = spec.j % 2 === 0 ? 0 : 1, pts = [];
        const half = R_SEAT;        // land on the seat ring
        for (let q2 = 1; q2 < n; q2++) {
          const u = -half + 2 * half * q2 / n, ext = Math.sqrt(Math.max(0, half * half - u * u));
          const a = dirXY ? [[-ext, u], [ext, u]] : [[u, -ext], [u, ext]];
          const seg = resample(q2 % 2 ? [a[1], a[0]] : a, SEG);
          if (pts.length) { const last = pts[pts.length - 1], f = seg[0];
            const th0 = Math.atan2(last[1], last[0]), th1 = Math.atan2(f[1], f[0]);
            pts.push(...arcPts(half + 0.4, th0, th1)); }
          pts.push(...seg);
        }
        paths.push({ pts: P3(pts), role: 'bridge', closed: false, speed: SPEED_TERR, label: `crown-${n}x${n}-${dirXY ? 'Y' : 'X'}`, tile: 'crown',
          intent: `${PROCESS}: crown grid ${n}x${n} over a ${HOLE} mm hole, free span ${rr(2 * half / n, 1)} mm` });
      } else {
        const lobes = 7, pts = [], n = 1400;
        for (let i = 0; i <= n; i++) { const t = TAU * i / n, rr2 = (rHole - 1) * (0.55 + 0.45 * Math.abs(Math.cos(lobes * t / 2)));
          pts.push([rr2 * Math.cos(t), rr2 * Math.sin(t)]); }
        paths.push({ pts: P3(resample(pts, SEG)), role: 'bridge', closed: false, speed: SPEED_TERR, label: `rose-${lobes}`, tile: 'crown',
          intent: `${PROCESS}: a seven-lobed rose drawn as one continuous line on the closed crown — the artistic pattern` });
      }
    }

    if (paths.length) lay.paths = paths;
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

  /* ---------------- checks ---------------- */
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

  const summary = {
    name: o.name || `DOMET2_${m.id.toUpperCase()}_X1`, generator: 'core/weft_domet2_geometry.mjs', process: PROCESS,
    generatedAt: new Date().toISOString().slice(0, 10), machine: m.id, machineLabel: m.label,
    machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    purpose: 'A test sculpture that is also seven instruments: one tower, one wall geometry, seven terraces, each a ladder for one question that three minds left open between 17 and 24 September 2026.',
    size_mm: size, height_mm: size[2], wallRadius_mm: R, totalLayers: layers.length, layerHeight_mm: LH, bead_mm: BEAD,
    wallBetweenTerraces_mm: rr(N_WALL * LH, 2), crownHole_mm: HOLE,
    terraces: info,
    crown: { grid: ROOF.join('-'), hole_mm: HOLE, firstFreeSpan_mm: rr(2 * R_SEAT / ROOF[0], 2), rose: '7 lobes, one continuous line' },
    estimates: { threadLength_m: rr((ringThread * 1.94 + pathThread) / 1000, 0), ringThread_m: rr(ringThread / 1000, 1), typedPathThread_m: rr(pathThread / 1000, 1), maxTypedSegment_mm: rr(maxSeg, 3) },
    args: { lh: LH, bead: BEAD, firstLayerBead: m.firstLayerBead, firstLayerSpeed: 12, w: W_WALL, e: E_WALL, r0: R, K: K_MAX, foundation: BRIM,
      maxbridge: 60, maxcantilever: 8, allow: 0.6, minanchor: 0.5, maxCapRadius: 20, speed: SPEED_WALL, bridgeSpeed: SPEED_TERR, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'every finding must fall inside a declared terrace or the crown; a finding in a wall is a design error', bridge_mm: 60, cantilever_mm: 8, membrane_min_anchor: 0.5, first_layer_max_islands: 1, secondGate_mm: EVIDENCED_BRIDGE_MM,
      note: 'allow stays at 0.6 mm. The 19 Sept zigurat3 exports passed only with allow raised to 8 mm, which is not a support test at all; that is recorded, not repeated.' },
    experiments: {
      declaredBridgeCeiling_mm: 60, gateCantilever_mm: 8, evidencedBridge_mm: EVIDENCED_BRIDGE_MM,
      zones: info.map(t => ({ name: `terrace ${t.id}`, z0: rr(t.zFrom - 0.01, 3), z1: rr(t.zTo + 0.01, 3), longestChord_mm: 2 * (t.sectors[0]?.reach_mm || 22) }))
        .concat([{ name: 'crown', z0: rr((L.length - ROOF.length - ROSE) * LH - 0.01, 3), z1: rr(H_TOTAL + 1, 3), longestChord_mm: HOLE }]),
      protocol: 'gate at the declared ceiling must be clean; at the evidenced 16.2 mm ceiling every finding must fall inside a declared terrace or the crown, and the count per terrace is itself a result',
    },
    foundation: { paths: foundation.length, islandsExpected: 1, kind: 'rings + spokes under the single cylinder' },
    events, violations, warnings,
  };
  return { payload: { summary, foundation: { kind: 'rings+spokes', paths: foundation }, layers }, summary, violations, warnings };
}

function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const machine = opt('machine'), out = opt('out');
  if (!machine || !out) { console.error('usage: node core/weft_domet2_geometry.mjs --machine ender|a2l --out FILE [--radius MM] [--wall-mm MM] [--name NAME] [--allow-assumed-bead]'); process.exit(2); }
  const r = generateDomet2({ machine, radius: opt('radius'), wallMm: opt('wall-mm'), margin: opt('margin'), name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') });
  for (const w of r.warnings) console.error('note: ' + w);
  if (r.violations.length) { console.error('REFUSED:'); for (const v of r.violations.slice(0, 10)) console.error('  * ' + v); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  const s = r.summary;
  console.log(JSON.stringify({ name: s.name, size_mm: s.size_mm, layers: s.totalLayers, thread_est_m: s.estimates.threadLength_m, maxSeg: s.estimates.maxTypedSegment_mm,
    terraces: s.terraces.map(t => `${t.id} z${t.zFrom}-${t.zTo} ${t.kind} [${(t.ladder||[]).join('/')}] ${t.unit||''}`) }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
