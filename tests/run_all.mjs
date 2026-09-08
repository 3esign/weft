import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Order: the browser-free chain first (it needs only Node), then the parity tests that hold the Node
   chain to the browser builders and to the Python gate, then the legacy browser suite (49/61 legacy —
   the twelve known failures are documented in STATE.md and are not hidden here). A test that needs
   Playwright/Chromium or Python says so and is skipped with a notice when the tool is absent. */
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const has=(cmd,args)=>{ const r=spawnSync(cmd,args,{encoding:'utf8'}); return !r.error&&r.status===0; };
const chromium=has(process.execPath,['-e',"require('playwright')"])&&(process.env.WEFT_CHROMIUM||has(process.execPath,['-e',"const {chromium}=require('playwright');process.exit(chromium.executablePath()?0:1)"]));
const python=has(process.env.WEFT_PYTHON||'python3',['-c','import numpy, scipy']);
const plan=[
  ['build_parity.test.mjs',[]],                                  // Node chain == the printed LIMIT16 (G-code + 3MF)
  ['gate_parity.test.mjs',python?[]:['--no-python']],             // JS gate == Python gate (or the recorded JSON)
  ['aero_towers.test.mjs',[]],
  ['paired_sculptures.test.mjs',[]],
  ['limit16.test.mjs',[]],
  ['mcp.test.mjs',[]],
  ['core_parity.test.mjs',[],'chromium'],                         // core in Node == index.html in Chromium, byte for byte
  ['browser_gate.test.mjs',[],'chromium'],                        // the gate inside the page
  ['run_tests.mjs',[],'chromium'],                                // legacy browser suite (49/61 known)
];
let failed=0;
for(const [test,args,needs] of plan){
  if(needs==='chromium'&&!chromium){ console.log(`SKIP  ${test} (no Playwright/Chromium — set WEFT_CHROMIUM or npm install)`); continue; }
  console.log(`\n===== ${test} =====`);
  const result=spawnSync(process.execPath,[path.join(ROOT,'tests',test),...args],{cwd:ROOT,env:process.env,stdio:'inherit'});
  if(result.error) throw result.error;
  if(result.status!==0){ failed++; console.log(`----- ${test}: exit ${result.status}`); if(test!=='run_tests.mjs') process.exit(result.status??1); }
}
process.exit(failed?1:0);
