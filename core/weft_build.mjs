/* WEFT build — the level-3 builders as plain Node code (2026-09-08).

   Until today the thread could only be made inside index.html driven by Playwright/Chromium
   (make_suma.mjs, make_climber.mjs), the gate only by Python+scipy (check_gcode.py), the header only by
   fix_header.py and the Bambu container only by pack_bambu_3mf.py. A PC with Node and nothing else could
   not build; a PC without Chrome could not build; the PC whose `python` is Inkscape's could not gate.
   That is P15 in STATE.md, and it is what "works without a model" has to mean in practice: a person with
   a presets file and `node weft.mjs build` gets the same artefact, or nothing.

   This module contains:
     layersFromGeometry(W, geo, opts)   — the make_suma.mjs strategy (contours / typed paths / caps /
                                          foundation, per-contour overrides, one global Z clock)
     layersFromClimber(W, geo, opts)    — the make_climber.mjs strategy (per-layer wall/tab/grammar bands,
                                          the thinning negotiation, single-thread layers)
     writeStl / gcodeText               — through the core's own exporters
     fixHeader(text)                    — fix_header.py, to the number
     packBambu3mf(...)                  — pack_bambu_3mf.py, to the byte where it matters (payload, md5,
                                          M73, header numbers, plate json, slice_info)
     runGate(text, opts)                — core/weft_gate.js
   The strategies are ports, not rewrites: the same statements in the same order, so the G-code they
   emit is byte-identical to the browser builders' (tests/build_parity.test.mjs holds LIMIT16 to that). */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {makeBambuThumbnails,auditBambuThumbnails} from './weft_bambu_thumbnails.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WEFT_ROOT = path.resolve(HERE, '..');
await import(pathToFileURL(path.join(HERE, 'weft_core.js')).href);
await import(pathToFileURL(path.join(HERE, 'weft_gate.js')).href);
export const { createWeftCore } = globalThis.WEFT_CORE;
export const { checkGcode } = globalThis.WEFT_GATE;

export function loadMachines(){ return JSON.parse(fs.readFileSync(path.join(WEFT_ROOT, 'machines.json'), 'utf8')); }

/* ---------------------------------------------------------------------------------------------------
   Strategy A — make_suma.mjs, verbatim in structure. `W` is a fresh core; `geo` a level-2 geometry file. */
