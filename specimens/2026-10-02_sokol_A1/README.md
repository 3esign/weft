# SOKOL — A1, pure-weft/v2 (2026-10-02)

A perched peregrine, woven. 88.5 x 85.4 x 187.92 mm, 783 layers, 1142.7 m of thread, 142.7 g of
filament, 18h 50m on the container's own estimate. No support material, no wall, and nothing in it
that the layer below cannot carry.

The figure stands on three things, which is how every bronze falcon has ever stood: two tarsi and
the **tail**, raked forward from the back of the rock until it meets the body. Above the rock the
section is five islands; they fuse into one trunk; the wings stand off the flanks and open two
windows you can see daylight through; they rejoin at the mantle; and the head closes over two
sockets bored in from the sides.

Measured off the field itself, half a millimetre at a time:

```
z   0.5 .. 8.5    1 island    the rock
z   9   .. 35     5           two tarsi + the tail blade + two wings — all five stand on the stone
z  35.5 .. 57.5   4           the tarsi merge into one column
z  58   .. 121    3           the tail is taken into the trunk, and the two windows between wing
                              and flank stay open for 63.0 mm of height
z 121.5 .. 187.9  1           the wings rejoin the mantle; neck, head, beak, crown — and the brow
                              never parts, so the sockets never cut the head in two
```

The wings used to bud out of the tail blade. That cost four whole builds: two blades parting face to
face hold each other by a strip a few tenths of a millimetre thick, and no pitch, angle or wave makes
that printable. They now stand on the stone themselves, so the body has no split event at all and the
only junction left is the shoulder.

## What the skin does, and why it is the whole piece

A body with no surface cannot be given a surface drawing. It can only be given a drawing made of
**how open it is**, and this is the first body in the project where that is the point rather than a
side effect.

- **The bars.** A peregrine's underside is barred. Here the weave's amplitude and the core's pitch
  are both modulated in **z**, so the skin opens and closes in bands up the breast — about eleven of
  them, 11 mm apart, over the 125 mm from the stone to the throat. The core pattern changes every
  band as well (lines at 90°, a sine, a 45°-rotating grid with a density gradient across it), so no
  bar repeats its neighbour.
- **The rectrices and the primaries.** Until this body the rim's wave counted lobes along the
  **perimeter** and its phase drifted per layer, so the openings spiralled. That is right for stone
  and for down and wrong for a feather: `t = 0` is wherever marching squares entered the contour, and
  a section that changes width redistributes every lobe under it. So the tail and the wings use a new
  anchor — a **standing wave in the plate's own coordinates**, in `y` for the tail and in `x` for the
  wings. On a straight blade that cannot itself explain any difference, the spatial anchor holds the
  groove to **0.000 mm of drift over 33 layers**; the arc anchor on the same blade moves 0.34 mm.
  Four hundred layers stack into one unbroken quill line.
- **The scales.** A falcon's tarsus is reticulated, so the tarsi keep the arc anchor and drift fast
  (0.52 rad a layer): the rings climb.
- **The stone.** The rock takes a density gradient across the scan, so it is close on one flank and
  open on the other, and its grain turns 30° every layer.
- **The coverts.** Where an island splits off, a whole new boundary appears in what was the inside of
  the layer below — and that layer put its thread on a 2 mm pitch, so twenty millimetres of new rim
  can land in the gaps between fill lines. So the two junction bands are close-woven and shallow. A
  bird has a dense line of coverts at exactly those two places; structure and plumage wanted the same
  thing.
- **The sockets.** One subtraction, a capsule driven in from each side, stopped short of the other.
  The head never becomes two islands — the brow carries the weave straight across — and at eye height
  the boundary's nearest approach to the centroid drops from about 14 mm to under 6. The same line
  that draws the head turns into the socket and back out.

## Evidence

| what | result |
|---|---|
| the generator's own refusals | none — 0 violations |
| worst unsupported run / free span | 9.01 mm / 7.17 mm against a 12 mm allowance |
| points pulled back inside the body | 90 of 2 248 019 emitted, worst pull-back 0.27 mm |
| layers whose weave amplitude was clamped to the section | 47 |
| `check_gcode` gate S1 | PASS — 0 floating, 0 long bridge, 0 cantilever, 2 739 915 points, 785 layers, 1 island on the first layer |
| the layered gate S2–S8 / ORDER | S2 INFO · S3 PASS · S4 PASS · S5 INFO · S7 INFO · S8 WARN · ORDER N/A — **0 findings** |
| the same gate re-run inside the container | PASS (2 739 915 points) |
| `tools/check_pure_weft.mjs` | **0 walls** in 2031 body runs, 1141.0 m |
| control: the genuine Bambu slice this machine entry was harvested from | **28 walls** on the same checker |
| the file's own extrusion, summed independently | 47 087.8 mm of filament = 142.7 g; bead area 0.0991 mm², 0.413 mm wide at 0.24 mm layer |
| `tests/sokol_weft.test.mjs` | OK |
| `tests/header_truth.test.mjs` | OK |
| Bambu Studio 2.07.01.62 | opens **pre-sliced**: Preview active, Print plate green, 783 layers, 187.88 mm |

