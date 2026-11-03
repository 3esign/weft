import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  createPositionedWeftCore,
  layersFromGeometryScalable,
  materialFromGcode,
  correctMaterialHeader,
  writeGeometryStream,
  installLowMemoryGate,
  DiskAuditMap
} from 'file:///C:/Svemir/!Projekti/weft/private-studio/engine/scalable-weft.mjs';
import {
  WEFT_ROOT,
  loadMachines,
  gcodeText,
  fixHeader,
  packBambu3mf,
  runGate,
  runGateLayers
} from 'file:///C:/Svemir/!Projekti/weft/private-studio/vendor/core/weft_build.mjs';

const TAU = 2 * Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const r3 = (v) => Math.round(v * 1000) / 1000;

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/**
 * 5 Distinct Odd Waveforms W(theta) in [-1, 1] with W(theta + pi) = -W(theta) and W(0) = W(pi) = 0.
 * All 5 share exact zero-crossings at integer multiples of pi so that transitions between
 * layer patterns keep 100% point-weld ("var") registration across all layers.
 */
export function patternWave(theta, kind) {
  const ph = ((theta % TAU) + TAU) % TAU;
  const s = Math.sin(ph);
  if (kind === 'diagonal-truss') {
    return (2 / Math.PI) * Math.asin(s);
  }
  if (kind === 'sine-mashrabiya') {
    return s;
  }
  if (kind === 'staple-arcade') {
    return Math.tanh(2.1 * s) / Math.tanh(2.1);
  }
  if (kind === 'biharmonic-rosette') {
    return (s + 0.28 * Math.sin(3 * ph)) / 0.94;
  }
  if (kind === 'chevron-crown') {
    return 0.65 * ((2 / Math.PI) * Math.asin(s)) + 0.35 * s;
  }
  return s;
}

export function layerPatternAt(zf) {
  if (zf < 0.20) return { kind: 'diagonal-truss', tag: 'I-diagonal-truss' };
  if (zf < 0.40) return { kind: 'sine-mashrabiya', tag: 'II-sine-mashrabiya' };
  if (zf < 0.60) return { kind: 'staple-arcade', tag: 'III-staple-arcade' };
  if (zf < 0.80) return { kind: 'biharmonic-rosette', tag: 'IV-biharmonic-rosette' };
  return { kind: 'chevron-crown', tag: 'V-chevron-crown' };
}

export function evalBlendedWave(theta, zf) {
  const bands = [
    [0.00, 0.20, 'diagonal-truss'],
    [0.20, 0.40, 'sine-mashrabiya'],
    [0.40, 0.60, 'staple-arcade'],
    [0.60, 0.80, 'biharmonic-rosette'],
    [0.80, 1.01, 'chevron-crown']
  ];
  const fade = 0.025;
  for (let i = 0; i < bands.length; i++) {
    const [z0, z1, kind] = bands[i];
    if (zf >= z0 && zf <= z1) {
      if (i > 0 && zf - z0 < fade) {
        const t = smooth((zf - z0 + fade) / (2 * fade));
        return lerp(patternWave(theta, bands[i - 1][2]), patternWave(theta, kind), t);
      }
      if (i < bands.length - 1 && z1 - zf < fade) {
        const t = smooth((zf - (z1 - fade)) / (2 * fade));
        return lerp(patternWave(theta, kind), patternWave(theta, bands[i + 1][2]), t);
      }
      return patternWave(theta, kind);
    }
  }
  return Math.sin(theta);
}

