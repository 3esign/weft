/* The container must show the body it carries (2026-10-01). Three different bodies shipped for
   the A1 opened in Bambu Studio as three identical copies of the TEMPLATE's mesh — the harvested
   T1b wall — because packBambu3mf replaced the payload but never the display model. This holds
   the loft mesh watertight and the packer honest. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loftFromGeometry, objectModelXml, topViewPng } from '../core/weft_bambu_mesh.mjs';
import { packBambu3mf, zipRead, WEFT_ROOT, loadMachines } from '../core/weft_build.mjs';
import { pngInfo } from '../core/weft_bambu_thumbnails.mjs';

const square = s => { const p = []; for(const [a, b] of [[-s, -s], [s, -s], [s, s], [-s, s]]) p.push([a, b]); p.push([-s, -s]);
  const dense = []; for(let i = 0; i < p.length - 1; i++) for(let t = 0; t < 8; t++) dense.push([p[i][0] + (p[i + 1][0] - p[i][0]) * t / 8, p[i][1] + (p[i + 1][1] - p[i][1]) * t / 8]);
  dense.push(p[0]); return dense; };
const geo = { summary:{ name:'t', H:2 }, layers:[
  { k:0, zBot:0, zTop:1, paths:[{ role:'wall', pts:square(10) }, { role:'bridge', pts:[[-5, 0], [5, 0]] }] },
  { k:1, zBot:1, zTop:2, paths:[{ role:'wall', pts:square(8) }] }] };

const loft = loftFromGeometry(geo, { ringPoints:40 });
assert.equal(loft.H, 2);
assert.equal(loft.vertices.length, 3 * 40 + 2, 'rings plus two cap centres');
/* watertight: every directed edge is matched by its reverse exactly once */
const edges = new Map();
for(const [a, b, c] of loft.triangles) for(const [u, v] of [[a, b], [b, c], [c, a]]){
  assert.ok(u !== v && u < loft.vertices.length && v < loft.vertices.length, 'valid vertex indices');
  edges.set(u + ':' + v, (edges.get(u + ':' + v) || 0) + 1);
}
for(const [k, n] of edges){
  assert.equal(n, 1, 'directed edge used once: ' + k);
  assert.equal(edges.get(k.split(':').reverse().join(':')), 1, 'reverse edge present: ' + k);
}
const zsSeen = loft.vertices.map(v => v[2]);
assert.equal(Math.min(...zsSeen), -1); assert.equal(Math.max(...zsSeen), 1);
console.log(`PASS loft is watertight and centred (${loft.faceCount} faces)`);

const xml = objectModelXml(loft);
assert.equal((xml.match(/<triangle /g) || []).length, loft.faceCount);
assert.ok(xml.includes('<object id="1"') && xml.includes('</model>'));
console.log('PASS object model XML carries every face');

const png = topViewPng(geo, 256);
const info = pngInfo(png);
assert.equal(info.width, 256); assert.equal(info.height, 256);
console.log('PASS top view renders as a square PNG');

/* the packer replaces the template mesh, the names and the transform */
const m = loadMachines().a1;
if(m && m.route === 'bambu3mf' && fs.existsSync(path.join(WEFT_ROOT, m.containerTemplate))){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'weft-mesh-'));
  const out = path.join(tmp, 'T.gcode.3mf');
  packBambu3mf('G1 X128 Y128 Z0.24 E1 F1200\n', path.join(WEFT_ROOT, m.containerTemplate), out,
    { name:'T.stl', layerHeight:0.24, plate:m.plate, geometry:geo });
  const entries = zipRead(fs.readFileSync(out));
  const om = entries.find(e => e.name === '3D/Objects/object_1.model').data.toString('utf8');
  assert.ok((om.match(/<triangle /g) || []).length === loftFromGeometry(geo).faceCount, 'embedded mesh is the body, not the template');
  const ms = entries.find(e => e.name === 'Metadata/model_settings.config').data.toString('utf8');
  assert.ok(!ms.includes('T1b_tower40_diagonal'), 'template name gone');
  assert.ok(ms.includes('value="T.stl"'), 'body name present');
  const dm = entries.find(e => e.name === '3D/3dmodel.model').data.toString('utf8');
  assert.ok(dm.includes(`1 ${m.plate[0] / 2} ${m.plate[1] / 2} 1`), 'build item centres the body at plate centre, lifted by H/2');
  for(const n of ['Metadata/plate_1.png', 'Metadata/plate_1_small.png']) pngInfo(entries.find(e => e.name === n).data);
  fs.rmSync(tmp, { recursive:true, force:true });
  console.log('PASS packed container shows the body it carries');
} else console.log('SKIP packer check (no a1 bambu3mf template on this body)');
