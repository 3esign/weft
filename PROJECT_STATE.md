# PROJECT_STATE — read this first when resuming

Last updated: 2026-08-06 (revision pass — see §13 changelog). This file exists so that any future session — a fresh
Claude chat, Claude Code opened on this folder, or the author after a break —
can continue without the original conversation's memory. Everything decided,
built, verified, and pending is recorded here.

---

## 1. What this project is

**WEFT** is research software for a 3D printing method in which walls are
fabricated as **woven lattices**: the mesh midsurface is offset into two flange
("chord") lines; each layer prints as ONE continuous thread; layer roles
alternate by a grammar (chord rails / crossing webs); and structure arises from
discrete **weld nodes** where a fresh thread crosses the cooled thread below —
not from bulk interlayer contact. Registration is phase-locked so weld nodes
stack into vertical columns. End goal: continuous-toolpath **concrete**
printing (no retraction exists there, so whole-object single-thread continuity
is mandatory — already achieved here). Polymer on a **Bambu Lab A2L** is the
research vehicle.

Author: Semir Poturak · poturaksemir@gmail.com · repo intended for GitHub +
Vercel static deploy (preset "Other", no build).

## 2. Folder map

```
index.html      THE application (single file, ~1500 lines, Three.js r128)
vendor/         three.min.js vendored from npm → app runs fully OFFLINE
paper/          WEFT_draft.docx — method paper, experiments pending; refs need verifying
specimens/      knowledge base. README.md = manifest schema.
  2026-08_E1_pending/   Experiment 1 plate: STL + manifest + PRINT_INSTRUCTIONS
bridge/         OPTIONAL Node server: local CLI models behind the app (serve.js,
                cli.js, README.md, log/ = one JSON per design run)
presets/        presets.json (parameter vectors + measured numbers) plus the print
                files small enough to ship; big ones are params-only
tools_make_presets.mjs  headless preset generator (same code path as the UI buttons)
exports/        scratch for STL/G-code (gitignored)
PROJECT_STATE.md  this file
README.md       user-facing overview + run + safety workflow
```

Run: double-click `index.html` (offline-capable). Or `python -m http.server`.

## 2b. Machines (profiles in the app, 2026-08-26)

`MACHINES` carries both plates, and the picker moves all four dependants together:
bed outline, fit check, batch tiling clamp, G-code origin shift.

- **a2l** - Bambu A2L, 330 x 320, bed <= 80 C. DEFAULT, and it must stay the default:
  the E1 plate's batch pitch is computed from BED, and its bit-for-bit
  reproducibility with it.
- **a1** - Bambu A1, 256 x 256 x 256, 0.4 nozzle fitted, hotend <= 300 C, bed <= 100 C,
  PLA/PETG/TPU, textured PEI. Four are available for the experiment program. The E1
  plate is 141 x 122 mm, so the SAME file prints on every machine - which is what
  makes the between-machine replication experiment possible at all.

## 3. Hardware facts (verified via web search 2026-08)

Bambu Lab A2L: 330×320×325 mm build volume, open frame (PLA/PETG/TPU, not
engineering filaments), nozzles 0.2/0.4/0.6/0.8 (0.4 mounted), 300 °C max,
80 °C bed (deliberate open-frame limit), **bed-slinger** (A1-style Cartesian,
moving bed — NOT CoreXY; earlier note was wrong), closed-loop servo extruder,
vibration comp, batch-friendly. Launched 2026-06, verified against Bambu's
blog + spec sheets 2026-08-06. Slicer: Bambu Studio (Arachne engine —
recovers thin walls as single beads). G-code preview of external files:
**drag the .gcode onto the Preview tab** — there is no File→Import menu path
for G-code (the earlier "Import Sliced File" note was wrong).

## 4. Architecture of index.html (where things live)