function samplePolylineWithNormals(pts, sampleUs) {
  const n = pts.length;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const totalLen = cum[n - 1];
  const out = [];
  let segIdx = 0;
  for (let k = 0; k < sampleUs.length; k++) {
    const u = clamp(sampleUs[k], 0, 1);
    const targetS = u * totalLen;
    while (segIdx < n - 2 && cum[segIdx + 1] < targetS) segIdx++;
    const s0 = cum[segIdx];
    const s1 = cum[segIdx + 1];
    const t = s1 > s0 ? (targetS - s0) / (s1 - s0) : 0;
    const x = lerp(pts[segIdx][0], pts[segIdx + 1][0], t);
    const y = lerp(pts[segIdx][1], pts[segIdx + 1][1], t);
    const meta = pts[segIdx][2] !== undefined ? lerp(pts[segIdx][2], pts[segIdx + 1][2], t) : 0.5;
    out.push({ u, s: targetS, x, y, meta });
  }
  for (let k = 0; k < out.length; k++) {
    const prev = out[Math.max(0, k - 1)];
    const next = out[Math.min(out.length - 1, k + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const dl = Math.hypot(dx, dy) || 1;
    out[k].nx = -dy / dl;
    out[k].ny = dx / dl;
  }
  return { points: out, totalLen };
}

function evalCatmullRomChain(ctrlPts, stepsPerSpan = 14) {
  const out = [];
  const m = ctrlPts.length;
  for (let i = 0; i < m - 1; i++) {
    const p0 = ctrlPts[Math.max(0, i - 1)];
    const p1 = ctrlPts[i];
    const p2 = ctrlPts[i + 1];
    const p3 = ctrlPts[Math.min(m - 1, i + 2)];
    const steps = stepsPerSpan;
    for (let s = 0; s < (i === m - 2 ? steps + 1 : steps); s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );
      const y = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );
      const meta = lerp(p1[2] ?? 0.5, p2[2] ?? 0.5, t);
      out.push([x, y, meta]);
    }
  }
  return out;
}

function buildBaseQuadrantSegments(zf, spec) {
  const {
    outerHalfSpan: R,
    portalHalfGap: gpBase,
    scale
  } = spec;

  // Sculpted portal archway width over height zf:
  // Breathes smoothly to form ogee portal archways below, waisted gallery bridge in mid-section,
  // and upper lancet rose windows near the crown.
  const gp = gpBase + (1.8 * scale) * (
    0.55 * Math.sin(Math.PI * clamp((zf - 0.06) / 0.42, 0, 1)) -
    0.35 * Math.sin(Math.PI * clamp((zf - 0.44) / 0.28, 0, 1)) +
    0.45 * Math.sin(Math.PI * clamp((zf - 0.66) / 0.28, 0, 1))
  );

  // Purely inward 3D relief on the 8 facade panels flanking the 4 portals:
  // Zero at f=0 (portal jamb) and f=1 (cube corner pilaster) so corner pilasters hold exact cube dimensions.
  const facadeRelief = (f) => {
    const env = Math.sin(Math.PI * clamp(f, 0, 1)) ** 1.6;
    // Register 1 (zf 0.04..0.38): Pointed lancet arch niche
    const regArch = Math.sin(Math.PI * clamp((zf - 0.04) / 0.34, 0, 1)) * (1 - Math.abs(2 * f - 1) ** 1.3);
    // Register 2 (zf 0.34..0.68): Sculpted Diamond & Rose Medallion
    const dx = (f - 0.5) / 0.28;
    const dz = (zf - 0.51) / 0.16;
    const rMed = Math.hypot(dx, dz);
    const regMedallion = Math.exp(-rMed * rMed * 1.8) * (0.5 + 0.5 * Math.cos(rMed * 3.8));
    // Register 3 (zf 0.66..0.96): Triple Fluted Triforium Arcade
    const regFlutes = Math.sin(Math.PI * clamp((zf - 0.66) / 0.30, 0, 1)) * 0.5 * (1 - Math.cos(6 * Math.PI * f));

    const raw = (3.6 * regArch + 3.4 * regMedallion + 2.6 * regFlutes) * scale;
    return clamp(raw * env, 0, 4.6 * scale);
  };

  // --- MACRO-SEGMENT A: Outer Facade (East North-half -> NE Corner -> North East-half) ---
  const rCorner = 4.6 * scale;
  const rJamb = 2.4 * scale;
  const rawA = [];
  const nLeg = 32;

  for (let i = 0; i <= nLeg; i++) {
    const t = i / nLeg;
    const y = lerp(gp + rJamb, R - rCorner, t);
    const f = (y - (gp + rJamb)) / (R - rCorner - (gp + rJamb));
    const x = R - facadeRelief(f);
    rawA.push([x, y, f]);
  }
  const nCorner = 14;
  for (let i = 1; i < nCorner; i++) {
    const a = (i / nCorner) * (Math.PI / 2);
    const x = (R - rCorner) + rCorner * Math.cos(a);
    const y = (R - rCorner) + rCorner * Math.sin(a);
    rawA.push([x, y, 1.0]);
  }
  for (let i = 0; i <= nLeg; i++) {
    const t = i / nLeg;
    const x = lerp(R - rCorner, gp + rJamb, t);
    const f = (x - (gp + rJamb)) / (R - rCorner - (gp + rJamb));
    const y = R - facadeRelief(f);
    rawA.push([x, y, f]);
  }

  // --- MACRO-SEGMENT B: North Portal Archway & Inner Hollow Sculpture Quadrant ---
  // Morphing of the Inner Hollow Sculpture over zf in [0, 1]:
  //   - Stage 1 (zf 0.00..0.22): Octagonal Star Pedestal ("Zvezdasti Postament")
  //   - Stage 2 (zf 0.22..0.54): Swelling Hollow Geodesic Sphere ("Unutrasnja Suplja Sfera")
  //   - Stage 3 (zf 0.54..0.78): Fluted Hyperboloid Hourglass Waist ("Hiperboloidno Grlo")
  //   - Stage 4 (zf 0.78..1.00): Crown Lotus Star-Vault ("Kruna Kupole")
  const sphereSwelling = Math.sin(Math.PI * clamp((zf - 0.14) / 0.44, 0, 1));
  const waistPinch = Math.sin(Math.PI * clamp((zf - 0.48) / 0.36, 0, 1));
  const crownFlare = smooth((zf - 0.76) / 0.22);

  const xWing = R * (0.31 + 0.045 * sphereSwelling - 0.035 * waistPinch + 0.030 * crownFlare);
  const yWing = R * (0.56 + 0.045 * sphereSwelling - 0.040 * waistPinch + 0.035 * crownFlare);
  const yCore = R * (0.36 + 0.085 * sphereSwelling - 0.065 * waistPinch + 0.060 * crownFlare);

  const xThroat = gp + 1.8 * scale + 1.4 * scale * sphereSwelling;
  const yThroat = R - 11.5 * scale;

  const ctrlB = [
    [gp + rJamb, R, 0.0],
    [gp, R - rJamb, 0.08],
    [xThroat, yThroat, 0.22],
    [xWing, yWing, 0.45],
    [0.48 * xWing, lerp(yWing, yCore, 0.72), 0.75],
    [0.0, yCore, 1.0],
    [-0.48 * xWing, lerp(yWing, yCore, 0.72), 0.75],
    [-xWing, yWing, 0.45],
    [-xThroat, yThroat, 0.22],
    [-gp, R - rJamb, 0.08],
    [-(gp + rJamb), R, 0.0]
  ];

  const rawB = evalCatmullRomChain(ctrlB, 14);
  return { rawA, rawB, gp, rCorner };
}