export function layersFromGeometry(W, geo, o){
  const G = geo, web = o.grammar || 'staple', e = o.tab != null ? +o.tab : 1.0, machine = o.machine || 'a2l';
  const name = o.name || 'weft', allowExperimental = !!o.allowExperimental;
  const P = W.P, A = G.summary.args;
  W.setMachine(machine);
  Object.assign(P, { mode:'wall', lh:A.lh, bead:A.bead, w:A.w, overshoot:e, webType:web, cycle:A.cycle||['chord','web'], amp:0, ampF:1,
    altPhase:A.altPhase??true, autoLOD:true, minGap:1.4, gradeLean:false, dwell:0.6, jitter:0, flowBoost:1.25, maxBridge:12, checkOv:true,
    speed:A.speed ?? 30, bridgeSpeed:A.bridgeSpeed ?? 18, temp:A.temp ?? 215, bed:A.bed ?? 55, fan:A.fan ?? 100,
    firstLayerBead:A.firstLayerBead ?? 0.52, firstLayerSpeed:A.firstLayerSpeed ?? 12,
    adhesion:'foundation', adhesionWidth:A.foundation });
  P.lambda = 2 * Math.PI * A.r0 / A.K * 2;   // nominal; nodes are supplied per contour anyway
  W.seed = 1337;
  const _apexUs = W.apexUs;
  W.apexUs = function(cl, webIdx, jit){
    if(!cl.nodes) return _apexUs(cl, webIdx, jit);
    const us = cl.nodes.slice(), sides = us.map((_, j) => j % 2 === 0 ? 1 : -1);
    let half = us.length > 1 ? Math.min(...us.slice(1).map((u, j) => u - us[j])) : cl.total;
    half = Math.max(half, P.bead * 2.2);
    return { us, sides, half, m:1, K:us.length };
  };
  W.widthPhase = function(cl, u){ const lam = (cl && cl.breath) || P.lambda; return P.ampF * (2 * Math.PI * u / lam - (cl && cl.closed ? Math.PI / 2 : 0)); };
  const { chordLayer, webLayer, plen, clSample, STEP } = W;
  const out = []; let webCount = 0; const perLayer = [];
  if(G.foundation){ const F = G.foundation; const paths = F.paths || [F.pts];
    for(const pth of paths){ const pts = pth.map(p => ({ x:p[0], y:p[1] }));
      const L = { role:'adhesion', adhesion:'foundation', pts, apexes:[], zBot:0, zTop:A.lh, closed:false, cl:null,
        bead:A.firstLayerBead ?? 0.52, speed:A.firstLayerSpeed ?? 12, wSpan:A.w, ovh:e, nodeGap:null, source:'foundation' };
      L.len = plen(pts); L.ov = []; out.push(L); } }
  for(const lay of G.layers){
    const k = lay.k, layRole = P.cycle[k % P.cycle.length];
    let ci = 0;
    for(const c of lay.contours){
      const role = c.role || layRole;
      const keep = { webType:P.webType, w:P.w, overshoot:P.overshoot, lambda:P.lambda, amp:P.amp };
      if(c.web != null)    P.webType   = c.web;
      if(c.w != null)      P.w         = c.w;
      if(c.e != null)      P.overshoot = c.e;
      if(c.lambda != null) P.lambda    = c.lambda;
      P.amp = (c.amp != null) ? c.amp : 0;
      const cl = { pts:c.pts.map(p => ({ x:p[0], y:p[1] })), nrm:c.nrm.map(p => ({ x:p[0], y:p[1] })), cum:c.cum, total:c.total, closed:c.closed !== false, kind:'wall', nodes:c.nodes, r:undefined, R:undefined, breath:c.breath || null };
      const g = role === 'chord' ? W.chordLayer(cl, lay.zBot, 0) : W.webLayer(cl, lay.zBot, webCount);
      const L = { role, pts:g.pts, apexes:g.apexes, zBot:lay.zBot, zTop:lay.zTop, closed:g.closed, cl, bead:c.bead || A.bead,
        speed:lay.zBot === 0 ? 12 : (c.speed || P.speed),
        wSpan:(c.w != null ? c.w : A.w), ovh:(c.e != null ? c.e : e), webType:P.webType, tile:c.tile,
        nodeGap:role === 'web' ? W.webLayer._lastGap : null, contour:ci++, nContours:lay.contours.length };
      L.len = plen(L.pts); out.push(L);
      Object.assign(P, keep);
    }
    if(lay.paths) for(const rp of lay.paths){
      if(!Array.isArray(rp.pts) || rp.pts.length < 2 || rp.pts.some(p => !Array.isArray(p) || p.length < 2 || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])))
        throw new Error(`invalid typed path at geometry layer ${k}`);
      const role = rp.role || 'wall';
      const pts = rp.pts.map(p => ({ x:+p[0], y:+p[1] }));
      const maxSeg = Math.max(...pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)));
      if((role === 'bridge' || role === 'cantilever') && maxSeg > Math.max(0.55, A.bead * 1.25))
        throw new Error(`typed ${role} at geometry layer ${k} is sampled every ${maxSeg.toFixed(2)} mm; ` +
          `the final-artifact gate requires <= ${Math.max(0.55, A.bead * 1.25).toFixed(2)} mm`);
      const L = { role, pts, apexes:[], zBot:lay.zBot, zTop:lay.zTop, closed:!!rp.closed, cl:null,
        bead:rp.bead || A.bead, speed:lay.zBot === 0 ? (A.firstLayerSpeed ?? 12) : (rp.speed || P.speed),
        wSpan:rp.w ?? A.w, ovh:rp.e ?? e, nodeGap:null, tile:rp.tile, label:rp.label,
        intent:rp.intent, source:'raw', preservePoints:role === 'bridge' || role === 'cantilever',
        spec:(rp.row != null && rp.col != null) ? { gx:rp.col, gy:rp.row, vx:rp.tile, vy:rp.label } : null };
      L.len = plen(pts); L.ov = []; out.push(L);
    }
    if(lay.caps) for(const cp of lay.caps){
      const pts = cp.pts.map(p => ({ x:p[0], y:p[1] }));
      const L = { role:'cap', pts, apexes:[], zBot:lay.zBot, zTop:lay.zTop, closed:false, cl:null, bead:cp.bead || A.bead, speed:P.bridgeSpeed,
        wSpan:A.w, ovh:e, nodeGap:null, capSpan:cp.span_mm, tile:cp.tile, label:cp.label, source:'cap',
        membraneProcess:cp.process, membraneStatus:cp.physicalStatus, membraneEvidence:cp.evidence || null };
      L.len = plen(pts); out.push(L);
    }
    if(layRole === 'web' || lay.contours.some(c => c.role === 'web')) webCount++;
    perLayer.push({ k, z:lay.zBot, contours:lay.contours.length, paths:(lay.paths || []).length, a:lay.a, b:lay.b, rho:lay.rho, nodes:lay.contours.reduce((s, c) => s + c.nodes.length, 0) });
  }
  const layers = out.sort((a, b) => a.zBot - b.zBot);
  for(let i = 1; i < layers.length; i++) if(layers[i].zBot < layers[i - 1].zBot - 1e-6)
    throw new Error(`global Z order violated: ${layers[i].zBot} after ${layers[i - 1].zBot}`);
  const globalZLevels = new Set(layers.map(L => L.zBot.toFixed(4))).size;
  const expectedZLevels = G.layers.filter(l => l.contours.length || (l.paths && l.paths.length) || (l.caps && l.caps.length)).length;
  if(globalZLevels !== expectedZLevels)
    throw new Error(`global Z level mismatch: emitted ${globalZLevels}, geometry ${expectedZLevels}`);
  W.layers = layers;
  W.detectOverlaps();
  let seamOv = 0;
  for(const L of layers){ if(L.role !== 'chord' || !L.cl || !L.cl.closed || !L.ov.length) continue;
    const sx = clSample(L.cl, L.cl.total - STEP); const keep = [];
    for(const o of L.ov){ if(Math.hypot(o.x - sx.x, o.y - sx.y) < L.wSpan / 2 + 1.2) seamOv++; else keep.push(o); }
    L.ov = keep; }
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9; for(const L of layers) for(const p of L.pts){ if(p.x < mnx) mnx = p.x; if(p.x > mxx) mxx = p.x; if(p.y < mny) mny = p.y; if(p.y > mxy) mxy = p.y; }
  const BED = W.BED, BEDY = W.BEDY;
  const totalLen = layers.reduce((s, L) => s + L.len, 0), nodes = layers.reduce((s, L) => s + L.apexes.length, 0), ov = layers.reduce((s, L) => s + L.ov.length, 0);
  const ovLayers = layers.filter(L => L.ov.length).slice(0, 12).map(L => ({ z:+L.zBot.toFixed(2), role:L.role, ov:L.ov.length, contour:L.contour }));
  const grammarCounts = {}; for(const L of layers) if(L.role === 'web') grammarCounts[L.webType] = (grammarCounts[L.webType] || 0) + 1;
  return { name, machine:W.MACHINES[W.MACHINE].label, bed_mm:[BED, BEDY], layers:layers.length,
    globalZLevels, expectedZLevels, logicalCells:G.summary.tileCount ?? null,
    experimentalMembraneOverride:allowExperimental && layers.some(L => L.role === 'cap' && L.membraneStatus === 'experimental'),
    maxBodiesPerZ:Math.max(...G.layers.map(l => new Set([...(l.contours || []), ...(l.paths || []), ...(l.caps || [])].map(x => x.tile).filter(x => x != null)).size)),
    size_mm:[+(mxx - mnx + A.bead).toFixed(1), +(mxy - mny + A.bead).toFixed(1), G.summary.H],
    plate_mm:[+(mnx + BED / 2).toFixed(1), +(mny + BEDY / 2).toFixed(1), +(mxx + BED / 2).toFixed(1), +(mxy + BEDY / 2).toFixed(1)],
    fitsPlate:(mnx + BED / 2) > 8 && (mny + BEDY / 2) > 8 && (mxx + BED / 2) < BED - 8 && (mxy + BEDY / 2) < BEDY - 8,
    grammarCounts,
    threadLength_m:+(totalLen / 1000).toFixed(1), weldNodes:nodes, rawPaths:layers.filter(L => L.source === 'raw').length,
    unintendedOverlaps:ov, seamClosures:seamOv, overlapSamples:ovLayers,
    kinematic_h:+(totalLen / 30 / 3600).toFixed(2), routeA_estimate_h:+((totalLen / 1000) / 366.4 * 32).toFixed(1),
    caps:layers.filter(L => L.role === 'cap').map(L => ({ z:+L.zBot.toFixed(2), span_mm:L.capSpan, len:Math.round(L.len),
      process:L.membraneProcess, physicalStatus:L.membraneStatus, evidence:L.membraneEvidence })),
    events:G.summary.events, contourCounts:perLayer.filter((p, i) => i === 0 || p.contours !== perLayer[i - 1].contours).map(p => [p.z, p.contours]),
    perLayerSample:perLayer.filter((_, i) => i % 40 === 0) };
}

