/* Resume SOKOL V2c: existing geometry -> canonical build -> verified delivery.
   No regeneration, no gate overrides, no STL needed for direct Ender G-code. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'specimens/2026-10-03_sokol_ender');
const out = path.join(src, 'v2c_package');
const delivery = path.join(root, 'ZA_STAMPU/CREALITY_Ender3V4/SOKOL_V2c');
const statusFile = path.join(src, 'finish_status.json');
const lockFile = path.join(src, 'finish.lock');
const geo = path.join(src, 'sokol_v2c_geometry.json');
const mode = process.argv[2] || 'status';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = p => fs.existsSync(p);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function state(stage, fields = {}) { const s = { stage, at:new Date().toISOString(), geometry:geo, out, ...fields }; fs.writeFileSync(statusFile, JSON.stringify(s, null, 2)); return s; }
function validate() {
  const m = read(path.join(out, 'manifest.json'));
  if(m.machine.id !== 'ender') throw Error('manifest machine is not ender');
  const g = read(path.join(out, m.gate)), l = read(path.join(out, m.gateLayers));
  if(g.PASS !== true || g.problem_count !== 0 || l.refuse !== false || (l.refusedBy || []).length) throw Error('gate failure');
  const gc = m.shipped.find(f => f.endsWith('.gcode'));
  if(!gc || fs.statSync(path.join(out, gc)).size < 10000) throw Error('missing/nonempty G-code');
  return { m, gc, vector:l.vector, files:[...new Set([...m.shipped, m.gate, m.gateLayers, m.report, 'manifest.json'])] };
}
function deliver(exitCode) {
  if(exitCode !== 0 && exitCode !== null) throw Error('build exit must be 0 or unknown external completion');
  const v = validate();
  fs.mkdirSync(delivery, { recursive:true });
  const hashes = {};
  for(const f of v.files) {
    if(path.basename(f) !== f) throw Error('unsafe manifest path');
    const s = path.join(out, f), d = path.join(delivery, f);
    if(exists(d) && hash(s) !== hash(d)) throw Error('delivery already contains different bytes: ' + f);
    fs.copyFileSync(s, d); hashes[f] = hash(d);
  }
  fs.writeFileSync(path.join(delivery, 'SHA256.json'), JSON.stringify(hashes, null, 2));
  fs.writeFileSync(path.join(delivery, 'README.md'), `# SOKOL V2c - Ender\n\nSD file: ${v.gc}. Direct G-code; do not slice again.\nBuild exit: ${exitCode === null ? 'unknown external build' : exitCode}. S1 PASS, zero problems; layered gate: ${v.vector}. SHA256.json records delivered bytes.\n\nExtended beak, porous heart region and vertical weave variation continue the existing V2. Falcon recognizability has not been visually confirmed.\nProfile: Creality Ender-3 V4 in machines.json. Bead 0.42 mm is ASSUMED, not calibrated. Verify actual printer, bed size, filament, temperatures and start/end commands; perform C1 calibration. Not physically printed. Software PASS is not a physical success guarantee.\n`);
  return state('DELIVERED', { buildExit:exitCode, delivery, gcode:v.gc, vector:v.vector, hashes });
}
function activeBuild() {
  if(process.platform !== 'win32') return [];
  const script = "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Where-Object { $_.CommandLine -match 'weft.mjs build' -and $_.CommandLine -match 'sokol_v2c_geometry' } | Select-Object -ExpandProperty ProcessId";
  return execFileSync('powershell', ['-NoProfile','-Command',script], { encoding:'utf8' }).trim().split(/\s+/).filter(Boolean).map(Number);
}
async function work() {
  let fd;
  try { fd = fs.openSync(lockFile, 'wx'); fs.writeFileSync(fd, String(process.pid)); }
  catch { throw Error('finish.lock exists; check its PID before moving a stale lock into _to_delete'); }
  try {
    if(exists(path.join(out, 'manifest.json')) && exists(statusFile) && read(statusFile).buildExit === 0) return deliver(0);
    const pids = activeBuild();
    if(pids.length) {
      state('EXTERNAL_BUILD_RUNNING', { pids, supervisor:process.pid, next:'Watching existing build; deliver only after exit and gate validation.' });
      const deadline = Date.now() + 6*60*60*1000;
      while(activeBuild().length && Date.now() < deadline) await new Promise(r => setTimeout(r,30000));
      if(activeBuild().length) return state('BLOCKED', { reason:'Existing build still active after six hours; no duplicate build started.', pids:activeBuild() });
      if(!exists(path.join(out,'manifest.json'))) return state('BLOCKED', { reason:'External build exited without manifest; inspect gate/build output. No automatic rebuild.' });
      try { return deliver(null); }
      catch(e) { return state('BLOCKED', { reason:e.message, buildExit:null }); }
    }
    if(!exists(geo) || fs.statSync(geo).size < 1000) throw Error('existing geometry missing; do not regenerate without examining generator logs');
    const G = read(geo); if(!G.layers?.length || !G.summary) throw Error('invalid geometry');
    fs.mkdirSync(out, { recursive:true });
    const log = fs.openSync(path.join(src, 'finish_build.log'), 'a');
    const args = [path.join(root,'weft.mjs'), 'build', '--geo',geo,'--machine','ender','--out',out,'--name','SOKOL_V2','--i-know-the-bead-is-a-guess','--nostl','--keep'];
    const child = spawn(process.execPath,args,{ cwd:root,stdio:['ignore',log,log],windowsHide:true });
    state('BUILD_RUNNING', { pid:child.pid, supervisor:process.pid, command:[process.execPath,...args] });
    const code = await new Promise((resolve,reject) => { child.on('error',reject); child.on('exit',resolve); });
    fs.closeSync(log);
    state(code === 0 ? 'BUILD_OK' : 'BLOCKED', { buildExit:code, log:'finish_build.log' });
    if(code !== 0) return;
    deliver(code);
  } finally { fs.closeSync(fd); fs.unlinkSync(lockFile); }
}
try {
  if(mode === '--worker') await work();
  else if(mode === 'start') {
    if(exists(lockFile)) throw Error('worker already locked; run status');
    const log = fs.openSync(path.join(src,'finish_supervisor.log'),'a');
    const p = spawn(process.execPath,[fileURLToPath(import.meta.url),'--worker'],{ cwd:root,detached:true,stdio:['ignore',log,log],windowsHide:true }); p.unref(); fs.closeSync(log);
    console.log(JSON.stringify({ supervisor:p.pid, statusFile }));
  } else if(mode === 'status') {
    console.log(JSON.stringify({ saved:exists(statusFile) ? read(statusFile) : null, activeBuild:activeBuild(), manifest:exists(path.join(out,'manifest.json')), lock:exists(lockFile) },null,2));
  } else if(mode === 'verify') console.log(JSON.stringify(validate(),null,2));
  else if(mode === 'deliver') {
    if(activeBuild().length) throw Error('build is still active; no delivery');
    console.log(JSON.stringify(deliver(exists(statusFile) && read(statusFile).buildExit === 0 ? 0 : null),null,2));
  }
  else throw Error('usage: node tools/finish_sokol.mjs status|start|verify|deliver');
} catch(e) { console.error(e.stack); process.exitCode=1; }
