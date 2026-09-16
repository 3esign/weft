#!/usr/bin/env node
/* core/weft_climber_geometry.mjs — JavaScript port of climber_geometry.py (P2 "Penjač": the act of
 * climbing in WEFT's own language — feet, legs merging into a traversing core, reaches that grip and
 * pull back in, a head that closes; for the Ender-3 V4 and, at --H 240 --legs 3, the A2L specimen
 * P2b_penjac_3_A2L).
 *
 * Statement for statement the same as the Python script: the same argparse flags and defaults, the
 * same body (FEET, the two merges, the core traverse and breathing, the arms as chains of discs, the
 * rhythm bands), the same JSON shape, key order and rounding, the same refusal (.rejected file, exit 1)
 * and the same printed lines. The engine the script shares by copy with vase_geometry.py — raster,
 * masks, closures, contour tree, weld columns, the wall solve, the checks — is
 * core/weft_discbody_engine.mjs; parity with the Python output is measured by
 * tests/climber_geom_parity.test.mjs.
 *
 *   import { generateClimber, toJson } from './core/weft_climber_geometry.mjs';
 *   generateClimber({ legs: 3, H: 240, bead: 0.45, lh: 0.24, plate: [330, 320] })
 *       -> { payload, summary, violations, toJson(), rejectedJson(), stdoutText(), args, ... }
 *   node core/weft_climber_geometry.mjs --legs 3 --H 240 --bead 0.45 --lh 0.24 --plate 330 320 --out FILE
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pyFormatFixed } from './weft_geom_ext.js';
import { libmSin, libmCos, libmPow, pyRadians } from './weft_geom_ext2.js';
import { bodyConstants, runDiscBodyEngine, makeArgParser, pyIntMod, cliFinish } from './weft_discbody_engine.mjs';

/* ---------------- argparse twin: same flags, same defaults, same types, same Namespace order ---------------- */
export const ARG_DEFAULTS = [
  ['legs', 'int', 3, [2, 3]], ['H', 'float', 168.0], ['lh', 'float', 0.20], ['e', 'float', 1.0], ['bead', 'float', 0.42],
  ['w0', 'float', 3.2], ['w1', 'float', 9.0], ['K', 'int', 10], ['res', 'float', 0.28], ['foundation', 'float', 7.0],
  ['rib', 'float', 2.6], ['maxbridge', 'float', 12.0], ['plate', 'float2', [220.0, 220.0]], ['out', 'str', '/tmp/climber.json'],
  ['allow_fail', 'flag', false],
];
export const parseArgs = makeArgParser(ARG_DEFAULTS);

/** The generator. Returns the engine result: payload exactly as the Python writes it with json.dump
 *  (toJson()), the violations that make the Python refuse, the .rejected text and the stdout text. */
