/* WEFT — PUN: solid bodies as programmed infill (2026-09-30).

   Until now every WEFT object was a hollow woven wall; the material WAS the wall. This generator turns
   the question around: the body is FULL, and the infill is the first-class object. Every layer is a
   cross-section completely owned by a fill program — pattern, density and direction are free per layer,
   so the object becomes a stack of material decisions instead of a skin around air. This is what a
   slicer calls "infill", except here there is no slicer default: the layer program is the design.

   Level-2 generator in JavaScript. Emits the geometry file `weft.mjs build --geo` consumes: summary /
   foundation / layers, with each layer carrying raw typed paths (a closed perimeter + ONE continuous
   fill path), the same records the cube roof uses. No caps, no membranes: everything is either on the
   bed or on the previous layer's material.

   Patterns (each one continuous line per layer, ends welded to the shell where they land):
     lines    — boustrophedon chords at an angle, connected by hops along the boundary (the roof's
                serpentine, generalised to any convex section and any angle);
     sine     — the same serpentine with sinusoidal chords (amplitude tapers to zero at the shell);
     spiral   — an inward archimedean spiral of the section (growth rings that stay one line);
     hilbert  — a Hilbert curve over the inscribed square (kocka only).

   The gate question for a solid body is different from a wall's: a sparse layer over a sparse layer is
   supported ONLY at the crossings, so the free span between crossings is spacing_below / sin(delta).
   The generator computes that span for every layer (freeSpanEst) and REFUSES its own schedule when the
   estimate exceeds 0.9 x maxbridge — same-direction sparse lines on sparse lines is the canonical
   violation (span = infinity). The final referee is still the gate on the final G-code.

   Three bodies, three experiments:
     kocka   — the sampler: solid base, then bands of lines / sine / hilbert / spiral, a density
               crescendo 3.0 -> 5.5 mm near the top, and a solid cap that bridges the sparsest band;
     sundjer — a twisting tri-lobe blob; density is a FIELD: line spacing varies inside each layer
               (pseudo-noise per scan line) and the direction steps by the golden angle 137.508deg,
               so no two layers repeat — the sponge look comes from density, not from holes;
     drvo    — a tree: flared foot, trunk, swelling canopy (flare bounded per layer), closing dome;
               growth rings (spiral) with a lines layer every third layer as shear bonding.

   usage: node core/weft_solid_geometry.mjs --variant kocka|sundjer|drvo --machine a2l|a1|ender
            --out FILE [--svg FILE] [--name NAME] [--scale S] [--allow-assumed-bead]                    */
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

export const PROCESS = 'solid-infill/v1';
export const NPHI = 240;                      // section sampling (polygon vertices per layer)
/* The gate samples the distance transform at PATH VERTICES, and the core LOD-merges collinear points,
   so a straight chord keeps vertices only every ~2 mm — which can all land mid-between the lines below
   (measured 2026-09-30: worst_gap 1.0 mm, LONG_BRIDGE). Sparse fill therefore goes out as typed
   `bridge` paths (vertices preserved) sampled at 0.5 mm, under the 0.55 mm typed-path ceiling. */
export const CHORD_STEP = 0.5;                // chord resampling (mm) — every vertex must be able to land on support
export const HOP_STEP = 0.5;                  // boundary-hop resampling (mm)
const GOLDEN = 137.50776405003785;            // degrees

