import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkGcode,WEFT_ROOT} from '../core/weft_build.mjs';
const txt=fs.readFileSync(WEFT_ROOT+'/specimens/_regression/FIXTURE_bad_floating.gcode','utf8');
const limited=checkGcode(txt,{bead:.42,maxislands:1}),full=checkGcode(txt,{bead:.42,maxislands:1,allProblems:true});
assert.equal(full.problem_count,limited.problem_count);assert.ok(full.problem_count>400);
assert.equal(limited.problems.length,400);assert.equal(full.problems.length,full.problem_count);assert.deepEqual(full.problems.slice(0,400),limited.problems);assert.deepEqual(full.stats,limited.stats);assert.equal(full.PASS,false);
console.log('PASS full gate reporting retains every refusal beyond display limit without changing classification');
