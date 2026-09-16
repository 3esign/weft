/* tests for core/weft_machine_wizard.mjs — `node tests/machine_wizard.test.mjs`, assert-based, no deps.

   What is held here:
     1. the real LIMIT16 A2L package: Bambu, nozzle 0.4, layer 0.24, plate from the config, and the start
        block equal to the harvested / template blocks modulo the header statistics and WEFT's own three
        builder comments (explained inline);
     2. the synthetic PrusaSlicer, Cura and OrcaSlicer fixtures under tests/fixtures/wizard/ (values with
        their source keys, the cut rule, the end-block filtering, the {TEMP}/{BED} templating);
     3. exports/ender_start.gcode as an unknown-flavor plain file (comes back whole, purge kept);
     4. refusals: an STL (binary and ascii), a project 3MF without G-code, text with no G-code;
     5. the CLI: writes exactly its three files, never machines.json;
     6. determinism: the same input twice gives the same JSON. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSlicerExport, profileFromExport, stripHeaderStatistics, templateStartBlock, WizardRefusal } from '../core/weft_machine_wizard.mjs';
import { zipWrite } from '../core/weft_build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'tests', 'fixtures', 'wizard');
const read = f => fs.readFileSync(path.join(ROOT, f));
const text = f => read(f).toString('utf8');
const sha = b => createHash('sha256').update(b).digest('hex');
const noTrail = s => s.replace(/\n+$/, '');
const lineDiff = (a, b) => { const A = a.split('\n'), B = b.split('\n'), out = []; for(let i = 0; i < Math.max(A.length, B.length); i++) if(A[i] !== B[i]) out.push([i + 1, A[i], B[i]]); return out; };

let passed = 0;
function test(name, fn){ try{ fn(); passed++; console.log(`ok   ${name}`); }catch(e){ console.log(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; } }
const provenanceIsComplete = entry => {
  for(const [field, p] of Object.entries(entry.v2.provenance)){
    assert.ok(['slicer-export', 'assumed', 'caller'].includes(p.source), `${field}: source ${p.source}`);
    assert.equal(p.file, entry.v2.source.file, `${field}: file`);
    assert.equal(p.sha256, entry.v2.source.sha256, `${field}: sha256`);
    assert.ok('value' in p && 'key' in p, `${field}: value/key`);
    if(p.source === 'slicer-export') assert.ok(p.key, `${field}: a slicer-export value must name its key`);
  }
};

/* ============================================================== 1. the real LIMIT16 Bambu package */
const L16 = 'specimens/2026-09-04_LIMIT16_A2L_physical/PRINT_LIMIT16_A2L_v1.gcode.3mf';
const l16 = parseSlicerExport(read(L16), { filename:L16 });
const l16entry = profileFromExport(l16, { id:'a2l_wizard', label:'Bambu Lab A2L (wizard)', outDir:'exports' });

