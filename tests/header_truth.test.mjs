/* The first ten lines of a G-code file are what the printer shows the person standing in front of
   it: how long this will take, how much filament it will eat, how tall it gets. `fixHeader` exists
   to make those lines true, and on 2026-10-02 it was found doing nothing at all.

   The A1's start block is a Windows export, so every A1 build is CRLF. `fixHeader` split on '\n',
   which leaves a '\r' at the end of every line; its patterns end in `$` without the m flag, and `.`
   does not match '\r' — so all six substitutions missed. Nothing threw. The returned stats were
   correct and the build printed them. Three bodies shipped a plain .gcode whose header still
   belonged to the TEMPLATE it was harvested from: 167 layers, 7.20 g, max Z 40.04, for a 783-layer
   188 mm falcon.

   Two things are measured here, because the bug had two halves:
     1. fixHeader itself, on CRLF and on LF, and the line endings it gives back.
     2. that a missed field is REPORTED — `missed` was always returned and never read. */
import assert from 'node:assert/strict';
import { fixHeader } from '../core/weft_build.mjs';

/* a tiny print whose numbers can be worked out by hand: two layers, 10 mm of filament each */
const BODY = [
  '; HEADER_BLOCK_START',
  '; BambuStudio 02.07.01.62',
  '; model printing time: 1h 29m 1s; total estimated time: 1h 35m 16s',
  '; total layer number: 167',
  '; total filament length [mm] : 2376.66',
  '; total filament volume [cm^3] : 5716.53',
  '; total filament weight [g] : 7.20',
  '; filament_density: 1.26',
  '; filament_diameter: 1.75',
  '; max_z_height: 40.04',
  '; filament: 1',
  '; HEADER_BLOCK_END',
  'M83',
  '; CHANGE_LAYER',
  'G1 Z0.24 F600',
  'G1 X10 Y0 E10 F1200',
  '; CHANGE_LAYER',
  'G1 Z0.48 F600',
  'G1 X0 Y0 E10 F1200',
];
const AREA = Math.PI * (1.75 / 2) ** 2;
const WANT = { layers: 2, filament_mm: 20, maxZ: 0.48, grams: +(20 * AREA * 1.26 / 1000).toFixed(2) };

for(const [label, eol] of [['CRLF', '\r\n'], ['LF', '\n']]){
  const r = fixHeader(BODY.join(eol));

  /* the stats were never the broken half — they were right while the file was wrong */
  assert.equal(r.stats.layers, WANT.layers, `${label}: layer count`);
  assert.equal(r.stats.filament_mm, WANT.filament_mm, `${label}: filament`);
  assert.equal(r.stats.maxZ, WANT.maxZ, `${label}: max Z`);
  assert.equal(r.stats.grams, WANT.grams, `${label}: grams`);

  /* THE BUG: the text that comes back has to carry those numbers, not the template's */
  const out = r.text.split(/\r?\n/);
  const field = (k) => { const l = out.find(x => x.startsWith(`; ${k}`)); assert.ok(l, `${label}: ${k} vanished`);
    return l.slice(l.indexOf(':') + 1).trim(); };
  assert.equal(field('total layer number'), '2', `${label}: the header still claims the template's layer count`);
  assert.equal(field('total filament length [mm]'), '20.00', `${label}: the header still claims the template's filament`);
  assert.equal(field('total filament weight [g]'), WANT.grams.toFixed(2), `${label}: the header still claims the template's weight`);
  assert.equal(field('max_z_height'), '0.48', `${label}: the header still claims the template's height`);
  assert.ok(!/1h 29m 1s/.test(r.text), `${label}: the template's print time survived`);

  /* nothing silently skipped, and the line endings come back the way they went in */
  assert.deepEqual(r.missed, [], `${label}: ${r.missed.length} fields were never found`);
  assert.ok(r.text.includes(eol), `${label}: the line endings were rewritten`);
  if(eol === '\n') assert.ok(!r.text.includes('\r'), 'an LF file came back with CR in it');

  /* the body is untouched — a header fix may not move a single move */
  assert.equal(out.filter(l => l.startsWith('G1')).length, 4, `${label}: moves were lost`);
  console.log(`  ${label}: ${field('total layer number')} layers, ${field('total filament weight [g]')} g, max Z ${field('max_z_height')} — header matches the moves`);
}

/* MIXED, which is what an A1 build actually is: a harvested Windows start block on top of two and a
   half million lines this generator wrote with '\n'. The first fix for the bug above normalised the
   whole file to the ending it saw first and grew SOKOL.gcode by 2.76 MB — 2.7 million lines rewritten
   to repair six. A line that was not asked about keeps the ending it arrived with. */
{
  const head = BODY.slice(0, 12).join('\r\n');
  const body = BODY.slice(12).join('\n');
  const mixed = head + '\r\n' + body;
  const r = fixHeader(mixed);
  assert.deepEqual(r.missed, [], 'the mixed file missed fields');
  const out = r.text.split('\n');
  const field = (k) => { const l = out.find(x => x.startsWith(`; ${k}`)); return l.slice(l.indexOf(':') + 1).replace(/\r$/, '').trim(); };
  assert.equal(field('total layer number'), '2', 'mixed: the header was not fixed');
  /* the header keeps CRLF, the body keeps LF, and nothing else moved */
  assert.ok(out[3].endsWith('\r'), 'mixed: a CRLF header line came back as LF');
  assert.ok(!out[15].endsWith('\r'), 'mixed: an LF body line came back as CRLF');
  assert.equal(r.text.split('\r\n').length - 1, 12, `mixed: ${r.text.split('\r\n').length - 1} CRLF endings, should still be 12`);
  const grew = r.text.length - mixed.length;
  assert.ok(Math.abs(grew) < 400, `mixed: the file changed by ${grew} bytes — more than six header lines can explain`);
  console.log(`  mixed CRLF header + LF body: header fixed, 12 CRLF endings kept, file moved ${grew >= 0 ? '+' : ''}${grew} bytes`);
}

/* a header that genuinely lacks a field must say so rather than pretend */
{
  const thin = ['; HEADER_BLOCK_START', '; total layer number: 9', '; HEADER_BLOCK_END', 'M83', 'G1 X1 E1'].join('\r\n');
  const r = fixHeader(thin);
  assert.ok(r.missed.length >= 4, `a header with one field reported ${r.missed.length} missing`);
  assert.ok(r.text.includes('; total layer number: 1'), 'the one field it did have was not fixed');
  console.log(`  partial header: ${r.missed.length} fields reported missing, the one present was rewritten`);
}

console.log('header_truth: OK');