/* ---------------------------------------------------------------------------------------------------
   Strategy B — make_climber.mjs, verbatim in structure: bands, thinning negotiation, single layers. */
export function layersFromClimber(W, geo, o){
  const G = geo, name = o.name || 'weft', bx = o.bx, by = o.by, mach = o.machine || 'ender', allowExperimental = !!o.allowExperimental;
  const P = W.P, A = G.summary.args, STEP = W.STEP;
  W.MACHINES.ender = { id:'ender', label:'Creality Ender-3 V4', bx, by, bedMax:100, hotMax:300 };
  if(!W.MACHINES[mach]) throw new Error('unknown machine: ' + mach);
  W.setMachine(mach);
  Object.assign(P, { mode:'wall', lh:A.lh, bead:A.bead, w:4, overshoot:1, webType:'staple', cycle:['chord','web'],
    amp:0, ampF:1, altPhase:false, autoLOD:true, minGap:1.2, gradeLean:false, dwell:0.55, jitter:0, flowBoost:1.2,
    maxBridge:A.maxbridge || 12, checkOv:true, speed:25, bridgeSpeed:15, temp:220, bed:60, fan:100,
    firstLayerBead:A.bead + 0.06, firstLayerSpeed:12, adhesion:'foundation', adhesionWidth:A.foundation });
  if(mach !== 'ender'){ P.temp = 220; P.bed = 55; }
  P.lambda = 8; W.seed = 1337;
  const _apexUs = W.apexUs;
  W.apexUs = function(cl, webIdx, jit){
    if(!cl.nodes) return _apexUs(cl, webIdx, jit);
    const us = cl.nodes.slice(), sides = us.map((_, j) => j % 2 === 0 ? 1 : -1);
    let half = us.length > 1 ? Math.min(...us.slice(1).map((u, j) => u - us[j])) : cl.total;
    half = Math.max(half, P.bead * 2.2);
    return { us, sides, half, m:1, K:us.length };
  };
  const bb = [1e9, 1e9, -1e9, -1e9];
  const eat = p => { if(p[0] < bb[0]) bb[0] = p[0]; if(p[1] < bb[1]) bb[1] = p[1]; if(p[0] > bb[2]) bb[2] = p[0]; if(p[1] > bb[3]) bb[3] = p[1]; };
  if(G.foundation) for(const pth of G.foundation.paths) for(const p of pth) eat(p);
  for(const lay of G.layers){ for(const c of lay.contours) for(const p of c.pts) eat(p); if(lay.caps) for(const cp of lay.caps) for(const p of cp.pts) eat(p); }
  const ox = -(bb[0] + bb[2]) / 2, oy = -(bb[1] + bb[3]) / 2;
  const shift = p => ({ x:p[0] + ox, y:p[1] + oy });
  const bands = []; const W_FLOOR = 0.9, TAB_FLOOR = 0.4, W_RATE = 0.36, TAB_RATE = 0.18;
  const found = [];
  const { plen, mapUV, clSample } = W;
  if(G.foundation) for(const pth of G.foundation.paths){
    const pts = pth.map(shift);
    const L = { role:'adhesion', adhesion:'foundation', pts, apexes:[], zBot:0, zTop:A.lh, closed:false, cl:null,
      bead:P.firstLayerBead, speed:P.firstLayerSpeed, wSpan:4, ovh:1, nodeGap:null, gk:-1 };
    L.len = plen(pts); L.ov = []; found.push(L);
  }
  const geoLayers = G.layers.filter(l => l.contours.length || (l.caps && l.caps.length));
  const webIdxOf = new Map(); { let n = 0; for(const lay of geoLayers){ if(P.cycle[lay.k % P.cycle.length] === 'web'){ webIdxOf.set(lay.k, n); n++; } } }
  let seamOv = 0;
  const dropSeam = (L) => { if(!L.cl || !L.ov || !L.ov.length) return;
    const sx = clSample(L.cl, L.cl.total - STEP); const keep = [];
    const rad = (L.wSpan || 4) / 2 + (L.role === 'web' ? (L.ovh || 0) : 0) + 1.2;
    for(const o of L.ov){ if(Math.hypot(o.x - sx.x, o.y - sx.y) < rad) seamOv++; else keep.push(o); }
    L.ov = keep; };
  const emitOne = (lay, sc, forceSingle) => {
    const w = W_FLOOR + sc * (lay.w - W_FLOOR), tb = TAB_FLOOR + sc * (lay.tab - TAB_FLOOR);
    P.w = w; P.webType = lay.web; P.overshoot = tb;
    const role = P.cycle[lay.k % P.cycle.length]; const made = [];
    const single = !!forceSingle || !!lay.single;
    for(const c of lay.contours){
      const cl = { pts:c.pts.map(shift), nrm:c.nrm.map(p => ({ x:p[0], y:p[1] })), cum:c.cum, total:c.total, closed:true, kind:'wall', nodes:c.nodes };
      let g;
      if(single){
        const pts = []; for(let u = 0; u < cl.total - STEP * 0.5; u += STEP) pts.push(mapUV(cl, u, 0));
        const ap = (cl.nodes || []).map(u => { const q = mapUV(cl, u, 0); return { x:q.x, y:q.y, z:lay.zBot }; });
        g = { pts, apexes:ap, closed:true };
      } else {
        g = role === 'chord' ? W.chordLayer(cl, lay.zBot, 0) : W.webLayer(cl, lay.zBot, webIdxOf.get(lay.k) || 0);
      }
      const L = { role, pts:g.pts, apexes:g.apexes, zBot:lay.zBot, zTop:lay.zTop, closed:g.closed, cl, gk:lay.k,
        bead:A.bead, speed:lay.zBot === 0 ? P.firstLayerSpeed : P.speed, wSpan:w, ovh:tb, webType:lay.web,
        nodeGap:(!single && role === 'web') ? W.webLayer._lastGap : null, phase:lay.phase, scale:sc, single,
        skipped:(!single && role === 'web') ? W.webLayer._skipped : null,
        maxRail:(!single && role === 'web') ? W.webLayer._maxRail : null };
      L.len = plen(L.pts); made.push(L);
    }
    if(lay.caps) for(const cp of lay.caps){
      const pts = cp.pts.map(shift);
      const L = { role:'cap', pts, apexes:[], zBot:lay.zBot, zTop:lay.zTop, closed:false, cl:null, bead:A.bead,
        speed:P.bridgeSpeed, wSpan:w, ovh:tb, nodeGap:null, capKind:cp.kind, capSpan:cp.span_mm, gk:lay.k,
        membraneProcess:cp.process, membraneStatus:cp.physicalStatus, membraneEvidence:cp.evidence ?? null };
      L.len = plen(pts); made.push(L);
    }
    W.layers = made; W.detectOverlaps(); for(const L of made) dropSeam(L);
    return made;
  };
  const scale = new Map(); const built = new Map(); const singles = new Set();
  for(const lay of geoLayers) built.set(lay.k, emitOne(lay, 1));
  let passes = 0, stuck = [];
  for(; passes < 40; passes++){
    const bad = [];
    for(const lay of geoLayers){ const n = built.get(lay.k).reduce((s, L) => s + (L.ov ? L.ov.length : 0), 0); if(n) bad.push(lay); }
    if(!bad.length) break;
    let moved = false; stuck = [];
    for(const lay of bad){
      const s0 = scale.get(lay.k) ?? 1;
      if(s0 <= 0.001){ if(!singles.has(lay.k)){ singles.add(lay.k); built.set(lay.k, emitOne(lay, 0, true)); moved = true; } else stuck.push(lay.k); continue; }
      const s1 = Math.max(0, s0 * 0.78 - 0.03);
      scale.set(lay.k, s1); built.set(lay.k, emitOne(lay, s1)); moved = true;
    }
    if(!moved) break;
    const ks = geoLayers.map(l => l.k);
    const wOf = k => { const l = geoLayers.find(x => x.k === k), sv = scale.get(k) ?? 1; return [W_FLOOR + sv * (l.w - W_FLOOR), TAB_FLOOR + sv * (l.tab - TAB_FLOOR)]; };
    const wArr = ks.map(k => wOf(k)[0]), tArr = ks.map(k => wOf(k)[1]);
    for(let i = 1; i < ks.length; i++){ wArr[i] = Math.min(wArr[i], wArr[i - 1] + W_RATE); tArr[i] = Math.min(tArr[i], tArr[i - 1] + TAB_RATE); }
    for(let i = ks.length - 2; i >= 0; i--){ wArr[i] = Math.min(wArr[i], wArr[i + 1] + W_RATE); tArr[i] = Math.min(tArr[i], tArr[i + 1] + TAB_RATE); }
    for(let i = 0; i < ks.length; i++){
      const l = geoLayers[i], denom = Math.max(1e-6, l.w - W_FLOOR);
      const sNew = Math.max(0, Math.min(1, (wArr[i] - W_FLOOR) / denom));
      const sOld = scale.get(l.k) ?? 1;
      if(sNew < sOld - 1e-4){ scale.set(l.k, sNew); built.set(l.k, emitOne(l, sNew, singles.has(l.k))); }
    }
  }
  const thinned = [...scale.entries()].filter(([, v]) => v < 0.999);
  const out = found.slice(); let lastPhase = null;
  for(const lay of geoLayers){
    if(lay.phase !== lastPhase){ bands.push({ z:lay.zBot, phase:lay.phase, web:lay.web, tab:lay.tab, w:lay.w }); lastPhase = lay.phase; }
    for(const L of built.get(lay.k)) out.push(L);
  }
  const layers = out.sort((a, b) => a.zBot - b.zBot); W.layers = layers;
  let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9, mz = 0;
  for(const L of layers){ mz = Math.max(mz, L.zTop); for(const p of L.pts){ if(p.x < mnx) mnx = p.x; if(p.x > mxx) mxx = p.x; if(p.y < mny) mny = p.y; if(p.y > mxy) mxy = p.y; } }
  const BED = W.BED, BEDY = W.BEDY;
  const totalLen = layers.reduce((s, L) => s + L.len, 0), nodes = layers.reduce((s, L) => s + L.apexes.length, 0), ov = layers.reduce((s, L) => s + L.ov.length, 0);
  const caps = layers.filter(L => L.role === 'cap'); const webs = layers.filter(L => L.role === 'web');
  const wEmit = layers.filter(L => L.wSpan != null && L.cl).map(L => L.wSpan);
  const railMax = Math.max(0, ...webs.map(L => L.maxRail || 0));
  const skippedRungs = webs.reduce((s, L) => s + (L.skipped || 0), 0);
  const deadWebs = webs.filter(L => !L.apexes.length).length;
  return { name, machine:W.MACHINES[W.MACHINE].label, bed:[BED, BEDY], layers:layers.length, placement:{ ox, oy, bbox:bb.slice() },
    experimentalMembraneOverride:allowExperimental && caps.some(L => L.membraneStatus === 'experimental'),
    weave:{ maxUnweldedRail_mm:+railMax.toFixed(1), skippedRungs, webLayersWithNoCrossing:deadWebs, maxBridge_mm:P.maxBridge },
    size_mm:[+(mxx - mnx + P.bead).toFixed(1), +(mxy - mny + P.bead).toFixed(1), +mz.toFixed(1)],
    plate_mm:[+(mnx + BED / 2).toFixed(1), +(mny + BEDY / 2).toFixed(1), +(mxx + BED / 2).toFixed(1), +(mxy + BEDY / 2).toFixed(1)],
    fitsPlate:(mnx + BED / 2) > 8 && (mny + BEDY / 2) > 8 && (mxx + BED / 2) < BED - 8 && (mxy + BEDY / 2) < BEDY - 8,
    threadLength_m:+(totalLen / 1000).toFixed(1), weldNodes:nodes, unintendedOverlaps:ov, seamClosures:seamOv,
    kinematic_h:+(totalLen / P.speed / 3600).toFixed(2),
    caps:caps.map(L => ({ z:+L.zBot.toFixed(1), kind:L.capKind, span_mm:L.capSpan, process:L.membraneProcess, physicalStatus:L.membraneStatus, evidence:L.membraneEvidence })),
    bands, wallWidth:{ emitted_min:+Math.min(...wEmit).toFixed(2), emitted_max:+Math.max(...wEmit).toFixed(2),
      thinnedLayers:thinned.length, minScale:thinned.length ? +Math.min(...thinned.map(t => t[1])).toFixed(3) : 1,
      stuckAtFloor:stuck.length, passes,
      residual:geoLayers.filter(l => built.get(l.k).reduce((s2, L) => s2 + (L.ov ? L.ov.length : 0), 0))
        .map(l => ({ z:+l.zBot.toFixed(1), phase:l.phase, web:l.web, scale:+(scale.get(l.k) ?? 1).toFixed(3), ov:built.get(l.k).reduce((s2, L) => s2 + (L.ov ? L.ov.length : 0), 0) })),
      singleThreadLayers:[...singles].map(k => { const l = geoLayers.find(x => x.k === k); return l ? +l.zBot.toFixed(1) : k; }),
      stuckAt:stuck.map(k => { const l = geoLayers.find(x => x.k === k);
        return l ? { z:+l.zBot.toFixed(1), phase:l.phase, web:l.web, w:+l.w.toFixed(2), tab:+l.tab.toFixed(2),
          ov:built.get(k).reduce((s, L) => s + (L.ov ? L.ov.length : 0), 0),
          at:(built.get(k).find(L => L.ov && L.ov.length) || { ov:[] }).ov.slice(0, 3).map(o => [+o.x.toFixed(1), +o.y.toFixed(1)]) } : k; }) },
    geometryWall:G.summary.wallWidth, supportCheck:G.summary.supportCheck };
}

