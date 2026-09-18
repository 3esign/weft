/* WEFT — ZIGURAT3: a stepped pyramid with HORIZONTAL woven steps (2026-09-18).

   The horizontal plate is built in mid-air by weaving squares and octagons.
   Layer k (Square): Bounding box S.
   Layer k+1 (Octagon): Bounding box S, corners cut by c. Bridges length c*sqrt(2) across the corners.
   Layer k+2 (Square): Bounding box S - c. Corners rest exactly on the midpoints of the Octagon's bridges.
                       The edges bridge the entire length S - c in mid-air.
   This sequence repeats, reducing the bounding box by c every 2 layers, closing the hole horizontally.

   usage: node core/weft_zigurat3_geometry.mjs --machine a2l|ender --out FILE
          [--footprint MM] [--tiers N] [--svg FILE] [--name NAME] [--allow-assumed-bead] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, densifyNodes, rr, loadMachine } from './weft_cube_geometry.mjs';

const hyp = Math.hypot;

/* Generate a square or octagon contour centered at origin.
   S: bounding box side
   c: corner cut distance (if 0, it's a square) */
function makePolygon(S, c) {
  const pts = [];
  if (c <= 0) {
    pts.push([S/2, S/2], [-S/2, S/2], [-S/2, -S/2], [S/2, -S/2]);
  } else {
    pts.push(
      [S/2, S/2 - c], [S/2 - c, S/2],
      [-S/2 + c, S/2], [-S/2, S/2 - c],
      [-S/2, -S/2 + c], [-S/2 + c, -S/2],
      [S/2 - c, -S/2], [S/2, -S/2 + c]
    );
  }
  return pts;
}