export function generateClimber(argsIn, opts = {}){
  const args = parseArgs(argsIn);
  const C = bodyConstants(args);
  const { H, sm, lerp, RHO_at, RHO_MAX } = C;

  /* ---------------- the body ---------------- */
  let FEET, Z_M1, Z_M2;
  if(args.legs === 3){
    // a leaning tripod: two front feet, one bracing leg further out and behind
    FEET = [205.0, 335.0].map(a => [30.0 * libmCos(pyRadians(a)), 30.0 * libmSin(pyRadians(a))]);
    FEET.push([35.0 * libmCos(pyRadians(80.0)), 35.0 * libmSin(pyRadians(80.0))]);
    Z_M1 = 0.24 * H;                                       // the two front legs merge
    Z_M2 = 0.42 * H;                                       // the bracing leg joins
  } else {
    FEET = [[-27.0, -9.45], [27.0, 9.45]];
    Z_M1 = Z_M2 = 0.36 * H;
  }
  const Z_HEAD = 0.93 * H;
  const PAIR = [(FEET[0][0] + FEET[1][0]) / 2.0, (FEET[0][1] + FEET[1][1]) / 2.0];

  /** the traverse: the core's centre moves */
  function core_xy(z){
    const t = z / H;
    return [18.0 * libmSin(2 * Math.PI * 0.80 * t) * sm(z / (0.28 * H)),
            6.0 * libmSin(2 * Math.PI * 1.60 * t) * sm(z / (0.28 * H))];
  }
  function core_r(z){
    const t = z / H;
    const base = 11.0 - 3.2 * sm((z - Z_M2) / (H - Z_M2));   // tapers from hips to head
    const r = base + 1.7 * libmSin(2 * Math.PI * 3.0 * t);   // breathing
    return Math.max(RHO_MAX + 0.7, r);
  }
  // reaches, alternating around the figure; [z_start, height, plan angle deg, reach mm, r_start, r_end]
  const ARMS = args.legs === 3
    ? [[0.40 * H, 0.185 * H, 25.0, 26.0, 7.6, 4.8],
       [0.58 * H, 0.185 * H, 170.0, 22.0, 7.2, 4.6],
       [0.76 * H, 0.185 * H, 295.0, 28.0, 7.8, 5.0]]
    : [[0.40 * H, 0.115 * H, 28.0, 38.0, 7.5, 4.6],
       [0.55 * H, 0.115 * H, 168.0, 34.0, 7.0, 4.4],
       [0.68 * H, 0.115 * H, 300.0, 40.0, 7.5, 4.6],
       [0.79 * H, 0.100 * H, 95.0, 30.0, 6.5, 4.4]];

  const leg_r = (z, i) => 8.6 + 1.3 * libmSin(2 * Math.PI * 3.0 * z / H + i * 2.1);   // ((2*pi*3.0)*z)/H + i*2.1

  /** [[x, y, r]] — the solid discs whose union is the body at this height */
  function parts_at(z){
    const [cx, cy] = core_xy(z); const out = [];
    const rmin = RHO_at(z) + 0.4;
    if(args.legs === 3){
      if(z < Z_M1){                                        // three separate legs
        for(let i = 0; i < 2; i++){ const f = FEET[i]; const p = lerp(f, PAIR, sm(z / Z_M1)); out.push([p[0], p[1], leg_r(z, i)]); }
        const p = lerp(FEET[2], core_xy(Z_M2), sm(z / Z_M2)); out.push([p[0], p[1], leg_r(z, 2)]);
      } else if(z < Z_M2){                                 // the front pair is one limb; the bracer still apart
        const f = sm((z - Z_M1) / (Z_M2 - Z_M1));
        const rp = 0.5 * (leg_r(z, 0) + leg_r(z, 1)) + 2.2 * f;
        const p = lerp(PAIR, [cx, cy], f); out.push([p[0], p[1], rp]);
        const p2 = lerp(FEET[2], core_xy(Z_M2), sm(z / Z_M2)); out.push([p2[0], p2[1], leg_r(z, 2)]);
      }
    } else {
      if(z < Z_M1){
        for(let i = 0; i < FEET.length; i++){ const p = lerp(FEET[i], [cx, cy], sm(z / Z_M1)); out.push([p[0], p[1], leg_r(z, i)]); }
      }
    }
    if(z >= Z_M2 * 0.86){                                  // the core
      let rrr = core_r(z);
      if(z > Z_HEAD){
        // the head closes all the way to the top layer, starting where the core actually is
        const r0 = core_r(Z_HEAD);
        rrr = r0 + ((rmin + 0.12) - r0) * sm((z - Z_HEAD) / (H - Z_HEAD));
      }
      // ...and it GROWS out of the merging legs rather than appearing
      if(z < Z_M2) rrr = rmin + (rrr - rmin) * sm((z - Z_M2 * 0.86) / (Z_M2 * 0.14));
      if(rrr > rmin) out.push([cx, cy, rrr]);
    }
    for(const [z0, dz, ang, reach, ra, rb] of ARMS){       // the reaches: out, hold, and back in
      if(z0 <= z && z < z0 + dz){
        const u = (z - z0) / dz;
        const f = sm(Math.min(1.0, u / 0.40)) * (1.0 - sm(Math.max(0.0, (u - 0.55) / 0.45)));
        const L = reach * f; const a = pyRadians(ang);
        const fade = sm(Math.min(1.0, f / 0.22));
        const rtip = Math.max(rb, rmin);
        const nseg = Math.max(4, Math.ceil(L / Math.max(2.0, 0.5 * rtip)));
        for(let k_ = 1; k_ <= nseg; k_++){
          const t = k_ / nseg;
          const r = (ra + (rb - ra) * f * t) * (1.0 + 0.45 * libmPow(1.0 - t, 1.4)) * fade;   // (1.0-t)**1.4 is C pow()
          out.push([cx + L * t * libmCos(a), cy + L * t * libmSin(a), Math.max(r, rmin)]);
        }
      }
    }
    return out.filter(p => p[2] >= rmin - 1e-9);         // clamped TO rmin still counts: > rmin deleted it
  }

  /** what the body is doing here -> grammar + tab length + a name (the rhythm bands) */
  function phase_at(z){
    for(let i = 0; i < ARMS.length; i++){
      const [z0, dz] = ARMS[i];
      if(z0 <= z && z < z0 + dz){
        const u = (z - z0) / dz;
        if(u < 0.40) return ['diagonal', 1.4, `reach${i + 1}`];   // going out
        if(u < 0.55) return ['perp', 0.8, `grip${i + 1}`];        // holding
        return ['eight', 1.2, `pull${i + 1}`];                    // knit stitch while pulling in
      }
    }
    if(z > Z_HEAD) return ['sine', 1.2, 'head'];
    if(z < Z_M1) return ['staple', 1.0, 'legs'];
    if(z < Z_M2) return ['eight', 1.2, 'hips'];            // loop stitch where the legs come together
    const band = pyIntMod((z - Z_M2) / (0.08 * H), 3);    // int(...) % 3
    return [['staple', 1.0, 'core-run'], ['sine', 1.2, 'core-wave'], ['eight', 1.2, 'core-knit']][band];
  }

  const g = runDiscBodyEngine({
    args, C, parts_at, phase_at,
    process: 'single-layer-inward-spiral/climber-v1',
    head: (N) => ({ N, H, legs: args.legs }),
    rasterLine: (nx, ny, lim, N) => `raster ${nx}x${ny} px, half-extent ${pyFormatFixed(lim, 1)} mm, ${N} layers, legs=${args.legs}`,
    log: opts.log,
  });
  g.args = args;
  return g;
}

/** json.dump(payload) — the geometry file's exact text, for a result of generateClimber. */
export function toJson(g){ return g.toJson(); }

/* ---------------- CLI ---------------- */
function main(argv){
  let args;
  try { args = parseArgs(argv); }
  catch(e){ console.error(`usage: weft_climber_geometry.mjs [--legs {2,3}] [--H H] [--lh LH] [--e E] [--bead BEAD] [--w0 W0] [--w1 W1] [--K K] [--res RES] [--foundation FOUNDATION] [--rib RIB] [--maxbridge MAXBRIDGE] [--plate PLATE PLATE] [--out OUT] [--allow-fail]\nerror: ${e.message}`); process.exit(2); }
  const g = generateClimber(args, { log: (s) => console.error(s) });
  cliFinish(fs, args, g);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