/* the weave has to hold before anything is written (make_climber.mjs) */
export function climberHardRefusals(report){
  const wv = report.weave, hard = [];
  if(!report.fitsPlate) hard.push(`does not fit the plate with an 8 mm margin: ${report.plate_mm}`);
  if(wv.webLayersWithNoCrossing) hard.push(`${wv.webLayersWithNoCrossing} web layers placed no crossing at all`);
  if(wv.maxUnweldedRail_mm > wv.maxBridge_mm) hard.push(`a chord rail runs ${wv.maxUnweldedRail_mm} mm with no weld under it, over the ${wv.maxBridge_mm} mm limit`);
  if(report.unintendedOverlaps) hard.push(`${report.unintendedOverlaps} unintended same-layer overlaps survive at the wall floor (${report.wallWidth.stuckAtFloor} layers could not be thinned any further)`);
  return hard;
}

/* ---------------------------------------------------------------------------------------------------
   Exports through the core's own builders. */
export async function writeStl(W, file){
  for(const L of W.layers){ const g = W.ribbon(L.pts, (L.bead || W.P.bead) / 2, L.zBot, L.zTop); if(g) L.geo = g; }
  const parts = await W.buildSTLParts();
  const fd = fs.openSync(file, 'w'); let total = 0;
  for(const p of parts){ fs.writeSync(fd, Buffer.from(p)); total += p.byteLength; }
  fs.closeSync(fd); return total;
}
export function restoreHarvestedEndZ(foot, templatePath, top, maxZ){
  const settings = zipRead(fs.readFileSync(templatePath)).find(e => e.name === 'Metadata/project_settings.config');
  if(!settings) throw new Error('harvested container has no project settings');
  const source = JSON.parse(settings.data.toString('utf8')).machine_end_gcode;
  const formula = /^G1 Z\{max_layer_z \+ ([\d.]+)\} F900 ; lower z a little\s*$/m;
  const match = typeof source === 'string' && source.match(formula);
  const old = /^G1 Z([\d.]+) F900 ; lower z a little\s*$/gm;
  const hits = [...foot.matchAll(old)];
  if(!match || hits.length !== 1) throw new Error('unrecognized harvested end-Z formula or ambiguous compiled line');
  const z = +(top + +match[1]).toFixed(3);
  if(!Number.isFinite(z) || z <= top || z > maxZ) throw new Error('restored end Z outside machine clearance');
  return {text:foot.replace(old,`G1 Z${z} F900 ; lower z a little`), receipt:{source:templatePath,entry:'Metadata/project_settings.config',formula:match[0].trim(),oldZ:+hits[0][1],top,newZ:z,meaning:'Re-evaluated the slicer-owned expression; no invented printer sequence.'}};
}
export async function gcodeText(W, headFile, footFile, options={}){
  const head = fs.readFileSync(headFile, 'utf8'), foot = options.footText ?? (footFile ? fs.readFileSync(footFile, 'utf8') : W.FOOT_DEF);
  return W.buildGcodeText(null, head, foot);
}