export function buildCubeLayerPoints(k, spec) {
  const {
    totalLayers,
    kWavesA,
    kWavesB,
    samplesPerWave,
    ampFacadeBase,
    ampCorner,
    ampInnerBase
  } = spec;

  const zf = k / Math.max(1, totalLayers - 1);
  const { rawA, rawB } = buildBaseQuadrantSegments(zf, spec);

  const totalHalfWavesPerQuad = kWavesA + kWavesB;
  const totalHalfWaves = 4 * totalHalfWavesPerQuad;

  const nSamplesA = kWavesA * samplesPerWave;
  const nSamplesB = kWavesB * samplesPerWave;
  const usA = Array.from({ length: nSamplesA }, (_, i) => i / nSamplesA);
  const usB = Array.from({ length: nSamplesB }, (_, i) => i / nSamplesB);

  const sampledA = samplePolylineWithNormals(rawA, usA);
  const sampledB = samplePolylineWithNormals(rawB, usB);

  const stations = [];
  for (let q = 0; q < 4; q++) {
    const ang = q * (Math.PI / 2);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca];

    for (let i = 0; i < nSamplesA; i++) {
      const pt = sampledA.points[i];
      const [x, y] = rot(pt.x, pt.y);
      const [nx, ny] = rot(pt.nx, pt.ny);
      const waveIdx = q * totalHalfWavesPerQuad + (i / samplesPerWave);
      const f = pt.meta;
      const cornerPinch = smooth(clamp((f - 0.80) / 0.20, 0, 1));
      const jambPinch = smooth(clamp((0.15 - f) / 0.15, 0, 1));
      const windowPore = Math.sin(Math.PI * clamp(f, 0, 1)) * (0.7 + 0.3 * Math.sin(TAU * zf * 2));
      const amp = lerp(
        ampFacadeBase * (0.88 + 0.28 * windowPore),
        ampCorner,
        Math.max(cornerPinch, 0.65 * jambPinch)
      );
      stations.push({ x, y, nx, ny, waveIdx, amp, zone: 'facade' });
    }

    for (let i = 0; i < nSamplesB; i++) {
      const pt = sampledB.points[i];
      const [x, y] = rot(pt.x, pt.y);
      const [nx, ny] = rot(pt.nx, pt.ny);
      const waveIdx = q * totalHalfWavesPerQuad + kWavesA + (i / samplesPerWave);
      const m = pt.meta;
      const jambPinch = smooth(clamp((0.12 - m) / 0.12, 0, 1));
      const atriumWeave = ampInnerBase * (0.90 + 0.25 * m * (0.6 + 0.4 * Math.cos(TAU * zf * 1.5)));
      const amp = lerp(atriumWeave, ampCorner, 0.65 * jambPinch);
      stations.push({ x, y, nx, ny, waveIdx, amp, zone: 'inner' });
    }
  }

  const N = stations.length;
  const smNx = new Float64Array(N);
  const smNy = new Float64Array(N);
  const smAmp = new Float64Array(N);
  const win = 3;
  for (let i = 0; i < N; i++) {
    let sx = 0, sy = 0, sa = 0, wSum = 0;
    for (let d = -win; d <= win; d++) {
      const w = (win + 1 - Math.abs(d));
      const idx = (i + d + N) % N;
      sx += stations[idx].nx * w;
      sy += stations[idx].ny * w;
      sa += stations[idx].amp * w;
      wSum += w;
    }
    const nl = Math.hypot(sx, sy) || 1;
    smNx[i] = sx / nl;
    smNy[i] = sy / nl;
    smAmp[i] = sa / wSum;
  }

  // Build a lightweight 96-point closed silhouette ring for 3MF display mesh lofting
  const silStep = Math.max(1, Math.floor(N / 96));
  const silhouette = [];
  for (let i = 0; i < N; i += silStep) {
    silhouette.push([r3(stations[i].x), r3(stations[i].y)]);
  }

  return { stations, smNx, smNy, smAmp, N, totalHalfWaves, zf, silhouette };
}

