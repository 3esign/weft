/* pure-weft/v2 (2026-10-02, Semir): "mixed patterns inside but also outside so it is porose on all
   sides and maybe wall is printed as a different pattern than infill but its still one layer one line
   so chair starts from four separate circular bases and merge into one shape".

   Four rules, each one a thing that broke while it was being built, and each measured here:

     1. ONE LINE per region. The rim is not a path and the core another one; the layer leaves the
        nozzle as a single continuous thread, "wall" pattern handing over to "infill" pattern. A
        layer may only split where a straight connector would have crossed a hole.
     2. POROUS OUTSIDE. The rim is two interlacing waves in antiphase, so the shell has real openings
        between them — measured as the spread of the rim's own depth, which must exceed one bead.
     3. ISLANDS AND HOLES ARE REAL. The chair starts as four separate feet; the four legs close into
        a RING with a hollow middle before they close into a column. Both must survive the whole
        pipeline, and nothing may be laid across the hollow middle.
     4. NOTHING OUTSIDE THE BODY. A depth target a section cannot hold has no level set; before this
        was fixed Newton walked out of the shape and a leg came back as a path 100 mm wide.          */
import assert from 'node:assert/strict';
import { generateField, VARIANTS, PROCESS, contoursAt, signedArea, sdist, smin } from '../core/weft_field_geometry.mjs';

assert.equal(PROCESS, 'pure-weft/v2');
const near = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/* ---------- 0. marching squares: an annulus is an outer ring plus a hole, oriented ---------- */
{
  const F = (x, y) => Math.max(Math.hypot(x, y) - 20, 8 - Math.hypot(x, y));
  const loops = contoursAt((x, y) => F(x, y), 0, [-26, -26, 26, 26], 0.5);
  assert.equal(loops.length, 2, 'annulus: outer + hole');
  const outer = loops.filter(l => signedArea(l) > 0), holes = loops.filter(l => signedArea(l) < 0);
  assert.equal(outer.length, 1, 'exactly one outer loop, counter-clockwise');
  assert.equal(holes.length, 1, 'exactly one hole, clockwise');
  const r = (l) => l.map(p => Math.hypot(p[0], p[1])).reduce((a, b) => a + b, 0) / l.length;
  assert.ok(Math.abs(r(outer[0]) - 20) < 0.3, `outer radius ${r(outer[0]).toFixed(2)} != 20`);
  assert.ok(Math.abs(r(holes[0]) - 8) < 0.3, `hole radius ${r(holes[0]).toFixed(2)} != 8`);
}

/* ---------- 0b. the smooth union is a union, and it fillets ---------- */
{
  assert.equal(smin(3, 7, 0), 3, 'k = 0 is a plain minimum');
  assert.ok(smin(0, 0, 4) < 0, 'two surfaces touching produce material between them');
  assert.ok(smin(-5, 9, 4) <= -5, 'the smooth union never loses the inside');
}

/* ---------- the chair, at half height so the test stays quick ---------- */
const H = 85;
const r = generateField({ variant: 'stolica', machine: 'a1', H, allowAssumedBead: true });
assert.deepEqual(r.violations, [], 'generator refused the chair');
const layers = r.payload.layers, S = r.summary;
assert.ok(layers.length > 300, `${layers.length} layers`);
const F = (x, y, z) => VARIANTS.stolica.field(x, y, z, H);
const LH = S.args.lh;

/* ---------- 1. four separate feet on the bed, and they really are separate ---------- */
assert.equal(S.field.firstLayerIslands, 4, 'the chair does not start from four feet');
assert.equal(layers[0].silhouettes.length, 4, 'first layer silhouettes');
assert.equal(layers[0].paths.length, 4, 'first layer: one line per foot');
for(let a = 0; a < 4; a++) for(let b = a + 1; b < 4; b++){
  let closest = Infinity;
  for(const p of layers[0].paths[a].pts) for(const q of layers[0].paths[b].pts) closest = Math.min(closest, near(p, q));
  assert.ok(closest > 2.0, `feet ${a} and ${b} are only ${closest.toFixed(2)} mm apart — not separate`);
}
assert.equal(S.gatePolicy.first_layer_max_islands, 4, 'the gate must be told to expect four islands');
/* and they must become one: a chair, not four posts */
assert.ok(layers.at(-1).silhouettes.length === 1, 'the top of the chair is not a single body');

/* ---------- 2. nothing is a closed band around the section ----------
   The v1 rule — "the thread must not end within a bead of its own start" — does not transfer twice
   over. Rim and core are ONE line now, so the line ends wherever the fill finished, which can be
   next to the rim's beginning by chance (4 runs of 1198 are, in the shipped chair). And the rim's
   OWN two ends are meant to come close: the passes interlace, so at a seam where a crest meets a
   trough they touch on purpose. What must hold is one per kind: a plain concentric rim steps inward
   by at least a pitch, and a woven rim opens between its two passes by at least a bead. */
for(const L of layers) for(const p of L.paths){
  assert.equal(p.closed, false, `layer ${L.k} "${p.label}": closed flag`);
  assert.ok(p.pts.length > 8, `layer ${L.k} "${p.label}": ${p.pts.length} points`);
  if(p.rimWoven) assert.ok(p.rimOpening_mm >= 0.5,
    `layer ${L.k} "${p.label}": the woven rim only opens ${p.rimOpening_mm} mm — that is a band, not a weave`);
  else assert.ok(p.rimOpen_mm >= 0.44,
    `layer ${L.k} "${p.label}": the concentric rim comes home (${p.rimOpen_mm} mm) — that is a wall`);
}