test('LIMIT16: detected as a Bambu Studio 3MF, hash equals the manifest', () => {
  assert.equal(l16.flavor, 'bambu'); assert.equal(l16.slicer, 'BambuStudio'); assert.equal(l16.version, '02.07.01.62');
  assert.equal(l16.container.gcodeMember, 'Metadata/plate_1.gcode');
  const manifest = JSON.parse(text('specimens/2026-09-04_LIMIT16_A2L_physical/manifest.json'));
  assert.equal(l16.source.sha256.toUpperCase(), manifest.sha256['PRINT_LIMIT16_A2L_v1.gcode.3mf']);
});
test('LIMIT16: nozzle 0.4, layer 0.24, plate 330x320 and maxZ 325 from the CONFIG_BLOCK, each with its key', () => {
  const V = l16.values;
  assert.deepEqual([V.nozzle.value, V.nozzle.key], [0.4, 'config:nozzle_diameter']);
  assert.deepEqual([V.layerHeight.value, V.layerHeight.key], [0.24, 'config:layer_height']);
  assert.deepEqual([V.plate.value, V.plate.key], [[330, 320], 'config:printable_area']);
  assert.deepEqual([V.maxZ.value, V.maxZ.key], [325, 'config:printable_height']);
  assert.deepEqual([V.temp.value, V.temp.key], [220, 'config:nozzle_temperature']);
  assert.deepEqual([V.bed.value, V.bed.key, V.bedType.value], [55, 'config:textured_plate_temp', 'Textured PEI Plate']);
  assert.deepEqual([V.firstLayerHeight.value, V.lineWidth.value, V.firstLayerLineWidth.value], [0.2, 0.42, 0.5]);
  assert.deepEqual([V.filamentDiameter.value, V.retractLength.value, V.retractSpeed.value, V.zHop.value, V.firstLayerSpeed.value], [1.75, 0.8, 30, 0.4, 50]);
  assert.deepEqual([V.fanMin.value, V.fanMax.value, V.gcodeFlavor.value, V.printerModel.value], [60, 80, 'marlin', 'Bambu Lab A2L']);
});
test('LIMIT16: the entry has the machines.json shape, matches the a2l entry where the a2l entry is measured-independent', () => {
  const a2l = JSON.parse(text('machines.json')).a2l;
  for(const k of ['plate', 'maxZ', 'nozzle', 'lh', 'temp', 'bed', 'route']) assert.deepEqual(l16entry[k], a2l[k], k);
  assert.equal(l16entry.beadSource, 'ASSUMED');
  assert.match(l16entry.beadEvidence, /NEVER CALIBRATED/);
  assert.match(l16entry.beadEvidence, /C1 coupon/);
  assert.equal(l16entry.v2.schema, 'weft.machine.v2');
  assert.equal(l16entry.v2.bead.source, 'assumed');
  assert.equal(l16entry.v2.provenance.bead.source, 'assumed');
  assert.equal(l16entry.v2.provenance.bead.key, 'config:line_width');      // where the starting number came from, still assumed
  assert.equal(l16entry.containerTemplate, L16);
  assert.deepEqual(Object.keys(l16entry).slice(0, 15), ['label', 'plate', 'maxZ', 'nozzle', 'bead', 'beadSource', 'beadEvidence', 'lh', 'firstLayerBead', 'temp', 'bed', 'start', 'end', 'route', 'containerTemplate']);
  assert.equal(l16entry.start, 'exports/a2l_wizard_start.gcode');
  provenanceIsComplete(l16entry);
});
test('LIMIT16: start block == harvested A2L block, modulo header statistics and WEFT\'s three builder comments', () => {
  /* The cut lands on `; CHANGE_LAYER` (line 945) exactly where the 2026-09-02 harvest cut. Two differences
     remain and both are expected: the HEADER_BLOCK statistics belong to the print (45m vs 1d 1h, 40 vs 583
     layers) and are blanked before comparing; and the LIMIT16 package is WEFT-built, so the builder wrote
     a blank line and three comment lines of its own (`; WEFT first layer…`, `; WEFT adhesion…`,
     `; Slicer Route A…`) between the head and its first layer marker — a raw slicer export has none. */
  assert.equal(l16.blocks.startCut.line, 945);
  assert.equal(l16.blocks.layerMarker, '; CHANGE_LAYER');
  const harvested = noTrail(text('exports/a2l_start_block_harvested_2026-09-02.gcode'));
  const diff = lineDiff(stripHeaderStatistics(l16.blocks.start), stripHeaderStatistics(harvested));
  assert.deepEqual(diff.map(d => [d[0], d[2]]), [[941, undefined], [942, undefined], [943, undefined], [944, undefined]], JSON.stringify(diff));
  assert.deepEqual(diff.map(d => d[1].split(':')[0]), ['', '; WEFT first layer', '; WEFT adhesion', '; Slicer Route A']);
  assert.equal(harvested.split('\n').length, 940);
  assert.equal(l16.blocks.start.split('\n')[939], 'M981 S1 P20000 ;open spaghetti detector');   // the harvest's last line, at the same place
  assert.equal(l16.blocks.startCut.purgeExtrusionsKept, 0);   // the nozzle load line is `G130 … E20`, not a G1
});
test('LIMIT16: templated start block == the 2026-09-02 template (S220 -> S{TEMP}, S55 -> S{BED}, preheats untouched)', () => {
  const tpl = noTrail(text('exports/a2l_start_block_template_2026-09-02.gcode'));
  const diff = lineDiff(stripHeaderStatistics(l16entry.v2.start.contents), stripHeaderStatistics(tpl));
  assert.deepEqual(diff.map(d => d[0]), [941, 942, 943, 944]);                 // the same four WEFT-builder lines as above
  assert.deepEqual(l16entry.v2.provenance.start.templated, { TEMP:5, BED:4 });
  assert.match(l16entry.v2.start.contents, /\n  M104 S140 A\n/);            // preheat stays literal
  assert.match(l16entry.v2.start.contents, /\n  G150 T220\n/);              // not an M104/M109 line: untouched
  assert.doesNotMatch(l16entry.v2.start.contents, /M1[049]\d? S(220|55)\b/);
});
test('LIMIT16: end block == the harvested A2L end block (after the last extruding move, EXECUTABLE_BLOCK_END dropped)', () => {
  assert.equal(l16.blocks.lastExtrudeLine, 44147);
  assert.equal(l16.blocks.end, noTrail(text('exports/a2l_end_block_harvested_2026-09-02.gcode')));
  assert.equal(l16entry.v2.end.contents, l16.blocks.end);
  assert.doesNotMatch(l16.blocks.end, /EXECUTABLE_BLOCK_END/);
});

