import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const r=spawnSync(process.execPath,[path.join(here,'audit.mjs'),path.join(here,'LIRA_A2L_geometry.json'),path.join(here,'package'),path.join(here,'probe_geometry.json'),path.join(here,'probe_package')],{encoding:'utf8',maxBuffer:8*1024*1024});
if(r.stdout)fs.writeFileSync(path.join(here,'audit.json'),r.stdout);
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
if(r.error)throw r.error;process.exitCode=r.status??1;
