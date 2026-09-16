#!/usr/bin/env node
/* WEFT — one command, no browser, no Python, no model.

    node weft.mjs machines
    node weft.mjs presets
    node weft.mjs build --preset D2_dome_lambda9 --machine a2l --out specimens/<folder> [--name NAME]
    node weft.mjs build --design my_params.json --machine a2l --out DIR          (the app's parameter vector)
    node weft.mjs build --geo LIMIT16_geometry.json --machine a2l --out DIR      (a level-2 geometry file)
    node weft.mjs build climber --machine a2l --H 240 --legs 3 --out DIR         (a level-2 model; needs Python for
                                                                                  the geometry generator ONLY)
    node weft.mjs check FILE.gcode|FILE.gcode.3mf --machine a2l [--maxbridge 16] [--json out.json]
    node weft.mjs serve [--port 8765]                                            (index.html with presets, offline)

   The chain is the one USAGE.md describes and every step still refuses:
     design/preset/geometry -> thread (core/weft_core.js) -> G-code with the machine's harvested
     start/end blocks -> the gate on the FINAL G-code (core/weft_gate.js) -> header rewritten from the
     file's own moves -> package (.gcode.3mf for Bambu, .gcode for Klipper) -> manifest.
   A build that fails the gate leaves nothing printable behind. Anything built on an ASSUMED bead needs
   --i-know-the-bead-is-a-guess and the manifest says so. `bead` and `lh` are never flags here: the
   machine owns them (machines.json).

   What still needs Python: the level-2 geometry generators (*_geometry.py: topology, weld columns,
   caps). Their OUTPUT is a JSON file this command consumes without Python, so a geometry made once
   (or on another computer) builds, gates and packages here. The old browser builders
   (make_suma.mjs / make_climber.mjs) and the Python gate remain as the reference implementations;
   tests/*parity* hold this command to them byte for byte. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWeftCore, layersFromGeometry, layersFromClimber, climberHardRefusals, writeStl, gcodeText, fixHeader,
         packBambu3mf, runGate, loadMachines, WEFT_ROOT } from './core/weft_build.mjs';
import { freshReportPath, validateMembraneGeometry, writeJsonAtomic } from './membrane_contract.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const die = (msg, code = 1) => { console.error(`\n  REFUSED: ${msg}\n`); process.exit(code); };
const MACHINES = loadMachines();

/* level-2 models: which Python generator and which strategy (the builder file it used to go through) */
/* Since 2026-09-16 every level-2 generator also exists in JavaScript (core/weft_<model>_geometry.mjs), a
   port held to the Python original byte for byte by tests/<model>_geom_parity.test.mjs. The JS twin is the
   default; --python runs the original (needs numpy/scipy/scikit-image). Same flags either way. */
const MODELS = {
  climber:   { geometry:'climber_geometry.py',          js:'core/weft_climber_geometry.mjs',   strategy:'climber', extra:['legs','H','K','w0','w1','foundation','rib','maxbridge'] },
  vase:      { geometry:'vase_geometry.py',             js:'core/weft_vase_geometry.mjs',      strategy:'climber', extra:['turns','H','K','w0','w1','foundation','rib','maxbridge'] },
  paired:    { geometry:'paired_sculpture_geometry.py', js:'core/weft_paired_geometry.mjs',    strategy:'climber', extra:['variant','turns','H','K','w0','w1','foundation','maxbridge'] },
  aero:      { geometry:'aero_tower_geometry.py',       js:'core/weft_aero_geometry.mjs',      strategy:'climber', extra:['variant','turns','H','K','w0','w1','foundation','maxbridge'] },
  sculpture: { geometry:'sculpture_geometry.py',        js:'core/weft_sculpture_geometry.mjs', strategy:'suma',    extra:['variant','turns','H','K','R','maxbridge','lintels','fins','fin-rate','relief'] },
  suma:      { geometry:'suma_geometry.py',             js:'core/weft_suma_geometry.mjs',      strategy:'suma',    extra:['cols','rows','H','K'] },
  plate:     { geometry:'plate_geometry.py',            js:'core/weft_plate_geometry.mjs',     strategy:'suma',    extra:[] },
  limit16:   { geometry:'limit16_geometry.py',          js:'core/weft_limit16_geometry.mjs',   strategy:'suma',    extra:[] },
};

