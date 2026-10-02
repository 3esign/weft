/* pure-weft/v2, the SOKOL pass (2026-10-02, Semir): "experiment with all techniques, release your
   outmost creative force and make me a sculpture of SOKOL".

   Three things were added to the engine to make a falcon possible, and each of them is a claim about
   what comes out of the nozzle. This file measures the claims, not the intention.

     1. A SPATIAL WAVE ANCHOR. Until now the rim's wave counted lobes along the PERIMETER (t = 0 is
        wherever marching squares entered the contour) and the phase drifted per layer, so the
        openings spiralled. That is right for stone and down and wrong for a feather: a section that
        changes width redistributes every lobe under it, and a quill line cannot survive it. The new
        anchor is a standing wave in the plate's own coordinates, so the groove holds the same y (or
        the same x) from the first layer of the blade to the last.
     2. ONE HEIGHT, MANY PARTS. A single z in this body holds a tail blade and two scaled tarsi, or a
        trunk and two feathered wings. planFor answers per ISLAND, and the parts must really come out
        different in the same layer.
     3. THE FIGURE ITSELF. The rock is one island; three rise from it; the wings leave the flanks and
        come back, which is what makes the body porous on the OUTSIDE; and the two eye sockets are
        bored in from the sides without cutting the head in half. All four are properties of the
        FIELD, so they are measured straight from the field — no build, no G-code, no minutes.

   Plus the two new primitives, because a loft and a capsule are either exact or they are decoration. */
import assert from 'node:assert/strict';
import { generateField, VARIANTS, PROCESS, contoursAt, signedArea,
         profileAt, sdCapsule3 } from '../core/weft_field_geometry.mjs';

assert.equal(PROCESS, 'pure-weft/v2');
const hyp = Math.hypot;

/* ---------- 0. profileAt: a loft, clamped outside, and flat at every knot ---------- */
{
  const kf = [[0, 10, 1], [10, 20, 3], [20, 20, 7]];
  assert.deepEqual(profileAt(-5, kf), [10, 1], 'below the first knot the loft clamps');
  assert.deepEqual(profileAt(99, kf), [20, 7], 'above the last knot the loft clamps');
  assert.deepEqual(profileAt(0, kf), [10, 1], 'the first knot is exact');
  assert.deepEqual(profileAt(10, kf), [20, 3], 'an interior knot is exact');
  assert.deepEqual(profileAt(5, kf), [15, 2], 'smoothstep is symmetric at the midpoint');
  /* C1 at the knot: the slope has to die on BOTH sides or the body grows with a kink, and a kink in
     a loft is a step in the section the layer below cannot carry */
  const d = (z) => (profileAt(z + 0.01, kf)[0] - profileAt(z - 0.01, kf)[0]) / 0.02;
  assert.ok(Math.abs(d(10)) < 0.02, `slope at the knot is ${d(10).toFixed(3)}, should be 0`);
  assert.ok(d(5) > 1.4, 'the loft is not moving at all in the middle of a span');
}

/* ---------- 0b. sdCapsule3: exact on the cylinder, exact on both caps ---------- */
{
  const A = [0, 0, 0], B = [10, 0, 0];
  assert.ok(Math.abs(sdCapsule3(5, 3, 0, A, B, 2, 2) - 1) < 1e-9, 'beside the shaft');
  assert.ok(Math.abs(sdCapsule3(-3, 0, 0, A, B, 2, 2) - 1) < 1e-9, 'beyond the first cap');
  assert.ok(Math.abs(sdCapsule3(13, 0, 0, A, B, 2, 2) - 1) < 1e-9, 'beyond the second cap');
  assert.ok(sdCapsule3(5, 0, 0, A, B, 2, 2) < 0, 'the axis is inside');
  assert.ok(Math.abs(sdCapsule3(5, 0, 0, A, B, 4, 2) + 3) < 1e-9, 'the radius lerps along the axis');
  assert.equal(sdCapsule3(5, 0, 0, A, B, 2), sdCapsule3(5, 0, 0, A, B, 2, 2), 'one radius means both');
}

/* ---------- 1. the two anchors, measured on a blade that never changes section ----------
   A straight prism, so NOTHING about the shape can explain a difference between two layers. The
   front face's thread position is sampled as a function of y and compared across 40 layers.         */