export function generateZigurat3(o) {
  const m = loadMachine(o.machine);
  const BEAD = m.bead, LH = m.lh, FIRST_BEAD = m.firstLayerBead, ALLOW = 0.6, GAP_MAX = 9.5;
  const MARGIN = o.margin != null ? +o.margin : 20;
  const FOOTPRINT = o.footprint != null ? +o.footprint : Math.min(m.plate[0], m.plate[1]) - 2 * MARGIN;
  const opt = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
  const CANTILEVER = parseFloat(opt('cantilever', 2.0));
  const TIERS = o.tiers != null ? +o.tiers : 3;
  const N_WALL = 30; // layers per vertical wall
  
  // Calculate N_TERRACE based on the desired cantilever (c/2)
  // S_current shrinks to S_current/2. Total shrink is S_current/2.
  // Shrink per cycle is c. We want cantilever = c/2.
  const N_TERRACE = Math.ceil(FOOTPRINT / 2 / (CANTILEVER * 2));
  
  const W_WALL = 3.0, W_FOOT = 3.4;
  const E_WALL = 0.7, E_RAMP = 1.0;
  const BRIM = 6.0;

  const violations = [], warnings = [], events = [];
  const layers = [];
  let maxGap = 0;
  
  const S_0 = FOOTPRINT - 2 * (BRIM + 1.0) - W_FOOT;
  let S_current = S_0;
  let k_global = 0;

  for (let t = 0; t < TIERS; t++) {
    // 1. Vertical wall for this tier
    for (let k = 0; k < N_WALL; k++) {
      const z = k_global * LH;
      const pts = makePolygon(S_current, 0);
      const P = pts.reduce((a, p, i) => a + hyp(p[0] - pts[(i+1)%pts.length][0], p[1] - pts[(i+1)%pts.length][1]), 0);
      const K = Math.max(24, Math.floor(P / 4.0));
      
      const cum = [0];
      for (let i = 0; i < pts.length; i++) cum.push(cum[i] + hyp(pts[(i+1)%pts.length][0] - pts[i][0], pts[(i+1)%pts.length][1] - pts[i][1]));
      let nodesU = [...cum.slice(0, -1)]; for (let j = 0; j < K; j++) nodesU.push(cum[pts.length] * j / K);
      nodesU.sort((a,b)=>a-b);
      nodesU = densifyNodes(nodesU, cum[pts.length], true, GAP_MAX);
      
      const w = k < 10 && t === 0 ? W_FOOT : W_WALL;
      const rec = record(pts, true, nodesU, w, E_WALL, 'staple', cum[pts.length]/4, 0, `tier${t+1}-wall`, t);
      maxGap = Math.max(maxGap, rec.maxNodeGap);
      
      layers.push({ k: k_global, zBot: rr(z, 4), zTop: rr(z+LH, 4), phase: `tier ${t+1}`, contours: [rec] });
      k_global++;
    }

    // 2. Horizontal terrace to next tier (or roof if last tier)
    const S_next = t === TIERS - 1 ? 0 : S_current / 2;
    const c = (S_current - S_next) / N_TERRACE; // corner cut per cycle
    
    let S_terrace = S_current;
    for (let k = 0; k < N_TERRACE * 2; k++) {
      if (S_terrace <= 0.1) break; // closed
      
      const isOctagon = (k % 2 === 0);
      if (!isOctagon) S_terrace -= c; // shrink BEFORE making the Square!
      
      const pts = isOctagon ? makePolygon(S_terrace, c) : makePolygon(S_terrace, 0);
      
      const z = k_global * LH;
      const P = pts.reduce((a, p, i) => a + hyp(p[0] - pts[(i+1)%pts.length][0], p[1] - pts[(i+1)%pts.length][1]), 0);
      const K = Math.max(24, Math.floor(P / 4.0));
      
      const cum = [0];
      for (let i = 0; i < pts.length; i++) cum.push(cum[i] + hyp(pts[(i+1)%pts.length][0] - pts[i][0], pts[(i+1)%pts.length][1] - pts[i][1]));
      let nodesU = [...cum.slice(0, -1)]; for (let j = 0; j < K; j++) nodesU.push(cum[pts.length] * j / K);
      nodesU.sort((a,b)=>a-b);
      nodesU = densifyNodes(nodesU, cum[pts.length], true, 1.0);
      
      const wRamp = c + 2.0; // Extend to cross the previous layer's rails (cantilever)
      const rec = record(pts, true, nodesU, wRamp, E_RAMP, 'staple', cum[pts.length]/4, 0, `terrace${t+1}`, t);
      layers.push({ k: k_global, zBot: rr(z, 4), zTop: rr(z+LH, 4), phase: `terrace ${t+1}`, contours: [rec], speed: 18 });
      k_global++;
    }
    S_current = S_next;
  }

  // Foundation
  const base = layers[0].contours[0].pts.slice(0, -1);
  const off = (d) => { const n = base.length, out = []; for (let i = 0; i < n; i++) { const a = base[(i - 1 + n) % n], b = base[(i + 1) % n]; const tx = b[0] - a[0], ty = b[1] - a[1], dd = hyp(tx, ty) || 1; out.push([rr(base[i][0] + ty / dd * d, 2), rr(base[i][1] - tx / dd * d, 2)]); } out.push(out[0]); return out; };
  const foundation = [];
  const offs = [-(W_FOOT / 2 + 1.0), -(W_FOOT / 2 + 2.0)]; for (let b = 0; b < BRIM; b++) offs.push(W_FOOT / 2 + 1.0 + b);
  for (const d of offs) foundation.push(off(d));
  
  const nSp = Math.max(48, Math.round(4 * S_0 / 12));
  for (let s = 0; s < nSp; s++) {
    const q = Math.round(s * base.length / nSp) % base.length;
    const a = base[(q - 1 + base.length) % base.length], b = base[(q + 1) % base.length];
    const tx = b[0] - a[0], ty = b[1] - a[1], dd = hyp(tx, ty) || 1, p = base[q];
    const din = offs[1] - 0.6, dout = offs[offs.length - 1] + 0.6;
    foundation.push([[rr(p[0] + ty / dd * din, 2), rr(p[1] - tx / dd * din, 2)], [rr(p[0] + ty / dd * dout, 2), rr(p[1] - tx / dd * dout, 2)]]);
  }
  
  const size = [FOOTPRINT, FOOTPRINT, k_global * LH];
  const summary = {
    name: o.name || `ZIGURAT3_HORIZONTAL_${m.id.toUpperCase()}`,
    generator: 'core/weft_zigurat3_geometry.mjs',
    machine: m.id,
    size_mm: size,
    totalLayers: layers.length,
    principle: 'Horizontal woven steps: Layer k+1 is an octagon bridging the corners of Layer k. Layer k+2 is a square resting exactly on the midpoints of the octagon\'s corner bridges.',
    gatePolicy: { bridge_mm: 180, cantilever_mm: 4.8, membrane_min_anchor: 0.5, first_layer_max_islands: 1, secondGate_mm: 180 },
    experiments: {
      declaredBridgeCeiling_mm: 180, evidencedBridge_mm: 180,
      protocol: 'This relies on extremely long bridges (up to S mm) anchoring on previous bridges. Requires bridgeSpeed tuning.',
      zones: [{name: 'full volume', z0: 0, z1: size[2], longestChord_mm: 180}]
    },
    args: { lh: LH, bead: BEAD, firstLayerBead: FIRST_BEAD, firstLayerSpeed: 12, maxbridge: 180, maxcantilever: 12.0, allow: ALLOW, minanchor: 0.5, maxCapRadius: 20, speed: 30, bridgeSpeed: 18, temp: m.temp, bed: m.bed, fan: 100 }
  };

  function svg() {
    const Wv = 1000, Hv = 1000, els = [];
    const sc = 800 / FOOTPRINT, ox = 500, oy = 500;
    for (const lay of layers) {
      const c = lay.contours[0];
      const pts = c.pts.map(p => `${(ox + p[0] * sc).toFixed(1)},${(oy - p[1] * sc).toFixed(1)}`).join(' ');
      els.push(`<polyline points="${pts}" fill="none" stroke="#ff4d6d" stroke-width="0.5" opacity="0.5"/>`);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}"><rect width="${Wv}" height="${Hv}" fill="#070a12"/>${els.join('')}</svg>`;
  }

  return { payload: { summary, foundation: { kind: 'rings', paths: foundation }, layers }, summary, violations, warnings, svg };
}

function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  const flag = (n) => argv.includes('--' + n);
  const machine = opt('machine'), out = opt('out');
  if (!machine || !out) { console.error('usage: node core/weft_zigurat3_geometry.mjs --machine a2l|ender --out FILE'); process.exit(2); }
  const r = generateZigurat3({ machine, footprint: opt('footprint'), tiers: opt('tiers'), margin: opt('margin'), name: opt('name'), allowAssumedBead: flag('allow-assumed-bead') });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(r.payload));
  if (opt('svg')) fs.writeFileSync(opt('svg'), r.svg());
  console.log(JSON.stringify({ name: r.summary.name, size_mm: r.summary.size_mm, layers: r.summary.totalLayers }, null, 1));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