function machineOrDie(id){
  if(!id) die('--machine is required; try: node weft.mjs machines');
  const m = MACHINES[id]; if(!m || id.startsWith('_')) die(`unknown machine ${JSON.stringify(id)}; try: node weft.mjs machines`);
  return m;
}
function beadWarning(m){
  if(m.beadSource === 'measured') return;
  console.log('\n' + '!'.repeat(78));
  console.log(`!  ${m.label}: bead ${m.bead} mm is ASSUMED, not measured.`);
  console.log(`!  ${m.beadEvidence}`);
  console.log('!  Everything below is derived from that number. Calibrate before you trust it.');
  console.log('!'.repeat(78));
  if(!flag('i-know-the-bead-is-a-guess')) die('pass --i-know-the-bead-is-a-guess to build anyway, or measure the bead first');
}

/* ---------------------------------------------------------------------------------------------- */
function cmdMachines(){
  for(const [mid, m] of Object.entries(MACHINES)){
    if(mid.startsWith('_')) continue;
    const warn = m.beadSource === 'measured' ? '' : '   <-- ASSUMED, not measured';
    console.log(`${mid.padEnd(8)} ${m.label.padEnd(24)} ${m.plate[0]}x${m.plate[1]}x${m.maxZ} mm   bead ${m.bead} / layer ${m.lh}${warn}`);
    console.log(`         ${m.beadEvidence}`);
  }
}
function loadPresets(){
  const f = path.join(WEFT_ROOT, 'presets', 'presets.json');
  if(!fs.existsSync(f)) return { presets:[] };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function cmdPresets(){
  const t = loadPresets();
  for(const p of t.presets || []){
    const m = p.measured || {};
    console.log(`${(p.file || p.name || '?').padEnd(46)} ${(p.params && p.params.mode) || ''}  ${m.layers != null ? m.layers + ' layers' : ''} ${m.welds != null ? m.welds + ' welds' : ''} ${m.size_mm ? m.size_mm.join('x') + ' mm' : ''}`);
    if(p.note) console.log(`   ${p.note}`);
  }
}

/* ---------------------------------------------------------------------------------------------- */
async function cmdBuild(){
  const model = argv[1] && !argv[1].startsWith('--') ? argv[1] : null;
  const machineId = opt('machine'); const m = machineOrDie(machineId);
  const outDir = path.resolve(opt('out') || die('--out is required'));
  const dry = flag('dry'), nostl = flag('nostl'), keep = flag('keep');
  const allowExperimentalMembrane = flag('allow-experimental-membrane');
  const allowExperimentalBridge = flag('allow-experimental-bridge');
  let maxIslands = +(opt('maxislands', 1));
  fs.mkdirSync(outDir, { recursive:true });
  beadWarning(m);

  /* 1. where does the geometry come from */
  let geo = null, geoFile = null, design = null, presetEntry = null, strategy = null;
  let name = opt('name');
  if(model){
    const mod = MODELS[model]; if(!mod) die(`unknown model ${JSON.stringify(model)}; known: ${Object.keys(MODELS).join(', ')} — or use --preset / --design / --geo`);
    name = name || `${model}_${machineId}`;
    geoFile = path.join(outDir, `${name}_geometry.json`);
    const usePython = flag('python') || !mod.js || !fs.existsSync(path.join(WEFT_ROOT, mod.js));
    const py = process.env.WEFT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    const exe = usePython ? py : process.execPath;
    const script = usePython ? mod.geometry : mod.js;
    const g = [path.join(WEFT_ROOT, script), '--bead', String(m.bead), '--lh', String(m.lh), '--plate', String(m.plate[0]), String(m.plate[1]), '--out', geoFile];
    for(const f of mod.extra){ const v = opt(f); if(v != null) g.push('--' + f, String(v)); }
    if(model === 'limit16' || model === 'plate'){ g.length = 0; g.push(path.join(WEFT_ROOT, script), '--machine', machineId, '--out', geoFile); if(m.beadSource !== 'measured') g.push('--allow-assumed-bead'); }
    console.log(`\n=== geometry (${usePython ? 'Python' : 'JavaScript'}: ${script}) ===\n$ ${usePython ? py : 'node'} ${g.join(' ')}`);
    const r = spawnSync(exe, g, { cwd:WEFT_ROOT, stdio:'inherit' });
    if(r.error) die(usePython ? `the geometry generator needs Python 3 with numpy/scipy/scikit-image (${r.error.message}). Make the geometry elsewhere and pass it with --geo.` : `the geometry generator could not start (${r.error.message})`);
    if(r.status !== 0) die(`geometry did not pass its own checks (exit ${r.status}). Nothing was written.`, r.status || 1);
    strategy = mod.strategy;
  } else if(opt('geo')){
    geoFile = path.resolve(opt('geo'));
    name = name || path.basename(geoFile).replace(/_geometry\.json$|\.json$/, '');
    strategy = opt('strategy', null);
  } else if(opt('preset')){
    const t = loadPresets(); const want = opt('preset');
    presetEntry = (t.presets || []).find(p => p.file === want || p.name === want || (p.file || '').replace(/\.(stl|gcode)$/, '') === want);
    if(!presetEntry) die(`no preset ${JSON.stringify(want)} in presets/presets.json; run: node weft.mjs presets`);
    design = Object.assign({}, presetEntry.params, { machine:machineId });
    name = name || want.replace(/\.(stl|gcode)$/, '');
  } else if(opt('design')){
    const d = JSON.parse(fs.readFileSync(path.resolve(opt('design')), 'utf8'));
    design = Object.assign({}, d.params || d, { machine:machineId });
    name = name || path.basename(opt('design')).replace(/\.json$/, '');
  } else die('say what to build: a model name, --preset NAME, --design params.json or --geo geometry.json');

  const W = createWeftCore();
  let report;
  if(design){
    /* the app's own parameter vector — a preset, or a JSON a person wrote. Machine numbers are not
       design parameters: bead and layer height come from machines.json, whatever the file says. */
    design.bead = m.bead; design.lh = m.lh;
    if(design.firstLayerBead == null) design.firstLayerBead = m.firstLayerBead;
    W.seed = 1337;
    const v = W.weftEvaluate(design);
    report = v;
    console.log(`\n=== design ===\n${name}: ${v.layers} layers · ${v.weldNodes} welds · ${v.threadLength_mm} mm · ${v.size_mm.join('×')} mm · valid=${v.valid}`);
    for(const e of v.errors) console.log('  ✗ ' + e);
    for(const w of v.warnings) console.log('  ! ' + w);
    if(v.rejected.length) for(const r of v.rejected) console.log(`  rejected ${r.key}=${JSON.stringify(r.value)}: ${r.why}`);
    if(!v.valid && !flag('allow-invalid-design')) die('the design is not valid; fix it, or pass --allow-invalid-design to let the gate be the judge');
    if(!v.layers) die('the design produced zero layers');
    /* a batch plate is grid² separate specimens by design; a single object is one piece */
    if(design.mode === 'batch' && opt('maxislands') == null) maxIslands = W.P.grid * W.P.grid;
  } else {
    geo = JSON.parse(fs.readFileSync(geoFile, 'utf8'));
    if(!strategy) strategy = (geo.summary && (geo.summary.wallWidth || geo.summary.supportCheck)) && !(geo.layers.some(l => l.paths || (l.contours || []).some(c => c.web != null))) ? 'climber' : 'suma';
    validateMembraneGeometry(geo, { rootDir:WEFT_ROOT, allowExperimental:allowExperimentalMembrane, machine:machineId });
    console.log(`\n=== thread (strategy ${strategy}) ===`);
    if(strategy === 'climber'){
      report = layersFromClimber(W, geo, { name, bx:m.plate[0], by:m.plate[1], machine:machineId, allowExperimental:allowExperimentalMembrane });
      const hard = climberHardRefusals(report);
      if(hard.length){ console.error('REFUSED — the weave did not pass:'); for(const h of hard) console.error('  * ' + h); process.exit(1); }
    } else {
      report = layersFromGeometry(W, geo, { name, machine:machineId, grammar:opt('web', 'staple'), tab:+opt('e', 1.0), allowExperimental:allowExperimentalMembrane });
      if(!report.fitsPlate) die(`${report.plate_mm.join(', ')} does not fit ${report.bed_mm.join(' × ')} mm with an 8 mm margin.`);
    }
    console.log(`${name}: ${report.layers} paths · ${report.weldNodes} welds · ${report.threadLength_m} m · ${report.size_mm.join('×')} mm · overlaps ${report.unintendedOverlaps}`);
  }
  if(dry){ console.log(JSON.stringify(report, null, 1)); return; }

  /* 2. STL (Route A) */
  if(!nostl){ const stl = path.join(outDir, `${name}.stl`); const bytes = await writeStl(W, stl); console.log(`STL   ${stl}  ${bytes} bytes`); }

  /* 3. G-code (Route B) with the machine's harvested blocks */
  const gc = path.join(outDir, `${name}.gcode`);
  const txt = await gcodeText(W, path.join(WEFT_ROOT, m.start), path.join(WEFT_ROOT, m.end));
  fs.writeFileSync(gc, txt);
  console.log(`GCODE ${gc}  ${txt.length} bytes, ${txt.split('\n').length} lines`);

  /* 4. THE GATE, on the final file. Nothing that fails it is allowed to exist. */
  const A = geo ? geo.summary.args : { bead:m.bead, maxbridge:W.P.maxBridge };
  const bounded = (v, d, lo, hi, key) => { const n = v == null ? d : +v; if(!Number.isFinite(n) || n < lo || n > hi) die(`gate ${key}=${v} outside ${lo}..${hi}`); return n; };
  const maxBridge = bounded(opt('maxbridge', A.maxbridge), 12, 0.5, allowExperimentalBridge ? 60 : 24, 'maxbridge');
  if(maxBridge > 24){
    const ex = geo && geo.summary.experiments;
    if(!ex || !Number.isFinite(+ex.evidencedBridge_mm) || !(ex.lintels || ex.horns || ex.crown)) die('a bridge ceiling above 24 mm needs summary.experiments (evidencedBridge_mm + declared zones)');
    console.log(`EXPERIMENTAL BRIDGE CEILING ${maxBridge} mm declared (evidence: ${ex.evidencedBridge_mm} mm)`);
  }
  const gateOpts = { bead:m.bead, maxbridge:maxBridge, maxcantilever:bounded(opt('maxcantilever', A.maxcantilever), 3, 0.2, 8, 'maxcantilever'),
    allow:bounded(opt('allow', A.allow), 0.6, 0.1, 1.5, 'allow'), minanchor:bounded(opt('minanchor', A.minanchor), 0.5, 0.5, 1.0, 'minanchor'),
    maxCapRadius:bounded(opt('max-cap-radius', A.maxCapRadius), 36, 2, 40, 'maxCapRadius'), maxislands:maxIslands, file:gc };
  const t0 = Date.now();
  const gate = runGate(txt, gateOpts);
  fs.writeFileSync(path.join(outDir, `${name}_gate.json`), JSON.stringify(gate, null, 1));
  console.log(`GATE  ${gate.PASS ? 'passed' : 'FAILED'} — ${gate.problem_count} problems / ${gate.stats.checked_points} points / ${gate.layers} layers, first layer ${gate.stats.first_layer_islands} island(s), ${Date.now() - t0} ms`);
  const refuse = (why) => {
    console.error(`GATE FAILED — ${why}`);
    for(const p of gate.problems.slice(0, 12)) console.error('   ', JSON.stringify(p));
    if(gate.problem_count > 12) console.error(`    ... and ${gate.problem_count - 12} more`);
    console.error('deleting the output. Nothing that fails the gate is allowed to exist.');
    if(keep){ fs.renameSync(gc, gc + '.REJECTED'); console.error(`  (--keep: left as ${gc}.REJECTED for diagnosis)`); }
    else for(const f of [gc, path.join(outDir, `${name}.stl`)]) if(fs.existsSync(f)) fs.unlinkSync(f);
    process.exit(1);
  };
  if(!gate.PASS) refuse('the final G-code has unsupported material');
  let extra = {};
  if(geo){
    /* the second gate at the evidenced ceiling: every finding must fall in a declared zone */
    if(maxBridge > 24){
      const ex = geo.summary.experiments, safe = +ex.evidencedBridge_mm;
      const g2 = runGate(txt, Object.assign({}, gateOpts, { maxbridge:safe }));
      fs.writeFileSync(path.join(outDir, `${name}_gate_at_${safe}mm.json`), JSON.stringify(g2, null, 1));
      const zones = [];
      for(const l of (ex.lintels || [])) zones.push({ name:`lintel ${l.W_mm}`, z0:l.zLintel - 0.01, z1:l.zLintel + 4 * A.lh + 0.01 });
      for(const h of (ex.horns || [])) zones.push({ name:`horn ${h.P_mm}`, z0:h.zStart - 0.01, z1:h.zEnd + 0.01 });
      if(ex.crown){ const zc = geo.layers.find(l => l.phase === 'crown-iris'); if(zc) zones.push({ name:'crown iris', z0:zc.zBot - 0.01, z1:1e9 }); }
      const probs = g2.problems || []; const outside = []; const byZone = {};
      for(const p of probs){ const z = +(p.z ?? NaN); const zone = zones.find(zn => z >= zn.z0 && z <= zn.z1); if(zone) byZone[zone.name] = (byZone[zone.name] || 0) + 1; else outside.push(p); }
      console.log(`gate at the evidenced ${safe} mm: ${probs.length} findings, ${outside.length} outside the declared zones`, byZone);
      extra.gateAtEvidencedCeiling = { maxbridge_mm:safe, findings:probs.length, byZone, outsideDeclaredZones:outside.length, outsideSamples:outside.slice(0, 8) };
      if(outside.length){ gate.problems = outside; gate.problem_count = outside.length; refuse('the file exceeds the evidence somewhere the design did not declare'); }
    }
    /* belief vs measurement: the generator's anchoring and the gate's must describe the same object */
    /* A cap record gives its centre as cx/cy (suma, plate, limit16) or as c:[x,y] (the death caps of climber,
       vase, paired, aero — 2026-09-16: these carry no anchoredFrac, so they used to be refused as "undeclared"
       although the generator declared them; now a declared cap without a belief is reported as such and only
       an emitted membrane with NO cap record within 3 mm counts as undeclared). */
    const declared = [];
    for(const lay of geo.layers) if(lay.caps) for(const c of lay.caps){
      const cx = c.cx != null ? c.cx : (Array.isArray(c.c) ? c.c[0] : NaN), cy = c.cy != null ? c.cy : (Array.isArray(c.c) ? c.c[1] : NaN);
      /* the suma strategy keeps the geometry origin at the plate centre; the climber strategy centres the
         geometry's bounding box on the plate and reports that shift as placement.{ox,oy} */
      const ox = report.placement ? report.placement.ox : 0, oy = report.placement ? report.placement.oy : 0;
      declared.push({ z:lay.zBot, cx:cx + ox + m.plate[0] / 2, cy:cy + oy + m.plate[1] / 2, believed:(c.anchoredFrac != null ? c.anchoredFrac : null) });
    }
    const TOL = 0.10; const rows = [];
    for(const mm of (gate.membranes || [])){
      let best = null, bd = 1e9;
      for(const d of declared){ const q = Math.hypot(d.cx - mm.at[0], d.cy - mm.at[1]); if(q < bd){ bd = q; best = d; } }
      const found = bd <= 3.0 && best;
      rows.push({ z:mm.z, at:mm.at, measured:mm.anchoredFrac, believed:(found && best.believed != null) ? best.believed : null, declared:!!found, dist:+bd.toFixed(2) });
    }
    const undeclared = rows.filter(r => !r.declared), noBelief = rows.filter(r => r.declared && r.believed === null),
          diverged = rows.filter(r => r.believed !== null && Math.abs(r.believed - r.measured) > TOL);
    if(rows.length) console.log(`membranes: ${rows.length} emitted, ${undeclared.length} undeclared, ${noBelief.length} declared without a belief, ${diverged.length} divergent (tol ${TOL})`);
    for(const r of rows) console.log(`   z ${r.z}  at [${r.at}]  believed ${r.believed === null ? (r.declared ? 'none' : 'UNDECLARED') : r.believed.toFixed(3)}  measured ${r.measured.toFixed(3)}`);
    if(undeclared.length || diverged.length){ gate.problems = rows; gate.problem_count = rows.length; refuse('BELIEF/MEASUREMENT DIVERGENCE — the generator and the gate do not describe the same object'); }
    extra.membranes = rows;
  }

  /* 5. tell the truth in the first ten lines */
  const fixed = fixHeader(txt); fs.writeFileSync(gc, fixed.text);
  console.log(`HEAD  rewritten: ${fixed.stats.layers} layers, ${fixed.stats.filament_mm} mm filament, ${fixed.stats.grams} g, max Z ${fixed.stats.maxZ}, ${fixed.stats.time} (kinematic)`);

  /* 6. package for the machine that has to read it */
  const shipped = [path.basename(gc)];
  if(m.route === 'bambu3mf'){
    const tpl = path.join(WEFT_ROOT, m.containerTemplate);
    if(!fs.existsSync(tpl)) die(`container template missing: ${m.containerTemplate} — a Bambu .gcode.3mf can only be built from one of Semir's own exports`);
    const three = path.join(outDir, `${name}.gcode.3mf`);
    const pk = packBambu3mf(fixed.text, tpl, three, { name:`${name}.stl`, layerHeight:m.lh });
    console.log(`3MF   ${three}  ${pk.layers} layers, ${pk.filament_m} m / ${pk.grams} g, ${pk.estimate}, md5 ${pk.md5}, ${(pk.bytes / 1e6).toFixed(1)} MB`);
    /* the package is re-read and re-gated: what ships is what was checked */
    const g3 = runGate(three, Object.assign({}, gateOpts, { file:three }));
    fs.writeFileSync(path.join(outDir, `${name}_package_gate.json`), JSON.stringify(g3, null, 1));
    if(!g3.PASS){ fs.unlinkSync(three); die(`the packaged G-code failed the gate (${g3.problem_count} problems) — package deleted`); }
    console.log(`GATE  package re-read from the container: passed (${g3.stats.checked_points} points)`);
    shipped.push(path.basename(three));
  }

  /* 7. the manifest + report */
  const reportPath = freshReportPath(outDir, name);
  writeJsonAtomic(reportPath, { report:Object.assign({}, report, extra), geometry:geo ? geo.summary : null, design:design || null, preset:presetEntry ? presetEntry.file : null,
    builder:'weft.mjs (core/weft_core.js + core/weft_gate.js, no browser, no Python)', gate:gateOpts });
  const man = { name, model:model || (presetEntry ? `preset:${presetEntry.file}` : (design ? 'design' : 'geometry')), built:new Date().toISOString().slice(0, 19),
    machine:Object.assign({ id:machineId }, Object.fromEntries(['label', 'plate', 'maxZ', 'bead', 'beadSource', 'beadEvidence', 'lh', 'firstLayerBead', 'temp', 'bed', 'start', 'end', 'route'].map(k => [k, m[k]]))),
    geometry:geoFile ? path.basename(geoFile) : null, shipped, gate:`${name}_gate.json`, report:path.basename(reportPath),
    builder:'weft.mjs', core:W.version, outcome:'NOT PRINTED — fill this in after the print, with photographs' };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(man, null, 1));
  console.log(`\n=== done ===\n${outDir}\n  ${shipped.join('\n  ')}\n  manifest.json`);
  if(m.beadSource !== 'measured') console.log(`\n  Remember: this was built on an ASSUMED bead of ${m.bead} mm.`);
}

