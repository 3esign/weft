/* WEFT core parity — the engine extracted into core/weft_core.js must produce, in Node, the SAME
   bytes that index.html produces in Chromium for the same parameters: G-code, STL triangle stream,
   validity report. If this test fails, there are two sources of truth again.

   usage: WEFT_CHROMIUM=<chrome> node tests/core_parity.test.mjs   (Playwright + Chromium needed for
   the browser half; the Node half needs nothing). */
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { createHash } from 'crypto';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(pathToFileURL(path.join(ROOT, 'core', 'weft_core.js')).href);
const { createWeftCore } = globalThis.WEFT_CORE;

const HEAD = '; PARITY-HEADER {TEMP} {BED}\n; FEATURE: Custom\n; MACHINE_START_GCODE_END';
const FOOT = '; PARITY-FOOT\nM106 S0\nM104 S0';
const CASES = [
  { name: 'wall arc default', params: {} },
  { name: 'E1 batch plate', params: { mode:'batch', grid:4, sweepX:'overshoot', sweepY:'web', specW:28, specH:16,
      w:5, lambda:8, bead:0.45, lh:0.24, dwell:0.6, jitter:0, flowBoost:1.25, speed:30, bridgeSpeed:18,
      altPhase:true, autoLOD:true, minGap:1.4, amp:0, ampF:1, checkOv:true, overshoot:1.0,
      webType:'staple', gradeLean:false, temp:215, bed:55 } },
  { name: '360 dome staple + foundation', params: { mode:'dome', domeR:32, sweep:360, hFrac:0.95, capClose:true,
      webType:'staple', lambda:18, w:5, overshoot:1.0, adhesion:'foundation', adhesionWidth:8, firstLayerBead:0.52, firstLayerSpeed:15 } },
  { name: '270 dome eight jitter', params: { mode:'dome', domeR:40, sweep:270, hFrac:0.8, webType:'eight', lambda:9, jitter:0.3 } },
  { name: 'wall perp amp on A1', params: { machine:'a1', mode:'wall', wallH:20, webType:'perp', amp:1.0, ampF:2, plan:[{x:-40,y:-22},{x:18,y:-22},{x:18,y:30}] } },
  { name: 'wall diagonal sine cycle', params: { mode:'wall', wallH:12, webType:'diagonal', cycle:['chord','web','web'], dwell:1.2, plan:[{x:-45,y:0},{x:45,y:0}] } },
];
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const browser = await chromium.launch({ executablePath: process.env.WEFT_CHROMIUM || undefined,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 20000 });

let pass = 0, fail = 0;
for (const c of CASES) {
  /* fresh page per case: the app keeps P between calls (as it should), the core is created fresh */
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 20000 });
  const br = await page.evaluate(async ([params, head, foot]) => {
    seed = 1337;
    const v = weftEvaluate(params);
    document.getElementById('gHead').value = head; document.getElementById('gFoot').value = foot;
    const g = await buildGcodeText();
    rebuildScene();
    const parts = await buildSTLParts();
    let n = 0; for (const p of parts) n += p.byteLength;
    const u = new Uint8Array(n); let o = 0; for (const p of parts) { u.set(new Uint8Array(p), o); o += p.byteLength; }
    let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    const report = validityReport();
    return { gcode: g, stl: btoa(s), report };
  }, [c.params, HEAD, FOOT]);
  const W = createWeftCore();
  W.seed = 1337;
  const v = W.weftEvaluate(c.params);
  const g = await W.buildGcodeText(null, HEAD, FOOT);
  const parts = await W.buildSTLParts();
  const stlNode = Buffer.concat(parts.map(p => Buffer.from(p)));
  const stlBrowser = Buffer.from(br.stl, 'base64');
  const r = W.validityReport();
  const okG = g === br.gcode, okS = stlNode.equals(stlBrowser), okR = JSON.stringify(r) === JSON.stringify(br.report);
  const ok = okG && okS && okR;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}: gcode ${okG ? 'identical' : 'DIFFERS'} (${sha(g)} vs ${sha(br.gcode)}, ${g.length} bytes) · stl ${okS ? 'identical' : 'DIFFERS'} (${stlNode.length} bytes) · report ${okR ? 'identical' : 'DIFFERS'} · valid=${v.valid} layers=${v.layers} welds=${v.weldNodes}`);
  if (!okR) { console.log('   node   :', JSON.stringify(r).slice(0, 400)); console.log('   browser:', JSON.stringify(br.report).slice(0, 400)); }
  if (!okG) { const a = g.split('\n'), b = br.gcode.split('\n'); for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`   first gcode difference at line ${i}:\n     node   : ${a[i]}\n     browser: ${b[i]}`); break; } }
}
await browser.close();
console.log(`\n${pass}/${pass + fail} parity cases identical`);
process.exit(fail ? 1 : 0);