/* ============================================================== 2a. PrusaSlicer */
const PR = 'tests/fixtures/wizard/prusa_mk4_synthetic.gcode';
const pr = parseSlicerExport(text(PR), { filename:PR });
const prEntry = profileFromExport(pr, { id:'mk4', outDir:'out' });
test('PrusaSlicer: signature, version, values with their config keys', () => {
  assert.deepEqual([pr.flavor, pr.slicer, pr.version], ['prusa', 'PrusaSlicer', '2.8.1+win64']);
  const V = pr.values;
  assert.deepEqual([V.nozzle.value, V.nozzle.key], [0.4, 'prusaslicer_config:nozzle_diameter']);
  assert.deepEqual([V.layerHeight.value, V.firstLayerHeight.value], [0.2, 0.2]);
  assert.deepEqual([V.lineWidth.value, V.lineWidth.key], [0.45, 'header:external perimeters extrusion width']);
  assert.deepEqual([V.firstLayerLineWidth.value, V.firstLayerLineWidth.key], [0.5, 'header:first layer extrusion width']);
  assert.deepEqual([V.temp.value, V.firstLayerTemp.value, V.bed.value, V.firstLayerBed.value], [210, 215, 60, 60]);
  assert.deepEqual([V.plate.value, V.plate.key, V.maxZ.value], [[250, 210], 'prusaslicer_config:bed_shape', 220]);
  assert.deepEqual([V.retractLength.value, V.retractSpeed.value, V.zHop.value, V.zHop.key], [0.7, 35, 0.2, 'prusaslicer_config:retract_lift']);
  assert.deepEqual([V.firstLayerSpeed.value, V.fanMin.value, V.fanMax.value, V.fanOffFirstLayers.value], [20, 100, 100, 1]);
  assert.deepEqual([V.gcodeFlavor.value, V.printerModel.value], ['marlin2', 'MK4IS']);
  assert.equal(prEntry.label, 'MK4IS');                                   // no --label: printer_model, and provenance says so
  assert.equal(prEntry.v2.provenance.label.key, 'prusaslicer_config:printer_model');
  assert.deepEqual([prEntry.temp, prEntry.bed, prEntry.route], [210, 60, 'gcode']);
  provenanceIsComplete(prEntry);
});
test('PrusaSlicer: start block cut at ;LAYER_CHANGE, intro line kept; end block after the last extrusion, wipe/stats/config dropped', () => {
  assert.equal(pr.blocks.layerMarker, ';LAYER_CHANGE');
  assert.equal(pr.blocks.startCut.purgeExtrusionsKept, 2);                // G1 X20 E5 / G1 X50 E10
  const S = pr.blocks.start.split('\n');
  assert.equal(S[S.length - 1], 'M107');
  assert.ok(S.includes('G1 X50 E10 F1000'));
  assert.ok(!pr.blocks.start.includes(';LAYER_CHANGE'));
  const E = pr.blocks.end.split('\n');
  assert.equal(E[0], 'G1 E-.5 F2100');                                    // the retract after the wipe stays
  assert.equal(E[E.length - 1], 'M73 P100 R0');
  for(const bad of [';WIPE', ';TYPE:', '; filament used', '; estimated', 'prusaslicer_config', 'objects_info', ';LAYER_CHANGE', 'G1 X112 Y100 E-.2'])
    assert.ok(!pr.blocks.end.includes(bad), `end block still has ${bad}`);
  assert.ok(pr.blocks.end.includes('M84 X Y E ; disable motors'));
});
test('PrusaSlicer: {TEMP}/{BED} templating touches exactly the target temperatures', () => {
  const T = prEntry.v2.start.contents;
  assert.deepEqual(prEntry.v2.provenance.start.templated, { TEMP:2, BED:2 });
  assert.ok(T.includes('M104 S{TEMP} ; set extruder temp') && T.includes('M109 S{TEMP} ; wait for extruder temp'));
  assert.ok(T.includes('M140 S{BED} ; set bed temp') && T.includes('M190 S{BED} ; wait for bed temp'));
  assert.ok(T.includes('M104 S170 ; set extruder temp for bed leveling'));   // 170 is not a target temperature
  assert.ok(T.includes('M109 R170 ; wait for temp'));
  assert.equal(prEntry.v2.start.harvested, pr.blocks.start);
  assert.deepEqual(prEntry.v2.files, { 'mk4_start.gcode':T, 'mk4_end.gcode':pr.blocks.end });
});