## The header that was not written

The plain `.gcode` shipped beside the container carried the **template's** header — 167 layers, 7.20 g,
max Z 40.04 — for a 783-layer, 188 mm, 142.7 g falcon, while the build log printed the correct numbers.
`fixHeader` split the file on `'\n'`, which leaves a `'\r'` on the harvested A1 start block's lines,
and its patterns end in `$` without the `m` flag; `.` does not match `'\r'`, so all six substitutions
missed in silence. The container was never affected — the packer rewrites the same fields with its own
anchored replace — so the defect only ever reached an SD card.

It had been live since the A1 machine entry was harvested (a Windows export, hence CRLF). `PUN_KOCKA.gcode`
from the A2L era still carries a correct header; `STOLICA.gcode` does not.

Fixed in `core/weft_build.mjs` (the patterns tolerate `\r`, each line keeps the ending it arrived with
— normalising instead grew this file by 2.76 MB) and guarded in `weft.mjs`: the shipped header is now
**read back off the disk** and compared against the moves, because a log line is not evidence that a
file changed. `tests/header_truth.test.mjs` holds all three cases, including the mixed one an A1 build
really is.

## Rebuild

```
node core/weft_field_geometry.mjs --variant sokol --machine a1 \
  --out specimens/2026-10-02_sokol_A1/SOKOL_geometry.json \
  --svg specimens/2026-10-02_sokol_A1/SOKOL_program.svg --allow-assumed-bead --report
node weft.mjs build --geo specimens/2026-10-02_sokol_A1/SOKOL_geometry.json --machine a1 \
  --out specimens/2026-10-02_sokol_A1 --name SOKOL --i-know-the-bead-is-a-guess --end-z-from-template
```

| shipped | sha256 |
|---|---|
| `SOKOL.gcode.3mf` | `7bc118b5d4b200c31bf7828284e51a9536645b7044fd3ddce394b171bfe77ab6` |
| `SOKOL.gcode` (not committed) | `c74e3d7381b7054739666abbc82dfffc28ff0622e0a27aa8191213339182a5bf` |

The geometry (55 MB), the display mesh (340 MB) and the raw G-code (98 MB) are not committed; the two
commands above rebuild them.

## Opening it

`.gcode.3mf` is a **project**, not a model: **File → Open Project (Ctrl+O)**, or drag it onto the
Studio window. *Import model* filters for meshes and will not list it. The plain `.gcode` beside it
goes straight to an SD card and needs no Studio at all.

## Not measured

- The A1 bead is still the **ASSUMED 0.45 mm** carried over from the A2L. Every millimetre here is
  worth exactly what that number is worth; run the C1 thin-wall test on the A1 and measure before
  trusting the dimensions.
- **Studio's own panel disagrees with Studio's own file.** It shows 17.93 m / 54.32 g / 2h11m, while
  the container metadata, the rewritten header and an independent sum of every `E` in the G-code all
  say 47.09 m / 142.7 g, and 2h11m cannot move 1142 m of thread at 50 mm/s. Studio's layer count (783)
  and height (187.88 mm) do match. Not chased; believe the extrusion sum.
- Our two writers disagree on one cosmetic field: the packer writes `total filament volume [cm^3]` in
  cm³ (113.26) and `fixHeader` in mm³ (113 456), which is what BambuStudio's own exports do — the
  harvested template says 5716.53 for 2376.66 mm of filament, i.e. mm³ under a cm³ label. Nothing reads
  it; nothing was changed to avoid repacking a verified container over a label.
- The Studio warning "object SOKOL.stl has floating cantilever" is its heuristic on the **display
  mesh**, not on the toolpath. Our gate measures support point by point against the layer below: 0
  cantilever, worst free span 7.17 mm against a 12 mm allowance.

Outcome: **NOT PRINTED.** Fill this in after the print, with photographs.
