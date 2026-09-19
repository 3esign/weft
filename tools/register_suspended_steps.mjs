// Link the frozen file-only pair into the existing project/paper record; preserve historical rows.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),PI=path.resolve(root,'..');
const names=['RAZMAK_A2L_H4','OBRTAJ_ENDER_H7'],date='2026-09-19';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),write=(f,s)=>fs.writeFileSync(f,s),append=(f,s)=>fs.appendFileSync(f,'\n'+s+'\n');
const rows=names.map(name=>{const folder=`weft/specimens/${date}_${name}_experimental`,dir=path.join(PI,folder),D=read(path.join(dir,'DELIVERY_MANIFEST.json')),A=read(path.join(dir,'FINAL_AUDIT.json')),G=read(path.join(dir,name+'_geometry.json')),T=read(path.join(dir,'THREAD_AUDIT.json'));return {name,folder,dir,D,A,G,T};});
const ledgerPath=path.join(PI,'evidence/SPECIMEN_LEDGER.json'),ledger=read(ledgerPath),list=ledger.rows;
if(!Array.isArray(list))throw Error('ledger rows schema changed');
if(rows.some(r=>list.some(e=>e.id===r.name)))throw Error('pair already registered; update deliberately instead of duplicating');
for(const r of rows)list.push({id:r.name,name:r.G.summary.title+' — suspended horizontal stepped sculpture',date_built:r.D.built,date_printed:null,machine:r.D.machine.label,route:r.D.machine.route==='bambu3mf'?'B (G-code / packed .gcode.3mf)':'B (G-code)',generator:'core/weft_suspended_steps_geometry.mjs via tools/build_suspended_steps.mjs',dimensions_mm:r.D.nominalEnvelope_mm.join(' x ')+' (nominal; not physical measurement)',layers:`${r.A.layers} Z levels at ${r.D.machine.lh} mm`,thread_m:r.T.report.threadLength_m,mass_g:`${r.A.objectEstimatedMass_g} g estimated object-only, assumed density; not weighed`,grammars:r.T.report.grammarCounts,caps:'crown-woven-grid-art/v1; dense crossed closure and raised wave',gate:`PASS at 180 mm; ${r.D.gate.evidenced.findings} complete findings at 16.2 mm, all in declared terrace/roof zones`,outcome:'NOT PRINTED / EXPERIMENTAL. Digital geometry, final G-code and predictions only. No measured sag or counterweight benefit.',photos:0,photo_path:null,folder:r.folder,evidence:'FILE ONLY',sources:[r.folder+'/DELIVERY_MANIFEST.json',r.folder+'/FINAL_AUDIT.json',r.folder+'/PREDICTIONS.md',r.folder+'/outcomes.md'],provenance:{gcode_sha256:r.A.sha256,printed_file_hash_verified:false,physical_measurements:null,source_code_hashes:r.D.sourceFilesSha256}});
ledger.updated+=(ledger.updated?'; ':'')+'2026-09-19: RAZMAK H4 and OBRTAJ H7 added as FILE ONLY, complete final gates with exhaustive zone review, no new physical claim.';
write(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
append(path.join(PI,'evidence/SPECIMEN_LEDGER.md'),`## 2026-09-19 later addendum — suspended horizontal pair (FILE ONLY)

The earlier A2L X2 pending label above is superseded by Semir's completion report and five photographs; the JSON ledger and X2 outcomes contain that current physical record. These two new models are different objects and have **not** been printed.

| Specimen | Nominal envelope, mm | Z levels | Deposited path, m | Evidenced-ceiling findings | Physical evidence |
|---|---|---|---|---|---|
${rows.map(r=>`| [${r.name}](../${r.folder}/README.md) | ${r.D.nominalEnvelope_mm.join(' × ')} | ${r.A.layers} | ${r.T.report.threadLength_m} | ${r.D.gate.evidenced.findings}; zero outside declared zones | FILE ONLY |`).join('\n')}

All numbers in this addendum come from the linked delivery and final-audit receipts. Dimensions and mass estimates are not measurements of printed objects. [Pair dossier](../paper/03_experiments/2026-09-19_zigurat_horizontal_weft/NEW_MODELS.md).`);
const dossier=path.join(PI,'paper/03_experiments/2026-09-19_zigurat_horizontal_weft');
const modelSections=rows.map(r=>`## ${r.G.summary.title}

![Nominal ${r.G.summary.title} toolpaths](../../../${r.folder}/${r.name}_preview.png)

${r.name.startsWith('RAZMAK')?'Four displaced levels, a wide first suspended platform and a four-lobed crown drawing. The experiment concentrates on long horizontal returns and off-centre upper walls.':'Seven revolving levels alternating rounded square, hexagonal and elliptical plans, with a seven-lobed crown drawing. The experiment concentrates on repeated load transfers and accumulated deformation.'}

Nominal envelope ${r.D.nominalEnvelope_mm.join(' × ')} mm. All bed edges retain at least 15 mm clearance; ${r.A.margins_mm.above.toFixed(2)} mm remains above the object. Only the first perimeter frame touches the bed. Every terrace keeps a horizontal, fixed footprint through its thickness. The top closes with dense crossed fill before the raised drawing.

[Print file](../../../${r.folder}/${r.D.printFile}) · [Interactive review](../../../${r.folder}/preview.html) · [Full specimen record](../../../${r.folder}/README.md) · [Predictions](../../../${r.folder}/PREDICTIONS.md) · [Roof drawing](../../../${r.folder}/${r.name}_roof.png).

Final gate PASS; ${r.D.gate.evidenced.findings} exhaustive 16.2 mm findings, zero outside declared zones. ${r.name.startsWith('RAZMAK')?'The final Bambu package was independently re-read and gated.':'The Ender bead remains the profile’s assumed 0.42 mm.'} Object-only estimate ${r.A.objectEstimatedMass_g} g; kinematic time at least ${r.A.objectKinematicTime_h} h, excluding acceleration, heating and macros. These are not measured outcomes.`).join('\n\n');
write(path.join(dossier,'NEW_MODELS.md'),`# RAZMAK / OBRTAJ — new horizontal-WEFT pair

Internal experiment record · ${date} · **FILE ONLY / NOT PRINTED**. This is the design continuation of the recovered X2 photographs, not an additional physical result for the paper.

Semir's brief: two distinct stepped sculptures using the maximum machine envelopes with 15 mm margins, one with 3–4 levels and one with 6–7; freely vary plan, twist, overhang and texture, while preserving horizontal terraces, one basal support frame, a closed roof and an artistic top pattern.

${modelSections}

## What this generation taught before printing

1. A half-cell shift did not produce interior terrace crossings; a quarter-cell shift does. Independent crossing tests now cover all nine terraces. Nominal intersections remain untested physical contacts.
2. Inner-edge spacing controls how many rounded returns fit. A count derived only from the larger supporting perimeter produced local collisions.
3. Consecutive sine/diagonal web layers in selected rotating walls produced long unsupported runs. Extra chord layers corrected those specific walls without expanding the terrace/roof experiment zones. Rejected drafts are preserved under each specimen's iterations folder.
4. A display list of 400 findings was insufficient for zone verification: the complete draft review found 1,017 unapproved wall findings in RAZMAK and 81 in OBRTAJ. The final files use exhaustive reporting and have zero out-of-zone findings.
5. A harvested Bambu footer still contained the old model's Z140.28. The original owned 3MF supplied its actual formula, max_layer_z + 0.4; the new footer uses Z310.24, preserving the rest of the machine sequence.
6. Semir's Ender preview exposed a purge at Z0.30 displayed as layer 1 before the real base at Z0.20. Shared startup preparation markers and a final-byte first-layer refusal now apply to Node/browser exports, support gates and Bambu packaging (G-667). Printer commands are unchanged. [First-layer incident and source evidence](FIRST_LAYER_FIX.md) · [Actual first-layer drawings](first-layer-paths.html). Native slicer UI was not operated.

## Use in the WEFT paper

This episode adds a traceable proposal → digital refusal → local revision → recheck sequence, plus predictions for the next physical experiment. It does not yet demonstrate sag reduction, prestress, strength, counterweight benefit or successful horizontal deposition at these spans. The two different geometries/machines are separate exploratory challenges; a later causal comparison should hold geometry and settings fixed and change one routing variable.

Observe each terrace before the next wall, after that wall and at completion; keep side views with a scale and identify directions. Record initial strand behaviour separately from settling under later layers. Preserve the underside, interruptions and exact executed file hash. Detailed per-terrace predictions are in the specimen folders.

Honest verdict: prior photographs inform the question; final geometry, files, complete digital gates and roof coverage are checked. No new print, mechanical measurement or physical evidence is supplied by this pair. The addendum is internal source material and has not undergone the independent manuscript review required by EVIDENCE_RAILS.md.
`);
write(path.join(dossier,'NEW_MODELS_INDEX.json'),JSON.stringify(rows.map(r=>({name:r.name,folder:r.folder,print:r.D.printFile,status:r.D.status,delivery:r.folder+'/DELIVERY_MANIFEST.json',gcode_sha256:r.A.sha256,physical_measurements:null})),null,2));
append(path.join(dossier,'README.md'),'## Later 2026-09-19 update — the two new models\n\n[RAZMAK / OBRTAJ: designs, print files, predictions and digital results](NEW_MODELS.md) now continue this dossier. Both are FILE ONLY / NOT PRINTED. The earlier sections above retain the state before these designs were made.');
const session='2026-09-19-session-04-horizontal-pair.md';
write(path.join(PI,'journal/sessions',session),`# ${date} — RAZMAK / OBRTAJ

## Goal
Implement Semir's two unique full-envelope stepped sculptures for A2L and Ender: 15 mm margins, horizontal terraces, only one basal frame, different plan/twist/texture rhythms, four and seven levels, closed patterned roofs.

## Done
New analytic generator reuses the WEFT wall engine. Final artifacts, full-resolution reference STL, offline path viewer and three views per model are in the canonical specimen folders. Per-terrace predictions and observation plans accompany both. Both final G-code gates pass at the declared ceiling, all complete 16.2 mm findings fall inside narrow terrace/roof zones, and the A2L package is re-read and gated. Final-byte hashes and machine/code provenance are frozen in DELIVERY_MANIFEST. The independent audit checks deposited margins, planar extrusion layers, mesh corners, end Z and package thumbnails/MD5. Roof interior coverage has zero uncovered sample points at nominal bead width.

## Decided and learned
Quarter-cell phase creates crossings; half-cell phase did not (G-664). Inner-edge spacing bounds rounded return count. Locally insert chords between problematic moving-wall webs. Restore the archived slicer's own end-Z formula for the tall A2L object (G-665). Validate all findings, not the legacy 400-row display prefix (G-666). Rejected unprinted drafts remain under iterations/01_pre_wall_rhythm_review. The bounded pair builder runs independent original gate passes concurrently and keeps candidate suffixes until all checks and hash comparisons pass.

## Where we left off / Next
Files are prepared for experimental printing; none was uploaded or started. Photograph before/after each upper wall, record direction and scale, preserve failures and underside views, and bind the physical result to the executed file hash. Follow predictions and update outcomes/ledger. Further sag-reduction tests should vary one routing choice at fixed geometry/settings.

## Honest verdict
Digital checks and file identities are verified. Ender bead remains assumed; A2L completion evidence is not caliper calibration. Nominal crossings and a covered roof are not mechanical proof. No new physical print, measured sag, tension or strength. npm test retains the prior 49/61 legacy result; new regressions, Node/core/package/browser parity pass; nine Python parity suites are skipped because python3 with numpy/scipy is unavailable. The saved test log is in the RAZMAK specimen. The paper addendum is an internal draft.
`);
append(path.join(PI,'journal/README.md'),`[${date} — two suspended horizontal sculptures](sessions/${session}).`);
const statePath=path.join(PI,'STATE.md'),state=fs.readFileSync(statePath,'utf8');
write(statePath,state.replace('\n',`\n\n## ${date} — RAZMAK H4 i OBRTAJ H7 pripremljeni\n\nDva nova eksperimentalna modela, samo bazni okvir na bedu, horizontalne terase i zatvoreni vrhovi sa reljefnim crtežom. Finalne putanje, pune provere i predikcije: [pregled para](paper/03_experiments/2026-09-19_zigurat_horizontal_weft/NEW_MODELS.md). Margine od 15 mm proverene i na putanjama i na STL uglovima. Oba su FILE ONLY / NOT PRINTED; nema novog fizičkog rezultata. [Zapis sesije](journal/sessions/${session}).\n`));
append(path.join(root,'PROJECT_STATE.md'),`## ${date} — suspended horizontal pair\n\ncore/weft_suspended_steps_geometry.mjs adds RAZMAK A2L H4 and OBRTAJ Ender H7 with one basal frame, fixed-footprint crossed terraces and closed patterned roofs. Bounded builder tools/build_suspended_steps.mjs reuses existing emission and gates, validates all findings and candidate hashes, then publishes files. tools/finalize_suspended_steps.mjs freezes delivery receipts. New crossing/end-Z/STL-stream/full-report regressions are part of npm test. Existing default outputs remain parity-checked; legacy suite remains 49/61. See specimen READMEs and PI journal session-04 for physical limits. No print initiated.`);
append(path.join(root,'USAGE.md'),`## ${date} — large horizontal-WEFT pair\n\nNew generator: core/weft_suspended_steps_geometry.mjs (--machine a2l or ender, --out FILE; Ender also --allow-assumed-bead). The specimen PROTOCOL.md files contain complete commands. tools/build_suspended_steps.mjs consumes the geometry, restores the original A2L footer expression, installs an actual-model preview, and checks final G-code/package bytes in independent workers before releasing PENDING files. Ender requires --i-know-the-bead-is-a-guess.\n\nThe general weft.mjs builder also supports --thumb PATH and --end-z-from-template for harvested Bambu containers. Experimental-zone checking now requests allProblems and refuses a truncated list. Default gate display remains capped for historical report parity; classification is unchanged. Never interpret an admitted experimental bridge ceiling as physical evidence.`);
append(path.join(PI,'LOG.md'),`${new Date().toISOString()} | Svemir | Final horizontal pair registered: RAZMAK H4 and OBRTAJ H7, full final-byte gates and exhaustive zone checks, STL/envelope/roof audits, immutable delivery hashes, predictions and internal paper continuation. Both FILE ONLY, no upload/print. Legacy 49/61 unchanged; new regressions pass.`);
console.log(JSON.stringify({registered:names,dossier:path.join(dossier,'NEW_MODELS.md'),session}));
