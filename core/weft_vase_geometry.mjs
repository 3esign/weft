#!/usr/bin/env node
/* core/weft_vase_geometry.mjs — JavaScript port of vase_geometry.py (V1 "Vrtlog": a vessel that is
 * also a ruler — three strands orbiting a core and twisting as they rise, the core dying into a floor
 * membrane, the strands parting into three with real eyes between them, fusing again, the mouth
 * flaring; six grammar bands at heights you can point at; the Ender-3 V4 specimen V1_vrtlog_ender at
 * --H 130 --turns 0.72).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same body (the accelerating twist, the orbit, the strand radius, the core that only ever shrinks
 * into absence), the same bands, the same JSON shape, key order and rounding, the same refusal
 * (.rejected file, exit 1) and the same printed lines. The engine the script shares by copy with
 * climber_geometry.py is core/weft_discbody_engine.mjs; parity with the Python output is measured by
 * tests/vase_geom_parity.test.mjs.
 *
 *   import { generateVase, toJson } from './core/weft_vase_geometry.mjs';
 *   generateVase({ turns: 0.72, H: 130, bead: 0.42, lh: 0.2, plate: [220, 220] })
 *       -> { payload, summary, violations, toJson(), rejectedJson(), stdoutText(), args, ... }
 *   node core/weft_vase_geometry.mjs --turns 0.72 --H 130 --bead 0.42 --lh 0.2 --plate 220 220 --out FILE
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pyFormatFixed, pyFloatRepr } from './weft_geom_ext.js';
import { libmSin, libmCos, libmPow } from './weft_geom_ext2.js';
import { bodyConstants, runDiscBodyEngine, makeArgParser, cliFinish } from './weft_discbody_engine.mjs';

/* ---------------- argparse twin: same flags, same defaults, same types, same Namespace order ---------------- */
export const ARG_DEFAULTS = [
  ['turns', 'float', 0.72], ['H', 'float', 130.0], ['lh', 'float', 0.20], ['e', 'float', 1.0], ['bead', 'float', 0.42],
  ['w0', 'float', 1.6], ['w1', 'float', 9.0], ['K', 'int', 10], ['res', 'float', 0.28], ['foundation', 'float', 7.0],
  ['rib', 'float', 2.6], ['maxbridge', 'float', 12.0], ['plate', 'float2', [220.0, 220.0]], ['out', 'str', '/tmp/vase.json'],
  ['allow_fail', 'flag', false],
];
export const parseArgs = makeArgParser(ARG_DEFAULTS);

/** The generator. Returns the engine result: payload exactly as the Python writes it with json.dump
 *  (toJson()), the violations that make the Python refuse, the .rejected text and the stdout text. */
export function generateVase(argsIn, opts = {}){
  const args = parseArgs(argsIn);
  const C = bodyConstants(args);
  const { H, sm, RHO_at } = C;

  /* ---------------- the body: one formulation for the whole height ---------------- */
  const KS = 3;                                            // strands

  /** the twist: accelerating, 2*pi*turns*(z/H)**1.6 */
  const ph_at = (z) => 2 * Math.PI * args.turns * libmPow(Math.max(0.0, z) / H, 1.6);   // ** 1.6 is C pow()
  /** how far the three strands stand from the axis */
  function orb_at(z){
    const t = z / H;
    return (26.0 + 9.0 * sm((t - 0.28) / 0.20)             // they part: the eyes open, slowly
                 - 26.0 * sm((t - 0.60) / 0.14)            // and come back until they touch each other
                 + 13.0 * sm((t - 0.74) / 0.26));          // then the mouth flares, slowly
  }
  function rs_at(z){
    const t = z / H;
    return (11.0 - 3.0 * sm((t - 0.28) / 0.14)             // thin as they part
                 + 1.5 * sm((t - 0.62) / 0.12)             // thicken to fuse
                 - 3.5 * sm((t - 0.82) / 0.18));           // taper into the rim
  }
  /** the core: it may only ever SHRINK into absence, never grow out of it */
  function rc_at(z){
    const t = z / H;
    const fused = orb_at(z) <= 1.15 * rs_at(z) + 0.5;
    if(t < 0.44){
      return Math.max(0.0, 18.0 - 4.0 * sm((t - 0.16) / 0.10)     // 18 -> 14, slowly, through the separation
                               - 14.0 * sm((t - 0.28) / 0.14));   // then away
    }
    if(!fused && t < 0.78) return 0.0;
    return Math.max(0.0, (orb_at(z) - rs_at(z) + 3.5) * sm((t - 0.72) / 0.08));
  }
  /** [[x, y, r]] — the discs whose union is the vessel at this height */
  function parts_at(z){
    const rmin = RHO_at(z) + 0.4;
    const out = [];
    const rc = rc_at(z);
    if(rc > rmin) out.push([0.0, 0.0, rc]);
    const orb = orb_at(z), ph = ph_at(z);
    const rs = Math.max(rs_at(z), rmin);
    for(let i = 0; i < KS; i++){
      const a = ph + 2 * Math.PI * i / KS;                 // ph + ((2*pi)*i)/KS
      out.push([orb * libmCos(a), orb * libmSin(a), rs]);
    }
    return out.filter(p => p[2] >= rmin - 1e-9);
  }
  /** six bands, one per experiment, each at a height you can point at afterwards */
  function phase_at(z){
    const t = z / H;
    if(t < 0.16) return ['staple', 1.0, 'foot'];          // the wall at its thinnest, almost no twist
    if(t < 0.30) return ['perp', 0.8, 'belly'];           // square wave, lobes deepening
    if(t < 0.56) return ['diagonal', 1.4, 'eyes'];        // truss members across an opening body
    if(t < 0.70) return ['eight', 1.2, 'knot'];           // loop stitch through the three-way merge
    if(t < 0.84) return ['sine', 1.2, 'neck'];            // the wave at the tightest curvature
    return ['staple', 1.4, 'mouth'];                       // long tabs on the outward flare
  }

  const g = runDiscBodyEngine({
    args, C, parts_at, phase_at,
    process: 'single-layer-inward-spiral/vase-v1',
    head: (N) => ({ N, H, strands: KS, turns: args.turns }),
    rasterLine: (nx, ny, lim, N) => `raster ${nx}x${ny} px, half-extent ${pyFormatFixed(lim, 1)} mm, ${N} layers, strands=${KS}, turns=${pyFloatRepr(args.turns)}`,
    log: opts.log,
  });
  g.args = args;
  return g;
}

/** json.dump(payload) — the geometry file's exact text, for a result of generateVase. */
export function toJson(g){ return g.toJson(); }

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv); }
  catch(e){ console.error(`usage: weft_vase_geometry.mjs [--turns TURNS] [--H H] [--lh LH] [--e E] [--bead BEAD] [--w0 W0] [--w1 W1] [--K K] [--res RES] [--foundation FOUNDATION] [--rib RIB] [--maxbridge MAXBRIDGE] [--plate PLATE PLATE] [--out OUT] [--allow-fail]\nerror: ${e.message}`); process.exit(2); }
  const g = generateVase(args, { log: (s) => console.error(s) });
  cliFinish(fs, args, g);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
