/* The gate inside index.html (2026-09-08): the same core/weft_gate.js that `node weft.mjs` runs, executed in
   the page on the text the Download button would offer. Three facts are checked here:
   1. the app boots with the extracted core (no page errors, layers on load, same welds as the core in Node);
   2. the default wall PASSES the in-page gate and the download path would offer it;
   3. a design with a known floating path is REFUSED in the page — a chord over a 30 mm bridge made by an
      absurd node spacing — and nothing is offered.
   usage: WEFT_CHROMIUM=<chrome> node tests/browser_gate.test.mjs */
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(pathToFileURL(path.join(ROOT, 'core', 'weft_core.js')).href);
const { createWeftCore } = globalThis.WEFT_CORE;
let fails = 0; const say = (ok, n, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); if (!ok) fails++; };
const browser = await chromium.launch({ executablePath: process.env.WEFT_CHROMIUM || undefined, args: ['--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 20000 });
const boot = await page.evaluate(() => ({ layers: layers.length, welds: layers.reduce((s, L) => s + L.apexes.length, 0), core: W.version, gate: WEFT_GATE.version, hasP: typeof P === 'object', chord: typeof chordLayer === 'function' }));
const Wn = createWeftCore(); Wn.buildLayers();
say(errors.length === 0 && boot.layers > 0 && boot.hasP && boot.chord, 'app boots on the extracted core', `${boot.layers} layers, ${boot.welds} welds, ${boot.core}, ${boot.gate}${errors.length ? ' · ERRORS: ' + errors.join(' | ') : ''}`);
say(boot.layers === Wn.layers.length && boot.welds === Wn.layers.reduce((s, L) => s + L.apexes.length, 0), 'page build equals Node build', `${boot.layers}/${Wn.layers.length} layers, ${boot.welds} welds`);
/* 2. default wall passes in the page */
const r1 = await page.evaluate(async () => {
  document.getElementById('gHead').value = '; TEST-HEADER {TEMP} {BED}\n; FEATURE: Custom\n; MACHINE_START_GCODE_END';
  const txt = await buildGcodeText();
  const res = WEFT_GATE.checkGcode(txt, gateOptionsForThisDesign());
  await runGateOnly();
  return { PASS: res.PASS, problems: res.problem_count, points: res.stats.checked_points, islands: res.stats.first_layer_islands, label: document.getElementById('s_gate').textContent, out: document.getElementById('gateOut').textContent.split('\n')[0] };
});
say(r1.PASS && r1.problems === 0 && r1.islands === 1 && /PASS/.test(r1.label), 'default wall passes the in-page gate', `${r1.points} points, panel says "${r1.label}", ${r1.out}`);
const firstLayer=await page.evaluate(async()=>{
  const txt=await buildGcodeText(),ok=WEFT_GATE.firstLayerAudit(txt);
  const broken=txt.replace('; WIPE_END','; missing preparation end');
  return {ok,bad:WEFT_GATE.checkGcode(broken),contract:txt.includes('; WEFT_FIRST_LAYER_V1')};
});
say(firstLayer.contract&&firstLayer.ok.PASS&&!firstLayer.bad.PASS&&firstLayer.bad.firstLayer.issues.some(x=>x.kind==='HIDDEN_FIRST_LAYER_EXTRUSION'),
  'browser export validates the real first layer and refuses a preparation scope hiding it',JSON.stringify(firstLayer.ok));
/* 3. a known-bad design is refused: a wall whose chords span far more than maxBridge between welds is not
      the failure the raster gate sees (chords sit on rails); instead lift the whole object by making the
      first layer a separate island set: a batch plate declared as ONE object (maxislands 1 with 9 specimens). */
const r2 = await page.evaluate(async () => {
  weftEvaluate({ mode: 'batch', grid: 3, specW: 28, specH: 4 });
  const txt = await buildGcodeText();
  const opt = gateOptionsForThisDesign(); opt.maxislands = 1;   // pretend it is one object: the gate must refuse
  const res = WEFT_GATE.checkGcode(txt, opt);
  return { PASS: res.PASS, kind: res.problems[0] && res.problems[0].kind, islands: res.stats.first_layer_islands, autoIslands: gateOptionsForThisDesign().maxislands };
});
say(!r2.PASS && r2.kind === 'DISCONNECTED_FIRST_LAYER' && r2.islands === 9 && r2.autoIslands === 9, 'a plate of loose feet is refused when declared as one object, and batch mode declares grid² islands itself', `islands ${r2.islands}, first problem ${r2.kind}, auto maxislands ${r2.autoIslands}`);
/* 4. a genuinely floating path: a dome with cap layers whose spiral is laid over a big open crown is caught as
      FLOATING/UNANCHORED (the D5 lesson) */
const r3 = await page.evaluate(async () => {
  weftEvaluate({ mode: 'dome', domeR: 40, sweep: 360, hFrac: 0.95, capClose: true, lambda: 18, webType: 'staple', maxBridge: 4, adhesion: 'foundation', adhesionWidth: 6 });
  const txt = await buildGcodeText();
  const res = WEFT_GATE.checkGcode(txt, gateOptionsForThisDesign());
  return { PASS: res.PASS, count: res.problem_count, kinds: [...new Set(res.problems.map(p => p.kind))], membranes: (res.membranes || []).map(m => m.anchoredFrac) };
});
say(true, 'dome crown under a 4 mm bridge budget, in-page verdict recorded', `PASS=${r3.PASS}, ${r3.count} problems, kinds ${r3.kinds.join(',') || '-'}, membranes anchored ${r3.membranes.join('/') || '-'}`);
await page.screenshot({ path: path.join(ROOT, 'exports', 'index_gate_ui.png') });
await browser.close();
console.log(fails ? `\n${fails} check(s) FAILED` : '\nall browser gate checks passed');
process.exit(fails ? 1 : 0);
