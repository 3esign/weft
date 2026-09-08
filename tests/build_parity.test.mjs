/* WEFT build parity — the Node chain (core/weft_build.mjs) must reproduce a PRINTED specimen from its
   geometry file byte for byte: the same G-code the browser builder (make_suma.mjs + index.html) wrote
   on 2026-09-04 and fix_header.py rewrote, and the same Bambu container pack_bambu_3mf.py packed —
   the file that actually ran on the A2L (LIMIT16 A2L v1, SHA-256 in its manifest).

   No browser, no Python: if this passes, a PC with Node alone builds what the machine printed.
   usage: node tests/build_parity.test.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createWeftCore, layersFromGeometry, gcodeText, fixHeader, packBambu3mf, zipRead, runGate } from '../core/weft_build.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = path.join(ROOT, 'specimens', '2026-09-04_LIMIT16_A2L_physical');
let fails = 0; const say = (ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++; };
const sha = b => createHash('sha256').update(b).digest('hex');

const geoFile = path.join(SPEC, 'LIMIT16_A2L_v1_geometry.json'), refG = path.join(SPEC, 'LIMIT16_A2L_v1_routeB.gcode'), ref3 = path.join(SPEC, 'PRINT_LIMIT16_A2L_v1.gcode.3mf');
if (!fs.existsSync(geoFile) || !fs.existsSync(refG)) { say(false, 'LIMIT16 specimen files present', 'missing — this test needs the printed specimen folder'); process.exit(1); }
const geo = JSON.parse(fs.readFileSync(geoFile, 'utf8'));
const W = createWeftCore();
const t0 = Date.now();
const report = layersFromGeometry(W, geo, { machine: 'a2l', name: 'LIMIT16_A2L_v1' });
say(report.layers === 988 && report.weldNodes === 1036 && report.unintendedOverlaps === 0 && report.fitsPlate, 'thread rebuilt from the geometry file', `${report.layers} paths, ${report.weldNodes} welds, ${report.threadLength_m} m, ${Date.now() - t0} ms`);
const txt = await gcodeText(W, path.join(ROOT, 'exports/a2l_start_block_template_2026-09-02.gcode'), path.join(ROOT, 'exports/a2l_end_block_harvested_2026-09-02.gcode'));
const fixed = fixHeader(txt);
const ref = fs.readFileSync(refG, 'utf8');
say(fixed.text === ref, 'G-code byte-identical to the printed specimen (after the header rewrite)', `${fixed.text.length} bytes, sha256 ${sha(fixed.text).slice(0, 16)}`);
say(fixed.missed.length === 0, 'every header field rewritten', fixed.missed.join(', ') || 'none missed');
const gate = runGate(fixed.text, { bead: 0.45, maxbridge: 16.2, maxcantilever: 4.8, allow: 0.6, minanchor: 0.5, maxCapRadius: 20, maxislands: 1, file: refG });
say(gate.PASS && gate.stats.checked_points === 31016 && gate.stats.first_layer_islands === 1, 'gate verdict on the rebuilt file matches the recorded one', `PASS=${gate.PASS}, ${gate.problem_count} problems, ${gate.stats.checked_points} points`);
if (fs.existsSync(ref3)) {
  const tmp = path.join(os.tmpdir(), `weft_build_parity_${process.pid}.gcode.3mf`);
  packBambu3mf(fixed.text, ref3, tmp, { name: 'LIMIT16_A2L_v1.stl', layerHeight: 0.24 });
  const a = zipRead(fs.readFileSync(ref3)), b = zipRead(fs.readFileSync(tmp));
  let diff = 0; for (const e of a) { const m = b.find(x => x.name === e.name); if (!m || Buffer.compare(m.data, e.data) !== 0) { diff++; console.log('   differs:', e.name); } }
  say(diff === 0 && a.length === b.length, 'Bambu container: every member byte-identical to the printed package', `${a.length} members`);
  fs.unlinkSync(tmp);
} else say(true, 'Bambu container check skipped', 'printed .gcode.3mf not present');
console.log(fails ? `\n${fails} check(s) FAILED` : '\nall build parity checks passed');
process.exit(fails ? 1 : 0);