All pattern synthesis happens in **(u, lateral) parameter space** (u = arc
length along the layer's slice curve; lateral = offset along its normal), then
maps to 3D. This rule is load-bearing — never synthesize in world space.

Key functions, in file order:
- `P` — all parameters (defaults are the tuned print settings).
- Centerlines: `resamplePlan` (wall polyline), `domeCl` (partial revolve),
  `meshSlice`/`parseOBJ` (import: plane-triangle slicing + segment chaining,
  longest chain wins). `clSample`, `mapUV`, `phaseAt`.
- Registration: `halfWave` (metric on walls, ANGULAR on domes — apex columns
  stay radial), `decimatedHalf` (dyadic LOD + optional lean grading),
  `apexUs` (node positions, alt-phase offset, seeded jitter; seed 1337 via `rnd`).
- Grammar: `chordLayer` (both flanges as a CLOSED RING — enables whole-object
  continuity), `webLayer` (5 types, see §5), `AfAt` (breathing chord line:
  width-wave amp × integer freq — integer keeps zeros ON node positions),
  `filletParam` (angle-adaptive bezier corner fillets), `emitParam`.
- Assembly: `buildFrom` (roles from `P.cycle`, dome spiral-cap trigger at
  radius floor, per-layer stamps: bead/speed/wSpan/webType/nodeGap —
  stamps exist so BATCH sweeps survive parameter restore), `buildBatch`
  (grid tiling, bed-clamped pitch), `detectOverlaps` (spatial hash;
  SKIPS web layers of type 'eight' — self-crossing is intentional there).
- Geometry: `simplifyPts` (0.03 mm display / 0.02 mm motion — this is what
  keeps big models exportable), `ribbon` (mitered, clamped, reversal fallback).
- Rendering: per-layer meshes (visibility slider is cheap), instanced node/
  overlap spheres, the "loom" strip (per-layer role navigator, clickable).
- Export: `exportSTL` / `exportGcode` — BOTH async + chunked with progress on
  the button (a synchronous export froze the tab at 170 MB once; never regress
  this). STL facets are wound OUTWARD (winding is reversed at write time
  because the scene→file y/z swap mirrors chirality). G-code: relative E
  (M83), stadium-cross-section extrusion volume (matches Arachne's model, so
  Route A and B lay the same volume), per-role speeds, bridge slowdown,
  TRUE first-layer slowdown (by z, not layer index — batch interleaves 16
  first layers), part fan on after layer 1 (`P.fan`), per-node flow boost
  within node radius, chord rings rotated to nozzle position and webs
  oriented by nearest end → no travel moves WITHIN an object, one thread per
  object; hops BETWEEN batch specimens get retract + z-hop (they are
  separate threads by definition, and an unretracted 38 mm drag across
  fresh lattice strings and snags).
- Plan editor: click line = insert, empty = append, drag = move,
  right-click = delete, hover highlight.

## 5. The five web grammars (and why)

- **diagonal** — truss; members axial; dwell = flat apex landings.
- **perp** — square wave; runs sit BEYOND chords by e (never on them); one
  vertical rung crosses both chords. Vierendeel frame → hardest test of weld
  moment capacity. Its offset runs are λ/2 bridges (stat reflects this).
- **staple** — runs ON the chords (stack on rails, fully supported); crossing
  = staple: out-tab → hairpin → weld leg over both chords → hairpin → in-tab.
  Hairpin offset ≥1.15×bead puts legs SIDE-BY-SIDE at single height (never
  stacked → no plow bump). 2 nodes/rung.
- **sine** — smooth wave at Af+e; curvature braces the fresh bead (concrete
  rationale).
- **eight** — loop stitch: PROLATE CYCLOID u=c(φ−1.8·sinφ), lat=−(Af+e)·cosφ.
  u reverses at alternating apexes → thread loops over itself AND hooks around
  the chord below (mechanical interlock + weld). Nodes detected numerically at
  chord crossings. NOTE (recorded in paper): lat=sin φ version is provably
  injective (cannot self-cross) — a test caught this; keep cos.

Weld controls: overhang e (symmetric, both chords; wall true width = w+2e),
dwell, seeded jitter (anti shear-plane; seed goes in specimen manifests),
flow boost (G-code only). Node markers sit at TRUE crossings, not apexes
(diagonal offset = half·e/(2·Aw); sine at |sin|=A/Aw).

## 6. Density system

- **Auto LOD** (on): when physical node spacing < floor (max(minGap,
  2.2×bead)), spacing doubles dyadically — "knitting decreases". Powers of 2
  keep surviving columns EXACTLY on the base grid → registration survives
  every transition. Verified: floor held 1.43 mm on the R71 full dome, bands
  m=1/2/4/8. HONEST FINDING: LOD cut only ~4% of total nodes there — the apex
  pathology is visually dominant, numerically minor; global density is the
  designed λ, not a bug.
- **Grade by lean** (optional, dome-only): spacing follows a smoothstep in
  lean angle from λ (below 30°) to λs (above ~80°), quantized to the same
  dyadic hierarchy (refinement to 4× allowed; new columns start cleanly on
  continuous chords). Replaces radius-proportional accident with a policy.
  HYPOTHESIS for the physical program: dyadic transition bands are weak lines.

## 7. Fabrication interface — the two routes

- **Route A (STL)**: swept-bead solids at the CALIBRATED single-line width →
  Bambu Studio slices normally; Arachne recovers each layer as one continuous
  extrusion; Studio owns all machine startup. Zero-risk path. (Empirically
  validated by the author on Bambu before this project.)
- **Route B (G-code)**: motion-only, sandwiched in start/end blocks HARVESTED
  from any file Studio slices for this machine (paste into header/footer
  fields — never hand-write A2L startup). Import the result back into Studio
  and INSPECT THE PREVIEW before printing. Route A vs B preview agreement =
  end-to-end emitter check. B adds node flow boost — the actual weld method.

## 8. Verified invariants (now a COMMITTED test suite: `npm test`)

The invariants below are no longer a claim from a lost session — they run as
`tests/run_tests.mjs` (Playwright + headless Chromium against the real
index.html; **52 checks** as of 2026-08-26, all passing). The core set was
measured 2026-08-06:

Angular phase lock across dome layers 8.9e-16 rad (< 1e-9) · width-wave
zeros on nodes 7.9e-14 mm (< 1e-12; the old "<1e-14" was a shade optimistic)
· miter at 90° = hw·√2 to 1e-9 · staple tabs reach ±(w/2+e), hairpin gap
0.5175 mm @ bead 0.45, max segment 0.693 mm · eight: 4 self-crossings + 19
chord-crossing welds per 40 mm · fillets: worst interior turn 28.1° at amp=0
(SCOPED: with width modulation amp≥2 the modulated-run/rung corners kink up
to ~72° — see §10; every current experiment runs amp=0) · grading tracks
target within √2 dyadic band across 9 lean samples · simplification: 340°
ring 602→102 pts @ 0.032 mm max deviation · E1 plate: 1072 layers, 0
overlaps, Z starts at exactly 0, bbox 147.6×126.6 with fiducial — and the
plate REGENERATES BIT-FOR-BIT from the app (269 520 triangles and the
coordinate checksum match the shipped STL; asserted in the suite) · G-code:
all 16 first layers ≤15 mm/s, fan on after layer 1, 1071 retract+hop pairs
between specimens, clean footer · STL: outward winding (signed volume
+7409.5 mm³), stored normals agree with winding on every sampled facet.

## 8b. The parameter interface and the governor (2026-08-26)

`weftParams()` exports the whole vector; `applyWeftParams()` takes one back and
REFUSES bad keys by name instead of coercing them; `validityReport()` returns the
machine-readable verdict (errors = will not print, or is not the method; warnings =
printable but outside the design intent), computed from the same aggregation the
status panel uses - one source of truth. `weftEvaluate(params)` is the whole loop:
params in, build, verdict out.

This is the contract the language-model work is held to: **the model proposes
parameters, never geometry.** The compiler is the governor. `bridge/serve.js` puts
local CLIs (Claude Code / Codex / Antigravity, discovered by probing `--version`,
ordered-strategy fallback as in Svemir's cli_bridge) behind that contract and logs
every exchange to `bridge/log/` - brief, each attempt, raw reply, what was applied,
what was rejected and why, the verdict, the final parameters. That log is the
dataset for the paper's benchmark; attempts-to-valid per model is a number.

The app is unchanged when the bridge is absent: the panel only appears if
`/weft/providers` answers, so `index.html` alone is still the whole product.

## 9. Experiment 1 — READY, NOT PRINTED

`specimens/2026-08_E1_pending/` holds the plate. 4×4: rows = web type
(diagonal/perp/staple/sine), cols = overhang e (0/0.6/1.2/1.8; col 0 is the
tangential-kiss CONTROL). Fixed: w5 λ8 lh0.24 PLA 215/55, 30 mm/s. Fiducial
8 mm bar outside the row0/col0 corner. **Bead 0.45 is a PLACEHOLDER — see
PRINT_INSTRUCTIONS.md step 1 (calibrate, regenerate if off by >0.03).**
Decision logic: if perp survives handling ≈ diagonals → welds are moment-
capable joints; if only diagonals → welds are hinges (design as truss).
Fracture: member snaps = cohesive (material-limited); peels off chord =
adhesive (welds govern; e + flow boost are the levers).

## 10. Deliberately deferred (do not "fix" casually)

- Import registration is ARC-LENGTH based → tapered imports drift phase.
  Real fix = coherent midsurface parameterization (conformal/ARAP). Deferred.
- Fillet sampling is uniform-t on the quadratic bezier → for very sharp
  corners (steep width-modulated run meets a rung, ~160°+ turn) curvature
  concentrates mid-fillet and chord turns reach ~72° at amp≥2. Fix =
  angle-uniform t (closed form t=sinφ/(sinφ+sin(A−φ))). DELIBERATELY not
  fixed now: it changes emitted points for ALL fillets and would break
  bit-reproducibility of the pending E1 plate. Do it after E1 prints,
  regenerating reference checksums in tests/.
- RESOLVED 2026-08-13 (corner pass): plan corners are now auto-rounded to
  the wall's minimum physical radius (w/2+e+bead, `roundPlanCorners`), and
  staple/perp crossings are SKIPPED where the inner-side leg spacing would
  compress below one bead (`rungTooTight`, signed curvature via `curvAt`).
  L-corner, S-arc and a hostile zigzag all build with 0 overlaps and 0
  inner-rail folds (tests T12/T12b/T12c); straight plans are bit-identical
  (E1 checksum unchanged). Corner zones trade a few welds for
  printability — the checker still reports honestly whatever remains.
- Converging plan walls don't merge into one bead (dome cap is the only merge
  case). Planned: Clipper-style offset-union + medial axis; splice, not weave.
- **CLOSED REVOLVES: DIAGNOSED AND FIXED 2026-08-26.** A 360 deg dome used to put
  ~800-2200 unintended overlaps into every model, at every web type and every lambda.
  Two independent causes, both now fixed and locked by tests T16a-f:
  (1) the CHORD ring - on a closed turn u=0 and u=total are the same place, so the
  wall's racetrack put BOTH cross-connectors on one angle, one exactly on top of the
  other: 8 overlaps per chord layer, 799 per dome, all at +/-180 deg. A closed turn is
  now drawn as outer turn -> ONE radial crossover -> inner turn, each turn stopping a
  step short of its own start, so no point on the path is ever revisited.
  (2) the WEB pattern did not TILE the turn - the apex grid was laid out from u=0 with
  a pitch that did not divide the circumference (measured: 95 apexes, the last one
  0.99 mm from the first against a 4 mm pitch). The pitch is now snapped so a whole
  number of waves fits the turn (rounded to a multiple of 16 half-waves so dyadic LOD
  keeps dividing it exactly), the apex count is derived from that, and the grid is
  offset by half a BASE half-wave so the seam falls on a plain run between nodes.
  Anchoring that offset to the base grid rather than the decimated one is what keeps
  weld columns stacked through every LOD band - the first attempt anchored it to the
  layer's own pitch and put m=2 columns exactly between the m=1 columns, which the
  phase-lock test caught.
  A third consequence had to be fixed with it: the width wave's zeros must sit ON the
  node columns, and the half-step offset moved the nodes onto the wave's EXTREMA, so
  the flanges pinched exactly where the rungs cross (13 overlaps at amp 1.0, 7873 at
  1.5, while 180/270 deg domes and every wall stayed clean). The wave is now shifted a
  quarter period on closed turns.
  VERIFIED after the fix: 0 overlaps at 180/270/360 deg for staple, diagonal, sine and
  perp; with jitter; with lean grading; with width modulation to amp 2.0; on R40, R60
  and R71; thread continuous across the seam (max segment 1.25 mm, no jumps); G-code
  clean with no NaN and no travel over 3.8 mm. Walls are untouched - the E1 plate still
  regenerates bit-for-bit. NOTE: on a closed revolve lambda is now QUANTISED by the
  snap (at R60, lambda 9 and 10 both land on an effective 9.42 mm); T1b bounds the
  distortion to 10% of the requested value.
- **THE NODE-GAP FLOOR IS NOT SUFFICIENT ON CURVED CENTERLINES (measured
  2026-08-26).** On the R60 dome, lambda=5 and lambda=6 produce 99 and 72 overlaps
  while still passing the gap floor (1.42 and 1.60 mm against a 1.40 mm floor): the
  staple's lateral excursion collides before node spacing does, because curvature is
  not in the floor's formula. lambda >= 7 is clean there. The independent overlap
  detector - not the floor - is what makes this safe, which is the honest form of
  the "valid by construction" claim.
- **LEAN GRADING ~= DYADIC AUTO-LOD IN THE TESTED WINDOW (measured 2026-08-26).**
  On the R60 270 deg dome, graded and ungraded produced identical weld counts and
  identical thread length to the millimetre at both lambda=8 and lambda=16. The
  graded target is clamped to the same floor and quantised onto the same dyadic
  rungs, so it lands where auto-LOD already lands. Grading is a stated POLICY, not a
  different outcome, in this parameter range - the paper must say so rather than
  implying graded geometry differs.
- Structural frame solver: sequenced AFTER E1 (E1 measures the joint
  stiffness it needs).
- Lean grading for imports (needs per-slice normal estimation).
- Manifest export FROM the app UI (E1's manifest was generated headlessly;
  wiring a "download manifest" button in batch mode is a good next code task).

## 10b. Presets (2026-08-26)

`presets/presets.json` holds twelve parameter vectors with their measured numbers
(layers, welds, size, overlaps, estimated time) for the three-day, four-A1 program:
C1 calibration ladder, E1 web x overhang, P2 lambda x web, P3 span x overhang,
R1 Route A / Route B coupon pair, D2 dome lambda-ladder (7/9/12/16, FULL 360 deg domes since
the closed-revolve fix), X1 spiral, X2 single-stroke letter. Files <= 20 MB ship beside it; the rest are params-only
(load the preset, press Download STL). The suite asserts every preset still builds
valid with zero overlaps AND still matches its recorded numbers, so a preset cannot
drift away from the app unnoticed.

## 11. Immediate next steps, in order

1. Calibrate single-line width on the A2L → print E1 via Route A →
   photograph plate untouched → fill manifest outcomes → rename folder.
2. Same plate via Route B (harvested header) → isolates flow-boost effect.
3. Feed results back: they set weld-model constants and decide truss-vs-frame
   for everything downstream.
4. Paper: references are now VERIFIED — full corrected citations with DOIs
   sit in `paper/references_verified.md` (incl. real candidates for the two
   placeholder refs, with one honesty caveat on the sinusoidal-bracing
   claim). Remaining: paste them in, fill affiliation, scope the fillet
   claim in §4 (28° at amp=0, not a blanket 35°), fix the Bambu Studio
   import wording in §3.8/§7, add figures (app screenshots: role cycle,
   5 web types with nodes visible, graded dome).
5. Then, by results: solver / merging / import parameterization.

## 12. How to resume with Claude

**Fresh chat**: attach `index.html` + this file; say "Continue the WEFT
project; PROJECT_STATE.md is the brief; today I want to ___". The app file +
this brief carry everything needed. If print results exist, attach photos +
the filled manifest — that's the moment the project has been building toward.

**Claude Code** (desktop app, Code tab → open this folder): it reads this
file and the commented source directly; use it for in-place edits + git.
Design debates stay in chat; disk edits in Code.

**Conventions to preserve**: single-file app, no build step (package.json
exists ONLY for the test harness) · synthesize in parameter space only ·
every density change stays on the dyadic grid · exports stay async · new
specimen prints always get a manifest with the jitter seed · never
hand-write printer start G-code — harvest it · run `npm test` after any
geometry-touching change; if a change is MEANT to alter geometry, regenerate
the E1 reference checksums consciously, never casually.

## 13. Changelog — 2026-08-06 revision pass (external review)

Independent review session: read everything, re-verified §8 headlessly,
fact-checked hardware + paper references on the web, then fixed what was
safely fixable without touching pending-experiment geometry. The E1 plate
STILL regenerates bit-for-bit (asserted by the suite) — none of these
changes alter synthesized paths.

Fixed in index.html:
- G-code first-layer speed keyed on `zBot===0`, not array index `k===0`:
  in batch mode only 1 of 16 specimens got the 15 mm/s first layer; the
  other 15 ran at bridge speed (18) — adhesion risk. Same fix for the
  chord-bridge rule (`zBot>0`).
- G-code had NO part-fan control (PLA lattice would print with fan off on
  Route B): `P.fan` param + slider, `M106` after layer 1, `M106 S0` in the
  default footer.
- G-code travels between batch specimens (~38 mm, every layer, 1071 of
  them on E1) were unretracted, unhopped drags at lattice height:
  now retract 0.8 + z-hop 0.4 between specimens (never within an object —
  continuity is the method).
- G-code extrusion used rectangular bead area (≈13% over vs slicers):
  now the standard stadium section (w−h)·h+π(h/2)² — matches Arachne, so
  the Route A/B comparison isolates flow boost as intended.
- STL export wrote inside-out facets (scene y-up → file z-up swap mirrors
  chirality; every shipped shell had negative signed volume, slicers were
  silently repairing): winding reversed at write, normals consistent.
  `specimens/2026-08_E1_pending/weft_batch_4x4.stl` rewound in place —
  same 269 676 triangles, same coordinates, same fiducial, volume now
  +7413.2 mm³, 100% normal/winding agreement.
- Overlap checker used live `P.overshoot` for its path-distance exclusion;
  batch layers now stamp `ovh` and the checker reads the stamp (a sweep
  with e beyond the restored value could false-flag).
- Jitter seed now resets per build in ALL modes (was batch-only): a
  manifest's `jitter_seed` could not actually reproduce wall/dome geometry
  across rebuilds — contradicted the paper's reproducibility claim.
- App opened showing ONLY layer 0 (visK started at 0): now opens on the
  full model.
- Bed fit checked 330×330; A2L bed is 330×320: fit check, status label and
  bed outline now use the real rectangle.
- Layer bar showed the CURRENT web-type selection for every web layer;
  now shows the layer's stamped type (batch rows read correctly).
- Modal + README: Bambu Studio has no "File→Import→Import Sliced File" for
  G-code; correct flow is dragging the file onto the Preview tab.
- Guard if vendor/three.min.js is missing (blank hang → clear message).

Added:
- `tests/run_tests.mjs` + `package.json` — 30-check suite (see §8).
- Exporters split into pure builders (`buildGcodeText`, `buildSTLParts`) with
  thin DOM/download wrappers — behavior identical, but the suite now calls
  the builders directly instead of intercepting browser downloads (flaky
  headless). A generated `index_standalone.html` (three.js inlined, for
  testing away from the folder) is built FROM index.html and is not a
  second source of truth — regenerate it after any app change.
- `paper/references_verified.md` — all 8 references verified/selected with
  DOIs; two prose corrections flagged for the draft.
- `REVIEW_2026-08-06.md` — full findings report (what was checked, what
  broke, what was overclaimed, what was left alone and why).

Known limits documented, deliberately NOT fixed (see §10): fillet kinks at
amp≥2, staple crowding on tightly curved plans, arc-length import drift.

2026-08-13 addendum (first physical prints):
- Route A pilot coupon (staple, e=1.2, bead 0.45 placeholder, A2L, PLA):
  weave printed correctly on the first attempt; specimen popped off the
  textured plate at 98% (small first-layer contact + bed-slinger shake) —
  brim/glue now standard for lattice prints. Destructive test: strong
  longitudinally, split at the wall mid-plane under transverse bending —
  stitch legs failed leaving stubs on both rails (largely cohesive);
  transverse strength is governed by one bead cross-section per stitch.
- G-code emitter bug found on the first harvested-header run and FIXED:
  the model frame is bed-centered but the A2L origin is front-left; the
  emitter now shifts by (BED/2, BEDY/2). Would have printed half off the
  plate; caught in the generated file before it reached the machine.
- First Route B file generated from a real harvested A2L start/end block
  (weft_pilot_routeB.gcode): validated on-bed, 67 layers, first layer
  ≤15 mm/s, fan from layer 2, single continuous thread per layer,
  brim loops post-spliced. Awaiting print.

2026-08-26 addendum (A1 machines, parameter interface, model harness, presets):
- Machine profiles added (2b). Default stays A2L; the E1 plate still regenerates
  bit-for-bit. New checks: A1 bed 256x256 with the label following, G-code origin
  shifting by exactly half the bed delta (dX -37, dY -32), A1 bed ceiling 100 C,
  and the E1 plate fitting an A1 plate with margin.
- JSON parameter interface, machine-readable validity report and weftEvaluate (8b),
  with a preset picker and load/save parameter files in the sidebar.
- bridge/ - optional Node server putting local CLI models behind the governor
  contract, logging every design run as the benchmark dataset.
- presets/ - twelve verified parameter vectors for the three-day program (10b),
  generated headlessly by tools_make_presets.mjs through the app's own exporters.
- Three measured findings, all limits rather than wins, recorded in 10:
  the closed-revolve seam, the insufficiency of the node-gap floor on curved
  centerlines, and lean grading being indistinguishable from auto-LOD here. Two of
  the three were caught by the suite refusing to let a preset ship.
- Headless export note: Chromium backgrounds the page and clamps setTimeout(...,0)
  to ~1 s, so the chunked exporters crawled (130 s for the E1 STL). The harness and
  the generator now launch with background-timer throttling disabled.
- Test count 30 -> 44.

2026-08-26 later the same day (closed revolves solved):
- The 360 deg dome/sphere defect was diagnosed to two independent causes and fixed;
  a third (the width wave sliding off the node columns) was introduced by the fix and
  fixed with it. Full account in section 10. Six new checks T16a-f lock it: no
  overlaps on any web grammar at 360 deg, exact tiling (seam gap == node pitch),
  decimated bands still on the base column grid, the chord ring never revisiting a
  point, width modulation clean at amp 1.5 freq 2, and thread continuity across the
  seam. T1 was rewritten to test the invariant that actually matters - every weld
  column on ONE angular grid across every LOD band - plus T1b bounding the pitch snap
  and T1c asserting open sweeps still sit on the exact lambda/(2R) grid.
- Dome presets moved to full 360 deg domes; the lambda ladder is now 7/9/12/16.
- The bridge was exercised end to end against a real Claude Code CLI: brief in,
  parameters out, built and validated by the app, accepted on the first attempt in
  53.8 s, run written to bridge/log/. The panel, the picker, the repair loop and the
  logging all work as described.
- Test count 44 -> 52.
# 2026-08-30 — large closed dome + first-layer adhesion

- D4 physical evidence proved the 360° seam but exposed an open crown: its
  `hFrac:0.95` terminal ring never reached the old fixed cap trigger.
- Crown closure now starts from a radius bound that scales with layer height
  and sphere radius, and the spiral pitch is below one bead so the cap is a
  deliberately filled membrane. A 95% R32 regression closes with two cap
  layers; the R90 hemisphere closes with three.
- First-layer settings are explicit parameters: `firstLayerBead`,
  `firstLayerSpeed`, `adhesion` (`none|brim|foundation`) and `adhesionWidth`.
  Dome adhesion is one continuous annular spiral and is exported identically
  in STL and G-code. Filled cap/foundation proximity is intentional and is
  excluded from the unintended-overlap detector.
- Print-ready D5 lives in
  `specimens/2026-08_D5_large_dome_pending/`: 200.8 × 200.6 × 90 mm,
  376 paths/layers, 22,912 weld nodes, 0 unintended overlaps, 3 cap layers,
  17.999 m foundation, 81,458,884-byte STL, SHA-256
  `1204eb15f00c013589eb4d4c3f3004acf3440525c88f6a4e4528258d2d47d989`.
- Verification: **56/56 passed** in system Chrome. The Windows harness now
  resolves its own path with `fileURLToPath`; `createRequire` also allows the
  workspace Playwright runtime without installing packages into WEFT.

Honest verdict: software geometry and export are ready. Physical success is
not yet proven at R90; the first complete annular foundation is the decisive
smoke test, and Bambu Studio—not WEFT's kinematic estimate—owns real print time.
## 2026-09-03 · MERA A2L 4×4 v1

Built the first shallow measurement plate after the 240 mm Penjač physically broke during printing.
`plate_geometry.py` emits sixteen open instruments on a 60 mm grid and one connected first layer;
`make_suma.mjs` now accepts grammar/wall/tab/lambda overrides per contour, reports the actual plate
envelope and refuses an off-plate build. The delivered package is
`specimens/2026-09-03_MERA_A2L_4x4_v1_pending/MERA_A2L_4x4_v1_A2L.gcode.3mf`.

Measured final-package result: 220.8 × 223.4 × 22.08 mm, 92 object layers, 43.0 g, about 5 h 02 min;
0 floating paths, 0 long bridges, 0 cantilevers, 0 bad/unanchored membranes, first layer 1 island,
354,196 checked points, 4/4 membrane anchors = 1.000, 0 same-layer overlaps. The first cap attempt was
correctly refused at 2–4% anchor and deleted; the fix offsets each membrane by the local wall normal
onto the inner chord rail. During that refusal another gate defect was found: unanchored membranes were
reported but omitted from the exit-code sum. It is fixed and guarded by T18.

The legacy browser suite remains 44/56 before this work; with T18 it is 45/57 if no older failure moves.
Those failures predate MERA and are still open. The final MERA G-code gate is independently green.

### Correction caught in Bambu Studio

Semir opened the delivered package and found the entire structure displayed on layer 1. Z moves were present
and the gate had counted 93 physical Z planes, but the emitter used Cura-style `;LAYER_CHANGE / ;Z / ;HEIGHT`
comments. Bambu Studio requires its own spaced `; CHANGE_LAYER / ; Z_HEIGHT / ; LAYER_HEIGHT` dialect.
The artifact was not printable because a preview that lies is a failed artifact, regardless of the machine
moves beneath it. The emitter and header counter now accept the Bambu dialect, T10g locks all three markers,
and the A2L package was regenerated with 92 strictly rising Bambu layer groups. T10h also locks the deeper
multi-body invariant already present in Penjač: all contours at one height share a global Z level before any
body advances. The regenerated package still requires Semir's visual Bambu Studio confirmation before print.