export function generateSculptureLayers(spec) {
  const { totalLayers, lh, phaseDrift, maxSeg = 0.50 } = spec;

  const closedLoops = new Array(totalLayers);
  const silhouettes = new Array(totalLayers);
  for (let k = 0; k < totalLayers; k++) {
    const { stations, smNx, smNy, smAmp, N, zf, silhouette } = buildCubeLayerPoints(k, spec);
    silhouettes[k] = silhouette;
    const layerAmpScale = k === 0 ? 0.55 : (k === 1 ? 0.78 : 1.0);
    const phi_k = k * (Math.PI + phaseDrift);

    const loop = new Array(N);
    for (let i = 0; i < N; i++) {
      const st = stations[i];
      const theta = Math.PI * st.waveIdx + phi_k;
      const w = evalBlendedWave(theta, zf);
      const disp = smAmp[i] * layerAmpScale * w;
      loop[i] = [
        st.x + disp * smNx[i],
        st.y + disp * smNy[i]
      ];
    }
    closedLoops[k] = loop;
  }

  const N = closedLoops[0].length;
  const layers = [];
  let curStartIdx = 2;

  for (let k = 0; k < totalLayers; k++) {
    const z = Number(((k + 1) * lh).toFixed(3));
    const zf = k / Math.max(1, totalLayers - 1);
    const pat = layerPatternAt(zf);
    const loopK = closedLoops[k];

    const rawPts = [];
    const dropStations = 2;
    const totalStationSteps = N - dropStations;
    for (let s = 0; s <= totalStationSteps; s++) {
      const idx = (curStartIdx + s) % N;
      rawPts.push([loopK[idx][0], loopK[idx][1]]);
    }

    if (k > 0) {
      const prevEnd = layers[k - 1].pts.at(-1);
      rawPts[0] = [prevEnd[0], prevEnd[1]];
      const prevLoop = closedLoops[k - 1];
      const endIdx = (curStartIdx + totalStationSteps) % N;
      const m1Idx = (curStartIdx + totalStationSteps - 1) % N;
      rawPts[rawPts.length - 2] = [
        lerp(loopK[m1Idx][0], prevLoop[m1Idx][0], 0.25),
        lerp(loopK[m1Idx][1], prevLoop[m1Idx][1], 0.25)
      ];
      rawPts[rawPts.length - 1] = [
        lerp(loopK[endIdx][0], prevLoop[endIdx][0], 0.45),
        lerp(loopK[endIdx][1], prevLoop[endIdx][1], 0.45)
      ];
    }

    const pts = [[r3(rawPts[0][0]), r3(rawPts[0][1])]];
    for (let i = 1; i < rawPts.length; i++) {
      const a = rawPts[i - 1];
      const b = rawPts[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d > maxSeg) {
        const sub = Math.ceil(d / maxSeg);
        for (let j = 1; j <= sub; j++) {
          const t = j / sub;
          pts.push([r3(lerp(a[0], b[0], t)), r3(lerp(a[1], b[1], t))]);
        }
      } else if (d > 1e-5) {
        pts.push([r3(b[0]), r3(b[1])]);
      }
    }

    layers.push({
      k,
      z,
      zBot: Number((k * lh).toFixed(4)),
      zTop: Number(((k + 1) * lh).toFixed(4)),
      pts,
      silhouette: silhouettes[k],
      mode: pat.tag,
      patternKind: pat.kind
    });
    curStartIdx = (curStartIdx + totalStationSteps) % N;
  }

  return layers;
}

