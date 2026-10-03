/* Every shipped file names its printer (2026-10-03). A1 build sent to an A2L was refused by Bambu Studio
   because nothing on the file said which machine it was for. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = await import('node:fs').then(fs => fs.readFileSync(path.join(ROOT, 'weft.mjs'), 'utf8'));
const m = src.match(/export function printerTag\(name, machineId\)\{[\s\S]*?\n\}/);
assert.ok(m, 'weft.mjs no longer defines printerTag');
const printerTag = new Function(`${m[0].replace('export ', '')}; return printerTag;`)();
assert.equal(printerTag('STOLICA', 'a2l'), 'STOLICA_A2L');
assert.equal(printerTag('SOKOL', 'a1'), 'SOKOL_A1');
assert.equal(printerTag('PUN_DRVO', 'ender'), 'PUN_DRVO_ENDER');
assert.equal(printerTag('STOLICA_A2L', 'a2l'), 'STOLICA_A2L');
assert.equal(printerTag('P2b_penjac_3_A2L', 'a2l'), 'P2b_penjac_3_A2L');
assert.equal(printerTag('GORA_ENDER3V4_X1', 'ender'), 'GORA_ENDER3V4_X1');
assert.equal(printerTag('limit16_a2l', 'a2l'), 'limit16_a2l');
assert.ok(/name = printerTag\(name, machineId\);/.test(src), 'the build path does not apply printerTag');
const r = spawnSync(process.execPath, ['--check', path.join(ROOT, 'weft.mjs')], { encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr);
console.log('printer_tag OK');