/* ---------------- section machinery: every body is a radial star r(theta) around a centre ---------------- */
function makeSection(rFn, cx = 0, cy = 0){
  const pts = [], nrmIn = [];
  for(let i = 0; i < NPHI; i++){
    const th = TAU * i / NPHI;
    const r = rFn(th);
    pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  for(let i = 0; i < NPHI; i++){                                   // inward normal from neighbours
    const [x0, y0] = pts[(i - 1 + NPHI) % NPHI], [x1, y1] = pts[(i + 1) % NPHI];
    const tx = x1 - x0, ty = y1 - y0, d = hyp(tx, ty) || 1;
    nrmIn.push([ty / d, -tx / d]);                                 // CCW polygon -> (ty,-tx) points inward? see check below
  }
  // orientation check: the normal must point toward the centre
  const [px, py] = pts[0], [nx, ny] = nrmIn[0];
  if((cx - px) * nx + (cy - py) * ny < 0) for(const n of nrmIn){ n[0] = -n[0]; n[1] = -n[1]; }
  const cum = [0];
  for(let i = 0; i < NPHI; i++){ const a = pts[i], b = pts[(i + 1) % NPHI]; cum.push(cum[i] + hyp(b[0] - a[0], b[1] - a[1])); }
  return { pts, nrmIn, cum, total: cum[NPHI], cx, cy };
}
const walkAt = (S, u) => {
  const P = S.total; u = ((u % P) + P) % P;
  let i = 0; while(i < NPHI - 1 && S.cum[i + 1] < u) i++;
  const a = S.pts[i], b = S.pts[(i + 1) % NPHI], t = (u - S.cum[i]) / (S.cum[i + 1] - S.cum[i] || 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};
/** walk the boundary from u0 to u1 the short way, sampled every HOP_STEP */
function hop(S, u0, u1){
  const P = S.total;
  let d = ((u1 - u0) % P + P) % P; if(d > P / 2) d -= P;
  const n = Math.max(1, Math.ceil(Math.abs(d) / HOP_STEP)), out = [];
  for(let j = 1; j <= n; j++) out.push(walkAt(S, u0 + d * j / n));
  return out;
}
function resample(pts, step){
  const out = [pts[0]];
  for(let i = 1; i < pts.length; i++){
    const a = out[out.length - 1], b = pts[i], d = hyp(b[0] - a[0], b[1] - a[1]);
    if(d < 1e-9) continue;
    const n = Math.max(1, Math.ceil(d / step));
    for(let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  return out;
}

/* ---------------- lines / sine: boustrophedon scan fill of a convex section ---------------- */
/* spacingAt(li, yFrac) may vary per scan line — that is the sundjer density field.
   Returns { pts, nLines, maxSpacing, nonConvex } — one continuous path, hops along the boundary. */
function scanFill(S, angleDeg, spacingAt, sine){
  const a = angleDeg * Math.PI / 180, ca = Math.cos(-a), sa = Math.sin(-a);
  const rotF = ([x, y]) => [x * ca - y * sa, x * sa + y * ca];
  const rp = S.pts.map(rotF);
  let yMin = 1e9, yMax = -1e9; for(const p of rp){ if(p[1] < yMin) yMin = p[1]; if(p[1] > yMax) yMax = p[1]; }
  const span = yMax - yMin;
  const crossings = (y) => {
    const hits = [];
    for(let i = 0; i < NPHI; i++){
      const p = rp[i], q = rp[(i + 1) % NPHI];
      if((p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1]){
        const t = (y - p[1]) / (q[1] - p[1]);
        if(t >= 1) continue;                                        // vertex hits counted once
        hits.push({ u: S.cum[i] + t * (S.cum[i + 1] - S.cum[i]), xr: p[0] + (q[0] - p[0]) * t });
      }
    }
    hits.sort((p, q) => p.xr - q.xr);
    return hits;
  };
  // scan positions
  const ys = []; let nonConvex = 0, maxSpacing = 0;
  let y = yMin + Math.max(0.6, 0.6 * spacingAt(0, 0));
  let li = 0;
  while(y < yMax - 0.5){
    ys.push(y);
    const s = spacingAt(li, (y - yMin) / span);
    maxSpacing = Math.max(maxSpacing, s);
    y += s; li++;
  }
  const out = []; let prevEndU = null;
  ys.forEach((y0, i) => {
    const hits = crossings(y0);
    if(hits.length < 2) return;
    if(hits.length > 2) nonConvex++;
    const L = hits[0], R = hits[hits.length - 1];
    const leftToRight = i % 2 === 0;
    const from = leftToRight ? L : R, to = leftToRight ? R : L;
    if(prevEndU !== null) out.push(...hop(S, prevEndU, from.u));
    // chord in the rotated frame, then rotate back
    const x0 = from.xr, x1 = to.xr, len = Math.abs(x1 - x0);
    const n = Math.max(1, Math.ceil(len / CHORD_STEP));
    const cb = Math.cos(a), sb = Math.sin(a);
    for(let j = (prevEndU === null ? 0 : 1); j <= n; j++){
      const t = j / n, xr = x0 + (x1 - x0) * t;
      let yr = y0;
      if(sine){
        const taper = smooth(Math.min(t, 1 - t) * len / (sine.lambda * 0.5));
        yr += sine.amp * taper * Math.sin(TAU * (xr - x0) / sine.lambda + sine.phase);
      }
      out.push([xr * cb - yr * sb, xr * sb + yr * cb]);
    }
    prevEndU = to.u;
  });
  return { pts: out, nLines: ys.length, maxSpacing, nonConvex };
}

/* ---------------- spiral: growth rings as one line ---------------- */
function spiralFill(S, spacing, d0){
  // how deep can we go: the shortest distance from the boundary to the centre along the inward normal
  let depth = 1e9;
  for(let i = 0; i < NPHI; i++) depth = Math.min(depth, hyp(S.pts[i][0] - S.cx, S.pts[i][1] - S.cy));
  const nTurns = Math.max(1, Math.floor((depth - d0 - 0.6 * spacing) / spacing));
  const out = [];
  for(let j = 0; j < nTurns; j++)
    for(let i = 0; i < NPHI; i++){
      const d = d0 + (j + i / NPHI) * spacing;
      out.push([S.pts[i][0] + S.nrmIn[i][0] * d, S.pts[i][1] + S.nrmIn[i][1] * d]);
    }
  // close the innermost turn so the spiral does not end on an open C
  const dEnd = d0 + nTurns * spacing;
  for(let i = 0; i <= NPHI / 4; i++)
    out.push([S.pts[i % NPHI][0] + S.nrmIn[i % NPHI][0] * dEnd, S.pts[i % NPHI][1] + S.nrmIn[i % NPHI][1] * dEnd]);
  return { pts: resample(out, CHORD_STEP), nTurns, maxSpacing: spacing };
}

/* ---------------- hilbert over the inscribed square (kocka) ---------------- */
function hilbertFill(side, targetPitch, flip){
  const order = clamp(Math.round(Math.log2(side / targetPitch)), 2, 6);
  const n = 1 << order, pitch = side / n;
  const pts = [];
  for(let d = 0; d < n * n; d++){                                   // d2xy, standard
    let rx, ry, x = 0, y = 0, t = d;
    for(let s = 1; s < n; s *= 2){
      rx = 1 & (t / 2); ry = 1 & (t ^ rx);
      if(ry === 0){ if(rx === 1){ x = s - 1 - x; y = s - 1 - y; } const tmp = x; x = y; y = tmp; }
      x += s * rx; y += s * ry; t = Math.floor(t / 4);
    }
    const px = (x + 0.5) * pitch - side / 2, py = (y + 0.5) * pitch - side / 2;
    pts.push(flip ? [py, px] : [px, py]);
  }
  return { pts: resample(pts, CHORD_STEP), pitch, order, maxSpacing: pitch };
}

/* ====================================================================================================
   The three bodies. Each variant provides:
     sectionAt(z, zf)      -> section (radial star)
     planAt(k, z, zf)      -> { kind, spacing, angle, sine?, tag }   — the layer program
   Solid base and solid cap are shared policy.                                                          */
export const VARIANTS = {
  kocka: {
    title: 'KOCKA PUNA', concept: 'the sampler: a solid cube whose bands answer "what does each fill pattern do?"',
    H: 24.0, size: 42.0,
    sectionAt(){ const R = this.size / 2, p = 8;                      // superellipse: a rounded square
      return makeSection(th => R * (Math.abs(Math.cos(th)) ** p + Math.abs(Math.sin(th)) ** p) ** (-1 / p)); },
    planAt(k, z, zf, base, cap){
      if(base) return { kind: 'lines', spacing: k === 0 ? 0.50 : 0.85, angle: 90 * (k % 2), tag: 'base' };
      if(cap)  return { kind: 'lines', spacing: 0.85, angle: 90 * (k % 2), tag: 'cap' };
      if(zf < 0.28) return { kind: 'lines', spacing: lerp(1.8, 3.0, zf / 0.28), angle: 90 * (k % 2), tag: 'lines' };
      if(zf < 0.46) return { kind: 'sine', spacing: 3.2, angle: 90 * (k % 2), sine: { amp: 1.0, lambda: 8 }, tag: 'sine' };
      if(zf < 0.66) return (k % 2 === 0)                              // hilbert needs a crossing layer under it
        ? { kind: 'hilbert', spacing: 3.0, angle: 0, tag: 'hilbert' }
        : { kind: 'lines', spacing: 2.4, angle: 45 + 90 * (Math.floor(k / 2) % 2), tag: 'hilbert-bond' };
      if(zf < 0.84) return (k % 4 === 3)
        ? { kind: 'lines', spacing: 2.8, angle: 45 * (k % 8), tag: 'spiral-bond' }
        : { kind: 'spiral', spacing: 3.0, angle: 0, tag: 'spiral' };
      return { kind: 'lines', spacing: lerp(3.0, 5.5, (zf - 0.84) / 0.16), angle: 90 * (k % 2), tag: 'crescendo' };
    },
    speed: 32,
  },
  sundjer: {
    title: 'SUNDJER PUN', concept: 'density as a field: a twisting tri-lobe blob, spacing varies inside every layer, direction steps by the golden angle',
    H: 20.0, R0: 15.0,
    sectionAt(z, zf){
      const bulge = 1 + 0.16 * Math.sin(Math.PI * zf);                // widest at mid-height
      const tw = TAU * 0.6 * zf;                                      // the lobes twist as the body rises
      return makeSection(th => this.R0 * bulge * (1 + 0.07 * Math.sin(3 * (th + tw))));
    },
    planAt(k, z, zf, base, cap){
      if(base) return { kind: 'lines', spacing: k === 0 ? 0.50 : 0.85, angle: rr(GOLDEN * k % 180, 2), tag: 'base' };
      if(cap)  return { kind: 'lines', spacing: 0.85, angle: rr(GOLDEN * k % 180, 2), tag: 'cap' };
      const sBase = lerp(2.4, 3.6, smooth(zf));                       // sparser as it rises
      return { kind: 'lines', spacing: sBase, angle: rr(GOLDEN * k % 180, 2),
        field: (li) => sBase * (1 + 0.35 * Math.sin(2.3 * li + 1.7 * k)), tag: 'field' };
    },
    speed: 32,
  },
  drvo: {
    title: 'DRVO PUNO', concept: 'a solid tree: growth rings (spiral) with a shear-bonding lines layer every third layer; the canopy flare is bounded per layer',
    H: 30.0,
    profile(zf){                                                      // radius over height
      if(zf < 0.13) return lerp(10.5, 7.5, smooth(zf / 0.13));        // flared foot (shrinking: always supported)
      if(zf < 0.52) return 7.5;                                       // trunk
      if(zf < 0.80) return lerp(7.5, 13.5, smooth((zf - 0.52) / 0.28)); // canopy swell (flare, bounded below)
      return lerp(13.5, 3.2, smooth((zf - 0.80) / 0.20));             // closing dome
    },
    sectionAt(z, zf){
      const sway = 0.8 * Math.sin(1.5 * Math.PI * zf);                // the trunk leans, gently
      return makeSection(() => this.profile(zf), sway, 0);
    },
    planAt(k, z, zf, base, cap){
      if(base) return { kind: 'lines', spacing: k === 0 ? 0.50 : 0.85, angle: 90 * (k % 2), tag: 'base' };
      if(cap)  return { kind: 'lines', spacing: 0.85, angle: 90 * (k % 2), tag: 'cap' };
      /* growth rings only where the section does not GROW: on a growing section the spiral's turn
         count jumps and the new innermost turn hangs over the previous layer's empty core (measured
         2026-09-30: CANTILEVER 15.3 mm at z 19.92). The swelling canopy is filled with rotating
         lines instead — lines do not care that the shell moved outward. */
      if(zf >= 0.52 && zf < 0.80)
        return { kind: 'lines', spacing: 3.0, angle: rr(60 * k % 180, 1), tag: 'canopy' };
      return (k % 3 === 2)
        ? { kind: 'lines', spacing: 3.0, angle: 60 * (Math.floor(k / 3) % 3), tag: 'bond' }
        : { kind: 'spiral', spacing: 2.8, angle: 0, tag: 'rings' };
    },
    speed: 32,
  },
};

/* ====================================================================================================
   generate: layers, foundation, self-refusing checks, summary                                          */
export function generateSolid(o){
  const V = VARIANTS[o.variant]; if(!V) throw new Error(`unknown variant ${JSON.stringify(o.variant)}; known: ${Object.keys(VARIANTS).join(', ')}`);
  const machines = JSON.parse(fs.readFileSync(path.join(ROOT, 'machines.json'), 'utf8'));
  const m = machines[o.machine]; if(!m || m._note) throw new Error(`unknown machine ${JSON.stringify(o.machine)}`);
  const BEAD = m.bead, LH = m.lh, FIRST_BEAD = m.firstLayerBead ?? 0.52;
  const scale = o.scale ? +o.scale : 1;
  const H = (o.H ? +o.H : V.H) * scale;
  if(V.size) V.size *= scale; if(V.R0) V.R0 *= scale;
  const N = Math.round(H / LH);
  const N_BASE = 5, N_CAP = 6;
  const MAXBRIDGE = 12, ALLOW = 0.6;
  const violations = [], warnings = [], events = [];

  const layers = [], plan = [];
  let prevPlan = null, prevSection = null;
  for(let k = 0; k < N; k++){
    const z = k * LH, zf = k / (N - 1);
    const S = V.sectionAt(z + 0.5 * LH, zf);
    const base = k < N_BASE, cap = k >= N - N_CAP;
    const p = V.planAt(k, z, zf, base, cap);
    const spacingAt = p.field ? ((li) => p.field(li)) : (() => p.spacing);

    /* fill */
    let fill, nLines = 0, detail = '';
    if(p.kind === 'lines' || p.kind === 'sine'){
      const sine = p.kind === 'sine' ? { amp: p.sine.amp, lambda: p.sine.lambda, phase: (k % 2) * Math.PI } : null;
      fill = scanFill(S, p.angle, spacingAt, sine);
      nLines = fill.nLines; detail = `${fill.nLines} chords @ ${p.angle}deg`;
      if(fill.nonConvex) violations.push(`layer ${k} z=${rr(z, 2)}: section is not convex for scanning (${fill.nonConvex} scan lines with >2 crossings)`);
    } else if(p.kind === 'spiral'){
      fill = spiralFill(S, p.spacing, BEAD * 0.95);
      detail = `${fill.nTurns} turns`;
    } else if(p.kind === 'hilbert'){
      const side = (V.size - 2.4) / Math.SQRT2 * Math.SQRT2 - 2.0;    // inscribed square of the superellipse, with margin
      fill = hilbertFill(side, p.spacing, Math.floor(k / 2) % 2 === 1);
      detail = `order ${fill.order}, pitch ${rr(fill.pitch, 2)}`;
    } else throw new Error(`unknown fill kind ${p.kind}`);

    /* free-span estimate against the layer below: sparse over sparse is supported only at crossings */
    let freeSpan = 0;
    if(k > 0){
      const q = prevPlan;
      const sBelow = q.maxSpacing;
      if(sBelow <= 1.0) freeSpan = 0;                                 // the layer below is effectively solid
      else if(p.kind === 'spiral' && q.kind === 'spiral') freeSpan = 0;   // rings stack on rings
      else if(p.kind === 'spiral' || q.kind === 'spiral') freeSpan = sBelow * 1.5;  // a line crosses rings every ring
      else {
        let d = Math.abs(((p.angle - q.angle) % 180 + 180) % 180); if(d > 90) d = 180 - d;
        if(p.kind === 'hilbert' || q.kind === 'hilbert'){ d = Math.min(d || 45, 45); }
        freeSpan = d < 5 ? Infinity : sBelow / Math.sin(d * Math.PI / 180);
      }
      if(!(freeSpan <= 0.9 * MAXBRIDGE))
        violations.push(`layer ${k} z=${rr(z, 2)} (${p.tag}): free span ${rr(freeSpan, 1)} mm over the layer below exceeds 0.9 x maxbridge ${0.9 * MAXBRIDGE} mm`);
    }
    /* perimeter drift: the shell must stay within reach of the material below */
    if(prevSection){
      let worst = 0;
      for(let i = 0; i < NPHI; i += 8){
        const [x, y] = S.pts[i]; let best = 1e9;
        for(let j = 0; j < NPHI; j += 4){ const q = prevSection.pts[j]; const dd = hyp(x - q[0], y - q[1]); if(dd < best) best = dd; }
        // outward growth only: a point inside the previous section rests on fill below
        const rNow = hyp(x - S.cx, y - S.cy), rPrevC = hyp(prevSection.pts[(i * 1) % NPHI][0] - prevSection.cx, prevSection.pts[i % NPHI][1] - prevSection.cy);
        if(rNow > rPrevC + hyp(S.cx - prevSection.cx, S.cy - prevSection.cy)) worst = Math.max(worst, best);
      }
      if(worst > ALLOW * 0.9) violations.push(`layer ${k} z=${rr(z, 2)}: the shell grows ${rr(worst, 2)} mm outward past the layer below (allow ${ALLOW})`);
    }

    const perimeter = S.pts.map(([x, y]) => [rr(x, 3), rr(y, 3)]); perimeter.push(perimeter[0]);
    /* sparse fill = typed bridge (vertices preserved, 0.5 mm sampling); dense fill may be LOD'd freely */
    const sparse = fill.maxSpacing > 1.2;
    const fillPts = (sparse ? resample(fill.pts, CHORD_STEP * 0.9) : fill.pts).map(([x, y]) => [rr(x, 3), rr(y, 3)]);
    const bead = k === 0 ? FIRST_BEAD : BEAD;
    const paths = [
      { pts: perimeter, role: 'wall', closed: true, bead, label: `shell-${p.tag}`, tile: 'body' },
      { pts: fillPts, role: sparse ? 'bridge' : 'wall', closed: false, bead, speed: V.speed, label: `${p.kind}-${p.tag}`, tile: 'body',
        intent: `${PROCESS}: ${p.kind} ${detail}, spacing ${rr(p.spacing, 2)} mm, layer ${k + 1}/${N}` },
    ];
    layers.push({ k, zBot: rr(z, 4), zTop: rr(z + LH, 4), w: 2.0, tab: 0, web: 'staple', phase: p.tag, contours: [], paths });
    const fillLen = fillPts.slice(1).reduce((a, q, i) => a + hyp(q[0] - fillPts[i][0], q[1] - fillPts[i][1]), 0);
    plan.push({ k, z: rr(z, 3), kind: p.kind, tag: p.tag, spacing_mm: rr(p.spacing, 2), maxSpacing_mm: rr(fill.maxSpacing, 2),
      angle_deg: rr(p.angle, 1), freeSpanEst_mm: Number.isFinite(freeSpan) ? rr(freeSpan, 2) : 'INF',
      fill_mm: rr(fillLen, 0), nLines });
    if(prevPlan && prevPlan.tag !== p.tag) events.push({ z: rr(z, 2), k, event: `${prevPlan.tag} -> ${p.tag}` });
    prevPlan = { ...p, maxSpacing: fill.maxSpacing }; prevSection = S;
  }

  /* foundation: three touching brim rings around the base, welded to the solid first layer (one island) */
  const S0 = V.sectionAt(0.5 * LH, 0);
  const foundation = [];
  for(const d of [0.42, 0.84, 1.26]){
    const ring = [];
    for(let i = 0; i < NPHI; i++) ring.push([rr(S0.pts[i][0] - S0.nrmIn[i][0] * d, 2), rr(S0.pts[i][1] - S0.nrmIn[i][1] * d, 2)]);
    ring.push(ring[0]); foundation.push(ring);
  }

  /* checks that refuse */
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
  for(const lay of layers) for(const p of lay.paths) for(const q of p.pts){
    if(q[0] < mnx) mnx = q[0]; if(q[0] > mxx) mxx = q[0]; if(q[1] < mny) mny = q[1]; if(q[1] > mxy) mxy = q[1]; }
  const size = [mxx - mnx + BEAD, mxy - mny + BEAD, rr(N * LH, 2)];
  if(size[0] + 16 > m.plate[0] || size[1] + 16 > m.plate[1])
    violations.push(`${size[0].toFixed(1)} x ${size[1].toFixed(1)} mm does not fit ${m.plate.join(' x ')} with an 8 mm margin`);
  if(m.beadSource !== 'measured' && !o.allowAssumedBead)
    violations.push(`machine ${o.machine}: bead ${BEAD} is ${m.beadSource}; pass --allow-assumed-bead (and --i-know-the-bead-is-a-guess to weft.mjs) to build anyway`);

  const totalFill = plan.reduce((a, p) => a + p.fill_mm, 0);
  const summary = {
    name: o.name || `PUN_${V.title.split(' ')[0]}_${o.machine.toUpperCase()}_X1`, variant: o.variant, title: V.title, concept: V.concept,
    generator: 'core/weft_solid_geometry.mjs', process: PROCESS, generatedAt: new Date().toISOString().slice(0, 10),
    machine: o.machine, machineLabel: m.label,
    machineQualification: { beadSource: m.beadSource, beadEvidence: m.beadEvidence, assumedAcknowledged: !!o.allowAssumedBead },
    size_mm: [rr(size[0], 1), rr(size[1], 1), size[2]], H: size[2], totalLayers: N,
    args: { lh: LH, bead: BEAD, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12, w: 2.0, e: 0, r0: rr(size[0] / 2, 2), K: 8, foundation: 3,
      maxbridge: MAXBRIDGE, maxcantilever: 3, allow: ALLOW, minanchor: 0.5, maxCapRadius: 20,
      speed: V.speed, bridgeSpeed: 18, temp: m.temp, bed: m.bed, fan: 100 },
    gatePolicy: { meaning: 'a solid body: every span between fill crossings must be a legal bridge; nothing is declared experimental',
      bridge_mm: MAXBRIDGE, cantilever_mm: 3, first_layer_max_islands: 1 },
    solid: { basePolicy: `${N_BASE} solid layers (first at 0.50 mm spacing, then 0.85)`, capPolicy: `${N_CAP} solid layers at 0.85 mm`,
      worstFreeSpanEst_mm: Math.max(...plan.map(p => p.freeSpanEst_mm === 'INF' ? 1e9 : p.freeSpanEst_mm)),
      fillLength_m: rr(totalFill / 1000, 1), patterns: [...new Set(plan.map(p => p.kind))], tags: [...new Set(plan.map(p => p.tag))] },
    layerProgram: plan,
    events, violations, warnings,
  };
  const payload = { summary, foundation: { kind: 'brim-rings', paths: foundation }, layers };

  function svg(){
    const Wv = 980, Hv = 560, els = [];
    const COL = { lines: '#78a7ff', sine: '#45d9c0', hilbert: '#ff9f6b', spiral: '#7cff5e', base: '#9bb0c8', cap: '#9bb0c8' };
    // four representative layers, top view
    const picks = [1, Math.floor(N * 0.35), Math.floor(N * 0.6), Math.floor(N * 0.9)];
    picks.forEach((k, j) => {
      const lay = layers[clamp(k, 0, N - 1)], ox = 130 + j * 240, oy = 160, sc = 200 / Math.max(size[0], size[1]);
      for(const p of lay.paths){
        const pts = p.pts.filter((_, i) => i % 1 === 0).map(q => `${(ox + q[0] * sc).toFixed(1)},${(oy - q[1] * sc).toFixed(1)}`).join(' ');
        els.push(`<polyline points="${pts}" fill="none" stroke="${COL[plan[clamp(k, 0, N - 1)].kind] || '#fff'}" stroke-width=".55" opacity=".9"/>`);
      }
      els.push(`<text x="${ox - 90}" y="${oy + 120}" fill="#9bb0c8" font-family="sans-serif" font-size="10">k=${k} · ${plan[clamp(k, 0, N - 1)].kind} ${plan[clamp(k, 0, N - 1)].spacing_mm} mm @ ${plan[clamp(k, 0, N - 1)].angle_deg}deg</text>`);
    });
    // elevation: tag bands + free-span profile
    const ex = 60, ey = 520, ew = 860, eh = 180;
    plan.forEach(p => {
      const yy = ey - (p.k / N) * eh;
      els.push(`<rect x="${ex}" y="${yy.toFixed(1)}" width="${(ew * 0.55).toFixed(1)}" height="${(eh / N + 0.5).toFixed(2)}" fill="${COL[p.kind] || '#fff'}" opacity=".7"/>`);
      const fs = p.freeSpanEst_mm === 'INF' ? MAXBRIDGE : p.freeSpanEst_mm;
      els.push(`<rect x="${(ex + ew * 0.60).toFixed(1)}" y="${yy.toFixed(1)}" width="${(fs / MAXBRIDGE * ew * 0.35).toFixed(1)}" height="${(eh / N + 0.5).toFixed(2)}" fill="#ff4d6d" opacity=".8"/>`);
    });
    els.push(`<line x1="${ex + ew * 0.60 + 0.9 * ew * 0.35}" y1="${ey - eh}" x2="${ex + ew * 0.60 + 0.9 * ew * 0.35}" y2="${ey}" stroke="#fff" stroke-dasharray="3 3" stroke-width=".6"/>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>${els.join('')}`
      + `<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="13">${summary.name} — ${V.concept}</text>`
      + `<text x="12" y="38" fill="#9bb0c8" font-family="sans-serif" font-size="10">${size[0].toFixed(0)} x ${size[1].toFixed(0)} x ${size[2].toFixed(1)} mm · ${m.label} · bead ${BEAD} (${m.beadSource}) · ${N} layers · fill ${rr(totalFill / 1000, 1)} m · worst free span ${summary.solid.worstFreeSpanEst_mm} mm (ceiling ${MAXBRIDGE})</text>`
      + `<text x="${ex}" y="${ey + 16}" fill="#9bb0c8" font-family="sans-serif" font-size="10">left: pattern per layer (bottom to top) · right: estimated free span vs the 0.9 x maxbridge line</text></svg>`;
  }
  return { payload, summary, violations, warnings, svg };
}

/* ---------------- CLI ---------------- */
function main(argv){
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const variant = opt('variant'), machine = opt('machine'), out = opt('out');
  if(!variant || !machine || !out){
    console.error('usage: node core/weft_solid_geometry.mjs --variant kocka|sundjer|drvo --machine a2l|a1|ender --out FILE [--svg FILE] [--name NAME] [--scale S] [--allow-assumed-bead]');
    process.exit(2);
  }
  const r = generateSolid({ variant, machine, out, name: opt('name'), scale: opt('scale'), H: opt('H'), allowAssumedBead: flag('allow-assumed-bead') });
  for(const w of r.warnings) console.error('note: ' + w);
  if(r.violations.length){ console.error('REFUSED:'); for(const v of r.violations) console.error('  * ' + v); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  if(opt('svg')) fs.writeFileSync(opt('svg'), r.svg());
  const s = r.summary;
  console.log(JSON.stringify({ name: s.name, machine: s.machineLabel, size_mm: s.size_mm, layers: s.totalLayers,
    patterns: s.solid.patterns, tags: s.solid.tags, fill_m: s.solid.fillLength_m,
    worstFreeSpanEst_mm: s.solid.worstFreeSpanEst_mm, events: s.events.length }, null, 1));
}
/* realpath both sides: C:\Svemir\!Projekti is a junction to D:\ and node realpaths the module URL */
if(process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
