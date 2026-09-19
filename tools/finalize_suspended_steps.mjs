// Freeze a delivery only after full-file gates, exhaustive zones, mesh/envelope and roof checks exist.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const input=path.resolve(process.argv[2]),dir=path.dirname(input),G=JSON.parse(fs.readFileSync(input,'utf8')),S=G.summary;
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const testsDir=path.resolve(dir,'../2026-09-19_RAZMAK_A2L_H4_experimental'),testStatus=JSON.parse(fs.readFileSync(path.join(testsDir,'TEST_STATUS.json'),'utf8')),testLog=fs.readFileSync(path.join(testsDir,'npm-test-after.log'),'utf8');
if(Date.parse(testStatus.finished)<fs.statSync(path.join(testsDir,'npm-test-after.log')).mtimeMs||testStatus.exit!==1||!testLog.includes('49/61 passed')||!testLog.includes('PASS first-layer regression:')||!testLog.includes('all browser gate checks passed'))throw Error('complete current regression run required; historical 49/61 is the recorded baseline');
const A=read('FINAL_AUDIT.json'),T=read('THREAD_AUDIT.json'),R=read('ROOF_COVERAGE.json'),gate=read(S.name+'_gate.json'),full=read(S.name+'_gate_at_16.2mm_full.json'),manifest=read('manifest.json'),mesh=read('STL_AUDIT.json');
const bamboo=S.machine==='a2l',pkg=bamboo?read(S.name+'_package_gate.json'):null;
if(!A.PASS||!R.PASS||!gate.PASS||gate.problem_count||full.outsideDeclaredZones||full.findings!==full.gate.problems.length||!A.exhaustive||(bamboo&&(!pkg.PASS||!A.packaged)))throw Error('incomplete or failing final validation');
if(!A.firstLayer?.PASS||!gate.firstLayer?.PASS||(bamboo&&!A.packaged.firstLayer?.PASS))throw Error('missing first-layer validation');
if(fs.existsSync(path.join(dir,'DELIVERY_MANIFEST.json')))throw Error('delivery receipt already frozen; write a new version instead');
const print=manifest.shipped.find(n=>n.endsWith(bamboo?'.gcode.3mf':'.gcode'));
const dims=A.boundingBox_mm.max.map((v,i)=>+(v-A.boundingBox_mm.min[i]).toFixed(2));
const wallRows=S.walls.map(w=>`| ${w.tier} | ${w.kind==='square'?'Rounded square':w.kind==='circle'?'Ellipse':'Rounded hexagon'} | ${w.z0}–${w.z1} | ${w.angles.join(' → ')}° | ${w.web}; ${w.cycle.join(' / ')} |`).join('\n');
const terraceRows=S.terraces.map(t=>`| ${t.name} | ${t.z0}–${t.z1} | ${t.k0+1}–${t.k1+1} | ${t.cells} | ${full.byZone[t.name]||0} |`).join('\n');
const readme=`# ${S.title} · ${bamboo?'Bambu A2L / four levels':'Ender / seven levels'}

Two purposes: a distinct stepped sculpture and an aggressive horizontal-WEFT experiment. **Generated and digitally checked; NOT PRINTED.** [Current outcome](outcomes.md) · [Predictions and observations](PREDICTIONS.md) · [Rebuild protocol](PROTOCOL.md).

![Nominal emitted paths](${S.name}_preview.png)

## Files

- **Print with the preserved WEFT order:** [${print}](${print}). ${bamboo?'The companion plain G-code is also included. The packed container was re-read and gated.':'This is the machine-profile G-code with its existing harvested start/end sequence.'}
- [Interactive offline review](preview.html): rotate, front/roof views and a height slider. Walls are sampled every eighth layer for visibility; the STL and printer file contain all layers. Colours identify regions in the preview, not filament changes.
- [STL reference](${S.name}_reference.stl): ${(mesh.bytes/1e6).toFixed(1)} MB, all emitted bead ribbons. Re-slicing this reference changes the WEFT deposition order; the supplied G-code is the ordered experiment.
- [Editable geometry](${S.name}_geometry.json) and compressed copy; [final audit](FINAL_AUDIT.json), [complete evidenced-ceiling report](${S.name}_gate_at_16.2mm_full.json), [delivery hashes](DELIVERY_MANIFEST.json).

## Dimensions and process

Nominal deposited envelope **${dims.join(' × ')} mm**; allowed envelope ${S.boundingContract.allowed_mm.join(' × ')} mm. Bed-edge clearance is at least ${Math.min(A.margins_mm.left,A.margins_mm.right,A.margins_mm.front,A.margins_mm.back).toFixed(2)} mm; clearance above the object is ${A.margins_mm.above.toFixed(2)} mm. The STL mitered corners also remain inside the 15 mm margin. Model clearance excludes the printer's preparation and parking movements.

${A.layers} Z levels at ${S.args.lh} mm. Nozzle profile 0.4 mm; nominal bead ${S.args.bead} mm, first-layer bead ${S.args.firstLayerBead} mm; ${S.args.temp} °C / bed ${S.args.bed} °C. ${bamboo?'The A2L bead has prior completion evidence; that is not a new caliper measurement.':'The Ender bead remains ASSUMED, explicitly acknowledged in this build.'}

Only the basal perimeter frame touches the bed. The ${S.terraces.length} annular terraces hold a fixed footprint for twelve layers each, shift the return pattern by a quarter-cell between layers, and carry each subsequent wall. They project both inward and outward, without bed-founded interior tubes. There are ${S.levels} wall levels; the closed roof is the final horizontal surface.

| Wall | Plan | Z extent, mm | Rotation | Texture and repeating layer roles |
|---|---|---|---|---|
${wallRows}

| Terrace | Nominal bottom–top, mm | Print layer numbers (one-based) | Return cells/layer | All findings at 16.2 mm |
|---|---|---|---|---|
${terraceRows}

The roof alternates X/Y grids through pitches 10, 5, 2.5 and 1.2 mm, then two dense crossed layers at ${S.roof.pitches.at(-1)} mm pitch. A seven-layer raised ${S.roof.patternLobes}-lobed growing wave finishes it. [Roof view](${S.name}_roof.png). The coverage audit sampled ${R.samples.toLocaleString('en-US')} interior points at 0.2 mm spacing and found ${R.uncovered} uncovered points at nominal bead width. This is a digital coverage check, not a watertightness or physical-print claim.

Object-only estimates from extruding moves: ${A.objectFilament_m} m of 1.75 mm filament, approximately ${A.objectEstimatedMass_g} g at assumed density 1.26 g/cm³. Kinematic time is **at least ${A.objectKinematicTime_h} h**, without acceleration, heating, waits or firmware macros; it is not the machine's completion-time prediction. Total deposited path length is ${T.report.threadLength_m} m and must not be confused with filament feed length.

## Validation and limits

First-layer audit: **${A.firstLayer.segments} actual model extrusion segments at Z${A.firstLayer.firstModelZ.toFixed(2)} mm**, with the first preview deposition at the same height. Startup/purge is marked as preparation/wipe without changing printer commands. [Correction and command identity](FIRST_LAYER_REPAIR.json). ${bamboo?'The same shared export guard applies to this Bambu file and its container.':'The old Ender file that was open in the slicer is superseded; load the distinctly named FIRST_LAYER_FIXED file above.'} Native slicer UI was not operated during verification.

Final G-code gate: PASS, ${gate.problem_count} problems, ${gate.stats.checked_points.toLocaleString('en-US')} checked points. Declared ceiling 180 mm, cantilever limit 4.8 mm, ordinary support tolerance 0.6 mm. ${bamboo?'The packed G-code was independently re-read and passed the same gate. Its thumbnails identify this model. The slicer-owned end-Z formula was restored from the archived container: model top + 0.4 = 310.24 mm.':'The existing Ender footer retains its relative 5 mm lift and END_PRINT call; firmware macro internals are not simulated.'}

The **complete** 16.2 mm check records ${full.findings} findings, all inside explicitly declared narrow terrace/roof zones; zero outside. These are admitted experiments beyond prior evidence, not proven printable spans. Every finding is retained and reviewed; the final file's identity is checked in FINAL_AUDIT. Independent declared, evidenced and package passes use the existing WEFT gate in separate workers; files remain PENDING until all required checks pass.

Wall, terrace and art overlap findings: zero. The raw thread report also records ${A.sameLayerOverlapReading.denseCrownFill} contacts in the final two dense roof layers; these are intentional adjacent fill overlaps and remain visible in the report. No gate exemptions were added to hide them. Geometric crossings do not establish weld quality. A returning free-tip loop can pass the bridge classification while remaining a mechanical cantilever challenge.

Honest verdict: machine-profile dimensions, emitted planar layers, hollow basal support, nominal roof coverage, overlap locations, final support gates and artifact identities were checked. Counterweight benefit, tension, thermal behaviour, sag, strength and physical completion remain unmeasured. No printer upload or print was initiated.
`;
fs.writeFileSync(path.join(dir,'README.md'),readme);
const rel=path.relative(path.resolve(dir,'../..'),dir).replaceAll('\\','/');
fs.writeFileSync(path.join(dir,'PROTOCOL.md'),`# ${S.name} — reproducible build\n\nRun from the WEFT repository. Uses installed Node and the existing WEFT core; no added dependencies. Preview rendering uses the already-installed Playwright and local Three.js.\n\n`+[
 '```powershell',
 `node core/weft_suspended_steps_geometry.mjs --machine ${S.machine}${bamboo?'':' --allow-assumed-bead'} --out ${rel}/${S.name}_geometry.json`,
 `node tools/inspect_suspended_steps.mjs ${rel}/${S.name}_geometry.json`,
 `node tools/preview_suspended_steps.mjs ${rel}/preview-paths.json`,
 `node tools/build_suspended_steps.mjs ${rel}/${S.name}_geometry.json${bamboo?'':' --i-know-the-bead-is-a-guess'}`,
 `node tools/export_suspended_steps_stl.mjs ${rel}/${S.name}_geometry.json`,
 `node tools/audit_suspended_roof.mjs ${rel}/${S.name}_geometry.json`,
 `node tools/audit_suspended_steps.mjs ${rel}/${S.name}_geometry.json`,
 'npm test',
 '```',
 '',
 'Use a new output folder for any later revision; do not overwrite a frozen delivery receipt. `probe_suspended_steps.mjs` is a non-printing local diagnostic and cannot substitute for full-height final G-code checks. Preserve reported dense-roof overlap contacts. The 180 mm ceiling is an explicit experiment admission; every complete 16.2 mm finding must remain within a declared zone.',
 '',
 'Regression state: new crossing, end-Z, streamed-STL and exhaustive-report checks are in `npm test`. The historical legacy suite was already 49/61 before this work; see the saved post-change test log. Python parity requires an unavailable Python/numpy/scipy environment and is reported as skipped, not passed.',
 '',
 'Physical recording: follow PREDICTIONS.md. Keep the exact print filename/hash, settings and time history, photograph the terrace before/after each new wall, preserve a failure or interruption, and update outcomes.md plus the project specimen ledger when evidence arrives.',
 '',
 'Honest verdict: this protocol reproduces digital artifacts. It neither launches a printer nor claims a successful physical specimen.'
 ].join('\n'));