/* ============================================================== 2b. Cura */
const CU = 'tests/fixtures/wizard/cura_ender3_synthetic.gcode';
const cu = parseSlicerExport(read(CU), { filename:CU });
const cuEntry = profileFromExport(cu, { id:'ender3_cura', label:'Ender-3 via Cura', outDir:'out' });
test('Cura: signature, ;SETTING_3 JSON fragments, header keys, and honest gaps', () => {
  assert.deepEqual([cu.flavor, cu.slicer, cu.version], ['cura', 'Cura', '5.8.1']);
  const V = cu.values;
  assert.deepEqual([V.layerHeight.value, V.layerHeight.key], [0.2, 'SETTING_3:values:layer_height']);
  assert.deepEqual([V.temp.value, V.temp.key], [200, 'SETTING_3:values:material_print_temperature']);
  assert.deepEqual([V.firstLayerTemp.value, V.firstLayerBed.value], [205, 60]);
  assert.deepEqual([V.bed.value, V.bed.key], [60, 'M140 S (start G-code line)']);      // not in SETTING_3: read off the start block
  assert.deepEqual([V.lineWidth.value, V.firstLayerLineWidth.value], [0.42, 0.504]);
  assert.deepEqual([V.retractLength.value, V.retractSpeed.value, V.zHop.value], [5, 45, 0]);
  assert.deepEqual([V.gcodeFlavor.value, V.gcodeFlavor.key], ['Marlin', 'header:FLAVOR']);
  assert.deepEqual([V.printerModel.value, V.printerModel.key], ['Creality Ender-3', 'header:TARGET_MACHINE.NAME']);
  assert.equal(V.nozzle, undefined);                                       // Cura does not write it unless changed
  assert.equal(V.plate, undefined);
  const P = cuEntry.v2.provenance;
  assert.deepEqual([P.nozzle.source, P.nozzle.value, P.plate.source, P.maxZ.source, P.lh.source, P.temp.source, P.bed.source], ['assumed', 0.4, 'assumed', 'assumed', 'slicer-export', 'slicer-export', 'slicer-export']);
  assert.ok(cuEntry.v2.needsReview.includes('nozzle') && cuEntry.v2.needsReview.includes('plate') && cuEntry.v2.needsReview.includes('bead'));
  assert.ok(cu.warnings.some(w => /SETTING_3 carries only/.test(w)));
  assert.equal(cuEntry.bead, 0.42); assert.equal(cuEntry.beadSource, 'ASSUMED'); assert.equal(cuEntry.firstLayerBead, 0.504);
  provenanceIsComplete(cuEntry);
});
test('Cura: cut at ;LAYER_COUNT, the two purge lines kept; end block without ;SETTING_3 / ;TIME_ELAPSED', () => {
  assert.equal(cu.blocks.layerMarker, ';LAYER_COUNT:3');
  assert.equal(cu.blocks.startCut.purgeExtrusionsKept, 2);
  const S = cu.blocks.start.split('\n');
  assert.equal(S[S.length - 1], 'G1 F2400 E-5');
  assert.ok(S.includes('G1 X0.4 Y20 Z0.3 F1500.0 E30 ; Draw the second line'));
  for(const bad of [';SETTING_3', ';TIME_ELAPSED', ';LAYER:', ';TYPE:', ';End of Gcode']) assert.ok(!cu.blocks.end.includes(bad), `end block still has ${bad}`);
  assert.ok(cu.blocks.end.includes('G1 X0 Y220 ;Present print') && cu.blocks.end.endsWith('M104 S0'));
  assert.deepEqual(cuEntry.v2.provenance.start.templated, { TEMP:2, BED:2 });
  assert.ok(cuEntry.v2.start.contents.includes('M190 S{BED}') && cuEntry.v2.start.contents.includes('M109 S{TEMP}'));
});