export function buildWeftGeometryFromLayers(layers, spec, machine) {
  const lh = spec.lh;
  const H = Number((spec.totalLayers * lh).toFixed(3));
  const totalHalfWaves = 4 * (spec.kWavesA + spec.kWavesB);
  return {
    summary: {
      name: spec.name,
      family: 'KOCKA_REVERZ',
      H,
      layers: layers.length,
      tileCount: 1,
      weldNodesPerLayer: totalHalfWaves,
      weldNodesTotal: totalHalfWaves * layers.length,
      singleThreadRevertible: true,
      layerPatterns: [
        'I-diagonal-truss',
        'II-sine-mashrabiya',
        'III-staple-arcade',
        'IV-biharmonic-rosette',
        'V-chevron-crown'
      ],
      args: {
        lh,
        bead: machine.bead,
        w: 3.6,
        speed: spec.printSpeed ?? 36,
        bridgeSpeed: spec.bridgeSpeed ?? 22,
        temp: machine.temp,
        bed: machine.bed,
        fan: 100,
        firstLayerBead: machine.firstLayerBead,
        firstLayerSpeed: 14
      }
    },
    layers: layers.map((l) => ({
      k: l.k,
      zBot: l.zBot,
      zTop: l.zTop,
      silhouette: l.silhouette,
      paths: [
        {
          role: 'bridge',
          closed: false,
          preservePoints: true,
          bead: l.k === 0 ? machine.firstLayerBead : machine.bead,
          speed: l.k === 0 ? 14 : (spec.printSpeed ?? 36),
          label: l.mode,
          pts: l.pts
        }
      ]
    }))
  };
}

