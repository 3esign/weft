#!/usr/bin/env node
/* tests/vase_geom_parity.test.mjs — the JavaScript port of vase_geometry.py reproduces the Python.
 *
 *   node tests/vase_geom_parity.test.mjs [--tol 0.02] [--dir DIR] [--no-golden] [--quick] [--no-sensitivity] [--only NAME]
 *
 * The same protocol as tests/climber_geom_parity.test.mjs (which exports it): for each run — the
 * printed specimen's command (V1_vrtlog_ender: --turns 0.72 --H 130 on the Ender's ASSUMED bead
 * 0.42 / 0.20, as `weft.py build vase --machine ender --H 130 --turns 0.72` invokes it), the same vessel
 * at the 0.9 twist the README names as the limit the gate found, a taller vessel on the A2L numbers
 * with every design flag off its default (K, w0, w1, maxbridge, foundation, rib, res), and a 10 mm
 * vessel the script REFUSES — vase_geometry.py is run NOW and core/weft_vase_geometry.mjs with the
 * same flags, and the two are compared byte for byte (geometry file / .rejected file, stdout, stderr),
 * through tests/geom_compare.mjs, and number for number through the tree walk, with the first
 * differing number localised to the Python line (vase_geometry.py carries the shared engine 62 lines
 * above climber_geometry.py). With the specimen golden present
 * (specimens/2026-09-03_V1_vrtlog_ender_physical, gzipped) the port is compared with it, expecting
 * exactly the documented drift of the script since the build (the caps' span_mm fix and the added
 * membrane-contract keys). The specimen run also measures the sensitivity to a one-ulp change of 3% of
 * the sin / cos / atan2 / acos results.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateVase } from '../core/weft_vase_geometry.mjs';
import { runParity } from './climber_geom_parity.test.mjs';

export const RUNS = [
  { tag: 'V1 Vrtlog, Ender (the printed specimen)', name: 'V1_ender', specimen: true,
    flags: ['--bead', '0.42', '--lh', '0.2', '--plate', '220', '220', '--turns', '0.72', '--H', '130'],
    args: { bead: 0.42, lh: 0.2, plate: [220, 220], turns: 0.72, H: 130 },
    golden: 'specimens/2026-09-03_V1_vrtlog_ender_physical/V1_vrtlog_ender_geometry.json.gz' },
  { tag: 'V1 at the 0.9 twist', name: 'V1_twist09', extra: true,
    flags: ['--bead', '0.42', '--lh', '0.2', '--plate', '220', '220', '--turns', '0.9', '--H', '130'],
    args: { bead: 0.42, lh: 0.2, plate: [220, 220], turns: 0.9, H: 130 } },
  { tag: 'taller vessel on the A2L numbers, every design flag off its default', name: 'a2l_custom', extra: true,
    flags: ['--bead', '0.45', '--lh', '0.24', '--plate', '256', '256', '--turns', '0.6', '--H', '150', '--K', '12', '--w0', '2.0', '--w1', '7.0', '--maxbridge', '11', '--foundation', '6', '--rib', '2.2', '--res', '0.3'],
    args: { bead: 0.45, lh: 0.24, plate: [256, 256], turns: 0.6, H: 150, K: 12, w0: 2.0, w1: 7.0, maxbridge: 11, foundation: 6, rib: 2.2, res: 0.3 } },
  { tag: 'a 10 mm vessel (refused)', name: 'refused10', extra: true, refused: true,
    flags: ['--bead', '0.42', '--lh', '0.2', '--plate', '220', '220', '--turns', '0.72', '--H', '10'],
    args: { bead: 0.42, lh: 0.2, plate: [220, 220], turns: 0.72, H: 10 } },
];

function main(){
  const failed = runParity({ script: 'vase_geometry.py', generate: generateVase, prefix: 'vase', lineOffset: 62 }, RUNS, process.argv.slice(2));
  process.exit(failed ? 1 : 0);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
