#!/usr/bin/env node
/* Run the layered gate (S2–S8) over a G-code file. Development runner; the CLI is `node weft.mjs layers`.
   usage: node tools/gate_layers_run.mjs FILE.gcode --bead 0.45 [--zones zones.json] [--json out.json] [--per-layer] */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(HERE, '..', 'core', 'weft_gate.js')).href);
await import(pathToFileURL(path.join(HERE, '..', 'core', 'weft_gate_layers.js')).href);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const file = argv[0];
const o = { bead:+opt('bead', 0.45), allow:+opt('allow', 0.6), res:+opt('res', 0.2), step:+opt('step', 0.5), file, perLayer:argv.includes('--per-layer'), crossingsEvery:+opt('crossings-every', 1) };
if(opt('zones')) o.zones = JSON.parse(fs.readFileSync(opt('zones'), 'utf8'));
if(opt('s5fail')) o.S5fail = +opt('s5fail');
if(opt('s7carried')) o.S7carried = +opt('s7carried');
const text = fs.readFileSync(file, 'utf8');
const r = globalThis.WEFT_GATE_LAYERS.analyse(text, o);
if(opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(r, null, 1));
const { perLayer, findings, ...head } = r;
console.log(JSON.stringify(head, null, 1));
console.log(`findings: ${r.finding_count}`);
for(const f of findings.slice(0, +opt('show', 12))) console.log('  ', JSON.stringify(f));