const blade = (weave) => ({
  title: 'TEST', concept: 'a straight blade', H: 14, speed: 40,
  field(x, y, z){ const q = [Math.abs(x) - 6, Math.abs(y) - 18];
    return hyp(Math.max(q[0], 0), Math.max(q[1], 0)) + Math.min(Math.max(q[0], q[1]), 0); },
  bbox(){ return [-12, -24, 12, 24]; },
  planAt(k, z, zf, ctx){
    if(k < ctx.N_BASE) return { kind: 'lines', spacing: 0.85, angle: 0, tag: 'temelj', weave: { m: 0.22, amp: 0, gap: 0.55 }, plain: [0.5, 0.85] };
    return { kind: 'lines', spacing: 2.0, angle: 0, tag: 'blade', weave, plain: [0.45, 0.85, 1.5] };
  },
});
/* the front face's thread, binned by y: for each 1 mm of y, how far in from x = +6 does it sit? */
const faceProfile = (layer) => {
  const bin = new Map();
  for(const p of layer.paths) for(const q of p.pts){
    if(q[0] < 2.5) continue;                                    // front face only
    const b = Math.round(q[1]);
    if(Math.abs(b) > 14) continue;                              // skip the rounded ends
    const cur = bin.get(b);
    if(cur === undefined || q[0] > cur) bin.set(b, q[0]);       // the OUTERMOST thread at this y
  }
  return bin;
};
const compare = (a, b) => {
  let n = 0, worst = 0, sum = 0;
  for(const [k, v] of a){ const w = b.get(k); if(w === undefined) continue; n++; const d = Math.abs(v - w); sum += d; if(d > worst) worst = d; }
  return { n, worst, mean: sum / Math.max(1, n) };
};
{
  const W = { m: 0.22, gap: 0.8, amp: 1.05, lobeLen: 7 };
  VARIANTS.__blade_spatial = blade({ ...W, spatial: { lambda: 6, alpha: 90 } });
  VARIANTS.__blade_arc      = blade({ ...W, dphi: 0.6 });
  const spa = generateField({ variant: '__blade_spatial', machine: 'a1', allowAssumedBead: true });
  const arc = generateField({ variant: '__blade_arc',     machine: 'a1', allowAssumedBead: true });
  assert.deepEqual(spa.violations, [], 'the spatial blade was refused');
  assert.deepEqual(arc.violations, [], 'the arc blade was refused');

  const La = spa.payload.layers, Lb = arc.payload.layers;
  assert.ok(La.length > 50, `${La.length} layers`);
  const k0 = 20, k1 = La.length - 5;

  /* The wave must actually BE a wave, and the honest number is smaller than the amplitude: the two
     passes are in antiphase and their depths sum to a constant, so whichever one retreats, the other
     one comes forward. What an eye sees from outside is min(depthA, depthB) — with amp 1.05 and gap
     0.8 that is 0.8 mm of RELIEF, not 2.1 mm. The radial air between the passes is the other number,
     and it is the one that is a hole. Both are measured; neither is claimed to be the other. */
  const p0 = faceProfile(La[k0]);
  const xs = [...p0.values()];
  const relief = Math.max(...xs) - Math.min(...xs);
  assert.ok(relief > 0.6, `the spatial rim is flat (relief ${relief.toFixed(2)} mm) — there is no groove to stack`);
  let airMax = 0;
  { const lo = new Map();
    for(const pa of La[k0].paths) for(const q of pa.pts){ if(q[0] < 1.0) continue; const b = Math.round(q[1]);
      if(Math.abs(b) > 14) continue; const c = lo.get(b); if(c === undefined || q[0] < c) lo.set(b, q[0]); }
    for(const [b, v] of lo){ const hi = p0.get(b); if(hi !== undefined && hi - v > airMax) airMax = hi - v; } }
  assert.ok(airMax > 1.5, `the two passes never separate (${airMax.toFixed(2)} mm) — the shell is one skin`);

  /* SPATIAL: the groove holds its y across the whole blade */
  const s = compare(p0, faceProfile(La[k1]));
  assert.ok(s.n > 20, `only ${s.n} shared y bins`);
  assert.ok(s.mean < 0.25, `spatial anchor drifted ${s.mean.toFixed(2)} mm mean over ${k1 - k0} layers — the quill line does not stack`);

  /* ARC with drift: the same measurement on the same shape must NOT stack — that is the whole point
     of having two anchors, and if this ever stops being true the comparison above proves nothing. */
  const a = compare(faceProfile(Lb[k0]), faceProfile(Lb[k1]));
  /* 0.2 mm is not a small number here: the whole relief is 0.8 mm, so two uncorrelated samples of it
     differ by about a third of a millimetre on average and that is as large as this signal gets. The
     test that matters is the RATIO — the spatial anchor stacks to the rounding of the output. */
  assert.ok(a.mean > 0.2, `arc anchor drifted only ${a.mean.toFixed(2)} mm — the control is not drifting at all`);
  assert.ok(a.mean > 8 * Math.max(s.mean, 0.01),
    `arc ${a.mean.toFixed(3)} mm vs spatial ${s.mean.toFixed(3)} mm — the anchors are not telling two different stories`);
  delete VARIANTS.__blade_spatial; delete VARIANTS.__blade_arc;
  console.log(`  anchors: relief ${relief.toFixed(2)} mm, air between passes ${airMax.toFixed(2)} mm; spatial holds the groove to ${s.mean.toFixed(3)} mm over ${k1 - k0} layers, arc+drift moves ${a.mean.toFixed(2)} mm`);
}

