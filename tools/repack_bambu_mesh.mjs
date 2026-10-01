/* Repack a shipped Bambu container with the honest display mesh (2026-10-01).

   For specimens whose G-code is already built, gated and trusted: re-run only the packaging
   step so the container shows the body it carries (core/weft_bambu_mesh.mjs), with the payload
   proven byte-identical by md5 against the old container. Nothing about the print changes.

   node tools/repack_bambu_mesh.mjs SPECIMEN_DIR NAME --machine ID [--geometry FILE]
     reads  SPECIMEN_DIR/NAME.gcode  and NAME_*geometry.json, repacks NAME.gcode.3mf in place,
     re-runs the package gate and rewrites NAME_package_gate.json. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadMachines, packBambu3mf, runGate, zipRead, WEFT_ROOT } from '../core/weft_build.mjs';

const [dir, name] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
if(!dir || !name){ console.error('usage: node tools/repack_bambu_mesh.mjs SPECIMEN_DIR NAME --machine ID'); process.exit(2); }
const outDir = path.resolve(dir);
const m = loadMachines()[opt('machine', 'a1')]; if(!m) { console.error('unknown machine'); process.exit(2); }
if(m.route !== 'bambu3mf'){ console.error('machine route is not bambu3mf'); process.exit(2); }

const gcodePath = path.join(outDir, `${name}.gcode`);
const geoPath = opt('geometry') ? path.resolve(opt('geometry'))
  : fs.readdirSync(outDir).filter(f => f.startsWith(name + '_') && f.endsWith('geometry.json')).map(f => path.join(outDir, f))[0];
if(!geoPath || !fs.existsSync(geoPath)){ console.error('no geometry json found for ' + name); process.exit(2); }
const three = path.join(outDir, `${name}.gcode.3mf`);
const oldMd5 = fs.existsSync(three) ? zipRead(fs.readFileSync(three)).find(e => e.name === 'Metadata/plate_1.gcode.md5')?.data.toString() : null;

const geometry = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
const tpl = path.join(WEFT_ROOT, m.containerTemplate);
const pk = packBambu3mf(fs.readFileSync(gcodePath, 'utf8'), tpl, three, { name:`${name}.stl`, layerHeight:m.lh, plate:m.plate, geometry });
console.log(`3MF   ${three}  ${pk.layers} layers, ${pk.grams} g, md5 ${pk.md5}, ${(pk.bytes / 1e6).toFixed(1)} MB`);
console.log(`PAYLOAD ${oldMd5 ? (oldMd5 === pk.md5 ? 'byte-identical to the previous container (md5 match)' : `CHANGED: was ${oldMd5}`) : 'no previous container'}`);

const gate = runGate(three, { bead:m.bead, file:three });
fs.writeFileSync(path.join(outDir, `${name}_package_gate.json`), JSON.stringify(gate, null, 1));
if(!gate.PASS){ fs.unlinkSync(three); console.error(`package gate refused (${gate.problem_count} problems) — package deleted`); process.exit(1); }
console.log(`GATE  package re-read from the container: passed (${gate.stats.checked_points} points)`);
