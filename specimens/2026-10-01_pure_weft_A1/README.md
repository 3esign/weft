# PURE WEFT — three full bodies for the Bambu Lab A1 (2026-10-01)

Open the `.gcode.3mf` in Bambu Studio and press print, or drop the `.gcode` on the SD card.
**Do not slice.** These are already toolpaths; there is nothing for a slicer to do.

| body | size (mm) | layers | thread | weight | time |
|---|---|---|---|---|---|
| PUN_KOCKA   | 42 x 42 x 24 | 100 | 120.0 m | 15.5 g | ~1h 32m |
| PUN_SUNDJER | 36.8 x 36.7 x 19.9 | 83 | 48.5 m | 6.7 g | ~38m |
| PUN_DRVO    | 27 x 27 x 30 | 125 | 24.2 m | 3.8 g | ~19m |

## What changed from `solid-infill/v1`

The previous cut still printed a **closed perimeter loop** on every layer. On screen and on the bed
that is a wall, however it was described — and it split the object into shell plus filling again.

`pure-weft/v1` has no closed path anywhere in the body. Each layer is:

1. **RIM** — one open spiral that enters at the boundary and works inward through a *pitch schedule*,
   e.g. `[0.45, 0.8, 1.4]`: the first pass lies where a slicer would put a wall, each later pass opens
   toward the interior. No pass is a loop; the seam step **is** the weave.
2. **CORE** — one open interior pattern (lines, sine, hilbert, spiral, or a density *field*) laid on
   the section inset to where the innermost rim pass begins, so its ends weld onto rim material.

Both are free per layer, so density is a field in **r** and in **z**, and one layer can carry two
different patterns by construction. Where a section is too small to hold a core, the rim's schedule
simply continues to the centre.

## Measured, not assumed

- **0 closed body paths** in all three shipped G-codes — `node tools/check_pure_weft.mjs <file>.gcode`
  splits extrusion runs on travel moves (not on `; FEATURE` markers, which merge rim and core and
  would have hidden a closed rim) and refuses any run that returns within 0.44 mm of its own start.
- Gate **S1** and the layered gate **S2–S8/ORDER**: 0 problems on each G-code and again inside each
  container (`*_gate.json`, `*_package_gate.json`).
- Display mesh is lofted from **this build's own layer silhouettes** — bbox measured inside
  `3D/Objects/object_1.model`: 42.00 / 36.79 / 27.00 mm. Three files, three different bodies.
- `printer_model = Bambu Lab A1`, bed 65 C, end `Z = max_layer_z + 0.4` evaluated per body
  (24.4 / 20.32 / 30.4 mm).

## Fix of 2026-10-01 evening: Studio was asking to re-slice an already sliced file

The containers declared `plate_1.json` → `bbox_all = [-48.2, 105.74, 150.26, 254.0]`. That bbox was
measured over **every** extrusion in the G-code, so it swallowed the harvested A1 start block, which
purges and primes off the bed (X-48.2 … X267, Y254). Bambu Studio believed the declaration, decided
the object lay partly outside the 256 × 256 plate, greyed out **Print plate** and lit **Slice plate** —
on a file whose toolpaths were correct the whole time.

The bbox is now measured from the first `; layer` marker onward, i.e. the body only:
`105.74 … 150.26` (kocka), `109.72 … 146.23` (sunđer), `114.26 … 141.39` (drvo), all centred on 128.
The G-code payload is unchanged — the MD5 of each `Metadata/plate_1.gcode` is byte for byte the one
shipped this afternoon (`514B736D…`, `C6A20AE2…`, `FA294560…`). Guard: `tests/plate_bbox.test.mjs`.

## Known, open

**Bead is ASSUMED 0.45 mm** — carried over from the A2L, never calibrated on this A1. Dimensions are
only as good as that number. Run the C1 thin-wall test on the A1, measure, and write it into
`machines.json` before trusting the millimetres.

Not printed yet. Fill in the outcome here, with photographs.