async function buildAndVerifyOne(spec, machines, specimenRoot) {
  const m = machines[spec.machineKey];
  const outDir = path.join(specimenRoot, spec.name);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(spec.shelfDir, { recursive: true });

  console.log(`\n======================================================================`);
  console.log(`Building ${spec.name} (${m.label})...`);
  const t0 = Date.now();
  const layers = generateSculptureLayers(spec);
  console.log(`Generated ${layers.length} single-thread layers in ${Date.now() - t0} ms.`);

  let minSeamGap = Infinity, maxSeamGap = 0, maxInterLayerTravel = 0;
  for (let k = 0; k < layers.length; k++) {
    const pts = layers[k].pts;
    const gap = Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]);
    if (gap < minSeamGap) minSeamGap = gap;
    if (gap > maxSeamGap) maxSeamGap = gap;
    if (k > 0) {
      const prev = layers[k - 1].pts.at(-1);
      const tr = Math.hypot(pts[0][0] - prev[0], pts[0][1] - prev[1]);
      if (tr > maxInterLayerTravel) maxInterLayerTravel = tr;
    }
  }
  console.log(`Seam & continuity check: minSeamGap=${minSeamGap.toFixed(3)} mm, maxSeamGap=${maxSeamGap.toFixed(3)} mm, maxInterLayerTravel=${maxInterLayerTravel.toFixed(4)} mm`);

  const geo = buildWeftGeometryFromLayers(layers, spec, m);
  const geoFile = path.join(outDir, `${spec.name}_geometry.json`);
  await writeGeometryStream(geoFile, geo);
  console.log(`Saved geometry: ${geoFile}`);

  const W = createPositionedWeftCore();
  const compileSummary = layersFromGeometryScalable(W, geo, {
    machine: spec.machineKey,
    name: spec.name
  });
  console.log(`Compile summary: size=${compileSummary.size_mm.join('x')} mm, plate=${compileSummary.plate_mm.join(',')} mm, fitsPlate=${compileSummary.fitsPlate}, thread=${compileSummary.threadLength_m} m`);
  if (!compileSummary.fitsPlate) {
    throw new Error(`${spec.name} does not fit plate!`);
  }

  // Emit G-code using machine's harvested start/end blocks
  const startPath = path.join(WEFT_ROOT, m.start);
  const endPath = path.join(WEFT_ROOT, m.end);
  const rawTxt = await gcodeText(W, startPath, endPath);
  const fixed = fixHeader(rawTxt);
  const matCorrected = correctMaterialHeader(fixed.text);
  const finalGcodeText = matCorrected.text;
  const mat = matCorrected.stats;

  const gcodePath = path.join(outDir, `${spec.name}.gcode`);
  fs.writeFileSync(gcodePath, finalGcodeText);
  console.log(`Saved G-code: ${gcodePath} (${(Buffer.byteLength(finalGcodeText) / 1e6).toFixed(2)} MB, ${mat.g} g, ${mat.m} m, retractedMm=${mat.retractedMm} mm)`);

  // Gate S1
  installLowMemoryGate();
  console.log(`Running S1 gate on ${spec.name}.gcode...`);
  const s1 = runGate(finalGcodeText, { ...m, file: gcodePath });
  fs.writeFileSync(path.join(outDir, `${spec.name}_gate.json`), JSON.stringify(s1, null, 2));
  console.log(`S1 result: PASS=${s1.PASS}, floating=${s1.stats.floating}, long_bridge=${s1.stats.long_bridge}, cantilever=${s1.stats.cantilever}, bridges=${s1.stats.bridges}, firstLayer.PASS=${s1.firstLayer.PASS}`);
  if (!s1.PASS) {
    throw new Error(`S1 Gate failed on ${spec.name}!`);
  }

  // Gate S2-S8 with DiskAuditMap so memory stays low even on 1040-layer A2L build
  console.log(`Running S2-S8 layered gate on ${spec.name}.gcode...`);
  const tmpAuditFile = path.join(outDir, `${spec.name}_audit.tmp.bin`);
  let diskMap = null;
  globalThis.WEFT_LAYER_MAP_FACTORY = () => {
    diskMap = new DiskAuditMap(tmpAuditFile, { step: null });
    return diskMap;
  };
  let s28;
  try {
    s28 = runGateLayers(finalGcodeText, { ...m, file: gcodePath });
  } finally {
    delete globalThis.WEFT_LAYER_MAP_FACTORY;
    if (diskMap) {
      try { diskMap.close(); } catch {}
    }
    if (fs.existsSync(tmpAuditFile)) {
      try { fs.unlinkSync(tmpAuditFile); } catch {}
    }
  }
  fs.writeFileSync(path.join(outDir, `${spec.name}_gate_layers.json`), JSON.stringify(s28, null, 2));
  console.log(`S2-S8 result: refuse=${s28.refuse}, vector="${s28.vector}", findings=${s28.finding_count}`);
  if (s28.refuse) {
    throw new Error(`S2-S8 Gate refused ${spec.name}: ${s28.vector}`);
  }

  // Package .gcode.3mf if machine route is bambu3mf
  let threeMfPath = null;
  let packageGate = null;
  let packageInfo = null;
  if (m.route === 'bambu3mf') {
    const tplPath = path.join(WEFT_ROOT, m.containerTemplate);
    threeMfPath = path.join(outDir, `${spec.name}.gcode.3mf`);
    console.log(`Packaging Bambu 3MF container: ${threeMfPath}...`);
    packageInfo = packBambu3mf(finalGcodeText, tplPath, threeMfPath, {
      name: `${spec.name}.stl`,
      layerHeight: m.lh,
      plate: m.plate,
      machineProfile: m,
      geometry: geo
    });
    console.log(`Re-gating packaged 3MF container...`);
    packageGate = runGate(threeMfPath, { ...m, file: threeMfPath });
    fs.writeFileSync(path.join(outDir, `${spec.name}_package_gate.json`), JSON.stringify(packageGate, null, 2));
    if (!packageGate.PASS) {
      throw new Error(`3MF Package S1 gate failed on ${spec.name}!`);
    }
    console.log(`3MF Package gate PASS: ${packageGate.stats.checked_points} points checked.`);
  }

  // Run check_pure_weft.mjs on emitted .gcode (and .gcode.3mf if present)
  const pureWeftScript = 'C:/Svemir/!Projekti/weft/tools/check_pure_weft.mjs';
  const checkFiles = threeMfPath ? [gcodePath, threeMfPath] : [gcodePath];
  const pureCheck = spawnSync(process.execPath, [pureWeftScript, ...checkFiles], { encoding: 'utf8' });
  console.log(`check_pure_weft.mjs output:\n${pureCheck.stdout.trim()}`);
  if (pureCheck.status !== 0) {
    throw new Error(`check_pure_weft.mjs failed: ${pureCheck.stderr || pureCheck.stdout}`);
  }

  // Copy to ZA_STAMPU shelf
  const shelfGcode = path.join(spec.shelfDir, `${spec.name}.gcode`);
  fs.copyFileSync(gcodePath, shelfGcode);
  let shelf3mf = null;
  if (threeMfPath) {
    shelf3mf = path.join(spec.shelfDir, `${spec.name}.gcode.3mf`);
    fs.copyFileSync(threeMfPath, shelf3mf);
  }

  const weldNodesPerLayer = 4 * (spec.kWavesA + spec.kWavesB);
  const solidCubeCm3 = (compileSummary.size_mm[0] * compileSummary.size_mm[1] * compileSummary.size_mm[2]) / 1000;
  const relativeDensityPct = Number(((mat.cm3 / solidCubeCm3) * 100).toFixed(2));
  const hollownessPct = Number((100 - relativeDensityPct).toFixed(2));

  const receipt = {
    name: spec.name,
    machineKey: spec.machineKey,
    machineLabel: m.label,
    bead_mm: m.bead,
    beadSource: m.beadSource,
    lh_mm: m.lh,
    layers: compileSummary.layers,
    size_mm: compileSummary.size_mm,
    plate_mm: compileSummary.plate_mm,
    fitsPlate: compileSummary.fitsPlate,
    threadLength_m: compileSummary.threadLength_m,
    weldNodesPerLayer,
    weldNodesTotal: weldNodesPerLayer * compileSummary.layers,
    minSeamGap_mm: Number(minSeamGap.toFixed(3)),
    maxSeamGap_mm: Number(maxSeamGap.toFixed(3)),
    maxInterLayerTravel_mm: Number(maxInterLayerTravel.toFixed(4)),
    bodyRetractions: 0,
    footerRetractedMm: mat.retractedMm,
    material: mat,
    solidEnvelope_cm3: Number(solidCubeCm3.toFixed(1)),
    relativeDensity_pct: relativeDensityPct,
    hollowness_pct: hollownessPct,
    layerPatterns: geo.summary.layerPatterns,
    S1: {
      PASS: s1.PASS,
      firstLayerPASS: s1.firstLayer.PASS,
      firstLayerIslands: s1.stats.first_layer_islands,
      floating: s1.stats.floating,
      long_bridge: s1.stats.long_bridge,
      cantilever: s1.stats.cantilever,
      bridges: s1.stats.bridges,
      checked_points: s1.stats.checked_points
    },
    S2_S8: {
      refuse: s28.refuse,
      vector: s28.vector,
      finding_count: s28.finding_count,
      S2_worst_mm: s28.layers?.S2?.worst ?? null,
      S3_neverTied: s28.layers?.S3?.neverTied ?? 0,
      S4_overflights: s28.layers?.S4?.overflights ?? 0,
      S5_ratio: s28.layers?.S5?.ratio ?? null,
      S8_periodTwoLayers: s28.layers?.S8?.periodTwoLayers ?? 0,
      S8_selfStackedLayers: s28.layers?.S8?.selfStackedLayers ?? 0,
      S8_medianCrossing_deg: s28.layers?.S8?.medianOfLayerMedians_deg ?? null
    },
    pureWeftCheck: pureCheck.stdout.trim(),
    files: {
      specimenGcode: gcodePath,
      specimenGcodeSha256: sha256File(gcodePath),
      specimen3mf: threeMfPath,
      specimen3mfSha256: threeMfPath ? sha256File(threeMfPath) : null,
      shelfGcode,
      shelf3mf
    }
  };

  fs.writeFileSync(path.join(outDir, `${spec.name}_manifest.json`), JSON.stringify(receipt, null, 2));
  fs.writeFileSync(path.join(spec.shelfDir, `${spec.name}_manifest.json`), JSON.stringify(receipt, null, 2));
  return receipt;
}