/* ---------- 2. one height, many parts: planFor really reaches the island ---------- */
{
  VARIANTS.__two = {
    title: 'TEST', concept: 'two posts, woven differently in the same layer', H: 12, speed: 40,
    field(x, y, z){ return Math.min(hyp(x - 14, y) - 8, hyp(x + 14, y) - 8); },
    bbox(){ return [-28, -14, 28, 14]; },
    planAt(k, z, zf, ctx){ return { kind: 'lines', spacing: 2.0, angle: 0, tag: 'default',
      weave: { m: 0.22, amp: 0.7, gap: 0.7, lobeLen: 6 }, plain: [0.45, 0.85, 1.4] }; },
    planFor(L){ return L.cx > 0 ? { tag: 'desno', kind: 'spiral', spacing: 2.4 } : { tag: 'levo' }; },
  };
  const r = generateField({ variant: '__two', machine: 'a1', allowAssumedBead: true });
  assert.deepEqual(r.violations, [], 'the two-post body was refused');
  const L = r.payload.layers[r.payload.layers.length - 4];
  const tags = L.paths.map(p => p.label.replace(/-i\d+(-\d+)?$/, ''));
  assert.ok(tags.includes('levo') && tags.includes('desno'),
    `one layer, two parts: got ${JSON.stringify(tags)} — planFor never reached the island`);
  assert.ok(!tags.includes('default'), 'the layer plan leaked past the per-island override');
  const kinds = new Set(r.plan.at(-4).kinds);
  assert.ok(kinds.size >= 2, `both parts used the same fill: ${[...kinds]}`);
  /* and the per-island plan has to travel into the gate's own record of intent */
  assert.ok(L.paths.some(p => /desno/.test(p.intent)) && L.paths.some(p => /levo/.test(p.intent)),
    'the intent line does not name the part that asked for it');
  delete VARIANTS.__two;
  console.log(`  parts: one layer carried ${[...new Set(tags)].join(' + ')} with fills ${[...kinds].join('/')}`);
}