/* ---------------------------------------------------------------------------------------------- */
function cmdCheck(){
  const file = argv[1]; if(!file || file.startsWith('--')) die('check FILE.gcode|FILE.gcode.3mf --machine ID');
  const m = machineOrDie(opt('machine'));
  const o = { bead:m.bead, maxislands:+opt('maxislands', 1), file };
  for(const k of ['maxbridge', 'maxcantilever', 'allow', 'minanchor', 'res']) if(opt(k) != null) o[k] = +opt(k);
  if(opt('max-cap-radius') != null) o.maxCapRadius = +opt('max-cap-radius');
  if(flag('slicer-types')) o.slicerTypes = true;
  const t0 = Date.now();
  const res = runGate(path.resolve(file), o);
  if(res.error) die(res.error, 2);
  if(opt('json')) fs.writeFileSync(path.resolve(opt('json')), JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ layers:res.layers, stats:res.stats, byRole:res.byRole, problem_count:res.problem_count, PASS:res.PASS, ms:Date.now() - t0 }, null, 1));
  console.log('worst gaps (z, role, p99, max):', JSON.stringify(res.worstGaps.slice(0, 8)));
  if(res.membranes.length){ const w = res.membranes.reduce((a, b) => a.anchoredFrac <= b.anchoredFrac ? a : b); console.log(`membranes: ${res.membranes.length}, anchoring measured min ${w.anchoredFrac.toFixed(2)} at z ${w.z} [${w.at}]`); }
  const maxReport = +opt('max-report', 25);
  for(const p of res.problems.slice(0, maxReport)) console.log('  ', JSON.stringify(p));
  if(res.problem_count > maxReport) console.log(`   ... and ${res.problem_count - maxReport} more`);
  console.log(res.PASS ? '\n  gate passed' : '\n  gate REFUSED');
  process.exit(res.PASS ? 0 : 1);
}

/* ---------------------------------------------------------------------------------------------- */
function cmdServe(){
  const port = +opt('port', 8765);
  const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.gcode':'text/plain', '.stl':'model/stl', '.md':'text/markdown' };
  http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]); if(p === '/') p = '/index.html';
    const f = path.join(WEFT_ROOT, p);
    if(!f.startsWith(WEFT_ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type':types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`WEFT is at http://127.0.0.1:${port}/  (index.html with presets, gate in the browser; Ctrl-C stops it)`));
}

if(cmd === 'machines') cmdMachines();
else if(cmd === 'presets') cmdPresets();
else if(cmd === 'build') await cmdBuild();
else if(cmd === 'check') cmdCheck();
else if(cmd === 'serve') cmdServe();
else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\s*/, '')); process.exit(cmd ? 1 : 0); }