if(!fs.existsSync(path.join(dir,'outcomes.md')))fs.writeFileSync(path.join(dir,'outcomes.md'),`# ${S.name} — current outcome\n\n**NOT PRINTED / EXPERIMENTAL.** Digital design, final-file checks and predictions prepared 2026-09-19. No printer upload, physical specimen or measured sag exists for this new model in this record.\n\nPrior X2 photographs motivate this test but are not photographs of this geometry. [Prediction record](PREDICTIONS.md) · [Delivery](README.md).\n\nWhen printed, record the exact executed file/hash, machine and settings, completion or interruption, observed first-deformation height, calibrated before/after views, underside, material and any measured mass. Keep hypotheses separate from observations.\n\nHonest verdict: digital evidence only; physical response unknown.\n`);
fs.writeFileSync(input+'.gz',zlib.gzipSync(fs.readFileSync(input),{level:9}));
const files=fs.readdirSync(dir).filter(n=>!(/UNVERIFIED|REJECTED|\.log$|^PROBE_REPORT|^outcomes|^preview-paths|^DELIVERY/.test(n))).filter(n=>!n.includes('.gcode')||manifest.shipped.includes(n)).filter(n=>fs.statSync(path.join(dir,n)).isFile());
const hashes={};for(const n of files){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(path.join(dir,n)))h.update(b);hashes[n]={sha256:h.digest('hex'),bytes:fs.statSync(path.join(dir,n)).size};}
const sources={};for(const f of ['core/weft_suspended_steps_geometry.mjs','core/weft_cube_geometry.mjs','core/weft_build.mjs','core/weft_core.js','core/weft_gate.js','machines.json','tools/build_suspended_steps.mjs','tools/gate_file_worker.mjs','tools/resume_suspended_steps.mjs','tools/repair_suspended_first_layer.mjs','tools/audit_suspended_steps.mjs','tests/first_layer.test.mjs','tests/browser_gate.test.mjs'])sources[f]=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(dir,'../..',f))).digest('hex');
const receipt={schema:'weft-horizontal-pair-delivery/v1',name:S.name,built:new Date().toISOString(),status:'NOT PRINTED / EXPERIMENTAL',seed:null,seedReason:'Deterministic analytic geometry; no stochastic jitter.',machine:manifest.machine,nominalEnvelope_mm:dims,bedClearance_mm:A.margins_mm,printFile:print,gate:{declared:{PASS:gate.PASS,problems:gate.problem_count,maxbridge_mm:180},evidenced:{ceiling_mm:16.2,findings:full.findings,byZone:full.byZone,outside:0},package:bamboo?{PASS:pkg.PASS,problems:pkg.problem_count}:null},files:hashes,sourceFilesSha256:sources,mutableDecisionSurface:'outcomes.md (intentionally outside this immutable hash receipt)'};
fs.writeFileSync(path.join(dir,'DELIVERY_MANIFEST.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({name:S.name,files:files.length,print,dims,fullFindings:full.findings}));