/* ============================================================== 2c. OrcaSlicer, plain and as a container */
const OR = 'tests/fixtures/wizard/orca_ender3v3ke_synthetic.gcode';
const or = parseSlicerExport(read(OR), { filename:OR });
const orEntry = profileFromExport(or, { id:'ke', label:'Ender-3 V3 KE', outDir:'out' });
test('OrcaSlicer plain .gcode: signature, bed temperature by curr_bed_type, Klipper macro templating, route gcode', () => {
  assert.deepEqual([or.flavor, or.slicer, or.version], ['orca', 'OrcaSlicer', '2.2.0']);
  const V = or.values;
  assert.deepEqual([V.nozzle.value, V.layerHeight.value, V.plate.value, V.maxZ.value], [0.4, 0.2, [220, 220], 240]);
  assert.deepEqual([V.temp.value, V.firstLayerTemp.value, V.bed.value, V.bed.key, V.firstLayerBed.value], [220, 225, 65, 'config:textured_plate_temp', 65]);
  assert.deepEqual([V.gcodeFlavor.value, V.printerModel.value, V.zHop.value], ['klipper', 'Creality Ender-3 V3 KE', 0.2]);
  assert.equal(or.blocks.layerMarker, '; CHANGE_LAYER');
  assert.ok(or.blocks.start.endsWith('; filament start gcode\nM106 P3 S0'));
  assert.ok(or.blocks.start.includes('; EXECUTABLE_BLOCK_START'));
  assert.ok(orEntry.v2.start.contents.includes('START_PRINT EXTRUDER_TEMP={TEMP} BED_TEMP={BED}'));
  assert.deepEqual(orEntry.v2.provenance.start.templated, { TEMP:1, BED:1 });
  const E = or.blocks.end.split('\n');
  assert.equal(E[0], 'G1 E-.76 F1800'); assert.equal(E[E.length - 1], 'M73 P100 R0');
  assert.ok(!or.blocks.end.includes('WIPE') && !or.blocks.end.includes('EXECUTABLE_BLOCK_END') && !or.blocks.end.includes('E-.04'));
  assert.equal(orEntry.route, 'gcode'); assert.equal(orEntry.containerTemplate, undefined);
  provenanceIsComplete(orEntry);
});
test('OrcaSlicer .gcode.3mf container: same values, route bambu3mf, container completeness reported', () => {
  const gc = read(OR);
  const full = zipWrite([{ name:'[Content_Types].xml', data:Buffer.from('<Types/>') }, { name:'Metadata/plate_1.gcode', data:gc }, { name:'Metadata/plate_1.json', data:Buffer.from('{}') }, { name:'Metadata/slice_info.config', data:Buffer.from('<config/>') }]);
  const p = parseSlicerExport(full, { filename:'ke.gcode.3mf' });
  assert.deepEqual([p.flavor, p.container.gcodeMember, p.values.nozzle.value, p.blocks.start], ['orca', 'Metadata/plate_1.gcode', 0.4, or.blocks.start]);
  assert.equal(p.container.gcodeSha256, sha(gc));
  const e = profileFromExport(p, { id:'ke3mf', outDir:'out' });
  assert.equal(e.route, 'bambu3mf'); assert.equal(e.containerTemplate, 'ke.gcode.3mf'); assert.ok(!e.v2.needsReview.includes('containerTemplate'));
  const bare = zipWrite([{ name:'Metadata/plate_1.gcode', data:gc }]);
  const e2 = profileFromExport(parseSlicerExport(bare, { filename:'bare.gcode.3mf' }), { id:'bare', outDir:'out' });
  assert.equal(e2.route, 'bambu3mf'); assert.ok(e2.v2.needsReview.includes('containerTemplate'));
});

