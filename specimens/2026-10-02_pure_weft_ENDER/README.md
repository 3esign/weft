# PURE WEFT — three full bodies for the Creality Ender-3 V4 (2026-10-02)

Drop the `.gcode` on the SD card and print. **There is nothing to slice.** These are finished
toolpaths; the `.stl` next to each one exists only so you can look at the body, not to be sliced.

The small version of the pair. The same three bodies are also built for the Bambu Lab A1 in
`../2026-10-01_pure_weft_A1/`, and the sculpture of the pair is `../2026-10-02_sokol_A2L/`.

| body | size (mm) | layers | thread | filament | weight | time (kinematic) |
|---|---|---|---|---|---|---|
| PUN_KOCKA   | 42 x 42 x 24     | 120 | 141.1 m | 4658.0 mm | 14.12 g | 1h 47m 50s |
| PUN_SUNDJER | 36.8 x 36.6 x 20 | 100 |  57.1 m | 1967.5 mm |  5.96 g |    43m 48s |
| PUN_DRVO    | 27 x 27 x 30     | 150 |  28.8 m | 1086.3 mm |  3.29 g |    21m 27s |

Machine: `ender` — bead **0.42 mm**, layer 0.20 mm, first layer 0.48 mm at 12 mm/s, nozzle 220 C,
bed 60 C, plate 220 x 220, all three centred on (110, 110). Three touching brim rings at the base.

## Measured, not assumed

- `node tools/check_pure_weft.mjs <file>.gcode` — **WALLS 0** in all three, 0 runs ending near their
  own start: 240 / 200 / 300 body runs. No closed path anywhere in any body.
- Gate **S1**: 0 problems — 0 floating, 0 cantilever, 0 long bridge — over 315 037 / 128 262 / 66 086
  checked points; 16 016 / 4 808 / 1 804 legal bridges. First-layer audit PASS, one island each.
- Layered gate **S2–S8/ORDER**: 0 findings.

## The defect this build found: aliasing between the gate's sampling and the pitch below

PUN_KOCKA failed the gate here and passed on the A1 with the same geometry. Four LONG_BRIDGE at
z 23, up to **19.79 mm** against a 12 mm ceiling, all on one path — the first cap course.

The material is fine. The first cap layer is dense (0.85 mm) and so was typed `wall`; a `wall` may be
LOD'd, and the builder's `simplifyPts` thinned its straight chords to vertices about **2.5 mm**
apart. Under it stood the last crescendo course, **4.71 mm** apart. The gate decides support *at
vertices*, so a vertex spacing coarser than the pitch below aliases: the chord really crossed a line
every 4.71 mm, but its surviving vertices kept landing in between, and the run read as one 19.79 mm
bridge that does not exist in the plastic. Measured directly off the rejected G-code: the true
unsupported runs along that chord are **3.5 mm**, every one of them.

The A1 passed the same geometry by luck, not by right — 100 layers instead of 120 put the crescendo
at 4.55 mm and the aliasing happened to miss.

Fix, in `core/weft_solid_geometry.mjs`: **what bridges is decided by the layer below, not by this
one.** A fill is typed `bridge` — vertices preserved, 0.5 mm sampling — when this layer is sparse
**or** the layer below is. That is also the honest type: that course *is* bridging. Guard:
`tests/pure_weft.test.mjs` now asserts the typing and the vertex spacing on every course that stands
over sparse material, on both machines (109 / 89 / 139 such courses on the Ender, 89 / 72 / 114 on
the A1).

## Known, open

**Bead is ASSUMED 0.42 mm — this machine has NEVER been calibrated.** Every millimetre above is
derived from that number. Run the C1 thin-wall test on the Ender, measure the width, and write it
into `machines.json` before trusting the dimensions:

```
node weft.mjs build --preset C1_calibration_ladder --machine ender --out specimens/<date>_C1_ENDER
```

Not printed yet. Fill in the outcome here, with photographs.

## Rebuild (the `.stl` and `_geometry.json` are not in the repository — too large)

```
node core/weft_solid_geometry.mjs --variant kocka --machine ender \
  --out specimens/2026-10-02_pure_weft_ENDER/PUN_KOCKA_geometry.json \
  --svg specimens/2026-10-02_pure_weft_ENDER/PUN_KOCKA_ENDER.svg \
  --name PUN_KOCKA --allow-assumed-bead
node weft.mjs build --geo specimens/2026-10-02_pure_weft_ENDER/PUN_KOCKA_geometry.json \
  --machine ender --out specimens/2026-10-02_pure_weft_ENDER --name PUN_KOCKA \
  --i-know-the-bead-is-a-guess
```

`--variant sundjer` / `drvo` and `--name PUN_SUNDJER` / `PUN_DRVO` for the other two. The SHA-256 of
every artefact, built and excluded alike, is in `manifest.json`.
