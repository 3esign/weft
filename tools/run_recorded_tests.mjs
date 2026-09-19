import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const dir=path.resolve(process.argv[2]),started=new Date().toISOString();
const out=fs.openSync(path.join(dir,'npm-test-after.log'),'w'),err=fs.openSync(path.join(dir,'npm-test-after.err.log'),'w');
const r=spawnSync(process.execPath,['tests/run_all.mjs'],{cwd:process.cwd(),stdio:['ignore',out,err]});fs.closeSync(out);fs.closeSync(err);
fs.writeFileSync(path.join(dir,'TEST_STATUS.json'),JSON.stringify({command:'node tests/run_all.mjs (package.json npm test target)',started,finished:new Date().toISOString(),exit:r.status,error:r.error?String(r.error):null,meaning:'Exit 1 is only accepted with the known 49/61 legacy tail; all preceding suites must complete.'},null,2));process.exitCode=r.status??1;