/* ---------- 3. the falcon itself, straight from the field ---------- */
{
  const V = VARIANTS.sokol, H = V.H, G = V.geom(H);
  const F = (x, y, z) => V.field(x, y, z, H);
  const bb = V.bbox(H);
  const at = (z) => {
    const raw = contoursAt(F, z, bb, 0.6).filter(r => Math.abs(signedArea(r)) > 1.2);
    return { out: raw.filter(r => signedArea(r) > 0), holes: raw.filter(r => signedArea(r) < 0) };
  };
  const n = (z) => at(z).out.length;

  assert.equal(n(2), 1, 'the rock is not one island');
  /* FIVE. The wings used to bud out of the tail blade, and the moment they peeled off cost four whole
     builds: two blades parting face to face hold each other by a strip a few tenths of a millimetre
     thick, and no pitch, angle or wave makes that printable. They now stand on the stone themselves,
     so the body has no split event at all and the only junction left is the shoulder. */
  assert.equal(n(G.rockTop + 3), 5, 'two tarsi, a tail blade and two wings do not rise from the rock as five islands');
  assert.equal(n(38), 4, 'the tarsi have not merged into one column by z = 38 (leaving tail + two wings)');
  /* the windows: the wings stand off the flanks for a long stretch, and this is the claim that the
     body is porous on the OUTSIDE rather than merely open inside */
  let openWin = 0;
  for(let z = 62; z <= 118; z += 4){ if(n(z) === 3) openWin++; else assert.fail(`z = ${z}: ${n(z)} islands, the wings are not clear of the flanks`); }
  assert.ok(openWin >= 14, `the windows are open over only ${openWin} samples`);
  assert.equal(n(128), 1, 'the wings never come back into the mantle');

  /* the sockets are bored in from the sides and stop short of each other: the brow has to carry the
     weave across, so the head may never become two islands */
  const brow = [];
  for(let z = G.eyeA[2] - G.eyeR + 0.5; z <= G.eyeA[2] + G.eyeR - 0.5; z += 1){ brow.push(n(z)); }
  assert.ok(brow.every(v => v === 1), `the sockets cut the head into ${Math.max(...brow)} islands`);
  /* And they are really there. The max WIDTH of the head does not change — the socket is bored at
     x = 13 and the head is widest at its centre — so the thing to measure is how deep the boundary
     now dips: the distance from the centroid to the NEAREST boundary point. Outside the eyes it is
     about 14 mm; at eye height the socket brings it under 6, which is the thread turning into the
     socket and back out, drawing the eye with the same line that draws the head. */
  const dip = (z) => { let best = 1e9;
    for(const r of at(z).out){ let cx = 0, cy = 0;
      for(const q of r){ cx += q[0]; cy += q[1]; } cx /= r.length; cy /= r.length;
      for(const q of r) best = Math.min(best, hyp(q[0] - cx, q[1] - cy)); }
    return best; };
  const open = dip(G.eyeA[2]), shut = dip(G.eyeA[2] - G.eyeR - 3);
  assert.ok(open < shut - 5, `nothing was bored out: the boundary dips ${open.toFixed(1)} mm at eye height against ${shut.toFixed(1)} mm below it`);

  /* the top closes, and the body ends where it says it ends */
  assert.ok(n(H - 1) === 1, 'the crown does not close to a single island');
  assert.equal(n(H + 2), 0, 'there is material above the declared height');
  /* the figure fits the A1 with the margin the builder demands */
  let x0 = 1e9, x1 = -1e9, y1 = 0;
  for(let z = 1; z < H; z += 2) for(const r of at(z).out) for(const p of r){
    if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0]; if(Math.abs(p[1]) > y1) y1 = Math.abs(p[1]); }
  assert.ok(x1 - x0 + 16 < 256 && 2 * y1 + 16 < 256, `${(x1 - x0).toFixed(0)} x ${(2 * y1).toFixed(0)} mm does not fit the A1`);
  console.log(`  sokol: ${(x1 - x0).toFixed(1)} x ${(2 * y1).toFixed(1)} x ${H} mm, 1 rock -> 5 risers -> 4 -> 3 (windows open at all ${openWin} samples from z 62 to 118; measured extent z 58..121) -> 1, brow intact`);
}

console.log('sokol_weft: OK');

/* ---------- 4. the checker must not pass a file it did not read ----------
   check_pure_weft read .gcode.3mf as plain text, found no G01 lines, and printed "no closed body
   path in any file". A green verdict on an unread file is worse than a red one, and it stood in the
   evidence chain of four shipped bodies. Both halves of the fix are measured here. */
{
  const { spawnSync } = await import('node:child_process');
  const fsx = await import('node:fs');
  const os = await import('node:os');
  const pathx = await import('node:path');
  const tool = new URL('../tools/check_pure_weft.mjs', import.meta.url).pathname.replace(/^\//, '');
  const empty = pathx.join(os.tmpdir(), 'weft_empty_probe.gcode');
  fsx.writeFileSync(empty, '; nothing here\nM104 S220\n');
  const r = spawnSync(process.execPath, [tool, empty], { encoding: 'utf8' });
  assert.equal(r.status, 1, 'a file with no extrusion must be REFUSED, not passed');
  assert.match(r.stderr, /NOTHING MEASURED/, 'the refusal does not say what was wrong');
  fsx.unlinkSync(empty);
  /* and a real container is now measured rather than skipped */
  const tpl = new URL('../specimens/2026-10-02_stolica_A1/STOLICA.gcode.3mf', import.meta.url).pathname.replace(/^\//, '');
  if(fsx.existsSync(tpl)){
    const c = spawnSync(process.execPath, [tool, tpl], { encoding: 'utf8' });
    assert.equal(c.status, 0, 'the chair container should pass');
    const m = /(\d+) body runs/.exec(c.stdout);
    assert.ok(m && +m[1] > 500, `the container was read as ${m ? m[1] : 'nothing'} body runs — still not unzipped`);
    console.log(`  checker: refuses an unread file; reads ${m[1]} runs out of a real container`);
  }
}
