import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

// Read the saved artefacts, not generator internals. The archived V1 is a
// positive control: a regression detector must catch the real observed defect.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (machine, version) => JSON.parse(fs.readFileSync(path.join(root,
  `VEZ_${machine}_${version}`, `VEZ_${machine}_${version}_geometry.json`), 'utf8'));
const v1 = read('ENDER', 'X1');
const v2 = read('ENDER', 'X2');
const tau = 2 * Math.PI;

function overlapLength(intervals) {
  let total = 0, union = 0, lo = null, hi = null;
  for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
    total += interval[1] - interval[0];
    if (lo === null) [lo, hi] = interval;
    else if (interval[0] <= hi + 1e-8) hi = Math.max(hi, interval[1]);
    else { union += hi - lo; [lo, hi] = interval; }
  }
  if (lo !== null) union += hi - lo;
  return Math.max(0, total - union);
}

function segments(layer) {
  return (layer.paths || []).flatMap(p => p.pts.slice(1).map((b, i) => [p.pts[i], b]));
}

// Project any near-collinear segment onto each boundary leg, then measure
// traversal length minus union length. This is independent of segment sampling
// and of direction: both a forward replay and a reversed replay are detected.
function duplicatedBoundaryLegMm(g, layer) {
  const all = segments(layer), rb = g.summary.rootRadius_mm;
  let duplicate = 0;
  for (const sector of g.summary.sectorRecipes) {
    for (const angle of [sector.a0, sector.a1]) {
      const x = Math.cos(angle), y = Math.sin(angle), intervals = [];
      for (const [a, b] of all) {
        if (Math.abs(a[0] * y - a[1] * x) > .002 || Math.abs(b[0] * y - b[1] * x) > .002) continue;
        const t0 = a[0] * x + a[1] * y, t1 = b[0] * x + b[1] * y;
        const lo = Math.max(rb + 1, Math.min(t0, t1));
        const hi = Math.min(rb + sector.reach - 1, Math.max(t0, t1));
        if (hi > lo) intervals.push([lo, hi]);
      }
      duplicate += overlapLength(intervals);
    }
  }
  return duplicate;
}

// On the root circle, use angular interval union, accounting for its seam.
function duplicatedRootMm(g, layer) {
  const rb = g.summary.rootRadius_mm, intervals = [];
  for (const [a, b] of segments(layer)) {
    if (Math.abs(Math.hypot(...a) - rb) > .003 || Math.abs(Math.hypot(...b) - rb) > .003) continue;
    let a0 = (Math.atan2(a[1], a[0]) + tau) % tau;
    let a1 = (Math.atan2(b[1], b[0]) + tau) % tau;
    if (a1 - a0 > Math.PI) a0 += tau;
    else if (a0 - a1 > Math.PI) a1 += tau;
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    if (lo >= tau) intervals.push([lo - tau, hi - tau]);
    else if (hi > tau) intervals.push([lo, tau], [0, hi - tau]);
    else intervals.push([lo, hi]);
  }
  return overlapLength(intervals) * rb;
}

const terraces = g => g.layers.filter(l => l.phase === 'terrace');

test('positive control: V1 repeats hundreds of mm of boundary legs and root per late layer', () => {
  const layer = terraces(v1)[59];
  assert.ok(duplicatedBoundaryLegMm(v1, layer) > 500, 'must detect original radial replay');
  assert.ok(duplicatedRootMm(v1, layer) > 250, 'must detect original root-ring replay');
});

test('V2 never replays boundary legs or root arcs in any terrace layer', () => {
  for (const layer of terraces(v2)) {
    const leg = duplicatedBoundaryLegMm(v2, layer), rootMm = duplicatedRootMm(v2, layer);
    assert.ok(leg < .03, `layer ${layer.k}: ${leg.toFixed(4)} mm repeated radial extrusion`);
    assert.ok(rootMm < .03, `layer ${layer.k}: ${rootMm.toFixed(4)} mm repeated root extrusion`);
  }
});

test('every pretie endpoint lands on actual previous-layer tip points and ties precede growth', () => {
  const layers = terraces(v2);
  for (let j = 1; j < layers.length; j++) {
    const previous = new Set(layers[j - 1].paths.flatMap(p => p.pts.map(v => v.join(','))));
    const paths = layers[j].paths, ties = paths.filter(p => p.label.startsWith('VEZ-pretie-'));
    assert.equal(ties.length, 12);
    assert.deepEqual(paths.slice(0, 12).map(p => p.label), ties.map(p => p.label));
    for (const tie of ties) {
      assert.equal(tie.closed, false, 'emitter may not rotate a pretie');
      assert.ok(previous.has(tie.pts[0].join(',')), `unsupported start at layer ${layers[j].k}`);
      assert.ok(previous.has(tie.pts.at(-1).join(',')), `unsupported end at layer ${layers[j].k}`);
    }
  }
});

test('growth starts/ends identically, route keys force protected transfer, final layer only ties', () => {
  const layers = terraces(v2);
  for (let j = 0; j < layers.length; j++) {
    const keys = new Set();
    for (const p of layers[j].paths) {
      assert.equal(p.closed, false);
      const key = `${p.row},${p.col}`;
      assert.ok(!keys.has(key), 'consecutive paths must use distinct travel keys');
      keys.add(key);
      if (p.label.startsWith('VEZ-frontier-')) assert.deepEqual(p.pts[0], p.pts.at(-1), 'distance tie prevents reversal');
    }
  }
  assert.equal(layers.at(-1).paths.length, 12);
  assert.ok(layers.at(-1).paths.every(p => p.label.startsWith('VEZ-pretie-')));
  assert.equal(layers.length, 61);
});

test('A2L uses the same revised terrace paths with only the machine Z clock changed', () => {
  const a2l = read('A2L', 'X2');
  assert.deepEqual(terraces(a2l).map(l => l.paths), terraces(v2).map(l => l.paths));
  assert.notEqual(a2l.summary.layerHeight_mm, v2.summary.layerHeight_mm);
});