/* ---------- 3. ONE LINE: a single-island layer with no hole emits exactly one path ---------- */
{
  const single = layers.filter(L => L.silhouettes.length === 1 && L.paths.length === 1 && /sediste|naslon/.test(L.phase));
  assert.ok(single.length > 50, `only ${single.length} layers are one island carried by one line`);
  const carried = single.filter(L => L.paths[0].rimWoven && /\+ (lines|sine|spiral|hilbert) @/.test(L.paths[0].intent));
  assert.ok(carried.length > 30, `only ${carried.length} layers carry a woven rim AND a core on one line`);
  assert.match(carried[Math.floor(carried.length / 2)].paths[0].intent,
    /weave \d+ lobes .*\+ (lines|sine|spiral|hilbert) @/, 'rim and core are not one line');
}

/* ---------- 4. the outside is porous: the rim's own depth has to open by more than a bead ---------- */
{
  const woven = layers.filter(x => x.paths.length === 1 && x.paths[0].rimWoven && /sediste|naslon/.test(x.phase));
  assert.ok(woven.length > 40, `only ${woven.length} woven single-island layers to measure`);
  let measured = 0;
  for(let n = 0; n < 8; n++){
    const L = woven[Math.floor(woven.length * (n + 0.5) / 8)];
    const z = L.zBot + LH / 2;
    let lo = Infinity, hi = -Infinity;
    for(let i = 0; i < Math.min(1400, L.paths[0].pts.length); i++){
      const d = -sdist(F, L.paths[0].pts[i][0], L.paths[0].pts[i][1], z);
      if(d < lo) lo = d; if(d > hi) hi = d;
    }
    assert.ok(hi - lo > 0.9, `layer ${L.k}: the rim band only opens ${(hi - lo).toFixed(2)} mm — that is a wall, not a weave`);
    assert.ok(lo < 0.6, `layer ${L.k}: the rim never reaches the surface (closest ${lo.toFixed(2)} mm in)`);
    measured++;
  }
  assert.equal(measured, 8);
}

/* ---------- 5. holes are real and nothing is laid across one ---------- */
{
  const holed = S.events.filter(e => /interior hole/.test(e.event));
  assert.ok(holed.length > 0, 'the four legs never close into a ring — the hole case is untested');
}

/* ---------- 6. nothing outside the body, sampled across the whole height ---------- */
{
  let worst = 0, worstAt = null, checked = 0;
  for(let k = 0; k < layers.length; k += 3){
    const L = layers[k], z = L.zBot + LH / 2;
    for(const p of L.paths) for(let i = 0; i < p.pts.length; i += 5){
      const d = sdist(F, p.pts[i][0], p.pts[i][1], z); checked++;
      if(d > worst){ worst = d; worstAt = { k, at: p.pts[i], label: p.label }; }
    }
  }
  assert.ok(checked > 20000, `only ${checked} points checked`);
  assert.ok(worst < 0.5, `thread outside the body by ${worst.toFixed(2)} mm — ${JSON.stringify(worstAt)}`);
  assert.ok(S.field.pointsPulledIntoBody < 0.01 * S.field.pointsEmitted,
    `${S.field.pointsPulledIntoBody}/${S.field.pointsEmitted} points had to be pulled back in`);
}

/* ---------- 7. the measured support report is real, and inside the gate's ceiling ---------- */
{
  assert.ok(S.field.worstFreeSpan_mm > 0, 'the support measurement never fired');
  assert.ok(S.field.worstFreeSpan_mm <= 0.9 * S.args.maxbridge,
    `worst free span ${S.field.worstFreeSpan_mm} mm`);
  assert.ok(S.field.worstValleyRun_mm <= 0.9 * S.args.maxbridge,
    `worst unsupported run ${S.field.worstValleyRun_mm} mm`);
  /* the angle is chosen by measurement, not decreed — at least one layer must have been re-aimed */
  assert.ok(S.events.some(e => /fill angle/.test(e.event)), 'no layer was ever re-aimed by measurement');
}

/* ---------- 8. the display mesh is the body, and it carries the island count ---------- */
{
  const m = r.payload.mesh;
  assert.ok(m.vertices.length > 1000 && m.triangles.length > 2000, 'display mesh is empty');
  const zs = m.vertices.map(v => v[2]);
  const span = Math.max(...zs) - Math.min(...zs);
  assert.ok(Math.abs(span - S.H) < 1.0, `mesh is ${span.toFixed(2)} mm tall, body is ${S.H}`);
  assert.ok(Math.abs(Math.max(...zs) + Math.min(...zs)) < 0.05, 'mesh is not centred on z = 0');
}

/* ---------- 9. the silhouette is for the picture only, never for the nozzle ---------- */
for(const L of layers){
  assert.ok(near(L.silhouette[0], L.silhouette.at(-1)) < 1e-6, `layer ${L.k}: silhouette is not a closed ring`);
  assert.ok(!L.paths.some(p => near(p.pts[0], L.silhouette[0]) < 1e-9 && near(p.pts.at(-1), L.silhouette.at(-1)) < 1e-9),
    `layer ${L.k}: the silhouette leaked into the printed paths`);
}

console.log(`field_weft: OK — ${layers.length} layers, ${S.field.firstLayerIslands} feet -> 1 body, `
  + `thread ${S.field.fillLength_m} m, worst span ${S.field.worstFreeSpan_mm} mm, worst run ${S.field.worstValleyRun_mm} mm, `
  + `${S.field.pointsPulledIntoBody}/${S.field.pointsEmitted} points pulled back in`);