/* ---------------------------------------------------------------------------------------------------
   fix_header.py: rewrite the HEADER_BLOCK statistics from the file's own moves. Same parser, same
   fields, same wording; returns {text, stats, missed}. */
export function fixHeader(text, o = {}){
  const density = o.density ?? 1.26, diameter = o.diameter ?? 1.75;
  const src = text.split('\n');
  let X = 0, Y = 0, Z = 0, F = 3000.0, absE = true, Eprev = null, efil = 0, seconds = 0, maxz = 0, layerMarks = 0;
  const zs = new Set();
  for(const ln of src){
    const s = ln.trim();
    if(s.startsWith('M82')) absE = true; else if(s.startsWith('M83')) absE = false;
    else if(s.startsWith('; CHANGE_LAYER') || s.startsWith(';LAYER_CHANGE')) layerMarks++;
    if(!(s.startsWith('G0') || s.startsWith('G1'))) continue;
    const d = {};
    for(const t of s.split(/\s+/)){ if(t && 'XYZEF'.includes(t[0])){ const v = parseFloat(t.slice(1)); if(Number.isFinite(v) && /^-?\d*\.?\d+$/.test(t.slice(1))) d[t[0]] = v; } }
    if('F' in d) F = d.F;
    const nx = d.X ?? X, ny = d.Y ?? Y, nz = d.Z ?? Z;
    if('E' in d){
      const de = (absE && Eprev !== null) ? (d.E - Eprev) : d.E;
      if(absE) Eprev = d.E;
      if(de > 0){ efil += de; if(nz > maxz) maxz = nz; zs.add(Math.round(nz * 1000) / 1000); }
    }
    let dist = Math.hypot(nx - X, ny - Y); dist = Math.hypot(dist, nz - Z);
    if(dist > 0 && F > 0) seconds += dist / (F / 60.0);
    X = nx; Y = ny; Z = nz;
  }
  const vol = efil * Math.PI * (diameter / 2) ** 2, grams = vol * density / 1000.0;
  const nlayers = layerMarks ? layerMarks : zs.size;
  const hms = (t) => { t = Math.round(t); const d = Math.floor(t / 86400); t -= d * 86400; const h = Math.floor(t / 3600); t -= h * 3600; const m = Math.floor(t / 60); const sec = t - m * 60;
    return (d ? `${d}d ` : '') + ((h || d) ? `${h}h ` : '') + `${m}m ${sec}s`; };
  const sub = [
    [/^; model printing time:.*$/, `; model printing time: ${hms(seconds)}; total estimated time: ${hms(seconds)}   ; WEFT kinematic estimate, no acceleration model - a LOWER bound`],
    [/^; total layer number:.*$/, `; total layer number: ${nlayers}`],
    [/^; total filament length \[mm\][^:]*:.*$/, `; total filament length [mm] : ${efil.toFixed(2)}`],
    [/^; total filament volume \[cm\^3\][^:]*:.*$/, `; total filament volume [cm^3] : ${vol.toFixed(2)}`],
    [/^; total filament weight \[g\][^:]*:.*$/, `; total filament weight [g] : ${grams.toFixed(2)}`],
    [/^; max_z_height:.*$/, `; max_z_height: ${maxz.toFixed(2)}`],
  ];
  const hit = sub.map(() => 0); const out = []; let inHeader = false;
  for(let ln of src){
    if(ln.startsWith('; HEADER_BLOCK_START')) inHeader = true;
    if(inHeader){ for(let i = 0; i < sub.length; i++){ if(sub[i][0].test(ln)){ ln = sub[i][1]; hit[i]++; break; } } }
    if(ln.startsWith('; HEADER_BLOCK_END')) inHeader = false;
    out.push(ln);
  }
  return { text:out.join('\n'), stats:{ layers:nlayers, filament_mm:+efil.toFixed(2), grams:+grams.toFixed(2), maxZ:+maxz.toFixed(2), seconds:Math.round(seconds), time:hms(seconds) },
    missed:sub.filter((_, i) => !hit[i]).map(s => String(s[0])) };
}

