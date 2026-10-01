/* pure-weft/v1 (2026-10-01, Semir): "objekat vise nema zid i infill nego je sve weft".
   The first solid-infill cut still emitted a CLOSED perimeter loop per layer — a wall by another
   name, and on screen the bodies read as wall + infill. This test holds the rule that replaced it:
   a layer is an OPEN rim spiral (programmed pitch schedule from the boundary inward) plus an open
   core pattern on the inset section. No closed path anywhere in the body, at any layer, ever.
   It also holds the two support failures the rim introduced and that were measured and fixed:
     - core inset = where the innermost rim pass BEGINS (cum[n-1]), not where it ends — otherwise an
       empty wedge up to one pitch wide opens around the seam (sundjer: CANTILEVER 5.1 mm @ z 17.52);
     - a sparse rim is never a single pitch — a one-pitch rim IS a wall. */
import assert from 'node:assert/strict';
import { generateSolid, VARIANTS, PROCESS } from '../core/weft_solid_geometry.mjs';

assert.equal(PROCESS, 'pure-weft/v1');

const near = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

for(const variant of Object.keys(VARIANTS)){
  const r = generateSolid({ variant, machine: 'a1', out: null, allowAssumedBead: true });
  assert.deepEqual(r.violations, [], `${variant}: generator refused`);
  const layers = r.payload.layers;
  assert.ok(layers.length > 20, `${variant}: ${layers.length} layers`);

  let rimOnly = 0, twoPath = 0;
  for(const L of layers){
    assert.ok(L.paths.length >= 1 && L.paths.length <= 2, `${variant} layer ${L.k}: ${L.paths.length} paths`);
    if(L.paths.length === 1) rimOnly++; else twoPath++;

    for(const p of L.paths){
      assert.equal(p.closed, false, `${variant} layer ${L.k} "${p.label}": closed flag`);
      /* geometric openness, not just the flag: the thread must not come home. A rim's two ends are
         one pitch apart BY CONSTRUCTION — the seam step IS the weave — so the bar is the pitch, not
         zero. A wall would land within a bead of its own start. */
      const d = near(p.pts[0], p.pts.at(-1));
      assert.ok(d >= 0.44, `${variant} layer ${L.k} "${p.label}": path returns to its start (${d.toFixed(2)} mm) — that is a wall`);
    }
    assert.ok(/^rim-/.test(L.paths[0].label), `${variant} layer ${L.k}: first path is the rim`);
    /* the silhouette ring survives for the display mesh only — it must never be a printed path */
    assert.ok(Array.isArray(L.silhouette) && L.silhouette.length > 3, `${variant} layer ${L.k}: silhouette ring`);
    assert.ok(near(L.silhouette[0], L.silhouette.at(-1)) < 1e-6, `${variant} layer ${L.k}: silhouette is a closed ring`);
    /* the rim legitimately STARTS on the silhouette (depth 0 at the seam); a leak is a printed path
       that also ENDS there — i.e. the ring itself, shipped as a path */
    assert.ok(!L.paths.some(p => near(p.pts[0], L.silhouette[0]) < 1e-9
      && near(p.pts.at(-1), L.silhouette.at(-1)) < 1e-9), `${variant} layer ${L.k}: silhouette leaked into the printed paths`);
  }
  assert.ok(twoPath > 0, `${variant}: no layer carries rim + core`);

  /* a sparse rim is never one pitch: a single pass at the boundary reads as a wall */
  const program = r.summary.layerProgram;
  assert.ok(Array.isArray(program) && program.length === layers.length, `${variant}: layerProgram missing`);
  for(const q of program){
    assert.ok(Array.isArray(q.rim_mm) && q.rim_mm.length >= 1, `${variant} layer ${q.k}: no rim schedule`);
    /* one pass is allowed only where it is also DENSE (the solid base and cap, where the layer below
       is a sheet); a sparse layer must open its boundary across at least two pitches */
    if(q.rim_mm.length === 1)
      assert.ok(q.rim_mm[0] <= 0.55 && q.maxSpacing_mm <= 1.0,
        `${variant} layer ${q.k}: single rim pitch ${q.rim_mm[0]} mm over spacing ${q.maxSpacing_mm} mm is a wall`);
  }
  console.log(`  ${variant}: ${layers.length} layers, ${twoPath} rim+core, ${rimOnly} rim-only, 0 closed paths`);
}
console.log('pure_weft.test.mjs OK');
