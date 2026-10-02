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

/* ------------------------------------------------------------------------------------------------
   WHAT BRIDGES IS DECIDED BY THE LAYER BELOW (2026-10-02, ENDER PUN_KOCKA)

   The first cap layer is dense — 0.85 mm — so it was typed 'wall', and a 'wall' may be LOD'd: the
   builder's simplifyPts thinned its straight chords to vertices ~2.5 mm apart. Under it stood the
   last crescendo course, 4.71 mm apart. The gate decides support AT VERTICES, so a vertex spacing
   coarser than the pitch below ALIASES: the chord really crossed a line every 4.71 mm, but its
   surviving vertices kept landing between those lines, and the run was reported as a single
   19.79 mm LONG_BRIDGE that does not exist in the material. The same geometry passed on the A1
   only because 100 layers put the crescendo at 4.55 mm and the aliasing happened to miss.

   The rule: a fill is typed 'bridge' — vertices preserved, 0.5 mm sampling — when THIS layer is
   sparse OR the layer below is. Physically it is the honest type too: that course is bridging. */
for(const machine of ['a1', 'ender']){
  for(const variant of Object.keys(VARIANTS)){
    const r = generateSolid({ variant, machine, out: null, allowAssumedBead: true });
    const layers = r.payload.layers, program = r.summary.layerProgram;
    let checked = 0;
    for(let k = 1; k < layers.length; k++){
      if(!(program[k - 1].maxSpacing_mm > 1.2)) continue;
      const fill = layers[k].paths[1];
      if(!fill) continue;                                  // rim-only layer: nothing to type
      checked++;
      assert.equal(fill.role, 'bridge',
        `${machine}/${variant} layer ${k} "${fill.label}": the layer below stands ${program[k - 1].maxSpacing_mm} mm `
        + `apart, so this course bridges — it must be typed 'bridge' (preserved vertices), not '${fill.role}'`);
      /* preserved means sampled finer than the pitch it crosses, or the gate aliases again */
      let worst = 0;
      for(let i = 1; i < fill.pts.length; i++)
        worst = Math.max(worst, Math.hypot(fill.pts[i][0] - fill.pts[i - 1][0], fill.pts[i][1] - fill.pts[i - 1][1]));
      assert.ok(worst <= 1.2,
        `${machine}/${variant} layer ${k}: vertices up to ${worst.toFixed(2)} mm apart over a `
        + `${program[k - 1].maxSpacing_mm} mm pitch below — support cannot be measured at that sampling`);
    }
    console.log(`  ${machine}/${variant}: ${checked} courses over sparse material, all typed bridge`);
  }
}
console.log('pure_weft.test.mjs (bridge typing) OK');
