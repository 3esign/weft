// Compatibility entry point for the historical Python command; shared guards only.
import fs from 'node:fs';
import {packBambu3mf} from '../core/weft_build.mjs';
const args=process.argv.slice(2),o={};
for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]===undefined)throw Error('expected --key value');o[args[i].slice(2)]=args[i+1];}
for(const k of ['gcode','template','out'])if(!o[k])throw Error('missing --'+k);
for(const k of Object.keys(o))if(!['gcode','template','out','name','thumb','layer-height','density','accel-fudge'].includes(k))throw Error('unknown --'+k);
const options={};for(const [arg,key] of [['name','name'],['thumb','thumb'],['layer-height','layerHeight'],['density','density'],['accel-fudge','accelFudge']])if(o[arg]!==undefined)options[key]=['name','thumb'].includes(arg)?o[arg]:Number(o[arg]);
console.log(JSON.stringify(packBambu3mf(fs.readFileSync(o.gcode,'utf8'),o.template,o.out,options),null,2));