/* ============================================================== 3. a Klipper start block with no signature */
test('exports/ender_start.gcode: unknown flavor, the whole file is the start block (purge kept), empty end block', () => {
  const f = 'exports/ender_start.gcode';
  const p = parseSlicerExport(read(f), { filename:f });
  assert.equal(p.flavor, 'unknown'); assert.equal(p.slicer, null);
  assert.equal(p.blocks.start, noTrail(text(f)));
  assert.equal(p.blocks.end, '');
  assert.equal(p.blocks.firstExtrudeLine, null);
  assert.equal(p.blocks.startCut.purgeExtrusionsKept, 2);                 // G1 X100 E10 / G1 X130 E2, closed by G92 E0
  assert.match(p.blocks.startCut.reason, /start block only/);
  assert.deepEqual(Object.keys(p.values), []);                              // S{TEMP} placeholders and M104 S0 are not temperatures
  const e = profileFromExport(p, { id:'ender_wiz', label:'Creality Ender-3 V4', outDir:'out' });
  for(const k of ['plate', 'maxZ', 'nozzle', 'lh', 'temp', 'bed', 'bead', 'firstLayerBead']) assert.equal(e.v2.provenance[k].source, 'assumed', k);
  assert.ok(e.v2.start.contents.includes('START_PRINT EXTRUDER_TEMP={TEMP} BED_TEMP={BED}'));   // existing placeholders survive
  assert.ok(e.v2.needsReview.some(s => s.startsWith('end (empty')));
  assert.equal(e.route, 'gcode');
  provenanceIsComplete(e);
});
test('a WEFT Route B file: unknown flavor, temperatures from the macro line, layer height from the Z steps, end block == exports/ender_end.gcode', () => {
  const f = 'specimens/2026-09-04_LIMIT16_ENDER3V4_physical/LIMIT16_ENDER3V4_v1_routeB.gcode';
  const p = parseSlicerExport(read(f), { filename:f });
  assert.equal(p.flavor, 'unknown');
  assert.deepEqual([p.values.temp.value, p.values.bed.value, p.values.layerHeight.value], [220, 60, 0.2]);
  assert.match(p.values.layerHeight.key, /^derived/);
  assert.equal(p.blocks.end, noTrail(text('exports/ender_end.gcode')));
});

/* ============================================================== 4. refusals */
test('refusals: STL (binary fixture, ascii text, .stl name), project 3MF without G-code, text without G-code, empty', () => {
  const refuse = (input, filename, code, re) => { assert.throws(() => parseSlicerExport(input, { filename }), e => e instanceof WizardRefusal && e.code === code && re.test(e.message), `${filename}: expected ${code}`); };
  refuse(fs.readFileSync(path.join(FIX, 'not_gcode.stl')), 'not_gcode.stl', 'stl', /STL.*not a sliced file/);
  refuse(fs.readFileSync(path.join(FIX, 'not_gcode.stl')), 'renamed.gcode', 'stl', /binary STL \(1 triangles\)/);
  refuse('solid cube\n facet normal 0 0 1\n  outer loop\n   vertex 0 0 0\n  endloop\n endfacet\nendsolid cube\n', 'cube.txt', 'stl', /ascii STL/);
  refuse(zipWrite([{ name:'3D/3dmodel.model', data:Buffer.from('<model/>') }, { name:'[Content_Types].xml', data:Buffer.from('<Types/>') }]), 'project.3mf', 'no-gcode-member', /without a sliced G-code member/);
  refuse('just a note\nwith no commands\n', 'note.gcode', 'no-gcode', /no G-code commands/);
  refuse(Buffer.alloc(0), 'empty.gcode', 'empty', /empty/);
  refuse(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), 'image.png', 'binary', /not a text G-code file/);
  assert.throws(() => profileFromExport(pr, { id:'../evil', outDir:'out' }), e => e.code === 'bad-id');
});