const machines = loadMachines();
const specimenRoot = 'C:/Svemir/!Projekti/weft/specimens/2026-11-03_KOCKA_REVERZ';
fs.mkdirSync(specimenRoot, { recursive: true });

const specs = [
  {
    name: 'KOCKA_REVERZ_ENDER_150',
    machineKey: 'ender',
    totalLayers: 750,       // 750 * 0.20 mm = 150.0 mm
    lh: machines.ender.lh,
    outerHalfSpan: 72.86,   // exact 150.0 x 150.0 x 150.0 mm
    portalHalfGap: 10.5,    // 21 mm portal archways
    scale: 1.0,
    kWavesA: 15,            // 15 half-waves on Outer Facade + Corner quadrant
    kWavesB: 17,            // 17 half-waves on Inner Portal + Hollow Sculpture quadrant (128 weld nodes/layer)
    samplesPerWave: 18,
    maxSeg: 0.50,
    ampFacadeBase: 1.75,
    ampCorner: 1.55,
    ampInnerBase: 1.85,
    phaseDrift: (2 * Math.PI) / 18,
    printSpeed: 36,
    bridgeSpeed: 22,
    shelfDir: 'C:/Svemir/!Projekti/weft/ZA_STAMPU/CREALITY_Ender3V4/KOCKA_REVERZ_ENDER_150'
  },
  {
    name: 'KOCKA_REVERZ_A2L_250',
    machineKey: 'a2l',
    totalLayers: 1040,      // 1040 * 0.24 mm = 249.6 mm (25.0 cm)
    lh: machines.a2l.lh,
    outerHalfSpan: 122.62,  // exact 250.0 x 250.0 x 249.6 mm
    portalHalfGap: 17.5,    // 35 mm portal archways
    scale: 250 / 150,
    kWavesA: 24,            // 24 half-waves on Outer Facade + Corner quadrant
    kWavesB: 27,            // 27 half-waves on Inner Portal + Hollow Sculpture quadrant (204 weld nodes/layer)
    samplesPerWave: 18,
    maxSeg: 0.52,
    ampFacadeBase: 1.85,
    ampCorner: 1.65,
    ampInnerBase: 1.95,
    phaseDrift: (2 * Math.PI) / 18,
    printSpeed: 40,
    bridgeSpeed: 24,
    shelfDir: 'C:/Svemir/!Projekti/weft/ZA_STAMPU/A2L_Bambu/KOCKA_REVERZ_A2L_250'
  }
];

const results = [];
for (const spec of specs) {
  const r = await buildAndVerifyOne(spec, machines, specimenRoot);
  results.push(r);
}

const summaryPath = path.join(specimenRoot, 'KOCKA_REVERZ_SUMMARY.json');
fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), sculptures: results }, null, 2));
console.log(`\nALL DONE! Summary written to ${summaryPath}`);