/* ---------------------------------------------------------------------------------------------------
   Minimal ZIP (store/deflate) read + write — enough for a Bambu .gcode.3mf container. */
function crc32(buf){ let c, crc = 0xFFFFFFFF; for(let n = 0; n < buf.length; n++){ c = (crc ^ buf[n]) & 0xFF; for(let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
export function zipRead(buf){
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if(eocd < 0) throw new Error('not a zip file');
  const n = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
  const entries = []; let p = cdOff;
  for(let i = 0; i < n; i++){
    if(buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), time = buf.readUInt16LE(p + 12), date = buf.readUInt16LE(p + 14);
    const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28);
    const dataOff = lho + 30 + lnl + lel;
    const raw = buf.subarray(dataOff, dataOff + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : (method === 0 ? Buffer.from(raw) : null);
    if(data === null) throw new Error(`unsupported zip method ${method} for ${name}`);
    if(data.length !== usize) throw new Error(`size mismatch for ${name}`);
    entries.push({ name, data, time, date });
    p += 46 + nl + el + cl;
  }
  return entries;
}
export function zipWrite(entries){
  const locals = [], centrals = []; let off = 0;
  for(const e of entries){
    const name = Buffer.from(e.name, 'utf8'), data = e.data;
    const deflate = e.store ? false : true;
    const payload = deflate ? zlib.deflateRawSync(data, { level:6 }) : data;
    const crc = crc32(data), method = deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(e.time || 0, 10); lh.writeUInt16LE(e.date || 0x21, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(payload.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(e.time || 0, 12); ch.writeUInt16LE(e.date || 0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(payload.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, payload); centrals.push(ch, name);
    off += lh.length + name.length + payload.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6); eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}
export function gcodeFrom3mf(buf){
  const entries = zipRead(buf);
  const e = entries.find(x => x.name === 'Metadata/plate_1.gcode') || entries.find(x => x.name.toLowerCase().endsWith('.gcode'));
  if(!e) throw new Error('no G-code inside the container');
  return { name:e.name, text:e.data.toString('utf8') };
}

/* pack_bambu_3mf.py, in Node: analyse the G-code, patch the header, close the executable block, inject
   M73 progress per "; layer" marker, replace plate_1.gcode / .md5 / plate_1.json / slice_info.config. */
export function packBambu3mf(gcodeTextIn, templatePath, outPath, o = {}){
  if(/^;\s*layer\s+\d+\s+/m.test(gcodeTextIn)){
    const firstLayer=globalThis.WEFT_GATE.firstLayerAudit(gcodeTextIn);
    if(!firstLayer.PASS)throw new Error('WEFT package first layer refused: '+JSON.stringify(firstLayer.issues));
  }
  const name = o.name || 'weft.stl', layerHeight = o.layerHeight ?? 0.24, density = o.density ?? 1.26, accelFudge = o.accelFudge ?? 1.10;
  const FIL_AREA = Math.PI * (1.75 / 2) ** 2;
  const src = gcodeTextIn.split('\n');
  let x = 0, y = 0, z = 0, f = 1800.0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, maxz = 0, eTotal = 0, tTotal = 0, firstLayerT = 0;
  const zs = new Set();
  const num = /([XYZEF])(-?\d*\.?\d+)/g;
  for(let i = 0; i < src.length; i++){
    const l = src[i];
    if(l.startsWith('; layer ')) continue;
    if(!(l.startsWith('G0') || l.startsWith('G1'))) continue;
    const d = {}; num.lastIndex = 0; let m; while((m = num.exec(l))) d[m[1]] = parseFloat(m[2]);
    const nx = d.X ?? x, ny = d.Y ?? y, nz = d.Z ?? z; if('F' in d) f = d.F;
    const de = d.E ?? 0;
    let dist = Math.hypot(nx - x, ny - y); if(dist < 1e-9) dist = Math.abs(nz - z); if(dist < 1e-9 && de) dist = Math.abs(de) * 2.0;
    const dt = dist / (Math.max(f, 1.0) / 60.0); tTotal += dt;
    if(de > 0){ eTotal += de; if(nx < minx) minx = nx; if(nx > maxx) maxx = nx; if(ny < miny) miny = ny; if(ny > maxy) maxy = ny;
      if(nz <= layerHeight * 1.01 + 1e-6) firstLayerT += dt; zs.add(Math.round(nz * 1000) / 1000); maxz = Math.max(maxz, nz); }
    x = nx; y = ny; z = nz;
  }
  tTotal *= accelFudge;
  const nLayers = zs.size || 1, volCm3 = eTotal * FIL_AREA / 1000.0, weightG = volCm3 * density;
  const hms = (t) => { t = Math.round(t); const h = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h}h ${mm}m ${s}s` : `${mm}m ${s}s`; };
  const setHdr = (key, value) => { const pat = new RegExp('^; ' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:'); for(let i = 0; i < src.length; i++) if(pat.test(src[i])){ src[i] = `; ${key}: ${value}`; return; } };
  setHdr('model printing time', `${hms(tTotal)}; total estimated time: ${hms(tTotal * 1.01)}`);
  setHdr('total layer number', nLayers);
  setHdr('total filament length [mm] ', eTotal.toFixed(2));
  setHdr('total filament volume [cm^3] ', volCm3.toFixed(2));
  setHdr('total filament weight [g] ', weightG.toFixed(2));
  setHdr('max_z_height', maxz.toFixed(2));
  const perLayerE = []; let acc = 0;
  for(let i = 0; i < src.length; i++){ const l = src[i]; if(l.startsWith('; layer ')){ perLayerE.push([i, acc]); continue; }
    if(l.startsWith('G1') && l.includes(' E')){ const m = /E(-?\d*\.?\d+)/.exec(l); if(m){ const v = parseFloat(m[1]); if(v > 0) acc += v; } } }
  const out = []; let k = 0;
  for(let i = 0; i < src.length; i++){ if(k < perLayerE.length && perLayerE[k][0] === i){ const frac = eTotal ? perLayerE[k][1] / eTotal : 0; out.push(`M73 P${Math.trunc(frac * 100)} R${Math.round(tTotal * (1 - frac) / 60)}`); k++; } out.push(src[i]); }
  let gtxt = out.join('\n').replace(/\n+$/, '');
  if(!gtxt.includes('EXECUTABLE_BLOCK_END')) gtxt += '\n; EXECUTABLE_BLOCK_END\n';
  const gbytes = Buffer.from(gtxt, 'utf8');
  const md5 = createHash('md5').update(gbytes).digest('hex').toUpperCase();
  const tpl = zipRead(fs.readFileSync(templatePath));
  const r5 = v => Math.round(v * 1e5) / 1e5;
  const pyf = v => Number.isInteger(v) ? v.toFixed(1) : String(v);   // Python's str(float): 74.0, not 74
  const bbox = [r5(minx), r5(miny), r5(maxx), r5(maxy)], area = Math.round((maxx - minx) * (maxy - miny) * 1e4) / 1e4;
  const bboxS = bbox.map(pyf).join(',');
  const plateJson = `{"bbox_all":[${bboxS}],"bbox_objects":[{"area":${pyf(area)},"bbox":[${bboxS}],"id":1,"layer_height":${pyf(layerHeight)},"name":"${name}"}],` +
    `"bed_type":"textured_plate","filament_colors":["#FFFFFF"],"filament_ids":[0],"first_extruder":0,` +
    `"first_layer_time":${pyf(Math.round(firstLayerT * 1e4) / 1e4)},"is_seq_print":false,"nozzle_diameter":0.4000000059604645,"version":2}`;
  const siE = tpl.find(e => e.name === 'Metadata/slice_info.config');
  let si = siE ? siE.data.toString('utf8') : '';
  si = si.replace(/(key="prediction" value=")\d+(")/, (m, a, b) => a + String(Math.round(tTotal)) + b)
    .replace(/(key="weight" value=")[\d.]+(")/, (m, a, b) => a + weightG.toFixed(2) + b)
    .replace(/(key="first_layer_time" value=")[\d.]+(")/, (m, a, b) => a + firstLayerT.toFixed(6) + b)
    .replace(/(<object identify_id="\d+" name=")[^"]*(")/, (m, a, b) => a + name + b)
    .replace(/(used_m=")[\d.]+(")/, (m, a, b) => a + (eTotal / 1000).toFixed(2) + b)
    .replace(/(used_g=")[\d.]+(")/, (m, a, b) => a + weightG.toFixed(2) + b)
    .replace(/(layer_ranges=")[^"]*(")/, (m, a, b) => a + `0 ${nLayers - 1}` + b);
  const REPL = { 'Metadata/plate_1.gcode':gbytes, 'Metadata/plate_1.gcode.md5':Buffer.from(md5), 'Metadata/plate_1.json':Buffer.from(plateJson), 'Metadata/slice_info.config':Buffer.from(si) };
  if(o.thumb)Object.assign(REPL,makeBambuThumbnails(fs.readFileSync(o.thumb)));
  const entries = tpl.map(e => ({ name:e.name, data:REPL[e.name] || e.data, time:e.time, date:e.date, store:e.name.endsWith('.png') }));
  const thumbs=auditBambuThumbnails(entries);
  if(!thumbs.PASS)throw new Error('WEFT Bambu package refused: '+thumbs.issues.join('; '));
  fs.writeFileSync(outPath, zipWrite(entries));
  return { layers:nLayers, maxZ:+maxz.toFixed(2), filament_m:+(eTotal / 1000).toFixed(2), grams:+weightG.toFixed(1), bbox, firstLayer_min:+(firstLayerT / 60).toFixed(1), estimate:hms(tTotal), md5, bytes:fs.statSync(outPath).size };
}

/* ---------------------------------------------------------------------------------------------------
   the gate, on text or on a file (.gcode or .gcode.3mf) */
export function runGate(source, opts){
  let text = source, file = opts && opts.file;
  if(typeof source === 'string' && /\.(gcode|3mf)$/i.test(source) && fs.existsSync(source)){
    file = source;
    text = source.toLowerCase().endsWith('.3mf') ? gcodeFrom3mf(fs.readFileSync(source)).text : fs.readFileSync(source, 'utf8');
  }
  const res = checkGcode(text, Object.assign({}, opts, { file:file || '(text)' }));
  delete res._grid;
  return res;
}