/* ============================================================== 5. the CLI */
test('CLI: writes <id>_start.gcode, <id>_end.gcode, <id>.machine.json into --out and nothing else; machines.json untouched', () => {
  const before = sha(read('machines.json'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'weft-wizard-'));
  const run = spawnSync(process.execPath, [path.join(ROOT, 'core', 'weft_machine_wizard.mjs'), path.join(ROOT, PR), '--id', 'mk4', '--label', 'Prusa MK4 (wizard)', '--out', tmp], { cwd:ROOT, encoding:'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(fs.readdirSync(tmp).sort(), ['mk4.machine.json', 'mk4_end.gcode', 'mk4_start.gcode']);
  assert.equal(fs.readFileSync(path.join(tmp, 'mk4_start.gcode'), 'utf8'), prEntry.v2.start.contents);
  assert.equal(fs.readFileSync(path.join(tmp, 'mk4_end.gcode'), 'utf8'), pr.blocks.end);
  const j = JSON.parse(fs.readFileSync(path.join(tmp, 'mk4.machine.json'), 'utf8'));
  assert.deepEqual(Object.keys(j), ['mk4']);
  assert.equal(j.mk4.label, 'Prusa MK4 (wizard)'); assert.equal(j.mk4.beadSource, 'ASSUMED'); assert.equal(j.mk4.v2.provenance.nozzle.key, 'prusaslicer_config:nozzle_diameter');
  assert.equal(j.mk4.v2.start.sha256, sha(Buffer.from(prEntry.v2.start.contents)));
  assert.equal(j.mk4.v2.files, undefined);                                 // the blocks are files, not three JSON copies
  assert.match(run.stdout, /bead\s+0\.45\s+assumed\s+header:external perimeters extrusion width/);
  assert.match(run.stdout, /The bead is ASSUMED/);
  assert.match(run.stdout, /templated \{TEMP\}×2 \{BED\}×2/);
  assert.equal(sha(read('machines.json')), before);
  const bad = spawnSync(process.execPath, [path.join(ROOT, 'core', 'weft_machine_wizard.mjs'), path.join(FIX, 'not_gcode.stl'), '--id', 'x', '--out', tmp], { cwd:ROOT, encoding:'utf8' });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /REFUSED \(stl\)/);
  assert.equal(spawnSync(process.execPath, [path.join(ROOT, 'core', 'weft_machine_wizard.mjs')], { cwd:ROOT, encoding:'utf8' }).status, 2);
  fs.rmSync(tmp, { recursive:true, force:true });
});

/* ============================================================== 6. determinism and the templating helper */
test('determinism: parsing the same bytes twice gives identical JSON; templateStartBlock is exact', () => {
  const a = JSON.stringify(parseSlicerExport(read(L16), { filename:L16 })), b = JSON.stringify(parseSlicerExport(read(L16), { filename:L16 }));
  assert.equal(a, b);
  assert.equal(JSON.stringify(profileFromExport(pr, { id:'mk4', outDir:'out' })), JSON.stringify(prEntry));
  const t = templateStartBlock('M104 S215 ; a\nM109 S215\nM140 S60\nM190 S60\nM104 S170\nG150 T215\nM620.10 A0 F5 T240 P215 S1\nPRINT_START EXTRUDER=215 BED=60', [215], [60]);
  assert.equal(t.text, 'M104 S{TEMP} ; a\nM109 S{TEMP}\nM140 S{BED}\nM190 S{BED}\nM104 S170\nG150 T215\nM620.10 A0 F5 T240 P215 S1\nPRINT_START EXTRUDER={TEMP} BED={BED}');
  assert.deepEqual(t.replaced, { TEMP:3, BED:3 });
});

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`);
